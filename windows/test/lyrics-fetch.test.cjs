const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchText } = require('../lyrics-fetch.cjs');
test('rejects unsupported URLs and redirects outside lyrics sites', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://example.org/' } }); };
  assert.equal(await fetchText('file:///private', fetchFn), '');
  assert.equal(calls, 0);
  assert.equal(await fetchText('https://genius.com/song', fetchFn), '');
  assert.equal(calls, 1);
});
test('decodes Windows-1251 and accepts the AZLyrics search host', async () => {
  const bytes = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
  assert.equal(await fetchText('https://search.azlyrics.com/', async () => new Response(bytes, { headers: { 'content-type': 'text/html; charset=windows-1251' } })), 'Привет');
});
test('cancels oversized streamed responses', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(4_000_001)); }, cancel() { cancelled = true; } });
  assert.equal(await fetchText('https://genius.com/song', async () => new Response(stream)), '');
  assert.equal(cancelled, true);
});
