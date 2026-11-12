import { bumpPlay, emit, getTrack, on, pushRecent, save, state } from './state.js';
import { clamp, shuffleArray } from './util.js';
import { gainFor, guessGain, loadLoud, measure } from './loudness.js';

export const audio = new Audio();
audio.preload = 'auto';
export const P = {
    queue: [], // id[] в порядке воспроизведения
    orig: null, // исходный порядок (когда включён shuffle)
    idx: -1,
    shuffle: false,
    repeat: 'off', // off | all | one
    muted: false,
};
let actx, analyser, fadeGain, normGain, eqNodes = [];
export const getAnalyser = () => analyser;
// ---------- эквалайзер: 6 полос ----------
export const EQ_BANDS = [60, 230, 910, 3600, 9000, 14000];
export const EQ_PRESETS = {
    flat: { name: 'Без изменений', g: [0, 0, 0, 0, 0, 0] },
    bass: { name: 'Больше баса', g: [6, 4, 1, 0, 0, 0] },
    vocal: { name: 'Голос', g: [-2, -1, 2, 4, 2, 0] },
    treble: { name: 'Больше высоких', g: [0, 0, 0, 1, 4, 6] },
    loud: { name: 'Громко и ярко', g: [5, 2, -1, 0, 3, 5] },
    soft: { name: 'Мягко', g: [1, 1, 0, -2, -3, -4] },
};
export const eqGains = () => (state.settings.eq === 'custom' ? state.settings.eqCustom : (EQ_PRESETS[state.settings.eq] || EQ_PRESETS.flat).g) || EQ_PRESETS.flat.g;
function applyEq() {
    const g = eqGains();
    eqNodes.forEach((n, i) => { n.gain.value = g[i] || 0; });
}
export const current = () => getTrack(P.queue[P.idx]) || null;
// ---------- одинаковая громкость ----------
const normOn = () => state.settings.normalize !== false;
const normDb = t => { if (!normOn() || !t)
    return 0; const g = gainFor(t.id); return g == null ? Math.min(0, guessGain()) : g; };
const lin = db => Math.pow(10, db / 20);
// ramp — за сколько секунд плавно перейти к новой громкости (0 — сразу, для начала песни)
function applyNorm(ramp = 0) {
    if (!normGain || !actx)
        return;
    const v = lin(normDb(current())), now = actx.currentTime;
    normGain.gain.cancelScheduledValues(now);
    if (ramp)
        normGain.gain.setTargetAtTime(v, now, ramp / 3);
    else
        normGain.gain.setValueAtTime(v, now);
}
export const normInfo = () => ({ on: normOn(), db: normDb(current()), measured: !!current() && gainFor(current().id) != null, node: normGain ? normGain.gain.value : null });
// измеряем играющую песню и заранее — следующую, чтобы она сразу началась с нужной громкостью
async function normTrack() {
    if (!normOn())
        return;
    await loadLoud();
    const t = current();
    if (!t)
        return;
    if (gainFor(t.id) == null) {
        await measure(t);
        if (current() === t)
            applyNorm(1.2);
    }
    const ni = nextIndex(), nx = ni >= 0 ? getTrack(P.queue[ni]) : null;
    if (nx && gainFor(nx.id) == null)
        setTimeout(() => { if (current() === t)
            measure(nx); }, 4000);
}
on('track', () => { normTrack(); });
on('settings', k => { if (k === 'normalize' || k === 'all') {
    applyNorm(0.4);
    normTrack();
} });
export const isPlaying = () => !audio.paused && !audio.ended;
function ensureGraph() {
    if (actx) {
        if (actx.state === 'suspended')
            actx.resume();
        return;
    }
    try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = actx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        const src = actx.createMediaElementSource(audio);
        // звук → эквалайзер → громкость перехода → выравнивание громкости → анализатор (спектр) → колонки
        eqNodes = EQ_BANDS.map((f, i) => {
            const n = actx.createBiquadFilter();
            n.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
            n.frequency.value = f;
            n.Q.value = 1.1;
            return n;
        });
        fadeGain = actx.createGain();
        let node = src;
        for (const n of eqNodes) {
            node.connect(n);
            node = n;
        }
        node.connect(fadeGain);
        normGain = actx.createGain();
        fadeGain.connect(normGain);
        normGain.connect(analyser);
        analyser.connect(actx.destination);
        applyEq();
        applyNorm(0);
        if (actx.state === 'suspended')
            actx.resume();
    }
    catch (e) {
        console.warn('WebAudio недоступен', e);
        actx = null;
    }
}
on('settings', k => { if (k === 'eq' || k === 'eqCustom' || k === 'all') {
    if (eqGains().some(Boolean))
        ensureGraph();
    applyEq();
} });
// ---------- переход между треками ----------
// Плавный: старый трек доигрывает в отдельном «призрачном» плеере и затихает, новый — нарастает.
// «Без пауз»: следующий трек заранее подгружается и включается ровно в момент окончания текущего.
let fading = null, preload = null, lastLoadAt = 0;
// пауза от пользователя останавливает и затихающий трек (смена src сама вызывает pause — её пропускаем)
audio.addEventListener('pause', () => { if (performance.now() - lastLoadAt > 400)
    stopFade(); });
