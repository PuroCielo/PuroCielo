/* Только лендинг. Тема сайта хранится отдельно от настроек плеера. */
(function () {
  var root = document.documentElement;
  var systemTheme = matchMedia('(prefers-color-scheme: dark)');
  var themeButton = document.getElementById('theme-toggle');
  var chosenTheme = '';
  var transitionSequence = 0;
  var activeTransition = null;
  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  try { chosenTheme = localStorage.getItem('puro.site.theme') || ''; } catch (_) {}
  if (chosenTheme !== 'light' && chosenTheme !== 'dark') chosenTheme = '';

  // Один переход на страницу: быстрые нажатия сохраняют и язык, и выбранную тему.
  window.PuroSiteTransition = function (update, effect) {
    var sequence = ++transitionSequence;
    if (activeTransition) {
      activeTransition.commit();
      if (activeTransition.transition) activeTransition.transition.skipTransition();
      if (activeTransition.animation) activeTransition.animation.cancel();
      if (activeTransition.cover) activeTransition.cover.remove();
      activeTransition = null;
    }
    root.classList.remove('site-transition', 'theme-reveal', 'language-reveal');
    var committed = false;
    function commit() { if (!committed) { committed = true; update(); } }
    if (!effect || reducedMotion.matches) { commit(); return; }
    root.style.setProperty('--site-transition-from', effect.from);
    root.classList.add('site-transition', effect.kind === 'theme' ? 'theme-reveal' : 'language-reveal');
    var state = { commit: commit };
    activeTransition = state;
    function finish() {
      if (sequence !== transitionSequence) return;
      if (state.animation) state.animation.cancel();
      if (state.cover) state.cover.remove();
      activeTransition = null;
      root.classList.remove('site-transition', 'theme-reveal', 'language-reveal');
    }
    var timing = { duration: effect.duration || 650, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' };
    if (typeof document.startViewTransition === 'function') {
      try {
        var transition = document.startViewTransition(commit);
        state.transition = transition;
        transition.ready.then(function () {
          if (sequence !== transitionSequence) return;
          state.animation = root.animate({ clipPath: [effect.from, effect.to] }, {
            duration: timing.duration, easing: timing.easing, fill: timing.fill,
            pseudoElement: '::view-transition-new(root)',
          });
        }).catch(function () { if (sequence === transitionSequence) commit(); });
        transition.finished.then(finish, finish);
      } catch (_) { commit(); finish(); }
      return;
    }
    // Старые браузеры: язык меняется сразу, у темы остаётся запасной цветовой эффект.
    if (effect.kind !== 'theme') { commit(); finish(); return; }
    var cover = document.createElement('div');
    cover.className = 'theme-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.backgroundColor = effect.color;
    document.body.appendChild(cover);
    state.cover = cover;
    if (typeof cover.animate !== 'function') { commit(); finish(); return; }
    var wave = cover.animate({ clipPath: [effect.from, effect.to] }, timing);
    state.animation = wave;
    wave.finished.then(function () {
      if (sequence !== transitionSequence) return;
      commit();
      var fade = cover.animate({ opacity: [1, 0] }, { duration: 140, easing: 'ease-out', fill: 'forwards' });
      state.animation = fade;
      fade.finished.then(finish, finish);
    }).catch(finish);
  };

  function applyTheme(theme, animate) {
    var effect;
    if (animate) {
      var rect = themeButton.getBoundingClientRect();
      var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      var radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 2;
      root.style.setProperty('--theme-x', x + 'px');
      root.style.setProperty('--theme-y', y + 'px');
      effect = { kind: 'theme', from: 'circle(0px at ' + x + 'px ' + y + 'px)',
        to: 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)',
        color: theme === 'dark' ? '#111113' : '#f5f5f7' };
    }
    window.PuroSiteTransition(function () {
      root.dataset.theme = theme;
      themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
      document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#111113' : '#f5f5f7';
    }, effect);
  }
  applyTheme(chosenTheme || (systemTheme.matches ? 'dark' : 'light'));
  themeButton.addEventListener('click', function () {
    chosenTheme = (chosenTheme || root.dataset.theme) === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('puro.site.theme', chosenTheme); } catch (_) {}
    applyTheme(chosenTheme, true);
  });
  var followSystem = function (e) { if (!chosenTheme) applyTheme(e.matches ? 'dark' : 'light', true); };
  if (systemTheme.addEventListener) systemTheme.addEventListener('change', followSystem);
  else if (systemTheme.addListener) systemTheme.addListener(followSystem);

  document.querySelectorAll('[data-register]').forEach(function (link) {
    link.addEventListener('click', function () { document.getElementById('tab-up').click(); });
  });

  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var dockLink = document.getElementById('dock-dl');
  if (/Android/i.test(ua)) {
    dockLink.href = document.getElementById('dl-apk').href;
    dockLink.textContent = 'Скачать APK';
  } else if (isIOS) {
    dockLink.href = '#download';
    dockLink.removeAttribute('download');
    dockLink.textContent = 'Как установить';
    document.getElementById('ios-note').hidden = false;
  } else {
    dockLink.href = document.getElementById('dl-win').href;
    dockLink.textContent = /Windows/i.test(ua) ? 'Для Windows' : 'Windows .exe';
  }

  var dock = document.getElementById('dock');
  var hero = document.getElementById('top');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { dock.classList.toggle('show', !entries[0].isIntersecting); }, { threshold: 0 }).observe(hero);
  } else {
    var updateDock = function () { dock.classList.toggle('show', hero.getBoundingClientRect().bottom < 0); };
    addEventListener('scroll', updateDock, { passive: true });
    updateDock();
  }
})();
