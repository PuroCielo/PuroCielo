import * as i18n from './i18n.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const enc = encodeURIComponent;
export function fmtTime(s) {
    if (!isFinite(s) || s < 0)
        s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
export function fmtTotal(sec) {
    const m = Math.round(sec / 60), en = i18n.isEn();
    if (m < 60)
        return en ? `${m} min` : `${m} мин`;
    const h = Math.floor(m / 60);
    return en ? `${h} h ${m % 60} min` : `${h} ч ${m % 60} мин`;
}
export function plural(n, forms) {
    if (i18n.isEn() && i18n.EN_PLURAL[forms[0]])
        return `${n} ${i18n.EN_PLURAL[forms[0]][n === 1 ? 0 : 1]}`;
    const a = Math.abs(n) % 100, b = a % 10;
    const f = a > 10 && a < 20 ? forms[2] : b > 1 && b < 5 ? forms[1] : b === 1 ? forms[0] : forms[2];
    return `${n} ${f}`;
}
export function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
export function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ё/g, 'е').trim();
}
export function debounce(fn, ms = 120) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function shuffleArray(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const baseName = p => String(p).split(/[\\/]/).pop();
export const stripExt = n => n.replace(/\.[^./\\]+$/, '');
export const extOf = n => (n.match(/\.([^./\\]+)$/) || [, ''])[1].toLowerCase();
// псевдослучайный порядок, стабильный в пределах сессии
export const SESSION_SEED = (Math.random() * 4294967296) >>> 0;
export function seededShuffle(arr, seed) {
    const a = arr.slice();
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
