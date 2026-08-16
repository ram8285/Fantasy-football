import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTiers, suggestFaab, getRankings, getTrending } from '../lib/sleeper.js';
import { getNews } from '../lib/news.js';

test('assignTiers groups players and breaks on rank gaps', () => {
  const players = [
    { rank: 1 }, { rank: 2 }, { rank: 3 },
    { rank: 40 }, { rank: 41 }, { rank: 42 },
  ];
  const tiered = assignTiers(players);
  assert.equal(tiered[0].tier, 1);
  assert.equal(tiered[2].tier, 1);
  assert.equal(tiered[3].tier, 2, 'large rank gap should start a new tier');
  assert.equal(tiered[5].tier, 2);
});

test('assignTiers caps tier size', () => {
  const players = Array.from({ length: 20 }, (_, i) => ({ rank: i + 1 }));
  const tiered = assignTiers(players, { maxTierSize: 8 });
  assert.equal(tiered[7].tier, 1);
  assert.equal(tiered[8].tier, 2);
  assert.equal(tiered[16].tier, 3);
});

test('suggestFaab stays within 1-60% and rewards rank + heat', () => {
  assert.ok(suggestFaab(1.0, 50) >= suggestFaab(0.1, 50));
  assert.ok(suggestFaab(0.5, 50) > suggestFaab(0.5, 500));
  assert.ok(suggestFaab(0, 9999) >= 1);
  assert.ok(suggestFaab(1.0, 1) <= 60);
});

// These exercise the full pipeline; offline they transparently use sample data.
test('getRankings returns tiered, position-ranked players', async () => {
  const { rankings } = await getRankings({ position: 'ALL', limit: 50 });
  assert.ok(rankings.length > 0);
  assert.ok(rankings[0].rank <= rankings[rankings.length - 1].rank, 'sorted by rank');
  assert.ok(rankings[0].tier === 1);
  assert.match(rankings[0].posRank, /^(QB|RB|WR|TE|K|DEF)\d+$/);
});

test('getRankings filters by position', async () => {
  const { rankings } = await getRankings({ position: 'RB', limit: 20 });
  assert.ok(rankings.length > 0);
  assert.ok(rankings.every((p) => p.position === 'RB'));
});

test('getTrending joins trend counts with player details', async () => {
  const { items } = await getTrending('add');
  assert.ok(items.length > 0);
  for (const p of items) {
    assert.ok(p.name);
    assert.ok(typeof p.count === 'number');
    assert.ok(p.faab >= 1 && p.faab <= 60);
  }
});

test('getTrending rejects invalid type', async () => {
  await assert.rejects(() => getTrending('steal'), /must be add or drop/);
});

test('getNews always returns items (live or sample)', async () => {
  const { items } = await getNews();
  assert.ok(items.length > 0);
  for (const i of items) {
    assert.ok(i.title);
    assert.ok(typeof i.actionable === 'boolean');
  }
});
