import { emit, on, state } from './state.js';
import { parseLrc } from './lrc.js';
import { lyGet, lyKeys, lySet } from './db.js';
import { cloudLyricsDel, cloudLyricsGet, cloudLyricsPut, cloudReady } from './sync.js';
import { norm } from './util.js';
import { UNKNOWN, splitArtists } from './artists.js';
import { artistMatch, norm as norm_LyricsWeb, titleMatch, webLyrics } from './lyrics-web.js';
import { jsonp } from './jsonp.js';
import { isNative, nativeFetchText } from './native.js';
import { geniusLyrics } from './genius.js';
import { cleanTitle, titleVariants, recordingVariant, searchLyrics } from './lyrics-search.js';
export { cleanTitle, pickBest } from './lyrics-search.js';

// Автоматический поиск текста песни.
// Порядок: встроенные теги (USLT/SYLT) и .lrc → кэш → онлайн-база LRCLIB (по артисту, названию и длительности).
// Если текст не найден — в плеере показывается «Текст не найден». Само аудио приложение не «распознаёт».
const MISS_TTL = 30 * 60 * 1000; // короткий кэш промахов: новые тексты появляются постоянно
// Исполнители трека без «Неизвестного артиста»
const realArtists = t => (t._artists || splitArtists(t.artist)).filter(a => a && a !== UNKNOWN);
const primaryArtist = t => realArtists(t)[0] || '';
// Варианты «артист + название» для поиска: из тегов; «Артист - Название» внутри названия; из имени файла
export function candidates(t) {
    const out = [], seen = new Set();
    const add = (artist, title) => {
        artist = String(artist || '').trim();
        for (const variant of titleVariants(title)) {
            const k = norm(artist) + '|' + norm(variant);
            if (variant && !seen.has(k)) { seen.add(k); out.push({ artist, title: variant }); }
        }
    };
    const arts = realArtists(t);
    const title = cleanTitle(t.title);
    const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
    if (dash) { // «hitmar - plan»: пробуем артиста из названия, затем исходные теги
        // SoundCloud uploader names often differ from the artist inside the title.
        add(dash[1], dash[2]);
    }
    for (const a of arts)
        add(a, title);
    if (!arts.length && t._guess) // артист, узнанный по названию и длине (см. identify)
        add(t._guess, title);
    if (!arts.length) {
        const f = /^(.+?)\s+[-–—]\s+(.+)$/.exec(String(t.name || '').replace(/\.[^.]+$/, '').replace(/_/g, ' '));
        if (f)
            add(f[1], f[2]);
        add('', title);
    }
    return out;
}
// Песня для хранения текста: «артист + название + длина». Не зависит от файла и от версии поиска.
const songKey = t => `${norm(primaryArtist(t))}|${norm(cleanTitle(t.title))}|${Math.round(t.duration || 0)}${recordingVariant(t.title) ? '|' + recordingVariant(t.title) : ''}`;
const keyOf = t => `v8|${songKey(t)}`; // обычный кэш: сбрасывается, когда меняются правила поиска
const okKey = t => 'ok|' + songKey(t); // точные тексты: хранятся всегда и уходят в аккаунт
// «Точный» текст — тот, в котором мы уверены: совпали и название, и артист, либо текст вписал сам пользователь.
// Его больше не ищем: он лежит на устройстве постоянно и синхронизируется через аккаунт.
async function keepSure(t, ly) {
    const k = okKey(t), rec = { ly, at: Date.now(), up: false };
    await lySet(k, rec);
    if (await cloudLyricsPut(songKey(t), ly))
        lySet(k, { ...rec, up: true });
}
async function dropSure(t) {
    await lySet(okKey(t), { at: 0 });
    cloudTried.delete(songKey(t));
    cloudLyricsDel(songKey(t));
}
const cloudTried = new Set(); // в аккаунте уже спрашивали (за этот запуск)
// после входа в аккаунт отправляем точные тексты, найденные раньше без входа
let flushedFor = false;
async function flushSure() {
    if (!cloudReady() || flushedFor)
        return;
    flushedFor = true;
    cloudTried.clear();
    for (const k of (await lyKeys()) || []) {
        if (typeof k !== 'string' || !k.startsWith('ok|'))
            continue;
        const r = await lyGet(k);
        if (r && r.ly && !r.up && await cloudLyricsPut(k.slice(3), r.ly))
            lySet(k, { ...r, up: true });
    }
}
on('sync', () => { if (cloudReady())
    flushSure();
else
    flushedFor = false; });
