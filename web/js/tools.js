import { derived, save, state } from './state.js';
import { norm } from './lyrics-web.js';
import { UNKNOWN } from './artists.js';

// Порядок в медиатеке: поиск повторов и песен, которым чего-то не хватает.
const LOSSLESS = /\.(flac|wav|aiff?|ape|wv)$/i;
const known = a => a && a !== UNKNOWN;
export const hasArtist = t => (t._artists || [t.artist]).some(known);
// какая копия лучше: без потерь > выше битрейт > есть обложка/текст > любимая и чаще слушают
export function quality(t) {
    return (LOSSLESS.test(t.name || '') ? 5000 : 0) + Math.min(t.bitrate || 0, 2000) + (t.cover ? 200 : 0) + (t.lyrics ? 100 : 0)
        + (state.likes.has(t.id) ? 60 : 0) + Math.min(state.plays[t.id] || 0, 50);
}
// Повторы: то же название, тот же артист и та же длина (±2 с). В каждой группе keep — лучшая копия, extra — лишние.
export function duplicateGroups() {
    const by = new Map();
    for (const t of derived().all) {
        const title = norm(t.title);
        if (!title)
            continue;
        const k = title + '|' + norm(hasArtist(t) ? t.artist : '');
        (by.get(k) || by.set(k, []).get(k)).push(t);
    }
    const out = [];
    for (const [k, list] of by) {
        if (list.length < 2)
            continue;
        list.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        let cl = [list[0]];
        const flush = () => { if (cl.length > 1) {
            const s = [...cl].sort((a, b) => quality(b) - quality(a) || (a.addedAt || 0) - (b.addedAt || 0));
            out.push({ key: k + '|' + Math.round(s[0].duration || 0), keep: s[0], extra: s.slice(1) });
        } };
        for (let i = 1; i < list.length; i++) {
            if (Math.abs((list[i].duration || 0) - (cl[cl.length - 1].duration || 0)) <= 2)
                cl.push(list[i]);
            else {
                flush();
                cl = [list[i]];
            }
        }
        flush();
    }
    return out.sort((a, b) => a.keep.title.localeCompare(b.keep.title, 'ru'));
}
// перед удалением лишней копии переносим на оставшуюся лайк, место в плейлистах и счётчик прослушиваний
export function inherit(keep, extra) {
    for (const x of extra) {
        if (state.likes.has(x.id))
            state.likes.add(keep.id);
        state.plays[keep.id] = (state.plays[keep.id] || 0) + (state.plays[x.id] || 0);
        for (const p of state.playlists)
            if (p.ids.includes(x.id))
                p.ids = p.ids.includes(keep.id) ? p.ids.filter(id => id !== x.id) : p.ids.map(id => (id === x.id ? keep.id : id));
    }
    if (!state.plays[keep.id])
        delete state.plays[keep.id];
    save();
}
// чего не хватает
export function missing() {
    const all = derived().all;
    return { all, artist: all.filter(t => !hasArtist(t)), cover: all.filter(t => !t.cover), lyrics: all.filter(t => !t.lyrics) };
}
export const extOf = t => (/\.([a-z0-9]{2,5})$/i.exec(t.name || '') || [])[1]?.toUpperCase() || '';
export const sizeMB = t => t.size ? (t.size / 1048576).toFixed(1).replace('.', ',') + ' МБ' : '';
