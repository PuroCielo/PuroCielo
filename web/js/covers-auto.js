import { kvGet, kvSet } from './db.js';
import { derived, emit, on, registerAutoCovers, state, touchLibrary } from './state.js';
import { artistMatch, nameEq, titleMatch } from './lyrics-web.js';
import { UNKNOWN } from './artists.js';
import { jsonp } from './jsonp.js';

// Обложки сами: для альбомов и песен без картинки ищем её онлайн — сначала в каталоге iTunes (Apple Music),
// потом в MusicBrainz / Cover Art Archive. Берём, только если совпали и название, и артист.
// Обложка из файла и своя (карандашом) всегда важнее найденной. Найденное хранится на устройстве.
const ITUNES = 'https://itunes.apple.com/search';
const MB = 'https://musicbrainz.org/ws/2';
const RETRY = 14 * 864e5; // «не нашлось» — пробуем снова через две недели
export const auto = { t: {}, a: {}, ar: {}, miss: {} }; // t — песни, a — альбомы, ar — фото артистов
let loaded = false, running = false, timer = 0;
async function loadAuto() {
    if (loaded)
        return;
    loaded = true;
    try {
        const d = await kvGet('autoCovers');
        if (d && typeof d === 'object')
            Object.assign(auto, { t: d.t || {}, a: d.a || {}, ar: d.ar || {}, miss: d.v === 2 ? d.miss || {} : {} }); // v2: прежние «не нашлось» (из-за CORS) забываем
    }
    catch { /* ignore */ }
}
const persist = () => kvSet('autoCovers', { ...auto, v: 2 }).catch(() => { });
async function getJSON(url) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000);
    try {
        const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        return r.ok ? await r.json() : null;
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(tm);
    }
}
// картинка → data URL 500×500 (чтобы работала без интернета); если сайт не даёт прочитать — сама ссылка
async function toData(url, size = 500) {
    try {
        const r = await fetch(url);
        if (!r.ok)
            return null;
        const blob = await r.blob();
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.max(size / bmp.width, size / bmp.height);
        c.getContext('2d').drawImage(bmp, (size - bmp.width * s) / 2, (size - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
        return c.toDataURL('image/jpeg', .86);
    }
    catch {
        return url;
    }
}
// iTunes и Deezer не отдают CORS-заголовки, поэтому обычный fetch из браузера/приложения блокируется.
// Оба умеют JSONP: подключаем ответ как <script> с функцией обратного вызова.
// для сравнения убираем «(Deluxe Edition)», «- Single», «[Remastered 2011]», «feat. …» и т.п.
const EXTRA = /\s*[([](?:[^)\]]*?\b(?:deluxe|remaster(?:ed)?|edition|expanded|anniversary|bonus|version|single|ep|explicit|clean|feat\.?|ft\.?|with|prod\.?|radio edit|original mix)\b[^)\]]*)[)\]]/gi;
const clean = s => String(s || '').replace(EXTRA, '').replace(/\s+[-–—]\s+(?:single|ep)$/i, '').replace(/\s+(?:feat\.?|ft\.?)\s.+$/i, '').trim();
const same = (a, b) => titleMatch(clean(a), clean(b)) || titleMatch(a, b);
const artistOk = (theirs, artists) => !artists.length || artistMatch(theirs, artists);
const big = u => String(u || '').replace(/\/\d+x\d+bb\./, '/600x600bb.');
const q = s => String(s || '').replace(/"/g, '');
async function deezer(path, query) {
    const j = await jsonp(`https://api.deezer.com/search/${path}?${new URLSearchParams({ q: query, limit: '25', output: 'jsonp' })}`);
    return (j && j.data) || [];
}
async function itunes(entity, term) {
    const j = await jsonp(`${ITUNES}?${new URLSearchParams({ term, entity, media: 'music', limit: '25' })}`);
    return (j && j.results) || [];
}
async function findAlbum(album, artists, firstTitle) {
    const a0 = artists[0] || '', name = clean(album) || album;
    // 1) Deezer: хорошо знает русскую и независимую музыку
    for (const query of [a0 ? `artist:"${q(a0)}" album:"${q(name)}"` : `album:"${q(name)}"`, `${a0} ${name}`.trim()]) {
        const hit = (await deezer('album', query)).find(r => same(r.title, album) && artistOk(r.artist?.name, artists));
        if (hit && (hit.cover_xl || hit.cover_big))
            return hit.cover_xl || hit.cover_big;
    }
    // 2) iTunes (Apple Music)
    const it = (await itunes('album', `${a0} ${name}`.trim())).find(r => same(r.collectionName, album) && artistOk(r.artistName, artists));
    if (it?.artworkUrl100)
        return big(it.artworkUrl100);
    // 3) по первой песне альбома: обложка её альбома, если название альбома похоже
    if (firstTitle && artists.length) {
        const tr = (await deezer('track', `artist:"${q(a0)}" track:"${q(clean(firstTitle))}"`)).find(r => same(r.title, firstTitle) && artistOk(r.artist?.name, artists) && same(r.album?.title, album));
        if (tr?.album?.cover_xl)
            return tr.album.cover_xl;
    }
    // 4) MusicBrainz + Cover Art Archive (у них CORS есть)
    const m = await getJSON(`${MB}/release?${new URLSearchParams({ query: `release:"${q(name)}"${a0 ? ` AND artist:"${q(a0)}"` : ''}`, fmt: 'json', limit: '8' })}`);
    const rel = (m?.releases || []).find(r => same(r.title, album) && artistOk((r['artist-credit'] || []).map(a => a.name).join(', '), artists));
    return rel ? `https://coverartarchive.org/release/${rel.id}/front-500` : null;
}
async function findSong(title, artists) {
    if (!artists.length)
        return null; // без артиста легко подставить чужую обложку — не ищем
    const a0 = artists[0], name = clean(title) || title;
    for (const query of [`artist:"${q(a0)}" track:"${q(name)}"`, `${a0} ${name}`]) {
        const hit = (await deezer('track', query)).find(r => same(r.title, title) && artistMatch(r.artist?.name, artists));
        if (hit?.album?.cover_xl || hit?.album?.cover_big)
            return hit.album.cover_xl || hit.album.cover_big;
    }
    const it = (await itunes('song', `${a0} ${name}`)).find(r => same(r.trackName, title) && artistMatch(r.artistName, artists));
    return it?.artworkUrl100 ? big(it.artworkUrl100) : null;
}
// фото артиста из каталога Deezer: имя должно совпасть; из тёзок берём самого известного
async function findArtist(name) {
    const hits = (await deezer('artist', name)).filter(r => nameEq(r.name, name)).sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0));
    const pic = hits[0] && (hits[0].picture_xl || hits[0].picture_big);
    return pic && !/\/artist\/\//.test(pic) ? pic : null; // «/artist//» — заглушка Deezer, фото нет
}
// что искать: альбомы без обложки целиком, одиночные песни — по названию
function todo() {
    const d = derived(), now = Date.now(), jobs = [];
    const fresh = k => !(auto.miss[k] && now - auto.miss[k] < RETRY);
    for (const g of d.groups.values()) {
        const noCover = g.tracks.every(t => !t._tagCover && !state.covers.t[t.id]) && !state.covers.a[g.key];
        if (!noCover)
            continue;
        const artists = (g.artists || [g.artist]).filter(a => a && a !== UNKNOWN);
        if (g.tracks.length > 1 && g.name && !auto.a[g.key] && fresh('a:' + g.key))
            jobs.push({ kind: 'a', key: g.key, name: g.name, artists, first: g.tracks[0].title });
        else if (g.tracks.length === 1) {
            const t = g.tracks[0];
            if (!auto.t[t.id] && fresh('t:' + t.id))
                jobs.push({ kind: 't', key: t.id, name: t.title, artists: (t._artists || []).filter(a => a !== UNKNOWN), album: t.album });
        }
    }
    for (const a of d.artistList)
        if (a.name !== UNKNOWN && !auto.ar[a.key] && fresh('ar:' + a.key))
            jobs.push({ kind: 'ar', key: a.key, name: a.name });
    return jobs;
}
async function run() {
    if (running || state.settings.autoCovers === false || (typeof navigator !== 'undefined' && navigator.onLine === false))
        return;
    running = true;
    await loadAuto();
    let found = 0;
    try {
        for (const j of todo()) {
            if (state.settings.autoCovers === false)
                break;
            let url = j.kind === 'ar' ? await findArtist(j.name) : j.kind === 'a' ? await findAlbum(j.name, j.artists, j.first) : await findSong(j.name, j.artists);
            if (!url && j.kind === 't' && j.album)
                url = await findAlbum(j.album, j.artists); // сингл из альбома — обложка альбома
            if (url) {
                const data = await toData(url, j.kind === 'ar' ? 360 : 500);
                if (data) {
                    auto[j.kind][j.key] = data;
                    delete auto.miss[j.kind + ':' + j.key];
                    found++;
                    if (found % 3 === 0) { // показываем найденное по ходу, не дожидаясь конца
                        touchLibrary();
                        emit('covers');
                    }
                }
            }
            else
                auto.miss[j.kind + ':' + j.key] = Date.now();
            persist();
            await new Promise(r => setTimeout(r, 350)); // бережно к сервисам
        }
    }
    finally {
        running = false;
        if (found) {
            touchLibrary();
            emit('covers');
        }
    }
}
export function scheduleAutoCovers(ms = 2500) {
    clearTimeout(timer);
    timer = setTimeout(run, ms);
}
export async function initAutoCovers() {
    registerAutoCovers(() => auto);
    await loadAuto();
    if (Object.keys(auto.t).length || Object.keys(auto.a).length || Object.keys(auto.ar).length) {
        touchLibrary();
        emit('covers');
    }
    on('library', () => scheduleAutoCovers());
    on('settings', k => { if (k === 'autoCovers') {
        touchLibrary();
        emit('covers');
        if (state.settings.autoCovers !== false) {
            auto.miss = {};
            scheduleAutoCovers(300);
        }
    } });
    scheduleAutoCovers(4000);
}
