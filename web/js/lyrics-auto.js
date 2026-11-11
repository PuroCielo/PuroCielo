import { emit, on, state } from './state.js';
import { parseLrc } from './lrc.js';
import { lyGet, lyKeys, lySet } from './db.js';
import { cloudLyricsDel, cloudLyricsGet, cloudLyricsPut, cloudReady } from './sync.js';
import { norm } from './util.js';
import { UNKNOWN, splitArtists } from './artists.js';
import { artistMatch, artistNear, norm as norm_LyricsWeb, titleMatch, webLyrics } from './lyrics-web.js';
import { jsonp } from './jsonp.js';
import { isNative, nativeFetchText } from './native.js';
import { geniusLyrics } from './genius.js';

// Автоматический поиск текста песни.
// Порядок: встроенные теги (USLT/SYLT) и .lrc → кэш → онлайн-база LRCLIB (по артисту, названию и длительности).
// Если текст не найден — в плеере показывается «Текст не найден». Само аудио приложение не «распознаёт».
const API = 'https://lrclib.net/api';
const MISS_TTL = 3 * 24 * 3600 * 1000; // «не найдено» помним три дня, потом ищем снова
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
const songKey = t => `${norm(primaryArtist(t))}|${norm(cleanTitle(t.title))}|${Math.round(t.duration || 0)}`;
const keyOf = t => `v7|${songKey(t)}`; // обычный кэш: сбрасывается, когда меняются правила поиска
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
            return { type: 'synced', lines: p.lines, source: 'online', ref: d.id, sure: !!d._sure };
    }
    if (d.plainLyrics && d.plainLyrics.trim())
        return { type: 'plain', text: d.plainLyrics.trim(), source: 'online', ref: d.id, sure: !!d._sure };
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
// Выбор версии: сначала с метками времени и почти той же длины, потом обычный текст.
// Версия другой длины (другой монтаж) с метками разъедется со звуком — такую не берём.
export function pickBest(list, dur) {
    const diff = x => (dur && x.duration ? Math.abs(x.duration - dur) : 0);
    const ok = list.filter(Boolean);
    const by = arr => arr.sort((a, b) => diff(a) - diff(b))[0] || null;
    // та же песня того же артиста, но другой длины (другое издание): метки времени не подойдут, а сам текст — да
    const asPlain = x => x && { ...x, syncedLyrics: null, plainLyrics: (x.plainLyrics || String(x.syncedLyrics || '').replace(/^\s*(?:\[[^\]]*\])+\s?/gm, '')).trim() };
    return by(ok.filter(x => x.syncedLyrics && diff(x) <= 4))
        || by(ok.filter(x => x.plainLyrics && diff(x) <= 6))
        || asPlain(by(ok.filter(x => x._sure && (x.plainLyrics || x.syncedLyrics))))
        || by(ok.filter(x => x.instrumental && diff(x) <= 4));
}
// У файла нет артиста в тегах — узнаём его по названию и длине в каталогах Deezer и iTunes.
// Берём, только если название совпало, а длина отличается не больше чем на 2 секунды.
async function identify(t) {
    if (t._guess !== undefined || typeof document === 'undefined')
        return;
    t._guess = '';
    const dur = Math.round(t.duration || 0), title = cleanTitle(t.title);
    if (!dur || norm_LyricsWeb(title).length < 3)
        return;
    const best = list => list.filter(x => x.artist && titleMatch(cleanTitle(x.title), title) && Math.abs(x.dur - dur) <= 2).sort((a, b) => Math.abs(a.dur - dur) - Math.abs(b.dur - dur))[0];
    try {
        const d = await jsonp(`https://api.deezer.com/search/track?${new URLSearchParams({ q: title, limit: '40', output: 'jsonp' })}`);
        let hit = best(((d && d.data) || []).map(x => ({ title: x.title_short || x.title, artist: x.artist && x.artist.name, dur: x.duration })));
        if (!hit) {
            const i = await jsonp(`https://itunes.apple.com/search?${new URLSearchParams({ term: title, entity: 'song', media: 'music', limit: '40' })}`);
            hit = best(((i && i.results) || []).map(x => ({ title: x.trackName, artist: x.artistName, dur: Math.round((x.trackTimeMillis || 0) / 1000) })));
        }
        if (hit)
            t._guess = hit.artist;
    }
    catch { /* каталоги недоступны */ }
}
async function lookup(t, bad = []) {
    if (!realArtists(t).length && !candidates(t).some(c => c.artist))
        await identify(t);
    const dur = Math.round(t.duration || 0), cands = candidates(t), found = [], arts = [...new Set([...realArtists(t), ...cands.map(c => c.artist).filter(Boolean)])];
    const near = (x, n) => !!dur && !!x.duration && Math.abs(x.duration - dur) <= n;
    // 2 — совпали название и артист; 1 — название то же, артист записан иначе, зато длина та же (±3 с); 0 — не то
    const grade = (x, title) => (!sameTitle(x, title) ? 0 : artistMatch(x.artistName, arts) ? 2 : near(x, 3) && artistNear(x.artistName, arts) ? 1 : 0);
    const synced = () => found.some(x => x.syncedLyrics && (!dur || !x.duration || Math.abs(x.duration - dur) <= 4));
    // test → 2: совпали и название, и артист; 1: подходит только при той же длине; 0: не то
    const take = (list, test) => { for (const x of list || []) {
        const ok = x && (x.syncedLyrics || x.plainLyrics || x.instrumental) && !bad.includes(x.id) ? Number(test(x)) : 0;
        if (ok)
            found.push(ok === 2 ? { ...x, _sure: true } : x);
    } };
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
            take([r.data], x => grade(x, c.title) || (near(x, 2) && sameTitle(x, c.title) ? 1 : 0)); // ответ тоже проверяем: бывает чужая песня
        if (synced())
            break;
        // 2) поиск по артисту и названию
        const s = await getJSON(`${API}/search?${new URLSearchParams({ track_name: c.title, artist_name: c.artist })}`);
        take(s.data, x => grade(x, c.title));
        if (synced())
            break;
    }
    // 3) свободный поиск: тот же артист, записанный иначе. Чужой артист с тем же названием — НЕ подходит.
    //    Без артиста или с артистом другим алфавитом — только точное название и длина ±1 с.
    if (!synced() && cands.length) {
        const c = cands[0];
        const exactLen = x => dur && x.duration && Math.abs(x.duration - dur) <= 1;
        // Артиста нет или он записан совсем иначе. Тогда «та же песня» — это то же название и та же длина (±2 с).
        // Чтобы не взять чужую песню с частым названием («Интро»), нужно ещё одно из трёх:
        // название приметное (от 8 букв), исполнитель в ответе один, или у всех таких записей один и тот же текст.
        const twin = x => norm_LyricsWeb(cleanTitle(x.trackName)) === norm_LyricsWeb(c.title) && near(x, 2);
        const head = x => norm_LyricsWeb(String(x.plainLyrics || x.syncedLyrics || '').replace(/\[[^\]]*\]/g, '')).slice(0, 120);
        const judge = list => {
            const tw = (list || []).filter(twin), n = norm_LyricsWeb(c.title).length;
            const safe = n >= 8 || (n >= 3 && (new Set(tw.map(x => norm_LyricsWeb(x.artistName))).size === 1 || new Set(tw.map(head)).size === 1));
            return x => grade(x, c.title) || (safe && twin(x) && (!arts.length || n >= 8) ? 1 : 0);
        };
        for (const q of [...new Set(cands.slice(0, 3).map(k => `${k.artist} ${k.title}`.trim()))]) {
            const s = await getJSON(`${API}/search?${new URLSearchParams({ q })}`);
            take(s.data, judge(s.data));
            if (synced())
                break;
        }
        if (!synced()) {
            const s2 = await getJSON(`${API}/search?${new URLSearchParams({ track_name: c.title })}`);
            take(s2.data, judge(s2.data));
        }
    }
    return pickBest(found, dur);
}
// Кто скачает страницу сайта, который браузеру читать нельзя: Windows-приложение, APK или свой Worker
function siteFetcher() {
    const proxy = (state.settings.lyricsProxy || '').replace(/\/+$/, '');
    if (typeof window !== 'undefined' && window.PuroDesktop && window.PuroDesktop.fetchText)
        return u => window.PuroDesktop.fetchText(u);
    if (isNative)
        return u => nativeFetchText(u);
    if (proxy)
        return async (u) => { try {
            const r = await fetch(`${proxy}/fetch?url=${encodeURIComponent(u)}`);
            return r.ok ? await r.text() : '';
        }
        catch {
            return '';
        } };
    return null;
}
// Genius — основной источник обычного текста
async function fromGenius(t, skip) {
    if (typeof window === 'undefined')
        return null;
    const cands = candidates(t).filter(c => c.title);
    if (!cands.length)
        return null;
    try {
        const g = await geniusLyrics(cands, realArtists(t), siteFetcher(), skip);
        if (g)
            return { type: 'plain', text: g.text, source: 'genius', ref: g.ref, sure: realArtists(t).length > 0 }; // артист из тегов совпал — уверены
    }
    catch { /* дальше */ }
    if (window.PuroDesktop && window.PuroDesktop.genius && !skip.length) { // старое приложение для Windows
        try {
            const c = cands[0], txt = await window.PuroDesktop.genius(c.artist, c.title);
            if (txt)
                return { type: 'plain', text: txt, source: 'genius' };
        }
        catch { /* дальше */ }
    }
    return null;
}
// Доп. источники. Свой сервер (Cloudflare Worker) отдаёт NetEase с метками времени и Genius.
async function extraSources(t) {
    const c0 = candidates(t)[0] || { artist: primaryArtist(t), title: cleanTitle(t.title) }, artist = c0.artist, title = c0.title;
    const proxy = (state.settings.lyricsProxy || '').replace(/\/+$/, '');
    const fetchText = siteFetcher();
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
            const w = await webLyrics(artist, title, fetchText, { skip: ['genius'] });
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
    return ensureLyrics(t);
}
export function ensureLyrics(t) {
    if (t && !t._manualChecked)
        return applyManual(t).then(ok => ok || ensureLyrics(t));
    if (!t || t.lyrics)
        return Promise.resolve(!!t?.lyrics);
    if (running.has(t.id))
        return running.get(t.id);
    t._ly = 'loading';
    const p = (async () => {
        const key = keyOf(t);
        try {
            const use = ly => { t.lyrics = ly; t._ly = undefined; emit('lyrics', t); return true; };
            // 1) точный текст, сохранённый на этом устройстве
            const sure = await lyGet(okKey(t)).catch(() => null);
            if (sure && sure.ly)
                return use(sure.ly);
            // 2) точный текст из аккаунта (нашёлся или вписан на другом устройстве) — без нового поиска;
            //    он важнее примерного текста из обычного кэша
            const sk = songKey(t);
            if (cloudReady() && !cloudTried.has(sk) && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
                cloudTried.add(sk);
                const c = await cloudLyricsGet(sk);
                if (c && (c.lines || c.text)) {
                    lySet(okKey(t), { ly: c, at: Date.now(), up: true });
                    return use(c);
                }
            }
            // 3) обычный кэш
            const cached = await lyGet(key);
            if (cached && cached.ly)
                return use(cached.ly);
            if (!state.settings.autoLyrics) {
                t._ly = 'none';
                return false;
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
            let ly = d && !d.instrumental ? toLyrics(d) : null;
            // с метками времени (LRCLIB) — лучше всего; иначе обычный текст сначала ищем на Genius
            if ((!ly || ly.type !== 'synced') && !(d && d.instrumental && !ly)) {
                const g = await fromGenius(t, bad.ids || []);
                if (g)
                    ly = g;
            }
            if (ly) {
                t.lyrics = ly;
                t._ly = undefined;
                lySet(key, { ly, at: Date.now() });
                if (ly.sure)
                    keepSure(t, ly);
                emit('lyrics', t);
                return true;
            }
            if (!ly && (!d || !d.instrumental)) { // запасной источник — lyrics.ovh (только обычный текст)
                const c0 = candidates(t)[0];
                if (c0 && c0.artist) try {
                    const r = await getJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(c0.artist)}/${encodeURIComponent(c0.title)}`, 8000);
                    const txt = r.data && r.data.lyrics && String(r.data.lyrics).replace(/^Paroles de la chanson[^\n]*\n/i, '').trim();
                    // сервис не сообщает, чью песню вернул, — берём, только если в тексте встречается само название
                    const nt = norm_LyricsWeb(c0.title);
                    if (txt && nt.length >= 4 && norm_LyricsWeb(txt).includes(nt)) {
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
