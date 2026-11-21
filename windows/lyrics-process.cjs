const { spawn } = require('node:child_process');
const os = require('node:os');
function runProcess(executable, args, { signal, env = process.env, timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, signal, env: { ...env, PYTHONUTF8: '1' }, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '', failure;
    child.stderr.on('data', chunk => { errorOutput = (errorOutput + chunk.toString()).slice(-4000); });
    try { if (child.pid) os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
    const timer = setTimeout(() => { failure = new Error('Превышено время обработки'); child.kill(); }, timeoutMs);
    child.on('error', error => { failure = error; });
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(errorOutput || `Процесс завершился с кодом ${code}`));
      else resolve();
    });
  });
}
module.exports = { runProcess };
