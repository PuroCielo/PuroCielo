import { AUDIO_EXT, readMeta } from './tags.js';
import { parseLrc } from './lrc.js';
import { parseM3U } from './m3u.js';
import { createPlaylist, emit, state, touchLibrary } from './state.js';
import { allFiles, delFile, putFile } from './db.js';
import { RemoteFile, isNative, isNativeId, nativeId, nativeUrl } from './native.js';
import { extOf, norm, stripExt } from './util.js';
import { toast } from './ui.js';

const trackId = f => `${f.name}|${f.size}`;
function getDuration(url) {
    return new Promise(res => {
        const a = new Audio();
        a.preload = 'metadata';
        let done = false;
        const fin = v => { if (done)
            return; done = true; a.removeAttribute('src'); a.load(); res(v); };
        a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : 0);
        a.onerror = () => fin(0);
        setTimeout(() => fin(0), 8000);
        a.src = url;
    });
}
function lyricsFrom(meta, lrcText) {
    if (lrcText) {
        const p = parseLrc(lrcText);
        if (p.synced)
            return { type: 'synced', lines: p.lines, source: 'lrc' };
        return { type: 'plain', text: lrcText, source: 'lrc' };
    }
    if (meta.lyricsSync && meta.lyricsSync.length > 1)
        return { type: 'synced', lines: meta.lyricsSync, source: 'sylt' };
    if (meta.lyricsText) {
        const p = parseLrc(meta.lyricsText);
        if (p.synced)
            return { type: 'synced', lines: p.lines, source: 'uslt' };
        return { type: 'plain', text: meta.lyricsText.trim(), source: 'uslt' };
    }
    return null;
}
export async function buildTrack({ id, blob, name, lrc, addedAt, url: remoteUrl }) {
    const meta = await readMeta(blob, name);
    const url = remoteUrl || URL.createObjectURL(blob);
    const base = stripExt(name);
    let { title, artist } = meta;
    if (!title) {
        const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
        if (m && !artist) {
            artist = m[1].trim();
            title = m[2].trim();
        }
        else
            title = base.replace(/^\d{1,3}[\s.\-_)]+(?=\D)/, '').trim() || base;
    }
    const duration = await getDuration(url);
    const size = blob.size;
    let bitrate = meta.bitrate || 0, approx = false;
    if (duration && (meta.vbr || !bitrate)) {
        bitrate = Math.round(((meta.audioBytes || size) * 8) / duration / 1000);
        approx = true;
    }
    const cover = meta.cover ? URL.createObjectURL(meta.cover) : null;
    return {
        id, name, url, size, title, artist: artist || '', albumArtist: meta.albumArtist || '', album: meta.album || '',
        year: meta.year || '', genre: meta.genre || '', trackNo: meta.trackNo || 0, discNo: meta.discNo || 0,
        cover, _coverBlob: meta.cover || null, coverType: meta.cover?.type || '', duration, sampleRate: meta.sampleRate || 0, bitrate, approx,
        bits: meta.bits || 0, codec: meta.codec || extOf(name).toUpperCase(), channels: meta.channels || 0,
        lyrics: lyricsFrom(meta, lrc), hasLrc: !!lrc, addedAt: addedAt || Date.now(),
    };
}
export async function restoreLibrary() {
    const recs = await allFiles();
    if (!recs || !recs.length)
        return 0;
    recs.sort((a, b) => a.addedAt - b.addedAt);
    await pool(recs, 4, async (r) => {
        try {
            if (r.native) {
                if (isNative)
                    state.tracks.set(r.id, restoreNative(r));
                return;
            } // из папки: берём сохранённые теги, файл читает оболочка
            state.tracks.set(r.id, await buildTrack(r));
        }
        catch (e) {
            console.warn('restore', r.id, e);
        }
    });
    touchLibrary();
    return recs.length;
}
function restoreNative(r) {
    const t = { ...r.meta, id: r.id, url: nativeUrl(r.docId), addedAt: r.addedAt, cover: r.coverBlob ? URL.createObjectURL(r.coverBlob) : null };
    t._n = { size: r.size, mtime: r.mtime };
    return t;
}
async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
        while (i < items.length) {
            const it = items[i++];
            await fn(it);
        }
    }));
}
const readText = async (f) => {
    const buf = new Uint8Array(await f.arrayBuffer());
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('�'))
        t = new TextDecoder('windows-1251').decode(buf);
    return t;
};
function findTrackByName(base, title) {
    const nb = norm(stripExt(base));
    let hit = null;
    for (const t of state.tracks.values()) {
        if (norm(stripExt(t.name)) === nb)
            return t;
        if (!hit && title && (norm(t.title) === norm(title) || norm(`${t.artist} - ${t.title}`) === norm(title)))
            hit = t;
    }
    return hit;
}
export async function importFiles(fileList) {
    const files = [...fileList];
    const audio = [], lrcs = [], m3us = [];
    for (const f of files) {
        const e = extOf(f.name);
        if (e === 'lrc')
            lrcs.push(f);
        else if (e === 'm3u' || e === 'm3u8')
            m3us.push(f);
        else if (AUDIO_EXT.has(e) || (f.type || '').startsWith('audio/'))
            audio.push(f);
    }
    if (!audio.length && !lrcs.length && !m3us.length) {
        toast('Не нашёл поддерживаемых файлов', 'warn');
        return;
    }
    const lrcMap = new Map();
    for (const l of lrcs)
        lrcMap.set(norm(stripExt(l.name)), l);
    let added = 0, dup = 0, bad = 0;
    if (audio.length)
        toast(`Загружаю ${audio.length} ${audio.length === 1 ? 'файл' : 'файлов'}…`, 'info', 1800);
    const stamp = Date.now();
    await pool(audio, 4, async (f) => {
        const id = trackId(f);
        if (state.tracks.has(id)) {
            dup++;
            return;
        }
        try {
            const l = lrcMap.get(norm(stripExt(f.name)));
            const lrc = l ? await readText(l) : null;
            const rec = { id, blob: f, name: f.name, lrc, addedAt: stamp + added };
            const t = await buildTrack(rec);
            if (!t.duration) {
                URL.revokeObjectURL(t.url);
                bad++;
                return;
            }
            state.tracks.set(id, t);
            added++;
            putFile(rec);
        }
        catch (err) {
            console.warn(err);
            bad++;
        }
    });
    // отдельные .lrc к уже загруженным трекам
    let lrcAttached = 0;
    for (const l of lrcs) {
        const t = findTrackByName(l.name);
        if (!t || (t.hasLrc && audio.length)) {
            if (!t)
                toast(`Для «${l.name}» не найден трек с таким именем`, 'warn');
            continue;
        }
        const text = await readText(l);
        const p = parseLrc(text);
        t.lyrics = p.synced ? { type: 'synced', lines: p.lines, source: 'lrc' } : { type: 'plain', text, source: 'lrc' };
        t.hasLrc = true;
        lrcAttached++;
        putFile({ id: t.id, blob: await (await fetch(t.url)).blob(), name: t.name, lrc: text, addedAt: t.addedAt });
        emit('lyrics', t);
    }
    touchLibrary();
    for (const m of m3us) {
        const entries = parseM3U(await readText(m));
        const ids = [];
        let miss = 0;
        for (const en of entries) {
            const t = findTrackByName(en.base, en.title);
            t ? ids.push(t.id) : miss++;
        }
        if (ids.length) {
            const p = createPlaylist(stripExt(m.name), ids);
            toast(`Плейлист «${p.name}»: ${ids.length} треков${miss ? `, не найдено: ${miss}` : ''}`, miss ? 'warn' : 'ok', 4000);
        }
        else
            toast(`Плейлист «${m.name}»: ни один трек не найден в библиотеке — сначала добавьте музыку`, 'warn', 5000);
    }
    const parts = [];
    if (added)
        parts.push(`добавлено: ${added}`);
    if (lrcAttached)
        parts.push(`текстов .lrc: ${lrcAttached}`);
    if (dup)
        parts.push(`уже были: ${dup}`);
    if (bad)
        parts.push(`не удалось прочитать: ${bad}`);
    if (parts.length && (audio.length || lrcAttached))
        toast(parts.join(' · '), bad ? 'warn' : 'ok', 3500);
}
// ---------- drag & drop (в т.ч. папки) ----------
export async function filesFromDrop(dt) {
    const entries = [];
    for (const it of dt.items || [])
        if (it.kind === 'file') {
            const e = it.webkitGetAsEntry?.();
            if (e)
                entries.push(e);
        }
    if (!entries.length)
        return [...dt.files];
    const out = [];
    const walk = async (e) => {
        if (e.isFile)
            await new Promise(r => e.file(f => { out.push(f); r(); }, r));
        else if (e.isDirectory) {
            const rd = e.createReader();
            for (;;) {
                const batch = await new Promise(r => rd.readEntries(r, () => r([])));
                if (!batch.length)
                    break;
                for (const c of batch)
                    await walk(c);
            }
        }
    };
    for (const e of entries)
        await walk(e);
    return out;
}
// ---------- медиатека из одной папки (Android) ----------
let syncing = false;
export async function syncNativeLibrary(scan) {
    if (syncing)
        return;
    if (!scan || !scan.ok) {
        toast(scan?.error ? `Не удалось прочитать папку: ${scan.error}` : 'Не удалось прочитать папку', 'warn', 4500);
        return;
    }
    syncing = true;
    try {
        const files = scan.files || [];
        const audio = files.filter(f => AUDIO_EXT.has(extOf(f.name)));
        const lrcs = new Map(files.filter(f => extOf(f.name) === 'lrc').map(f => [norm(stripExt(f.name)), f]));
        const m3us = files.filter(f => ['m3u', 'm3u8'].includes(extOf(f.name)));
        const present = new Set(audio.map(f => nativeId(f.id)));
        // 1) удалённые из папки файлы убираем из библиотеки
        let removed = 0;
        for (const id of [...state.tracks.keys()]) {
            if (!isNativeId(id) || present.has(id))
                continue;
            const t = state.tracks.get(id);
            if (t?.cover)
                URL.revokeObjectURL(t.cover);
            state.tracks.delete(id);
            delFile(id);
            removed++;
        }
        // 2) новые и изменённые
        const todo = audio.filter(f => { const t = state.tracks.get(nativeId(f.id)); return !t || !t._n || t._n.size !== f.size || t._n.mtime !== f.mtime; });
        if (todo.length)
            toast(`Сканирую папку «${scan.folder || ''}»: ${todo.length} ${todo.length === 1 ? 'файл' : 'файлов'}…`, 'info', 2500);
        let added = 0, bad = 0, done = 0;
        const stamp = Date.now();
        await pool(todo, 4, async (f) => {
            const id = nativeId(f.id), url = nativeUrl(f.id);
            try {
                const l = lrcs.get(norm(stripExt(f.name)));
                let lrc = null;
                if (l) {
                    try {
                        lrc = await readText(await (await fetch(nativeUrl(l.id))).blob());
                    }
                    catch { /* без текста */ }
                }
                const old = state.tracks.get(id);
                const t = await buildTrack({ id, blob: new RemoteFile(url, f.size, f.name), name: f.name, lrc, addedAt: old?.addedAt || stamp + added, url });
                if (!t.duration) {
                    bad++;
                    return;
                }
                t._n = { size: f.size, mtime: f.mtime };
                state.tracks.set(id, t);
                added++;
                const { url: _u, cover: _c, _coverBlob, _n, ...meta } = t;
                for (const k of Object.keys(meta))
                    if (k.startsWith('_'))
                        delete meta[k];
                putFile({ id, native: true, docId: f.id, name: f.name, size: f.size, mtime: f.mtime, addedAt: t.addedAt, meta, coverBlob: _coverBlob || null });
            }
            catch (e) {
                console.warn('native scan', f.name, e);
                bad++;
            }
            if (++done % 40 === 0)
                touchLibrary();
        });
        touchLibrary();
        // 3) плейлисты .m3u / .m3u8 из папки — один раз
        for (const f of m3us) {
            const key = `puro.m3u.${f.id}|${f.mtime}`;
            try {
                if (localStorage.getItem(key))
                    continue;
            }
            catch { /* ignore */ }
            try {
                const entries = parseM3U(await readText(await (await fetch(nativeUrl(f.id))).blob()));
                const ids = [];
                for (const en of entries) {
                    const t = findTrackByName(en.base, en.title);
                    if (t)
                        ids.push(t.id);
                }
                if (ids.length) {
                    createPlaylist(stripExt(f.name), ids);
                    try {
                        localStorage.setItem(key, '1');
                    }
                    catch { /* ignore */ }
                }
            }
            catch (e) {
                console.warn('m3u', f.name, e);
            }
        }
        const parts = [];
        if (added)
            parts.push(`добавлено: ${added}`);
        if (removed)
            parts.push(`удалено: ${removed}`);
        if (bad)
            parts.push(`не удалось прочитать: ${bad}`);
        if (!audio.length)
            toast('В выбранной папке нет аудиофайлов', 'warn', 4000);
        else if (parts.length)
            toast(parts.join(' · '), bad ? 'warn' : 'ok', 3500);
    }
    finally {
        syncing = false;
    }
}
