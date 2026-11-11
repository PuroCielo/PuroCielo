import { artistMatch, extractGenius, htmlToText, titleMatch } from './lyrics-web.js';

// Genius — главный источник обычного (не синхронного) текста.
// Сайт Genius не разрешает браузеру читать свои страницы (CORS), поэтому идём несколькими путями по очереди:
//  1) «посредник», если он есть: приложение для Windows/Android или свой Cloudflare Worker;
//  2) прямой запрос (вдруг разрешён);
//  3) публичные CORS-посредники (allorigins, corsproxy) — только для поиска и страницы песни;
//  4) сам текст — через официальный виджет Genius (embed.js): он подключается как <script> и CORS не нужен.
const PUBLIC = [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
];
async function get(u, ms = 9000) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms);
    try {
        const r = await fetch(u, { signal: ctl.signal });
        return r.ok ? await r.text() : '';
    }
    catch {
        return '';
    }
    finally {
        clearTimeout(tm);
    }
}
// по очереди: посредник приложения → напрямую → публичные посредники; запоминаем, какой путь сработал
let goodRoute = -1;
async function fetchAny(u, fetchText, test) {
    const routes = [
        fetchText ? () => fetchText(u) : null,
        () => get(u),
        ...PUBLIC.map(p => () => get(p(u))),
    ];
    const order = routes.map((_, i) => i);
    if (goodRoute >= 0)
        order.sort((a, b) => (b === goodRoute) - (a === goodRoute));
    for (const i of order) {
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
        const r = h.result, by = `${r.artist_names || ''} ${r.primary_artist ? r.primary_artist.name : ''}`;
        if (skip.includes('genius:' + r.id))
            return false;
        if (NOT_SONG.test(by) || NOT_SONG.test(r.title || ''))
            return false;
        const t = r.title || r.title_with_featured || '';
        return (titleMatch(t, title) || titleMatch(String(t).replace(/\s*[([].*?[)\]]/g, ''), title)) && (!artists.length || artistMatch(by, artists));
    };
    const h = hits.find(ok);
    return h ? { id: h.result.id, url: h.result.url } : null;
}
// Виджет Genius: https://genius.com/songs/<id>/embed.js вызывает document.write(<html с текстом>).
// Подменяем document.write на время загрузки и забираем этот html. Загружаем по одному.
let embedQueue = Promise.resolve();
export function geniusEmbed(id, ms = 9000) {
    const job = () => new Promise(res => {
        const doc = document, orig = doc.write, sc = doc.createElement('script');
        let html = '', done = false;
        // на случай, если виджет вставляет текст рядом со своей ссылкой, а не через document.write
        const box = doc.createElement('div');
        box.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
        box.setAttribute('aria-hidden', 'true');
        box.innerHTML = `<div id="rg_embed_link_${Number(id) || 0}" class="rg_embed_link" data-song-id="${Number(id) || 0}"></div>`;
        doc.body.appendChild(box);
        const end = () => {
            if (done)
                return;
            done = true;
            clearTimeout(tm);
            doc.write = orig;
            if (!html) {
                const body = doc.querySelector('.rg_embed_body');
                if (body)
                    html = `<div class='rg_embed_body'>${body.innerHTML}</div><div class='rg_embed_footer'></div>`;
            }
            doc.querySelectorAll('.rg_embed, .rg_embed_body').forEach(e => { if (!e.closest('#lyrics, .np')) e.remove(); });
            box.remove();
            sc.remove();
            res(html);
        };
        const tm = setTimeout(end, ms);
        doc.write = (...a) => { html += a.join(''); };
        sc.onload = () => setTimeout(end, 150);
        sc.onerror = end;
        sc.src = `https://genius.com/songs/${encodeURIComponent(id)}/embed.js`;
        doc.head.appendChild(sc);
    });
    const p = embedQueue.then(job, job);
    embedQueue = p.catch(() => { });
    return p.then(embedText);
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
export async function geniusLyrics(cands, artists, fetchText, skip = []) {
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
        const arts = c.artist ? [...new Set([c.artist, ...artists])] : artists;
        if (!arts.length && q === c.title)
            continue; // без артиста по одному названию — слишком легко ошибиться
        let hit = null;
        for (const ep of ['search/song', 'search/multi']) {
            const raw = await fetchAny(`https://genius.com/api/${ep}?per_page=10&q=${encodeURIComponent(q)}`, fetchText, looksJson);
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
            text = await geniusEmbed(hit.id);
        }
        catch { /* дальше */ }
        if (!enough(text) && hit.url) {
            const page = await fetchAny(hit.url, fetchText, s => s.includes('data-lyrics-container'));
            text = cleanup(extractGenius(page));
        }
        if (enough(text))
            return { text, ref: 'genius:' + hit.id };
    }
    return null;
}
