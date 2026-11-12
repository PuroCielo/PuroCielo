import { audio, current, isPlaying, next, prev, seek, toggle } from './player.js';
import { on, state, toggleLike } from './state.js';
import { icon } from './icons.js';
import { esc, fmtTime } from './util.js';
import { isNative } from './native.js';
import { toast } from './ui.js';

// Мини-плеер в отдельном окошке (компьютер): обложка, название и кнопки.
// В Chrome и Edge окно держится поверх остальных программ (Document Picture-in-Picture);
// в других браузерах открывается обычное маленькое окно.
let win = null;
export const canMiniWindow = () => !isNative && typeof window !== 'undefined' && (('documentPictureInPicture' in window) || matchMedia('(pointer: fine)').matches);
export const miniWindowOpen = () => !!win && !win.closed;
const CSS = `
*{box-sizing:border-box;margin:0}html,body{height:100%}
body{font-family:Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#0b0b0d;color:#fff;overflow:hidden;user-select:none}
.bg{position:fixed;inset:-25%;background-size:cover;background-position:center;filter:blur(50px) saturate(1.4);opacity:.55}
.dim{position:fixed;inset:0;background:linear-gradient(180deg,rgba(9,9,11,.25),rgba(9,9,11,.82))}
.box{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px}
.cov{width:min(58vw,46vh);aspect-ratio:1;border-radius:16px;background:#222 center/cover;box-shadow:0 18px 50px rgba(0,0,0,.55);flex:none;display:grid;place-items:center;color:rgba(255,255,255,.4)}
.cov svg{width:38%;height:38%}
.t{width:100%;text-align:center;min-width:0}
.t b{display:block;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t span{display:block;font-size:13px;opacity:.72;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{width:100%;display:flex;align-items:center;gap:8px;font-size:11px;opacity:.85;font-variant-numeric:tabular-nums}
.bar input{flex:1;accent-color:#fff;height:4px;min-width:0}
.ctl{display:flex;align-items:center;gap:14px}
button{border:0;background:none;color:#fff;cursor:pointer;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;transition:background .15s,transform .15s}
button:hover{background:rgba(255,255,255,.14)}button:active{transform:scale(.94)}
button svg{width:22px;height:22px}
.pp{width:52px;height:52px;background:#fff;color:#111}.pp:hover{background:#fff}.pp svg{width:24px;height:24px}
.like.on{color:#ff5a79}
.empty{opacity:.7;font-size:14px;text-align:center;padding:0 12px}
@media (max-height:260px){.cov{display:none}}
@media (max-height:170px){.bar{display:none}}
`;
function draw() {
    if (!miniWindowOpen())
        return;
    const d = win.document, t = current(), $ = s => d.querySelector(s);
    if (!t) {
        $('.box').innerHTML = `<div class="empty">Ничего не играет.<br>Включите песню в плеере.</div>`;
        $('.bg').style.backgroundImage = '';
        d.title = 'Puro Cielo';
        return;
    }
    if ($('.box').dataset.id !== t.id) {
        $('.box').dataset.id = t.id;
        $('.box').innerHTML = `
      <div class="cov" ${t.cover ? `style="background-image:url('${t.cover}')"` : ''}>${t.cover ? '' : icon('note')}</div>
      <div class="t"><b>${esc(t.title)}</b><span>${esc(t.artist || '')}</span></div>
      <div class="bar"><span class="cur">0:00</span><input type="range" min="0" max="1000" value="0" aria-label="Перемотка"><span class="dur">0:00</span></div>
      <div class="ctl"><button class="like" data-a="like" aria-label="Нравится"></button><button data-a="prev" aria-label="Предыдущий">${icon('prev')}</button><button class="pp" data-a="toggle" aria-label="Играть / пауза"></button><button data-a="next" aria-label="Следующий">${icon('next')}</button><button data-a="back" aria-label="Открыть плеер" title="Открыть плеер">${icon('chev-up')}</button></div>`;
        $('.bg').style.backgroundImage = t.cover ? `url('${t.cover}')` : '';
        d.title = `${t.title} — ${t.artist || 'Puro Cielo'}`;
    }
    $('.pp').innerHTML = icon(isPlaying() ? 'pause' : 'play');
    const liked = state.likes.has(t.id), lk = $('.like');
    lk.classList.toggle('on', liked);
    lk.innerHTML = icon(liked ? 'heart-fill' : 'heart');
    tick();
}
function tick() {
    if (!miniWindowOpen())
        return;
    const d = win.document, r = d.querySelector('.bar input');
    if (!r)
        return;
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    if (!r.matches(':active'))
        r.value = dur ? Math.round(audio.currentTime / dur * 1000) : 0;
    d.querySelector('.cur').textContent = fmtTime(audio.currentTime || 0);
    d.querySelector('.dur').textContent = fmtTime(dur);
}
function build(w) {
    const d = w.document;
    d.documentElement.lang = 'ru';
    d.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Puro Cielo</title><style>${CSS}</style>`;
    d.body.innerHTML = `<div class="bg"></div><div class="dim"></div><div class="box"></div>`;
    d.addEventListener('click', e => {
        const b = e.target.closest('[data-a]');
        if (!b)
            return;
        const a = b.dataset.a, t = current();
        if (a === 'toggle')
            toggle();
        else if (a === 'next')
            next();
        else if (a === 'prev')
            prev();
        else if (a === 'like' && t)
            toggleLike(t.id);
        else if (a === 'back') {
            try {
                window.focus();
            }
            catch { /* ignore */ }
            w.close();
        }
    });
    d.addEventListener('input', e => { if (e.target.matches('.bar input') && isFinite(audio.duration))
        seek(e.target.value / 1000 * audio.duration); });
    d.addEventListener('keydown', e => { if (e.code === 'Space') {
        e.preventDefault();
        toggle();
    }
    else if (e.code === 'ArrowRight')
        next();
    else if (e.code === 'ArrowLeft')
        prev(); });
    const closed = () => { win = null; document.documentElement.classList.remove('mini-win'); };
    w.addEventListener('pagehide', closed);
    w.addEventListener('unload', closed);
}
export async function toggleMiniWindow() {
    if (miniWindowOpen()) {
        win.close();
        win = null;
        document.documentElement.classList.remove('mini-win');
        return;
    }
    let w = null;
    if ('documentPictureInPicture' in window) {
        try {
            w = await window.documentPictureInPicture.requestWindow({ width: 300, height: 400 });
        }
        catch { /* запрещено или не поддерживается — обычное окно */ }
    }
    if (!w) {
        try {
            w = window.open('', 'puro-mini', 'popup=yes,width=300,height=420');
        }
        catch { /* ignore */ }
    }
    if (!w)
        return toast('Браузер не дал открыть окошко. Разрешите всплывающие окна для этого сайта.', 'err', 5000);
    win = w;
    build(w);
    document.documentElement.classList.add('mini-win');
    draw();
}
for (const e of ['track', 'state', 'likes', 'covers', 'track-meta'])
    on(e, draw);
audio.addEventListener('timeupdate', tick);
audio.addEventListener('play', draw);
audio.addEventListener('pause', draw);
if (typeof window !== 'undefined')
    window.addEventListener('pagehide', () => { if (miniWindowOpen())
        win.close(); });
