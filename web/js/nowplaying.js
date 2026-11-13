import { cachedTranslation, canTranslate, loadTranslation } from './translate.js';
import { P, audio, clearUpcoming, current, cycleRepeat, getAnalyser, isPlaying, next, playTrackInQueue, prev, removeFromQueue, seek, setVolume, toggle, toggleMute, toggleShuffle } from './player.js';
import { derived, emit, getTrack, hasOwnCover, on, save, setTrackCover, state, toggleLike } from './state.js';
import { ensureLyrics, isFoundOnline, rawLyrics, rejectLyrics, setManualLyrics } from './lyrics-auto.js';
import { openMenu, openModal, pickImage, toast } from './ui.js';
import { icon } from './icons.js';
import { activeLine } from './lrc.js';
import { $, clamp, esc, fmtTime } from './util.js';
import { albumLink, artistLinks, artistsOf, cov } from './views.js';
import { trackMenu } from './actions.js';
import { canMiniWindow, toggleMiniWindow } from './miniwin.js';
import { revealElement } from './motion.js';

const mini = $('#mini'), np = $('#np'), lyBox = $('#np-lyrics'), qBox = $('#np-queue');
const miniSeek = $('#mini-seek'), npSeek = $('#np-seek'), miniVol = $('#mini-vol'), npVol = $('#np-vol');
const isDesktop = () => matchMedia('(min-width: 900px)').matches;
let npOpen = false, dragging = 0;
// ---------- формат технической информации ----------
export const fmtSR = sr => sr ? `${(sr / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',')} кГц` : '';
export const fmtBR = t => t.bitrate ? `${t.approx ? '≈ ' : ''}${Math.round(t.bitrate).toLocaleString('ru-RU')} кбит/с` : '';
export function techParts(t) {
    const p = [];
    if (t.codec)
        p.push(t.codec);
    if (t.bits && ['FLAC', 'WAV', 'ALAC'].includes(t.codec))
        p.push(`${t.bits} бит`);
    if (t.sampleRate)
        p.push(fmtSR(t.sampleRate));
    if (t.bitrate)
        p.push(fmtBR(t));
    return p;
}
// ---------- иконки в статических кнопках ----------
const setIc = (id, name) => { const el = document.getElementById(id); if (el)
    el.innerHTML = icon(name); };
