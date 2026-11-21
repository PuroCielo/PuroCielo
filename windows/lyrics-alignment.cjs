const normalize = text => text.toLocaleLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
function alignLyrics(text, transcript, duration) {
  const lines = text.split(/\r?\n/).map(text => text.trim()).filter(text => text && !/^\[.*\]$/.test(text));
  const expected = lines.flatMap((text, line) => text.split(/\s+/).map(word => ({ word: normalize(word), line })).filter(x => x.word));
  const heard = transcript.flatMap(segment => {
    const words = segment.text.trim().split(/\s+/).map(normalize).filter(Boolean);
    const start = segment.offsets?.from / 1000, end = segment.offsets?.to / 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration + 1 || end < start) return [];
    return words.map((word, i) => ({ word, time: start + (end - start) * i / words.length }));
  });
  if (!expected.length || expected.length > 3000 || !heard.length || heard.length > 6000) throw new Error('Не удалось сопоставить текст с записью');
  const width = heard.length + 1;
  const scores = new Uint16Array((expected.length + 1) * width);
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= heard.length; j++) {
      scores[i * width + j] = expected[i - 1].word === heard[j - 1].word
        ? scores[(i - 1) * width + j - 1] + 1
        : Math.max(scores[(i - 1) * width + j], scores[i * width + j - 1]);
    }
  }
  const matches = new Map();
  let i = expected.length, j = heard.length;
  while (i && j) {
    if (expected[i - 1].word === heard[j - 1].word) { matches.set(i - 1, heard[j - 1].time); i--; j--; }
    else if (scores[(i - 1) * width + j] >= scores[i * width + j - 1]) i--;
    else j--;
  }
  if (matches.size / expected.length < 0.7) throw new Error('Слова распознаны недостаточно уверенно. Исходный текст сохранён');
  let previous = -1;
  return lines.map((text, line) => {
    const words = expected.map((word, index) => ({ ...word, index })).filter(word => word.line === line);
    const matched = words.filter(word => matches.has(word.index));
    if (!words.length || matched.length / words.length < 0.5 || !matches.has(words[0].index)) throw new Error('Начала строк не удалось определить уверенно. Исходный текст сохранён');
    const t = matches.get(words[0].index);
    if (t <= previous) throw new Error('Не удалось определить порядок строк');
    previous = t;
    return { t, text };
  });
}
module.exports = { alignLyrics };
