const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startBridge } = require('../lyrics-bridge.cjs');
const origin = 'https://purocielo.github.io';
const id = '12345678-1234-1234-1234-123456789abc';
function envelope(metadata) {
  const json = Buffer.from(JSON.stringify(metadata)), prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(json.length);
  return Buffer.concat([prefix, json, Buffer.alloc(44)]);
}
test('loopback bridge restricts origin, host and authorization; transports exact text and WAV', async t => {
  let received;
  const bridge = startBridge({ port: 0, run: async (refine, payload) => { received = { refine, payload }; return [{ t: 0, text: payload.text }]; } });
  t.after(() => bridge.close());
  const base = `http://127.0.0.1:${await bridge.ready}`;
  assert.equal((await fetch(base + '/session')).status, 403);
  assert.equal((await fetch(base + '/session', { headers: { Origin: 'https://other.test' } })).status, 403);
  const wrongHost = await new Promise((resolve, reject) => { require('node:http').get(base + '/session', { headers: { Origin: origin, Host: 'attacker.test' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject); });
  assert.equal(wrongHost, 403);
  const session = await fetch(base + '/session', { headers: { Origin: origin } });
  assert.equal(session.headers.get('access-control-allow-origin'), origin);
  const { token } = await session.json();
  const options = await fetch(base + '/align', { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal(options.headers.get('access-control-allow-private-network'), 'true');
  assert.equal((await fetch(base + '/align', { method: 'POST', headers: { Origin: origin } })).status, 401);
  const headers = { Origin: origin, Authorization: `Bearer ${token}`, 'X-Puro-Job': id, 'Content-Type': 'application/octet-stream' };
  const response = await fetch(base + '/align', { method: 'POST', headers, body: envelope({ text: 'Мой текст', duration: 2 }) });
  assert.deepEqual(await response.json(), { lines: [{ t: 0, text: 'Мой текст' }] });
  assert.equal(received.refine, false); assert.equal(received.payload.wav.length, 44);
  assert.equal((await fetch(base + '/refine', { method: 'POST', headers, body: Buffer.from([0]) })).status, 400);
});
test('cancellation only aborts the specified bridge job, and concurrent jobs are rejected', async t => {
  let started, aborted = false;
  const begun = new Promise(resolve => started = resolve);
  const bridge = startBridge({ port: 0, run: async (_, payload, signal) => {
    started(); await new Promise(resolve => signal.addEventListener('abort', () => { aborted = true; resolve(); }, { once: true })); return [];
  } });
  t.after(() => bridge.close());
  const base = `http://127.0.0.1:${await bridge.ready}`;
  const { token } = await (await fetch(base + '/session', { headers: { Origin: origin } })).json();
  const headers = { Origin: origin, Authorization: `Bearer ${token}`, 'X-Puro-Job': id, 'Content-Type': 'application/octet-stream' };
  const pending = fetch(base + '/align', { method: 'POST', headers, body: envelope({ text: 'Hello', duration: 2 }) });
  await begun;
  assert.equal((await fetch(base + '/align', { method: 'POST', headers, body: envelope({ text: 'Other', duration: 2 }) })).status, 409);
  await fetch(base + '/cancel', { method: 'POST', headers: { ...headers, 'X-Puro-Job': 'different-job-id-123' } });
  assert.equal(aborted, false);
  await fetch(base + '/cancel', { method: 'POST', headers });
  assert.match((await (await pending).json()).error, /отменена/);
  assert.equal(aborted, true);
});
