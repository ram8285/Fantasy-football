// Player data, rankings, and waiver-wire trends from the free Sleeper API
// (no API key required). Falls back to bundled sample data when offline.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cached } from './cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLEEPER = 'https://api.sleeper.app/v1';
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function loadSample(name) {
  const raw = await readFile(path.join(__dirname, '..', 'data', name), 'utf8');
  return JSON.parse(raw);
}

function trimPlayer(id, p) {
  return {
    id,
    name: p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || id,
    team: p.team || 'FA',
    position: p.position,
    age: p.age ?? null,
    years_exp: p.years_exp ?? null,
    status: p.status ?? null,
    injury_status: p.injury_status ?? null,
    rank: typeof p.search_rank === 'number' && p.search_rank < 9999999 ? p.search_rank : null,
  };
}

// The full Sleeper players dump is ~5MB; trim it to fantasy-relevant players
// and cache for 12 hours.
async function fetchPlayers() {
  const all = await fetchJson(`${SLEEPER}/players/nfl`);
  const players = {};
  for (const [id, p] of Object.entries(all)) {
    if (!FANTASY_POSITIONS.has(p.position)) continue;
    if (p.position !== 'DEF' && p.status !== 'Active' && p.status !== 'Injured Reserve') continue;
    players[id] = trimPlayer(id, p);
  }
  return players;
}

export async function getPlayers() {
  try {
    const { value, stale } = await cached('players', 12 * 60 * 60 * 1000, fetchPlayers);
    return { players: value, live: true, stale };
  } catch {
    return { players: await loadSample('sample-players.json'), live: false, stale: false };
  }
}

// Break a ranked list into tiers wherever there is a noticeable rank gap,
// with a max tier size so tiers stay meaningful.
export function assignTiers(rankedPlayers, { gapFactor = 1.8, maxTierSize = 8 } = {}) {
  let tier = 1;
  let sizeInTier = 0;
  let prevRank = null;
  const gaps = [];
  for (let i = 1; i < rankedPlayers.length; i++) {
    gaps.push(rankedPlayers[i].rank - rankedPlayers[i - 1].rank);
  }
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
  return rankedPlayers.map((p) => {
    if (prevRank !== null) {
      const gap = p.rank - prevRank;
      if ((gap > avgGap * gapFactor && sizeInTier >= 3) || sizeInTier >= maxTierSize) {
        tier += 1;
        sizeInTier = 0;
      }
    }
    prevRank = p.rank;
    sizeInTier += 1;
    return { ...p, tier };
  });
}

export async function getRankings({ position = 'ALL', limit = 200 } = {}) {
  const { players, live, stale } = await getPlayers();
  let list = Object.values(players).filter((p) => p.rank !== null);
  if (position !== 'ALL') list = list.filter((p) => p.position === position);
  list.sort((a, b) => a.rank - b.rank);
  list = list.slice(0, limit);

  // Positional rank (e.g. RB12) computed within each position over the slice.
  const posCount = {};
  list = list.map((p) => {
    posCount[p.position] = (posCount[p.position] || 0) + 1;
    return { ...p, posRank: `${p.position}${posCount[p.position]}` };
  });

  return { rankings: assignTiers(list), live, stale };
}

async function fetchTrending(type) {
  return fetchJson(`${SLEEPER}/players/nfl/trending/${type}?lookback_hours=24&limit=40`);
}

export async function getTrending(type) {
  if (type !== 'add' && type !== 'drop') throw new Error('type must be add or drop');
  const { players, live: playersLive } = await getPlayers();
  let raw;
  let live = true;
  try {
    ({ value: raw } = await cached(`trending:${type}`, 15 * 60 * 1000, () => fetchTrending(type)));
  } catch {
    raw = await loadSample(`sample-trending-${type}.json`);
    live = false;
  }
  const maxCount = Math.max(...raw.map((r) => r.count), 1);
  const items = raw
    .map((r) => {
      const p = players[r.player_id];
      if (!p) return null;
      return {
        ...p,
        count: r.count,
        // Rough FAAB suggestion: scale with how hot the add is, nudged up for
        // players who already carry a decent overall rank.
        faab: type === 'add' ? suggestFaab(r.count / maxCount, p.rank) : null,
      };
    })
    .filter(Boolean);
  return { items, live: live && playersLive };
}

export function suggestFaab(heat, rank) {
  let pct = Math.round(heat * 30); // hottest add of the day ~30% of budget
  if (rank !== null && rank <= 100) pct += 15; // startable player available
  else if (rank !== null && rank <= 200) pct += 5;
  return Math.max(1, Math.min(pct, 60));
}
