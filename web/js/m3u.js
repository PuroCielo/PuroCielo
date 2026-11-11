import { baseName } from './util.js';

export function parseM3U(text) {
    const out = [];
    let info = null;
    for (let raw of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line)
            continue;
        if (line.startsWith('#EXTINF:')) {
            const c = line.indexOf(',');
            info = c >= 0 ? line.slice(c + 1).trim() : null;
            continue;
        }
        if (line.startsWith('#'))
            continue;
        let path = line;
        try {
            path = decodeURIComponent(line.replace(/^file:\/+/, '/'));
        }
        catch { /* keep raw */ }
        out.push({ path, base: baseName(path), title: info });
        info = null;
    }
    return out;
}
export function buildM3U(name, tracks) {
    const lines = ['#EXTM3U', '#PLAYLIST:' + name];
    for (const t of tracks) {
        lines.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist ? t.artist + ' - ' : ''}${t.title}`);
        lines.push(t.name);
    }
    return lines.join('\n') + '\n';
}
