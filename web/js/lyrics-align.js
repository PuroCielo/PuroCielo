import { alignmentAPI } from './lyrics-connection.js';
import { rawLyrics, setManualLyrics } from './lyrics-auto.js';
import { current } from './player.js';
import { emit, on, state } from './state.js';
import { lyGet, lySet } from './db.js';
import { toast } from './ui.js';
let enabled = localStorage.getItem('puro-local-alignment') === '1';
let busy = false, generation = 0;
const attempted = new WeakMap();
export const canAlignLocally = () => !!alignmentAPI()?.alignLyrics;
export const localAlignmentBusy = () => busy;
export function cancelLocalAlignment() {
    generation++;
    alignmentAPI()?.cancelAlignment();
}
export const localAlignmentEnabled = () => enabled;
export function toggleLocalAlignment() {
    enabled = !enabled;
    localStorage.setItem('puro-local-alignment', enabled ? '1' : '0');
    if (!enabled) { generation++; alignmentAPI()?.cancelAlignment(); }
    else { attempted.delete(current()); processCurrent(); }
    if (current()) emit('lyrics', current());
}
async function wavFor(track, valid) {
    if (track.duration > 900) throw new Error('Поддерживаются песни до 15 минут');
    const response = await fetch(track.url);
    if (!response.ok) throw new Error('Не удалось прочитать аудио');
    const blob = await response.blob();
    if (blob.size > 150 * 1024 * 1024) throw new Error('Файл слишком большой для локального анализа');
    if (!valid()) return null;
    const context = new OfflineAudioContext(1, 1, 16000);
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration > 900) throw new Error('Поддерживаются песни до 15 минут');
    if (!valid()) return null;
    const samples = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const data = decoded.getChannelData(channel);
        for (let i = 0; i < samples.length; i++) samples[i] += data[i] / decoded.numberOfChannels;
    }
    const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, decoded.sampleRate, true); view.setUint32(28, decoded.sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
    return { wav: bytes, duration: decoded.duration };
}
async function processCurrent() {
    const track = current(), lyrics = track?.lyrics;
    if (!canAlignLocally() || !enabled || busy || lyrics?.type !== 'plain' || lyrics.source !== 'genius' || attempted.get(track) === lyrics.text) return;
    busy = true;
    emit('alignment-state');
    attempted.set(track, lyrics.text);
    const revision = track._lyRevision || 0, token = generation;
    const valid = () => enabled && generation === token && state.tracks.get(track.id) === track && track.lyrics === lyrics && (track._lyRevision || 0) === revision;
    try {
        const key = 'local-alignment-v1:' + track.id;
        const cached = await lyGet(key);
        let lines = cached?.text === lyrics.text && cached?.size === track.size && cached?.duration === track.duration ? cached.lines : null;
        if (!lines) {
            toast('Отделяю вокал и синхронизирую текст на CPU. Первичная загрузка моделей может занять несколько минут', 'info', 7000);
            const audio = await wavFor(track, valid);
            if (!audio || !valid()) return;
            const result = await alignmentAPI().alignLyrics({ ...audio, text: lyrics.text });
            if (!valid()) return;
            if (result.error) throw new Error(result.error);
            lines = result.lines;
            if (!Array.isArray(lines) || !lines.length) throw new Error('Не удалось определить таймкоды');
            await lySet(key, { text: lyrics.text, size: track.size, duration: track.duration, lines });
        }
        if (!valid()) return;
        track.lyrics = { type: 'synced', lines, source: 'genius', ref: lyrics.ref, originalText: lyrics.text, alignment: 'whisper-base-local' };
        emit('lyrics', track);
        toast('Текст синхронизирован', 'info');
    } catch (error) { if (valid()) toast(error.message || 'Не удалось синхронизировать текст', 'warn', 6000); }
    finally { busy = false; emit('alignment-state'); processCurrent(); }
}
on('lyrics', processCurrent);
on('track', processCurrent);
on('alignment-connection', () => {
    if (!canAlignLocally()) generation++;
    else { attempted.delete(current()); processCurrent(); }
    if (current()) emit('lyrics', current());
});

export async function refineCurrentLyrics() {
    const track = current(), lyrics = track?.lyrics;
    if (!alignmentAPI()?.forceAlign || busy || lyrics?.type !== 'synced') return;
    busy = true;
    emit('alignment-state');
    const token = generation, revision = track._lyRevision || 0;
    const valid = () => generation === token && state.tracks.get(track.id) === track && track.lyrics === lyrics && (track._lyRevision || 0) === revision;
    try {
        toast('Проверяю таймкоды по вокалу на CPU…', 'info', 7000);
        const audio = await wavFor(track, valid);
        if (!audio || !valid()) return;
        const result = await alignmentAPI().forceAlign({ ...audio, lines: lyrics.lines });
        if (!valid()) return;
        if (result.error) throw new Error(result.error);
        if (!Array.isArray(result.lines) || result.lines.length !== lyrics.lines.length) throw new Error('Некорректный результат уточнения');
        const changed = JSON.stringify(result.lines) !== JSON.stringify(lyrics.lines);
        if (changed) {
            const originalText = lyrics.originalText || lyrics.lines.map(line => line.text).join('\n');
            await lySet('local-alignment-v1:' + track.id, { text: originalText, size: track.size, duration: track.duration, lines: result.lines });
            if (!valid()) return;
            await setManualLyrics(track, rawLyrics({ lyrics: { ...lyrics, lines: result.lines } }));
        }
        toast(changed ? 'Таймкоды уточнены' : 'Более уверенные таймкоды не найдены', 'info');
    } catch (error) { if (valid()) toast(error.message || 'Уточнение недоступно', 'warn', 6000); }
    finally { busy = false; emit('alignment-state'); processCurrent(); }
}
