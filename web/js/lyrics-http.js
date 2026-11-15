// Same requests work in the browser, desktop and Android. The relay accepts only
// predefined public lyrics APIs; it is not a general-purpose URL proxy.
const RELAY = 'https://purocielo-audio-service.pipeddahlia1.chatgpt.site/lyrics/';
const cooldown = new Map();
function relayURL(raw) {
    const u = new URL(raw);
    if (u.origin === 'https://lrclib.net' && /^\/api\/(get|search)$/.test(u.pathname))
        return RELAY + u.pathname.split('/').pop() + u.search;
    if (u.origin === 'https://api.lyrics.ovh' && u.pathname.startsWith('/v1/')) {
        const parts = u.pathname.slice(4).split('/');
        if (parts.length === 2) return RELAY + 'plain?' + new URLSearchParams({ artist: decodeURIComponent(parts[0]), title: decodeURIComponent(parts[1]) });
    }
    return null;
}
async function request(url, signal, ms) {
    const ctl = new AbortController();
    const abort = () => ctl.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, ms);
    let cancel;
    try {
        const cancelled = new Promise((_, reject) => { cancel = () => reject(new DOMException('Cancelled', 'AbortError')); ctl.signal.addEventListener('abort', cancel, { once: true }); if (ctl.signal.aborted) cancel(); });
        return await Promise.race([cancelled, (async () => {
            const r = await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
            if (r.status === 404) { await r.body?.cancel(); return { notFound: true }; }
            if (!r.ok) {
                const retry = r.headers.get('Retry-After');
                const seconds = /^\d+$/.test(retry || '') ? Number(retry) : (Date.parse(retry) - Date.now()) / 1000;
                if (r.status === 429) cooldown.set(new URL(url).origin, Date.now() + Math.max(30, seconds || 0) * 1000);
                await r.body?.cancel(); const error = new Error('Lyrics HTTP ' + r.status); error.status = r.status; throw error;
            }
            const text = await r.text();
            if (text.length > 1000000) throw new Error('Lyrics response too large');
            const data = JSON.parse(text);
            if (!data || typeof data !== 'object') throw new Error('Invalid lyrics response');
            return { data };
        })()]);
    } finally {
        clearTimeout(timer); ctl.abort();
        ctl.signal.removeEventListener('abort', cancel);
        signal?.removeEventListener('abort', abort);
    }
}
export async function lyricsJSON(url, { signal, timeout = 4000 } = {}) {
    let failed = false;
    const relay = relayURL(url), routes = relay ? [url, relay] : [url];
    for (const route of routes) {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        const parsed = new URL(route), origin = parsed.origin, endpoint = origin + parsed.pathname;
        if (Math.max(cooldown.get(origin) || 0, cooldown.get(endpoint) || 0) > Date.now()) { failed = true; continue; }
        try { return await request(route, signal, timeout); }
        catch (e) {
            if (signal?.aborted) throw e;
            failed = true;
            // Avoid repeating a broken CORS/network path for every query in a batch.
            if (e.status >= 500) cooldown.set(endpoint, Date.now() + 10000);
            if (e instanceof TypeError || e.name === 'AbortError')
                cooldown.set(origin, Math.max(cooldown.get(origin) || 0, Date.now() + 15000));
        }
    }
    if (failed) throw new Error('Lyrics providers unavailable');
    return { notFound: true };
}
