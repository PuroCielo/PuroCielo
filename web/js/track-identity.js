import { kvGet, kvSet } from './db.js';
let catalog = {};
const basis = raw => JSON.stringify([raw.title || '', raw.artist || '']);
export async function loadCatalogIdentities() {
    catalog = (await kvGet('catalog-identities')) || {};
}
export function catalogIdentity(id, raw) {
    const saved = catalog[id];
    return saved?.basis === basis(raw) ? { artist: saved.artist, title: saved.title } : {};
}
export async function saveCatalogIdentity(t, record) {
    catalog[t.id] = { basis: basis(t._orig || t), artist: record.artistName, title: record.trackName };
    await kvSet('catalog-identities', catalog);
}
// Only explicit repost-channel labels are corrected. Ordinary artist names stay intact.
export const isUploadChannel = value => /\baudios?\s+station\b/i.test(String(value || ''));
export function trackIdentity(raw) {
    if (raw.artist && !/^(unknown(?: artist)?|неизвестный(?: исполнитель)?|неизвестно)$/i.test(raw.artist.trim()) && !isUploadChannel(raw.artist)) return {};
    const match = /^(.+?)\s+[-–—]\s+(.+)$/.exec(String(raw.title || '').trim());
    if (!match || isUploadChannel(match[1])) return { artist: '' };
    const title = match[2].replace(/\s*\[(?:slump(?:\s+audios?\s+station)?|[^\]]*\baudios?\s+station\b[^\]]*)\]\s*$/i, '').trim();
    return title ? { artist: match[1].trim(), title } : { artist: '' };
}
