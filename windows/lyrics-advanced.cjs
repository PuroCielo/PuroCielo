const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { runProcess } = require('./lyrics-process.cjs');
const RUNTIME = 'lyrics-python-v1';
async function runtime(options) {
  const { userData, resources, signal } = options;
  const python = path.join(resources, 'python', 'python.exe');
  await fs.access(python);
  const packages = path.join(userData, RUNTIME);
  try { await fs.access(path.join(packages, 'ready')); }
  catch {
    const staging = packages + '.installing';
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });
    try {
      await runProcess(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-warn-script-location', '--no-cache-dir', '--no-index', '--find-links', path.join(resources, 'lyrics-worker', 'wheels'), '--target', staging, '-r', path.join(resources, 'lyrics-worker', 'requirements.txt')], { signal });
      await fs.writeFile(path.join(staging, 'ready'), '1');
      await fs.rename(staging, packages);
    } catch (error) { await fs.rm(staging, { recursive: true, force: true }); throw error; }
  }
  return { python, packages };
}
async function worker(request, directory, options) {
  const { python, packages } = await runtime(options);
  const input = path.join(directory, 'worker-request.json'), output = path.join(directory, 'worker-response.json');
  await fs.writeFile(input, JSON.stringify(request));
  const modelRoot = path.join(options.userData, 'lyrics-model');
  const env = { ...process.env, TORCH_HOME: path.join(modelRoot, 'torch'), HF_HOME: path.join(modelRoot, 'huggingface'), OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2', CUDA_VISIBLE_DEVICES: '' };
  await runProcess(python, [path.join(options.resources, 'lyrics-worker', 'worker.py'), packages, input, output], { signal: options.signal, env });
  return JSON.parse(await fs.readFile(output, 'utf8'));
}
async function separateVocals(input, directory, options) {
  const hash = createHash('sha256').update('htdemucs-v1:').update(await fs.readFile(input)).digest('hex');
  const stems = path.join(options.userData, 'stems');
  await fs.mkdir(stems, { recursive: true });
  const stem = path.join(stems, hash + '.wav');
  try { const stat = await fs.stat(stem); if (stat.size > 44) return stem; } catch {}
  const temporary = path.join(directory, 'vocals.wav');
  await worker({ task: 'separate', audioPath: input, output: temporary, directory }, directory, options);
  const partial = stem + '.partial';
  try { await fs.copyFile(temporary, partial); await fs.rename(partial, stem); }
  finally { await fs.rm(partial, { force: true }); }
  return stem;
}
function acceptRefinements(lines, candidates) {
  if (!Array.isArray(candidates) || candidates.length !== lines.length) throw new Error('Некорректный результат CTC');
  let previous = -1, previousEnd = 0;
  return candidates.map((line, i) => {
    const original = lines[i];
    const next = lines[i + 1]?.t ?? 900;
    const words = line.words, textWords = original.text.trim().split(/\s+/);
    const validWords = Array.isArray(words) && words.length === textWords.length && words.every((word, k) =>
      word.text === textWords[k] && Number.isFinite(word.t) && Number.isFinite(word.b) &&
      word.t >= line.t && word.b > word.t && word.b <= next &&
      (!k || word.t >= words[k - 1].b));
    const improved = Number.isFinite(line.conf) && Number.isFinite(line.previousConf) &&
      line.conf > Math.max(line.previousConf, original.confMethod === 'mms-fa-v1' ? original.conf || 0 : 0);
    const validTime = Number.isFinite(line.t) && line.t > previous && line.t >= previousEnd && line.t >= 0 &&
      line.t < next && line.t >= original.t - 0.8;
    const accepted = line.text === original.text && validTime && improved && validWords ? line : original;
    previous = accepted.t;
    const lastWord = accepted.words?.at(-1);
    previousEnd = lastWord?.b ?? lastWord?.t ?? accepted.t;
    return accepted;
  });
}
async function forceAlign(audioPath, lines, directory, options) {
  const result = await worker({ task: 'align', audioPath, lines }, directory, options);
  return acceptRefinements(lines, result.lines);
}
module.exports = { separateVocals, forceAlign, acceptRefinements };