function nextIndex() {
    if (P.repeat === 'one')
        return -1;
    if (P.idx + 1 < P.queue.length)
        return P.idx + 1;
    return P.repeat === 'all' && P.queue.length > 1 ? 0 : -1;
}
function stopFade() {
    if (!fading)
        return;
    clearInterval(fading.timer);
    fading.ghost.pause();
    fading.ghost.removeAttribute('src');
    fading = null;
    if (fadeGain && actx)
        fadeGain.gain.cancelScheduledValues(actx.currentTime), fadeGain.gain.value = 1;
}
function crossfade(sec) {
    const ni = nextIndex();
    if (ni < 0)
        return false;
    stopFade();
    const ghost = new Audio(audio.currentSrc || audio.src);
    ghost.playbackRate = audio.playbackRate;
    ghost.currentTime = audio.currentTime;
    const vol = (P.muted ? 0 : state.volume) * Math.min(1, lin(normDb(current()))); // уходящая песня — с её поправкой громкости
    ghost.volume = vol;
    ghost.play().catch(() => { });
    const t0 = performance.now(), ms = sec * 1000;
    fading = { ghost, timer: setInterval(() => {
            const k = Math.min(1, (performance.now() - t0) / ms);
            ghost.volume = Math.max(0, vol * (1 - k));
            if (k >= 1 || ghost.ended)
                stopFade();
        }, 50) };
    const ghostRef = fading;
    P.idx = ni;
    load(true, { fadeIn: sec });
    if (fading !== ghostRef) // load() не должен гасить только что запущенный переход
        fading = ghostRef;
    return true;
}
function warmNext() {
    const ni = nextIndex(), t = ni >= 0 ? getTrack(P.queue[ni]) : null;
    if (!t || (preload && preload.id === t.id))
        return;
    preload = { id: t.id, el: new Audio() };
    preload.el.preload = 'auto';
    preload.el.src = t.url;
}
let gapRaf = 0;
function gaplessWatch() {
    cancelAnimationFrame(gapRaf);
    const tick = () => {
        if (audio.paused || !isFinite(audio.duration))
            return;
        const left = (audio.duration - audio.currentTime) / (audio.playbackRate || 1);
        if (left <= 0.06 && nextIndex() >= 0 && !sleepEndOfTrack) {
            P.idx = nextIndex();
            load();
            return;
        }
        gapRaf = requestAnimationFrame(tick);
    };
    gapRaf = requestAnimationFrame(tick);
}
audio.addEventListener('timeupdate', () => {
    const tr = +state.settings.transition || 0;
    if (!tr || audio.paused || !isFinite(audio.duration) || fading)
        return;
    const left = (audio.duration - audio.currentTime) / (audio.playbackRate || 1);
    if (left < 20)
        warmNext();
    if (tr === -1 && left < 1.2)
        gaplessWatch();
    else if (tr > 0 && left <= tr && audio.duration > tr * 3 && !sleepEndOfTrack)
        crossfade(tr);
});
let counted = false;
function load(autoplay = true, { fadeIn = 0 } = {}) {
    const t = current();
    if (!t)
        return;
    if (!fadeIn)
        stopFade();
    cancelAnimationFrame(gapRaf);
    lastLoadAt = performance.now();
    counted = false;
    audio.src = t.url;
    audio.defaultPlaybackRate = audio.playbackRate = state.settings.speed || 1;
    audio.currentTime = 0;
    emit('track', t);
    emit('queue');
    if (autoplay) {
        ensureGraph();
        applyNorm(0);
        if (fadeGain && actx) {
            fadeGain.gain.cancelScheduledValues(actx.currentTime);
            fadeGain.gain.setValueAtTime(fadeIn ? 0.0001 : 1, actx.currentTime);
            if (fadeIn)
                fadeGain.gain.linearRampToValueAtTime(1, actx.currentTime + fadeIn);
        }
        audio.play().catch(err => { if (err.name !== 'AbortError')
            console.warn(err); });
    }
    pushRecent(t.id);
    updateMediaSession(t);
}
export function playList(ids, start = 0, { shuffle } = {}) {
    ids = ids.filter(id => getTrack(id));
    if (!ids.length)
        return;
    if (shuffle !== undefined)
        P.shuffle = shuffle;
    P.orig = null;
    if (P.shuffle) {
        P.orig = ids.slice();
        const cur = ids[start];
        P.queue = [cur, ...shuffleArray(ids.filter((_, i) => i !== start))];
        P.idx = 0;
    }
    else {
        P.queue = ids.slice();
        P.idx = start;
    }
    emit('modes');
    load();
}
export function playTrackInQueue(i) { if (i >= 0 && i < P.queue.length) {
    P.idx = i;
    load();
} }
export function toggle() {
    if (!current())
        return;
    ensureGraph();
    if (audio.paused) {
        if (audio.ended)
            audio.currentTime = 0;
        audio.play().catch(() => { });
    }
    else
        audio.pause();
}
export function next(auto = false) {
    if (!P.queue.length)
        return;
    if (auto && P.repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => { });
        return;
    }
    if (P.idx + 1 < P.queue.length) {
        P.idx++;
        load();
    }
    else if (P.repeat === 'all') {
        P.idx = 0;
        load();
    }
    else if (auto) {
        audio.pause();
        audio.currentTime = 0;
        emit('state');
    }
    else {
        audio.currentTime = 0;
    }
}
export function prev() {
    if (!P.queue.length)
        return;
    if (audio.currentTime > 3 || P.idx === 0) {
        if (P.idx === 0 && P.repeat === 'all' && audio.currentTime <= 3 && P.queue.length > 1) {
            P.idx = P.queue.length - 1;
            load();
        }
        else
            audio.currentTime = 0;
    }
    else {
        P.idx--;
        load();
    }
}
export function seek(t) { if (isFinite(audio.duration))
    audio.currentTime = clamp(t, 0, audio.duration); }
