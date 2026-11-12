import { firebaseConfig } from './firebase-config.js';
import { emit, on, save, state, touchLibrary } from './state.js';
import { hash } from './util.js';
import { isNative } from './native.js';
import { kvSet } from './db.js';

// Синхронизация через аккаунт Puro Cielo (тот же Firebase, что и вход на сайте).
// Между устройствами переносятся лайки, плейлисты (обычные и умные), счётчики прослушиваний, свои данные треков,
// свои обложки, профиль, тема и настройки. Сама музыка остаётся на каждом устройстве.
// Песня узнаётся по «имени файла + размеру» — одинаковый файл на телефоне и компьютере считается одной песней.
//
// Firestore:  sync/{uid}                 — всё, кроме картинок (+ индекс картинок blobs: {docId: hash})
//             sync/{uid}/blobs/{docId}   — по одной картинке: { kind: 'ct'|'ca'|'avatar'|'banner', key, data }
//             sync/{uid}/blobs/ly_…      — по одному точному тексту песни: { kind: 'ly', key, data: JSON }
const FB = '10.12.2', G = `https://www.gstatic.com/firebasejs/${FB}`;
const importUrl = new Function('u', 'return import(u)'); // настоящий import() (сборка не должна превращать его в require)
const DEVICE = (() => { try {
    let d = localStorage.getItem('puro-device');
    if (!d)
        localStorage.setItem('puro-device', d = Math.random().toString(36).slice(2, 10));
    return d;
}
catch {
    return 'dev';
} })();
// не переносим то, что относится к конкретному устройству
const LOCAL_SETTINGS = ['keepAwake', 'lyricsProxy'];
export const sync = { status: 'off', user: null, lastAt: 0, error: '' };
let F = null, A = null, auth = null, db = null, unsub = null, timer = 0, applying = false, uidNow = '';
const set = patch => { Object.assign(sync, patch); emit('sync'); };
const metaKey = uid => 'puro-sync-' + uid;
const readMeta = uid => { try {
    return JSON.parse(localStorage.getItem(metaKey(uid)) || '{}');
}
catch {
    return {};
} };
const writeMeta = (uid, m) => { try {
    localStorage.setItem(metaKey(uid), JSON.stringify(m));
}
catch { /* ignore */ } };
// ---------- переносимые ключи песен ----------
export const pkeyOf = t => `${t.name}|${t.size}`;
function keyMaps() {
    const toP = new Map(), toId = new Map();
    for (const t of state.tracks.values()) {
        const p = pkeyOf(t);
        toP.set(t.id, p);
        toId.set(p, t.id);
    }
    return { P: id => toP.get(id) || id, I: p => toId.get(p) || p };
}
const mapKeys = (o, f) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [f(k), v]));
// ---------- что отправляем ----------
export function payload() {
    const { P } = keyMaps();
    const settings = { ...state.settings };
    for (const k of LOCAL_SETTINGS)
        delete settings[k];
    return {
        likes: [...state.likes].map(P).sort(),
        playlists: state.playlists.map(p => ({ id: p.id, name: p.name, created: p.created || 0, ids: p.ids.map(P) })),
        smart: state.smart,
        plays: mapKeys(Object.fromEntries(Object.entries(state.plays).filter(([, n]) => n > 0)), P),
        tagEdits: mapKeys(state.tagEdits, P),
        settings, theme: state.theme,
        profile: { name: state.profile.name, username: state.profile.username },
    };
}
// картинки: docId → { kind, key, data }
function localBlobs() {
    const { P } = keyMaps(), out = {};
    for (const [id, data] of Object.entries(state.covers.t))
        out['ct_' + hash(P(id)).toString(36)] = { kind: 'ct', key: P(id), data };
    for (const [key, data] of Object.entries(state.covers.a))
        out['ca_' + hash(key).toString(36)] = { kind: 'ca', key, data };
    if (state.profile.avatar)
        out.avatar = { kind: 'avatar', key: '', data: state.profile.avatar };
    if (state.profile.banner)
        out.banner = { kind: 'banner', key: '', data: state.profile.banner };
    return out;
}
const blobIndex = blobs => Object.fromEntries(Object.entries(blobs).map(([id, b]) => [id, hash(b.data).toString(36)]));
const fingerprint = () => hash(JSON.stringify(payload()) + JSON.stringify(blobIndex(localBlobs()))).toString(36);
// ---------- слияние, когда менялись оба устройства ----------
// Списки (лайки, плейлисты, прослушивания) объединяются. Профиль, тема и настройки: на новом устройстве (первая
// синхронизация) берутся из аккаунта, иначе — с этого устройства, как более свежие.
function merge(L, R, firstTime) {
    const byId = new Map();
    for (const p of [...(R.playlists || []), ...L.playlists]) {
        const o = byId.get(p.id);
        byId.set(p.id, o ? { ...p, ids: [...new Set([...o.ids, ...p.ids])] } : p);
    }
    const smart = new Map([...(R.smart || []), ...L.smart].map(p => [p.id, p]));
    const plays = { ...(R.plays || {}) };
    for (const [k, n] of Object.entries(L.plays))
        plays[k] = Math.max(plays[k] || 0, n);
    const scalars = firstTime ? { settings: R.settings || L.settings, theme: R.theme || L.theme, profile: R.profile || L.profile } : {};
    return { ...R, ...L, ...scalars,
        likes: [...new Set([...(R.likes || []), ...L.likes])].sort(),
        playlists: [...byId.values()], smart: [...smart.values()], plays,
        tagEdits: { ...(R.tagEdits || {}), ...L.tagEdits } };
}
// ---------- применить пришедшее ----------
async function applyRemote(R, uid) {
    applying = true;
    try {
        const { I } = keyMaps();
        if (Array.isArray(R.likes))
            state.likes = new Set(R.likes.map(I));
        if (Array.isArray(R.playlists))
            state.playlists = R.playlists.map(p => ({ ...p, ids: (p.ids || []).map(I) }));
        if (Array.isArray(R.smart))
            state.smart = R.smart;
        if (R.plays)
            state.plays = mapKeys(R.plays, I);
        if (R.tagEdits)
            state.tagEdits = mapKeys(R.tagEdits, I);
        if (R.settings) {
            const keep = Object.fromEntries(LOCAL_SETTINGS.map(k => [k, state.settings[k]]));
            Object.assign(state.settings, R.settings, keep);
        }
        if (R.theme)
            state.theme = R.theme;
        if (R.profile) {
            if (R.profile.name)
                state.profile.name = R.profile.name;
            if (R.profile.username)
                state.profile.username = R.profile.username;
        }
        // картинки: скачиваем только изменившиеся
        if (R.blobs) {
            const mine = blobIndex(localBlobs());
            const covers = { t: {}, a: {} };
            const { I: I2 } = keyMaps();
            let avatar = null, banner = null;
            const have = localBlobs();
            for (const [id, h] of Object.entries(R.blobs)) {
                let b = mine[id] === h ? have[id] : null;
                if (!b) {
                    const snap = await F.getDoc(F.doc(db, 'sync', uid, 'blobs', id)).catch(() => null);
                    b = snap && snap.exists() ? snap.data() : null;
                }
                if (!b)
                    continue;
                if (b.kind === 'ct')
                    covers.t[I2(b.key)] = b.data;
                else if (b.kind === 'ca')
                    covers.a[b.key] = b.data;
                else if (b.kind === 'avatar')
                    avatar = b.data;
                else if (b.kind === 'banner')
                    banner = b.data;
            }
            state.covers = covers;
            await kvSet('covers', covers);
            state.profile.avatar = avatar;
            state.profile.banner = banner;
        }
        save();
        touchLibrary();
        emit('covers');
        emit('likes');
        emit('playlists');
        emit('settings', 'all');
    }
    finally {
        applying = false;
    }
}
// ---------- отправить ----------
async function push(uid, data) {
    const blobs = localBlobs(), index = blobIndex(blobs);
    const m = readMeta(uid), sent = m.blobs || {};
    for (const [id, b] of Object.entries(blobs))
        if (sent[id] !== index[id])
            await F.setDoc(F.doc(db, 'sync', uid, 'blobs', id), b);
    for (const id of Object.keys(sent))
        if (!index[id])
            await F.deleteDoc(F.doc(db, 'sync', uid, 'blobs', id)).catch(() => { });
    const at = Date.now();
    await F.setDoc(F.doc(db, 'sync', uid), { ...data, blobs: index, v: 1, updatedAt: at, device: DEVICE });
    writeMeta(uid, { fp: fingerprint(), at, blobs: index });
    set({ lastAt: at, error: '' });
}
// ---------- сверка: при входе, при изменениях здесь и при изменениях на другом устройстве ----------
let busy = false, again = false;
async function reconcile(remote) {
    const uid = uidNow;
    if (!uid || !F)
        return;
    if (busy) {
        again = true;
        return;
    }
    busy = true;
    try {
        const m = readMeta(uid);
        const R = remote !== undefined ? remote : await F.getDoc(F.doc(db, 'sync', uid)).then(s => (s.exists() ? s.data() : null));
        const dirty = fingerprint() !== m.fp;
        const remoteNew = R && R.updatedAt && R.updatedAt !== m.at && R.device !== DEVICE;
        if (!R)
            await push(uid, payload());
        else if (remoteNew && !dirty) {
            await applyRemote(R, uid);
            writeMeta(uid, { fp: fingerprint(), at: R.updatedAt, blobs: R.blobs || {} });
            set({ lastAt: R.updatedAt, error: '' });
        }
        else if (remoteNew && dirty) {
            await applyRemote({ ...merge(payload(), R, !m.fp), blobs: { ...(R.blobs || {}), ...blobIndex(localBlobs()) } }, uid);
            await push(uid, payload());
        }
        else if (dirty)
            await push(uid, payload());
    }
    catch (e) {
        const code = String(e && (e.code || e.message) || e);
        set({ error: /permission-denied|insufficient permissions/i.test(code)
                ? 'Firebase не пускает к данным синхронизации: опубликуйте новые правила Firestore (файл AUTH-SETUP.md в репозитории).'
                : /unavailable|network|offline/i.test(code) ? 'Нет связи с сервером — синхронизирую, когда появится интернет.' : 'Ошибка синхронизации: ' + code });
    }
    finally {
        busy = false;
        if (again) {
            again = false;
            reconcile();
        }
    }
}
// ---------- вход ----------
async function loadFirebase() {
    if (F)
        return true;
    if (!firebaseConfig.apiKey)
        return false;
    const mock = typeof window !== 'undefined' && window.__puroFirebase; // для проверок
    const [app, au, fs] = mock ? mock : await Promise.all([importUrl(`${G}/firebase-app.js`), importUrl(`${G}/firebase-auth.js`), importUrl(`${G}/firebase-firestore.js`)]);
    const a = app.initializeApp(firebaseConfig, 'puro-player');
    A = au;
    F = fs;
    auth = au.getAuth(a);
    db = fs.getFirestore(a);
    au.onAuthStateChanged(auth, user => onUser(user));
    return true;
}
function onUser(user) {
    if (unsub) {
        unsub();
        unsub = null;
    }
    clearInterval(timer);
    if (!user) {
        uidNow = '';
        set({ status: 'off', user: null });
        return;
    }
    uidNow = user.uid;
    set({ status: 'in', user: { email: user.email || '', name: user.displayName || '' }, lastAt: readMeta(user.uid).at || 0 });
    reconcile();
    // изменения с другого устройства приходят сразу
    unsub = F.onSnapshot(F.doc(db, 'sync', user.uid), s => { if (!applying && s.exists() && s.data().device !== DEVICE)
        reconcile(s.data()); }, () => { });
    // свои изменения отправляем раз в несколько секунд, если что-то поменялось
    timer = setInterval(() => { if (!applying && fingerprint() !== readMeta(user.uid).fp)
        reconcile(); }, 5000);
    // ник, занятый на сайте, — в профиль
    F.getDoc(F.doc(db, 'users', user.uid)).then(s => { const n = s.exists() && s.data().username; if (n && state.profile.username !== n) {
        state.profile.username = n;
        save();
        emit('settings', 'profile');
    } }).catch(() => { });
}
// На Android файлы могут появиться после синхронизации: привязываем все данные треков.
on('library', () => {
    if (applying || !uidNow)
        return;
    const { I } = keyMaps();
    let changed = false;
    const fix = id => { const n = I(id); if (n !== id)
        changed = true; return n; };
    state.likes = new Set([...state.likes].map(fix));
    for (const p of state.playlists)
        p.ids = p.ids.map(fix);
    state.plays = mapKeys(state.plays, fix);
    state.tagEdits = mapKeys(state.tagEdits, fix);
    state.covers.t = mapKeys(state.covers.t, fix);
    if (changed) {
        save();
        kvSet('covers', state.covers);
        touchLibrary();
    }
});
// ---------- тексты песен в аккаунте ----------
// Точно подобранный текст (совпали название и артист, либо его вписал сам пользователь) кладём в аккаунт,
// чтобы на другом устройстве и после очистки кэша он появлялся сразу, без нового поиска.
// Песня узнаётся по «артист + название + длина», поэтому текст подойдёт и к другому файлу той же песни.
// Отдельные документы читаются по одному, только когда текст нужен, — основную синхронизацию это не замедляет.
const lyDoc = key => 'ly_' + hash(key).toString(36) + hash([...key].reverse().join('')).toString(36);
export const cloudReady = () => !!(uidNow && F);
export async function cloudLyricsGet(key) {
    if (!cloudReady())
        return undefined; // не вошли — спрашивать негде
    try {
        const s = await F.getDoc(F.doc(db, 'sync', uidNow, 'blobs', lyDoc(key)));
        const d = s.exists() ? s.data() : null;
        return d && d.kind === 'ly' && d.key === key ? JSON.parse(d.data) : null;
    }
    catch {
        return undefined;
    }
}
export async function cloudLyricsPut(key, ly) {
    if (!cloudReady())
        return false;
    try {
        const data = JSON.stringify(ly);
        if (data.length > 600000)
            return false;
        await F.setDoc(F.doc(db, 'sync', uidNow, 'blobs', lyDoc(key)), { kind: 'ly', key, data, at: Date.now() });
        return true;
    }
    catch {
        return false;
    }
}
export async function cloudLyricsDel(key) {
    if (!cloudReady())
        return false;
    try {
        await F.deleteDoc(F.doc(db, 'sync', uidNow, 'blobs', lyDoc(key)));
        return true;
    }
    catch {
        return false;
    }
}
export async function initSync() {
    try {
        // если раньше входили на этом устройстве — поднимаем Firebase сразу
        if (Object.keys(localStorage).some(k => k.startsWith('puro-sync-')))
            await loadFirebase();
    }
    catch { /* без интернета — синхронизации просто нет */ }
}
export const canGoogle = () => !isNative && !(typeof window !== 'undefined' && window.PuroDesktop); // OAuth-popup не работает внутри нативных оболочек; доступен вход по почте.
export async function signInGoogle() {
    set({ status: 'loading', error: '' });
    try {
        await loadFirebase();
        await A.signInWithPopup(auth, new A.GoogleAuthProvider());
    }
    catch (e) {
        set({ status: sync.user ? 'in' : 'off', error: authError(e) });
    }
}
export async function signInEmail(email, pass, create = false) {
    set({ status: 'loading', error: '' });
    try {
        await loadFirebase();
        await (create ? A.createUserWithEmailAndPassword : A.signInWithEmailAndPassword)(auth, email, pass);
        return true;
    }
    catch (e) {
        set({ status: sync.user ? 'in' : 'off', error: authError(e) });
        return false;
    }
}
export async function signOutSync() { if (auth)
    await A.signOut(auth); }
export const syncNow = () => reconcile();
function authError(e) {
    const c = String(e && e.code || e && e.message || e);
    return ({
        'auth/invalid-credential': 'Неверная почта или пароль', 'auth/wrong-password': 'Неверная почта или пароль', 'auth/user-not-found': 'Такого аккаунта нет',
        'auth/email-already-in-use': 'Эта почта уже зарегистрирована — войдите', 'auth/weak-password': 'Пароль слишком короткий (нужно от 6 символов)',
        'auth/invalid-email': 'Неверный адрес почты', 'auth/popup-closed-by-user': 'Окно входа закрыто', 'auth/network-request-failed': 'Нет интернета',
        'auth/operation-not-supported-in-this-environment': 'Здесь этот способ входа не работает — войдите по почте',
        'auth/unauthorized-domain': 'Этот адрес не разрешён в настройках Firebase',
    })[c] || 'Не удалось войти: ' + c;
}
