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
    await check('local Genius alignment preserves text and reuses cached timestamps', async ctx => {
      const p = await ctx.newPage();
      await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        let calls = 0;
        window.PuroDesktop = { alignLyrics: async ({ wav, text }) => {
          calls++;
          if (!(wav instanceof Uint8Array) || text !== 'Hello world\nGood morning') throw new Error('Invalid payload');
          return { lines: [{ t: 0, text: 'Hello world' }, { t: 1, text: 'Good morning' }] };
        }, cancelAlignment: () => {} };
        const { state, emit } = await import('/web/js/state.js');
        const { P } = await import('/web/js/player.js');
        const { toggleLocalAlignment } = await import('/web/js/lyrics-align.js');
        const bytes = new Uint8Array(44 + 64000), v = new DataView(bytes.buffer);
        const text = (at, value) => { for (let i = 0; i < value.length; i++) v.setUint8(at + i, value.charCodeAt(i)); };
        text(0, 'RIFF'); v.setUint32(4, bytes.length - 8, true); text(8, 'WAVEfmt '); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, 64000, true);
        const plain = { type: 'plain', text: 'Hello world\nGood morning', source: 'genius' };
        const track = { id: 'alignment-test', url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), duration: 2, size: bytes.length, lyrics: plain };
        state.tracks.set(track.id, track); P.queue = [track.id]; P.idx = 0;
        toggleLocalAlignment();
        const wait = async predicate => { for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 20)); if (!predicate()) throw new Error('Alignment timeout'); };
        await wait(() => track.lyrics.type === 'synced');
        const original = track.lyrics.originalText;
        const restored = { ...track, lyrics: { ...plain } };
        state.tracks.set(track.id, restored); emit('track', restored);
        await wait(() => restored.lyrics.type === 'synced');
        let finish, cancelled = false;
        window.PuroDesktop.alignLyrics = () => new Promise(resolve => { finish = resolve; });
        window.PuroDesktop.cancelAlignment = () => { cancelled = true; };
        const pending = { ...track, id: 'cancel-test', lyrics: { ...plain } };
        state.tracks.set(pending.id, pending); P.queue = [pending.id]; P.idx = 0; emit('track', pending);
        await wait(() => !!finish);
        toggleLocalAlignment();
        finish({ lines: [{ t: 0, text: 'Hello world' }, { t: 1, text: 'Good morning' }] });
        await new Promise(resolve => setTimeout(resolve, 50));
        const pendingType = pending.lyrics.type;
        pending.lyrics = { type: 'synced', source: 'manual', lines: [{ t: 0, text: 'Hello world' }, { t: 1, text: 'Good morning' }] };
        window.PuroDesktop.forceAlign = async () => ({ lines: [{ t: 0.1, text: 'Hello world', words: [{ t: 0.1, text: 'Hello' }, { t: 0.5, text: 'world' }] }, { t: 1, text: 'Good morning' }] });
        await (await import('/web/js/lyrics-align.js')).refineCurrentLyrics();
        const refinedLrc = (await (await import('/web/js/db.js')).lyGet('manual:' + pending.id)).text;
        return { calls, original, lines: restored.lyrics.lines, cancelled, pendingType, refinedLrc };
      });
      assert.match(result.refinedLrc, /<00:00.10>Hello <00:00.50>world/);
      assert.equal(result.cancelled, true);
      assert.equal(result.pendingType, 'plain');
      assert.equal(result.calls, 1);
      assert.equal(result.original, 'Hello world\nGood morning');
      assert.deepEqual(result.lines, [{ t: 0, text: 'Hello world' }, { t: 1, text: 'Good morning' }]);
    });
    await check('enhanced LRC export preserves refined word timestamps', async ctx => {
      const page = await ctx.newPage();
      await page.goto(base + '/__fixture');
      const result = await page.evaluate(async () => {
        const { rawLyrics } = await import('/web/js/lyrics-auto.js');
        const { parseLrc } = await import('/web/js/lrc.js');
        const lines = [{ t: 1.25, text: 'Hello world', words: [{ t: 1.25, text: 'Hello' }, { t: 2.5, text: 'world' }] }, { t: 4, text: 'Good morning' }];
        return parseLrc(rawLyrics({ lyrics: { type: 'synced', lines } })).lines;
      });
      assert.deepEqual(result, [{ t: 1.25, text: 'Hello world', words: [{ t: 1.25, text: 'Hello' }, { t: 2.5, text: 'world' }] }, { t: 4, text: 'Good morning' }]);
    });
    await check('SoundCloud transport retries connection and stream failures without partial audio', async ctx=>{
      const p=await ctx.newPage();await p.goto(base+'/__fixture');
      const result=await p.evaluate(async()=>{
        const {downloadAudio}=await import('/web/js/link-download.js');let calls=0,retries=0,contentType='',body='';
        window.fetch=async (url,options)=>{calls++;contentType=options.headers['Content-Type'];body=JSON.parse(options.body).url;if(calls===1)throw new TypeError('Network reset');return new Response(new Uint8Array([2,3]),{headers:{'content-type':'audio/mp4'}});};
        let f=await downloadAudio('https://soundcloud.com/x/y',{onRetry:()=>retries++});const initial={calls,retries,contentType,body,bytes:[...new Uint8Array(await f.arrayBuffer())]};
        calls=0;retries=0;
        window.fetch=async()=>++calls===1?new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([9,9]));setTimeout(()=>c.error(new TypeError('Stream interrupted')),0);}}),{headers:{'content-type':'audio/mp4'}}):new Response(new Uint8Array([4,5]),{headers:{'content-type':'audio/mp4'}});
        f=await downloadAudio('https://soundcloud.com/x/y',{onRetry:()=>retries++});const stream={calls,retries,bytes:[...new Uint8Array(await f.arrayBuffer())]};
        calls=0;window.fetch=async()=>{calls++;throw new TypeError('Offline');};let code;
        try{await downloadAudio('https://soundcloud.com/x/y');}catch(e){code=e.code;}
        const failed={calls,code};calls=0;const ctl=new AbortController();let cancelled;
        try{await downloadAudio('https://soundcloud.com/x/y',{signal:ctl.signal,onRetry:()=>ctl.abort()});}catch(e){cancelled=e.name;}
        return {initial,stream,failed,cancel:{calls,cancelled}};
      });
      assert.deepEqual(result,{initial:{calls:2,retries:1,contentType:'text/plain;charset=UTF-8',body:'https://soundcloud.com/x/y',bytes:[2,3]},stream:{calls:2,retries:1,bytes:[4,5]},failed:{calls:2,code:'DOWNLOAD_NETWORK'},cancel:{calls:1,cancelled:'AbortError'}});
    });
    await check('album stops after connection retry fails without blaming the source site', async ctx=>{
      const p=await ctx.newPage();await p.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());let calls=0;
      await p.route('https://purocielo-audio-service.pipeddahlia1.chatgpt.site/**',r=>{
        if(new URL(r.request().url()).pathname==='/resolve')return r.fulfill({json:{kind:'album',title:'Album',artist:'Artist',tracks:[1,2,3].map(n=>({url:'https://soundcloud.com/x/'+n}))},headers:{'access-control-allow-origin':'*'}});
        calls++;return r.abort('connectionreset');
      });
      await p.goto(base+'/app/');const form=p.locator('#side-link-import form');await form.locator('input').fill('https://soundcloud.com/x/sets/album');await form.locator('[type=submit]').click();
      await p.waitForFunction(()=>document.querySelector('#side-link-import .link-import-status').textContent.includes('Автоматический повтор не помог'));
      assert.equal(calls,2);assert.equal(await form.getAttribute('aria-busy'),'false');assert(!/запрещает/.test(await form.locator('.link-import-status').innerText()));
    });
    await check('lyrics transport recovers from blocked browser access through the fixed relay', async ctx => {
      const p=await ctx.newPage();await p.goto(base+'/__fixture');
      const result=await p.evaluate(async()=>{
        let direct=0,relay=0;
        window.fetch=async url=>{if(String(url).startsWith('https://lrclib.net')){direct++;throw new TypeError('CORS blocked');}relay++;const u=new URL(url);if(!u.pathname.startsWith('/lyrics/'))throw Error('Unexpected URL');return Response.json({id:50,trackName:'Relay Song',artistName:'Artist',duration:10,plainLyrics:'Recovered through relay'});};
        const t={id:'relay',title:'Relay Song',artist:'Artist',duration:10};await (await import('/web/js/lyrics-auto.js')).ensureLyrics(t);
        return {direct,relay,text:t.lyrics?.text};
      });
      assert.deepEqual(result,{direct:1,relay:1,text:'Recovered through relay'});
    });
    await check('planner balances artists and recognizes combined artist-title metadata', async ctx=>{
      const p=await ctx.newPage();await p.goto(base+'/__fixture');
      const result=await p.evaluate(async()=>{
        const {searchLyrics}=await import('/web/js/lyrics-search.js');let active=0,peak=0;
        const record={id:1,trackName:'Long Song Title',artistName:'Real Artist',duration:200,plainLyrics:'Fixture text'};
        window.fetch=async url=>{const u=new URL(url);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,10));active--;return u.searchParams.get('artist_name')==='Real Artist'?Response.json([record]):Response.json([]);};
        const extracted=(await import('/web/js/lyrics-auto.js')).candidates({artist:'Uploader',title:'Long Song Title',name:'Real Artist - Long Song Title.mp3'});
        const balanced=await searchLyrics({candidates:[{artist:'Uploader',title:'Song (Part II)'},{artist:'Uploader',title:'Song'},{artist:'Uploader',title:'More Noise'},{artist:'Real Artist',title:'Long Song Title'}],duration:200});
        window.fetch=async url=>new URL(url).searchParams.has('q')?Response.json([record]):Response.json([]);
        const combined=await searchLyrics({candidates:[{artist:'Uploader',title:'Real Artist Long Song Title'}],duration:200});
        return {filename:extracted.some(c=>c.artist==='Real Artist'&&c.title==='Long Song Title'),balanced:balanced.record?.id,combined:combined.record?.artistName,inferred:combined.record?._inferred,peak};
      });
      assert(result.filename);assert.equal(result.balanced,1);assert.equal(result.combined,'Real Artist');assert.equal(result.inferred,true);assert(result.peak<=2);
    });
    await check('plain provider lyrics need not contain the song title and failures are not cached as misses', async ctx=>{
      const p=await ctx.newPage();await p.goto(base+'/__fixture');
      const result=await p.evaluate(async()=>{
        const auto=await import('/web/js/lyrics-auto.js'),db=await import('/web/js/db.js');
        window.fetch=async url=>String(url).includes('api.lyrics.ovh')?Response.json({lyrics:'First fixture line with words\nSecond fixture line with words\nThird fixture line with words\nFourth fixture line with words'}):new Response('',{status:404});
        const t={id:'no-title',title:'Different Song Title',artist:'Artist',duration:10};await auto.ensureLyrics(t);
        window.fetch=async url=>String(url).includes('lrclib.net')?Response.json([]):new Response('Service down',{status:503});
        const failed={id:'failed',title:'Failed Song',artist:'Artist',duration:10};await auto.ensureLyrics(failed);
        return {source:t.lyrics?.source,state:failed._ly,miss:!!(await db.lyGet('v10|artist|failed song|10'))?.miss};
      });
      assert.deepEqual(result,{source:'lyrics.ovh',state:'error',miss:false});
    });
    await check('background search retries a temporary failure without a new import',async ctx=>{
      const p=await ctx.newPage();await p.goto(base+'/__fixture');
      await p.evaluate(async()=>{
        const s=await import('/web/js/state.js');s.state.settings.autoLyrics=true;
        window.fetch=async url=>String(url).includes('lrclib.net')?Response.json([]):new Response('Down',{status:503});
        const t={id:'retry-job',title:'Retry Song',artist:'Artist',duration:10};s.state.tracks.set(t.id,t);window.retryTrack=t;
        (await import('/web/js/lyrics-background.js')).initBackgroundLyrics();
      });
      await p.waitForFunction(()=>retryTrack._ly==='error',{},{timeout:20000});
      await p.evaluate(()=>{window.fetch=async()=>Response.json({id:99,trackName:'Retry Song',artistName:'Artist',duration:10,plainLyrics:'Recovered automatically'});});
      await p.waitForFunction(()=>retryTrack.lyrics?.text==='Recovered automatically',{},{timeout:20000});
      assert.equal(await p.locator('#toasts').innerText(),'');
    });
    await check('catalog resolves TBK and uploader colin, persists identity and preserves manual edits', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        const s = await import('/web/js/state.js'), db = await import('/web/js/db.js');
        const auto = await import('/web/js/lyrics-auto.js'), search = await import('/web/js/lyrics-search.js');
        const record = {id:10780734,trackName:'Schachter',artistName:'TIEFBASSKOMMANDO',duration:223,syncedLyrics:'[00:00.00]Test line one\n[00:10.00]Test line two'};
        let rows = [record], calls = 0;
        window.fetch = async url => { calls++; const u = new URL(url); return u.pathname.endsWith('/search') && !u.searchParams.has('artist_name') ? Response.json(rows) : new Response('',{status:404}); };
        const t = {id:'tbk',artist:'colin',title:'Tbk - Schachter',duration:223};
        s.state.tracks.set(t.id,t);s.touchLibrary();s.derived();
        await db.lySet('v8|colin|tbk - schachter|223',{miss:true,at:Date.now()});
        await auto.ensureLyrics(t);
        const first = {artist:t.artist,title:t.title,lines:t.lyrics?.lines.length,sure:t.lyrics?.sure};
        const options={candidates:[{artist:'TBK',title:'Schachter'}],duration:223};
        rows=[record,{...record,id:2,artistName:'Other artist'}]; const ambiguous=await search.searchLyrics(options);
        rows=[record]; const unknownDuration=await search.searchLyrics({...options,duration:0});
        const wrongVersion=await search.searchLyrics({...options,variant:'fast'});
        s.state.tagEdits.tbk={artist:'My Artist'};s.touchLibrary();s.derived();
        return {first,ambiguous:!!ambiguous.record,unknownDuration:!!unknownDuration.record,wrongVersion:!!wrongVersion.record,manual:t.artist};
      });
      assert.deepEqual(result,{first:{artist:'TIEFBASSKOMMANDO',title:'Schachter',lines:2,sure:false},ambiguous:false,unknownDuration:false,wrongVersion:false,manual:'My Artist'});
      await p.reload();
      const restored = await p.evaluate(async () => {
        const s=await import('/web/js/state.js');await (await import('/web/js/track-identity.js')).loadCatalogIdentities();
        const t={id:'tbk',artist:'colin',title:'Tbk - Schachter',duration:223};s.state.tracks.set(t.id,t);s.touchLibrary();s.derived();
        let requests=0;window.fetch=async()=>{requests++;throw Error('Must use cache');};
        await (await import('/web/js/lyrics-auto.js')).ensureLyrics(t);
        return {artist:t.artist,title:t.title,lines:t.lyrics?.lines.length,requests};
      });
      assert.deepEqual(restored,{artist:'TIEFBASSKOMMANDO',title:'Schachter',lines:2,requests:0});
    });
    await check('SoundCloud retries 429 once, respects long cooldowns and cancels waiting', async ctx => {
      const p=await ctx.newPage();await p.goto(base+'/__fixture');
      const result=await p.evaluate(async()=>{
        const {downloadAudio}=await import('/web/js/link-download.js');let calls=0,waits=[];
        window.fetch=async()=>++calls===1?Response.json({error:'Limited'},{status:429,headers:{'Retry-After':'1'}}):new Response(new Uint8Array([1,2]),{headers:{'content-type':'audio/mp4'}});
        const file=await downloadAudio('https://soundcloud.com/x/y',{onWait:n=>waits.push(n)});const recovered={calls,waits,size:file.size};
        calls=0;window.fetch=async()=>{calls++;return Response.json({error:'Limited'},{status:429,headers:{'Retry-After':'120'}});};
        let status;try{await downloadAudio('https://soundcloud.com/x/y');}catch(e){status=e.status;}
        const long={calls,status};
        calls=0;window.fetch=async()=>{calls++;return Response.json({error:'Limited'},{status:429,headers:{'Retry-After':'1'}});};
        let exhausted;try{await downloadAudio('https://soundcloud.com/x/y');}catch(e){exhausted=e.status;}
        const bounded={calls,status:exhausted};
        calls=0;const ctl=new AbortController();setTimeout(()=>ctl.abort(),100);let cancelled=false;
        try{await downloadAudio('https://soundcloud.com/x/y',{signal:ctl.signal});}catch(e){cancelled=e.name==='AbortError';}
        return {recovered,long,bounded,cancelled,cancelCalls:calls};
      });
      assert.deepEqual(result,{recovered:{calls:2,waits:[1],size:2},long:{calls:1,status:429},bounded:{calls:2,status:429},cancelled:true,cancelCalls:1});
    });
    await check('album download stops on a service cooldown instead of hitting remaining tracks', async ctx => {
      const p=await ctx.newPage();await p.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());let calls=0;
      await p.route('https://purocielo-audio-service.pipeddahlia1.chatgpt.site/**',r=>{
        const headers={'access-control-allow-origin':'*','access-control-expose-headers':'Retry-After'};
        if(new URL(r.request().url()).pathname==='/resolve')return r.fulfill({json:{kind:'album',title:'Album',artist:'Artist',tracks:[1,2,3].map(n=>({url:'https://soundcloud.com/x/'+n}))},headers});
        calls++;return r.fulfill({status:429,json:{error:'Limited',retryAfter:120},headers:{...headers,'Retry-After':'120'}});
      });
      await p.goto(base+'/app/');const form=p.locator('#side-link-import form');await form.locator('input').fill('https://soundcloud.com/x/sets/album');await form.locator('[type=submit]').click();
      await p.waitForFunction(()=>document.querySelector('#side-link-import .link-import-status').textContent.includes('ограничил'));
      assert.equal(calls,1);assert.equal(await form.getAttribute('aria-busy'),'false');
    });
    await check('background lyrics queue is silent, serial and respects offline and disabled settings', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      await p.evaluate(async () => {
        const s = await import('/web/js/state.js');
        let online = false, active = 0, peak = 0, calls = [];
        Object.defineProperty(navigator, 'onLine', {configurable:true,get:()=>online});
        window.fetch = async url => {
          const title = new URL(url).searchParams.get('track_name');
          calls.push(title); peak = Math.max(peak, ++active);
          await new Promise(r => setTimeout(r, 120)); active--;
          return Response.json({id:title,trackName:title,artistName:'Artist',duration:10,plainLyrics:'Lyrics for '+title});
        };
        s.state.settings.autoLyrics = false;
        (await import('/web/js/lyrics-background.js')).initBackgroundLyrics();
        const add = (id, lyrics) => s.state.tracks.set(id,{id,artist:'Artist',title:id,duration:10,lyrics});
        add('First'); add('Second'); add('Own',{type:'plain',text:'My lyrics',source:'manual'}); add('Removed');
        s.touchLibrary(); s.state.tracks.delete('Removed');
        window.bg = {s,calls,peak:()=>peak,online:()=>{online=true;window.dispatchEvent(new Event('online'));}};
      });
      await p.waitForTimeout(400); assert.equal(await p.evaluate(()=>bg.calls.length),0);
      await p.evaluate(()=>{bg.s.state.settings.autoLyrics=true;bg.s.emit('settings','autoLyrics');});
      await p.waitForTimeout(400); assert.equal(await p.evaluate(()=>bg.calls.length),0);
      await p.evaluate(()=>bg.online());
      await p.waitForFunction(()=>bg.s.state.tracks.get('Second').lyrics);
      assert.deepEqual(await p.evaluate(()=>({calls:bg.calls,peak:bg.peak(),own:bg.s.state.tracks.get('Own').lyrics.text})),{calls:['First','Second'],peak:1,own:'My lyrics'});
      await p.evaluate(()=>bg.s.touchLibrary()); await p.waitForTimeout(400);
      assert.equal(await p.evaluate(()=>bg.calls.length),2);
      assert.equal(await p.locator('.modal').count(),0);
      assert.equal(await p.locator('#toasts').innerText(),'');
      assert.equal(await p.evaluate(async()=>!!(await (await import('/web/js/db.js')).lyGet('ok|artist|first|10'))?.ly),true);
    });
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
        await lySet('v10|artist|song|10', { miss: true, at: Date.now() });
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
        if (path.startsWith('/lyrics/')) return r.fulfill({ json: [], headers });
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
      assert.equal(result.recovered, 1); assert(result.calls >= 2 && result.calls <= 5); assert.equal(result.wrong, null); assert.equal(result.rejected, null);
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
      assert.equal(result.prefetchState, null); // A provider cooldown may skip network requests altogether.
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
    await check('imported songs get lyrics before playback without opening the player', async ctx => {
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
        if (calls === 2) secondReady();
      });
      await p.goto(base + '/app/'); const form = p.locator('#side-link-import form');
      for (const name of ['First Song', 'Second Song']) {
        await form.locator('input').fill('https://music.example/' + encodeURIComponent('Artist - ' + name + '.wav'));
        await form.locator('[type=submit]').click();
        await p.waitForFunction(() => document.querySelector('#side-link-import form').getAttribute('aria-busy') === 'false');
      }
      await p.evaluate(() => { location.hash = '#/library/songs'; });
      let timeout;
      try { await Promise.race([prefetched, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Next song was not prepared')), 6000); })]); }
      finally { clearTimeout(timeout); }
      assert.equal(calls, 2);
      assert.equal(await p.locator('#np').evaluate(el => el.classList.contains('open')), false);
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
    await check('repost channels become performers without changing IDs or manual edits', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const result = await p.evaluate(async () => {
        const s = await import('/web/js/state.js');
        const a = {id:'existing',artist:'☁ Slump Audios Station ☁',title:'lumioe - hating (toca) [slump]',album:'Mix',albumArtist:'Slump Audios Station'};
        const b = {id:'other',artist:'Slump Audios Station',title:'Other - Song',album:'Mix',albumArtist:'Slump Audios Station'};
        const c = {id:'real',artist:'Audioslave',title:'Like a Stone'};
        [a,b,c].forEach(t => s.state.tracks.set(t.id,t)); s.touchLibrary(); s.derived();
        const first = {artist:a.artist,title:a.title,id:a.id,sameAlbum:a._albumKey===b._albumKey,real:c.artist};
        s.state.tagEdits[a.id] = {artist:'My artist',title:'My title'}; s.touchLibrary(); s.derived();
        return {first,manual:[a.artist,a.title]};
      });
      assert.deepEqual(result,{first:{artist:'lumioe',title:'hating (toca)',id:'existing',sameAlbum:true,real:'Audioslave'},manual:['My artist','My title']});
    });
    await check('incomplete audio is rejected instead of entering the library', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      const message = await p.evaluate(async () => {
        window.fetch = async () => new Response(new Uint8Array(10), {headers:{'content-type':'audio/mpeg','content-length':'100'}});
        try { await (await import('/web/js/link-download.js')).downloadAudio('https://example.com/test.mp3'); return ''; }
        catch(e) { return e.message; }
      });
      assert.match(message,/не полностью/);
    });
    await check('late account lyrics are applied after the foreground deadline', async ctx => {
      const p = await ctx.newPage(); await p.goto(base + '/__fixture');
      await p.evaluate(async () => {
        const s = await import('/web/js/state.js'); s.state.settings.autoLyrics = false;
        const snap = data => ({ exists: () => !!data, data: () => data });
        const fs = { getFirestore: () => ({}), doc: (_, ...parts) => parts.join('/'),
          getDoc: async ref => {
            if (!ref.includes('/blobs/ly_')) return snap(null);
            await new Promise(r => setTimeout(r, 1800));
            return snap({kind:'ly',key:'artist|saved song|10',data:JSON.stringify({type:'plain',text:'Saved in account',source:'manual',sure:true})});
          }, onSnapshot: () => () => {}, setDoc: async () => {}, deleteDoc: async () => {} };
        window.__puroFirebase = [{ initializeApp: () => ({}) }, { getAuth: () => ({}),
          onAuthStateChanged: (_, cb) => queueMicrotask(() => cb({ uid: 'user' })), signInWithEmailAndPassword: async () => {} }, fs];
        const sync = await import('/web/js/sync.js'); await sync.signInEmail('test@example.com','test-only');
        window.fixture = { sync, t: {id:'late',artist:'Artist',title:'Saved Song',duration:10} };
      });
      await p.waitForFunction(() => fixture.sync.cloudReady());
      await p.evaluate(async () => { await (await import('/web/js/lyrics-auto.js')).ensureLyrics(fixture.t); });
      await p.waitForFunction(() => fixture.t.lyrics?.text === 'Saved in account');
      assert.equal(await p.evaluate(() => fixture.t.lyrics.source), 'manual');
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