export function seekBy(d) { seek(audio.currentTime + d); }
export function setVolume(v) {
    v = clamp(v, 0, 1);
    audio.volume = v;
    state.volume = v;
    if (v > 0 && P.muted) {
        P.muted = false;
        audio.muted = false;
    }
    save();
    emit('volume');
}
export function toggleMute() { P.muted = !P.muted; audio.muted = P.muted; emit('volume'); }
export function toggleShuffle() {
    P.shuffle = !P.shuffle;
    const cur = P.queue[P.idx];
    if (P.shuffle) {
        P.orig = P.queue.slice();
        if (cur !== undefined)
            P.queue = [cur, ...shuffleArray(P.queue.filter((_, i) => i !== P.idx))], P.idx = 0;
    }
    else if (P.orig) {
        const extra = P.queue.filter(id => !P.orig.includes(id));
        P.queue = [...P.orig.filter(id => getTrack(id)), ...extra];
        P.idx = Math.max(0, P.queue.indexOf(cur));
        P.orig = null;
    }
    emit('modes');
    emit('queue');
}
export function cycleRepeat() { P.repeat = P.repeat === 'off' ? 'all' : P.repeat === 'all' ? 'one' : 'off'; emit('modes'); }
// ----- очередь -----
export function addNext(ids) {
    ids = [].concat(ids).filter(id => getTrack(id));
    if (!ids.length)
        return;
    if (P.idx < 0)
        return playList(ids, 0);
    P.queue.splice(P.idx + 1, 0, ...ids);
    if (P.orig)
        P.orig.push(...ids);
    emit('queue');
}
export function addToQueue(ids) {
    ids = [].concat(ids).filter(id => getTrack(id));
    if (!ids.length)
        return;
    if (P.idx < 0)
        return playList(ids, 0);
    P.queue.push(...ids);
    if (P.orig)
        P.orig.push(...ids);
    emit('queue');
}
export function removeFromQueue(i) {
    if (i < 0 || i >= P.queue.length)
        return;
    const id = P.queue[i];
    P.queue.splice(i, 1);
    if (P.orig) {
        const j = P.orig.indexOf(id);
        if (j >= 0)
            P.orig.splice(j, 1);
    }
    if (i < P.idx)
        P.idx--;
    else if (i === P.idx) {
        if (!P.queue.length) {
            stop();
            return;
        }
        if (P.idx >= P.queue.length)
            P.idx = 0;
        load(!audio.paused);
        return;
    }
    emit('queue');
}
export function clearUpcoming() {
    if (P.idx < 0)
        return;
    P.queue.length = P.idx + 1;
    if (P.orig)
        P.orig = P.orig.filter(id => P.queue.includes(id));
    emit('queue');
}
export function stop() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    P.queue = [];
    P.orig = null;
    P.idx = -1;
    emit('track', null);
    emit('queue');
    emit('state');
    if ('mediaSession' in navigator)
        navigator.mediaSession.metadata = null;
}
// Трек удалён из библиотеки
export function purge(ids) {
    const set = new Set(ids);
    const cur = P.queue[P.idx];
    if (set.has(cur)) {
        stop();
        return;
    }
    P.queue = P.queue.filter(id => !set.has(id));
    if (P.orig)
        P.orig = P.orig.filter(id => !set.has(id));
    P.idx = P.queue.indexOf(cur);
    emit('queue');
}
// ----- события audio -----
audio.addEventListener('ended', () => { if (sleepEndOfTrack) {
    sleepEndOfTrack = false;
    emit('sleep');
    audio.pause();
    return;
} next(true); });
// прослушивание засчитывается после 30 секунд (или половины короткого трека)
audio.addEventListener('timeupdate', () => {
    if (counted)
        return;
    const t = current();
    if (!t)
        return;
    if (audio.currentTime >= Math.min(30, (audio.duration || 60) * 0.5)) {
        counted = true;
        bumpPlay(t.id);
    }
});
audio.addEventListener('play', () => { emit('state'); setPos(); });
audio.addEventListener('pause', () => emit('state'));
audio.addEventListener('loadedmetadata', () => { emit('meta'); setPos(); });
audio.addEventListener('durationchange', () => emit('meta'));
audio.addEventListener('seeked', () => { emit('seeked'); setPos(); });
audio.addEventListener('error', () => { if (audio.src) {
    emit('error', current());
} });
// ----- Media Session (медиаклавиши, экран блокировки) -----
function updateMediaSession(t) {
    if (!('mediaSession' in navigator))
        return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist, album: t.album,
        artwork: t.cover ? [{ src: t.cover, sizes: '512x512', type: t.coverType || 'image/jpeg' }] : [],
    });
}
function setPos() {
    if (!('mediaSession' in navigator) || !isFinite(audio.duration))
        return;
    try {
        navigator.mediaSession.setPositionState({ duration: audio.duration, position: audio.currentTime, playbackRate: audio.playbackRate });
    }
    catch { /* ignore */ }
}
if ('mediaSession' in navigator) {
    const h = (a, f) => { try {
        navigator.mediaSession.setActionHandler(a, f);
    }
    catch { /* unsupported */ } };
    h('play', () => { if (audio.paused) toggle(); });
    h('pause', () => { if (!audio.paused) toggle(); });
    h('nexttrack', () => next());
    h('previoustrack', prev);
    h('seekto', d => seek(d.seekTime));
    h('seekbackward', () => seekBy(-10));
    h('seekforward', () => seekBy(10));
}
audio.volume = state.volume;
// ----- скорость и таймер сна -----
export function setSpeed(v) { audio.defaultPlaybackRate = audio.playbackRate = v; setPos(); }
let sleepTimer = 0, sleepEndOfTrack = false;
export const sleepState = { until: 0, endOfTrack: false };
export function setSleep(minutes) {
    clearTimeout(sleepTimer);
    sleepTimer = 0;
    sleepEndOfTrack = false;
    sleepState.until = 0;
    sleepState.endOfTrack = false;
    if (minutes === 'track') {
        sleepEndOfTrack = true;
        sleepState.endOfTrack = true;
    }
    else if (minutes > 0) {
        sleepState.until = Date.now() + minutes * 60000;
        sleepTimer = setTimeout(() => { sleepState.until = 0; fadeOutAndPause(); emit('sleep'); }, minutes * 60000);
    }
    emit('sleep');
}
function fadeOutAndPause() {
    const v0 = audio.volume;
    let k = 0;
    const iv = setInterval(() => { k++; audio.volume = Math.max(0, v0 * (1 - k / 20)); if (k >= 20) {
        clearInterval(iv);
        audio.pause();
        audio.volume = v0;
    } }, 100);
}
