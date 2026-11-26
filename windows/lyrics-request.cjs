const { alignLocal } = require('./lyrics-engine.cjs');
function runAlignment(refine, payload, options) {
  if (refine && (!Array.isArray(payload?.lines) || !payload.lines.length || payload.lines.length > 2000 || payload.lines.some((line, i) => !line || !Number.isFinite(line.t) || line.t < 0 || line.t >= payload.duration || typeof line.text !== 'string' || line.text.length > 2000 || (i && line.t <= payload.lines[i - 1].t)))) throw new Error('Некорректные строки текста');
  return alignLocal({ wav: payload?.wav, duration: payload?.duration, text: refine ? payload.lines.map(line => line.text).join('\n') : payload?.text, lines: refine ? payload.lines : undefined }, options);
}
module.exports = { runAlignment };
