# Вход через Google, почту и другие способы

Сайт использует бесплатную службу Firebase Authentication. Это нужно сделать один раз (10 минут):

1. Откройте https://console.firebase.google.com → **Add project** (название любое, аналитику можно выключить).
2. Слева **Build → Authentication → Get started**. Во вкладке **Sign-in method** включите:
   - **Email/Password**;
   - **Google** (укажите почту поддержки);
   - **GitHub** (нужно создать OAuth App на github.com/settings/developers; Firebase покажет ссылку обратного вызова, а Client ID и Secret вставьте в Firebase);
   - **Microsoft** (по желанию, нужно приложение в Azure).
3. **Authentication → Settings → Authorized domains → Add domain**: добавьте `artemriligin-ops.github.io` и свой домен, когда он появится.
4. **Project settings (шестерёнка) → General → Your apps → Web (</>)** → зарегистрируйте приложение и скопируйте объект `firebaseConfig`.
5. Вставьте значения `apiKey`, `authDomain`, `projectId`, `appId` в файл `firebase-config.js` и сохраните (Commit).

После этого блок «Аккаунт» на сайте начнёт работать. Ключ `apiKey` не секретный, его можно хранить в репозитории.
