// Loopback transport. Only the official website can obtain an ephemeral session.
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const PORT = 43127;
function startBridge({ run, port = PORT, origin = 'https://purocielo.github.io' }) {
  const token = randomBytes(32).toString('hex'), jobs = new Map();
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); } };
    if (req.headers.host !== `127.0.0.1:${server.address().port}` || req.headers.origin !== origin) return reply(403, { error: 'Недоступно' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Puro-Job');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.writeHead(204); return res.end();
    }
    if (req.method === 'GET' && req.url === '/session') return reply(200, { protocol: 1, token });
    if (req.headers.authorization !== `Bearer ${token}`) return reply(401, { error: 'Подключитесь к Windows-приложению снова' });
    if (req.method !== 'POST' || !['/align', '/refine', '/cancel'].includes(req.url)) return reply(404, { error: 'Неизвестная операция' });
    const id = req.headers['x-puro-job'];
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(id)) return reply(400, { error: 'Некорректный запрос' });
    if (req.url === '/cancel') { jobs.get(id)?.abort(); return reply(200, { cancelled: true }); }
    if (jobs.size) return reply(409, { error: 'Другая песня уже синхронизируется' });
    if (req.headers['content-type'] !== 'application/octet-stream') return reply(415, { error: 'Неверный формат' });
    const controller = new AbortController();
    jobs.set(id, controller);
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 60 * 1024 * 1024 + 1048576 + 4) throw new Error('Файл слишком большой');
        controller.signal.throwIfAborted(); chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      if (body.length < 4) throw new Error('Неполный запрос');
      const length = body.readUInt32LE(0);
      if (length > 1048576 || length + 4 > body.length) throw new Error('Некорректный текст');
      const metadata = JSON.parse(body.subarray(4, length + 4).toString('utf8'));
      const payload = { text: metadata.text, duration: metadata.duration, lines: metadata.lines, wav: body.subarray(length + 4) };
      controller.signal.throwIfAborted();
      const lines = await run(req.url === '/refine', payload, controller.signal);
      controller.signal.throwIfAborted();
      reply(200, { lines });
    } catch (error) { reply(400, { error: controller.signal.aborted ? 'Обработка отменена' : error.message }); }
    finally { jobs.delete(id); }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 10000;
  server.on('close', () => { for (const job of jobs.values()) job.abort(); });
  const ready = new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server.address().port)); });
  return { ready, close() { for (const job of jobs.values()) job.abort(); server.close(); server.closeAllConnections(); } };
}
module.exports = { startBridge, PORT };
