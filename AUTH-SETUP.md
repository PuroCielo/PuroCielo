# Вход через Google, почту и другие способы (Firebase)

Всё это бесплатно и делается один раз. Нужен только аккаунт Google.

## 1. Создайте проект
1. Откройте https://console.firebase.google.com и нажмите **Create a project** (название: `purocielo`, Google Analytics можно выключить).

## 2. Включите способы входа
1. Слева **Build → Authentication → Get started → Sign-in method**.
2. Включите **Email/Password** (первый переключатель, «Email link» не нужен) и **Google** (выберите почту поддержки).
3. **GitHub** (по желанию): в Firebase откройте GitHub → скопируйте «callback URL». На github.com → Settings → Developer settings → OAuth Apps → New OAuth App: Homepage — адрес вашего сайта, Callback — тот URL. Полученные Client ID и Client secret вставьте обратно в Firebase.
4. **Microsoft** (по желанию): аналогично через Azure App registrations.

## 3. Разрешите адрес сайта
**Authentication → Settings → Authorized domains → Add domain**: добавьте `artemriligin-ops.github.io` (адрес вашего GitHub Pages без `https://` и без пути; смотрите в Settings → Pages) и свой домен, если он есть.

## 4. Включите базу данных для ников
1. **Build → Firestore Database → Create database** → режим **Production** → регион на ваш выбор.
2. Вкладка **Rules**, замените всё этим и нажмите **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Ник можно только занять один раз и нельзя отнять или изменить.
    match /usernames/{name} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.uid == request.auth.uid
        && name.matches('^[a-z0-9_.]{3,24}$');
      allow update, delete: if false;
    }
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid
        && getAfter(/databases/$(database)/documents/usernames/$(request.resource.data.username)).data.uid == uid;
      allow update, delete: if false;
    }
    // Синхронизация плеера: каждый читает и пишет только свои данные.
    match /sync/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /blobs/{id} {
        allow read, write: if request.auth != null && request.auth.uid == uid
          && (request.resource == null || request.resource.data.data.size() < 900000);
      }
    }
  }
}
```

> **Обновление 1.9 — синхронизация в плеере.** Если правила уже были опубликованы раньше, замените их целиком
> текстом выше (добавился блок `match /sync/{uid}`) и снова нажмите **Publish**. Без этого вход в плеере сработает,
> но синхронизация покажет ошибку `permission-denied`.

Так два человека не смогут занять одинаковый ник даже одновременно.

## 5. Скопируйте ключи в сайт
1. **Project settings (шестерёнка) → General → Your apps → значок Web `</>`** → введите название → Register app.
2. Скопируйте блок `firebaseConfig`.
3. На GitHub откройте файл `firebase-config.js` → карандаш → вставьте значения `apiKey`, `authDomain`, `projectId`, `appId` → Commit.

Через минуту блок «Аккаунт» на сайте заработает. Ключ `apiKey` не секретный, его можно хранить в репозитории.
