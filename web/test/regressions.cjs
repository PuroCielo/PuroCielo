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
  if (pathname === '/__genius-123.js') { res.setHeader('content-type', 'text/javascript'); res.end(`document.write("<div class='rg_embed_body'>One<br>Two<br>Three<br>Four</div><div class='rg_embed_footer'></div>");`); return; }
  if (pathname === '/__genius-124.js') { setTimeout(() => { res.setHeader('content-type', 'text/javascript'); res.end('document.write("late result");'); }, 150); return; }
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
    await check('downloaded artwork survives reload, duplicate import and lyrics attachment', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        const s = await import('/web/js/state.js'), db = await import('/web/js/db.js');
        const importer = await import('/web/js/importer.js'), dl = await import('/web/js/link-download.js');
        const buffer = new ArrayBuffer(44 + 16000), v = new DataView(buffer), bytes = new Uint8Array(buffer);
        const text = (at, s) => [...s].forEach((c, i) => bytes[at + i] = c.charCodeAt(0));
        text(0, 'RIFF'); v.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVEfmt '); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, 16000, true);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
        canvas.getContext('2d').fillRect(0, 0, 8, 8);
        const art = await new Promise(r => canvas.toBlob(r));
        const realFetch = window.fetch;
        let artMode = 'good';
        window.fetch = async (url, options) => {
          if (String(url).startsWith('blob:')) return realFetch(url, options);
          if (String(url).includes('/download')) return new Response(buffer, { headers: { 'Content-Type': 'audio/wav', 'Content-Disposition': 'attachment; filename="Cover test.wav"', 'X-Puro-Artwork': '/artwork?url=fixture' } });
          if (artMode === 'bad') return new Response('unavailable', { status: 503 });
          if (artMode === 'oversize') return new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } });
          return new Response(art, { headers: { 'Content-Type': 'image/png' } });
        };
        let artworkURL;
        const file = await dl.downloadAudio('https://soundcloud.com/artist/track', { onArtworkURL: u => { artworkURL = u; } });
        const first = await importer.importDownloadedAudio(file);
        const coverBlob = await dl.downloadArtwork(artworkURL);
        const updated = await importer.importDownloadedAudio(file, { coverBlob });
        s.derived(); const track = [...s.state.tracks.values()][0];
        const rendered = await createImageBitmap(await (await realFetch(track.cover)).blob()); rendered.close();
        await importer.importFiles([new File(['[00:00.00]Lyrics'], 'Cover test.lrc')]);
        const saved = await db.getFileChecked(track.id);
        s.state.covers.t[track.id] = 'data:image/png;base64,custom';
        await importer.importDownloadedAudio(file, { coverBlob }); s.derived();
        const customPreserved = track.cover === s.state.covers.t[track.id];
        delete s.state.covers.t[track.id]; s.touchLibrary(); s.derived();
        const before = track.cover;
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
        let storageRejected = false;
        try { await importer.importDownloadedAudio(file, { coverBlob }); } catch { storageRejected = true; }
        finally { IDBObjectStore.prototype.put = put; }
        artMode = 'bad'; const failed = await dl.downloadArtwork(artworkURL);
        artMode = 'oversize'; const oversized = await dl.downloadArtwork(artworkURL);
        const controller = new AbortController(); controller.abort(); let aborted = false;
        try { await dl.downloadArtwork(artworkURL, { signal: controller.signal }); } catch (e) { aborted = e.name === 'AbortError'; }
        window.fetch = realFetch;
        return { first, updated, count: s.state.tracks.size, savedCover: saved.coverBlob?.size, lyrics: saved.lrc,
          customPreserved, storageRejected, unchanged: track.cover === before, failed, oversized, aborted };
      });
      assert.equal(result.first.added, true); assert.equal(result.updated.coverUpdated, true); assert.equal(result.count, 1);
      assert(result.savedCover > 0); assert.equal(result.lyrics, '[00:00.00]Lyrics');
      assert(result.customPreserved && result.storageRejected && result.unchanged && result.aborted);
      assert.equal(result.failed, null); assert.equal(result.oversized, null);
      await p.reload();
      const restored = await p.evaluate(async () => {
        const s = await import('/web/js/state.js'), importer = await import('/web/js/importer.js');
        const original = window.fetch;
        window.fetch = (url, options) => { if (!String(url).startsWith('blob:')) throw new Error('Offline'); return original(url, options); };
        await importer.restoreLibrary(); s.derived(); const track = [...s.state.tracks.values()][0];
        const image = await createImageBitmap(await (await fetch(track.cover)).blob());
        const result = { count: s.state.tracks.size, width: image.width, lyrics: track.hasLrc }; image.close(); return result;
      });
      assert.deepEqual(restored, { count: 1, width: 8, lyrics: true });
    });
    await check('lyrics search enters loading immediately, retries cached misses and keeps one request', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        const { ensureLyrics, candidates } = await import('/web/js/lyrics-auto.js');
        const { state } = await import('/web/js/state.js'), { lySet } = await import('/web/js/db.js');
        const t = { id: 'lyrics-test', title: 'Song', artist: 'Artist', duration: 10 };
        await lySet('v8|artist|song|10', { miss: true, at: Date.now() });
        let calls = 0, release;
        const gate = new Promise(r => { release = r; });
        window.fetch = async () => { calls++; await gate; return Response.json({ id: 1, trackName: 'Song', artistName: 'Artist', duration: 10, syncedLyrics: '[00:00.00]Hello\n[00:05.00]World' }); };
        const first = ensureLyrics(t), loading = t._ly;
        const second = ensureLyrics(t, { retryMiss: true });
        await new Promise(r => setTimeout(r, 50)); release();
        const found = await first; await second;
        state.settings.autoLyrics = false;
        const disabled = { id: 'disabled', title: 'No lookup', artist: 'Artist' }; await ensureLyrics(disabled, { retryMiss: true });
        state.settings.autoLyrics = true;
        await lySet('manual:manual', { text: 'My own lyrics' });
        const manual = { id: 'manual', title: 'Manual', artist: 'Artist' }; await ensureLyrics(manual, { retryMiss: true });
        const beforeError = calls; window.fetch = async () => { throw new TypeError('Network unavailable'); };
        const err = { id: 'error', title: 'Error', artist: 'Artist' }; await ensureLyrics(err);
        return { loading, same: first === second, found, calls: beforeError, lyrics: t.lyrics?.lines?.length, disabled: disabled._ly,
          manual: manual.lyrics?.text, error: err._ly, candidate: candidates({ title: 'Real Artist - Song [remix]', artist: 'Upload Channel' })[0] };
      });
      assert.deepEqual(result, { loading: 'loading', same: true, found: true, calls: 1, lyrics: 2, disabled: 'none', manual: 'My own lyrics', error: 'error', candidate: { artist: 'Real Artist', title: 'Song' } });
    });
    await check('SoundCloud albums keep covers and ordering, deduplicate and preserve partial cancellation', async ctx => {
      const p = await ctx.newPage(); await p.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
      const wav = Buffer.alloc(44 + 16000); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16);
      wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(16000,40);
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
      const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Disposition, X-Puro-Artwork' };
      let mode = 'normal', hold, held;
      await p.route('https://purocielo-audio-service.pipeddahlia1.chatgpt.site/**', async r => {
        if (mode === 'offline') return r.abort();
        const path = new URL(r.request().url()).pathname;
        if (path === '/resolve') return r.fulfill({ json: { kind: 'album', title: 'Test Album', artist: 'Artist', artwork: '/artwork?url=fixture', tracks: [1,2,3].map(i => ({ url: `https://soundcloud.com/artist/${mode === 'cancel' ? 'new' : 'song'}${i}` })).concat([{ url: null }]) }, headers });
        if (path === '/artwork') return r.fulfill({ body: png, contentType: 'image/png', headers });
        const name = r.request().postDataJSON().url.split('/').pop();
        if (mode === 'cancel' && name === 'new2') { held(); await new Promise(resolve => { hold = resolve; }); return r.abort().catch(() => {}); }
        return r.fulfill({ body: wav, contentType: 'audio/wav', headers: { ...headers, 'content-disposition': `attachment; filename="Artist - ${name}.wav"` } });
      });
      await p.goto(base + '/app/'); const form = p.locator('#side-link-import form');
      const submit = async () => { await form.locator('input').fill('https://soundcloud.com/artist/sets/album'); await form.locator('[type=submit]').click(); };
      const done = () => p.waitForFunction(() => document.querySelector('#side-link-import form').getAttribute('aria-busy') === 'false');
      await submit(); await done(); assert.match(await form.locator('.link-import-status').innerText(), /добавлено 3, уже в медиатеке 0, недоступно 1/);
      await submit(); await done(); assert.match(await form.locator('.link-import-status').innerText(), /добавлено 0, уже в медиатеке 3/);
      mode = 'offline'; await p.reload(); await p.evaluate(() => { location.hash = '#/library/albums'; });
      await p.waitForFunction(() => document.querySelector('#view').textContent.includes('Test Album'));
      const records = await p.evaluate(async () => (await (await import('/web/js/db.js')).allFiles()).map(r => ({ title: r.albumInfo?.title, position: r.albumInfo?.position, cover: r.coverBlob?.size > 0 })));
      assert.deepEqual(records.map(r => r.position).sort(), [1,2,3]); assert(records.every(r => r.title === 'Test Album' && r.cover));
      mode = 'cancel'; const waiting = new Promise(r => { held = r; }); await submit(); await waiting;
      await form.locator('[data-link-cancel]').click(); hold(); await done();
      assert.match(await form.locator('.link-import-status').innerText(), /Загрузка отменена.*Сохранено: 1/);
      assert.equal(await p.evaluate(async () => (await (await import('/web/js/db.js')).allFiles()).length), 4);
    });
    await check('lyrics matching rejects wrong artists and unsafe timing while preserving real titles', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        const { cleanTitle, pickBest, searchLyrics, recordingVariant } = await import('/web/js/lyrics-search.js');
        const { candidates } = await import('/web/js/lyrics-auto.js');
        const record = { id: 1, trackName: 'Song', artistName: 'Artist', duration: 10, syncedLyrics: '[00:00.00]One\n[00:05.00]Two', _sure: true };
        const normal = pickBest([record], 10), remix = pickBest([record], 10, 'remix'), unknown = pickBest([record], 0);
        const far = pickBest([{ ...record, syncedLyrics: '[00:00.00]One\n[09:00.00]Too late' }], 10);
        let calls = 0;
        window.fetch = async url => {
          calls++;
          if (String(url).includes('/get?')) return new Response('Unavailable', { status: 503 });
          return Response.json([{ ...record, id: 2, artistName: 'Someone Else' }, record]);
        };
        const recovered = await searchLyrics({ candidates: [{ artist: 'Artist', title: 'Song' }], duration: 10 });
        window.fetch = async () => Response.json([{ ...record, id: 2, artistName: 'Someone Else' }]);
        const wrong = await searchLyrics({ candidates: [{ artist: 'Artist', title: 'Song' }], duration: 10 });
        window.fetch = async () => Response.json(record);
        const rejected = await searchLyrics({ candidates: [{ artist: 'Artist', title: 'Song' }], duration: 10, bad: [1] });
        return { title: cleanTitle('Song (Part II) [Official Audio]'), candidates: candidates({ title: 'Artist - Song (Part II) [Official Audio]', artist: 'Upload Channel' }).slice(0,2),
          variant: recordingVariant('Song (sped up remix)'), normal: !!normal?.syncedLyrics, remix: remix?.syncedLyrics, unknown: unknown?.syncedLyrics,
          far: far?.syncedLyrics, recovered: recovered.record?.id, calls, wrong: wrong.record, rejected: rejected.record };
      });
      assert.equal(result.title, 'Song (Part II)'); assert.equal(result.variant, 'fast+remix');
      assert.deepEqual(result.candidates, [{ artist: 'Artist', title: 'Song (Part II)' }, { artist: 'Artist', title: 'Song' }]);
      assert(result.normal); assert.equal(result.remix, null); assert.equal(result.unknown, null); assert.equal(result.far, null);
      assert.equal(result.recovered, 1); assert.equal(result.calls, 2); assert.equal(result.wrong, null); assert.equal(result.rejected, null);
    });
    await check('lyrics fallback survives provider failure and late responses preserve manual edits', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        const { ensureLyrics, setManualLyrics } = await import('/web/js/lyrics-auto.js');
        let aborted = 0;
        window.fetch = async (url, options = {}) => {
          if (String(url).includes('lrclib.net')) throw new TypeError('First provider down');
          if (String(url).includes('lyrist.vercel.app')) return Response.json({ title: 'Fallback Song', artist: 'Artist', lyrics: 'Fallback Song\nTest lyric line' });
          if (String(url).includes('api.lyrics.ovh')) return new Response('', { status: 404 });
          return new Promise((resolve, reject) => { options.signal?.addEventListener('abort', () => { aborted++; reject(new DOMException('Cancelled', 'AbortError')); }, { once: true }); });
        };
        const t = { id: 'fallback', title: 'Fallback Song', artist: 'Artist', duration: 10 };
        const found = await ensureLyrics(t), fallback = t.lyrics?.source;
        let release, started;
        const waiting = new Promise(r => { started = r; });
        window.fetch = async () => { started(); await new Promise(r => { release = r; }); return Response.json({ id: 3, trackName: 'Edited Song', artistName: 'Artist', duration: 10, plainLyrics: 'Stale result' }); };
        const edited = { id: 'manual-race', title: 'Edited Song', artist: 'Artist', duration: 10 };
        const search = ensureLyrics(edited); await waiting; await setManualLyrics(edited, 'My own words'); release(); await search;
        let external = 0, primary = 0;
        window.fetch = async url => { if (!String(url).includes('lrclib.net')) external++; else primary++; return Response.json([]); };
        const next = { id: 'prefetch', title: 'Next Song', artist: 'Artist', duration: 10 };
        await ensureLyrics(next, { prefetch: true });
        return { found, fallback, aborted, manual: edited.lyrics?.text, source: edited.lyrics?.source, external, primary, prefetchState: next._ly || null };
      });
      assert(result.found); assert.equal(result.fallback, 'lyrist'); assert(result.aborted > 0);
      assert.equal(result.manual, 'My own words'); assert.equal(result.source, 'manual'); assert.equal(result.external, 0);
      assert(result.primary > 0); assert.equal(result.prefetchState, null);
    });
    await check('verified plain lyrics display without slow providers and persist offline', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const found = await p.evaluate(async () => {
        const { ensureLyrics } = await import('/web/js/lyrics-auto.js');
        let other = 0;
        window.fetch = async url => {
          if (!String(url).includes('lrclib.net')) { other++; throw new Error('Must not wait for another source'); }
          return Response.json({ id: 91, trackName: 'Plain Song', artistName: 'Artist', duration: 10, plainLyrics: 'Saved lyric line' });
        };
        const t = { id: 'plain-test', title: 'Plain Song', artist: 'Artist', duration: 10 };
        await ensureLyrics(t); await new Promise(r => setTimeout(r, 50));
        return { text: t.lyrics?.text, other };
      });
      assert.deepEqual(found, { text: 'Saved lyric line', other: 0 });
      await p.reload();
      const saved = await p.evaluate(async () => {
        window.fetch = async () => { throw new Error('Offline'); };
        const { ensureLyrics } = await import('/web/js/lyrics-auto.js');
        const t = { id: 'plain-test', title: 'Plain Song', artist: 'Artist', duration: 10 };
        await ensureLyrics(t); return t.lyrics?.text;
      });
      assert.equal(saved, 'Saved lyric line');
    });
    await check('player prepares the next song lyrics before the listener opens it', async ctx => {
      const p = await ctx.newPage(); await p.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
      const wav = Buffer.alloc(44 + 160000); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16);
      wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(160000,40);
      await p.route('https://music.example/**', r => r.fulfill({ body: wav, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' } }));
      let secondReady, calls = 0;
      const prefetched = new Promise(r => { secondReady = r; });
      await p.route('https://lrclib.net/api/**', async r => {
        calls++;
        const title = new URL(r.request().url()).searchParams.get('track_name');
        await r.fulfill({ json: { id: title === 'First Song' ? 101 : 102, trackName: title, artistName: 'Artist', duration: 10, syncedLyrics: `[00:00.00]${title}\n[00:05.00]Second line` }, headers: { 'access-control-allow-origin': '*' } });
        if (title === 'Second Song') secondReady();
      });
      await p.goto(base + '/app/'); const form = p.locator('#side-link-import form');
      for (const name of ['First Song', 'Second Song']) {
        await form.locator('input').fill('https://music.example/' + encodeURIComponent('Artist - ' + name + '.wav'));
        await form.locator('[type=submit]').click();
        await p.waitForFunction(() => document.querySelector('#side-link-import form').getAttribute('aria-busy') === 'false');
      }
      await p.evaluate(() => { location.hash = '#/library/songs'; });
      await p.locator('.row[data-track]').filter({ hasText: 'First Song' }).click();
      let timeout;
      try { await Promise.race([prefetched, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Next song was not prepared')), 6000); })]); }
      finally { clearTimeout(timeout); }
      assert.equal(calls, 2);
      await p.locator('.row[data-track]').filter({ hasText: 'Second Song' }).click();
      await p.locator('#m-expand').click();
      await p.waitForFunction(() => document.querySelector('#np-lyrics').textContent.includes('Second Song'));
      assert.equal(calls, 2);
    });
    await check('Genius widget runs in isolation and cancellation preserves the player document', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        // Serve the same widget protocol locally: sandboxed opaque-origin frames
        // can bypass Playwright's network interception in Chromium.
        const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
        Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', { ...descriptor, set(value) {
          descriptor.set.call(this, value.replace(/https:\/\/genius\.com\/songs\/(123|124)\/embed\.js/g, (_, id) => location.origin + '/__genius-' + id + '.js'));
        } });
        const { geniusEmbed } = await import('/web/js/genius.js');
        const write = document.write, text = await geniusEmbed(123);
        const controller = new AbortController(), pending = geniusEmbed(124, 1000, controller.signal);
        const frame = document.querySelector('iframe');
        const sandbox = frame.getAttribute('sandbox');
        controller.abort(); const cancelled = await pending;
        await new Promise(r => setTimeout(r, 250));
        return { text, sandbox, cancelled, writeUnchanged: document.write === write, alive: !!document.querySelector('#open'), frames: document.querySelectorAll('iframe').length };
      });
      assert.deepEqual(result, { text: 'One\nTwo\nThree\nFour', sandbox: 'allow-scripts', cancelled: '', writeUnchanged: true, alive: true, frames: 0 });
    });
    await check('T and lyrics buttons hide and restore lyrics across layouts and saved settings', async ctx => {
      const p = await ctx.newPage(); await p.setViewportSize({ width: 1280, height: 900 });
      await p.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
      await p.route('https://lrclib.net/api/**', r => r.fulfill({ json: { id: 501, trackName: 'Toggle Song', artistName: 'Artist', duration: 30, syncedLyrics: '[00:00.00]One\n[00:20.00]Two' }, headers: { 'access-control-allow-origin': '*' } }));
      const wav = Buffer.alloc(44 + 480000); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16);
      wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(480000,40);
      await p.route('https://music.example/**', r => r.fulfill({ body: wav, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' } }));
      await p.goto(base + '/app/'); const form = p.locator('#side-link-import form');
      await form.locator('input').fill('https://music.example/Artist%20-%20Toggle%20Song.wav'); await form.locator('[type=submit]').click();
      await p.waitForFunction(() => document.querySelector('#side-link-import form').getAttribute('aria-busy') === 'false');
      await p.evaluate(() => { location.hash = '#/library/songs'; }); await p.locator('.row[data-track]').click(); await p.locator('#m-expand').click();
      await p.keyboard.press('KeyT');
      await p.waitForFunction(() => document.querySelector('.np').classList.contains('nolyr') && +getComputedStyle(document.querySelector('.np-side')).opacity < .01);
      assert.equal(await p.locator('#np-lyr-toggle').getAttribute('aria-pressed'), 'false');
      await p.keyboard.press('KeyT');
      await p.waitForFunction(() => !document.querySelector('.np').classList.contains('nolyr') && +getComputedStyle(document.querySelector('.np-side')).opacity > .99);
      await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't', repeat: true, bubbles: true })));
      assert.equal(await p.locator('#np-lyr-toggle').getAttribute('aria-pressed'), 'true');
      await p.locator('#np-lyr-toggle').click(); assert.equal(await p.locator('#np-lyr-toggle').getAttribute('aria-pressed'), 'false');
      await p.reload(); await p.locator('.row[data-track]').click(); await p.locator('#m-expand').click();
      assert.equal(await p.locator('#np-lyr-toggle').getAttribute('aria-pressed'), 'false');
      await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 'е', bubbles: true })));
      assert.equal(await p.locator('#np-lyr-toggle').getAttribute('aria-pressed'), 'true');
      await p.keyboard.press('KeyQ'); await p.keyboard.press('KeyT');
      assert.equal(await p.locator('.np').getAttribute('data-pane'), 'lyrics');
      await p.locator('#np-close').click(); await form.locator('input').fill(''); await form.locator('input').press('t');
      assert.equal(await p.locator('.np').getAttribute('aria-hidden'), 'true'); assert.equal(await form.locator('input').inputValue(), 't');
      await p.locator('h1').first().click(); await p.keyboard.press('KeyT'); assert.equal(await p.locator('.np').getAttribute('aria-hidden'), 'false');
      await p.setViewportSize({ width: 390, height: 844 });
      await p.locator('#np-pane-toggle').click(); assert.equal(await p.locator('.np').getAttribute('data-pane'), 'player');
      await p.locator('#np-pane-toggle').click(); assert.equal(await p.locator('.np').getAttribute('data-pane'), 'lyrics');
      await p.keyboard.press('KeyT'); assert.equal(await p.locator('.np').getAttribute('data-pane'), 'player');
      await p.keyboard.press('KeyT'); assert.equal(await p.locator('.np').getAttribute('data-pane'), 'lyrics');
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
