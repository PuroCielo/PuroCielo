import { icon } from './icons.js';
import { esc } from './util.js';

// ---------- toast ----------
export function toast(msg, kind = 'ok', ms = 2600) {
    const root = document.getElementById('toasts');
    if (!root)
        return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${esc(msg)}</span>`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 350); }, ms);
}
// ---------- контекстное меню ----------
let menuEl = null;
export function closeMenu() { if (menuEl) {
    menuEl.remove();
    menuEl = null;
    return true;
} return false; }
let menuY = 0;
export function openMenu(anchor, items, { x, y } = {}) {
    closeMenu();
    menuY = scrollY;
    const root = document.getElementById('popover-root');
    const el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = items.map((it, i) => it.sep
        ? '<div class="menu-sep"></div>'
        : `<button class="menu-item ${it.danger ? 'danger' : ''}" role="menuitem" data-mi="${i}">${it.icon ? icon(it.icon) : '<span class="ic"></span>'}<span>${esc(it.label)}</span></button>`).join('');
    root.appendChild(el);
    menuEl = el;
    const r = anchor ? anchor.getBoundingClientRect() : { left: x, right: x, top: y, bottom: y, width: 0 };
    const mw = el.offsetWidth, mh = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    let left = Math.min(Math.max(8, r.right - mw), vw - mw - 8);
    if (!anchor)
        left = Math.min(x, vw - mw - 8);
    let top = r.bottom + 6, origin = 'top';
    if (top + mh > vh - 8) {
        top = Math.max(8, r.top - mh - 6);
        origin = 'bottom';
    }
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.transformOrigin = `${origin} ${r.right - left > mw / 2 ? 'right' : 'left'}`;
    requestAnimationFrame(() => el.classList.add('in'));
    el.addEventListener('click', e => {
        const b = e.target.closest('[data-mi]');
        if (!b)
            return;
        const it = items[+b.dataset.mi];
        closeMenu();
        it.onClick?.();
    });
    el.querySelector('.menu-item')?.focus();
}
document.addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest('[data-action="menu"],[data-action="np-menu"]'))
    closeMenu(); }, true);
addEventListener('resize', closeMenu);
// меню закрывается при прокрутке страницы, но не когда сам листается текст песни или очередь
// (и не от мелкого подрагивания страницы — только если её заметно прокрутили)
document.addEventListener('scroll', e => {
    const page = e.target === document || e.target === document.documentElement;
    if (page ? Math.abs(scrollY - menuY) >= 24 : !!(e.target.closest && e.target.closest('.rail')))
        closeMenu();
}, true);
// ---------- модальные окна ----------
const stack = [];
export function openModal({ title, html = '', actions = [], wide = false, onMount }) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Закрыть">${icon('close')}</button></div>
    <div class="modal-body">${html}</div>
    ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : 'btn-soft'} ${a.danger ? 'btn-danger' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
  </div>`;
    root.appendChild(wrap);
    const api = { el: wrap, close() { wrap.classList.remove('in'); const i = stack.indexOf(api); if (i >= 0)
            stack.splice(i, 1); setTimeout(() => wrap.remove(), 250); } };
    stack.push(api);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap)
        api.close(); });
    wrap.addEventListener('click', e => {
        if (e.target.closest('[data-close]'))
            return api.close();
        const b = e.target.closest('[data-act]');
        if (b) {
            const a = actions[+b.dataset.act];
            const r = a.onClick?.(api);
            if (r !== false && !a.keep)
                api.close();
        }
    });
    requestAnimationFrame(() => { wrap.classList.add('in'); wrap.querySelector('input,textarea')?.focus(); });
    onMount?.(api);
    return api;
}
export function confirmBox({ title, text, ok = 'Да', cancel = 'Отмена', danger = false }) {
    return new Promise(resolve => {
        let done = false;
        const fin = v => { if (!done) {
            done = true;
            resolve(v);
        } };
        openModal({
            title, html: `<p class="modal-text">${esc(text)}</p>`,
            actions: [{ label: cancel, onClick: () => fin(false) }, { label: ok, primary: true, danger, onClick: () => fin(true) }],
            onMount: api => { const orig = api.close; api.close = () => { orig(); setTimeout(() => fin(false), 0); }; },
        });
    });
}
export const topModal = () => stack[stack.length - 1];
export function closeTopModal() { const m = stack[stack.length - 1]; if (m) {
    m.close();
    return true;
} return false; }
export function promptText({ title, label, value = '', ok = 'Готово', placeholder = '' }) {
    return new Promise(resolve => {
        let done = false;
        const fin = v => { if (!done) {
            done = true;
            resolve(v);
        } };
        const m = openModal({
            title, html: `<label class="field"><span>${esc(label)}</span><input class="input" id="prompt-in" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80"></label>`,
            actions: [{ label: 'Отмена', onClick: () => fin(null) }, { label: ok, primary: true, onClick: () => fin(m.el.querySelector('#prompt-in').value.trim() || null) }],
            onMount: api => {
                const inp = api.el.querySelector('#prompt-in');
                inp.select();
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') {
                    fin(inp.value.trim() || null);
                    api.close();
                } });
                const orig = api.close;
                api.close = () => { fin(null); orig(); };
            },
        });
    });
}

// ---------- выбор картинки: файл → квадрат w×h (jpeg, data URL) или null, если отменили ----------
export function pickImage(w = 600, h = 600) {
    return new Promise(resolve => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.addEventListener('change', () => {
            const f = inp.files[0];
            if (!f)
                return resolve(null);
            const img = new Image(), url = URL.createObjectURL(f);
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
                c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
                URL.revokeObjectURL(url);
                resolve(c.toDataURL('image/jpeg', 0.88));
            };
            img.onerror = () => { URL.revokeObjectURL(url); toast('Не удалось прочитать изображение', 'warn'); resolve(null); };
            img.src = url;
        });
        inp.click();
    });
}
