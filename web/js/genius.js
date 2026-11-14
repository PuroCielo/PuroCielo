import { artistMatch, extractGenius, htmlToText, norm, titleMatch } from './lyrics-web.js';

// Genius — главный источник обычного (не синхронного) текста.
// Сайт Genius не разрешает браузеру читать свои страницы (CORS), поэтому идём несколькими путями по очереди:
//  1) «посредник», если он есть: приложение для Windows/Android или свой Cloudflare Worker;
//  2) прямой запрос (вдруг разрешён);
//  3) публичные CORS-посредники (allorigins, corsproxy) — только для поиска и страницы песни;
//  4) сам текст — через официальный виджет Genius (embed.js): он подключается как <script> и CORS не нужен.
const PUBLIC = [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
    u => 'https://api.cors.lol/?url=' + encodeURIComponent(u),
    u => 'https://cors.eu.org/' + u,
];
async function get(u, ms = 4000, signal) {
    const ctl = new AbortController(), abort = () => ctl.abort(), tm = setTimeout(abort, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
        const r = await fetch(u, { signal: ctl.signal });
        return r.ok ? await r.text() : '';
    }
    catch {
        return '';
    }
    finally {
        clearTimeout(tm); signal?.removeEventListener('abort', abort);
    }
}
// по очереди: посредник приложения → напрямую → публичные посредники; запоминаем, какой путь сработал
let goodRoute = -1;
async function fetchAny(u, fetchText, test, signal) {
    const routes = [
        fetchText ? () => fetchText(u) : null,
        () => get(u, 4000, signal),
        ...PUBLIC.map(p => () => get(p(u), 4000, signal)),
    ];
    const order = routes.map((_, i) => i);
    if (goodRoute >= 0)
        order.sort((a, b) => (b === goodRoute) - (a === goodRoute));
    for (const i of order) {
        if (signal?.aborted) return '';
        if (!routes[i])
            continue;
        let txt = '';
        try {
            txt = await routes[i]();
        }
        catch { /* следующий */ }
        if (txt && test(txt)) {
            goodRoute = i;
            return txt;
        }
    }
    return '';
}
const NOT_SONG = /\b(translations?|перевод|переклад|romanized|türkçe|traducción|tradução|übersetzung)\b/i;
// выбор песни из ответа поиска Genius: то же название и тот же артист; без переводов и пересказов
export function pickGenius(json, artists, title, skip = []) {
    const sections = (json && json.response && json.response.sections) || [];
    const hits = [].concat(...sections.map(s => s.hits || [])).filter(h => h && h.result && (h.type === 'song' || h.index === 'song'));
    const ok = h => {
        const r = h.result, by = `${r.artist_names || ''}, ${r.primary_artist ? r.primary_artist.name : ''}`;
        if (skip.includes('genius:' + r.id))
            return false;
        if (NOT_SONG.test(by) || NOT_SONG.test(r.title || ''))
            return false;
        const t = r.title || r.title_with_featured || '';
        return (titleMatch(t, title) || titleMatch(String(t).replace(/\s*[([].*?[)\]]/g, ''), title)) && (!artists.length || artistMatch(by, artists));
    };
    if (!artists.length) { // артиста не знаем: название должно совпасть буква в букву, быть приметным и встретиться у одной песни
        const want = norm(title), same = hits.filter(h => !skip.includes('genius:' + h.result.id) && !NOT_SONG.test(`${h.result.artist_names || ''} ${h.result.title || ''}`) && norm(h.result.title) === want);
        const one = want.length >= 8 && new Set(same.map(h => h.result.id)).size === 1 ? same[0] : null;
        return one ? { id: one.result.id, url: one.result.url } : null;
    }
    const h = hits.find(ok);
    return h ? { id: h.result.id, url: h.result.url } : null;
}
// The official widget runs in an isolated document. Late document.write calls
// must never replace the player page after a search is cancelled.
export function geniusEmbed(id, ms = 5000, signal) {
    return new Promise(resolve => {
        if (signal?.aborted || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return resolve('');
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0;visibility:hidden';
        const token = 'puro-lyrics-' + Math.random().toString(36).slice(2);
        let done = false;
        const end = html => {
            if (done) return;
            done = true; clearTimeout(timer);
            window.removeEventListener('message', receive);
            signal?.removeEventListener('abort', cancel);
            frame.remove(); resolve(embedText(html));
        };
        const receive = event => {
            if (event.source !== frame.contentWindow || event.data?.token !== token || typeof event.data.html !== 'string') return;
            end(event.data.html.slice(0, 500000));
        };
        const cancel = () => end('');
        const timer = setTimeout(cancel, ms);
        window.addEventListener('message', receive);
        signal?.addEventListener('abort', cancel, { once: true });
        frame.srcdoc = `<script>
            let captured = '';
            document.write = (...parts) => { captured += parts.join(''); };
            function finish() {
                const body = document.querySelector('.rg_embed_body');
                const html = captured || (body ? '<div class="rg_embed_body">' + body.innerHTML + '</div><div class="rg_embed_footer"></div>' : '');
                parent.postMessage({ token: ${JSON.stringify(token)}, html }, '*');
            }
        <\/script><div id="rg_embed_link_${Number(id)}" class="rg_embed_link" data-song-id="${Number(id)}"></div>
        <script src="https://genius.com/songs/${Number(id)}/embed.js" onload="setTimeout(finish,150)" onerror="finish()"><\/script>`;
        document.body.appendChild(frame);
    });
}
// html виджета → текст песни
export function embedText(html) {
    html = String(html || '');
    if (!html)
        return '';
    const m = /<div[^>]*class=['"][^'"]*rg_embed_body[^'"]*['"][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*class=['"][^'"]*rg_embed_footer|$)/i.exec(html);
    let body = m ? m[1] : '';
    if (!body) {
        const s = html.indexOf('rg_embed_body');
        if (s < 0)
            return '';
        body = html.slice(html.indexOf('>', s) + 1);
        const f = body.search(/<div[^>]*rg_embed_footer|<div[^>]*rg_embed_header/i);
        if (f > 0)
            body = body.slice(0, f);
    }
    return cleanup(htmlToText(body));
}
// убираем шапку «N Contributors … Lyrics», «Embed», «You might also like» и лишние пустые строки
export function cleanup(t) {
    return String(t || '')
        .replace(/^[\s\S]{0,300}?\bLyrics\b[^\n]*\n(?=\s*\[)/, '')
        .replace(/^\d+\s*Contributors?[^\n]*\n/i, '')
        .replace(/\n?You might also like\n?/gi, '\n')
        .replace(/\d*\s*Embed\s*$/i, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
const enough = t => !!t && t.split('\n').filter(l => l.trim()).length >= 4;
const looksJson = s => /^\s*\{/.test(s) && s.includes('"response"');
// cands: [{ artist, title }] — варианты из тегов/имени файла; artists — все артисты трека
export async function geniusLyrics(cands, artists, fetchText, skip = [], { signal } = {}) {
    const seen = new Set();
    const queries = [];
    for (const c of cands) {
        for (const q of [`${c.artist} ${c.title}`.trim(), `${c.title} ${c.artist}`.trim(), c.title])
            if (q && !seen.has(q.toLowerCase())) {
                seen.add(q.toLowerCase());
                queries.push({ q, c });
            }
    }
    for (const { q, c } of queries.slice(0, 5)) {
        if (signal?.aborted) return null;
        const arts = c.artist ? [...new Set([c.artist, ...artists])] : artists;
        let hit = null;
        for (const ep of ['search/song', 'search/multi']) {
            const raw = await fetchAny(`https://genius.com/api/${ep}?per_page=10&q=${encodeURIComponent(q)}`, fetchText, looksJson, signal);
            if (!raw)
                break; // поиск недоступен ни одним путём
            try {
                hit = pickGenius(JSON.parse(raw), arts, c.title, skip);
            }
            catch { /* битый ответ */ }
            if (hit)
                break;
        }
        if (!hit)
            continue;
        // текст: виджет (без CORS) → страница песни
        let text = '';
        try {
            text = await geniusEmbed(hit.id, 5000, signal);
        }
        catch { /* дальше */ }
        if (!enough(text) && hit.url) {
            const page = await fetchAny(hit.url, fetchText, s => s.includes('data-lyrics-container'), signal);
            text = cleanup(extractGenius(page));
        }
        if (enough(text))
            return { text, ref: 'genius:' + hit.id };
    }
    return null;
}
