// Язык интерфейса. Плеер написан по-русски; для English готовые строки на странице переводятся по словарю
// (тексты кнопок, подсказки, всплывающие сообщения). Названия песен, артистов и тексты песен не трогаются.
let lang = 'ru';
export const getLang = () => lang;
export const isEn = () => lang === 'en';
const D = {
    "SoundCloud или аудиофайл · до 100 МБ": "SoundCloud or audio file · up to 100 MB",
    "Сервис SoundCloud временно недоступен. Попробуйте позже.": "The SoundCloud service is temporarily unavailable. Try again later.",
    "Введите ссылку на трек SoundCloud.": "Enter a SoundCloud track URL.",
    "Нужна HTTPS-ссылка на публичный трек SoundCloud.": "Use an HTTPS link to a public SoundCloud track.",
    "Источник вернул неподдерживаемый адрес аудио.": "The source returned an unsupported audio address.",
    "SoundCloud временно ограничил запросы. Попробуйте позже.": "SoundCloud is temporarily limiting requests. Try again later.",
    "SoundCloud не предоставил аудио. Трек может быть удалён или недоступен.": "SoundCloud did not provide audio. The track may be removed or unavailable.",
    "Не удалось открыть ссылку SoundCloud.": "Could not open the SoundCloud link.",
    "Ответ источника слишком большой.": "The source response is too large.",
    "SoundCloud изменил страницу или закрыл к ней доступ.": "SoundCloud changed the page or restricted access.",
    "Нужна ссылка на один трек, а не профиль или плейлист.": "Use a link to one track, not a profile or playlist.",
    "Полная запись недоступна для загрузки.": "The full recording is not available for download.",
    "Поддерживаются треки длительностью до одного часа.": "Tracks up to one hour are supported.",
    "Формат потока не поддерживается.": "This stream format is not supported.",
    "Формат аудио не поддерживается.": "This audio format is not supported.",
    "Источник вернул неполную запись.": "The source returned an incomplete recording.",
    "У трека нет поддерживаемого открытого аудиопотока.": "This track has no supported public audio stream.",
    "SoundCloud не предоставил аудио.": "SoundCloud did not provide audio.",
    "Файл превышает 100 МБ.": "The file exceeds 100 MB.",
    "Сервис занят. Попробуйте позже.": "The service is busy. Try again later.",
    "Слишком много загрузок. Подождите минуту.": "Too many downloads. Wait a minute.",
    "Не удалось получить аудио. Попробуйте позже.": "Could not get the audio. Try again later.",

    "Загрузить по ссылке": "Import from link",
    "Скачать в медиатеку": "Download to library",
    "Отменить загрузку": "Cancel download",
    "Прямая ссылка на аудио · до 100 МБ": "Direct audio link · up to 100 MB",
    "Загрузка аудио": "Audio download",
    "Подключаюсь…": "Connecting…",
    "Сохраняю в медиатеку…": "Saving to library…",
    "Трек или альбом SoundCloud · до 100 МБ на трек": "SoundCloud track or album · up to 100 MB per track",
    "Поддерживаются альбомы до 100 треков.": "Albums with up to 100 tracks are supported.",
    "Не удалось получить альбом SoundCloud.": "Could not load the SoundCloud album.",
    "Альбом превышает 1 ГБ. Уже загруженные треки сохранены.": "Album exceeds 1 GB. Downloaded tracks have been saved.",
    "Загружаю обложку…": "Downloading artwork…",
    "Обложка сохранена": "Artwork saved",
    "Трек добавлен. Обложка временно недоступна.": "Track added. Artwork is temporarily unavailable.",
    "Трек уже есть. Обложка временно недоступна.": "Track already exists. Artwork is temporarily unavailable.",
    "Не удалось сохранить обложку. Проверьте свободное место и доступ к хранилищу браузера.": "Could not save artwork. Check free space and browser storage access.",
    "Трек добавлен в медиатеку": "Track added to library",
    "Этот файл уже есть в медиатеке": "This file is already in your library",
    "Загрузка заняла слишком много времени. Попробуйте ещё раз.": "The download took too long. Try again.",
    "Загрузка отменена": "Download cancelled",
    "Не удалось скачать файл. Сайт может запрещать загрузку по ссылке — попробуйте скачать файл вручную.": "Could not download the file. The website may block direct downloads; try downloading the file manually.",
    "Введите полную ссылку, начиная с https://": "Enter a full URL starting with https://",
    "Нужна ссылка HTTP или HTTPS без логина и пароля.": "Use an HTTP or HTTPS URL without a username or password.",
    "Загрузка со страниц SoundCloud ещё не подключена. Вставьте прямую ссылку на аудиофайл.": "SoundCloud page downloads are not connected yet. Paste a direct audio file URL.",
    "По ссылке не найден поддерживаемый аудиофайл.": "No supported audio file was found at this URL.",
    "Сайт не отдал файл. Проверьте ссылку и доступ к нему.": "The website did not return the file. Check the URL and access.",
    "Это ссылка на страницу или плейлист. Нужна прямая ссылка на аудиофайл.": "This links to a page or playlist. Use a direct audio file URL.",
    "Файл слишком большой. Максимум — 100 МБ.": "The file is too large. The limit is 100 MB.",
    "Этот браузер не поддерживает загрузку по ссылке.": "This browser does not support link downloads.",
    "По ссылке пришёл пустой файл.": "The URL returned an empty file.",
    "Не удалось прочитать аудио. Проверьте формат файла.": "Could not read the audio. Check the file format.",
    "Не удалось сохранить трек. Проверьте свободное место и доступ к хранилищу браузера.": "Could not save the track. Check free space and browser storage access.",

    // навигация и разделы
    'Главная': 'Home', 'Медиатека': 'Media library', 'Альбомы': 'Albums', 'Синглы': 'Singles', 'Плейлисты': 'Playlists', 'Артисты': 'Artists', 'Песни': 'Songs',
    'Поиск': 'Search', 'Библиотека': 'Library', 'Профиль': 'Profile', 'Настройки': 'Settings', 'Навигация': 'Navigation', 'Нижняя навигация': 'Bottom navigation',
    'Поиск по библиотеке': 'Search library', 'Новый плейлист': 'New playlist', 'Добавить музыку': 'Add music', 'Выбрать папку': 'Choose folder', 'Сменить тему': 'Switch theme',
    'Сменить тему (D)': 'Switch theme (D)', 'Понравившееся': 'Liked songs', 'Показать все': 'Show all', 'Назад': 'Back', 'Вперёд': 'Forward',
    'Миксы для вас': 'Mixes for you', 'Недавно прослушанное': 'Recently played', 'Микс': 'Mix', 'Альбом': 'Album', 'Сингл': 'Single', 'Плейлист': 'Playlist',
    'Создать': 'Create', 'Пока пусто': 'Nothing yet', 'Лента': 'Rail', 'Сетка': 'Grid', 'Список': 'List', 'Вид главной': 'Home layout',
    // миксы
    'Микс понравившегося': 'Liked mix', 'Ваши лайки в случайном порядке': 'Your likes in random order', 'Самое прослушиваемое': 'Most played',
    'Треки, которые вы включаете чаще всего': 'Tracks you play the most', 'Любимые артисты': 'Favourite artists', 'Слушайте и ставьте лайки — микс соберётся сам': 'Listen and like songs — the mix builds itself',
    'Давно не слушали': 'Haven’t played in a while', 'Любимое, что давно не звучало': 'Favourites you haven’t heard lately', 'Ещё не слушали': 'Not played yet',
    'Песни из библиотеки, до которых не дошли руки': 'Songs from your library you haven’t got to yet',
    // плеер
    'Играть': 'Play', 'Пауза': 'Pause', 'Играть / пауза': 'Play / pause', 'Перемешать': 'Shuffle', 'Предыдущий': 'Previous', 'Следующий': 'Next', 'Повтор': 'Repeat',
    'Нравится': 'Like', 'Звук': 'Sound', 'Громкость': 'Volume', 'Текст': 'Lyrics', 'Очередь': 'Queue', 'Развернуть': 'Expand', 'Свернуть': 'Collapse', 'Перемотка': 'Seek',
    'Ещё': 'More', 'Открыть Now Playing': 'Open Now Playing', 'Скрыть текст': 'Hide lyrics', 'Показать текст': 'Show lyrics', 'Показать или скрыть текст': 'Show or hide lyrics',
    'Для поиска текста нужен интернет': 'Connect to the internet to find lyrics', 'Поиск текста временно недоступен': 'Lyrics search is temporarily unavailable', 'Искать снова': 'Search again',
    'Изменить текст': 'Edit lyrics', 'Добавить текст': 'Add lyrics', 'Текст не найден': 'Lyrics not found', 'Ищу текст…': 'Looking for lyrics…', 'Очередь пуста': 'Queue is empty',
    'Запустите альбом, плейлист или трек — они появятся здесь.': 'Play an album, playlist or track — it will show up here.', 'Ранее': 'Earlier', 'Сейчас играет': 'Now playing', 'Далее': 'Up next',
    'Дальше ничего нет. Добавьте треки через меню «⋯».': 'Nothing up next. Add tracks from the «⋯» menu.', 'Убрать из очереди': 'Remove from queue', 'Очистить': 'Clear',
    'Отпустите, чтобы добавить': 'Drop to add',
    // меню трека
    'Играть следующим': 'Play next', 'В конец очереди': 'Add to queue', 'Добавить в плейлист…': 'Add to playlist…', 'Убрать из понравившихся': 'Remove from liked',
    'Найти на SoundCloud': 'Find on SoundCloud', 'Перейти к альбому': 'Go to album', 'Перейти к артисту': 'Go to artist', 'Убрать из плейлиста': 'Remove from playlist',
    'Переименовать': 'Rename', 'Экспорт в .m3u8': 'Export as .m3u8', 'Удалить плейлист': 'Delete playlist', 'Добавить в плейлист': 'Add to playlist',
    'Новый плейлист…': 'New playlist…', 'Создать и добавить': 'Create and add', 'Название': 'Name', 'Например, «Ночной драйв»': 'For example, “Night drive”',
    'Переименовать плейлист': 'Rename playlist', 'Сохранить': 'Save', 'Отмена': 'Cancel', 'Готово': 'Done', 'Закрыть': 'Close',
    // библиотека
    'Добавить': 'Add', 'Треки': 'Tracks', 'Папка': 'Folder', 'Импорт M3U / M3U8': 'Import M3U / M3U8', 'Артист': 'Artist', 'Недавно добавленные': 'Recently added',
    'Длительность': 'Duration', 'Здесь пока пусто': 'Nothing here yet', 'Добавьте свою музыку': 'Add your music', 'Выбрать файлы': 'Choose files',
    'Выбрать папку с музыкой': 'Choose music folder', 'Добавить треки': 'Add tracks',
    'Выберите одну папку с музыкой — вся медиатека загрузится из неё, как в Poweramp.': 'Choose one music folder — your whole library loads from it, like in Poweramp.',
    'Перетащите файлы или целую папку прямо в окно. Поддерживаются MP3, FLAC, AAC / M4A, OGG, WAV, тексты': 'Drag files or a whole folder into the window. Supported: MP3, FLAC, AAC / M4A, OGG, WAV, lyrics',
    'и плейлисты': 'and playlists', 'Не найдено': 'Not found', 'Возможно, библиотека была очищена.': 'The library may have been cleared.', 'На главную': 'Go home',
    'Последний релиз': 'Latest release', 'Топ-песни': 'Top songs', 'Синглы и EP': 'Singles & EPs', 'Совместные проекты': 'Collaborations', 'Похожие артисты': 'Similar artists',
    'Случайные песни артиста': 'Random songs by this artist', 'Плейлист пуст': 'Playlist is empty',
    'Откройте меню «⋯» у любого трека и выберите «Добавить в плейлист».': 'Open the «⋯» menu on any track and choose “Add to playlist”.',
    'Пока ничего нет': 'Nothing yet', 'Нажмите на сердечко рядом с треком — он появится здесь.': 'Tap the heart next to a track — it will appear here.',
    'Неизвестный артист': 'Unknown artist', 'Песни, альбомы, артисты, плейлисты': 'Songs, albums, artists, playlists',
    'Начните вводить — результаты появятся сразу.': 'Start typing — results appear instantly.', 'Ничего не найдено': 'Nothing found', 'откроется на сайте SoundCloud': 'opens on the SoundCloud website',
    // профиль
    'Изменить': 'Edit', 'Изменить имя': 'Change name', 'Изменить ник': 'Change username', 'песен': 'songs', 'релизов': 'releases', 'артистов': 'artists', 'нравится': 'liked',
    'плейлистов': 'playlists', 'Баннер': 'Banner', 'Аватар': 'Avatar', 'Сбросить': 'Reset', 'Отображаемое имя': 'Display name', 'Имя пользователя': 'Username', 'Слушатель': 'Listener',
    // настройки
    'Подстройте плеер под себя': 'Make the player your own', 'Внешний вид': 'Appearance', 'Тема оформления': 'Theme', 'Тёмная по умолчанию, светлая — для яркого дня.': 'Dark by default, light for a bright day.',
    'Тёмная': 'Dark', 'Светлая': 'Light', 'Главный экран': 'Home screen', 'Как показывать альбомы, синглы, плейлисты и артистов.': 'How to show albums, singles, playlists and artists.',
    'Скругление обложек': 'Cover corners', 'Мягкие или строгие углы.': 'Soft or sharp corners.', 'Мягкие': 'Soft', 'Острые': 'Sharp',
    'Плотность списков': 'List density', 'Компактный режим вмещает больше строк.': 'Compact mode fits more rows.', 'Свободно': 'Cozy', 'Компактно': 'Compact',
    'Анимации интерфейса': 'Interface animations', 'Выключите, если приложение работает на слабом устройстве.': 'Turn off on slower devices.',
    'Блок «Недавно прослушанное»': '“Recently played” section', 'Показывать на главной.': 'Show on the home screen.', 'Размер карточек': 'Card size', 'Обложки в рядах и сетках.': 'Covers in rails and grids.',
    'Мелкие': 'Small', 'Средние': 'Medium', 'Крупные': 'Large', 'Язык': 'Language', 'Язык интерфейса плеера.': 'Player interface language.',
    'Фон': 'Background', 'Плавающие «облака»': 'Floating “clouds”', 'Мягкое свечение, медленно двигающееся по фону.': 'A soft glow slowly drifting across the background.',
    'Большие ноты': 'Big notes', 'Полупрозрачные ноты на заднем плане.': 'Translucent notes in the background.', 'Пластинка': 'Vinyl record',
    'Виниловая пластинка крутится, пока играет музыка.': 'A vinyl record spins while music is playing.', 'Частицы': 'Particles', 'Лёгкие пузырьки медленно поднимаются вверх.': 'Light bubbles slowly rise up.',
    'Свечение от обложки': 'Cover glow', 'Фон подстраивается под текущий трек.': 'The background matches the current track.', 'Воспроизведение': 'Playback',
    'Тексты песен': 'Lyrics', 'Если в файле нет текста, плеер сам ищет его онлайн. Не нашёл — покажет «Текст не найден».': 'If a file has no lyrics, the player looks for them online. If none are found, it shows “No lyrics”.',
    'Найти тексты для всей библиотеки': 'Find lyrics for the whole library', 'Плеер сам проверит все песни без текста. Не нашёл — будет «Текст не найден».': 'The player checks every song without lyrics. If none are found, it shows “No lyrics”.',
    'Найти': 'Find', 'Показывать текст справа': 'Show lyrics on the right', 'Выключите, если хотите просто слушать: плеер плавно переедет в центр. Тот же переключатель есть в самом плеере.': 'Turn off if you just want to listen: the player slides to the centre. The same switch is in the player itself.',
    'Свой сервер текстов': 'Own lyrics server', 'Адрес вашего Cloudflare Worker: добавляет NetEase и Genius (см. папку worker).': 'Your Cloudflare Worker address: adds NetEase and Genius (see the worker folder).',
    'Указать': 'Set', 'Размер текста': 'Lyrics size', 'Строки в режиме караоке.': 'Synced lyrics lines.', 'Мелкий': 'Small', 'Средний': 'Medium', 'Крупный': 'Large',
    'Таймер сна': 'Sleep timer', 'Выкл': 'Off', 'Трек': 'Track', 'Шаг перемотки': 'Seek step', 'Стрелки ← / → на клавиатуре.': 'Keyboard ← / → arrows.',
    'Спектр в Now Playing': 'Spectrum in Now Playing', 'Анимация звука рядом с обложкой.': 'Sound animation next to the cover.', 'Приложение': 'App',
    'Заставка при запуске': 'Splash screen', 'Логотип и приветствие при открытии.': 'Logo and greeting on launch.', 'Папка с музыкой': 'Music folder',
    'Выберите одну папку — вся медиатека загрузится из неё, как в Poweramp.': 'Choose one folder — your whole library loads from it, like in Poweramp.',
    'Сменить': 'Change', 'Выбрать': 'Choose', 'Обновить': 'Refresh', 'Не гасить экран': 'Keep screen on', 'Пока играет музыка (если поддерживается).': 'While music is playing (if supported).',
    'Резервная копия': 'Backup', 'Плейлисты, лайки, настройки и профиль — в один файл.': 'Playlists, likes, settings and profile in one file.', 'Загрузить': 'Load',
    'Очистить историю на главной.': 'Clear the history on the home screen.', 'Сбросить настройки': 'Reset settings', 'Вернуть всё по умолчанию (музыка и плейлисты останутся).': 'Restore defaults (music and playlists stay).',
    'Горячие клавиши': 'Keyboard shortcuts', 'Пробел, стрелки, N / P, S, R, L, M, D, F, Q…': 'Space, arrows, N / P, S, R, L, M, D, F, Q…', 'Показать': 'Show',
    'Можно выбрать папку целиком или добавлять треки по одному. Сами файлы остаются на устройстве.': 'Pick a whole folder or add tracks one by one. The files stay on your device.',
    'Файлы хранятся только в вашем браузере (IndexedDB).': 'Files are stored only in your browser (IndexedDB).',
    // окна
    'Сбросить настройки?': 'Reset settings?', 'Вид, цвета, фон и остальные параметры вернутся к значениям по умолчанию. Музыка, плейлисты и профиль не затрагиваются.': 'Layout, colours, background and other options return to defaults. Music, playlists and profile are not affected.',
    'Очистить библиотеку?': 'Clear library?',
    'Кэш тегов и обложек будет удалён, а музыка в вашей папке останется нетронутой. Выберите папку заново, чтобы загрузить библиотеку. Лайки и плейлисты сохранятся, но треки в них станут недоступны.': 'The tag and cover cache will be deleted; the music in your folder stays untouched. Choose the folder again to load the library. Likes and playlists are kept, but their tracks become unavailable.',
    'Все добавленные файлы будут удалены из браузера. Лайки и плейлисты сохранятся, но треки в них станут недоступны.': 'All added files will be removed from the browser. Likes and playlists are kept, but their tracks become unavailable.',
    'Текст песни': 'Song lyrics', 'Текст песни…': 'Song lyrics…', 'Вставьте текст или загрузите файл': 'Paste the lyrics or load a', 'Из файла': 'From file', 'Удалить текст': 'Delete lyrics',
    '. Если в тексте есть метки времени вида': ' file. If the text has timestamps like', ', он будет идти как караоке.': ', it will scroll in sync with the song.',
    'Адрес Cloudflare Worker (https://…workers.dev)': 'Cloudflare Worker address (https://…workers.dev)',
    // горячие клавиши
    'Пробел': 'Space', 'Перемотка на 5 секунд': 'Seek 5 seconds', 'Предыдущий / следующий трек': 'Previous / next track', 'Выключить звук': 'Mute',
    'Повтор: выкл → все → один': 'Repeat: off → all → one', 'Следующий / предыдущий': 'Next / previous', 'Открыть / закрыть Now Playing': 'Open / close Now Playing',
    'Назад, в конце — на главную': 'Back, then to Home',
    // сообщения
    'Добавлено: следующим': 'Added: playing next', 'Добавлено в очередь': 'Added to queue', 'Здесь пока нет песен': 'No songs here yet', 'Проверяю папку…': 'Checking folder…',
    'Таймер сна выключен': 'Sleep timer off', 'Остановлюсь в конце трека': 'Will stop at the end of the track', 'Поиск уже идёт…': 'Search already running…',
    'У всех песен уже есть текст': 'All songs already have lyrics', 'История очищена': 'History cleared', 'Резервная копия сохранена': 'Backup saved', 'Копия загружена': 'Backup loaded',
    'Это не файл резервной копии Puro Cielo': 'This is not a Puro Cielo backup file', 'Не удалось прочитать изображение': 'Could not read the image',
    'Адрес должен начинаться с https://': 'The address must start with https://', 'Библиотека очищена': 'Library cleared', 'Плейлист сохранён как .m3u8': 'Playlist saved as .m3u8',
    'Не нашёл поддерживаемых файлов': 'No supported files found', 'В выбранной папке нет аудиофайлов': 'The chosen folder has no audio files', 'Не удалось прочитать папку': 'Could not read the folder',
    'Текст сохранён': 'Lyrics saved', 'Текст удалён': 'Lyrics deleted',
    'Скрыть очередь': 'Hide queue', 'Одинаковая громкость': 'Even volume', 'Тихие песни звучат громче, громкие — тише, и не нужно тянуться к регулятору. Плеер измеряет громкость, когда песня включается первый раз; файлы не меняются.': 'Quiet songs play louder and loud ones quieter, so you don’t reach for the volume. The player measures loudness the first time a song plays; files are not changed.',
    'Мини-плеер в отдельном окне': 'Mini player in a separate window', 'Порядок в медиатеке': 'Library clean-up', 'Песни без данных': 'Songs with missing info', 'Дубликаты': 'Duplicates', 'Открыть': 'Open',
    'Песни без артиста, обложки или текста. Плеер попробует найти всё сам.': 'Songs without an artist, cover or lyrics. The player will try to find everything itself.',
    'Песни, которые есть в медиатеке дважды. Лишние копии можно удалить одной кнопкой.': 'Songs that are in your library twice. Extra copies can be removed with one button.',
    'Повторов нет': 'No duplicates', 'Повторов не найдено': 'No duplicates found', 'Плеер сравнил названия, артистов и длину всех песен — одинаковых нет.': 'The player compared titles, artists and lengths of all songs — none are the same.',
    'Оставить': 'Keep', 'Лишняя': 'Extra', 'Удалить все лишние': 'Delete all extras', 'Удалить лишнюю копию?': 'Delete the extra copy?', 'Удалить лишние копии?': 'Delete extra copies?', 'Настройки': 'Settings', 'Слушать': 'Play',
    'Повтор — это песня с тем же названием, артистом и длиной. В каждой группе плеер оставляет лучшую копию: без потерь качества, с большим битрейтом, с обложкой и текстом.': 'A duplicate is a song with the same title, artist and length. In each group the player keeps the best copy: lossless, higher bitrate, with a cover and lyrics.',
    'Всё на месте': 'Nothing is missing', 'У каждой песни есть артист, обложка и текст.': 'Every song has an artist, a cover and lyrics.', 'Исправить всё': 'Fix everything', 'Ищу обложки…': 'Looking for covers…',
    '«Исправить всё» по очереди ищет артистов (по названию и длине песни), обложки и тексты. Найденное записывается в плеере, сами файлы не меняются. Любую песню можно поправить и вручную — через «⋯» в её строке.': '“Fix everything” looks for artists (by song title and length), covers and lyrics in turn. What it finds is saved in the player; the files are not changed. You can also fix any song by hand via “⋯” in its row.',
    'В файле не указан артист.': 'The file has no artist.', 'Нет картинки ни в файле, ни в плеере.': 'No picture in the file or in the player.', 'Текст ещё не найден или его нет в открытых источниках.': 'Lyrics not found yet, or not available in open sources.',
    'Нет интернета — искать негде': 'No internet — nowhere to search', 'Ничего не играет.': 'Nothing is playing.', 'Открыть плеер': 'Open player',
    'Браузер не дал открыть окошко. Разрешите всплывающие окна для этого сайта.': 'The browser blocked the window. Allow pop-ups for this site.', 'Фото артиста': 'Artist photo', 'Выбрать фото…': 'Choose a photo…', 'Убрать фото': 'Remove photo', 'Фото артиста обновлено': 'Artist photo updated', 'Фото убрано': 'Photo removed', 'Продолжить': 'Continue', 'Слушать дальше': 'Keep listening', 'Открыть альбом': 'Open album', 'Перемешать всё': 'Shuffle all', 'Быстрые кнопки': 'Quick buttons', 'Выше': 'Move up', 'Ниже': 'Move down', 'Порядок разделов на главной: стрелками двигайте выше или ниже, выключателем — скрывайте.': 'Order of sections on the home page: move them with the arrows, hide them with the switch.', 'Если у песни или альбома нет обложки, плеер найдёт её сам. Заодно найдёт фото артистов.': 'If a song or album has no cover, the player finds one itself. It also finds artist photos.', 'Удалить песню?': 'Delete this song?', 'Удалить песню': 'Delete song', 'Удалить из медиатеки': 'Delete from library', 'Удалить': 'Delete', 'Добавить копию песни?': 'Add a copy of the song?', 'Добавить копии песен?': 'Add copies of the songs?', 'Добавить копию': 'Add a copy', 'Добавить копии': 'Add copies', 'Не добавлять': 'Don’t add', 'Фон от обложки': 'Background from cover', 'Тёмная тема: чёрный фон и мягкое свечение в цвет обложки. Светлая тема: свет от самой обложки.': 'Dark theme: black background with a soft glow in the cover colour. Light theme: light from the cover itself.', 'Движение фона': 'Background motion', 'Свет от обложки медленно плывёт.': 'The light from the cover drifts slowly.', 'Искать обложки': 'Find covers', 'Если у песни или альбома нет обложки, плеер найдёт её сам (iTunes, MusicBrainz).': 'If a song or album has no cover, the player finds one itself (iTunes, MusicBrainz).', 'Убирать приписки сайтов': 'Remove site tags', 'Например, «Династия (Sefon.Pro)» → «Династия». Файлы не меняются.': 'For example, “Song (Sefon.Pro)” → “Song”. Files aren’t changed.',  'Живой градиент': 'Living gradient', 'Цвета обложки играющей песни медленно перетекают по фону.': 'Colours from the playing song’s cover slowly flow across the background.', 'Звёздная пыль': 'Stardust', 'Мерцающие искры, которые оживают в такт музыке.': 'Twinkling sparks that come alive with the beat.', 'Цвета из обложки': 'Colours from the cover', 'Фон и искры окрашиваются в цвета текущего трека.': 'The background and sparks take on the current track’s colours.', 'Это не тот текст': 'Wrong lyrics', 'Ищу другой текст…': 'Looking for other lyrics…', 'Нашёл другой вариант': 'Found another version', 'Другого текста не нашлось — можно добавить свой через карандаш': 'No other lyrics found — you can add your own with the pencil', 'Firebase не пускает к данным синхронизации: опубликуйте новые правила Firestore (файл AUTH-SETUP.md в репозитории).': 'Firebase denies access to sync data: publish the new Firestore rules (AUTH-SETUP.md in the repository).', 'Нет связи с сервером — синхронизирую, когда появится интернет.': 'No connection to the server — will sync when the internet is back.', 'Текст и обложка': 'Lyrics and cover', 'Обложка трека…': 'Track cover…', 'Обложка трека обновлена': 'Track cover updated',
    'Вернуть обложку из файла': 'Restore cover from file', 'Обложка альбома…': 'Album cover…', 'Обложка сингла…': 'Single cover…',
    'Обложка альбома обновлена': 'Album cover updated', 'Обложка сингла обновлена': 'Single cover updated',
    // 1.9: аккаунт, переход, эквалайзер, итоги, умные плейлисты, данные трека, перевод
    'Аккаунт': 'Account', 'Синхронизация между устройствами': 'Sync between devices', 'Войти по почте': 'Sign in with email', 'Выйти': 'Sign out', 'Сейчас': 'Now',
    'Войдите тем же аккаунтом, что на сайте, — лайки, плейлисты, прослушивания, обложки, точные тексты песен и настройки станут общими для телефона и компьютера. Музыка остаётся на каждом устройстве.': 'Sign in with the same account as on the website — likes, playlists, plays, covers, exact lyrics and settings become shared between your phone and computer. Music stays on each device.',
    'Вход в аккаунт Puro Cielo': 'Sign in to Puro Cielo', 'Почта': 'Email', 'Пароль': 'Password', 'Войти': 'Sign in',
    'Тот же аккаунт, что на сайте Puro Cielo. Нет аккаунта — нажмите «Создать».': 'The same account as on the Puro Cielo website. No account yet? Press “Create”.',
    'Вы вошли — синхронизация включена': 'Signed in — sync is on', 'Синхронизирую…': 'Syncing…', 'Аккаунт Puro Cielo': 'Puro Cielo account',
    'Неверная почта или пароль': 'Wrong email or password', 'Такого аккаунта нет': 'No such account', 'Эта почта уже зарегистрирована — войдите': 'This email is already registered — sign in',
    'Пароль слишком короткий (нужно от 6 символов)': 'Password is too short (6+ characters)', 'Неверный адрес почты': 'Invalid email address', 'Окно входа закрыто': 'Sign-in window closed',
    'Нет интернета': 'No internet connection', 'Здесь этот способ входа не работает — войдите по почте': 'This sign-in method doesn’t work here — use email', 'Этот адрес не разрешён в настройках Firebase': 'This address isn’t allowed in Firebase settings',
    'Переход между треками': 'Track transitions', 'Плавный: конец песни затихает, следующая нарастает. «Без пауз» — для альбомов, где песни перетекают одна в другую.': 'Crossfade: one song fades out while the next fades in. “Gapless” is for albums where songs flow into each other.',
    'Обычный': 'Normal', 'Без пауз': 'Gapless', 'Эквалайзер': 'Equalizer', 'Подстройка звука: готовая настройка или своя.': 'Shape the sound: a preset or your own.',
    'Без изменений': 'Flat', 'Больше баса': 'Bass boost', 'Голос': 'Vocal', 'Больше высоких': 'Treble boost', 'Громко и ярко': 'Loud & bright', 'Мягко': 'Soft', 'Своя': 'Custom',
    'Итоги': 'Stats', 'Что и сколько вы слушали': 'What and how much you listened to', 'Неделя': 'Week', 'Месяц': 'Month', 'Год': 'Year', 'Всё время': 'All time',
    'музыки': 'of music', 'прослушиваний': 'plays', 'разных песен': 'different songs', 'артистов': 'artists', 'Самые прослушиваемые песни': 'Most played songs', 'По дням недели': 'By day of week',
    'Пн': 'Mon', 'Вт': 'Tue', 'Ср': 'Wed', 'Чт': 'Thu', 'Пт': 'Fri', 'Сб': 'Sat', 'Вс': 'Sun', 'Пока нечего считать': 'Nothing to count yet',
    'Прослушивание засчитывается после 30 секунд песни. Послушайте музыку — итоги появятся здесь.': 'A play counts after 30 seconds of a song. Listen to some music — your stats will appear here.',
    'Умный плейлист': 'Smart playlist', 'Новый умный плейлист': 'New smart playlist', 'Собирается сам по правилам': 'Builds itself from rules', 'Только понравившиеся': 'Liked songs only',
    'Артист содержит': 'Artist contains', 'Жанр содержит': 'Genre contains', 'Прослушано не меньше, раз': 'Played at least, times', 'Не слушали дней': 'Not played for days',
    'Добавлены за последние дней': 'Added in the last days', 'Не больше песен': 'At most songs', 'Порядок': 'Order', 'Случайный': 'Random', 'Чаще слушаю': 'Most played', 'По названию': 'By title',
    'любой': 'any', 'неважно': 'any', 'когда угодно': 'any time', 'без ограничения': 'no limit', 'Например, «Любимое, но забытое»': 'For example, “Loved but forgotten”',
    'Изменить правила': 'Edit rules', 'Сохранить как обычный плейлист': 'Save as a regular playlist', 'Под правила пока ничего не подходит': 'Nothing matches the rules yet',
    'Измените правила в меню «⋯» — плейлист обновится сам.': 'Change the rules in the «⋯» menu — the playlist updates itself.', 'Все песни библиотеки': 'All songs in the library',
    'Данные трека…': 'Track info…', 'Данные трека': 'Track info', 'Найти в MusicBrainz': 'Find on MusicBrainz', 'Ищу…': 'Searching…',
    'Выберите подходящий вариант:': 'Pick the matching one:', 'Ничего не найдено — попробуйте изменить название или артиста.': 'Nothing found — try changing the title or artist.',
    'MusicBrainz сейчас недоступен — попробуйте позже.': 'MusicBrainz is unavailable right now — try later.', 'Вернуть из файла': 'Restore from file', 'Данные трека — снова из файла': 'Track info restored from file',
    'Данные трека сохранены': 'Track info saved', 'Файл не меняется — данные хранятся в плеере. Поиск текста песни пойдёт уже по новым данным.': 'The file isn’t changed — the info is stored in the player. Lyrics will be searched with the new info.',
    'Перевод текста': 'Translate lyrics', 'Скрыть перевод': 'Hide translation', 'Перевод сейчас недоступен (лимит бесплатного сервиса — несколько песен в день)': 'Translation is unavailable right now (the free service allows a few songs per day)',
    'Резервная копия': 'Backup', 'Плейлисты, лайки, настройки и профиль — в один файл.': 'Playlists, likes, settings and profile in one file.',
};
// Строки с подставленными значениями
const R = [
    [/^(Доброй ночи|Доброе утро|Добрый день|Добрый вечер), (.+)$/, (m, g, n) => ({ 'Доброй ночи': 'Good night', 'Доброе утро': 'Good morning', 'Добрый день': 'Good afternoon', 'Добрый вечер': 'Good evening' }[g] + ', ' + (n === 'Слушатель' ? 'Listener' : n))],
    [/^(.+) и не только$/, (m, a) => `${a} and more`],
    [/^Скорость: (.+)$/, (m, v) => `Speed: ${v.replace(',', '.')}`],
    [/^([\d,.]+)×$/, (m, v) => `${v.replace(',', '.')}×`],
    [/^Повтор: (выкл|все|один)$/, (m, v) => `Repeat: ${{ выкл: 'off', все: 'all', один: 'one' }[v]}`],
    [/^Синхронизация включена: лайки, плейлисты, прослушивания, обложки, точные тексты песен и настройки одинаковые на всех ваших устройствах\.(?: Последний раз: (.+)\.)?$/, (m, w) => `Sync is on: likes, playlists, plays, covers, exact lyrics and settings are the same on all your devices.${w ? ` Last synced: ${w}.` : ''}`],
    [/^Сейчас подходит: (.+)$/, (m, n) => `Matching now: ${n}`],
    [/^Обложку — на весь альбом «(.+)»$/, (m, n) => `Use the cover for the whole album “${n}”`],
    [/^Не удалось войти: (.+)$/, (m, e) => `Couldn’t sign in: ${e}`],
    [/^(\d+) мин$/, (m, n) => `${n} min`],
    [/^(\d+) ч$/, (m, n) => `${n} h`],
    [/^(\d+) Гц$/, (m, n) => `${n} Hz`],
    [/^Умный · (.+)$/, (m, n) => `Smart · ${n}`],
    [/^(.+)$/, (m, x) => (/^(понравившиеся|артист: |жанр: |прослушано от |не слушали |добавлены за |не больше )/.test(x) ? x.split(' · ').map(p => p === 'понравившиеся' ? 'liked' : p.replace(/^артист: /, 'artist: ').replace(/^жанр: /, 'genre: ').replace(/^прослушано от (\d+) раз$/, 'played $1+ times').replace(/^не слушали (\d+) дн\.$/, 'not played for $1 days').replace(/^добавлены за (\d+) дн\.$/, 'added in $1 days').replace(/^не больше (\d+)$/, 'at most $1')).join(' · ') : undefined)],
    [/^Далее · (\d+)$/, (m, n) => `Up next · ${n}`],
    [/^(\d+) с$/, (m, n) => `${n} s`],
    [/^([\d,.]+) кГц$/, (m, v) => `${v.replace(',', '.')} kHz`],
    [/^(≈ )?([\d\s  ,.]+) кбит\/с$/, (m, a, v) => `${a || ''}${v.replace(/[\s  ]/g, ',')} kbps`],
    [/^(\d+) бит$/, (m, n) => `${n}-bit`],
    [/^(.*) · Сингл(.*)$/, (m, a, b) => `${a} · Single${b}`],
    [/^· Сингл$/, () => '· Single'],
    [/^Искать «(.+)» на SoundCloud$/, (m, q) => `Search “${q}” on SoundCloud`],
    [/^По запросу «(.+)» в вашей библиотеке нет совпадений\.$/, (m, q) => `Nothing in your library matches “${q}”.`],
    [/^(.+)\. Слушайте музыку и ставьте лайки — микс обновится сам\.$/, (m, d) => `${tr(d)}. Listen and like songs — the mix updates itself.`],
    [/^Выбрана: (.+)\. Новые файлы подхватываются при каждом запуске\.$/, (m, f) => `Selected: ${f}. New files are picked up on every launch.`],
    [/^Музыка плавно затихнет и остановится\. Сейчас: (.+)\.$/, (m, v) => `Music fades out and stops. Now: ${v === 'выключен' ? 'off' : v === 'до конца трека' ? 'until the end of the track' : v.replace(/^ещё (\d+) мин$/, '$1 min left')}.`],
    [/^Таймер сна: (\d+) мин$/, (m, n) => `Sleep timer: ${n} min`],
    [/^Добавлено в «(.+)»$/, (m, n) => `Added to “${n}”`],
    [/^Уже в «(.+)»$/, (m, n) => `Already in “${n}”`],
    [/^«(.+)»: добавлено (.+)$/, (m, n, c) => `“${n}”: added ${c}`],
    [/^«(.+)» уже есть в медиатеке\. Вы хотите добавить копию песни\?$/, (m, n) => `“${n}” is already in your library. Do you want to add a copy?`],
    [/^В медиатеке уже есть (\d+) из этих песен\. Вы хотите добавить копии\?$/, (m, n) => `${n} of these songs are already in your library. Do you want to add copies?`],
    [/^«(.+)» исчезнет из медиатеки, плейлистов и понравившихся\. Сам файл на устройстве останется\.$/, (m, n) => `“${n}” will disappear from the library, playlists and liked songs. The file itself stays on your device.`],
    [/^Песня «(.+)» удалена$/, (m, n) => `“${n}” deleted`],
    [/^Лишних копий: (\d+)$/, (m, n) => `Extra copies: ${n}`],
    [/^Удалить лишние \((\d+)\)$/, (m, n) => `Delete extras (${n})`],
    [/^Удалено лишних копий: (\d+)$/, (m, n) => `Extra copies deleted: ${n}`],
    [/^Будет удалено песен: (\d+)\. В каждой группе останется лучшая копия; лайки и плейлисты перейдут на неё\. Сами файлы на устройстве останутся\.$/, (m, n) => `${n} songs will be deleted. The best copy stays in each group; likes and playlists move to it. The files themselves stay on your device.`],
    [/^Чего-то не хватает у (\d+) из (\d+) песен$/, (m, a, b) => `${a} of ${b} songs are missing something`],
    [/^(Без артиста|Без обложки|Без текста) · (\d+)$/, (m, k, n) => `${{ 'Без артиста': 'No artist', 'Без обложки': 'No cover', 'Без текста': 'No lyrics' }[k]} · ${n}`],
    [/^…и ещё (\d+)$/, (m, n) => `…and ${n} more`],
    [/^(Артисты|Тексты): (\d+) из (\d+)$/, (m, k, a, b) => `${k === 'Артисты' ? 'Artists' : 'Lyrics'}: ${a} of ${b}`],
    [/^Готово\. Найдено: артистов — (\d+), обложек — (\d+), текстов — (\d+)\. Осталось без данных: (\d+)\.$/, (m, a, c, t, l) => `Done. Found: artists — ${a}, covers — ${c}, lyrics — ${t}. Still missing info: ${l}.`],
    [/^Плейлист «(.+)» создан$/, (m, n) => `Playlist “${n}” created`],
    [/^Плейлист «(.+)» удалён$/, (m, n) => `Playlist “${n}” deleted`],
    [/^Плейлист «(.+)»: (\d+) треков(?:, не найдено: (\d+))?$/, (m, n, a, b) => `Playlist “${n}”: ${a} tracks${b ? `, not found: ${b}` : ''}`],
    [/^Плейлист «(.+)»: ни один трек не найден в библиотеке — сначала добавьте музыку$/, (m, n) => `Playlist “${n}”: no tracks found in the library — add music first`],
    [/^Не удалось воспроизвести «(.+)»\. Возможно, формат не поддерживается\.$/, (m, n) => `Could not play “${n}”. The format may not be supported.`],
    [/^Библиотека восстановлена: (\d+)$/, (m, n) => `Library restored: ${n}`],
    [/^Ищу тексты: (\d+) песен…$/, (m, n) => `Looking for lyrics: ${n} songs…`],
    [/^Готово: найдено (\d+) из (\d+)\. Остальные — «Текст не найден»\.$/, (m, a, b) => `Done: found ${a} of ${b}. The rest show “Lyrics not found”.`],
    [/^Загружаю (\d+) (файл|файлов)…$/, (m, n) => `Loading ${n} file${n === '1' ? '' : 's'}…`],
    [/^Сканирую папку «(.*)»: (\d+) (файл|файлов)…$/, (m, f, n) => `Scanning folder “${f}”: ${n} file${n === '1' ? '' : 's'}…`],
    [/^Для «(.+)» не найден трек с таким именем$/, (m, n) => `No track with a matching name for “${n}”`],
    [/^Не удалось прочитать папку: (.+)$/, (m, e) => `Could not read the folder: ${e}`],
    [/^(?:(?:добавлено|удалено|уже были|не удалось прочитать|текстов \.lrc): \d+(?: · )?)+$/, m => m.replace(/добавлено/g, 'added').replace(/удалено/g, 'removed').replace(/уже были/g, 'already there').replace(/не удалось прочитать/g, 'unreadable').replace(/текстов \.lrc/g, '.lrc lyrics')],
];
// Формы множественного числа для plural()
export const EN_PLURAL = { 'песня': ['song', 'songs'], 'трек': ['track', 'tracks'], 'альбом': ['album', 'albums'], 'сингл': ['single', 'singles'], 'файл': ['file', 'files'], 'раз': ['time', 'times'], 'прослушивание': ['play', 'plays'] };
export function tr(s) {
    if (lang !== 'en' || !s || !/[А-Яа-яЁё]/.test(s))
        return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    let out = D[core];
    if (out === undefined)
        for (const [re, f] of R) {
            const x = re.exec(core);
            const r = x ? f(...x) : undefined;
            if (r !== undefined) {
                out = r;
                break;
            }
        }
    return out === undefined ? s : m[1] + out + m[3];
}
// ---------- перевод страницы ----------
const SKIP = '.ly,.ly-plain,#np-title,#mini-title,.row-title,.trow-title,.q-text b,textarea,script,style,[data-notr]';
const ATTRS = ['aria-label', 'title', 'placeholder'];
const origText = new WeakMap(), wroteText = new WeakMap(), origAttr = new WeakMap();
function doText(n) {
    const p = n.parentElement;
    if (!p || p.closest(SKIP))
        return;
    if (wroteText.get(n) === n.data)
        return; // это мы сами записали
    origText.set(n, n.data);
    const t = tr(n.data);
    if (t !== n.data) {
        wroteText.set(n, t);
        n.data = t;
    }
    else
        wroteText.delete(n);
}
function doAttrs(el) {
    if (el.closest(SKIP))
        return;
    let o = origAttr.get(el);
    for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v == null)
            continue;
        if (o && o[a] && o[a].w === v)
            continue;
        const t = tr(v);
        if (!o)
            origAttr.set(el, o = {});
        o[a] = { ru: v, w: t };
        if (t !== v)
            el.setAttribute(a, t);
    }
}
function walk(root) {
    if (root.nodeType === 3)
        return doText(root);
    if (root.nodeType !== 1)
        return;
    doAttrs(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = it.nextNode()))
        n.nodeType === 3 ? doText(n) : doAttrs(n);
}
// обратно на русский: возвращаем запомненные исходные строки
function restore(root) {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = root;
    do {
        if (n.nodeType === 3) {
            const o = origText.get(n);
            if (o !== undefined && wroteText.get(n) === n.data)
                n.data = o;
            wroteText.delete(n);
        }
        else if (n.nodeType === 1) {
            const o = origAttr.get(n);
            if (o)
                for (const a of ATTRS)
                    if (o[a] && n.getAttribute(a) === o[a].w)
                        n.setAttribute(a, o[a].ru);
            origAttr.delete(n);
        }
    } while ((n = it.nextNode()));
}
let observer = null;
export function initI18n(l) {
    observer = new MutationObserver(list => {
        if (lang !== 'en')
            return;
        for (const m of list) {
            if (m.type === 'childList')
                m.addedNodes.forEach(walk);
            else if (m.type === 'characterData')
                doText(m.target);
            else if (m.type === 'attributes')
                doAttrs(m.target);
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    setLang(l);
}
export function setLang(l) {
    const next = l === 'en' ? 'en' : 'ru';
    const was = lang;
    lang = next;
    document.documentElement.lang = next;
    if (next === 'en')
        walk(document.body);
    else if (was === 'en')
        restore(document.body);
}
