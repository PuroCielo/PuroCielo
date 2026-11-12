import { emit, save, state } from './state.js';

let reveal = null, sequence = 0, chosenTheme = null;

// Передаём кнопку только для действий пользователя; запуск и импорт настроек мгновенные.
export function applyTheme(t = state.theme, origin = null) {
    const root = document.documentElement, theme = t === 'light' ? 'light' : 'dark';
    chosenTheme = theme;
    const id = ++sequence;
    if (reveal) {
        reveal.transition?.skipTransition();
        reveal.animation?.cancel();
        reveal.cover?.remove();
        reveal = null;
    }
    root.classList.remove('player-theme-reveal');
    let committed = false;
    const commit = () => {
        if (id !== sequence || committed) return;
        committed = true;
        state.theme = theme;
        root.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09090B' : '#F5F5F7');
        save();
        emit('theme');
    };
    if (!origin || root.dataset.theme === theme || !state.settings.anim || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        commit();
        return;
    }
    const rect = origin.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight, rect.top + rect.height / 2));
    const radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 2;
    const from = `circle(0px at ${x}px ${y}px)`, to = `circle(${radius}px at ${x}px ${y}px)`;
    root.style.setProperty('--player-theme-from', from);
    root.classList.add('player-theme-reveal');
    const current = {};
    reveal = current;
    const finish = () => {
        if (id !== sequence) return;
        current.animation?.cancel();
        current.cover?.remove();
        reveal = null;
        root.classList.remove('player-theme-reveal');
    };
    const timing = { duration: 650, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' };
    if (typeof document.startViewTransition === 'function') {
        try {
            const transition = document.startViewTransition(commit);
            current.transition = transition;
            transition.ready.then(() => {
                if (id !== sequence) return;
                current.animation = root.animate({ clipPath: [from, to] }, {
                    ...timing, pseudoElement: '::view-transition-new(root)',
                });
            }).catch(commit);
            transition.finished.then(finish, finish);
        } catch (_) { commit(); finish(); }
        return;
    }
    // В старых WebView — цветовая волна с мягким появлением интерфейса.
    const cover = document.createElement('div');
    cover.className = 'player-theme-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.backgroundColor = theme === 'dark' ? '#09090B' : '#F5F5F7';
    document.body.appendChild(cover);
    current.cover = cover;
    if (typeof cover.animate !== 'function') { commit(); finish(); return; }
    current.animation = cover.animate({ clipPath: [from, to] }, timing);
    current.animation.finished.then(() => {
        if (id !== sequence) return;
        commit();
        current.animation = cover.animate({ opacity: [1, 0] }, { duration: 140, fill: 'forwards' });
        current.animation.finished.then(finish, finish);
    }).catch(finish);
}
export function toggleTheme(origin) {
    origin ||= [...document.querySelectorAll('[data-action="toggle-theme"], [data-action="set-theme"]')]
        .find(el => el.getClientRects().length);
    applyTheme((chosenTheme || state.theme) === 'dark' ? 'light' : 'dark', origin);
}
// Пользовательские настройки → атрибуты <html> (цвет акцента, размеры, фон)
export function applySettings() {
    const r = document.documentElement, s = state.settings;
    r.dataset.accent = 'white';
    r.dataset.card = s.cardSize;
    r.dataset.lysize = s.lyricsSize;
    r.dataset.corners = s.corners;
    r.dataset.density = s.density;
    r.classList.toggle('no-bg-anim', !s.bgAnim);
    r.classList.toggle('no-bg-cover', !s.bgCover);
    r.classList.toggle('no-anim', !s.anim);
}
