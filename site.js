/* Только лендинг. Тема сайта хранится отдельно от настроек плеера. */
(function () {
  var root = document.documentElement;
  var systemTheme = matchMedia('(prefers-color-scheme: dark)');
  var themeButton = document.getElementById('theme-toggle');
  var chosenTheme = '';
  try { chosenTheme = localStorage.getItem('puro.site.theme') || ''; } catch (_) {}
  if (chosenTheme !== 'light' && chosenTheme !== 'dark') chosenTheme = '';

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#111113' : '#f5f5f7';
  }
  applyTheme(chosenTheme || (systemTheme.matches ? 'dark' : 'light'));
  themeButton.addEventListener('click', function () {
    chosenTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('puro.site.theme', chosenTheme); } catch (_) {}
    applyTheme(chosenTheme);
  });
  var followSystem = function (e) { if (!chosenTheme) applyTheme(e.matches ? 'dark' : 'light'); };
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
