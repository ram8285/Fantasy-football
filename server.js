/**
 * Fantasy Football HQ — zero-dependency Node.js server.
 *
 * Serves the static frontend from /public and provides a small JSON API that
 * aggregates free, no-API-key data sources:
 *
 *   GET /api/news          — merged NFL news from several RSS feeds
 *   GET /api/players       — condensed Sleeper NFL player database (rankings)
 *   GET /api/trending/add  — most-added players on Sleeper (waiver wire heat)
 *   GET /api/trending/drop — most-dropped players on Sleeper
 *
 * Every endpoint caches in memory and on disk, and falls back to
 * data/sample-*.json when the network is unavailable, so the UI always loads.
 *
 * Run: node server.js   (then open http://localhost:3000)
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');

// News feeds are plain RSS — add or remove any you like.
const NEWS_FEEDS = [
  { source: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' },
  { source: 'Yahoo Sports', url: 'https://sports.yahoo.com/nfl/rss.xml' },
  { source: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nfl/' },
  { source: 'RotoWire', url: 'https://www.rotowire.com/rss/news.php?sport=NFL' },
];

const SLEEPER = 'https://api.sleeper.app/v1';
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

const TTL = {
  news: 5 * 60 * 1000, // 5 minutes
  players: 12 * 60 * 60 * 1000, // 12 hours
  trending: 10 * 60 * 1000, // 10 minutes
};

fs.mkdirSync(CACHE_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Caching: memory -> disk -> live fetch -> stale disk -> bundled sample.
// ---------------------------------------------------------------------------

const memCache = new Map(); // key -> { at, data }

function diskPath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

function readDisk(key) {
  try {
    const raw = fs.readFileSync(diskPath(key), 'utf8');
    return JSON.parse(raw); // { at, data }
  } catch {
    return null;
  }
}

function writeDisk(key, entry) {
  try {
    fs.writeFileSync(diskPath(key), JSON.stringify(entry));
  } catch {
    /* cache write failures are non-fatal */
  }
}

function readSample(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `sample-${name}.json`), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Return { data, fetchedAt, source } where source is 'live' | 'cache' | 'sample'.
 */
async function cached(key, ttl, fetcher, sampleName) {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < ttl) {
    return { data: mem.data, fetchedAt: mem.at, source: mem.source || 'cache' };
  }
  const disk = readDisk(key);
  if (disk && Date.now() - disk.at < ttl) {
    memCache.set(key, disk);
    return { data: disk.data, fetchedAt: disk.at, source: 'cache' };
  }
  try {
    const data = await fetcher();
    const entry = { at: Date.now(), data, source: 'live' };
    memCache.set(key, entry);
    writeDisk(key, entry);
    return { data, fetchedAt: entry.at, source: 'live' };
  } catch (err) {
    console.error(`[fetch:${key}] ${err.message}`);
    if (disk) {
      memCache.set(key, disk);
      return { data: disk.data, fetchedAt: disk.at, source: 'cache' };
    }
    const sample = readSample(sampleName);
    if (sample) return { data: sample, fetchedAt: null, source: 'sample' };
    throw err;
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'fantasy-football-hq/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

// ---------------------------------------------------------------------------
// RSS parsing (regex-based; handles CDATA and entities well enough for
// mainstream sports feeds).
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1].trim();
  return decodeEntities(v);
}

function parseRss(xml, source) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = stripTags(tag(block, 'title'));
    if (!title) continue;
    const pubDate = tag(block, 'pubDate') || tag(block, 'dc:date');
    const ts = Date.parse(pubDate) || 0;
    items.push({
      source,
      title,
      link: stripTags(tag(block, 'link')),
      summary: stripTags(tag(block, 'description')).slice(0, 400),
      publishedAt: ts ? new Date(ts).toISOString() : null,
      ts,
    });
  }
  return items;
}

async function fetchNews() {
  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async (f) => parseRss(await fetchText(f.url), f.source))
  );
  const items = [];
  const failures = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else failures.push(NEWS_FEEDS[i].source);
  });
  if (!items.length) throw new Error(`all feeds failed (${failures.join(', ')})`);
  items.sort((a, b) => b.ts - a.ts);
  return { items: items.slice(0, 150), failedSources: failures };
}

// ---------------------------------------------------------------------------
// Sleeper player database -> condensed rankings.
// ---------------------------------------------------------------------------

async function fetchPlayers() {
  const raw = await fetchJson(`${SLEEPER}/players/nfl`);
  const players = [];
  for (const [id, p] of Object.entries(raw)) {
    if (!p || !FANTASY_POSITIONS.has(p.position)) continue;
    if (p.position !== 'DEF' && p.status !== 'Active') continue;
    const rank = p.search_rank;
    if (!rank || rank >= 9999999) continue;
    players.push({
      id,
      name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || id,
      team: p.team || 'FA',
      pos: p.position,
      age: p.age || null,
      exp: p.years_exp ?? null,
      injury: p.injury_status || null,
      rank,
      depth: p.depth_chart_order || null,
    });
  }
  players.sort((a, b) => a.rank - b.rank);
  // Keep the fantasy-relevant universe manageable.
  return players.slice(0, 600);
}

async function fetchTrending(type) {
  const list = await fetchJson(
    `${SLEEPER}/players/nfl/trending/${type}?lookback_hours=24&limit=60`
  );
  // Join names/positions from the player database.
  const { data: players } = await cached('players', TTL.players, fetchPlayers, 'players');
  const byId = new Map(players.map((p) => [p.id, p]));
  return list
    .map((t) => {
      const p = byId.get(String(t.player_id));
      return {
        id: String(t.player_id),
        count: t.count,
        name: p ? p.name : `Player ${t.player_id}`,
        team: p ? p.team : '?',
        pos: p ? p.pos : '?',
        injury: p ? p.injury : null,
        rank: p ? p.rank : null,
      };
    })
    .filter((t) => t.pos !== '?' || t.count > 0);
}

// ---------------------------------------------------------------------------
// HTTP server.
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function handleApi(req, res, pathname) {
  try {
    if (pathname === '/api/news') {
      const r = await cached('news', TTL.news, fetchNews, 'news');
      return sendJson(res, 200, { ...r.data.items ? r.data : { items: r.data }, fetchedAt: r.fetchedAt, dataSource: r.source });
    }
    if (pathname === '/api/players') {
      const r = await cached('players', TTL.players, fetchPlayers, 'players');
      return sendJson(res, 200, { players: r.data, fetchedAt: r.fetchedAt, dataSource: r.source });
    }
    if (pathname === '/api/trending/add' || pathname === '/api/trending/drop') {
      const type = pathname.endsWith('add') ? 'add' : 'drop';
      const r = await cached(`trending-${type}`, TTL.trending, () => fetchTrending(type), `trending-${type}`);
      return sendJson(res, 200, { players: r.data, fetchedAt: r.fetchedAt, dataSource: r.source });
    }
    return sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    return sendJson(res, 502, { error: err.message });
  }
}

function serveStatic(res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
  return serveStatic(res, pathname);
});

server.listen(PORT, () => {
  console.log(`Fantasy Football HQ running at http://localhost:${PORT}`);
});
