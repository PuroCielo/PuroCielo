import { on, state } from './state.js';
import { audio, current } from './player.js';
import { icon } from './icons.js';

// Дополнительные эффекты фона: пластинка (крутится, пока играет), поднимающиеся частицы,
// мягкое свечение от обложки текущего трека, и заставка при запуске.
const $ = s => document.querySelector(s);
export function initBgFx() {
    const vinyl = $('#bg-vinyl'), parts = $('#bg-parts'), cover = $('#bg-cover');
    if (vinyl)
        vinyl.innerHTML = `<div class="v-disc"><i class="v-groove g1"></i><i class="v-groove g2"></i><i class="v-groove g3"></i><div class="v-label">${icon('tower')}</div></div><div class="v-arm"></div>`;
    if (parts) {
        let h = '';
        for (let i = 0; i < 16; i++) {
            const x = (i * 6.3 + Math.random() * 4) % 100, d = 14 + Math.random() * 18, dl = -Math.random() * d, s = 6 + Math.random() * 14;
            h += `<i style="left:${x.toFixed(1)}%;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;animation-duration:${d.toFixed(1)}s;animation-delay:${dl.toFixed(1)}s"></i>`;
        }
        parts.innerHTML = h;
    }
    const sync = () => document.documentElement.classList.toggle('is-playing', !audio.paused && !audio.ended && !!current());
    for (const e of ['play', 'pause', 'ended', 'emptied'])
        audio.addEventListener(e, sync);
    const paintCover = () => { const t = current(); if (cover) {
        cover.style.backgroundImage = t?.cover ? `url("${t.cover}")` : '';
        cover.classList.toggle('on', !!t?.cover);
    } sync(); };
    on('track', paintCover);
    on('state', sync);
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