function initIcons() {
    [['m-shuffle', 'shuffle'], ['m-prev', 'prev'], ['m-next', 'next'], ['m-repeat', 'repeat'], ['m-like', 'heart'], ['m-lyrics', 'lyrics'], ['m-queue', 'queue'], ['m-expand', 'chev-up'], ['m-pip', 'pip'],
        ['mm-next', 'next'], ['np-close', 'chev-down'], ['np-more', 'more'], ['np-like', 'heart'], ['n-shuffle', 'shuffle'], ['n-prev', 'prev'], ['n-next', 'next'], ['n-repeat', 'repeat'],
        ['n-vol-hi', 'vol-high'], ['np-edit', 'edit'], ['np-pane-toggle', 'lyrics']].forEach(([a, b]) => setIc(a, b));
    ['m-play', 'mm-play', 'n-play'].forEach(id => setIc(id, 'play'));
    syncVolume();
    syncTheme();
}
const syncTheme = () => setIc('np-theme', state.theme === 'dark' ? 'sun' : 'moon');
// ---------- диапазоны ----------
const paint = el => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
function bindSeek(el) {
    el.addEventListener('pointerdown', () => { dragging++; });
    const end = () => { if (dragging)
        dragging = Math.max(0, dragging - 1); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('input', () => {
        paint(el);
        const d = audio.duration || 0, t = (el.value / 1000) * d;
        for (const [c, s] of [['mini-cur', miniSeek], ['np-cur', npSeek]]) {
            if (s !== el) {
                s.value = el.value;
                paint(s);
            }
            $('#' + c).textContent = fmtTime(t);
        }
    });
    el.addEventListener('change', () => { const d = audio.duration || 0; seek((el.value / 1000) * d); dragging = 0; });
}
function bindVol(el) {
    el.addEventListener('input', () => setVolume(el.value / 100));
}
function syncVolume() {
    const v = P.muted ? 0 : audio.volume;
    for (const el of [miniVol, npVol]) {
        el.value = Math.round(v * 100);
        paint(el);
    }
    const ic = v === 0 ? 'vol-mute' : v < 0.5 ? 'vol-low' : 'vol-high';
    setIc('m-mute', ic);
    setIc('n-mute', ic);
}
// ---------- обновление по состоянию ----------
function syncPlay() {
    const pl = isPlaying(), cur = current();
    for (const id of ['m-play', 'mm-play', 'n-play']) {
        const b = document.getElementById(id);
        b.innerHTML = icon(pl ? 'pause' : 'play');
        b.setAttribute('aria-label', pl ? 'Пауза' : 'Играть');
    }
    document.body.classList.toggle('is-playing', pl);
    $('#np-art').classList.toggle('paused', !pl);
    if (pl)
        startLoop();
    if (!cur)
        return;
}
function syncModes() {
    for (const id of ['m-shuffle', 'n-shuffle']) {
        const b = document.getElementById(id);
        b.classList.toggle('on', P.shuffle);
        b.setAttribute('aria-pressed', P.shuffle);
    }
    for (const id of ['m-repeat', 'n-repeat']) {
        const b = document.getElementById(id);
        b.classList.toggle('on', P.repeat !== 'off');
        b.innerHTML = icon(P.repeat === 'one' ? 'repeat-one' : 'repeat');
        b.setAttribute('aria-label', 'Повтор: ' + ({ off: 'выкл', all: 'все', one: 'один' }[P.repeat]));
    }
    renderQueue();
}
export function syncLikeBtns() {
    const t = current(), on_ = !!t && state.likes.has(t.id);
    for (const id of ['m-like', 'np-like']) {
        const b = document.getElementById(id);
        b.classList.toggle('on', on_);
        b.innerHTML = icon(on_ ? 'heart-fill' : 'heart');
    }
}
let displayedTrack = null;
function renderTrack(t) {
    const changed = !!t && displayedTrack !== t.id;
    displayedTrack = t?.id || null;
    mini.hidden = !t;
    document.body.classList.toggle('has-mini', !!t);
    if (!t) {
        closeNP();
        return;
    }
    $('#mini-cover').innerHTML = cov(t.cover, t._albumKey || t.id);
    $('#mini-title').textContent = t.title;
    $('#mini-artist').innerHTML = artistLinks(artistsOf(t)) + (t.album ? ' — ' + esc(t.album) : '');
    const tp = techParts(t);
    $('#mini-tech').innerHTML = tp.map(x => `<span>${esc(x)}</span>`).join('');
    $('#np-cover').innerHTML = cov(t.cover, t._albumKey || t.id);
    $('#np-bg').src = t.cover || '';
    $('#np-bg').style.display = t.cover ? '' : 'none';
    $('#np-title').textContent = t.title;
    $('#np-artist').innerHTML = artistLinks(artistsOf(t));
    $('#np-album').innerHTML = [t.album ? albumLink(t) : '', esc(t.year || ''), esc(t.genre || '')].filter(Boolean).join(' · ');
    $('#np-chips').innerHTML = tp.map((x, i) => `<span class="chip-s ${i === 0 ? 'codec' : ''}">${esc(x)}</span>`).join('');
    $('#mini-dur').textContent = $('#np-dur').textContent = fmtTime(t.duration);
    if (changed) {
        ['mini-title', 'mini-artist', 'np-title', 'np-artist', 'np-cover'].forEach((id, i) => {
            if (id.startsWith('np-') && !npOpen) return;
            revealElement($('#' + id), { distance: 0, delay: i % 2 * 35, duration: 320 });
        });
    }
    ensureLyrics(t);
    syncLikeBtns();
    renderLyrics(t);
    renderQueue();
    syncPlay();
    document.title = `${t.title} — ${artistsOf(t).join(', ') || 'Puro Cielo'}`;
}
function syncMeta() {
    const d = audio.duration;
    if (isFinite(d))
        $('#mini-dur').textContent = $('#np-dur').textContent = fmtTime(d);
}
// ---------- Караоке ----------
let lines = [], lyEls = [], lastIdx = -2, lastWords = -1, userScrollUntil = 0, lyType = null, curOff = 0, wTimes = null, wLast = [];
function renderLyrics(t) {
    lines = [];
    lyEls = [];
    lastIdx = -2;
    lastWords = -1;
    lyType = null;
    wTimes = null;
    wLast = [];
    let ly = t?.lyrics;
    lyBox.scrollTop = 0;
    lyBox.classList.remove('plain');
    curOff = 0;
    if (!ly) {
        const loading = t && t._ly === 'loading';
        const missing = t?._ly === 'offline' ? 'Для поиска текста нужен интернет' : t?._ly === 'error' ? 'Поиск текста временно недоступен' : 'Текст не найден';
        lyBox.innerHTML = loading
            ? `<div class="ly-empty"><span class="ly-spin"></span><h3>Ищу текст…</h3></div>`
            : `<div class="ly-empty">${icon('lyrics')}<h3>${missing}</h3>${state.settings.autoLyrics ? '<button class="btn btn-soft sm" data-ly="retry">Искать снова</button>' : ''}<button class="btn btn-soft sm" data-ly="edit">${icon('edit')}Добавить текст</button></div>`;
        return;
    }
    lyType = ly.type;
    // перевод строчкой под оригиналом (если включён и уже загружен)
    const trOn = state.settings.lyTranslate && canTranslate(ly);
    const tr = trOn ? cachedTranslation(t) : null;
    if (trOn && !tr)
        loadTranslation(t);
    const trLine = i => (tr && tr[i] ? `<span class="ly-tr">${esc(tr[i])}</span>` : '');
    if (ly.type === 'plain') {
        lyBox.classList.add('plain');
        lyBox.innerHTML = `<div class="ly-plain">${esc(ly.text).split(/\n/).map((l, i) => l.trim() ? `<p>${l}${trLine(i)}</p>` : '<br>').join('')}</div>`;
        return;
    }
    lines = ly.lines;
    lyBox.innerHTML = `<div class="ly-pad"></div>${lines.map((l, i) => l.text
        ? `<p class="ly" data-i="${i}">${esc(l.text).split(' ').map(w => `<span class="w">${w}</span>`).join(' ')}${trLine(i)}</p>`
        : `<p class="ly gap" data-i="${i}"><span class="dots"><i></i><i></i><i></i></span></p>`).join('')}<div class="ly-pad"></div>`;
    lyEls = [...lyBox.querySelectorAll('.ly')];
}
function editLyrics() {
    const t = current();
    if (!t)
        return;
    openModal({ title: 'Текст песни', wide: true,
        html: `<p class="modal-text">Вставьте текст или загрузите файл <b>.lrc</b> / <b>.txt</b>. Если в тексте есть метки времени вида <code>[01:23.45]</code>, он будет идти как караоке.</p>
      <textarea class="input ly-area" id="ly-area" rows="12" placeholder="Текст песни…">${esc(rawLyrics(t))}</textarea>
      <input type="file" id="ly-file" accept=".lrc,.txt,text/plain" hidden>
      <div class="pe-btns"><button class="btn btn-soft sm" id="ly-pick">${icon('upload')}Из файла</button>${t.lyrics ? `<button class="btn btn-soft sm btn-danger" id="ly-del">${icon('trash')}Удалить текст</button>` : ''}</div>`,
        actions: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: async () => { await setManualLyrics(t, document.getElementById('ly-area').value); toast('Текст сохранён'); } }],
        onMount: api => {
            const area = document.getElementById('ly-area'), file = document.getElementById('ly-file');
            document.getElementById('ly-pick').onclick = () => file.click();
            file.onchange = async () => { const f = file.files[0]; if (f)
                area.value = await f.text(); };
            const d = document.getElementById('ly-del');
            if (d)
                d.onclick = async () => { await setManualLyrics(t, ''); toast('Текст удалён', 'info'); api.close?.(); };
        } });
}
// Времена слов внутри строки: если в .lrc есть метки слов — берём их, иначе делим строку пропорционально длине слов
function wordTimes(i) {
    const l = lines[i], next = lines[i + 1], ws = l.text.split(' ');
    const gap = next ? next.t - l.t : 6;
    // метки слов уже есть (enhanced LRC или выравнивание по звуку)
    if (l.words && l.words.length === ws.length)
        return l.words.map((w, k) => ({ a: w.t, b: w.b || (l.words[k + 1] ? l.words[k + 1].t : l.t + Math.min(gap, 4)), held: !!w.held }));
    const sing = clamp(l.text.length * 0.07 + 0.5, 1.2, 9), dur = Math.max(0.6, Math.min(sing, gap * 0.94));
    const wt = ws.map(w => Math.max(2, w.length)), sum = wt.reduce((x, y) => x + y, 0);
    let acc = 0;
    return wt.map(w => { const a = l.t + dur * acc / sum; acc += w; return { a, b: l.t + dur * acc / sum, held: false }; });
}
function updateLyrics(t, force) {
    if (lyType !== 'synced' || !lines.length)
        return;
    t -= curOff;
    const idx = activeLine(lines, t + 0.12);
    if (idx !== lastIdx || force) {
        lastIdx = idx;
        lastWords = -1;
        wTimes = null;
        wLast = [];
        lyEls.forEach((el, i) => {
            el.classList.toggle('active', i === idx);
            el.classList.toggle('past', i < idx);
            el.classList.toggle('wordsync', !!(lines[i].words && lines[i].words.length === lines[i].text.split(' ').length));
            el.dataset.d = Math.min(Math.abs(i - idx), 5);
            if (i !== idx)
                el.querySelectorAll('.w').forEach(w => w.style.removeProperty('--wp'));
        });
        const el = lyEls[idx];
        if (el && npOpen && Date.now() > userScrollUntil)
            lyBox.scrollTo({ top: el.offsetTop - lyBox.clientHeight * 0.5 + el.offsetHeight / 2, behavior: force ? 'auto' : 'smooth' });
    }
    const el = lyEls[idx];
    if (!el || el.classList.contains('gap') || !el.classList.contains('wordsync'))
        return; // как в Spotify: светится строка; по словам — только если в .lrc есть метки слов
    const ws = el.querySelectorAll('.w');
    if (!wTimes)
        wTimes = wordTimes(idx);
    // подсвечивается только слово, которое поётся сейчас; спетые чуть светлее, будущие приглушены
    let cur = -1;
    for (let k = 0; k < ws.length && wTimes[k]; k++)
        if (t >= wTimes[k].a)
            cur = k;
    if (cur !== wLast[0]) {
        wLast[0] = cur;
        ws.forEach((w, k) => { w.classList.toggle('cur', k === cur); w.classList.toggle('sung', k < cur); w.classList.toggle('held', k === cur && !!wTimes[k].held); });
    }
}
['wheel', 'touchmove'].forEach(ev => lyBox.addEventListener(ev, () => { userScrollUntil = Date.now() + 3500; }, { passive: true }));
lyBox.addEventListener('click', e => {
    if (e.target.closest('[data-ly="edit"]')) {
        editLyrics();
        return;
    }
    const p = e.target.closest('.ly');
    if (!p)
        return;
    const l = lines[+p.dataset.i];
    if (!l)
        return;
    seek(l.t);
    userScrollUntil = 0;
    if (audio.paused)
        toggle();
});
// ---------- Очередь ----------
function qRow(id, i, kind) {
    const t = getTrack(id);
    if (!t)
        return '';
    return `<div class="q-row ${kind}" data-qi="${i}" tabindex="0" role="button">
    <div class="q-cov">${cov(t.cover, t._albumKey || t.id)}${kind === 'now' ? '<span class="q-eq"><span class="eq"><i></i><i></i><i></i></span></span>' : ''}</div>
    <div class="q-text"><b>${esc(t.title)}</b><span>${esc(artistsOf(t).join(', '))}</span></div>
    <span class="q-time">${fmtTime(t.duration)}</span>
    <button class="icon-btn sm" data-qremove="${i}" aria-label="Убрать из очереди">${icon('close')}</button></div>`;
}
function renderQueue() {
    const q = P.queue;
    if (!q.length) {
        qBox.innerHTML = `<div class="ly-empty">${icon('queue')}<h3>Очередь пуста</h3><p>Запустите альбом, плейлист или трек — они появятся здесь.</p></div>`;
        return;
    }
    const before = q.slice(Math.max(0, P.idx - 15), P.idx), after = q.slice(P.idx + 1);
    qBox.innerHTML = `<div class="q-head"><h3>Очередь</h3><div class="q-tools">
      <button class="icon-btn ${P.shuffle ? 'on' : ''}" data-act="shuffle" aria-label="Перемешать">${icon('shuffle')}</button>
      <button class="icon-btn ${P.repeat !== 'off' ? 'on' : ''}" data-act="repeat" aria-label="Повтор">${icon(P.repeat === 'one' ? 'repeat-one' : 'repeat')}</button>
      ${after.length ? '<button class="btn btn-soft sm" data-qclear>Очистить</button>' : ''}</div></div>
    ${before.length ? `<div class="q-label">Ранее</div>${before.map((id, k) => qRow(id, P.idx - before.length + k, 'past')).join('')}` : ''}
    <div class="q-label">Сейчас играет</div>${qRow(q[P.idx], P.idx, 'now')}
    <div class="q-label">Далее${after.length ? ` · ${after.length}` : ''}</div>${after.length ? after.map((id, k) => qRow(id, P.idx + 1 + k, 'next')).join('') : '<p class="hint">Дальше ничего нет. Добавьте треки через меню «⋯».</p>'}`;
}
qBox.addEventListener('click', e => {
    if (e.target.closest('[data-qclear]'))
        return clearUpcoming();
    const rm = e.target.closest('[data-qremove]');
    if (rm) {
        e.stopPropagation();
        return removeFromQueue(+rm.dataset.qremove);
    }
    const act = e.target.closest('[data-act]');
    if (act)
        return act.dataset.act === 'shuffle' ? toggleShuffle() : cycleRepeat();
    const row = e.target.closest('[data-qi]');
    if (row)
        playTrackInQueue(+row.dataset.qi);
});
qBox.addEventListener('keydown', e => { if (e.key === 'Enter')
    e.target.closest?.('[data-qi]')?.click(); });
