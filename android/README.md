# Puro Cielo — Android

Оболочка (WebView) вокруг плеера: вся медиатека грузится из ОДНОЙ папки (как в Poweramp), музыка играет в фоне.

## Как получить APK
APK собирается сам при каждом пуше (Actions → **Build**) и выкладывается в Releases:
https://github.com/PuroCielo/PuroCielo/releases/latest/download/PuroCielo.apk

Либо откройте папку в Android Studio и нажмите Build → Build APK(s). Версия берётся из `web/package.json`.

## Использование
Первый запуск → «Выбрать папку с музыкой» → выберите папку. Новые файлы подхватываются при каждом запуске, кнопка «Обновить» — в Настройках.

Плеер лежит в `app/src/main/assets/www` — это сборка из `web/` (`node web/build.js`), руками его не правьте.
