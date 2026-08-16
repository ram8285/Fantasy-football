'use strict';
/** Offline smoke tests: RSS parsing, player condensing, static + API routes. */

const assert = require('assert');
const http = require('http');
const { parseRssItems, decodeXmlText, condensePlayer, server } = require('../server.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

// ---------------------------------------------------------------- RSS parsing

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Sample NFL Feed</title>
  <item>
    <title><![CDATA[Star RB carted off with ankle injury]]></title>
    <link>https://example.com/story-1</link>
    <pubDate>Sat, 15 Aug 2026 14:30:00 GMT</pubDate>
    <description><![CDATA[<p>The team&#39;s lead back left in the 2nd quarter &amp; did not return.</p>]]></description>
  </item>
  <item>
    <title>QB signs extension &amp; stays put</title>
    <link>https://example.com/story-2</link>
    <pubDate>Fri, 14 Aug 2026 09:00:00 GMT</pubDate>
    <description>Big money deal.</description>
  </item>
  <item><description>No title, should be skipped</description></item>
</channel></rss>`;

test('parseRssItems extracts items with CDATA and entities', () => {
  const items = parseRssItems(SAMPLE_RSS, 'Test');
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, 'Star RB carted off with ankle injury');
  assert.strictEqual(items[0].link, 'https://example.com/story-1');
  assert.strictEqual(items[0].source, 'Test');
  assert.ok(items[0].date.startsWith('2026-08-15'));
  assert.strictEqual(items[0].summary, "The team's lead back left in the 2nd quarter & did not return.");
  assert.strictEqual(items[1].title, 'QB signs extension & stays put');
});

test('decodeXmlText strips tags and decodes entities', () => {
  assert.strictEqual(decodeXmlText('<b>A &amp; B</b> &#x1F525; &#39;ok&#39;'), "A & B 🔥 'ok'");
});

test('parseRssItems tolerates garbage input', () => {
  assert.deepStrictEqual(parseRssItems('not xml at all', 'X'), []);
  assert.deepStrictEqual(parseRssItems('', 'X'), []);
});

// ------------------------------------------------------------ player mapping

test('condensePlayer maps Sleeper fields', () => {
  const p = condensePlayer('4034', {
    full_name: 'Test Player', team: 'KC', position: 'RB',
    age: 27, years_exp: 5, injury_status: 'Questionable', search_rank: 12,
  });
  assert.deepStrictEqual(p, {
    id: '4034', name: 'Test Player', team: 'KC', pos: 'RB',
    age: 27, exp: 5, injury: 'Questionable', rank: 12,
  });
});

test('condensePlayer handles team defenses and missing fields', () => {
  const d = condensePlayer('SF', { first_name: 'San Francisco', last_name: '49ers', position: 'DEF' });
  assert.strictEqual(d.name, 'San Francisco 49ers');
  assert.strictEqual(d.team, 'FA');
  assert.strictEqual(d.rank, 9999999);
});

// ------------------------------------------------------------------- server

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const index = await get(port, '/');
  test('serves index.html at /', () => {
    assert.strictEqual(index.status, 200);
    assert.ok(index.body.includes('Fantasy Football HQ'));
  });

  const missing = await get(port, '/nope.html');
  test('404s unknown static files', () => assert.strictEqual(missing.status, 404));

  const traversal = await get(port, '/..%2f..%2fserver.js');
  test('blocks path traversal', () => assert.notStrictEqual(traversal.status, 200));

  const api = await get(port, '/api/news');
  test('API route responds with JSON (200 or 502 offline)', () => {
    assert.ok([200, 502].includes(api.status), `got ${api.status}`);
    JSON.parse(api.body); // must be valid JSON either way
  });

  server.close();
  console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
})();
