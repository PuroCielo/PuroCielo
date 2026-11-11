import { on, state } from './state.js';
import { audio, current } from './player.js';
import { icon } from './icons.js';
// Фон по теме. Тёмная: почти чёрный и одно мягкое свечение в цвет обложки. Светлая: свет от самой обложки
// (она сильно размыта и медленно плывёт). Больше на фоне ничего нет.
const $ = s => document.querySelector(s);
const GRAPHITE = ['#5b5d66', '#3d3f47', '#7a7c86', '#2c2d33'];
// ---------- цвета обложки ----------
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn)
        return [0, 0, l];
    const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}
const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
// 4 цвета: самые «весомые» оттенки обложки, приглушённые до благородной яркости
export function paletteFrom(url) {
    return new Promise(resolve => {
        if (!url)
            return resolve(null);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = c.height = 32;
                const x = c.getContext('2d', { willReadFrequently: true });
                x.drawImage(img, 0, 0, 32, 32);
                const px = x.getImageData(0, 0, 32, 32).data, bins = new Map();
                for (let i = 0; i < px.length; i += 4) {
                    const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
                    if (l < .08 || l > .95)
                        continue;
                    const k = s < .12 ? 'grey' : Math.round(h / 24) % 15;
                    const w = s < .12 ? .25 : .4 + s;
                    const b = bins.get(k) || { w: 0, h: 0, s: 0, l: 0, n: 0 };
                    b.w += w;
                    b.h += h;
                    b.s += s;
                    b.l += l;
                    b.n++;
                    bins.set(k, b);
                }
                const top = [...bins.values()].sort((a, b) => b.w - a.w).slice(0, 4).map(b => [b.h / b.n, b.s / b.n, b.l / b.n]);
                if (!top.length)
                    return resolve(null);
                while (top.length < 4)
                    top.push([(top[0][0] + 40 * top.length) % 360, top[0][1] * .8, top[0][2]]);
                resolve(top.map(([h, s, l], i) => hsl(h, Math.min(.85, s * 1.15 + .05), Math.min(.6, Math.max(.28, l * (i === 3 ? .7 : 1))))));
            }
            catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}
export function initBgFx() {
    const cover = $('#bg-cover'), root = document.documentElement;
    const sync = () => root.classList.toggle('is-playing', !audio.paused && !audio.ended && !!current());
    for (const e of ['play', 'pause', 'ended', 'emptied'])
        audio.addEventListener(e, sync);
    let lastUrl = null;
    const setPalette = cols => {
        (cols || GRAPHITE).forEach((v, i) => root.style.setProperty(`--c${i + 1}`, v));
        root.classList.toggle('has-glow', !!cols);
    };
    const paintCover = async () => {
        const t = current(), url = state.settings.bgCover !== false ? t?.cover || null : null;
        if (cover) {
            cover.style.backgroundImage = t?.cover ? `url("${t.cover}")` : '';
            cover.classList.toggle('on', !!t?.cover);
        }
        sync();
        if (url === lastUrl)
            return;
        lastUrl = url;
        const cols = await paletteFrom(url);
        if (url === lastUrl)
            setPalette(cols);
    };
    setPalette(null);
    on('track', paintCover);
    on('state', sync);
    on('settings', k => { if (k === 'bgCover' || k === 'all') {
        lastUrl = undefined;
        paintCover();
    } });
}
const greet = () => { const h = new Date().getHours(); return (h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер') + ', ' + state.profile.name; };
export function runSplash() {
    const el = $('#splash');
    if (!el)
        return;
    if (!state.settings.splash) {
        el.remove();
        return;
    }
    $('#splash-mark').innerHTML = icon('tower');
    $('#splash-hi').textContent = greet();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 800); }, 1900);
}
