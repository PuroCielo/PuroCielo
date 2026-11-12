// Короткие анимации интерфейса: только видимые элементы, без постоянных циклов.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const active = new Set(), byElement = new WeakMap();
export const motionEnabled = () => !reduced.matches && !document.documentElement.classList.contains('no-anim');
export function cancelMotion() {
    for (const animation of active) animation.cancel();
}
if (reduced.addEventListener) reduced.addEventListener('change', () => { if (reduced.matches) cancelMotion(); });
function animate(el, frames, options) {
    byElement.get(el)?.cancel();
    if (!motionEnabled() || !el?.animate) return null;
    const animation = el.animate(frames, { duration: 360, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards', ...options });
    byElement.set(el, animation);
    active.add(animation);
    const clean = () => {
        active.delete(animation);
        if (byElement.get(el) === animation) byElement.delete(el);
    };
    animation.finished.then(clean, clean);
    return animation;
}
export function revealElement(el, { distance = 8, delay = 0, duration = 360 } = {}) {
    if (!el || !motionEnabled()) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return;
    return animate(el, distance ? [
        { opacity: 0, transform: `translateY(${distance}px)` },
        { opacity: 1, transform: 'translateY(0)' },
    ] : [{ opacity: .25 }, { opacity: 1 }], { delay, duration });
}
export function revealView(view) {
    if (!motionEnabled()) return;
    let count = 0, inspected = 0;
    for (const el of view.querySelectorAll('.card, .lrow, .row, .setting, .empty')) {
        if (++inspected > 80) break;
        if (revealElement(el, { delay: count * 22, duration: 380 })) count++;
        if (count >= 12) break;
    }
}
export function dismissElement(el) {
    // Уходящее меню сразу перестаёт перехватывать мышь и клавиатуру.
    el.inert = true;
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden', 'true');
    const animation = animate(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 0, transform: 'translateY(4px) scale(.985)' }], { duration: 160, fill: 'forwards' });
    if (animation) animation.finished.then(() => el.remove(), () => el.remove());
    else el.remove();
}
