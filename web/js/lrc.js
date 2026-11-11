// Парсер .lrc: несколько меток на строку, [offset:], enhanced-теги <mm:ss.xx>, метаданные.
export function parseLrc(text) {
    const lines = [], meta = {};
    let offset = 0;
    const stampRe = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
    for (const raw of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
        let line = raw.trim();
        if (!line)
            continue;
        const stamps = [];
        let m;
        while ((m = stampRe.exec(line))) {
            const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
            stamps.push(+m[1] * 60 + +m[2] + frac);
            line = line.slice(m[0].length).trimStart();
        }
        if (stamps.length) {
            const t = line.replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').replace(/\s+/g, ' ').trim();
            let words = null; // enhanced LRC: <мм:сс.хх>слово — метки отдельных слов
            if (/<\d+:\d+/.test(line)) {
                const parts = [...line.matchAll(/<(\d+):(\d+)(?:[.:](\d+))?>\s*([^<]*)/g)].map(m => ({ t: +m[1] * 60 + +m[2] + (m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0), text: m[4].trim() })).filter(x => x.text);
                const joined = parts.map(x => x.text).join(' ');
                if (parts.length && joined === t)
                    words = parts;
            }
            for (const s of stamps)
                lines.push(words ? { t: s, text: t, words: words.map(w => ({ ...w, t: w.t - (stamps[0] - s) })) } : { t: s, text: t });
            continue;
        }
        const tag = /^\[([a-zA-Z#]+):(.*)\]$/.exec(line);
        if (tag) {
            if (tag[1].toLowerCase() === 'offset')
                offset = (parseInt(tag[2], 10) || 0) / 1000;
            else
                meta[tag[1].toLowerCase()] = tag[2].trim();
        }
    }
    for (const l of lines) {
        l.t = Math.max(0, l.t - offset);
        if (l.words)
            for (const w of l.words)
                w.t = Math.max(0, w.t - offset);
    }
    lines.sort((a, b) => a.t - b.t);
    return { lines, meta, synced: lines.length > 1 };
}
// Индекс активной строки для времени t (бинарный поиск)
export function activeLine(lines, t) {
    let lo = 0, hi = lines.length - 1, r = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid].t <= t) {
            r = mid;
            lo = mid + 1;
        }
        else
            hi = mid - 1;
    }
    return r;
}
