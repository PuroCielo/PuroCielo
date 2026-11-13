import { downloadAudio } from './link-download.js';
import { importDownloadedAudio } from './importer.js';
import { icon } from './icons.js';
import { isEn } from './i18n.js';
import { openModal } from './ui.js';

let job = null, message = '', error = false, received = 0, total = 0, phase = '', lastURL = '';
let modal = null, formNumber = 0;
const forms = () => [...document.querySelectorAll('.link-import')];
function markup() {
    const id = 'audio-link-' + (++formNumber);
    return `<form class="link-import"><label for="${id}">Загрузить по ссылке</label><div class="link-import-entry"><input id="${id}" name="audio-url" type="url" placeholder="https://soundcloud.com/…" required autocomplete="off" spellcheck="false" aria-describedby="${id}-hint"><button class="icon-btn" type="submit" title="Скачать в медиатеку" aria-label="Скачать в медиатеку">${icon('download')}</button><button class="icon-btn" type="button" data-link-cancel title="Отменить загрузку" aria-label="Отменить загрузку" hidden>${icon('close')}</button></div><small id="${id}-hint">SoundCloud или аудиофайл · до 100 МБ</small><progress max="100" hidden aria-label="Загрузка аудио"></progress><p class="link-import-status" role="status" aria-live="polite" hidden></p></form>`;
}
function paint() {
    for (const form of forms()) {
        form.setAttribute('aria-busy', String(!!job));
        form.querySelector('input').disabled = !!job;
        form.querySelector('[type=submit]').hidden = !!job;
        const cancel = form.querySelector('[data-link-cancel]');
        cancel.hidden = !job;
        cancel.disabled = phase === 'saving';
        const progress = form.querySelector('progress');
        progress.hidden = !job;
        if (total) progress.value = Math.min(100, received / total * 100); else progress.removeAttribute('value');
        const status = form.querySelector('.link-import-status');
        status.hidden = !message;
        status.classList.toggle('error', error);
        status.textContent = message;
    }
}
function bind(form) {
    form.querySelector('input').value = lastURL;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (job) return;
        lastURL = form.querySelector('input').value.trim();
        const controller = new AbortController();
        job = controller; phase = 'download'; error = false; received = total = 0;
        message = 'Подключаюсь…'; paint();
        let timedOut = false, lastPaint = 0;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 120000);
        try {
            const file = await downloadAudio(lastURL, { signal: controller.signal, onProgress: (bytes, size) => {
                received = bytes; total = size;
                if (Date.now() - lastPaint < 160) return;
                lastPaint = Date.now();
                message = total ? `${isEn() ? 'Downloading' : 'Загрузка'}: ${Math.min(100,Math.round(received / total * 100))}%` : `${isEn() ? 'Downloaded' : 'Загружено'}: ${(received / 1048576).toFixed(1)} ${isEn() ? 'MB' : 'МБ'}`;
                paint();
            } });
            clearTimeout(timer);
            if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
            phase = 'saving'; message = 'Сохраняю в медиатеку…'; paint();
            const result = await importDownloadedAudio(file);
            message = result.added ? 'Трек добавлен в медиатеку' : 'Этот файл уже есть в медиатеке';
        } catch (e) {
            error = e.name !== 'AbortError' || timedOut;
            message = timedOut ? 'Загрузка заняла слишком много времени. Попробуйте ещё раз.' : e.name === 'AbortError' ? 'Загрузка отменена' : e instanceof TypeError ? 'Не удалось скачать файл. Сайт может запрещать загрузку по ссылке — попробуйте скачать файл вручную.' : e.message;
        } finally { clearTimeout(timer); job = null; phase = ''; paint(); }
    });
    form.querySelector('[data-link-cancel]').addEventListener('click', () => { if (phase !== 'saving') job?.abort(); });
    paint();
}
export function initLinkImport() {
    const host = document.getElementById('side-link-import');
    host.innerHTML = markup();
    bind(host.querySelector('form'));
}
export function openLinkImport() {
    if (modal?.el.isConnected && !modal.el.inert) { modal.el.querySelector('input')?.focus(); return; }
    modal = openModal({ title: 'Загрузить по ссылке', html: markup(), onMount: api => bind(api.el.querySelector('form')) });
}
