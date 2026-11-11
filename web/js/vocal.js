// Где в треке «поют»: грубая карта активности по громкости в диапазоне голоса (≈250–3500 Гц).
// Нужна только для обычного текста без меток времени: строки раскладываются по участкам, где есть звук,
// а вступление, проигрыши и тишина в конце пропускаются. Это приближение, а не распознавание слов.
const STEP = 0.5; // секунд на ячейку
const cache = new Map();
export async function vocalActivity(t) {
    if (!t || !t.url)
        return null;
    if (cache.has(t.id))
        return cache.get(t.id);
    const job = (async () => {
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OAC)
            return null;
        const res = await fetch(t.url);
        if (!res.ok)
            return null;
        const len = +res.headers.get('content-length') || 0;
        if (len > 70 * 1024 * 1024)
            return null; // очень большие файлы не разбираем
        const raw = await res.arrayBuffer();
        const sr = 16000, dur = Math.max(1, t.duration || 180);
        const ctx = new OAC(2, Math.ceil(sr * dur), sr);
        const buf = await new Promise((ok, no) => ctx.decodeAudioData(raw, ok, no));
        const off = new OAC(2, buf.length, sr), src = off.createBufferSource();
        src.buffer = buf;
        const hp = off.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 250;
        const lp = off.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3500;
        src.connect(hp);
        hp.connect(lp);
        lp.connect(off.destination);
        src.start();
        const out = await off.startRendering(), L = out.getChannelData(0), R = out.numberOfChannels > 1 ? out.getChannelData(1) : L;
        const data = new Float32Array(L.length), side = new Float32Array(L.length);
        for (let i = 0; i < L.length; i++) {
            data[i] = (L[i] + R[i]) / 2;
            side[i] = (L[i] - R[i]) / 2;
        }
        const r = activityFromSamples(data, sr, side);
        if (r)
            r.fine = fineEnvelope(data, sr, side);
        return r;
    })().catch(() => null);
    cache.set(t.id, job);
    return job;
}
// Массив 0/1 по ячейкам STEP секунд: true — есть заметный звук
const FSTEP = 0.02;
// Точная огибающая (20 мс) и «начала звуков»: по ним определяется, где кончается одно слово и начинается другое, а какое тянется
export function fineEnvelope(data, sr, side) {
    const per = Math.max(1, Math.floor(sr * FSTEP)), n = Math.floor(data.length / per), env = new Float32Array(n), onset = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let s = 0, q = 0;
        for (let k = i * per, e = k + per; k < e; k++) {
            s += data[k] * data[k];
            if (side)
                q += side[k] * side[k];
        }
        env[i] = Math.sqrt(Math.max(s * 0.15, s - 0.7 * q) / per);
    }
    const lg = Array.from(env, v => Math.log(v + 1e-4));
    for (let i = 3; i < n; i++)
        onset[i] = Math.max(0, lg[i] - (lg[i - 1] + lg[i - 2] + lg[i - 3]) / 3 - 0.08);
    for (let i = n - 2; i > 0; i--)
        onset[i] = Math.max(onset[i], onset[i - 1] * 0.6);
    return { step: FSTEP, env, onset };
}
const syllables = w => Math.max(1, (String(w).toLowerCase().match(/[aeiouyаеёиоуыэюяії]+/g) || []).length);
// Времена слов строки по звуку: возвращает [{a, b, held}] или null, если звука для разбора нет
export function alignWords(words, start, limit, fine) {
    const n = words.length;
    if (!fine || n < 2)
        return null;
    const { step, env, onset } = fine;
    const i0 = Math.max(0, Math.floor((start - 0.3) / step)), i1 = Math.min(env.length - 1, Math.floor(limit / step));
    if (i1 - i0 < 15)
        return null;
    let peak = 0;
    for (let i = i0; i <= i1; i++)
        if (env[i] > peak)
            peak = env[i];
    if (peak < 1e-3)
        return null;
    const thr = peak * 0.16;
    let first = i0;
    while (first < i1 && env[first] < thr)
        first++;
    let last = i1;
    while (last > first && env[last] < thr)
        last--;
    const t0 = first * step, t1 = (last + 1) * step, L = t1 - t0;
    if (L < 0.6)
        return null;
    const syl = words.map(syllables), tot = syl.reduce((a, b) => a + b, 0);
    let acc = 0;
    const exp = syl.map(c => { const e = t0 + L * acc / tot; acc += c; return e; });
    // кандидаты: найденные начала звуков и «виртуальные» точки там, где звука не нашлось (протяжные места)
    let mx = 0;
    for (let i = first; i <= last; i++)
        if (onset[i] > mx)
            mx = onset[i];
    const cand = [];
    if (mx > 0)
        for (let i = first + 3; i < last - 2; i++)
            if (onset[i] > mx * 0.22 && onset[i] >= onset[i - 1] && onset[i] > onset[i + 1]) {
                const t = i * step;
                if (cand.length && t - cand[cand.length - 1].t < 0.11) {
                    if (onset[i] > cand[cand.length - 1].w * mx) {
                        cand[cand.length - 1] = { t, w: onset[i] / mx };
                    }
                    continue;
                }
                cand.push({ t, w: onset[i] / mx });
            }
    for (let k = 1; k < n; k++)
        if (!cand.some(c => Math.abs(c.t - exp[k]) < 0.12))
            cand.push({ t: exp[k], w: 0 });
    cand.sort((x, y) => x.t - y.t);
    const m = cand.length, NEG = -1e9, lam = 5;
    const dp = Array.from({ length: n }, () => new Float64Array(m).fill(NEG)), from = Array.from({ length: n }, () => new Int32Array(m).fill(-1));
    for (let j = 0; j < m; j++)
        dp[1][j] = cand[j].w * 1.6 - lam * ((cand[j].t - exp[1]) / L) ** 2;
    for (let k = 2; k < n; k++)
        for (let j = 0; j < m; j++) {
            let best = NEG, bi = -1;
            for (let q = 0; q < j; q++)
                if (dp[k - 1][q] > best && cand[j].t - cand[q].t >= 0.09) {
                    best = dp[k - 1][q];
                    bi = q;
                }
            if (bi >= 0) {
                dp[k][j] = best + cand[j].w * 1.6 - lam * ((cand[j].t - exp[k]) / L) ** 2;
                from[k][j] = bi;
            }
        }
    let bj = -1, bs = NEG;
    for (let j = 0; j < m; j++)
        if (dp[n - 1][j] > bs) {
            bs = dp[n - 1][j];
            bj = j;
        }
    if (bj < 0)
        return null;
    const starts = new Array(n);
    starts[0] = t0;
    for (let k = n - 1, j = bj; k >= 1; k--) {
        starts[k] = cand[j].t;
        j = from[k][j];
    }
    const out = starts.map((a, k) => ({ a, b: k + 1 < n ? starts[k + 1] : t1, held: false }));
    // протяжное слово: на слог уходит заметно больше времени, чем у остальных слов строки
    const rate = out.map((w, k) => (w.b - w.a) / syl[k]);
    out.forEach((w, k) => {
        const others = rate.filter((_, j) => j !== k).sort((x, y) => x - y), med = others[Math.floor(others.length / 2)] || rate[k];
        w.held = w.b - w.a >= 0.8 && rate[k] > 2.2 * Math.max(0.12, med);
    });
    return out;
}
export function activityFromSamples(data, sr, side) {
    const n = Math.max(1, Math.floor(data.length / (sr * STEP))), e = new Float32Array(n), per = Math.floor(sr * STEP);
    for (let i = 0; i < n; i++) {
        let s = 0, q = 0;
        for (let k = i * per, end = Math.min(data.length, k + per); k < end; k++) {
            s += data[k] * data[k];
            if (side)
                q += side[k] * side[k];
        }
        e[i] = Math.sqrt(Math.max(s * 0.15, s - 0.7 * q) / per);
    }
    const sorted = Array.from(e).sort((a, b) => a - b), p90 = sorted[Math.floor(n * 0.9)] || 0;
    if (p90 < 1e-4)
        return null;
    const thr = p90 * 0.22;
    const act = Array.from(e, v => v > thr);
    // короткие провалы (дыхание, паузы между словами) считаем частью пения, длинные (≥ 3 с) — проигрышем
    const GAP = Math.round(3 / STEP);
    for (let i = 0; i < n;) {
        if (act[i]) {
            i++;
            continue;
        }
        let j = i;
        while (j < n && !act[j])
            j++;
        if (i > 0 && j < n && j - i < GAP)
            for (let k = i; k < j; k++)
                act[k] = true;
        i = j;
    }
    // одиночные всплески (< 1.5 с) вне пения не считаем
    const MIN = Math.round(1.5 / STEP);
    for (let i = 0; i < n;) {
        if (!act[i]) {
            i++;
            continue;
        }
        let j = i;
        while (j < n && act[j])
            j++;
        if (j - i < MIN)
            for (let k = i; k < j; k++)
                act[k] = false;
        i = j;
    }
    return { step: STEP, act };
}
// Времена строк: «время пения» делится пропорционально весам, а затем переводится в реальное время трека (пропуская проигрыши)
export function layoutOnActivity(weights, dur, a) {
    const { step, act } = a, n = act.length, cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++)
        cum[i + 1] = cum[i] + (act[i] ? step : 0);
    const total = cum[n];
    if (total < dur * 0.2)
        return null;
    const sum = weights.reduce((s, w) => s + w, 0) || 1, out = [];
    let acc = 0;
    for (const w of weights) {
        const T = acc / sum * total;
        let lo = 0, hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (cum[mid] <= T)
                lo = mid;
            else
                hi = mid - 1;
        }
        out.push(Math.min(dur - 1, lo * step + (T - cum[lo])));
        acc += w;
    }
    return out;
}
// Где заканчивается звук, начавшийся в момент t (но не позже limit)
function sungEnd(fine, t, limit) {
    const { step, env } = fine;
    let i = Math.floor(t / step), end = Math.min(env.length - 1, Math.floor(limit / step));
    let peak = 0;
    for (let k = i; k <= Math.min(end, i + 50); k++)
        if (env[k] > peak)
            peak = env[k];
    const thr = peak * 0.16;
    let quiet = 0, last = i;
    for (let k = i; k <= end; k++) {
        if (env[k] >= thr) {
            last = k;
            quiet = 0;
        }
        else if (++quiet > 12)
            break;
    }
    return (last + 1) * step;
}
export const TUNE = { R: 3, W: 3 };
// Выравнивание обычного текста по звуку: слоги текста сопоставляются с найденными «началами звуков» в порядке следования,
// при этом время каждого слога не уходит далеко от ожидаемого. Возвращает строки со временем каждого слова или null.
export function alignText(text, dur, a) {
    if (!a || !a.fine)
        return null;
    const raw = String(text).split(/\r?\n/).map(l => l.trim()), items = [];
    for (const l of raw) {
        if (l) {
            const ws = l.split(/\s+/);
            items.push({ text: ws.join(' '), ws });
        }
        else if (items.length)
            items[items.length - 1].gap = true;
    }
    if (!items.length)
        return null;
    const sylls = [];
    items.forEach((it, li) => it.ws.forEach((w, wi) => { for (let k = 0, c = syllables(w); k < c; k++)
        sylls.push({ li, wi, first: k === 0, wt: 1 }); const last = sylls[sylls.length - 1]; if (wi === it.ws.length - 1)
        last.wt += it.gap ? 3 : 1; }));
    const S = sylls.length;
    if (S < 4)
        return null;
    const exp = layoutOnActivity(sylls.map(x => x.wt), dur, a);
    if (!exp)
        return null;
    const { step, onset } = a.fine, n = onset.length, stepA = a.step;
    let mx = 0;
    for (let i = 0; i < n; i++)
        if (onset[i] > mx)
            mx = onset[i];
    if (mx <= 0)
        return null;
    const cand = [];
    for (let i = 3; i < n - 2; i++) {
        if (!(onset[i] > mx * 0.2 && onset[i] >= onset[i - 1] && onset[i] > onset[i + 1]))
            continue;
        const t = i * step;
        if (!a.act[Math.min(a.act.length - 1, Math.floor(t / stepA))])
            continue; // только там, где «поют»
        if (cand.length && t - cand[cand.length - 1].t < 0.09) {
            if (onset[i] / mx > cand[cand.length - 1].w)
                cand[cand.length - 1] = { t, w: onset[i] / mx };
            continue;
        }
        cand.push({ t, w: onset[i] / mx });
    }
    if (cand.length < S * 0.5)
        return null;
    for (const e of exp)
        if (!cand.some(c => Math.abs(c.t - e) < 0.1))
            cand.push({ t: e, w: 0 });
    cand.sort((x, y) => x.t - y.t);
    const M = cand.length, NEG = -1e9;
    // штраф за отклонение от ожидаемого времени: до 2,5 с почти не штрафуем (темп в песне неравномерный), дальше растёт
    const R = TUNE.R, pen = (t, e) => { const d = Math.max(0, Math.abs(t - e) - TUNE.W); return (d / 3) ** 2 + 0.03 * Math.abs(t - e); };
    const from = Array.from({ length: S }, () => new Int32Array(M));
    let prev = new Float64Array(M);
    for (let j = 0; j < M; j++)
        prev[j] = cand[j].w * R - pen(cand[j].t, exp[0]);
    for (let i = 1; i < S; i++) {
        const cur = new Float64Array(M).fill(NEG);
        let best = NEG, bi = -1; // best — лучший prev по строго меньшим j
        for (let j = 0; j < M; j++) {
            if (bi >= 0) {
                cur[j] = best + cand[j].w * R - pen(cand[j].t, exp[i]);
                from[i][j] = bi;
            }
            if (prev[j] > best) {
                best = prev[j];
                bi = j;
            }
        }
        prev = cur;
    }
    let bj = 0;
    for (let j = 1; j < M; j++)
        if (prev[j] > prev[bj])
            bj = j;
    const ts = new Array(S);
    for (let i = S - 1, j = bj; i >= 0; i--) {
        ts[i] = cand[j].t;
        j = from[i][j];
    }
    // слоги → слова → строки
    const lines = items.map(it => ({ text: it.text, words: [] }));
    sylls.forEach((sy, i) => { if (sy.first)
        lines[sy.li].words.push({ t: ts[i], text: items[sy.li].ws[sy.wi], syl: syllables(items[sy.li].ws[sy.wi]) }); });
    lines.forEach((l, li) => {
        const nextLine = lines[li + 1] && lines[li + 1].words[0] ? lines[li + 1].words[0].t : dur;
        l.t = l.words[0].t;
        l.words.forEach((w, k) => { const nxt = l.words[k + 1]; w.b = nxt ? nxt.t : Math.min(sungEnd(a.fine, w.t, nextLine - 0.05), w.t + 6); if (w.b - w.t < 0.12)
            w.b = w.t + 0.12; });
        const rate = l.words.map(w => (w.b - w.t) / w.syl);
        l.words.forEach((w, k) => { const o = rate.filter((_, j) => j !== k).sort((x, y) => x - y), med = o[Math.floor(o.length / 2)] || rate[k]; w.held = w.b - w.t >= 0.8 && rate[k] > 2.2 * Math.max(0.12, med); });
    });
    return lines;
}
