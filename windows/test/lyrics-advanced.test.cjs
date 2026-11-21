const { test } = require('node:test');
const assert = require('node:assert/strict');
const { acceptRefinements } = require('../lyrics-advanced.cjs');
const original = [{ t: 1, text: 'Hello world' }, { t: 4, text: 'Good morning' }];
const candidate = { t: 1.2, text: 'Hello world', conf: 0.9, previousConf: 0.6, confMethod: 'mms-fa-v1', words: [{ t: 1.2, b: 2, text: 'Hello' }, { t: 2.1, b: 3, text: 'world' }] };
test('accepts improved confidence with exact original words', () => {
  assert.deepEqual(acceptRefinements(original, [candidate, original[1]]), [candidate, original[1]]);
});
test('preserves timing when confidence falls or text changes', () => {
  for (const update of [{ conf: 0.5 }, { text: 'Other text' }, { t: 2.5 }, { words: [] }]) {
    assert.deepEqual(acceptRefinements(original, [{ ...candidate, ...update }, original[1]]), original);
  }
});
test('preserves existing CTC confidence and rejects overlapping word times', () => {
  const old = [{ ...original[0], conf: 0.95, confMethod: 'mms-fa-v1' }, original[1]];
  assert.deepEqual(acceptRefinements(old, [candidate, old[1]]), old);
  const overlap = { ...candidate, words: [candidate.words[0], { ...candidate.words[1], t: 1.5 }] };
  assert.deepEqual(acceptRefinements(original, [overlap, original[1]]), original);
});

test('does not accept words borrowed from the next line', () => {
  const crossing = { ...candidate, words: [candidate.words[0], { ...candidate.words[1], b: 4.2 }] };
  assert.deepEqual(acceptRefinements(original, [crossing, original[1]]), original);
});
