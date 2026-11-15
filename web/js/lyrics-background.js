import { derived, on, state } from './state.js';
import { ensureLyrics } from './lyrics-auto.js';

// Persistent lyrics live in IndexedDB; this session queue only schedules work.
// One active song, two bounded retries on network failure, no UI interruptions.
let started = false, active = false, timer = null;
const jobs = new Map();
const enabled = () => state.settings.autoLyrics && navigator.onLine !== false;
const identity = t => JSON.stringify([t.artist,t.title,t.duration]);
function schedule() {
    clearTimeout(timer); timer = null;
    if (active || !enabled()) return;
    const next = [...jobs.values()].filter(j => !j.done && !j.track.lyrics).sort((a,b) => a.due-b.due || (b.track.addedAt || 0)-(a.track.addedAt || 0))[0];
    if (next) timer = setTimeout(() => drain(next), Math.max(250, next.due-Date.now()));
}
function collect() {
    derived();
    for (const [id,j] of jobs) if (state.tracks.get(id)!==j.track) jobs.delete(id);
    for (const t of state.tracks.values()) {
        if (t.lyrics) continue;
        const old = jobs.get(t.id), key = identity(t);
        if (!old || old.key !== key) jobs.set(t.id, {track:t,key,due:0,attempts:0,done:false});
    }
    schedule();
}
async function drain(job) {
    timer = null;
    if (active || !enabled()) return;
    const t = job.track;
    if (jobs.get(t.id)!==job || state.tracks.get(t.id)!==t || t.lyrics) { job.done=true; schedule(); return; }
    active=true; job.attempts++;
    try { await ensureLyrics(t); }
    catch { t._ly='error'; }
    finally {
        active=false;
        if (!t.lyrics && ['error','offline'].includes(t._ly) && job.attempts<3) job.due=Date.now()+(job.attempts===1?15000:60000);
        else job.done=true;
        schedule();
    }
}
export function initBackgroundLyrics() {
    if (started) return;
    started=true;
    on('library',collect); on('settings',collect);
    window.addEventListener('online',()=>{
        for (const j of jobs.values()) if (!j.track.lyrics && ['error','offline'].includes(j.track._ly)) {j.done=false;j.attempts=0;j.due=0;}
        collect();
    });
    collect();
}
