import { emit, state } from './state.js';
import { parseLrc } from './lrc.js';
import { lyGet, lySet } from './db.js';
import { norm } from './util.js';
import { UNKNOWN, splitArtists } from './artists.js';
import { artistMatch, norm as norm_LyricsWeb, titleMatch, webLyrics } from './lyrics-web.js';
import { isNative, nativeFetchText } from './native.js';

// Автоматический поиск текста песни.
// Порядок: встроенные теги (USLT/SYLT) и .lrc → кэш → онлайн-база LRCLIB (по артисту, названию и длительности).
// Если текст не найден — в плеере показывается «Текста нет». Само аудио приложение не «распознаёт».
const API = 'https://lrclib.net/api';
const MISS_TTL = 14 * 24 * 3600 * 1000; // «не найдено» помним две недели
// Название без «мусора»: (скобки), [скобки], prod./feat. в конце, @ники, 160bpm, адреса сайтов (Sefon.Pro, zaycev.net…)
export function cleanTitle(s) {
    const raw = String(s || '').trim();
    let t = raw.replace(/\s*[(\[{][^)\]}]*[)\]}]/g, ' ')
        .replace(/@[\w.]+/g, ' ')
        .replace(/\b\d{2,3}\s?bpm\b/gi, ' ')
        .replace(/(?:^|\s)(?:www\.)?[\w-]+\.(?:pro|net|ru|com|me|fm|org|cc|to|club|info|biz|su|io)\b/gi, ' ')
        .replace(/\s(?:prod(?:uced)?\.?(?:\s?by)?|feat\.?|ft\.?|при уч\.?)\s.*$/i, '')
        .replace(/\s+[-–—]\s+(?:remaster(?:ed)?|live|radio edit|single version)\b.*$/i, '')
        .replace(/\s+/g, ' ').replace(/^[\s\-–—|_.,]+|[\s\-–—|_.,]+$/g, '').trim();
    return t || raw;
}
// Исполнители трека без «Неизвестного артиста»
const realArtists = t => (t._artists || splitArtists(t.artist)).filter(a => a && a !== UNKNOWN);
const primaryArtist = t => realArtists(t)[0] || '';
// Варианты «артист + название» для поиска: из тегов; «Артист - Название» внутри названия; из имени файла
export function candidates(t) {
    const out = [], seen = new Set();
    const add = (artist, title) => {
        title = cleanTitle(title);
        artist = String(artist || '').trim();
        const k = norm(artist) + '|' + norm(title);
        if (title && !seen.has(k)) {
            seen.add(k);
            out.push({ artist, title });
        }
    };
    const arts = realArtists(t);
    const title = cleanTitle(t.title);
    const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
    if (dash) { // «hitmar - plan»: слева артист (тот же, что в теге, или вообще без тега)
        const left = norm(dash[1]);
        if (!arts.length || arts.some(a => norm(a) === left || left.includes(norm(a))))
            add(arts[0] || dash[1], dash[2]);
    }
    for (const a of arts)
        add(a, title);
    if (!arts.length) {
        const f = /^(.+?)\s+[-–—]\s+(.+)$/.exec(String(t.name || '').replace(/\.[^.]+$/, '').replace(/_/g, ' '));
        if (f)
            add(f[1], f[2]);
        add('', title);
    }
    return out;
}
const keyOf = t => `v4|${norm(primaryArtist(t))}|${norm(cleanTitle(t.title))}|${Math.round(t.duration || 0)}`;
function toLyrics(d) {
    if (!d)
        return null;
    if (d.syncedLyrics) {
        const p = parseLrc(d.syncedLyrics);
        if (p.synced)
            return { type: 'synced', lines: p.lines, source: 'online', ref: d.id };
    }
    if (d.plainLyrics && d.plainLyrics.trim())
        return { type: 'plain', text: d.plainLyrics.trim(), source: 'online', ref: d.id };
    return null;
}
async function getJSON(url, ms = 9000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
        const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        if (r.status === 404)
            return { notFound: true };
        if (!r.ok)
            throw new Error('HTTP ' + r.status);
        return { data: await r.json() };
    }
    finally {
        clearTimeout(timer);
    }
}
// Это та же песня? LRCLIB ищет нечётко и может вернуть другой трек — тогда текст «идёт» не по песне.
const sameTitle = (x, title) => titleMatch(cleanTitle(x.trackName || x.name), title);
// и название, и артист: сверяем со ВСЕМИ артистами трека (у «perubaby, boolymon» подходит любой из двух)
const sameTrack = (x, title, artists) => sameTitle(x, title) && artistMatch(x.artistName, artists);
// латиница ↔ кириллица: имя артиста могло быть записано другим алфавитом — тогда сравнить его нельзя
const otherScript = (a, b) => /[а-яё]/i.test(a) !== /[а-яё]/i.test(b);
// Выбор версии: сначала с метками времени и почти той же длины, потом обычный текст.
// Версия другой длины (другой монтаж) с метками разъедется со звуком — такую не берём.
export function pickBest(list, dur) {
    const diff = x => (dur && x.duration ? Math.abs(x.duration - dur) : 0);
    const ok = list.filter(Boolean);
    const by = arr => arr.sort((a, b) => diff(a) - diff(b))[0] || null;
    return by(ok.filter(x => x.syncedLyrics && diff(x) <= 4))
        || by(ok.filter(x => x.plainLyrics && diff(x) <= 6))
        || by(ok.filter(x => x.instrumental && diff(x) <= 4));
}
async function lookup(t, bad = []) {
    const dur = Math.round(t.duration || 0), cands = candidates(t), found = [], arts = [...new Set([...realArtists(t), ...cands.map(c => c.artist).filter(Boolean)])];
    const synced = () => found.some(x => x.syncedLyrics && (!dur || !x.duration || Math.abs(x.duration - dur) <= 4));
    const take = (list, test) => { for (const x of list || [])
        if (x && (x.syncedLyrics || x.plainLyrics || x.instrumental) && !bad.includes(x.id) && test(x))
            found.push(x); };
    for (const c of cands) {
        if (!c.artist)
            continue;
        // 1) точный запрос
        const q = new URLSearchParams({ track_name: c.title, artist_name: c.artist });
        if (t.album)
            q.set('album_name', t.album);
        if (dur)
            q.set('duration', String(dur));
        const r = await getJSON(`${API}/get?${q}`);
        if (r.data)
            take([r.data], () => true);
        if (synced())
            break;
        // 2) поиск по артисту и названию
        const s = await getJSON(`${API}/search?${new URLSearchParams({ track_name: c.title, artist_name: c.artist })}`);
        take(s.data, x => sameTrack(x, c.title, arts));
        if (synced())
            break;
    }
    // 3) свободный поиск: тот же артист, записанный иначе. Чужой артист с тем же названием — НЕ подходит.
    //    Без артиста или с артистом другим алфавитом — только точное название и длина ±1 с.
    if (!synced() && cands.length) {
        const c = cands[0];
        const exactLen = x => dur && x.duration && Math.abs(x.duration - dur) <= 1;
        const loose = x => norm_LyricsWeb(cleanTitle(x.trackName)) === norm_LyricsWeb(c.title) && exactLen(x) && (!arts.length || otherScript(x.artistName, arts.join(' ')));
        const s = await getJSON(`${API}/search?${new URLSearchParams({ q: `${c.artist} ${c.title}`.trim() })}`);
        take(s.data, x => sameTrack(x, c.title, arts) || loose(x));
        if (!synced()) {
            const s2 = await getJSON(`${API}/search?${new URLSearchParams({ track_name: c.title })}`);
            take(s2.data, x => sameTrack(x, c.title, arts) || loose(x));
        }
    }
    return pickBest(found, dur);
}
// Доп. источники. Свой сервер (Cloudflare Worker) отдаёт NetEase с метками времени и Genius.
async function extraSources(t) {
    const c0 = candidates(t)[0] || { artist: primaryArtist(t), title: cleanTitle(t.title) }, artist = c0.artist, title = c0.title;
    if (typeof window !== 'undefined' && window.PuroDesktop && window.PuroDesktop.genius) { // приложение для Windows: Genius напрямую
        try {
            const txt = await window.PuroDesktop.genius(artist, title);
            if (txt)
                return { type: 'plain', text: txt, source: 'genius' };
        }
        catch { /* дальше */ }
    }
    const proxy = (state.settings.lyricsProxy || '').replace(/\/+$/, '');
    const desktop = typeof window !== 'undefined' && window.PuroDesktop && window.PuroDesktop.fetchText;
    const fetchText = desktop ? u => window.PuroDesktop.fetchText(u)
        : isNative ? u => nativeFetchText(u)
            : proxy ? async (u) => { try {
                const r = await fetch(`${proxy}/fetch?url=${encodeURIComponent(u)}`);
                return r.ok ? await r.text() : '';
            }
            catch {
                return '';
            } }
                : null;
    if (proxy) {
        try {
            const r = await getJSON(`${proxy}/lyrics?${new URLSearchParams({ artist, title, duration: String(Math.round(t.duration || 0)) })}`, 12000);
            const d = r.data;
            if (d) {
                if (d.synced) {
                    const p = parseLrc(d.synced);
                    if (p.synced)
                        return { type: 'synced', lines: p.lines, source: d.source || 'online' };
                }
                if (d.plain && String(d.plain).trim())
                    return { type: 'plain', text: String(d.plain).trim(), source: d.source || 'online' };
            }
        }
        catch { /* сервер недоступен */ }
    }
    if (fetchText) { // Genius, Lyrics.com, AZLyrics, Text-pesni, Vse-pesni
        try {
            const w = await webLyrics(artist, title, fetchText, { skip: desktop && window.PuroDesktop.genius ? ['genius'] : [] });
            if (w)
                return { type: 'plain', text: w.text, source: w.source };
        }
        catch { /* дальше */ }
    }
    try {
        const r = await getJSON(`https://lyrist.vercel.app/api/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`, 8000);
        const d = r.data, txt = d && d.lyrics && String(d.lyrics).trim();
        // lyrist отдаёт первый результат поиска — берём, только если это та же песня того же артиста
        if (txt && titleMatch(d.title || '', title) && artistMatch(d.artist || '', [artist]))
            return { type: 'plain', text: txt, source: 'online' };
    }
    catch { /* источник недоступен */ }
    return null;
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
    text = String(text || '').trim();
    await lySet('manual:' + t.id, { text, at: Date.now() });
    t._manualChecked = true;
    t._ly = undefined;
    t.lyrics = text ? lyFromText(text) : null;
    emit('lyrics', t);
    emit('lyrics-state', t);
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
    const bad = (await lyGet('bad|' + t.id).catch(() => null)) || { ids: [] };
    if (ly.ref != null)
        bad.ids = [...new Set([...(bad.ids || []), ly.ref])];
    else
        bad.all = true; // текст с сайта или другого сервиса — больше не ищем автоматически
    await lySet('bad|' + t.id, bad);
    await lySet(keyOf(t), { at: 0 });
    t.lyrics = null;
    t._ly = undefined;
    emit('lyrics', t);
    return ensureLyrics(t);
}
export function ensureLyrics(t) {
    if (t && !t._manualChecked)
        return applyManual(t).then(ok => ok || ensureLyrics(t));
    if (!t || t.lyrics)
        return Promise.resolve(!!t?.lyrics);
    if (!state.settings.autoLyrics) {
        t._ly = 'none';
        return Promise.resolve(false);
    }
    if (running.has(t.id))
        return running.get(t.id);
    t._ly = 'loading';
    const p = (async () => {
        const key = keyOf(t);
        try {
            const cached = await lyGet(key);
            if (cached && cached.ly) {
                t.lyrics = cached.ly;
                t._ly = undefined;
                emit('lyrics', t);
                return true;
            }
            if (cached && cached.miss && Date.now() - cached.at < MISS_TTL) {
                t._ly = 'none';
                return false;
            }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                t._ly = 'none';
                return false;
            }
            // варианты, которые пользователь отметил «Это не тот текст»
            const bad = (await lyGet('bad|' + t.id).catch(() => null)) || {};
            if (bad.all) {
                t._ly = 'none';
                lySet(key, { miss: true, at: Date.now() });
                return false;
            }
            const d = await lookup(t, bad.ids || []);
            const ly = d && !d.instrumental ? toLyrics(d) : null;
            if (ly) {
                t.lyrics = ly;
                t._ly = undefined;
                lySet(key, { ly, at: Date.now() });
                emit('lyrics', t);
                return true;
            }
            if (!ly && (!d || !d.instrumental)) { // запасной источник — lyrics.ovh (только обычный текст)
                const c0 = candidates(t)[0];
                if (c0 && c0.artist) try {
                    const r = await getJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(c0.artist)}/${encodeURIComponent(c0.title)}`, 8000);
                    const txt = r.data && r.data.lyrics && String(r.data.lyrics).trim();
                    if (txt) {
                        const l2 = { type: 'plain', text: txt, source: 'online' };
                        t.lyrics = l2;
                        t._ly = undefined;
                        lySet(key, { ly: l2, at: Date.now() });
                        emit('lyrics', t);
                        return true;
                    }
                }
                catch { /* источник недоступен */ }
            }
            if (!ly) { // ещё источники: свой сервер (NetEase, Genius) и lyrist
                const more = await extraSources(t);
                if (more) {
                    t.lyrics = more;
                    t._ly = undefined;
                    lySet(key, { ly: more, at: Date.now() });
                    emit('lyrics', t);
                    return true;
                }
            }
            lySet(key, { miss: true, instrumental: !!(d && d.instrumental), at: Date.now() });
            t._ly = 'none';
            return false;
        }
        catch (e) {
            t._ly = 'none';
            return false;
        } // нет сети / сервис недоступен — не запоминаем как «нет текста»
        finally {
            running.delete(t.id);
            emit('lyrics-state', t);
        }
    })();
    running.set(t.id, p);
    return p;
}
