import { kvGet, kvSet } from './db.js';
import { derived, emit, on, registerAutoCovers, state, touchLibrary } from './state.js';
import { artistMatch, titleMatch } from './lyrics-web.js';
import { UNKNOWN } from './artists.js';

// Обложки сами: для альбомов и песен без картинки ищем её онлайн — сначала в каталоге iTunes (Apple Music),
// потом в MusicBrainz / Cover Art Archive. Берём, только если совпали и название, и артист.
// Обложка из файла и своя (карандашом) всегда важнее найденной. Найденное хранится на устройстве.
const ITUNES = 'https://itunes.apple.com/search';
const MB = 'https://musicbrainz.org/ws/2';
const RETRY = 14 * 864e5; // «не нашлось» — пробуем снова через две недели
export const auto = { t: {}, a: {}, miss: {} };
let loaded = false, running = false, timer = 0;
async function loadAuto() {
    if (loaded)
        return;
    loaded = true;
    try {
        const d = await kvGet('autoCovers');
        if (d && typeof d === 'object')
            Object.assign(auto, { t: d.t || {}, a: d.a || {}, miss: d.miss || {} });
    }
    catch { /* ignore */ }
}
const persist = () => kvSet('autoCovers', auto).catch(() => { });
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
async function toData(url) {
    try {
        const r = await fetch(url);
        if (!r.ok)
            return null;
        const blob = await r.blob();
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = c.height = 500;
        const s = Math.max(500 / bmp.width, 500 / bmp.height);
        c.getContext('2d').drawImage(bmp, (500 - bmp.width * s) / 2, (500 - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
        return c.toDataURL('image/jpeg', .86);
    }
    catch {
        return url;
    }
}
const big = u => String(u || '').replace(/\/\d+x\d+bb\./, '/600x600bb.');
async function findAlbum(album, artists) {
    const j = await getJSON(`${ITUNES}?${new URLSearchParams({ term: `${artists[0] || ''} ${album}`.trim(), entity: 'album', limit: '15' })}`);
    const hit = (j?.results || []).find(r => titleMatch(String(r.collectionName || '').replace(/\s*[-–]\s*(single|ep)$/i, ''), album) && (!artists.length || artistMatch(r.artistName, artists)));
    if (hit?.artworkUrl100)
        return big(hit.artworkUrl100);
    const m = await getJSON(`${MB}/release?${new URLSearchParams({ query: `release:"${album}"${artists[0] ? ` AND artist:"${artists[0]}"` : ''}`, fmt: 'json', limit: '8' })}`);
    const rel = (m?.releases || []).find(r => titleMatch(r.title, album) && (!artists.length || artistMatch((r['artist-credit'] || []).map(a => a.name).join(' '), artists)));
    return rel ? `https://coverartarchive.org/release/${rel.id}/front-500` : null;
}
async function findSong(title, artists) {
    if (!artists.length)
        return null; // без артиста легко подставить чужую обложку — не ищем
    const j = await getJSON(`${ITUNES}?${new URLSearchParams({ term: `${artists[0]} ${title}`, entity: 'song', limit: '15' })}`);
    const hit = (j?.results || []).find(r => titleMatch(r.trackName, title) && artistMatch(r.artistName, artists));
    return hit?.artworkUrl100 ? big(hit.artworkUrl100) : null;
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
            jobs.push({ kind: 'a', key: g.key, name: g.name, artists });
        else if (g.tracks.length === 1) {
            const t = g.tracks[0];
            if (!auto.t[t.id] && fresh('t:' + t.id))
                jobs.push({ kind: 't', key: t.id, name: t.title, artists: (t._artists || []).filter(a => a !== UNKNOWN), album: t.album });
        }
    }
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
            let url = j.kind === 'a' ? await findAlbum(j.name, j.artists) : await findSong(j.name, j.artists);
            if (!url && j.kind === 't' && j.album)
                url = await findAlbum(j.album, j.artists); // сингл из альбома — обложка альбома
            if (url) {
                const data = await toData(url);
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
    if (Object.keys(auto.t).length || Object.keys(auto.a).length) {
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
