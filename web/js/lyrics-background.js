import { derived, on, state } from './state.js';
import { ensureLyrics } from './lyrics-auto.js';

// One song at a time: importing an album must not flood lyrics providers.
// Results use the normal persistent cache; this module never opens player UI.
let started = false, active = false, timer = null;
const pending = new Map();
const attempted = new WeakSet();
const enabled = () => state.settings.autoLyrics && navigator.onLine !== false;

function schedule() {
    if (!active && !timer && pending.size && enabled()) timer = setTimeout(drain, 250);
}
function collect() {
    derived(); // Apply artist corrections and user metadata before searching.
    for (const t of state.tracks.values()) {
        if (!t.lyrics && !attempted.has(t)) pending.set(t.id, t);
    }
    schedule();
}
async function drain() {
    timer = null;
    if (active || !enabled()) return;
    const entry = pending.entries().next().value;
    if (!entry) return;
    const [id, t] = entry;
    pending.delete(id);
    if (state.tracks.get(id) !== t || t.lyrics || attempted.has(t)) { schedule(); return; }
    active = true;
    attempted.add(t);
    try { await ensureLyrics(t); }
    catch { /* Search failure must never interrupt importing or playback. */ }
    finally { active = false; schedule(); }
}
export function initBackgroundLyrics() {
    if (started) return;
    started = true;
    on('library', collect);
    on('settings', collect);
    window.addEventListener('online', () => {
        for (const t of state.tracks.values())
            if (!t.lyrics && ['error', 'offline'].includes(t._ly)) attempted.delete(t);
        collect();
    });
    collect();
}
