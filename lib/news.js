// Aggregates NFL / fantasy football news from public RSS feeds so you don't
// need Twitter or other social apps to stay on top of breaking news.
import Parser from 'rss-parser';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cached } from './cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FEEDS = [
  { source: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' },
  { source: 'Yahoo Sports', url: 'https://sports.yahoo.com/nfl/rss.xml' },
  { source: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/nfl/' },
  { source: 'RotoBaller', url: 'https://www.rotoballer.com/feed' },
  { source: 'NBC ProFootballTalk', url: 'https://profootballtalk.nbcsports.com/feed/' },
];

const parser = new Parser();

// Keywords that make a headline actionable for fantasy managers.
const ALERT_WORDS = [
  'injury', 'injured', 'out for', 'questionable', 'doubtful', 'ruled out',
  'ir', 'injured reserve', 'acl', 'mcl', 'hamstring', 'concussion',
  'trade', 'traded', 'sign', 'signed', 'release', 'released', 'waive', 'waived',
  'suspend', 'suspended', 'starter', 'starting', 'benched', 'depth chart',
  'activated', 'return', 'surgery', 'practice',
];

function classify(title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  return ALERT_WORDS.some((w) => text.includes(w));
}

function stripHtml(s = '') {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchFeed(feed) {
  // Fetch the XML with native fetch (clean abort on timeout) and let
  // rss-parser only parse the string — parseURL leaves sockets hanging.
  const res = await fetch(feed.url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'user-agent': 'FantasyFootballHub/1.0',
      accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  });
  if (!res.ok) throw new Error(`${feed.url} -> HTTP ${res.status}`);
  const parsed = await parser.parseString(await res.text());
  return (parsed.items || []).map((item) => ({
    id: item.guid || item.link || `${feed.source}:${item.title}`,
    title: stripHtml(item.title || ''),
    link: item.link || '',
    source: feed.source,
    published: item.isoDate || item.pubDate || null,
    summary: stripHtml(item.contentSnippet || item.content || '').slice(0, 300),
    actionable: classify(item.title, item.contentSnippet),
  }));
}

async function fetchAllFeeds() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);
  if (items.length === 0) {
    throw new Error('All news feeds unreachable');
  }
  // De-dupe near-identical headlines across sources, newest first.
  const seen = new Set();
  const deduped = [];
  items.sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.slice(0, 150);
}

async function loadSampleNews() {
  const raw = await readFile(path.join(__dirname, '..', 'data', 'sample-news.json'), 'utf8');
  return JSON.parse(raw);
}

export async function getNews() {
  try {
    const { value, stale } = await cached('news', 5 * 60 * 1000, fetchAllFeeds);
    return { items: value, live: true, stale };
  } catch {
    return { items: await loadSampleNews(), live: false, stale: false };
  }
}
