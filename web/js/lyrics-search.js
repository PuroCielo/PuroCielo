import { artistMatch, norm, titleMatch } from './lyrics-web.js';
import { parseLrc } from './lrc.js';
import { lyricsJSON } from './lyrics-http.js';

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
    const plain = sorted.find(x => (x._sure || x._inferred) && (x.plainLyrics || x.syncedLyrics));
    if (plain) return { ...plain, syncedLyrics: null, plainLyrics: (plain.plainLyrics || String(plain.syncedLyrics).replace(/^\s*(?:\[[^\]]*\])+\s?/gm, '')).trim() };
    return sorted.find(x => x._sure && x.instrumental && timingFits(x)) || null;
}

// Search planner: one precise lookup, then a balanced set of metadata and title
// queries. Two workers share one deadline; failed queries do not suppress others.
export async function searchLyrics({ candidates, duration = 0, album = '', variant = '', bad = [] }, { signal } = {}) {
    const ctl = new AbortController(), cancel = () => ctl.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const deadline = setTimeout(cancel, 18000), records = new Map(), diagnostics = [];
    const unique = [...new Map(candidates.filter(c => c.title).map(c => [norm(c.artist) + '|' + norm(c.title), c])).values()];
    // Keep different artists before spending the budget on their title variants.
    const artists = new Set(), primary = [], variants = [];
    for (const c of unique) { const k = norm(c.artist); (artists.has(k) ? variants : primary).push(c); artists.add(k); }
    const cands = [...primary, ...variants].slice(0, 6);
    const titles = [...new Set(cands.map(c => c.title))].slice(0, 4);
    const accept = (data, infer = false) => {
        const rows = (Array.isArray(data) ? data : data ? [data] : []).filter(x => x && !bad.includes(x.id) && x.artistName && x.trackName && (x.plainLyrics?.trim() || x.syncedLyrics?.trim() || x.instrumental));
        for (const x of rows) {
            const rank = cands.findIndex(c => c.artist && titleMatch(cleanTitle(x.trackName), c.title) && artistMatch(x.artistName, [c.artist]));
            if (rank < 0 && !infer) continue;
            const exact = titles.some(title => norm(title).length >= 8 && (norm(cleanTitle(x.trackName)) === norm(title) || norm(x.artistName + x.trackName) === norm(title)));
            const inferred = rank < 0 && exact && duration > 0 && Number(x.duration) > 0 && Math.abs(Number(x.duration) - duration) <= 2 && recordingVariant(x.trackName) === variant;
            if (rank < 0 && !inferred) continue;
            const key = x.id ?? norm(x.artistName) + '|' + norm(x.trackName) + '|' + x.duration;
            const record = { ...x, _sure: rank >= 0, _inferred: rank < 0, _rank: rank < 0 ? 20 : rank };
            if (!records.has(key) || (record._sure && !records.get(key)._sure)) records.set(key, record);
        }
    };
    const best = () => {
        const rows = [...records.values()];
        const identities = new Set(rows.filter(x => x._inferred).map(x => norm(x.artistName) + '|' + norm(x.trackName)));
        return pickBest(rows.filter(x => !x._inferred || identities.size === 1), duration, variant);
    };
    const request = async (path, params, infer = false) => {
        if (ctl.signal.aborted) return;
        try {
            const result = await lyricsJSON('https://lrclib.net/api/' + path + '?' + new URLSearchParams(params), { signal: ctl.signal, timeout: 3000 });
            diagnostics.push({ query: path, status: result.notFound ? 'empty' : 'ok' });
            if (result.data) accept(result.data, infer);
        } catch { diagnostics.push({ query: path, status: 'unavailable' }); }
    };
    const response = () => {
        const record = best(), failed = ctl.signal.aborted || diagnostics.some(d => d.status === 'unavailable');
        return { record, failed, status: record ? 'found' : failed ? 'unavailable' : [...records.values()].some(x => x._inferred) ? 'ambiguous' : 'not-found', diagnostics };
    };
    try {
        const first = cands.find(c => c.artist);
        if (first) await request('get', { artist_name: first.artist, track_name: first.title, ...(duration > 0 ? { duration: String(Math.round(duration)) } : {}), ...(album ? { album_name: album } : {}) });
        if (best()) return response();
        const jobs = [], seen = new Set();
        const add = (params, infer = false) => { const key = new URLSearchParams(params).toString(); if (!seen.has(key)) { seen.add(key); jobs.push(() => request('search', params, infer)); } };
        // Alternate known-artist and title-only searches so bad uploader tags do not
        // consume the entire deadline before the useful query is attempted.
        for (let i = 0; i < Math.max(cands.length, titles.length); i++) {
            const c = cands[i];
            if (c?.artist) add({ artist_name: c.artist, track_name: c.title });
            if (titles[i]) add({ track_name: titles[i] }, true);
        }
        for (const c of cands.slice(0, 2)) { add({ q: c.title }, true); add({ q: `${c.artist} ${c.title}`.trim() }, !c.artist); }
        let next = 0;
        const run = async () => {
            while (next < Math.min(jobs.length, 10) && !ctl.signal.aborted) {
                // Only a verified artist match can finish early. Inferred matches
                // need the remaining title queries to rule out ambiguity.
                if (best()?._sure) return;
                await jobs[next++]();
            }
        };
        await Promise.all([run(), run()]);
        return response();
    } finally { clearTimeout(deadline); ctl.abort(); signal?.removeEventListener('abort', cancel); }
}
