/* Лендинг на двух языках: RU / EN. Выбор запоминается; по умолчанию — по языку браузера.
   Тексты переводятся по словарю прямо на странице (в том числе сообщения входа из auth.js). */
(function () {
  var KEY = 'puro.site.lang';
  var D = {
    'Обновляете старый APK?': 'Updating an older APK?',
    'Если Android сообщает о несовместимой подписи, сначала синхронизируйте нужные данные с аккаунтом. Только после этого переустанавливайте приложение. Локальная история прослушиваний не синхронизируется.': 'If Android reports an incompatible signature, sync the data you need with your account first. Only then reinstall the app. Local listening history is not synced.',
    'Ваши файлы. Ваш любимый звук.': 'Your files. Your favourite sound.',
    'Ваша музыка.': 'Your music.', 'Ваше пространство.': 'Your space.',
    'Плеер для ваших файлов. Тексты песен, обложки и плейлисты — на компьютере и телефоне.': 'A player for your files. Lyrics, artwork and playlists — on your computer and phone.',
    'Открыть в браузере': 'Open in browser',
    'Без рекламы. Без регистрации для прослушивания.': 'No ads. No sign-up needed to listen.',
    'Ваша коллекция — в одном месте': 'Your collection, all in one place',
    'Посмотреть интерфейс': 'Explore the interface',
    'Музыка там, где вы.': 'Music, wherever you are.',
    'Выберите свой способ слушать. Файлы остаются на вашем устройстве.': 'Choose how you listen. Your files stay on your device.',
    'Для компьютера': 'For your computer', 'Для телефона': 'For your phone', 'Без установки': 'No installation',
    'Выберите папку с музыкой. Управляйте воспроизведением с экрана блокировки.': 'Choose your music folder. Control playback from your lock screen.',
    'Откройте плеер и добавьте свои файлы. Можно слушать прямо сейчас.': 'Open the player and add your files. Start listening right away.',
    'iPhone и iPad': 'iPhone and iPad', 'Как установить': 'How to install', 'Для Windows': 'For Windows',
    'От файла до музыки — три шага': 'From files to music in three steps',
    'Добавьте музыку': 'Add your music', 'Выберите файлы или папку с вашей коллекцией.': 'Choose files or a folder from your collection.',
    'Соберите плейлист': 'Make a playlist', 'Сохраните любимые песни под любое настроение.': 'Keep your favourite songs for every mood.',
    'Нажмите Play': 'Press Play', 'Слушайте музыку с обложками и текстами песен.': 'Enjoy your music with artwork and lyrics.',
    'Всё для вашей коллекции.': 'Everything for your collection.',
    'Любимые файлы, внимание к деталям и ничего лишнего между вами и музыкой.': 'Your favourite files, thoughtful details and nothing between you and your music.',
    'Альбомы, артисты и плейлисты собираются из ваших файлов. Миксы помогают заново открыть любимое.': 'Albums, artists and playlists come together from your files. Mixes help you rediscover favourites.',
    'Тексты рядом с музыкой': 'Lyrics alongside your music',
    'Плеер ищет тексты песен онлайн и читает .lrc. Текст с метками времени идёт вместе с песней.': 'Find lyrics online or add .lrc files. Timed lyrics follow along with the song.',
    'На разных устройствах': 'Across your devices', 'Светлая и тёмная темы': 'Light and dark themes',
    'Создан для вашей музыки.': 'Made for your music.',
    'Знакомьтесь с интерфейсом: сейчас играет и ваши музыкальные итоги.': 'Meet the interface: Now Playing and your listening stats.',
    'Ваш аккаунт Puro Cielo': 'Your Puro Cielo account',
    'Одна коллекция. Разные устройства.': 'One collection. Different devices.',
    'Войдите тем же аккаунтом в плеере, чтобы синхронизировать любимое между телефоном и компьютером.': 'Sign in with the same account in the player to sync your favourites between your phone and computer.',
    'Лайки и плейлисты': 'Likes and playlists', 'Ваши подборки рядом на каждом устройстве.': 'Your playlists at hand on every device.',
    'Обложки и настройки': 'Artwork and settings', 'Сохраните свой стиль и данные треков.': 'Keep your style and track details.',
    'Музыка остаётся у вас': 'Your music stays with you', 'Аудиофайлы не загружаются в аккаунт.': 'Audio files are never uploaded to your account.',
    'Аккаунт нужен для синхронизации. Скачивать плеер и слушать музыку можно без регистрации.': 'An account is for syncing. Download the player and listen without signing up.',
    'Ваша музыка остаётся на ваших устройствах. Аккаунт объединяет лайки, плейлисты и настройки.': 'Your music stays on your devices. Your account brings likes, playlists and settings together.',
    'Тёмная тема': 'Dark theme', 'Сменить тему': 'Switch theme',
    'Перейти к содержимому': 'Skip to content', 'Навигация по сайту': 'Site navigation',
    'Puro Cielo — на главную': 'Puro Cielo — home', 'Ссылки внизу страницы': 'Footer links', 'Быстрый запуск': 'Quick launch',
    'Скачать': 'Download', 'В браузере': 'In the browser', 'Возможности': 'Features', 'Открыть плеер': 'Open the player', 'Войти': 'Sign in',
    'Переключить вид сайта': 'Switch site layout', 'Версия для ПК': 'Desktop version', 'Версия для телефона': 'Mobile version',
    'Ваша музыка. Без лишнего.': 'Your music. Nothing extra.',
    'Плеер для файлов на вашем компьютере и телефоне: обложки, артисты, текст песен с караоке и спокойный серо-белый интерфейс.': 'A player for the music files on your computer and phone: covers, artists, synced lyrics and a calm grey-and-white interface.',
    'Скачать для Windows': 'Download for Windows', 'Скачать для Android': 'Download for Android', 'Что внутри': 'What’s inside', 'Скачать APK': 'Download APK',
    'Главный экран Puro Cielo': 'Puro Cielo home screen', 'Экран «Сейчас играет» на телефоне': 'Now Playing on a phone',
    'Для Windows установщик ниже, в разделе «Скачать».': 'The Windows installer is below, in “Download”.', 'Android-версия и плеер в браузере ниже.': 'The Android app and the web player are below.',
    'На iPhone и iPad плеер работает в браузере: откройте его в Safari и добавьте на экран «Домой».': 'On iPhone and iPad the player runs in the browser: open it in Safari and add it to the Home Screen.',
    'Установка без регистрации и без рекламы. Музыка остаётся на вашем устройстве.': 'No sign-up and no ads. Your music stays on your device.',
    'Установщик с ярлыком на рабочем столе. Windows 10 и новее.': 'Installer with a desktop shortcut. Windows 10 and later.', '≈ 123 МБ': '≈ 123 MB', 'Скачать .exe': 'Download .exe',
    'Выбираете папку с музыкой или добавляете треки по одному. Работает с экрана блокировки.': 'Pick your music folder or add tracks one by one. Works from the lock screen.', 'Скачать .apk': 'Download .apk',
    'Ничего не устанавливается: откройте и перетащите файлы в окно.': 'Nothing to install: open it and drop your files into the window.', 'Открыть': 'Open',
    'Что умеет': 'What it does', 'Всё, что нужно для своей коллекции.': 'Everything you need for your own collection.',
    'Своя библиотека': 'Your library', 'Альбомы, синглы, артисты и плейлисты собираются из тегов ваших файлов.': 'Albums, singles, artists and playlists are built from your files’ tags.',
    'Тексты песен': 'Lyrics', 'Ищет текст в файле, в .lrc и на Genius, Lyrics.com, AZLyrics, Text-pesni и Vse-pesni. Синхронизированный текст идёт вместе с песней.': 'Finds lyrics in the file, in .lrc files and on Genius, Lyrics.com, AZLyrics, Text-pesni and Vse-pesni. Synced lyrics scroll with the song.',
    'Миксы для вас': 'Mixes for you', 'Пять подборок по вашим лайкам и прослушиваниям. Лента, сетка или список на главной.': 'Five mixes based on your likes and plays. Rail, grid or list on the home screen.',
    'Синхронизация': 'Sync', 'Войдите в аккаунт — лайки, плейлисты, обложки и настройки одинаковые на телефоне и компьютере.': 'Sign in — likes, playlists, covers and settings are the same on your phone and computer.',
    'Итоги и умные плейлисты': 'Stats and smart playlists', 'Сколько и что вы слушали за неделю, месяц, год. Плейлисты, которые собираются сами по правилам.': 'What and how much you listened to this week, month or year. Playlists that build themselves from rules.',
    'Эквалайзер и переходы': 'Equalizer and transitions', 'Готовые настройки звука или своя. Плавный переход между треками и режим без пауз.': 'Sound presets or your own. Crossfade between tracks and a gapless mode.',
    'Перевод и данные треков': 'Translation and track info', 'Перевод текста строчкой под оригиналом. Название, артист, альбом и обложка из MusicBrainz.': 'Lyrics translation under each line. Title, artist, album and cover from MusicBrainz.',
    'Русский и English': 'Russian and English', 'Язык интерфейса, плотность, углы, фон, резервная копия — в настройках.': 'Interface language, density, corners, background and backup — in settings.',
    'Живой фон': 'Living background', 'Мягкое свечение в цвет обложки песни, которая сейчас играет.': 'A soft glow in the colour of the cover of the song that is playing.',
    'Как выглядит': 'How it looks', 'Текст песни идёт вместе с музыкой, а «Итоги» показывают, что вы слушали.': 'Lyrics move with the music, and Stats show what you’ve been listening to.',
    'Экран «Сейчас играет» с текстом песни': 'Now Playing with lyrics', 'Экран «Итоги»': 'Stats screen',
    'Сейчас играет: обложка, текст песни, эквалайзер и очередь в одном месте.': 'Now Playing: cover, lyrics, equalizer and queue in one place.',
    'Итоги: минуты музыки, любимые артисты и самые прослушиваемые песни.': 'Stats: minutes of music, favourite artists and most played songs.',
    'Аккаунт': 'Account', 'Войдите через Google, GitHub, Microsoft или почту — и тем же аккаунтом в плеере. Ник может занять только один человек.': 'Sign in with Google, GitHub, Microsoft or email — and with the same account in the player. Each username can be taken only once.',
    'Вход скоро появится': 'Sign-in is coming soon', 'Владелец сайта ещё не подключил службу входа. Скачать и пользоваться плеером можно уже сейчас.': 'The site owner hasn’t connected sign-in yet. You can download and use the player right now.',
    'Вход': 'Sign in', 'Регистрация': 'Sign up', 'Продолжить с Google': 'Continue with Google', 'Продолжить с GitHub': 'Continue with GitHub', 'Продолжить с Microsoft': 'Continue with Microsoft',
    'или по почте': 'or with email', 'Ник (уникальный)': 'Username (unique)', 'например, listener': 'for example, listener', 'Имя': 'Name', 'Почта': 'Email', 'Пароль': 'Password',
    'Забыли пароль?': 'Forgot password?', 'Выберите ник': 'Choose a username', 'Занять ник': 'Take username', 'Выйти': 'Sign out', 'Создать аккаунт': 'Create account',
    'Зачем аккаунт': 'Why an account',
    'Войдите тем же аккаунтом в плеере (Настройки → Аккаунт) — лайки, плейлисты, прослушивания, свои обложки и настройки станут общими для всех ваших устройств. Сама музыка остаётся на каждом устройстве и никуда не загружается.': 'Sign in with the same account in the player (Settings → Account) — likes, playlists, plays, custom covers and settings become shared across all your devices. The music itself stays on each device and is never uploaded.',
    'Музыка остаётся на ваших устройствах; в облако уходят только лайки, плейлисты и настройки — если вы вошли в аккаунт.': 'Your music stays on your devices; only likes, playlists and settings go to the cloud — if you sign in.',
    'Некорректный адрес почты.': 'Invalid email address.', 'Введите пароль.': 'Enter a password.', 'Пароль слишком простой: минимум 6 символов.': 'Password is too simple: at least 6 characters.',
    'Эта почта уже зарегистрирована. Попробуйте войти.': 'This email is already registered. Try signing in.', 'Неверная почта или пароль.': 'Wrong email or password.', 'Такого аккаунта нет.': 'No such account.',
    'Неверный пароль.': 'Wrong password.', 'Слишком много попыток. Подождите немного.': 'Too many attempts. Please wait a bit.', 'Окно входа закрыто.': 'Sign-in window closed.',
    'Браузер заблокировал окно входа. Разрешите всплывающие окна.': 'The browser blocked the sign-in window. Allow pop-ups.', 'Эта почта уже используется с другим способом входа.': 'This email is already used with another sign-in method.',
    'Этот адрес сайта не добавлен в Firebase (Authentication → Settings → Authorized domains).': 'This site address isn’t added in Firebase (Authentication → Settings → Authorized domains).',
    'Этот способ входа не включён в Firebase.': 'This sign-in method isn’t enabled in Firebase.', 'Нет соединения с интернетом.': 'No internet connection.',
    'Ник: 3–24 символа, только латинские буквы, цифры, точка и _.': 'Username: 3–24 characters, only Latin letters, digits, dot and _.', 'Этот ник зарезервирован.': 'This username is reserved.',
    'Этот ник уже занят. Выберите другой.': 'This username is taken. Choose another.', 'Не получилось. Попробуйте ещё раз.': 'Something went wrong. Please try again.',
    'Не удалось загрузить службу входа. Проверьте соединение.': 'Couldn’t load sign-in. Check your connection.', 'Аккаунт создан. Мы отправили письмо для подтверждения почты.': 'Account created. We sent you an email to confirm your address.',
    'Введите почту, и мы пришлём ссылку для сброса пароля.': 'Enter your email and we’ll send a password reset link.', 'Письмо для сброса пароля отправлено.': 'Password reset email sent.',
    'Профиль': 'Profile', 'Слушатель': 'Listener',
  };
  var R = [[/^версия (.+)$/, function (m, v) { return 'version ' + v; }], [/^· (.+)$/, function (m, x) { var t = tr(x); return t === x ? undefined : '· ' + t; }]];
  var lang = 'ru';
  try { lang = localStorage.getItem(KEY) || (/^ru|^uk|^be|^kk/i.test(navigator.language || 'ru') ? 'ru' : 'en'); } catch (e) { /* ignore */ }
  var orig = new WeakMap(), origAttr = new WeakMap(), ATTRS = ['aria-label', 'alt', 'placeholder', 'title'];
  function tr(s) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2], out = D[core];
    if (out === undefined) for (var i = 0; i < R.length; i++) { var x = R[i][0].exec(core); if (x) { var r = R[i][1].apply(null, x); if (r !== undefined) { out = r; break; } } }
    return out === undefined ? s : m[1] + out + m[3];
  }
  function skip(el) { return !el || el.closest('script,style,[data-notr]'); }
  function doNode(n) {
    if (n.nodeType === 3) {
      if (skip(n.parentElement) || !/[А-Яа-яЁё]/.test(n.data)) return;
      var t = tr(n.data); if (t !== n.data) { orig.set(n, n.data); n.data = t; }
    } else if (n.nodeType === 1 && !skip(n)) {
      ATTRS.forEach(function (a) { var v = n.getAttribute(a); if (v && /[А-Яа-яЁё]/.test(v)) { var t = tr(v); if (t !== v) { var o = origAttr.get(n) || {}; o[a] = v; origAttr.set(n, o); n.setAttribute(a, t); } } });
    }
  }
  function walk(root) { doNode(root); var it = document.createTreeWalker(root, 5), n; while ((n = it.nextNode())) doNode(n); }
  function restore() {
    var it = document.createTreeWalker(document.body, 5), n;
    while ((n = it.nextNode())) {
      if (n.nodeType === 3 && orig.has(n)) { n.data = orig.get(n); orig.delete(n); }
      else if (n.nodeType === 1 && origAttr.has(n)) { var o = origAttr.get(n); for (var a in o) n.setAttribute(a, o[a]); origAttr.delete(n); }
    }
  }
  new MutationObserver(function (list) {
    if (lang !== 'en') return;
    list.forEach(function (m) { if (m.type === 'childList') m.addedNodes.forEach(walk); else if (m.type === 'characterData') doNode(m.target); else doNode(m.target); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  function set(l) {
    var was = lang; lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
    document.documentElement.lang = l;
    if (l === 'en') walk(document.body); else if (was === 'en') restore();
    document.querySelectorAll('#lang button').forEach(function (b) { b.classList.toggle('on', b.dataset.l === l); });
  }
  document.querySelectorAll('#lang button').forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.l); }); });
  set(lang);
})();
