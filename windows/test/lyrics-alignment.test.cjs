const { test } = require('node:test');
const assert = require('node:assert/strict');
const { alignLyrics } = require('../lyrics-alignment.cjs');
const transcript = words => words.map((text, i) => ({ text, offsets: { from: (i + 1) * 1000, to: (i + 1) * 1000 + 500 } }));
test('keeps original Cyrillic text and maps repeated lines in order', () => {
  assert.deepEqual(alignLyrics('[Припев]\nЁлка, гори!\nЁлка, гори!', transcript(['елка', 'гори', 'елка', 'гори']), 10), [
    { t: 1, text: 'Ёлка, гори!' }, { t: 3, text: 'Ёлка, гори!' },
  ]);
});
test('rejects unrelated transcripts and missing line starts', () => {
  assert.throws(() => alignLyrics('Hello world\nGood morning', transcript(['other', 'words']), 10));
  assert.throws(() => alignLyrics('Hello world\nGood morning', transcript(['world', 'good', 'morning']), 10));
});
test('rejects invalid timestamps and oversized input', () => {
  assert.throws(() => alignLyrics('Hello', [{ text: 'hello', offsets: { from: -1, to: 20 } }], 10));
  assert.throws(() => alignLyrics('hello '.repeat(3001), transcript(['hello']), 10));
});