function toLyrics(d) {
    if (!d)
        return null;
    if (d.syncedLyrics) {
        const p = parseLrc(d.syncedLyrics);
        if (p.synced)
            return { type: 'synced', lines: p.lines, source: 'lrclib', ref: d.id, sure: !!d._sure };
    }
    if (d.plainLyrics && d.plainLyrics.trim())
        return { type: 'plain', text: d.plainLyrics.trim(), source: 'lrclib', ref: d.id, sure: !!d._sure };
    return null;
}
async function getJSON(url, ms = 6000, signal) {
    const ctl = new AbortController();
    const abort = () => ctl.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, ms);
    try {
        const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        if (r.status === 404)
            return { notFound: true };
        if (!r.ok)
            throw new Error('HTTP ' + r.status);
        return { data: await r.json() };
    }
    finally {
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
}
// У файла нет артиста в тегах — узнаём его по названию и длине в каталогах Deezer и iTunes.
// Берём, только если название совпало, а длина отличается не больше чем на 2 секунды.
export async function identifyArtist(t) {
    t._guess = undefined;
    await identify(t);
    return t._guess || '';
}
// Текст, который уже лежит на устройстве (свой, точный или из кэша), — без интернета. Нужен, чтобы честно посчитать «песни без текста».
export async function peekLyrics(t) {
    if (!t || t.lyrics)
        return !!t?.lyrics;
    if (!t._manualChecked && await applyManual(t))
        return true;
    for (const k of [okKey(t), keyOf(t)]) {
        const r = await lyGet(k).catch(() => null);
        if (r && r.ly) {
            t.lyrics = r.ly;
            return true;
        }
    }
    return false;
}
async function identify(t) {
    if (t._guess !== undefined || typeof document === 'undefined')
        return;
    t._guess = '';
    const dur = Math.round(t.duration || 0), title = cleanTitle(t.title);
    if (!dur || norm_LyricsWeb(title).length < 3)
        return;
    try {
        const [d, i] = await Promise.all([
            jsonp(`https://api.deezer.com/search/track?${new URLSearchParams({ q: title, limit: '40', output: 'jsonp' })}`, 'callback', 4000),
            jsonp(`https://itunes.apple.com/search?${new URLSearchParams({ term: title, entity: 'song', media: 'music', limit: '40' })}`, 'callback', 4000),
        ]);
        const matches = [
            ...((d?.data || []).map(x => ({ title: x.title_short || x.title, artist: x.artist?.name, dur: x.duration }))),
            ...((i?.results || []).map(x => ({ title: x.trackName, artist: x.artistName, dur: Math.round((x.trackTimeMillis || 0) / 1000) }))),
        ].filter(x => x.artist && titleMatch(cleanTitle(x.title), title) && Math.abs(x.dur - dur) <= 2);
        if (new Set(matches.map(x => norm_LyricsWeb(x.artist))).size === 1) t._guess = matches[0].artist;
    } catch { /* Catalog failures do not stop lyrics providers. */ }
}
async function lookup(t, bad = []) {
    // Search the lyrics catalog first. Metadata catalogs are a fallback for truly untagged files.
    let result = await searchLyrics({ candidates: candidates(t), duration: t.duration, album: t.album, variant: recordingVariant(t.title), bad });
    if (!result.record && !realArtists(t).length && !candidates(t).some(c => c.artist)) {
        await identify(t);
        if (t._guess) result = await searchLyrics({ candidates: candidates(t), duration: t.duration, album: t.album, variant: recordingVariant(t.title), bad });
    }
    return result;
}
// Stop waiting on a slow native bridge or cloud lookup; late results cannot overwrite a newer choice.
function abortable(task, signal) {
    return new Promise(resolve => {
        if (signal?.aborted) return resolve(null);
        const abort = () => resolve(null);
        signal?.addEventListener('abort', abort, { once: true });
        Promise.resolve().then(task).then(resolve, () => resolve(null)).finally(() => signal?.removeEventListener('abort', abort));
    });
}
async function bounded(task, ms) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
    try { return await abortable(() => task(ctl.signal), ctl.signal); }
    finally { clearTimeout(timer); ctl.abort(); }
}
async function firstFound(tasks, signal) {
    return abortable(() => new Promise(resolve => {
        let left = tasks.length;
        if (!left) return resolve(null);
        for (const task of tasks) Promise.resolve().then(task).catch(() => null).then(result => {
            if (result) resolve(result);
            if (--left === 0) resolve(null);
        });
    }), signal);
}
// Кто скачает страницу сайта, который браузеру читать нельзя: Windows-приложение, APK или свой Worker
function siteFetcher(signal) {
    const proxy = (state.settings.lyricsProxy || '').replace(/\/+$/, '');
    const wrap = fn => u => abortable(() => fn(u), signal);
    if (typeof window !== 'undefined' && window.PuroDesktop && window.PuroDesktop.fetchText)
        return wrap(u => window.PuroDesktop.fetchText(u));
    if (isNative)
        return wrap(u => nativeFetchText(u));
    if (proxy)
        return wrap(async (u) => { try {
            const r = await fetch(`${proxy}/fetch?url=${encodeURIComponent(u)}`, { signal });
            return r.ok ? await r.text() : '';
        }
        catch {
            return '';
        } });
    return null;
}
// Genius — основной источник обычного текста
async function fromGenius(t, skip, signal) {
    if (typeof window === 'undefined')
        return null;
    const cands = candidates(t).filter(c => c.title);
    if (!cands.length)
        return null;
    try {
        const g = await geniusLyrics(cands, realArtists(t), siteFetcher(signal), skip, { signal });
        if (g)
            return { type: 'plain', text: g.text, source: 'genius', ref: g.ref, sure: realArtists(t).length > 0 }; // артист из тегов совпал — уверены
    }
    catch { /* дальше */ }
    if (!signal?.aborted && window.PuroDesktop && window.PuroDesktop.genius && !skip.length) { // старое приложение для Windows
        try {
            const c = cands[0], txt = await abortable(() => window.PuroDesktop.genius(c.artist, c.title), signal);
            if (txt)
                return { type: 'plain', text: txt, source: 'genius' };
        }
        catch { /* дальше */ }
    }
    return null;
}
// Доп. источники. Свой сервер (Cloudflare Worker) отдаёт NetEase с метками времени и Genius.
async function fromOVH(t, skip, signal) {
    const c = candidates(t)[0];
    if (!c?.artist || skip.includes('ovh')) return null;
    try {
        const r = await getJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(c.artist)}/${encodeURIComponent(c.title)}`, 6500, signal);
        const text = String(r.data?.lyrics || '').replace(/^Paroles de la chanson[^\n]*\n/i, '').trim();
        const title = norm_LyricsWeb(c.title);
        if (text && title.length >= 4 && norm_LyricsWeb(text).includes(title)) return { type: 'plain', text, source: 'lyrics.ovh', ref: 'ovh' };
    } catch { /* independent source */ }
    return null;
}
async function extraSources(t, skip, signal) {
    const c = candidates(t)[0] || { artist: primaryArtist(t), title: cleanTitle(t.title) };
    const { artist, title } = c, proxy = (state.settings.lyricsProxy || '').replace(/\/+$/, '');
    const fetchText = siteFetcher(signal), tasks = [];
    if (proxy && !skip.includes('proxy')) tasks.push(async () => {
        const r = await getJSON(`${proxy}/lyrics?${new URLSearchParams({ artist, title, duration: String(Math.round(t.duration || 0)) })}`, 8000, signal);
        const d = r.data;
        if (d?.synced) {
            const p = parseLrc(d.synced);
            if (p.synced && !recordingVariant(t.title)) return { type: 'synced', lines: p.lines, source: d.source || 'online', ref: 'proxy' };
            if (p.lines?.length) return { type: 'plain', text: p.lines.map(l => l.text).join('\n'), source: d.source || 'online', ref: 'proxy' };
        }
        return d?.plain?.trim() ? { type: 'plain', text: d.plain.trim(), source: d.source || 'online', ref: 'proxy' } : null;
    });
    if (fetchText) tasks.push(async () => {
        const w = await webLyrics(artist, title, fetchText, { skip: ['genius', ...skip] });
        return w ? { type: 'plain', text: w.text, source: w.source, ref: w.source } : null;
    });
    if (!skip.includes('lyrist')) tasks.push(async () => {
        const r = await getJSON(`https://lyrist.vercel.app/api/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`, 6500, signal);
        const d = r.data;
        return d?.lyrics?.trim() && titleMatch(d.title || '', title) && artistMatch(d.artist || '', [artist])
            ? { type: 'plain', text: d.lyrics.trim(), source: 'lyrist', ref: 'lyrist', sure: true } : null;
    });
    return firstFound(tasks, signal);
}
async function fallbackLyrics(t, skip) {
    return bounded(signal => firstFound([
        () => fromGenius(t, skip, signal), () => fromOVH(t, skip, signal), () => extraSources(t, skip, signal),
    ], signal), 15000);
}
// ---- сдвиг синхронизации для конкретного трека (секунды) ----
export async function getOffset(t) { try {
    const r = await lyGet('off:' + t.id);
    return r && typeof r.off === 'number' ? r.off : 0;
}
catch {
    return 0;
} }
export async function setOffset(t, off) { off = Math.round(off * 10) / 10; t._off = off; await lySet('off:' + t.id, { off, at: Date.now() }); }
const running = new Map();
// Возвращает true, если у трека появился текст. t._ly: 'loading' | 'none' | undefined
// ---- свои тексты: вставленные или загруженные из файла вручную ----
const lyFromText = text => { const p = parseLrc(text); return p.synced ? { type: 'synced', lines: p.lines, source: 'manual' } : { type: 'plain', text: String(text).trim(), source: 'manual' }; };
export function rawLyrics(t) {
    const ly = t?.lyrics;
    if (!ly)
        return '';
    if (ly.type === 'plain')
        return ly.text;
    const f = s => `[${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}]`;
    return ly.lines.map(l => f(l.t) + l.text).join('\n');
}
export async function setManualLyrics(t, text) {
    t._lyRevision = (t._lyRevision || 0) + 1;
    text = String(text || '').trim();
    await lySet('manual:' + t.id, { text, at: Date.now() });
    t._manualChecked = true;
    t._ly = undefined;
    t.lyrics = text ? lyFromText(text) : null;
    emit('lyrics', t);
    emit('lyrics-state', t);
    text ? keepSure(t, { ...t.lyrics, sure: true }) : dropSure(t); // свой текст — точный по определению
}
async function applyManual(t) {
    t._manualChecked = true;
    try {
        const m = await lyGet('manual:' + t.id);
        if (m && m.text) {
            t.lyrics = lyFromText(m.text);
            t._ly = undefined;
            emit('lyrics', t);
            return true;
        }
    }
    catch { /* ignore */ }
    return false;
}
// «Это не тот текст»: запоминаем неверный вариант и ищем снова без него
const OWN = ['manual', 'lrc', 'sylt', 'uslt'];
export const isFoundOnline = ly => !!ly && !OWN.includes(ly.source);
export async function rejectLyrics(t) {
    const ly = t && t.lyrics;
    if (!isFoundOnline(ly))
        return false;
    t._lyRevision = (t._lyRevision || 0) + 1;
    const bad = (await lyGet('bad|' + t.id).catch(() => null)) || { ids: [] };
    if (ly.ref != null)
        bad.ids = [...new Set([...(bad.ids || []), ly.ref])];
    else
        bad.all = true; // текст с сайта или другого сервиса — больше не ищем автоматически
    await lySet('bad|' + t.id, bad);
    await lySet(keyOf(t), { at: 0 });
    await dropSure(t);
    t.lyrics = null;
    t._ly = undefined;
    emit('lyrics', t);
    // Let an invalidated lookup finish before starting the replacement search.
    if (running.has(t.id)) await running.get(t.id);
    return ensureLyrics(t);
}
export function ensureLyrics(t, { retryMiss = false, prefetch = false } = {}) {
    if (!t || (t.lyrics && t._manualChecked))
        return Promise.resolve(!!t?.lyrics);
    if (!prefetch) t._lyForeground = true;
    if (retryMiss) t._lyRetryRequested = true;
    if (running.has(t.id))
        return running.get(t.id);
    if (!t.lyrics) t._ly = 'loading';
    const revision = t._lyRevision || 0, identity = songKey(t);
    const unchanged = () => (t._lyRevision || 0) === revision && songKey(t) === identity;
    const p = (async () => {
        const key = keyOf(t);
        try {
            if (!t._manualChecked && await applyManual(t)) return true;
            if (t.lyrics) return true;
            const use = ly => { if (!unchanged()) return !!t.lyrics; t.lyrics = ly; t._ly = undefined; emit('lyrics', t); return true; };
            // 1) точный текст, сохранённый на этом устройстве
            const sure = await lyGet(okKey(t)).catch(() => null);
            if (sure && sure.ly)
                return use(sure.ly);
            const cached = await lyGet(key);
            if (cached?.ly) return use(cached.ly);
            // 2) сохранённый текст из аккаунта, если на устройстве ещё ничего нет
            const sk = songKey(t);
            if (!prefetch && cloudReady() && !cloudTried.has(sk) && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
                // A slow or failed account request is not a permanent cache miss.
                // Keep its result usable after the short foreground wait ends.
                const pending = cloudLyricsGet(sk).then(async c => {
                    if (c !== undefined) cloudTried.add(sk);
                    if (!c || !(c.lines || c.text) || !unchanged()) return null;
                    await lySet(okKey(t), { ly: c, at: Date.now(), up: true });
                    if (unchanged() && (!t.lyrics || isFoundOnline(t.lyrics))) use(c);
                    return c;
                });
                const c = await bounded(() => pending, 1500);
                if (c) return true;
            }
            // 3) онлайн-поиск с коротким кэшем промахов
            if (!state.settings.autoLyrics) {
                t._ly = 'none';
                return false;
            }
            if (cached && cached.miss && Date.now() - cached.at < MISS_TTL && !(t._lyRetryRequested && (!t._lyAttempt || Date.now() - t._lyAttempt > 60000))) {
                t._ly = 'none';
                return false;
            }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                t._ly = 'offline';
                return false;
            }
            // варианты, которые пользователь отметил «Это не тот текст»
            const bad = (await lyGet('bad|' + t.id).catch(() => null)) || {};
            if (bad.all) {
                t._ly = 'none';
                lySet(key, { miss: true, at: Date.now() });
                return false;
            }
            if (t._lyForeground) t._lyAttempt = Date.now();
            const result = await lookup(t, bad.ids || []), d = result.record;
            if (!unchanged() || t.lyrics) return !!t.lyrics;
            let ly = d && !d.instrumental ? toLyrics(d) : null;
            // Display a verified plain result immediately; optional providers are only for misses.
            if (!ly && !t._lyForeground) { t._ly = undefined; return false; }
            if (!ly && !d?.instrumental) ly = await fallbackLyrics(t, bad.ids || []);
            if (!unchanged() || t.lyrics) return !!t.lyrics;
            if (ly) {
                lySet(key, { ly, at: Date.now() });
                if (ly.sure) keepSure(t, ly);
                return use(ly);
            }
            if (result.failed) { t._ly = 'error'; return false; }
            lySet(key, { miss: true, instrumental: !!(d && d.instrumental), at: Date.now() });
            t._ly = 'none';
            return false;
        }
        catch (e) {
            if (unchanged()) t._ly = 'error';
            return false;
        } // нет сети / сервис недоступен — не запоминаем как «нет текста»
        finally {
            running.delete(t.id);
            t._lyRetryRequested = false;
            t._lyForeground = false;
            emit('lyrics-state', t);
        }
    })();
    running.set(t.id, p);
    emit('lyrics-state', t);
    return p;
}
