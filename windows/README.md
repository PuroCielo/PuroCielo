# Puro Cielo для Windows

Оболочка восстановлена из официального установщика 1.7.0. Теперь Windows собирает тот же плеер из `web/`, что сайт и Android. Профиль хранится в прежнем `%APPDATA%/puro-cielo`; удаление приложения не удаляет медиатеку.

На Windows с Node.js 24:

```sh
npm install --prefix web
npm ci --prefix windows
npm run prepare-player --prefix windows
npm test --prefix windows
npm run build --prefix windows
npm run smoke --prefix windows
```

Установщик: `windows/dist/PuroCielo-Setup.exe`. Workflow **Release Windows** собирает его и проверяет запуск упакованного приложения, импорт WAV, воспроизведение, паузу и отдельное окно мини-плеера. Затем публикует релиз `windows-<версия>`. Версия берётся из `web/package.json`.

В приложениях вход для синхронизации доступен по почте. Google OAuth используйте на сайте; встроенные окна Electron/WebView не поддерживают этот сценарий входа. Для аккаунта Google можно задать пароль через «Забыли пароль?» на сайте.
