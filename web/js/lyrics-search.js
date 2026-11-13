import { artistMatch, norm, titleMatch } from './lyrics-web.js';
import { parseLrc } from './lrc.js';

const NOISE = /\b(official|audio|lyrics?|visuali[sz]er|music video|hd|hq|prod\.?|feat\.?|ft\.?|remaster(?:ed)?|sped\s*up|speed\s*up|slowed|reverb|nightcore|remix|edit|version|live|8d)\b/i;
export function cleanTitle(value) {
    const raw = String(value || '').trim();
    return raw.replace(/[([{]([^\])}]+)[\])}]/g, (all, text) => NOISE.test(text) ? ' ' : all)
        .replace(/@[\w.]+/g, ' ').replace(/\b\d{2,3}\s?bpm\b/gi, ' ')
        .replace(/(?:^|\s)(?:www\.)?[\w-]+\.(?:pro|net|ru|com|me|fm|org|cc|to|club|info|biz|su|io)\b/gi, ' ')
        .replace(/\s(?:prod(?:uced)?\.?(?:\s?by)?|feat\.?|ft\.?|при уч\.?)\s.*$/i, '')
        .replace(/\s+[-–—]\s+(?:remaster(?:ed)?|live|radio edit|single version|sped\s*up|slowed|nightcore)\b.*$/i, '')
        .replace(/\s+/g, ' ').replace(/^[\s\-–—|_.,]+|[\s\-–—|_.,]+$/g, '').trim() || raw;
}
export function titleVariants(title) {
    const full = cleanTitle(title);
    return [...new Set([full, full.replace(/\s*\[[^\]]*\]/g, ' '), full.replace(/\s*[([{][^\])}]*[\])}]/g, ' ')].map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}
export function recordingVariant(title) {
    const s = String(title || '').toLowerCase();
    return [
        [/\b(sped\s*up|speed\s*up|nightcore)\b/, 'fast'],
        [/\b(slowed|slowed\s*down)\b/, 'slow'],
        [/\bremix\b/, 'remix'], [/\blive\b/, 'live'], [/\b(acoustic|unplugged)\b/, 'acoustic'],
    ].filter(([re]) => re.test(s)).map(([, tag]) => tag).join('+');
}
export function pickBest(list, duration, variant = '') {
    const knownDuration = Number.isFinite(duration) && duration > 0;
    const difference = x => knownDuration && Number(x.duration) > 0 ? Math.abs(x.duration - duration) : Infinity;
    const sorted = list.filter(Boolean).slice().sort((a,b) => (b._sure ? 1 : 0) - (a._sure ? 1 : 0) || (a._rank || 0) - (b._rank || 0) || difference(a) - difference(b));
    const timingFits = x => difference(x) <= 4 && recordingVariant(x.trackName || '') === variant;
    const timed = sorted.find(x => {
        if (!x.syncedLyrics || !timingFits(x)) return false;
        const parsed = parseLrc(x.syncedLyrics);
        return parsed.synced && parsed.lines.length > 1 && parsed.lines.every(l => Number.isFinite(l.t) && l.t >= 0 && l.t <= duration + 4);
    });
    if (timed) return timed;
    const plain = sorted.find(x => x._sure && (x.plainLyrics || x.syncedLyrics));
    if (plain) return { ...plain, syncedLyrics: null, plainLyrics: (plain.plainLyrics || String(plain.syncedLyrics).replace(/^\s*(?:\[[^\]]*\])+\s?/gm, '')).trim() };
    return sorted.find(x => x._sure && x.instrumental && timingFits(x)) || null;
}

// A failed request must not prevent the next query or another provider from running.
// Three bounded batches: exact recording, artist/title search, then free-text search.
export async function searchLyrics({ candidates, duration = 0, album = '', variant = '', bad = [] }, { signal } = {}) {
    const controller = new AbortController(), stop = () => controller.abort();
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    const deadline = setTimeout(stop, 12000), found = [], seen = new Set();
    let failures = 0;
    const request = async params => {
        if (controller.signal.aborted) { failures++; return null; }
        const requestController = new AbortController(), abort = () => requestController.abort();
        controller.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 3500);
        try {
            const r = await fetch('https://lrclib.net/api/' + params, { signal: requestController.signal, headers: { Accept: 'application/json' } });
            if (r.status === 404) return null;
            if (!r.ok) throw new Error('Lyrics HTTP ' + r.status);
            return await r.json();
        } catch { failures++; return null; }
        finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); }
    };
    const cands = candidates.slice(0, 3);
    const take = (data, c, rank) => {
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        const matches = rows.filter(x => x && titleMatch(cleanTitle(x.trackName || ''), c.title) && (x.syncedLyrics || x.plainLyrics || x.instrumental));
        const identities = new Set(matches.filter(x => Math.abs(Number(x.duration) - duration) <= 2).map(x => norm(x.artistName)));
        for (const x of matches) {
            const sure = !!c.artist && artistMatch(x.artistName || '', [c.artist]);
            // Untagged files: accept only an unambiguous exact title and matching duration.
            const inferred = !c.artist && norm(c.title).length >= 8 && norm(cleanTitle(x.trackName)) === norm(c.title) && duration > 0 && Math.abs(Number(x.duration) - duration) <= 2 && identities.size === 1;
            if ((!sure && !inferred) || seen.has(x.id) || bad.includes(x.id)) continue;
            seen.add(x.id); found.push({ ...x, _sure: sure, _rank: rank, _inferred: inferred });
        }
    };
    const best = () => pickBest(found, duration, variant);
    try {
        await Promise.all(cands.map(async (c, i) => {
            if (!c.artist) return;
            const q = new URLSearchParams({ track_name: c.title, artist_name: c.artist });
            if (album) q.set('album_name', album);
            if (duration > 0) q.set('duration', String(Math.round(duration)));
            take(await request('get?' + q), c, i);
        }));
        if (best()) return { record: best(), failed: failures > 0 };
        await Promise.all(cands.map(async (c, i) => {
            const q = new URLSearchParams({ track_name: c.title });
            if (c.artist) q.set('artist_name', c.artist);
            take(await request('search?' + q), c, i);
        }));
        if (best()) return { record: best(), failed: failures > 0 };
        await Promise.all(cands.slice(0,2).map(async (c, i) => take(await request('search?' + new URLSearchParams({ q: `${c.artist} ${c.title}`.trim() })), c, i)));
        return { record: best(), failed: failures > 0 };
    } finally {
        clearTimeout(deadline); stop(); signal?.removeEventListener('abort', stop);
    }
}
