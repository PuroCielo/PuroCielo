const { _electron: electron } = require('playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'puro-smoke-'));
  const app = await electron.launch({ executablePath: path.join(__dirname, 'dist/win-unpacked/PuroCielo.exe'), env: { ...process.env, APPDATA: data } });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.__puro);
    assert.equal(await page.evaluate(() => typeof window.PuroDesktop.fetchText), 'function');
    const wav = Buffer.alloc(44 + 44100 * 2 * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    await page.evaluate(() => Object.assign(window.__puro.state.settings, { autoCovers: false, autoLyrics: false, normalize: false, splash: false }));
    await page.locator('#file-input').setInputFiles({ name: 'Smoke Artist - Smoke Song.wav', mimeType: 'audio/wav', buffer: wav });
    await page.waitForFunction(() => window.__puro.state.tracks.size === 1);
    await page.evaluate(() => location.hash = '#/library/songs');
    await page.locator('[data-track][data-list]').first().click();
    await page.waitForFunction(() => window.__puro.audio.currentTime > 0.1);
    await page.locator('#m-play').click();
    assert(await page.evaluate(() => window.__puro.audio.paused));
    await page.evaluate(() => Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true }));
    await page.locator('#m-pip').click();
    await page.waitForFunction(() => document.documentElement.classList.contains('mini-win'));
    assert((await app.windows()).length >= 2);
    console.log('Windows packaged player: import, playback, pause, mini window PASS');
  } finally { await app.close(); fs.rmSync(data, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exit(1); });
