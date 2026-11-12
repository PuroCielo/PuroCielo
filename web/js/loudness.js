import { kvGet, kvSet } from './db.js';

// Одинаковая громкость. Плеер один раз измеряет, насколько громко записана песня, и запоминает поправку:
// тихие песни делает громче, громкие — тише. Сам файл не меняется.
// Измерение: песня раскодируется с низкой частотой (так она занимает мало памяти), делится на отрезки по 0,4 с,
// тихие отрезки (паузы, вступления) отбрасываются — как в стандарте громкости BS.1770, только без частотного фильтра.
const TARGET = -14; // к какой громкости приводим, дБ
const MAX_UP = 9, MAX_DOWN = -12; // пределы поправки, дБ
const RATE = 8000, BLOCK = 0.4;
export const loud = {}; // id песни → поправка в дБ
let loaded = null, saveTimer = 0;
export const loadLoud = () => loaded || (loaded = (async () => { try {
    const d = await kvGet('loud');
    if (d && typeof d === 'object')
        Object.assign(loud, d);
}
catch { /* ignore */ } })());
const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => kvSet('loud', loud).catch(() => { }), 1500); };
export const gainFor = id => (id in loud ? loud[id] : null);
// пока песня не измерена, берём среднюю поправку по уже измеренным — так скачок громкости после измерения меньше
export function guessGain() {
    const v = Object.values(loud);
    return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
export function analyse(channels) {
    const n = channels[0].length, size = Math.round(RATE * BLOCK), blocks = [];
    let peak = 0;
    for (let s = 0; s + size <= n; s += size) {
        let sum = 0;
        for (const ch of channels)
            for (let i = s; i < s + size; i++) {
                const v = ch[i];
                sum += v * v;
                if (v > peak)
                    peak = v;
                else if (-v > peak)
                    peak = -v;
            }
        blocks.push(sum / (size * channels.length));
    }
    const db = x => 10 * Math.log10(x);
    let kept = blocks.filter(b => b > 1e-7); // тише −70 дБ — тишина
    if (!kept.length)
        return null;
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const gate = mean(kept) / 10; // на 10 дБ тише среднего — тоже не считаем
    kept = kept.filter(b => b >= gate);
    const level = db(mean(kept));
    let g = Math.max(MAX_DOWN, Math.min(MAX_UP, TARGET - level));
    if (peak > 0)
        g = Math.min(g, 20 * Math.log10(0.89 / peak)); // усиливаем только пока пики не упрутся в потолок
    return Math.round(Math.max(MAX_DOWN, g) * 10) / 10;
}
const busy = new Map();
export function measure(t) {
    if (!t || !t.url || typeof window === 'undefined')
        return Promise.resolve(null);
    if (t.id in loud)
        return Promise.resolve(loud[t.id]);
    if (busy.has(t.id))
        return busy.get(t.id);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || (t.size || 0) > 90e6 || (t.duration || 0) > 1200) // очень длинные записи не трогаем — берегём память
        return Promise.resolve(null);
    const p = (async () => {
        try {
            await loadLoud();
            const buf = await (await fetch(t.url)).arrayBuffer();
            const ctx = new OAC(1, 1, RATE);
            const au = await new Promise((res, rej) => { const r = ctx.decodeAudioData(buf, res, rej); if (r && r.catch)
                r.catch(rej); });
            const ch = [];
            for (let i = 0; i < Math.min(2, au.numberOfChannels); i++)
                ch.push(au.getChannelData(i));
            const g = analyse(ch);
            if (g == null)
                return null;
            loud[t.id] = g;
            persist();
            return g;
        }
        catch {
            return null;
        }
        finally {
            busy.delete(t.id);
        }
    })();
    busy.set(t.id, p);
    return p;
}
export function forgetLoud(ids) {
    for (const id of ids)
        delete loud[id];
    persist();
}
