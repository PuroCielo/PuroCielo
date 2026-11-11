import { emit, save, state } from './state.js';

export function applyTheme(t = state.theme) {
    state.theme = t === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.theme === 'dark' ? '#09090B' : '#F5F5F7');
    save();
    emit('theme');
}
export const toggleTheme = () => applyTheme(state.theme === 'dark' ? 'light' : 'dark');
// Пользовательские настройки → атрибуты <html> (цвет акцента, размеры, фон)
export function applySettings() {
    const r = document.documentElement, s = state.settings;
    r.dataset.accent = 'white';
    r.dataset.card = s.cardSize;
    r.dataset.lysize = s.lyricsSize;
    r.dataset.corners = s.corners;
    r.dataset.density = s.density;
    r.classList.toggle('no-bg-anim', !s.bgAnim);
    r.classList.toggle('no-bg-notes', !s.bgNotes2);
    r.classList.toggle('no-bg-vinyl', !s.bgVinyl2);
    r.classList.toggle('no-bg-particles', !s.bgDust);
    r.classList.toggle('no-bg-cover', !s.bgCover);
    r.classList.toggle('no-anim', !s.anim);
}
