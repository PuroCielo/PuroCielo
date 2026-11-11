# Puro Cielo

Музыкальный плеер для своих файлов: Windows, Android и браузер. Сайт — https://purocielo.github.io/PuroCielo/

## Где что лежит
- `index.html`, `site-i18n.js`, `auth.js`, `assets/` — сайт (лендинг, RU/EN, вход в аккаунт, скриншоты, превью для ссылок)
- `web/` — **исходники веб-плеера** (их и правьте):
  - `web/js/*.js` — модули, `web/css/styles.css` — стили, `web/index.src.html` — разметка
  - `web/package.json` — **версия всего проекта** (сайт, плеер, Android)
  - `node web/build.js` — собирает плеер (нужен TypeScript: `npm i -g typescript`)
- Собранное (руками не править, перезаписывается сборкой):
  - `app/` — плеер на сайте (один файл, открывается и двойным кликом)
  - `android/app/src/main/assets/www/` — плеер внутри Android-приложения
- `android/` — оболочка для Android; `worker/lyrics-proxy.js` — свой сервер текстов (Cloudflare Worker)
- `AUTH-SETUP.md` — настройка входа и синхронизации (Firebase)

## Сборка и выпуск
При пуше в `web/**` или `android/**` GitHub Actions (**Build**) сам собирает плеер и APK и выкладывает APK в
[Releases](https://github.com/PuroCielo/PuroCielo/releases). Кнопка на сайте всегда ведёт на последний APK.
Установщик для Windows лежит в отдельном релизе (`windows-…`), выкладывается через Actions → **Release Windows**.

Чтобы выпустить новую версию: поменяйте `version` в `web/package.json` и запушьте.