// ---------- Визуализатор ----------
const cv = $('#np-viz'), g = cv.getContext('2d');
const BARS = 56;
const levels = new Float32Array(BARS);
let freq = null, accent = '#F5F5F7', dpr = 1;
function sizeViz() { dpr = Math.min(2, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); }
new ResizeObserver(sizeViz).observe(cv);
function drawViz() {
    const an = getAnalyser(), w = cv.width, h = cv.height;
    let any = false;
    if (an && isPlaying()) {
        if (!freq)
            freq = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(freq);
    }
    else
        freq = null;
    g.clearRect(0, 0, w, h);
    const usable = (an ? an.frequencyBinCount : 256) * 0.62, gap = 3 * dpr, bw = (w - gap * (BARS - 1)) / BARS;
    if (bw <= 0)
        return false;
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, accent + '55');
    grad.addColorStop(1, accent);
    g.fillStyle = grad;
    for (let i = 0; i < BARS; i++) {
        let target = 0;
        if (freq) {
            const a = Math.floor(Math.pow(i / BARS, 1.7) * usable), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / BARS, 1.7) * usable));
            let s = 0;
            for (let k = a; k < b; k++)
                s += freq[k];
            target = s / (b - a) / 255;
            target = Math.pow(target, 1.25) * (0.75 + 0.5 * (i / BARS));
        }
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.55 : 0.12);
        if (levels[i] > 0.01)
            any = true;
        const bh = Math.max(3 * dpr, clamp(levels[i], 0, 1) * h), x = i * (bw + gap);
        g.beginPath();
        g.roundRect(x, h - bh, bw, bh, Math.min(bw / 2, 4 * dpr));
        g.fill();
    }
    return any;
}
const readAccent = () => { accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent; };
// ---------- главный цикл ----------
let raf = 0;
function frame() {
    const t = audio.currentTime, d = audio.duration || 0;
    if (!dragging) {
        const v = d ? Math.round((t / d) * 1000) : 0;
        for (const s of [miniSeek, npSeek]) {
            s.value = v;
            paint(s);
        }
        $('#mini-cur').textContent = $('#np-cur').textContent = fmtTime(t);
    }
    $('#mini-thin-fill').style.width = (d ? (t / d) * 100 : 0) + '%';
    if (npOpen) {
        updateLyrics(t);
        return state.settings.visualizer ? drawViz() : false;
    }
    return false;
}
function startLoop() { if (raf)
    return; const loop = () => { const more = frame(); raf = isPlaying() || more ? requestAnimationFrame(loop) : 0; }; raf = requestAnimationFrame(loop); }
