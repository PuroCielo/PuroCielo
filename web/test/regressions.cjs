const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.PURO_TEST_ROOT || path.join(__dirname, '../..'));
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/__fixture') { res.setHeader('content-type', 'text/html'); res.end('<button id="open">Open mini player</button><div id="toasts"></div>'); return; }
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream'); res.end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const failures = [];
  async function check(name, fn) {
    const context = await browser.newContext({ locale: 'ru-RU' });
    try { await fn(context); console.log('PASS', name); }
    catch (e) { failures.push(name); console.error('FAIL', name, e); }
    finally { await context.close(); }
  }
  try {
    await check('mini-player recovers the same track after stop and refreshes metadata', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      await p.evaluate(async () => {
        const s = await import('/web/js/state.js'), player = await import('/web/js/player.js'), mini = await import('/web/js/miniwin.js');
        Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true });
        const buffer = new ArrayBuffer(44 + 16000), v = new DataView(buffer), bytes = new Uint8Array(buffer);
        const text = (at, s) => [...s].forEach((c, i) => bytes[at + i] = c.charCodeAt(0));
        text(0, 'RIFF'); v.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVEfmt '); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, 16000, true);
        Object.assign(s.state.settings, { autoLyrics: false, normalize: false });
        s.state.tracks.set('song', { id: 'song', title: 'Before', artist: 'Artist', url: URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' })), duration: 1 });
        window.fixture = { s, player }; player.playList(['song']);
        document.querySelector('#open').onclick = () => mini.toggleMiniWindow();
      });
      const popupPromise = ctx.waitForEvent('page'); await p.locator('#open').click(); const popup = await popupPromise;
      await popup.locator('.pp').waitFor();
      await p.evaluate(() => fixture.player.stop()); await popup.locator('.empty').waitFor();
      await p.evaluate(() => fixture.player.playList(['song'])); await popup.locator('.pp').waitFor({ timeout: 3000 });
      await p.evaluate(() => { fixture.s.state.tracks.get('song').title = 'After edit'; fixture.s.emit('track-meta'); });
      assert.equal(await popup.locator('.t b').innerText(), 'After edit');
    });
    await check('repeated media play/pause commands are idempotent', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        const handlers = {};
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: { setActionHandler: (name, fn) => handlers[name] = fn, setPositionState() {} } });
        const s = await import('/web/js/state.js'), player = await import('/web/js/player.js');
        s.state.tracks.set('song', { id: 'song' }); player.P.queue = ['song']; player.P.idx = 0;
        let paused = true;
        Object.defineProperty(player.audio, 'paused', { get: () => paused });
        player.audio.play = async () => { paused = false; }; player.audio.pause = () => { paused = true; };
        handlers.play(); handlers.play(); const afterPlay = paused;
        handlers.pause(); handlers.pause(); return { afterPlay, afterPause: paused };
      });
      assert.deepEqual(result, { afterPlay: false, afterPause: true });
    });
    await check('cloud covers persist and late Android files inherit all synced track data', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      await p.evaluate(async () => {
        window.PuroNative = {};
        const s = await import('/web/js/state.js'); const db = await import('/web/js/db.js');
        const key = 'Track.wav|100';
        const remote = { likes: [key], playlists: [{ id: 'p', name: 'Mix', ids: [key] }], plays: { [key]: 4 },
          tagEdits: { [key]: { title: 'Edited remotely' } }, blobs: { ct_test: 'cover-hash' }, updatedAt: 100, device: 'other' };
        const snap = data => ({ exists: () => !!data, data: () => data });
        const fs = { getFirestore: () => ({}), doc: (_, ...parts) => parts.join('/'),
          getDoc: async ref => snap(ref === 'sync/user' ? remote : ref.endsWith('/ct_test') ? { kind: 'ct', key, data: 'data:image/png;base64,aGVsbG8=' } : null),
          onSnapshot: () => () => {}, setDoc: async () => {}, deleteDoc: async () => {} };
        window.__puroFirebase = [{ initializeApp: () => ({}) }, { getAuth: () => ({}),
          onAuthStateChanged: (_, cb) => queueMicrotask(() => cb({ uid: 'user' })), signInWithEmailAndPassword: async () => {} }, fs];
        const sync = await import('/web/js/sync.js'); window.fixture = { s, db, key, sync };
        await sync.signInEmail('test@example.com', 'test-only');
      });
      await p.waitForFunction(() => !!window.fixture.s.state.covers.t[window.fixture.key]);
      assert(await p.evaluate(async () => !!(await fixture.db.kvGet('covers'))?.t[fixture.key]));
      const result = await p.evaluate(async () => {
        const { s, db } = fixture; const id = 'n:primary:Music/Track.wav';
        s.state.tracks.set(id, { id, name: 'Track.wav', size: 100, title: 'Original', artist: 'Artist', addedAt: 1, duration: 1 });
        s.touchLibrary();
        const result = { liked: s.state.likes.has(id), playlist: s.state.playlists[0].ids[0], plays: s.state.plays[id],
          edit: s.state.tagEdits[id]?.title, cover: s.state.covers.t[id], derived: s.derived().all[0].title };
        s.state.covers = { t: {}, a: {} }; await s.load(); result.restored = s.state.covers.t[id]; return result;
      });
      assert.equal(result.liked, true); assert.equal(result.playlist, 'n:primary:Music/Track.wav'); assert.equal(result.plays, 4);
      assert.equal(result.edit, 'Edited remotely'); assert.equal(result.derived, 'Edited remotely'); assert(result.cover); assert.equal(result.restored, result.cover);
    });
    await check('failed SDK hides inactive authentication controls and loading prevents native form navigation', async ctx => {
      let release; const gate = new Promise(r => release = r);
      await ctx.route('https://www.gstatic.com/firebasejs/**', async r => { await gate; await r.abort(); });
      const p = await ctx.newPage(); await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
      assert(await p.locator('#auth-go').isDisabled());
      assert(await p.locator('#auth-form').evaluate(form => { const e = new Event('submit', { bubbles: true, cancelable: true }); form.dispatchEvent(e); return e.defaultPrevented; }));
      release(); await p.locator('#auth-off').waitFor({ state: 'visible' }); assert.equal(await p.locator('#auth-on').isVisible(), false);
    });
    await check('newly registered username appears without a reload', async ctx => {
      await ctx.addInitScript(() => window.authTest = { docs: {}, user: null, callback: null });
      await ctx.route('https://www.gstatic.com/firebasejs/**', r => {
        const file = r.request().url().split('/').pop();
        const code = file === 'firebase-app.js' ? 'export const initializeApp=()=>({});' : file === 'firebase-auth.js' ? `
          const t=window.authTest; export const getAuth=()=>({get currentUser(){return t.user}});
          export const onAuthStateChanged=(_,cb)=>{t.callback=cb;cb(null)};
          export const createUserWithEmailAndPassword=async(_,email)=>{t.user={uid:'new',email};t.callback(t.user);return {user:t.user}};
          export const updateProfile=async(u,p)=>Object.assign(u,p); export const sendEmailVerification=async()=>{};
          export class GoogleAuthProvider{} export class GithubAuthProvider{} export class OAuthProvider{}
        ` : `
          const t=window.authTest; export const getFirestore=()=>({}); export const doc=(_, ...p)=>p.join('/');
          const snap=k=>({exists:()=>!!t.docs[k],data:()=>t.docs[k]}); export const getDoc=async k=>snap(k);
          export const runTransaction=async(_,fn)=>fn({get:async k=>snap(k),set:(k,v)=>{t.docs[k]=v}});
        `;
        return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: code });
      });
      const p = await ctx.newPage(); await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !document.querySelector('#auth-go').disabled);
      await p.locator('#tab-up').click(); await p.locator('#auth-user').fill('listener_test'); await p.locator('#auth-name').fill('Listener');
      await p.locator('#auth-email').fill('test@example.com'); await p.locator('#auth-pass').fill('test-only-password'); await p.locator('#auth-go').click();
      await p.waitForFunction(() => document.querySelector('#me-nick').textContent === '@listener_test', undefined, { timeout: 3000 });
      assert.equal(await p.locator('#claim-box').isVisible(), false);
    });
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  assert.deepEqual(failures, [], 'Regressions failed: ' + failures.join(', '));
})().catch(e => { console.error(e); server.close(); process.exit(1); });
