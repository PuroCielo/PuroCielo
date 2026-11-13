import { AUDIO_EXT } from './tags.js';
import { extOf } from './util.js';

const SOUNDCLOUD_SERVICE = 'https://purocielo-audio-service.pipeddahlia1.chatgpt.site/download';
export const isSoundCloudLink = url => /(^|\.)soundcloud\.com$/.test(url.hostname) || ['snd.sc', 'soundcloud.app.goo.gl'].includes(url.hostname);
export const MAX_DOWNLOAD = 100 * 1024 * 1024;
const TYPES = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'application/ogg': 'ogg', 'audio/opus': 'opus', 'audio/mp4': 'm4a', 'video/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm' };
export function audioLink(raw) {
    let url;
    try { url = new URL(raw.trim()); } catch { throw new Error('Введите полную ссылку, начиная с https://'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Нужна ссылка HTTP или HTTPS без логина и пароля.');
    url.hash = '';
    return url;
}
function filename(response, url, mime) {
    const disposition = response.headers.get('content-disposition') || '';
    const utf = /filename\*=UTF-8''([^;]+)/i.exec(disposition), plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(disposition);
    let name = utf?.[1] || plain?.[1] || plain?.[2] || new URL(response.url || url).pathname.split('/').pop() || 'Track';
    try { name = decodeURIComponent(name); } catch { /* Keep literal name. */ }
    name = name.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_').trim().slice(0,160) || 'Track';
    if (!AUDIO_EXT.has(extOf(name))) {
        if (!TYPES[mime]) throw new Error('По ссылке не найден поддерживаемый аудиофайл.');
        name += '.' + TYPES[mime];
    }
    return name;
}
export async function downloadAudio(raw, { signal, onProgress = () => {} } = {}) {
    const url = audioLink(raw);
    const soundcloud = isSoundCloudLink(url);
    const response = await fetch(soundcloud ? SOUNDCLOUD_SERVICE : url.href, { signal, credentials: 'omit', referrerPolicy: 'no-referrer',
        ...(soundcloud ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.href }) } : {}),
    });
    if (soundcloud && !response.ok) {
        let data;
        try { data = await response.json(); } catch { /* Gateway errors may be HTML. */ }
        throw new Error(typeof data?.error === 'string' && data.error.length < 400 ? data.error : 'Сервис SoundCloud временно недоступен. Попробуйте позже.');
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error('Сайт не отдал файл. Проверьте ссылку и доступ к нему.'); }
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (/html|json|xml|mpegurl/.test(mime) || mime.startsWith('text/')) {
        await response.body?.cancel();
        throw new Error('Это ссылка на страницу или плейлист. Нужна прямая ссылка на аудиофайл.');
    }
    let name;
    try { name = filename(response, url.href, mime); } catch (e) { await response.body?.cancel(); throw e; }
    const total = Number(response.headers.get('content-length')) || 0;
    if (total > MAX_DOWNLOAD) { await response.body?.cancel(); throw new Error('Файл слишком большой. Максимум — 100 МБ.'); }
    if (!response.body?.getReader) throw new Error('Этот браузер не поддерживает загрузку по ссылке.');
    const reader = response.body.getReader(), parts = [];
    let received = 0;
    try {
        while (true) {
            if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > MAX_DOWNLOAD) throw new Error('Файл слишком большой. Максимум — 100 МБ.');
            parts.push(value);
            onProgress(received, total);
        }
    } catch (e) { await reader.cancel().catch(() => {}); throw e; }
    finally { reader.releaseLock(); }
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!received) throw new Error('По ссылке пришёл пустой файл.');
    return new File(parts, name, { type: mime || 'application/octet-stream' });
}
