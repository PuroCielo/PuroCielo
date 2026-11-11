// Тексты с сайтов: Genius, Lyrics.com, AZLyrics, Text-pesni, Vse-pesni.
// Браузер не может читать эти сайты напрямую (CORS), поэтому страницу скачивает «посредник»:
//  • приложение для Windows — главный процесс Electron;  • APK — нативный мост;  • сайт/PWA — свой Cloudflare Worker (/fetch).
// Здесь только разбор HTML и выбор нужной песни; функции чистые, их можно проверять без сети.
export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" };
export const decodeEntities = s => String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
        const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
});
export const htmlToText = h => decodeEntities(String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '')
    .replace(/<br\s*\/?>[ \t]*\r?\n?/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
// ---- Genius ----
export function extractGenius(html) {
    const out = [];
    const re = /<div[^>]*data-lyrics-container="true"[^>]*>/g;
    let m;
    while ((m = re.exec(html))) {
        let i = re.lastIndex, depth = 1;
        const tag = /<(\/?)div\b[^>]*>/g;
        tag.lastIndex = i;
        let t;
        while (depth > 0 && (t = tag.exec(html)))
            depth += t[1] ? -1 : 1;
        out.push(html.slice(i, t ? t.index : html.length));
    }
    if (!out.length)
        return '';
    return htmlToText(out.join('\n').replace(/<div[^>]*data-exclude-from-selection="true"[\s\S]*?<\/div>/g, ''));
}
// Строгое совпадение названия: одинаковые или почти одинаковые («washed» ≠ «washed out», ≠ «brainwashed»)
export function titleMatch(a, b) {
    a = norm(a);
    b = norm(b);
    if (!a || !b)
        return false;
    if (a === b)
        return true;
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    return l.includes(s) && s.length >= 4 && s.length / l.length >= 0.85;
}
// ---- сравнение артистов ----
// Раньше хватало вхождения букв («Aria» находилась внутри «Mariah Carey») — отсюда чужие тексты.
// Теперь сравниваются имена целиком: «perubaby, boolymon» → два имени, подходит любое из них.
// Имя, записанное другим алфавитом («Скриптонит» / «Skryptonite»), сравнивается после транслитерации.
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'i', є: 'e', ґ: 'g' };
const fold = n => n.replace(/(.)\1+/g, '$1').replace(/[а-яіїєґ]/g, c => TR[c] ?? c).replace(/kh/g, 'h').replace(/ph/g, 'f').replace(/[yj]/g, 'i').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/ck/g, 'k').replace(/c(?![h])/g, 'k').replace(/(.)\1+/g, '$1');
function lev(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++)
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[b.length];
}
export function nameEq(a, b) {
    const sx = v => norm(String(v || '').replace(/\$/g, 's'));
    const x = sx(a), y = sx(b);
    if (!x || !y)
        return false;
    if (x === y)
        return true;
    const cross = /[а-яіїєґ]/.test(x) !== /[а-яіїєґ]/.test(y);
    const fx = fold(x), fy = fold(y);
    if (cross && fx === fy && fx.length >= 3)
        return true;
    if (Math.min(fx.length, fy.length) < 5)
        return false;
    const sim = 1 - lev(fx, fy) / Math.max(fx.length, fy.length);
    return sim >= (cross ? 0.78 : 0.86);
}
const SEP_HARD = /\s*(?:[,;/]|&|\bfeat\.?|\bft\.?|\bfeaturing\b)\s*/i;
const SEP_SOFT = /\s*(?:[,;/+×]|&|\bfeat\.?|\bft\.?|\bfeaturing\b|\s(?:x|and|и|with|vs\.?)\s)\s*/i;
export const artistParts = s => { const raw = String(s || ''); return [...new Set([raw, ...raw.split(SEP_HARD), ...raw.split(SEP_SOFT)].map(x => x.trim()).filter(Boolean))]; };
// Артист совпадает, если хотя бы одно из наших имён равно одному из их имён
export function artistMatch(theirs, ours) {
    const T = artistParts(theirs);
    if (!T.length)
        return false;
    return [].concat(ours).some(o => artistParts(o).some(a => T.some(t => nameEq(a, t))));
}
const sameSong = (a, b) => titleMatch(a, b);
const sameArtist = (a, b) => artistMatch(a, b);
export function pickGeniusHit(json, artist, title) {
    const hits = [].concat(...((json && json.response && json.response.sections) || []).map(s => s.hits || [])).filter(h => h.type === 'song' && h.result);
    const h = hits.find(h => sameSong(h.result.title, title) && (!artist || sameArtist((h.result.artist_names || '') + ', ' + (h.result.primary_artist && h.result.primary_artist.name || ''), artist)));
    return h ? h.result.url : '';
}
// ---- Lyrics.com ----
export function pickLyricsCom(html, artist, title) {
    const re = /href="(\/lyric\/\d+\/[^"]+)"[^>]*>([^<]*)</g;
    let m;
    const want = norm(title);
    while ((m = re.exec(html))) {
        const slug = decodeURIComponent(m[1]).toLowerCase();
        if (titleMatch(m[2], title)) {
            if (!artist || norm(slug).includes(norm(artist).slice(0, 5)))
                return 'https://www.lyrics.com' + m[1];
        }
    }
    return '';
}
export function extractLyricsCom(html) { const m = /<pre[^>]*id="lyric-body-text"[^>]*>([\s\S]*?)<\/pre>/i.exec(html); return m ? htmlToText(m[1]) : ''; }
// ---- AZLyrics (адрес собирается из имён, только латиница) ----
export const azUrl = (artist, title) => {
    const f = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const a = f(artist), t = f(title);
    return a && t ? `https://www.azlyrics.com/lyrics/${a}/${t}.html` : '';
};
export function extractAz(html) { const m = /Sorry about that\.\s*-->([\s\S]*?)<\/div>/i.exec(html); return m ? htmlToText(m[1]) : ''; }
// ---- общий разбор для русскоязычных сайтов: ссылка по тексту → страница → самый «похожий на стихи» блок ----
export function linksByText(html, origin, title, artist) {
    const want = norm(title), who = norm(artist);
    const out = [];
    const re = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html))) {
        const text = norm(htmlToText(m[2]));
        if (!text || !text.includes(want))
            continue;
        // в ссылке «Артист - Название»: без имени артиста должно остаться само название, а не «название + ещё слова»
        const rest = who && text.includes(who) ? text.replace(who, '') : text;
        if (!titleMatch(rest, want) && rest !== want)
            continue;
        let href = m[1];
        if (href.startsWith('//'))
            href = 'https:' + href;
        else if (href.startsWith('/'))
            href = origin + href;
        else if (!/^https?:/.test(href))
            continue;
        if (!href.startsWith(origin))
            continue;
        out.push({ href, score: (who && text.includes(who) ? 2 : 0) + (text === want ? 1 : 0) });
    }
    return out.sort((a, b) => b.score - a.score).map(x => x.href);
}
export function bestTextBlock(html) {
    const cleaned = String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<nav[\s\S]*?<\/nav>|<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>|<form[\s\S]*?<\/form>/gi, '');
    let best = '', bestScore = 0;
    const re = /<(div|article|pre|section|p|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = re.exec(cleaned))) {
        const inner = m[2];
        if (/<(div|article|section|table)\b/i.test(inner))
            continue; // только самые вложенные блоки
        const links = (inner.match(/<a\b/gi) || []).length;
        const text = htmlToText(inner), lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 6 || lines.length > 220)
            continue;
        const avg = text.length / lines.length;
        if (avg > 90 || avg < 8)
            continue;
        const score = lines.length * 2 - links * 3 - Math.max(0, avg - 50);
        if (score > bestScore) {
            bestScore = score;
            best = text;
        }
    }
    return best;
}
const BAD = /cookie|javascript|реклама|все права защищены|войти|регистрац/i;
export const looksLikeLyrics = t => !!t && t.split('\n').filter(l => l.trim()).length >= 6 && !BAD.test(t.slice(0, 400));
const SITES = [
    { id: 'text-pesni', origin: 'https://text-pesni.com', search: q => [`https://text-pesni.com/search/?q=${q}`, `https://text-pesni.com/?s=${q}`] },
    { id: 'vse-pesni', origin: 'https://vse-pesni.com', search: q => [`https://vse-pesni.com/?s=${q}`, `https://vse-pesni.com/search/?q=${q}`] },
];
// fetchText(url) → строка HTML/JSON или '' при ошибке. Возвращает { text, source } или null.
export async function webLyrics(artist, title, fetchText, { skip = [] } = {}) {
    const tryRun = async (id, fn) => { if (skip.includes(id))
        return null; try {
        const text = await fn();
        return text && text.length > 40 ? { text, source: id } : null;
    }
    catch {
        return null;
    } };
    const q = encodeURIComponent(`${artist} ${title}`.trim()), cyr = /[а-яё]/i.test(artist + title);
    const jobs = [
        ['genius', async () => {
                const j = JSON.parse(await fetchText('https://genius.com/api/search/multi?per_page=5&q=' + q) || 'null');
                const url = pickGeniusHit(j, artist, title);
                return url ? extractGenius(await fetchText(url)) : '';
            }],
        ['lyricscom', async () => {
                if (cyr)
                    return '';
                const url = pickLyricsCom(await fetchText(`https://www.lyrics.com/serp.php?st=${q}&qtype=2`), artist, title);
                return url ? extractLyricsCom(await fetchText(url)) : '';
            }],
        ['azlyrics', async () => { const url = cyr ? '' : azUrl(artist, title); return url ? extractAz(await fetchText(url)) : ''; }],
        ...SITES.map(s => [s.id, async () => {
                for (const su of s.search(q)) {
                    const links = linksByText(await fetchText(su), s.origin, title, artist).slice(0, 2);
                    for (const l of links) {
                        const t = bestTextBlock(await fetchText(l));
                        if (looksLikeLyrics(t))
                            return t;
                    }
                }
                return '';
            }]),
    ];
    // русские песни — сначала русскоязычные сайты, остальные — как есть
    if (cyr)
        jobs.sort((a, b) => (['text-pesni', 'vse-pesni'].includes(b[0]) ? 1 : 0) - (['text-pesni', 'vse-pesni'].includes(a[0]) ? 1 : 0));
    for (const [id, fn] of jobs) {
        const r = await tryRun(id, fn);
        if (r)
            return r;
    }
    return null;
}
