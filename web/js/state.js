import { SESSION_SEED, hash, norm, seededShuffle, stripSource, uid } from './util.js';
import { artistKey, splitArtists, trackArtists } from './artists.js';
import { delFile, kvGet, kvSet } from './db.js';

const LS = 'puro.state.v1';
export const DEFAULT_SETTINGS = {
    accent: 'white', // white | gold | rose | sky | mint | violet
    cardSize: 'm', // s | m | l
    homeView: 'rail', // rail | grid | list
    lyricsSize: 'm', // s | m | l
    lyTranslate: false, // перевод текста песни под строками
    autoLyrics: true, // искать тексты онлайн, если их нет в файле
    bgAnim: true, // плавающие «облака»
    splash: true, // заставка при запуске
    visualizer: true, // спектр в Now Playing
    speed: 1, // скорость воспроизведения
    transition: 0, // переход между треками: 0 — обычный, -1 — без пауз, N — плавный переход N секунд
    eq: 'flat', // эквалайзер: готовая настройка или 'custom'
    eqCustom: [0, 0, 0, 0, 0, 0], // свои значения полос, дБ
    bgCover: true, // свечение от обложки играющего трека
    stripSource: true, // убирать приписки сайтов из названий («(Sefon.Pro)» и т.п.)
    autoCovers: true, // искать обложки онлайн для песен и альбомов без обложки
    corners: 'round', // round | sharp — скругление обложек
    density: 'cozy', // cozy | compact — плотность списков
    anim: true, // анимации интерфейса
    seekStep: 5, // шаг перемотки стрелками, сек
    showLyrics: true, // показывать текст справа; выключено — плеер по центру
    lang: 'ru', // ru | en — язык интерфейса
    lyricsProxy: '', // адрес Cloudflare Worker для NetEase / Genius
    homeRecents: true, // блок «Недавно прослушанное» (старый выключатель; теперь см. homeHidden)
    normalize: true, // одинаковая громкость песен
    homeOrder: [], // порядок разделов главной (пусто — обычный)
    homeHidden: [], // скрытые разделы главной
    keepAwake: false, // не гасить экран во время музыки
};
export const state = {
    playLog: [], // [id, когда, длительность] — журнал прослушиваний
    smart: [], // умные плейлисты: { id, name, rules }
    tagEdits: {}, // свои данные трека: id → { title, artist, album, year }
    covers: { t: {}, a: {} }, // свои обложки: t — трек → картинка, a — альбом → картинка
    tracks: new Map(), // id -> track
    playlists: [], // {id, name, ids[], created}
    likes: new Set(),
    recents: [], // id[]
    hidden: [], // песни из папки (Android), которые пользователь удалил: при пересканировании не возвращаются
    plays: {}, // id -> сколько раз прослушан
    profile: { name: 'Слушатель', username: 'listener', avatar: null, banner: null },
    settings: { ...DEFAULT_SETTINGS },
    theme: 'dark',
    volume: 0.85,
    version: 0,
};
const handlers = {};
export const on = (e, f) => ((handlers[e] || (handlers[e] = [])).push(f), f);
export const emit = (e, ...a) => (handlers[e] || []).forEach(f => { try {
    f(...a);
}
catch (err) {
    console.error(err);
} });
function apply(s) {
    if (!s || typeof s !== 'object')
        return;
    if (Array.isArray(s.playlists))
        state.playlists = s.playlists;
    if (Array.isArray(s.likes))
        state.likes = new Set(s.likes);
    if (Array.isArray(s.hidden))
        state.hidden = s.hidden;
    if (Array.isArray(s.recents))
        state.recents = s.recents;
    if (s.plays && typeof s.plays === 'object')
        state.plays = s.plays;
    if (s.profile)
        Object.assign(state.profile, s.profile);
    if (s.settings)
        Object.assign(state.settings, s.settings);
    if (s.theme)
        state.theme = s.theme;
    if (typeof s.volume === 'number')
        state.volume = s.volume;
    if (Array.isArray(s.playLog))
        state.playLog = s.playLog;
    if (Array.isArray(s.smart))
        state.smart = s.smart;
    if (s.tagEdits && typeof s.tagEdits === 'object')
        state.tagEdits = s.tagEdits;
}
const snapshot = () => ({
    playlists: state.playlists, likes: [...state.likes], recents: state.recents.slice(0, 30), hidden: state.hidden, plays: state.plays, playLog: state.playLog, smart: state.smart, tagEdits: state.tagEdits,
    profile: state.profile, settings: state.settings, theme: state.theme, volume: state.volume, savedAt: Date.now(),
});
// Состояние хранится дважды: в localStorage (мгновенно) и в IndexedDB (надёжно сбрасывается на диск).
// При запуске берём более свежую копию — так «Недавно прослушанное» не пропадает после перезапуска.
export async function load() {
    let a = null, b = null;
    try {
        a = JSON.parse(localStorage.getItem(LS) || 'null');
    }
    catch { /* ignore */ }
    try {
        b = await Promise.race([kvGet('state'), new Promise(r => setTimeout(() => r(null), 1500))]);
    }
    catch { /* ignore */ }
    const best = (a?.savedAt || 0) >= (b?.savedAt || 0) ? a : b;
    apply(best || a || b);
    try {
        const c = await Promise.race([kvGet('covers'), new Promise(r => setTimeout(() => r(null), 1500))]);
        if (c && typeof c === 'object')
            state.covers = { t: c.t || {}, a: c.a || {} };
    }
    catch { /* ignore */ }
}
// ---------- свои обложки: для трека или для всего альбома (картинки хранятся в IndexedDB) ----------
function saveCovers() { kvSet('covers', state.covers); touchLibrary(); emit('covers'); }
export function setTrackCover(id, url) {
    if (url)
        state.covers.t[id] = url;
    else
        delete state.covers.t[id];
    saveCovers();
}
export function setAlbumCover(key, url) {
    const g = derived().groups.get(key);
    if (url) {
        state.covers.a[key] = url;
        if (g) // обложка альбома заменяет и свои обложки отдельных треков этого альбома
            for (const t of g.tracks)
                delete state.covers.t[t.id];
    }
    else
        delete state.covers.a[key];
    saveCovers();
}
export const hasOwnCover = id => !!state.covers.t[id];
// найденные онлайн обложки (модуль covers-auto.js регистрирует их здесь, чтобы state не зависел от сети)
let autoSrc = null;
export const autoCovers = () => (autoSrc ? autoSrc() : null);
export function registerAutoCovers(fn) { autoSrc = fn; }
export function setCovers(c) { state.covers = { t: { ...(c.t || {}) }, a: { ...(c.a || {}) } }; saveCovers(); }
export const hasAlbumCover = key => !!state.covers.a[key];
let idbTimer = 0;
export function save() {
    const snap = snapshot();
    try {
        localStorage.setItem(LS, JSON.stringify(snap));
    }
    catch (e) {
        console.warn('Не удалось сохранить состояние', e);
    }
    clearTimeout(idbTimer);
    idbTimer = setTimeout(() => kvSet('state', snap), 250);
}
export function flushSave() { clearTimeout(idbTimer); const snap = snapshot(); try {
    localStorage.setItem(LS, JSON.stringify(snap));
}
catch { /* ignore */ } kvSet('state', snap); }
export function setSetting(k, v) { state.settings[k] = v; save(); emit('settings', k, v); }
// ---------- производные коллекции ----------
let cache = null, cacheVer = -1;
export function touchLibrary() { state.version++; cache = null; emit('library'); }
const yearOf = g => parseInt(g.year, 10) || 0;
const newest = (a, b) => yearOf(b) - yearOf(a) || b.addedAt - a.addedAt;
export function derived() {
    if (cache && cacheVer === state.version)
        return cache;
    const groups = new Map(), artists = new Map();
    const all = [...state.tracks.values()];
    // 0) свои правки данных трека (название, артист, альбом, год) поверх тегов из файла
    for (const t of all) {
        if (!t._orig)
            t._orig = { title: t.title, artist: t.artist, album: t.album, year: t.year, albumArtist: t.albumArtist };
        const own = state.tagEdits[t.id] || {};
        Object.assign(t, t._orig, own);
        // убираем приписки сайтов, откуда скачан трек (кроме полей, которые пользователь задал сам)
        if (state.settings.stripSource !== false)
            for (const k of ['title', 'artist', 'album', 'albumArtist'])
                if (!(k in own) && t[k]) {
                    const v = stripSource(t[k]);
                    t[k] = v || (k === 'title' ? t[k] : '');
                }
    }
    // 1) артисты каждого трека: «A & B», «A; B», «A feat. B» → отдельные артисты
    for (const t of all) {
        t._artists = trackArtists(t);
        t._artistKeys = t._artists.map(artistKey);
        t._artistKey = t._artistKeys[0];
    }
    // 2) релизы (альбомы / синглы)
    for (const t of all) {
        const tag = t.albumArtist ? splitArtists(t.albumArtist) : [];
        const lead = tag[0] || t._artists[0];
        const key = t.album ? 'a:' + norm(lead) + '::' + norm(t.album) : 's:' + t.id;
        let g = groups.get(key);
        if (!g) {
            g = { key, name: t.album || t.title, year: t.year, genre: t.genre, tracks: [], cover: null, untitled: !t.album, addedAt: t.addedAt, tag };
            groups.set(key, g);
        }
        g.tracks.push(t);
        if (t._tagCover === undefined)
            t._tagCover = t.cover || null; // обложка из самого файла
        const ac = state.settings.autoCovers !== false ? autoCovers() : null;
        t.cover = state.covers.t[t.id] || state.covers.a[key] || t._tagCover || (ac && (ac.a[key] || ac.t[t.id])) || null;
        if (!g.cover && t.cover)
            g.cover = t.cover;
        if (!g.year && t.year)
            g.year = t.year;
        if (!g.genre && t.genre)
            g.genre = t.genre;
        g.addedAt = Math.max(g.addedAt, t.addedAt);
        t._albumKey = key;
    }
    // 3) основные исполнители релиза
    for (const g of groups.values()) {
        if (g.tag.length) {
            g.main = g.tag;
            g.artists = g.tag;
        }
        else if (g.tracks.length === 1) {
            g.main = [g.tracks[0]._artists[0]];
            g.artists = g.tracks[0]._artists;
        }
        else {
            const cnt = new Map(), names = new Map();
            for (const t of g.tracks)
                for (const n of t._artists) {
                    const k = artistKey(n);
                    cnt.set(k, (cnt.get(k) || 0) + 1);
                    if (!names.has(k))
                        names.set(k, n);
                }
            const need = Math.ceil(g.tracks.length * 0.6);
            let ks = [...cnt].filter(([, c]) => c >= need).sort((a, b) => b[1] - a[1]).map(([k]) => k);
            if (!ks.length)
                ks = [g.tracks[0]._artistKeys[0]];
            g.main = ks.map(k => names.get(k));
            g.artists = g.main;
        }
        g.artist = g.artists.join(', ');
        g.mainKeys = new Set(g.main.map(artistKey));
        g.artistKeys = g.artists.map(artistKey);
    }
    // 4) артисты: свои релизы и «совместные» (где артист только участвует)
    for (const g of groups.values())
        for (const t of g.tracks)
            t._artists.forEach((name, i) => {
                const ak = t._artistKeys[i];
                let a = artists.get(ak);
                if (!a) {
                    a = { key: ak, name, tracks: [], own: new Set(), collab: new Set(), genres: new Set(), cover: null };
                    artists.set(ak, a);
                }
                a.tracks.push(t);
                (g.mainKeys.has(ak) ? a.own : a.collab).add(g);
                if (t.genre)
                    a.genres.add(norm(t.genre));
            });
    const byNo = (a, b) => (a.discNo || 0) - (b.discNo || 0) || (a.trackNo || 0) - (b.trackNo || 0) || a.title.localeCompare(b.title, 'ru');
    for (const g of groups.values())
        g.tracks.sort(byNo);
    const cmp = (a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    const gl = [...groups.values()];
    const albums = gl.filter(g => g.tracks.length > 1).sort(cmp);
    const singles = gl.filter(g => g.tracks.length === 1).sort(cmp);
    const artistList = [...artists.values()].sort(cmp);
    for (const a of artistList) {
        a.own = [...a.own].sort(newest);
        a.collab = [...a.collab].sort(newest);
        a.groups = [...a.own, ...a.collab];
        // картинка артиста: его фото (найденное онлайн) или обложка его собственного релиза.
        // Обложку общего трека не берём — иначе у двух артистов одна и та же картинка.
        const acA = state.settings.autoCovers !== false ? autoCovers() : null;
        a.photo = (acA && acA.ar && acA.ar[a.key]) || null;
        a.cover = a.photo || a.own.find(g => g.cover)?.cover || null;
        a.backdrop = a.cover || a.collab.find(g => g.cover)?.cover || null;
    }
    const songs = all.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }));
    cache = { groups, artists, albums, singles, artistList, songs, all };
    cacheVer = state.version;
    return cache;
}
// ---------- плейлисты / лайки / недавние ----------
export const getTrack = id => state.tracks.get(id);
// Удалить песни из медиатеки: из списков, плейлистов, понравившихся. Сам файл на устройстве не трогаем.
export function removeTracks(ids) {
    const set = new Set(ids);
    let covers = false;
    for (const id of set) {
        const t = state.tracks.get(id);
        if (!t)
            continue;
        try {
            if (t.url && !t.url.startsWith('/f/'))
                URL.revokeObjectURL(t.url);
        }
        catch { /* ignore */ }
        state.tracks.delete(id);
        delFile(id);
        state.likes.delete(id);
        delete state.plays[id];
        delete state.tagEdits[id];
        if (state.covers.t[id]) {
            delete state.covers.t[id];
            covers = true;
        }
        if (String(id).startsWith('n:') && !state.hidden.includes(id))
            state.hidden.push(id);
    }
    for (const p of state.playlists)
        p.ids = p.ids.filter(id => !set.has(id));
    state.recents = state.recents.filter(id => !set.has(id));
    if (covers)
        kvSet('covers', state.covers);
    save();
    touchLibrary();
    emit('playlists');
    emit('likes');
    emit('recents');
}
export const playlistTracks = p => p.ids.map(getTrack).filter(Boolean);
export function createPlaylist(name, ids = []) {
    const p = { id: uid(), name: name.trim() || 'Новый плейлист', ids: [...new Set(ids)], created: Date.now() };
    state.playlists.push(p);
    save();
    emit('playlists');
    return p;
}
export function addToPlaylist(pid, ids) {
    const p = state.playlists.find(x => x.id === pid);
    if (!p)
        return 0;
    let n = 0;
    for (const id of ids)
        if (!p.ids.includes(id)) {
            p.ids.push(id);
            n++;
        }
    save();
    emit('playlists');
    return n;
}
export function removeFromPlaylist(pid, id) {
    const p = state.playlists.find(x => x.id === pid);
    if (!p)
        return;
    p.ids = p.ids.filter(x => x !== id);
    save();
    emit('playlists');
}
export function renamePlaylist(pid, name) {
    const p = state.playlists.find(x => x.id === pid);
    if (!p)
        return;
    p.name = name.trim() || p.name;
    save();
    emit('playlists');
}
export function deletePlaylist(pid) { state.playlists = state.playlists.filter(x => x.id !== pid); save(); emit('playlists'); }
export function toggleLike(id) {
    const on_ = !state.likes.has(id);
    on_ ? state.likes.add(id) : state.likes.delete(id);
    save();
    emit('likes', id, on_);
    return on_;
}
export function pushRecent(id) {
    state.recents = [id, ...state.recents.filter(x => x !== id)].slice(0, 30);
    save();
    emit('recents');
}
// прослушивание: счётчик + запись в журнал (для «Итогов» и умных плейлистов); журнал — последние 5000 записей
export function bumpPlay(id) {
    state.plays[id] = (state.plays[id] || 0) + 1;
    const t = getTrack(id);
    state.playLog.push([id, Date.now(), Math.round(t?.duration || 0)]);
    if (state.playLog.length > 5000)
        state.playLog.splice(0, state.playLog.length - 5000);
    save();
    emit('plays', id);
}
// ---------- умные плейлисты: собираются сами по правилам ----------
export function setTagEdit(id, edit) {
    if (edit && Object.keys(edit).length)
        state.tagEdits[id] = edit;
    else
        delete state.tagEdits[id];
    save();
    touchLibrary();
    const t = getTrack(id);
    if (t)
        emit('track-meta', t);
}
export function saveSmart(p) {
    const i = state.smart.findIndex(x => x.id === p.id);
    if (i >= 0)
        state.smart[i] = p;
    else
        state.smart.push(p);
    save();
    emit('playlists');
}
export function deleteSmart(id) { state.smart = state.smart.filter(x => x.id !== id); save(); emit('playlists'); }
export function lastPlayed() {
    const m = new Map();
    for (const [id, at] of state.playLog)
        m.set(id, at);
    return m;
}
export function smartTracks(p) {
    const r = p.rules || {}, now = Date.now(), DAY = 864e5, last = lastPlayed();
    const has = (s, q) => String(s || '').toLowerCase().includes(String(q).toLowerCase().trim());
    let list = derived().all.filter(t => (!r.liked || state.likes.has(t.id))
        && (!r.artist || has(t.artist, r.artist) || has(t.albumArtist, r.artist))
        && (!r.genre || has(t.genre, r.genre))
        && (!r.minPlays || (state.plays[t.id] || 0) >= r.minPlays)
        && (!r.notPlayedDays || !last.has(t.id) || now - last.get(t.id) > r.notPlayedDays * DAY)
        && (!r.addedDays || now - (t.addedAt || 0) <= r.addedDays * DAY));
    const sorts = {
        random: () => seededShuffle(list, hash('smart:' + p.id) ^ SESSION_SEED),
        plays: () => list.sort((a, b) => (state.plays[b.id] || 0) - (state.plays[a.id] || 0)),
        added: () => list.sort((a, b) => b.addedAt - a.addedAt),
        title: () => list.sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' })),
    };
    list = (sorts[r.sort] || sorts.random)();
    return r.limit ? list.slice(0, r.limit) : list;
}
export function likedTracks() { return [...state.likes].map(getTrack).filter(Boolean); }
