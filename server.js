#!/usr/bin/env node
/**
 * Fantasy Football HQ — zero-dependency Node.js server.
 *
 * Serves the static frontend from ./public and exposes a small JSON API that
 * aggregates free, no-auth data sources:
 *
 *   - Sleeper API (https://docs.sleeper.com) for player data, rankings proxy,
 *     and trending waiver-wire adds/drops.
 *   - Public NFL news RSS feeds (ESPN, Yahoo, CBS, ProFootballTalk, RotoWire).
 *
 * Requires Node 18+ (built-in fetch). Run with:  node server.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const NEWS_FEEDS = [
  { source: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' },
  { source: 'Yahoo Sports', url: 'https://sports.yahoo.com/nfl/rss.xml' },
  { source: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nfl/' },
  { source: 'ProFootballTalk', url: 'https://profootballtalk.nbcsports.com/feed/' },
  { source: 'RotoWire', url: 'https://www.rotowire.com/rss/news.php?sport=NFL' },
];

const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const MAX_RANKED_PLAYERS = 600;

// ---------------------------------------------------------------------------
// Small in-memory cache with stale-on-error fallback.
// ---------------------------------------------------------------------------

const cache = new Map();

async function cached(key, ttlMs, loader) {
  const entry = cache.get(key);
  const now = Date.now();
  if (entry && now - entry.time < ttlMs) return entry.value;
  try {
    const value = await loader();
    cache.set(key, { time: now, value });
    return value;
  } catch (err) {
    if (entry) return entry.value; // serve stale rather than failing
    throw err;
  }
}

async function fetchText(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'FantasyFootballHQ/1.0 (personal news reader)' },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(url, timeoutMs = 20000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'FantasyFootballHQ/1.0' },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// RSS parsing (regex-based; tolerant of the common RSS 2.0 shapes).
// ---------------------------------------------------------------------------

const XML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&apos;': "'", '&#39;': "'", '&#039;': "'", '&nbsp;': ' ',
};

function decodeXmlText(raw) {
  let s = String(raw || '');
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = s.replace(/<[^>]+>/g, ' '); // strip embedded HTML tags
  s = s.replace(/&(amp|lt|gt|quot|apos|nbsp|#0?39);/g, (m) => XML_ENTITIES[m] || m);
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return s.replace(/\s+/g, ' ').trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function parseRssItems(xml, source) {
  const items = [];
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = decodeXmlText(extractTag(block, 'title'));
    if (!title) continue;
    const linkRaw = extractTag(block, 'link');
    const link = decodeXmlText(linkRaw) || '';
    const dateRaw = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    const date = dateRaw ? new Date(decodeXmlText(dateRaw)) : null;
    let summary = decodeXmlText(extractTag(block, 'description'));
    if (summary.length > 320) summary = summary.slice(0, 317).trimEnd() + '…';
    items.push({
      title,
      link,
      source,
      date: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      summary,
    });
  }
  return items;
}

async function loadNews() {
  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async (feed) => parseRssItems(await fetchText(feed.url), feed.source))
  );
  const items = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else errors.push({ source: NEWS_FEEDS[i].source, error: String(r.reason && r.reason.message || r.reason) });
  });
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { updated: new Date().toISOString(), items: items.slice(0, 200), errors };
}

// ---------------------------------------------------------------------------
// Sleeper data: players, rankings proxy, trending adds/drops.
// ---------------------------------------------------------------------------

function condensePlayer(id, p) {
  return {
    id,
    name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || id,
    team: p.team || 'FA',
    pos: p.position,
    age: p.age || null,
    exp: typeof p.years_exp === 'number' ? p.years_exp : null,
    injury: p.injury_status || null,
    rank: typeof p.search_rank === 'number' ? p.search_rank : 9999999,
  };
}

async function loadPlayerMap() {
  return cached('sleeper-players-raw', 6 * 60 * 60 * 1000, async () => {
    const raw = await fetchJson('https://api.sleeper.app/v1/players/nfl', 60000);
    const map = new Map();
    for (const [id, p] of Object.entries(raw)) {
      if (!p || !p.position || !FANTASY_POSITIONS.has(p.position)) continue;
      const activeEnough = p.active !== false && (p.status !== 'Inactive' || p.position === 'DEF');
      if (!activeEnough && !p.injury_status) continue;
      map.set(id, condensePlayer(id, p));
    }
    return map;
  });
}

async function loadRankings() {
  const map = await loadPlayerMap();
  const players = [...map.values()]
    .filter((p) => p.rank < 9999999 || p.pos === 'DEF')
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_RANKED_PLAYERS);
  return { updated: new Date().toISOString(), players };
}

async function loadTrending() {
  const map = await loadPlayerMap();
  const [adds, drops] = await Promise.all([
    fetchJson('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=50'),
    fetchJson('https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=24&limit=50'),
  ]);
  const join = (rows) =>
    rows
      .map((row) => {
        const p = map.get(String(row.player_id));
        if (!p) return null;
        return { ...p, count: row.count };
      })
      .filter(Boolean);
  return { updated: new Date().toISOString(), adds: join(adds), drops: join(drops) };
}

async function loadNflState() {
  return fetchJson('https://api.sleeper.app/v1/state/nfl');
}

// ---------------------------------------------------------------------------
// HTTP server.
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(data);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const API_ROUTES = {
  '/api/news': () => cached('news', 5 * 60 * 1000, loadNews),
  '/api/players': () => cached('rankings', 60 * 60 * 1000, loadRankings),
  '/api/trending': () => cached('trending', 10 * 60 * 1000, loadTrending),
  '/api/state': () => cached('nfl-state', 60 * 60 * 1000, loadNflState),
};

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;
  const route = API_ROUTES[pathname];
  if (route) {
    try {
      sendJson(res, 200, await route());
    } catch (err) {
      sendJson(res, 502, { error: String(err && err.message || err) });
    }
    return;
  }
  serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Fantasy Football HQ running at http://localhost:${PORT}`);
  });
}

module.exports = { parseRssItems, decodeXmlText, condensePlayer, server };
