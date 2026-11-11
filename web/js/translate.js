import { lyGet, lySet } from './db.js';
import { emit, state } from './state.js';
import { isEn } from './i18n.js';

// Перевод текста песни строчкой под оригиналом.
// Сервис — MyMemory (бесплатно, без ключа, можно прямо из браузера). Лимит у него ~5000 символов в день
// на пользователя — это несколько песен; готовые переводы запоминаются и повторно не запрашиваются.
const API = 'https://api.mymemory.translated.net/get';
const CHUNK = 450; // MyMemory принимает до 500 байт за запрос

// Язык песни по буквам (автоопределение у MyMemory не работает)
export function detectLang(text) {
    const s = String(text || '');
    const count = re => (s.match(re) || []).length;
    const cyr = count(/[а-яё]/gi), lat = count(/[a-z]/gi), ko = count(/[가-힯]/g), ja = count(/[぀-ヿ]/g), zh = count(/[一-鿿]/g);
    const max = Math.max(cyr, lat, ko, ja, zh);
    if (!max)
        return '';
    if (max === ko)
        return 'ko';
    if (max === ja || (zh && ja))
        return 'ja';
    if (max === zh)
        return 'zh-CN';
    if (max === cyr)
        return /[їієґ]/i.test(s) ? 'uk' : 'ru';
    if (/[ñ¿¡]/i.test(s))
        return 'es';
    if (/[ãõ]/i.test(s) || /\b(você|não)\b/i.test(s))
        return 'pt';
    if (/[äöüß]/i.test(s))
        return 'de';
    if (/[èêëçàâœ]/i.test(s) && /\b(je|tu|le|la|les|et|est|pas)\b/i.test(s))
        return 'fr';
    return 'en';
}
export const targetLang = () => (isEn() ? 'en' : 'ru');
const lyricLines = ly => ly.type === 'synced' ? ly.lines.map(l => l.text || '') : String(ly.text || '').split('\n');
export function canTranslate(ly) {
    if (!ly)
        return false;
    const src = detectLang(lyricLines(ly).join('\n'));
    return !!src && src !== targetLang();
}
const mem = new Map(); // ключ → массив переводов строк (по индексу строки)
const keyOf = (t, ly) => `tr|${targetLang()}|${t.id}|${lyricLines(ly).length}`;
export function cachedTranslation(t) {
    const ly = t && t.lyrics;
    return ly ? mem.get(keyOf(t, ly)) || null : null;
}
const pending = new Set();
async function ask(q, pair) {
    const r = await fetch(`${API}?${new URLSearchParams({ q, langpair: pair })}`);
    if (!r.ok)
        throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.responseStatus && +d.responseStatus !== 200)
        throw new Error(String(d.responseDetails || d.responseStatus));
    return String(d.responseData?.translatedText || '');
}
// Переводит строки кусками; если сервис склеил строки — переводит этот кусок построчно
async function translateLines(lines, pair) {
    const out = new Array(lines.length).fill('');
    const idx = lines.map((l, i) => (l.trim() ? i : -1)).filter(i => i >= 0);
    let group = [];
    const flush = async () => {
        if (!group.length)
            return;
        const res = (await ask(group.map(i => lines[i].trim()).join('\n'), pair)).split('\n');
        if (res.length === group.length)
            group.forEach((i, k) => { out[i] = res[k].trim(); });
        else
            for (const i of group)
                out[i] = (await ask(lines[i].trim(), pair)).trim();
        group = [];
    };
    let size = 0;
    for (const i of idx) {
        const len = new TextEncoder().encode(lines[i]).length + 1;
        if (size + len > CHUNK) {
            await flush();
            size = 0;
        }
        group.push(i);
        size += len;
    }
    await flush();
    return out;
}
export async function loadTranslation(t) {
    const ly = t && t.lyrics;
    if (!ly || !canTranslate(ly))
        return null;
    const key = keyOf(t, ly);
    if (mem.has(key))
        return mem.get(key);
    if (pending.has(key))
        return null;
    pending.add(key);
    try {
        const saved = await lyGet(key).catch(() => null);
        let tr = saved && Array.isArray(saved.tr) ? saved.tr : null;
        if (!tr) {
            const lines = lyricLines(ly);
            tr = await translateLines(lines, `${detectLang(lines.join('\n'))}|${targetLang()}`);
            if (tr.some(Boolean))
                lySet(key, { tr, at: Date.now() });
        }
        mem.set(key, tr);
        emit('translation', t);
        return tr;
    }
    catch (e) {
        emit('translation-error', String(e && e.message || e));
        return null;
    }
    finally {
        pending.delete(key);
    }
}