// ---------- открытие / закрытие ----------
const lyricsOn = () => state.settings.showLyrics !== false;
export function setPane(p) {
    if (p === 'lyrics' && !lyricsOn())
        p = 'player';
    const changed = np.dataset.pane !== p;
    if (changed && p === 'lyrics' && current()) ensureLyrics(current(), { retryMiss: true });
    np.dataset.pane = p;
    if (changed && npOpen) revealElement(np.querySelector(p === 'queue' ? '.pane-queue' : p === 'lyrics' ? '.pane-lyrics' : '.np-player'), { distance: 0, duration: 280 });
    $('#np-pane-toggle')?.classList.toggle('on', p !== 'player');
}
// Режим «без текста»: правая часть гаснет, плеер плавно переезжает в центр
function centerShift() {
    const body = np.querySelector('.np-body'), side = np.querySelector('.np-side');
    if (!body || !side)
        return;
    const gap = parseFloat(getComputedStyle(body).columnGap) || 0;
    body.style.setProperty('--shift', isDesktop() ? ((side.offsetWidth + gap) / 2).toFixed(1) + 'px' : '0px');
}
function applyLyricsMode(redo) {
    const on = lyricsOn();
    centerShift();
    np.classList.toggle('nolyr', !on);
    const b = $('#np-lyr-toggle');
    if (b) {
        if (isDesktop())
            b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
        b.setAttribute('aria-label', on ? 'Скрыть текст' : 'Показать текст');
        b.title = b.getAttribute('aria-label');
    }
    setPane(np.dataset.pane === 'lyrics' && !on ? 'player' : np.dataset.pane);
    if (on && redo && current()) {
        renderLyrics(current());
        updateLyrics(audio.currentTime, true);
    }
}
export function openNP(pane) {
    if (!current())
        return;
    ensureLyrics(current(), { retryMiss: true });
    renderLyrics(current());
    if (pane)
        setPane(pane);
    else
        setPane(isDesktop() ? np.dataset.pane : 'player'); // на телефоне плеер открывается с обложки
    npOpen = true;
    np.classList.add('open');
    np.setAttribute('aria-hidden', 'false');
    document.body.classList.add('np-open');
    readAccent();
    sizeViz();
    updateLyrics(audio.currentTime, true);
    startLoop();
    frame();
    setTimeout(() => $('#np-close').focus({ preventScroll: true }), 300);
}
export function closeNP() {
    if (!npOpen)
        return false;
    npOpen = false;
    np.classList.remove('open');
    np.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('np-open');
    return true;
}
export const isNPOpen = () => npOpen;
addEventListener('resize', () => { setPane(np.dataset.pane); centerShift(); });
// ---------- init ----------
export function initPlayerUI() {
    initIcons();
    $('#np-lyr-toggle').innerHTML = icon('lyrics');
    bindSeek(miniSeek);
    bindSeek(npSeek);
    bindVol(miniVol);
    if (canMiniWindow() && $('#m-pip'))
        $('#m-pip').hidden = false;
    bindVol(npVol);
    setPane('player');
    syncModes();
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || b.closest('#np-queue'))
            return;
        switch (b.dataset.act) {
            case 'toggle':
                e.stopPropagation();
                toggle();
                break;
            case 'next':
                e.stopPropagation();
                next();
                break;
            case 'prev':
                prev();
                break;
            case 'shuffle':
                toggleShuffle();
                break;
            case 'repeat':
                cycleRepeat();
                break;
            case 'mute':
                toggleMute();
                break;
            case 'like': {
                const t = current();
                if (t)
                    toggleLike(t.id);
                break;
            }
            case 'open':
                openNP('player');
                break;
            case 'mini-window':
                toggleMiniWindow();
                break;
            case 'open-lyrics':
                openNP('lyrics');
                break;
            case 'open-queue':
                if (npOpen && np.dataset.pane === 'queue')
                    setPane(isDesktop() ? 'lyrics' : 'player');
                else if (npOpen)
                    setPane('queue');
                else
                    openNP('queue');
                break;
            default: break;
        }
    });
    $('#mini-open').addEventListener('click', e => { if (e.target.closest('input,a'))
        return; openNP(); });
    $('#mini-open').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === e.currentTarget)
        openNP(); });
    $('#np-close').addEventListener('click', closeNP);
    // на телефоне: кнопка вверху справа переключает плеер ↔ текст (из очереди — обратно к плееру)
    $('#np-pane-toggle').addEventListener('click', () => {
        setPane(np.dataset.pane === 'player' ? 'lyrics' : 'player');
        if (np.dataset.pane === 'lyrics')
            updateLyrics(audio.currentTime, true);
    });
    // текст и обложка трека (карандаш рядом с лайком)
    $('#np-edit').addEventListener('click', e => {
        const t = current();
        if (!t)
            return;
        openMenu(e.currentTarget, [
            { icon: 'lyrics', label: t.lyrics ? 'Изменить текст' : 'Добавить текст', onClick: () => editLyrics() },
            ...(isFoundOnline(t.lyrics) ? [{ icon: 'close', label: 'Это не тот текст', onClick: async () => {
                        toast('Ищу другой текст…', 'info', 2000);
                        const ok = await rejectLyrics(t);
                        toast(ok ? 'Нашёл другой вариант' : 'Другого текста не нашлось — можно добавить свой через карандаш', ok ? 'info' : 'warn');
                    } }] : []),
            { icon: 'upload', label: 'Обложка трека…', onClick: async () => { const url = await pickImage(); if (url) {
                    setTrackCover(t.id, url);
                    toast('Обложка трека обновлена');
                } } },
            ...(hasOwnCover(t.id) ? [{ icon: 'refresh', label: 'Вернуть обложку из файла', onClick: () => setTrackCover(t.id, null) }] : []),
        ]);
    });
    $('#np-lyr-toggle').addEventListener('click', () => {
        if (!isDesktop()) { // на телефоне — к тексту
            setPane('lyrics');
            updateLyrics(audio.currentTime, true);
            return;
        }
        state.settings.showLyrics = !lyricsOn();
        save();
        emit('settings', 'showLyrics');
    });
    on('settings', k => { if (k === 'showLyrics' || k === 'all')
        applyLyricsMode(true); });
    applyLyricsMode(false);
    $('#np-more').addEventListener('click', e => {
        const t = current();
        if (!t)
            return;
        const qOpen = np.dataset.pane === 'queue';
        const extra = [{ icon: 'queue', label: qOpen ? 'Скрыть очередь' : 'Очередь', onClick: () => setPane(qOpen ? (isDesktop() && lyricsOn() ? 'lyrics' : 'player') : 'queue') }];
        if (canTranslate(t.lyrics))
            extra.push({ icon: 'translate', label: state.settings.lyTranslate ? 'Скрыть перевод' : 'Перевод текста', onClick: () => {
                    state.settings.lyTranslate = !state.settings.lyTranslate;
                    save();
                    renderLyrics(t);
                    updateLyrics(audio.currentTime, true);
                } });
        trackMenu(e.currentTarget, t.id, { np: true, extra });
    });
    // свайп вниз по Now Playing на мобильных
    let y0 = null;
    np.addEventListener('touchstart', e => { y0 = e.target.closest('.pane') ? null : e.touches[0].clientY; }, { passive: true });
    np.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 110)
        closeNP(); y0 = null; }, { passive: true });
    on('track', renderTrack);
    // перевод загрузился — перерисовываем текст, если это всё ещё та же песня
    on('translation', t => { if (current()?.id === t.id) {
        renderLyrics(t);
        updateLyrics(audio.currentTime, true);
    } });
    on('translation-error', () => toast('Перевод сейчас недоступен (лимит бесплатного сервиса — несколько песен в день)', 'warn'));
    // своя обложка поменялась — обновляем плеер, фон и мини-плеер
    on('covers', () => { derived(); const t = current(); if (t)
        emit('track', t); });
    on('track-meta', t => { derived(); if (current()?.id === t.id)
        emit('track', t); });
    on('state', syncPlay);
    on('modes', syncModes);
    on('queue', renderQueue);
    on('volume', syncVolume);
    on('meta', syncMeta);
    on('seeked', () => { frame(); updateLyrics(audio.currentTime, true); });
    on('likes', syncLikeBtns);
    on('theme', () => { syncTheme(); readAccent(); });
    on('lyrics', t => { if (current()?.id === t.id) {
        renderTrack(t);
    } });
    on('lyrics-state', t => { if (current()?.id === t.id && !t.lyrics)
        renderLyrics(t); });
    syncPlay();
}

lyBox.addEventListener('click', e => {
    if (!e.target.closest('[data-ly="retry"]') || !current()) return;
    current()._lyAttempt = 0;
    ensureLyrics(current(), { retryMiss: true });
});
