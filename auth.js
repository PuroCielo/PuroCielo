import { firebaseConfig } from './firebase-config.js';
const $ = s => document.querySelector(s);
const V = '10.12.2', G = `https://www.gstatic.com/firebasejs/${V}`;
const msg = (t, ok) => { const el = $('#auth-msg'); el.textContent = t || ''; el.className = 'note' + (ok ? ' ok' : ''); };
const ERR = {
  'auth/invalid-email': 'Некорректный адрес почты.', 'auth/missing-password': 'Введите пароль.', 'auth/weak-password': 'Пароль слишком простой: минимум 6 символов.',
  'auth/email-already-in-use': 'Эта почта уже зарегистрирована. Попробуйте войти.', 'auth/invalid-credential': 'Неверная почта или пароль.', 'auth/user-not-found': 'Такого аккаунта нет.',
  'auth/wrong-password': 'Неверный пароль.', 'auth/too-many-requests': 'Слишком много попыток. Подождите немного.', 'auth/popup-closed-by-user': 'Окно входа закрыто.',
  'auth/popup-blocked': 'Браузер заблокировал окно входа. Разрешите всплывающие окна.', 'auth/account-exists-with-different-credential': 'Эта почта уже используется с другим способом входа.',
  'auth/unauthorized-domain': 'Этот адрес сайта не добавлен в Firebase (Authentication → Settings → Authorized domains).', 'auth/operation-not-allowed': 'Этот способ входа не включён в Firebase.',
  'auth/network-request-failed': 'Нет соединения с интернетом.',
};
const RESERVED = new Set(['admin', 'administrator', 'support', 'help', 'root', 'system', 'puro', 'cielo', 'moderator', 'staff', 'official', 'null', 'undefined']);
const cleanUser = v => String(v || '').trim().replace(/^@+/, '').toLowerCase();
function checkUser(n) {
  if (!/^[a-z0-9_.]{3,24}$/.test(n)) return 'Ник: 3–24 символа, только латинские буквы, цифры, точка и _.';
  if (RESERVED.has(n)) return 'Этот ник зарезервирован.';
  return '';
}
const human = e => ERR[e && e.code] || (e && e.message === 'taken' ? 'Этот ник уже занят. Выберите другой.' : 'Не получилось. Попробуйте ещё раз.');

(async () => {
  // Пока SDK загружается, форма не должна отправляться обычным GET-запросом.
  $('#auth-form').addEventListener('submit', e => e.preventDefault());
  const busy = on => document.querySelectorAll('#auth-on button').forEach(b => { b.disabled = on; });
  busy(true);
  if (!firebaseConfig.apiKey) { $('#auth-off').hidden = false; $('#auth-on').hidden = true; return; }
  let A, F;
  try {
    const [{ initializeApp }, auth, fs] = await Promise.all([import(`${G}/firebase-app.js`), import(`${G}/firebase-auth.js`), import(`${G}/firebase-firestore.js`)]);
    A = auth; F = fs; var app = initializeApp(firebaseConfig); var a = auth.getAuth(app); var db = fs.getFirestore(app);
  } catch { $('#auth-off').hidden = false; $('#auth-on').hidden = true; $('#auth-off p').textContent = 'Не удалось загрузить службу входа. Проверьте соединение.'; return; }
  let mode = 'in';
  const setMode = m => {
    mode = m; $('#tab-in').classList.toggle('on', m === 'in'); $('#tab-up').classList.toggle('on', m === 'up');
    $('#f-name-wrap').hidden = m === 'in'; $('#auth-go').textContent = m === 'in' ? 'Войти' : 'Создать аккаунт'; msg('');
    $('#auth-pass').autocomplete = m === 'in' ? 'current-password' : 'new-password';
  };
  $('#tab-in').onclick = () => setMode('in'); $('#tab-up').onclick = () => setMode('up'); setMode('in');

  // Ник занимается один раз: документ usernames/<ник> создаётся транзакцией и правилами Firestore нельзя перезаписать.
  const available = async n => !(await F.getDoc(F.doc(db, 'usernames', n))).exists();
  async function claim(uid, n) {
    await F.runTransaction(db, async tx => {
      const ref = F.doc(db, 'usernames', n);
      if ((await tx.get(ref)).exists()) throw new Error('taken');
      tx.set(ref, { uid, at: Date.now() });
      tx.set(F.doc(db, 'users', uid), { username: n, at: Date.now() }, { merge: true });
    });
  }
  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault(); const email = $('#auth-email').value.trim(), pass = $('#auth-pass').value; busy(true); msg('');
    try {
      if (mode === 'up') {
        const nick = cleanUser($('#auth-user').value), bad = checkUser(nick); if (bad) { msg(bad); return; }
        if (!(await available(nick))) { msg('Этот ник уже занят. Выберите другой.'); return; }
        const c = await A.createUserWithEmailAndPassword(a, email, pass);
        const name = $('#auth-name').value.trim(); await A.updateProfile(c.user, { displayName: name || nick });
        try { await claim(c.user.uid, nick); } catch { /* ник заняли секунду назад: попросим выбрать другой ниже */ }
        await refreshMe(c.user);
        try { await A.sendEmailVerification(c.user); msg('Аккаунт создан. Мы отправили письмо для подтверждения почты.', true); } catch { /* ignore */ }
      } else await A.signInWithEmailAndPassword(a, email, pass);
    } catch (err) { msg(human(err)); } finally { busy(false); }
  });
  const social = { google: () => new A.GoogleAuthProvider(), github: () => new A.GithubAuthProvider(), microsoft: () => new A.OAuthProvider('microsoft.com') };
  document.querySelectorAll('[data-provider]').forEach(b => b.addEventListener('click', async () => {
    busy(true); msg('');
    try { await A.signInWithPopup(a, social[b.dataset.provider]()); } catch (err) { msg(human(err)); } finally { busy(false); }
  }));
  $('#auth-reset').addEventListener('click', async () => {
    const email = $('#auth-email').value.trim(); if (!email) return msg('Введите почту, и мы пришлём ссылку для сброса пароля.');
    try { await A.sendPasswordResetEmail(a, email); msg('Письмо для сброса пароля отправлено.', true); } catch (err) { msg(human(err)); }
  });
  $('#auth-out').addEventListener('click', () => A.signOut(a));
  $('#claim-form').addEventListener('submit', async e => {
    e.preventDefault(); const n = cleanUser($('#claim-user').value), bad = checkUser(n), u = a.currentUser; if (!u) return;
    if (bad) { $('#claim-msg').textContent = bad; return; }
    try { await claim(u.uid, n); $('#claim-msg').textContent = ''; refreshMe(u); } catch (err) { $('#claim-msg').textContent = human(err); }
  });
  async function refreshMe(u) {
    let nick = '';
    try { const d = await F.getDoc(F.doc(db, 'users', u.uid)); nick = d.exists() ? d.data().username : ''; } catch { /* ignore */ }
    $('#me-nick').textContent = nick ? '@' + nick : ''; $('#claim-box').hidden = !!nick;
  }
  A.onAuthStateChanged(a, u => {
    $('#auth-form-box').hidden = !!u; $('#auth-me').hidden = !u; $('#nav-login').textContent = u ? (u.displayName || u.email || 'Профиль') : 'Войти';
    if (u) { refreshMe(u); $('#me-name').textContent = u.displayName || 'Слушатель'; $('#me-mail').textContent = u.email || ''; const ph = $('#me-photo'); if (u.photoURL) { ph.src = u.photoURL; ph.hidden = false; } else ph.hidden = true; }
  });
  busy(false);
})();
