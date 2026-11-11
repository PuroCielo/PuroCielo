import { on, state } from './state.js';
import { audio, current, getAnalyser } from './player.js';
import { icon } from './icons.js';
// Фон по теме. Тёмная: почти чёрный и одно мягкое свечение в цвет обложки. Светлая: свет от самой обложки
// (она сильно размыта и медленно плывёт). Ноты, пластинка и звёздная пыль — по желанию, в настройках.
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
// ---------- звёздная пыль (canvas) ----------
function initDust(cv) {
    const ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, parts = [], tint = [255, 236, 200], last = 0, energy = 0, raf = 0;
    // мягкая светящаяся точка — рисуется один раз, дальше только копируется
    const sprite = document.createElement('canvas');
    const paintSprite = () => {
        sprite.width = sprite.height = 64;
        const g = sprite.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        const [r, gg, b] = tint;
        rg.addColorStop(0, `rgba(255,255,255,1)`);
        rg.addColorStop(.18, `rgba(${r},${gg},${b},.85)`);
        rg.addColorStop(.45, `rgba(${r},${gg},${b},.18)`);
        rg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        g.fillStyle = rg;
        g.fillRect(0, 0, 64, 64);
    };
    const make = (y) => ({ x: Math.random() * W, y: y ?? Math.random() * H, z: .25 + Math.random() * .75, ph: Math.random() * Math.PI * 2, sp: .4 + Math.random() * 1.4, dx: (Math.random() - .5) * .15 });
    const resize = () => {
        dpr = Math.min(1.5, devicePixelRatio || 1);
        W = cv.width = Math.round(innerWidth * dpr);
        H = cv.height = Math.round(innerHeight * dpr);
        const n = Math.round(Math.min(110, Math.max(40, (innerWidth * innerHeight) / 16000)));
        parts = Array.from({ length: n }, () => make());
    };
    const level = () => {
        const an = getAnalyser();
        if (!an || audio.paused)
            return 0;
        const d = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(d);
        let s = 0;
        for (let i = 1; i < 10; i++)
            s += d[i];
        return Math.max(0, s / 9 / 255 - .35) / .65; // басы, 0…1
    };
    const frame = (t) => {
        raf = requestAnimationFrame(frame);
        if (document.hidden || document.documentElement.classList.contains('no-bg-particles'))
            return;
        if (t - last < 28)
            return; // ~35 кадров в секунду хватает
        const dt = Math.min(80, t - last) / 16.7;
        last = t;
        const playing = !audio.paused && !audio.ended;
        energy += ((playing ? level() : 0) - energy) * .18;
        const light = document.documentElement.dataset.theme === 'light';
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
        const speed = (playing ? 1 : .35) * (1 + energy * 2.2) * dpr;
        for (const p of parts) {
            p.y -= p.sp * p.z * .32 * speed * dt;
            p.x += (p.dx + Math.sin(t / 4000 + p.ph) * .12) * p.z * dpr * dt;
            if (p.y < -20 * dpr) {
                Object.assign(p, make(H + 20 * dpr));
            }
            const tw = .55 + .45 * Math.sin(t / (900 + p.sp * 500) + p.ph);
            const a = (light ? .22 : .5) * p.z * tw * (playing ? 1 : .6) + energy * .35 * p.z;
            const size = (2.2 + p.z * 5.5) * (1 + energy * .9 * p.z) * dpr;
            ctx.globalAlpha = Math.min(1, a);
            ctx.drawImage(sprite, p.x - size, p.y - size, size * 2, size * 2);
        }
        ctx.globalAlpha = 1;
    };
    paintSprite();
    resize();
    addEventListener('resize', resize);
    if (!reduce)
        raf = requestAnimationFrame(frame);
    else
        frame(1000);
    return {
        setTint(css) { // искры чуть окрашены в главный цвет обложки
            const m = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(css || '');
            if (!m) {
                tint = [255, 236, 200];
            }
            else {
                const h = +m[1] / 360, s = Math.min(.55, +m[2] / 100), l = .82;
                const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
                tint = [f(0), f(8), f(4)];
            }
            paintSprite();
        },
    };
}
export function initBgFx() {
    const vinyl = $('#bg-vinyl'), cover = $('#bg-cover'), fx = $('.bg-fx'), dustCv = $('#bg-dust');
    if (vinyl)
        vinyl.innerHTML = `<div class="v-disc"><i class="v-groove g1"></i><i class="v-groove g2"></i><i class="v-groove g3"></i><div class="v-label">${icon('tower')}</div></div><div class="v-arm"></div>`;
    const dust = dustCv ? initDust(dustCv) : null;
    const sync = () => document.documentElement.classList.toggle('is-playing', !audio.paused && !audio.ended && !!current());
    for (const e of ['play', 'pause', 'ended', 'emptied'])
        audio.addEventListener(e, sync);
    let lastUrl = null;
    const setPalette = cols => {
        const c = cols || GRAPHITE;
        c.forEach((v, i) => document.documentElement.style.setProperty(`--c${i + 1}`, v));
        document.documentElement.classList.toggle('has-glow', !!cols);
        dust?.setTint(cols ? cols[0] : null);
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
