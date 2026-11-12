/* Только лендинг. Тема сайта хранится отдельно от настроек плеера. */
(function () {
  var root = document.documentElement;
  var systemTheme = matchMedia('(prefers-color-scheme: dark)');
  var themeButton = document.getElementById('theme-toggle');
  var chosenTheme = '';
  var themeSequence = 0;
  var themeReveal = null;
  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  try { chosenTheme = localStorage.getItem('puro.site.theme') || ''; } catch (_) {}
  if (chosenTheme !== 'light' && chosenTheme !== 'dark') chosenTheme = '';

  function setTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#111113' : '#f5f5f7';
  }
  function applyTheme(theme, animate) {
    var sequence = ++themeSequence;
    if (themeReveal) {
      if (themeReveal.transition) themeReveal.transition.skipTransition();
      if (themeReveal.animation) themeReveal.animation.cancel();
      if (themeReveal.cover) themeReveal.cover.remove();
      themeReveal = null;
    }
    root.classList.remove('theme-reveal');
    if (!animate || reducedMotion.matches || root.dataset.theme === theme) {
      setTheme(theme);
      return;
    }

    // Координаты кнопки в текущем окне, в том числе после прокрутки.
    var rect = themeButton.getBoundingClientRect();
    var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    var radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 2;
    var start = 'circle(0px at ' + x + 'px ' + y + 'px)';
    var end = 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)';
    var timing = { duration: 650, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' };
    root.style.setProperty('--theme-x', x + 'px');
    root.style.setProperty('--theme-y', y + 'px');
    root.classList.add('theme-reveal');
    function finish() {
      if (sequence !== themeSequence) return;
      if (themeReveal && themeReveal.cover) themeReveal.cover.remove();
      themeReveal = null;
      root.classList.remove('theme-reveal');
    }

    if (typeof document.startViewTransition === 'function') {
      // Новая тема раскрывается поверх снимка старой, сохраняя весь интерфейс.
      var transition = document.startViewTransition(function () {
        if (sequence === themeSequence) setTheme(theme);
      });
      themeReveal = { transition: transition };
      transition.ready.then(function () {
        if (sequence !== themeSequence) return;
        themeReveal.animation = root.animate({ clipPath: [start, end] }, {
          duration: timing.duration, easing: timing.easing, fill: timing.fill,
          pseudoElement: '::view-transition-new(root)',
        });
      }).catch(function () { if (sequence === themeSequence) setTheme(theme); });
      transition.finished.then(finish, finish);
      return;
    }

    // Для браузеров без View Transitions — цветная волна с мягким раскрытием интерфейса.
    var cover = document.createElement('div');
    cover.className = 'theme-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.backgroundColor = theme === 'dark' ? '#111113' : '#f5f5f7';
    document.body.appendChild(cover);
    themeReveal = { cover: cover };
    if (typeof cover.animate !== 'function') { setTheme(theme); finish(); return; }
    var wave = cover.animate({ clipPath: [start, end] }, timing);
    themeReveal.animation = wave;
    wave.finished.then(function () {
      if (sequence !== themeSequence) return;
      setTheme(theme);
      var fade = cover.animate({ opacity: [1, 0] }, { duration: 140, easing: 'ease-out', fill: 'forwards' });
      themeReveal.animation = fade;
      fade.finished.then(finish, finish);
    }).catch(finish);
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
