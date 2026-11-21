const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { runProcess } = require('./lyrics-process.cjs');
const { createHash } = require('node:crypto');
const { separateVocals, forceAlign } = require('./lyrics-advanced.cjs');
const { alignLyrics } = require('./lyrics-alignment.cjs');
const MODEL_HASH = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe';
let active;
function cancelAlignment() { active?.abort(); }
async function alignLocal({ wav, text, duration, lines: existingLines }, { userData, resources }) {
  if (active) throw new Error('Другая песня уже синхронизируется');
  if (!(wav instanceof Uint8Array) || wav.length > 60 * 1024 * 1024 || wav.length < 44 || typeof text !== 'string' || text.length > 40000 || !Number.isFinite(duration) || duration <= 0 || duration > 900) throw new Error('Неподдерживаемый размер песни или текста');
  const controller = new AbortController();
  active = controller;
  const { signal } = controller;
  let directory;
  try {
    const modelDir = path.join(userData, 'lyrics-model');
    await fs.mkdir(modelDir, { recursive: true });
    const model = path.join(modelDir, 'ggml-base.bin');
    if (!existingLines) {
      try { await fs.access(model); }
      catch {
        const response = await fetch('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin', { signal: AbortSignal.any([signal, AbortSignal.timeout(15 * 60 * 1000)]) });
        if (!response.ok || !response.body) throw new Error('Не удалось скачать модель распознавания');
        const partial = model + '.partial';
        const hash = createHash('sha256');
        const file = await fs.open(partial, 'w');
        let size = 0, verified = false;
        try {
          for await (const chunk of response.body) {
            size += chunk.length;
            if (size > 148000000) throw new Error('Неверный размер модели');
            hash.update(chunk);
            await file.writeFile(chunk);
          }
          if (hash.digest('hex') !== MODEL_HASH) throw new Error('Проверка модели не пройдена');
          verified = true;
        } finally {
          await file.close();
          if (!verified) await fs.rm(partial, { force: true });
        }
        await fs.rename(partial, model);
      }
    }
    signal.throwIfAborted();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'puro-align-'));
    const input = path.join(directory, 'audio.wav'), output = path.join(directory, 'result');
    await fs.writeFile(input, wav);
    let vocals;
    const options = { userData, resources, signal };
    try { vocals = await separateVocals(input, directory, options); }
    catch (error) { signal.throwIfAborted(); console.warn('Vocal separation unavailable:', error.message); }
    if (existingLines) {
      if (!vocals) return existingLines;
      try { return await forceAlign(vocals, existingLines, directory, options); }
      catch (error) { signal.throwIfAborted(); console.warn('CTC refinement unavailable:', error.message); return existingLines; }
    }
    await runProcess(path.join(resources, 'whisper', 'whisper-cli.exe'), ['-m', model, '-f', vocals || input, '-l', 'auto', '-ng', '-t', String(Math.max(1, Math.min(4, os.availableParallelism() - 1))), '-ml', '1', '-sow', '-oj', '-of', output], { signal });
    signal.throwIfAborted();
    const result = JSON.parse(await fs.readFile(output + '.json', 'utf8'));
    const lines = alignLyrics(text, result.transcription || [], duration);
    if (!vocals) return lines;
    try { return await forceAlign(vocals, lines, directory, options); }
    catch (error) { signal.throwIfAborted(); console.warn('CTC refinement unavailable:', error.message); return lines; }
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    active = null;
  }
}
module.exports = { alignLocal, cancelAlignment };
