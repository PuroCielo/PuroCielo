(function(){"use strict";var defs={},cache={};function req(n){n=n.replace(/^\.\//,"");if(cache[n])return cache[n].exports;var m=cache[n]={exports:{}};defs[n](m,m.exports,req);return m.exports}
defs["actions.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newPlaylistFlow = newPlaylistFlow;
exports.addToPlaylistModal = addToPlaylistModal;
exports.deleteTrackFlow = deleteTrackFlow;
exports.dedupeFlow = dedupeFlow;
exports.trackMenu = trackMenu;
const tagedit_js_1 = require("./tagedit.js");
const state_js_1 = require("./state.js");
const native_js_1 = require("./native.js");
const tools_js_1 = require("./tools.js");
const player_js_1 = require("./player.js");
const ui_js_1 = require("./ui.js");
const icons_js_1 = require("./icons.js");
const util_js_1 = require("./util.js");
const views_js_1 = require("./views.js");
async function newPlaylistFlow(ids = []) {
    const name = await (0, ui_js_1.promptText)({ title: 'Новый плейлист', label: 'Название', placeholder: 'Например, «Ночной драйв»', ok: 'Создать' });
    if (!name)
        return null;
    const p = (0, state_js_1.createPlaylist)(name, ids);
    (0, ui_js_1.toast)(ids.length ? `«${p.name}»: добавлено ${(0, util_js_1.plural)(ids.length, ['трек', 'трека', 'треков'])}` : `Плейлист «${p.name}» создан`);
    return p;
}
function addToPlaylistModal(ids) {
    ids = [].concat(ids);
    const list = state_js_1.state.playlists.map(p => `<button class="pl-pick" data-pid="${p.id}">${(0, views_js_1.mosaic)((0, state_js_1.playlistTracks)(p).slice(0, 4), p.id, 'mini-cov')}<span><b>${(0, util_js_1.esc)(p.name)}</b><small>${(0, util_js_1.plural)(p.ids.length, ['песня', 'песни', 'песен'])}</small></span></button>`).join('');
    (0, ui_js_1.openModal)({
        title: 'Добавить в плейлист',
        html: `<button class="pl-pick new" data-new>${'<span class="mini-cov new">' + (0, icons_js_1.icon)('plus') + '</span>'}<span><b>Новый плейлист…</b><small>Создать и добавить</small></span></button>${list}`,
        onMount: api => api.el.addEventListener('click', async (e) => {
            const pick = e.target.closest('.pl-pick');
            if (!pick)
                return;
            if (pick.dataset.new !== undefined) {
                api.close();
                await newPlaylistFlow(ids);
                return;
            }
            const n = (0, state_js_1.addToPlaylist)(pick.dataset.pid, ids);
            const p = state_js_1.state.playlists.find(x => x.id === pick.dataset.pid);
            (0, ui_js_1.toast)(n ? `Добавлено в «${p.name}»` : `Уже в «${p.name}»`, n ? 'ok' : 'info');
            api.close();
        }),
    });
}
async function deleteTrackFlow(id) {
    const t = (0, state_js_1.getTrack)(id);
    if (!t)
        return;
    const yes = await (0, ui_js_1.confirmBox)({ title: 'Удалить песню?', text: `«${t.title}» исчезнет из медиатеки, плейлистов и понравившихся. Сам файл на устройстве останется.`, ok: 'Удалить', danger: true });
    if (!yes)
        return;
    (0, player_js_1.purge)([id]);
    (0, native_js_1.forgetFile)(id);
    (0, state_js_1.removeTracks)([id]);
    (0, ui_js_1.toast)(`Песня «${t.title}» удалена`);
}
// Дубликаты: удалить лишние копии (в одной группе или во всех). Лайки, плейлисты и прослушивания переходят на оставшуюся копию.
async function dedupeFlow(key) {
    const groups = (0, tools_js_1.duplicateGroups)().filter(g => !key || g.key === key);
    const extra = groups.flatMap(g => g.extra);
    if (!extra.length)
        return;
    const yes = await (0, ui_js_1.confirmBox)({ title: extra.length === 1 ? 'Удалить лишнюю копию?' : 'Удалить лишние копии?', text: `Будет удалено песен: ${extra.length}. В каждой группе останется лучшая копия; лайки и плейлисты перейдут на неё. Сами файлы на устройстве останутся.`, ok: 'Удалить', danger: true });
    if (!yes)
        return;
    for (const g of groups)
        (0, tools_js_1.inherit)(g.keep, g.extra);
    const ids = extra.map(t => t.id);
    (0, player_js_1.purge)(ids);
    ids.forEach(native_js_1.forgetFile);
    (0, state_js_1.removeTracks)(ids);
    (0, ui_js_1.toast)(`Удалено лишних копий: ${ids.length}`);
}
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const fmtSpeed = v => String(v).replace('.', ',') + '×';
function speedMenu(anchor) {
    const cur = state_js_1.state.settings.speed || 1;
    (0, ui_js_1.openMenu)(anchor, SPEEDS.map(v => ({ icon: v === cur ? 'check' : '', label: fmtSpeed(v), onClick: () => (0, state_js_1.setSetting)('speed', v) })));
}
function trackMenu(anchor, id, { pid, np, extra = [] } = {}) {
    const t = (0, state_js_1.getTrack)(id);
    if (!t)
        return;
    const liked = state_js_1.state.likes.has(id);
    const items = [
        ...extra,
        ...(np ? [{ icon: 'speed', label: `Скорость: ${fmtSpeed(state_js_1.state.settings.speed || 1)}`, keep: true, onClick: () => speedMenu(anchor) }, { sep: true }] : []),
        { icon: 'next2', label: 'Играть следующим', onClick: () => { (0, player_js_1.addNext)(id); (0, ui_js_1.toast)('Добавлено: следующим'); } },
        { icon: 'queue', label: 'В конец очереди', onClick: () => { (0, player_js_1.addToQueue)(id); (0, ui_js_1.toast)('Добавлено в очередь'); } },
        { sep: true },
        { icon: 'playlist', label: 'Добавить в плейлист…', onClick: () => addToPlaylistModal(id) },
        { icon: liked ? 'heart-fill' : 'heart', label: liked ? 'Убрать из понравившихся' : 'Нравится', onClick: () => (0, state_js_1.toggleLike)(id) },
        { sep: true },
        { icon: 'edit', label: 'Данные трека…', onClick: () => (0, tagedit_js_1.openTrackInfo)(id) },
        { icon: 'search', label: 'Найти на SoundCloud', onClick: () => window.open('https://soundcloud.com/search?q=' + encodeURIComponent(`${(t._artists || [t.artist])[0] || ''} ${t.title}`.trim()), '_blank', 'noopener') },
        { icon: 'disc', label: 'Перейти к альбому', onClick: () => { (0, state_js_1.derived)(); location.hash = '#/album/' + encodeURIComponent(t._albumKey); } },
        { icon: 'user', label: 'Перейти к артисту', onClick: () => { (0, state_js_1.derived)(); location.hash = '#/artist/' + encodeURIComponent(t._artistKey); } },
    ];
    if (pid)
        items.push({ sep: true }, { icon: 'trash', label: 'Убрать из плейлиста', danger: true, onClick: () => (0, state_js_1.removeFromPlaylist)(pid, id) });
    items.push({ sep: true }, { icon: 'trash', label: 'Удалить из медиатеки', danger: true, onClick: () => deleteTrackFlow(id) });
    (0, ui_js_1.openMenu)(anchor, items);
}

};
defs["app.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_js_1 = require("./state.js");
const player_js_1 = require("./player.js");
const importer_js_1 = require("./importer.js");
const native_js_1 = require("./native.js");
const nowplaying_js_1 = require("./nowplaying.js");
const views_js_1 = require("./views.js");
const actions_js_1 = require("./actions.js");
const tools_js_1 = require("./tools.js");
const covers_auto_js_1 = require("./covers-auto.js");
const ui_js_1 = require("./ui.js");
const theme_js_1 = require("./theme.js");
const icons_js_1 = require("./icons.js");
const bgfx_js_1 = require("./bgfx.js");
const lyrics_auto_js_1 = require("./lyrics-auto.js");
const util_js_1 = require("./util.js");
const m3u_js_1 = require("./m3u.js");
const db_js_1 = require("./db.js");
const i18n_js_1 = require("./i18n.js");
const covers_auto_js_2 = require("./covers-auto.js");
const sync_js_1 = require("./sync.js");
const motion_js_1 = require("./motion.js");
const link_import_js_1 = require("./link-import.js");
const view = (0, util_js_1.$)('#view');
let query = '';
// ================= роутер =================
function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path] = h.split('?');
    const p = path.split('/');
    const dec = s => {
        try {
            return decodeURIComponent(s || '');
        }
        catch {
            return s || '';
        }
    };
    return { name: p[0] || 'home', arg: dec(p.slice(1).join('/')) };
}
function routeKey(r) {
    if (r.name === 'library')
        return 'library/' + (r.arg || 'albums');
    if (r.name === 'playlist')
        return 'playlist/' + r.arg;
    if (r.name === 'mix')
        return 'home';
    if (r.name === 'smart')
        return 'smart/' + r.arg;
    if (r.name === 'stats')
        return 'stats';
    return r.name;
}
function render({ keepScroll = false, restore = null } = {}) {
    const r = route(), y = scrollY;
    let html;
    switch (r.name) {
        case 'library':
            html = (0, views_js_1.libraryView)(r.arg || 'albums');
            break;
        case 'album':
            html = (0, views_js_1.albumView)(r.arg);
            break;
        case 'artist':
            html = (0, views_js_1.artistView)(r.arg);
            break;
        case 'playlist':
            html = (0, views_js_1.playlistView)(r.arg);
            break;
        case 'liked':
            html = (0, views_js_1.likedView)();
            break;
        case 'mix':
            html = (0, views_js_1.mixView)(r.arg);
            break;
        case 'smart':
            html = (0, views_js_1.smartView)(r.arg);
            break;
        case 'stats':
            html = (0, views_js_1.statsView)(r.arg || 'month');
            break;
        case 'search':
            html = (0, views_js_1.searchView)(query);
            break;
        case 'profile':
            html = (0, views_js_1.profileView)();
            break;
        case 'settings':
            html = (0, views_js_1.settingsView)();
            break;
        case 'duplicates':
            html = (0, views_js_1.duplicatesView)();
            break;
        case 'fix':
            html = (0, views_js_1.fixView)(fixBusy);
            peekAll();
            break;
        default: html = (0, views_js_1.homeView)();
    }
    view.innerHTML = html;
    if (!keepScroll) {
        view.classList.remove('enter');
        void view.offsetWidth;
        view.classList.add('enter');
        scrollTo(0, restore || 0);
    }
    else
        scrollTo(0, y);
    const key = routeKey(r);
    (0, util_js_1.$$)('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === key));
    (0, util_js_1.$$)('#tabbar a').forEach(a => a.classList.toggle('active', key.startsWith(a.dataset.tab)));
    syncRows();
    syncRails();
    if (!keepScroll)
        (0, motion_js_1.revealView)(view);
    if (r.name === 'search' && !keepScroll) {
        const i = (0, util_js_1.$)('#search-main');
        if (i && matchMedia('(max-width: 899px)').matches)
            i.focus();
    }
}
// ================= боковая панель / таб-бар =================
function renderChrome() {
    (0, util_js_1.$)('#brand-mark').innerHTML = (0, icons_js_1.icon)('tower');
    (0, util_js_1.$)('#ic-search').innerHTML = (0, icons_js_1.icon)('search');
    (0, util_js_1.$)('#side-add').innerHTML = (0, icons_js_1.icon)('plus');
    (0, util_js_1.$)('#side-settings').innerHTML = (0, icons_js_1.icon)('settings');
    (0, util_js_1.$)('#side-upload').innerHTML = native_js_1.isNative ? (0, icons_js_1.icon)('folder') + 'Выбрать папку' : (0, icons_js_1.icon)('upload') + 'Добавить музыку';
    (0, util_js_1.$)('#drop-ic').innerHTML = (0, icons_js_1.icon)('upload');
    if (native_js_1.isNative)
        (0, util_js_1.$)('#side-upload').dataset.action = 'add-folder';
    const nav = [['home', 'home', 'Главная'], ['library/media', 'library', 'Медиатека'], ['library/albums', 'disc', 'Альбомы'], ['library/singles', 'single', 'Синглы'], ['library/playlists', 'playlist', 'Плейлисты'], ['library/artists', 'user', 'Артисты'], ['library/songs', 'note', 'Песни'], ['stats', 'chart', 'Итоги']];
    (0, util_js_1.$)('#side-nav').innerHTML = nav.map(([k, ic, n]) => `<a class="side-link" href="#/${k}" data-route="${k}">${(0, icons_js_1.icon)(ic)}<span>${n}</span></a>`).join('');
    (0, util_js_1.$)('#tabbar').innerHTML = [['home', 'home', 'Главная', '#/home'], ['search', 'search', 'Поиск', '#/search'], ['library', 'library', 'Библиотека', '#/library/media'], ['profile', 'user', 'Профиль', '#/profile']]
        .map(([k, ic, n, h]) => `<a href="${h}" data-tab="${k}">${(0, icons_js_1.icon)(ic)}<span>${n}</span></a>`).join('');
    renderSidePlaylists();
    renderSideProfile();
    syncThemeBtn();
}
function syncThemeBtn() {
    const b = (0, util_js_1.$)('#side-theme');
    if (b)
        b.innerHTML = (0, icons_js_1.icon)(state_js_1.state.theme === 'dark' ? 'sun' : 'moon');
}
function renderSidePlaylists() { (0, util_js_1.$)('#side-playlists').innerHTML = (0, views_js_1.sidebarPlaylists)(); const key = routeKey(route()); (0, util_js_1.$$)('#side-playlists [data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === key)); }
function renderSideProfile() { (0, util_js_1.$)('#side-profile').innerHTML = `${(0, views_js_1.avatarHTML)()}<span class="sp-text"><b>${(0, util_js_1.esc)(state_js_1.state.profile.name)}</b><small>@${(0, util_js_1.esc)(state_js_1.state.profile.username)}</small></span>`; }
// ================= синхронизация текущего трека / лайков в списках =================
function syncRows() {
    const id = (0, player_js_1.current)()?.id;
    (0, util_js_1.$$)('[data-track]').forEach(el => el.classList.toggle('is-current', el.dataset.track === id));
}
function syncLikes() {
    (0, util_js_1.$$)('.like[data-id]').forEach(b => { const on_ = state_js_1.state.likes.has(b.dataset.id); b.classList.toggle('on', on_); b.innerHTML = (0, icons_js_1.icon)(on_ ? 'heart-fill' : 'heart'); });
    if (route().name === 'liked')
        render({ keepScroll: true });
}
// ================= воспроизведение из контекста =================
function playFrom(el) {
    const list = views_js_1.lists.get(+el.dataset.list);
    if (!list)
        return;
    const i = +el.dataset.i, id = list[i]?.id;
    if (id && (0, player_js_1.current)()?.id === id && player_js_1.P.queue.length)
        return (0, player_js_1.toggle)();
    (0, player_js_1.playList)(list.map(t => t.id), i, { shuffle: false });
}
const ids = ts => ts.map(t => t.id);
const playIds = (list, shuffle) => {
    if (!list.length)
        return (0, ui_js_1.toast)('Здесь пока нет песен', 'info');
    (0, player_js_1.playList)(ids(list), shuffle ? Math.floor(Math.random() * list.length) : 0, { shuffle });
};
const artistTracks = a => a.tracks;
const artistsOfTrack = t => (t._artists || [t.artist]).filter(Boolean).join(', ');
function playlistMenu(anchor, id) {
    const p = state_js_1.state.playlists.find(x => x.id === id);
    if (!p)
        return;
    (0, ui_js_1.openMenu)(anchor, [
        { icon: 'edit', label: 'Переименовать', onClick: async () => {
                const { promptText } = await Promise.resolve().then(() => require('./ui.js'));
                const n = await promptText({ title: 'Переименовать плейлист', label: 'Название', value: p.name, ok: 'Сохранить' });
                if (n)
                    (0, state_js_1.renamePlaylist)(id, n);
            } },
        { icon: 'download', label: 'Экспорт в .m3u8', onClick: () => exportM3U(p) },
        { sep: true },
        { icon: 'trash', label: 'Удалить плейлист', danger: true, onClick: () => { (0, state_js_1.deletePlaylist)(id); (0, ui_js_1.toast)(`Плейлист «${p.name}» удалён`); location.hash = '#/library/playlists'; } },
    ]);
}
// «⋯» на странице альбома: своя обложка сразу для всех песен альбома
function albumMenu(anchor, key) {
    const g = (0, state_js_1.derived)().groups.get(key);
    if (!g)
        return;
    const what = g.tracks.length > 1 ? 'альбома' : 'сингла';
    (0, ui_js_1.openMenu)(anchor, [
        { icon: 'upload', label: `Обложка ${what}…`, onClick: async () => {
                const url = await (0, ui_js_1.pickImage)();
                if (url) {
                    (0, state_js_1.setAlbumCover)(key, url);
                    (0, ui_js_1.toast)(`Обложка ${what} обновлена`);
                }
            } },
        ...((0, state_js_1.hasAlbumCover)(key) ? [{ icon: 'refresh', label: 'Вернуть обложку из файла', onClick: () => (0, state_js_1.setAlbumCover)(key, null) }] : []),
        { sep: true },
        { icon: 'next2', label: 'Играть следующим', onClick: () => { (0, player_js_1.addNext)(g.tracks.map(t => t.id)); (0, ui_js_1.toast)('Добавлено: следующим'); } },
        { icon: 'queue', label: 'В конец очереди', onClick: () => { (0, player_js_1.addToQueue)(g.tracks.map(t => t.id)); (0, ui_js_1.toast)('Добавлено в очередь'); } },
    ]);
}
function exportM3U(p) {
    const blob = new Blob([(0, m3u_js_1.buildM3U)(p.name, (0, state_js_1.playlistTracks)(p))], { type: 'audio/x-mpegurl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = p.name.replace(/[\\/:*?"<>|]+/g, '_') + '.m3u8';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    (0, ui_js_1.toast)('Плейлист сохранён как .m3u8');
}
function doAction(el, e) {
    const d = el.dataset;
    switch (el.dataset.action) {
        case 'play-album':
        case 'shuffle-album': {
            e.stopPropagation();
            const g = (0, state_js_1.derived)().groups.get(d.key);
            if (g)
                playIds(g.tracks, el.dataset.action === 'shuffle-album');
            break;
        }
        case 'radio-artist': {
            e.stopPropagation();
            const a = (0, state_js_1.derived)().artists.get(d.key);
            if (a)
                playIds((0, util_js_1.shuffleArray)(a.tracks), false);
            break;
        }
        case 'play-artist':
        case 'shuffle-artist': {
            e.stopPropagation();
            const a = (0, state_js_1.derived)().artists.get(d.key);
            if (a)
                playIds(artistTracks(a), el.dataset.action === 'shuffle-artist');
            break;
        }
        case 'play-playlist':
        case 'shuffle-playlist': {
            e.stopPropagation();
            const p = state_js_1.state.playlists.find(x => x.id === d.id);
            if (p)
                playIds((0, state_js_1.playlistTracks)(p), el.dataset.action === 'shuffle-playlist');
            break;
        }
        case 'play-mix':
        case 'shuffle-mix': {
            e.stopPropagation();
            const m = (0, views_js_1.mixById)(d.id);
            if (m)
                playIds(m.tracks, el.dataset.action === 'shuffle-mix');
            break;
        }
        case 'play-liked':
        case 'shuffle-liked':
            e.stopPropagation();
            playIds((0, state_js_1.likedTracks)(), el.dataset.action === 'shuffle-liked');
            break;
        case 'like':
            e.stopPropagation();
            (0, state_js_1.toggleLike)(d.id);
            break;
        case 'artist-photo': {
            e.stopPropagation();
            const key = d.key, a = (0, state_js_1.derived)().artists.get(key);
            (0, ui_js_1.openMenu)(el, [
                { icon: 'edit', label: 'Выбрать фото…', onClick: async () => { const img = await (0, ui_js_1.pickImage)(360, 360); if (img) {
                        await (0, covers_auto_js_2.setArtistPhoto)(key, img);
                        (0, ui_js_1.toast)('Фото артиста обновлено');
                    } } },
                ...(a && a.photo ? [{ icon: 'trash', label: 'Убрать фото', danger: true, onClick: async () => { await (0, covers_auto_js_2.setArtistPhoto)(key, null); (0, ui_js_1.toast)('Фото убрано'); } }] : []),
            ]);
            break;
        }
        case 'dedupe':
            (0, actions_js_1.dedupeFlow)(d.key || null);
            break;
        case 'fix-all':
            fixAll();
            break;
        case 'play-id':
            e.stopPropagation();
            if ((0, state_js_1.getTrack)(d.id))
                (0, player_js_1.playList)([d.id], 0);
            break;
        case 'delete-track':
            e.stopPropagation();
            (0, actions_js_1.deleteTrackFlow)(d.id);
            break;
        case 'menu':
            e.stopPropagation();
            (0, actions_js_1.trackMenu)(el, d.id, { pid: d.pid });
            break;
        case 'playlist-menu':
            e.stopPropagation();
            playlistMenu(el, d.id);
            break;
        case 'album-menu':
            e.stopPropagation();
            albumMenu(el, d.key);
            break;
        case 'play-smart':
        case 'shuffle-smart': {
            e.stopPropagation();
            const p = state_js_1.state.smart.find(x => x.id === d.id);
            if (p)
                playIds((0, state_js_1.smartTracks)(p), el.dataset.action === 'shuffle-smart');
            break;
        }
        case 'sync-google':
            (0, sync_js_1.signInGoogle)();
            break;
        case 'sync-email':
            emailSignIn();
            break;
        case 'sync-now':
            (0, sync_js_1.syncNow)();
            (0, ui_js_1.toast)('Синхронизирую…', 'info', 1500);
            break;
        case 'sync-out':
            (0, sync_js_1.signOutSync)();
            break;
        case 'new-smart':
            e.stopPropagation();
            smartEditor();
            break;
        case 'smart-menu': {
            e.stopPropagation();
            const p = state_js_1.state.smart.find(x => x.id === d.id);
            if (p)
                (0, ui_js_1.openMenu)(el, [
                    { icon: 'edit', label: 'Изменить правила', onClick: () => smartEditor(p) },
                    { icon: 'download', label: 'Сохранить как обычный плейлист', onClick: () => {
                            const np = (0, state_js_1.createPlaylist)(p.name);
                            (0, state_js_1.addToPlaylist)(np.id, (0, state_js_1.smartTracks)(p).map(t => t.id));
                            (0, ui_js_1.toast)(`Плейлист «${p.name}» создан`);
                            location.hash = '#/playlist/' + np.id;
                        } },
                    { sep: true },
                    { icon: 'trash', label: 'Удалить плейлист', danger: true, onClick: () => { (0, state_js_1.deleteSmart)(p.id); (0, ui_js_1.toast)(`Плейлист «${p.name}» удалён`); location.hash = '#/library/playlists'; } },
                ]);
            break;
        }
        case 'new-playlist':
            e.stopPropagation();
            (0, actions_js_1.newPlaylistFlow)().then(p => {
                if (p)
                    location.hash = '#/playlist/' + p.id;
            });
            break;
        case 'import-link':
            (0, link_import_js_1.openLinkImport)();
            break;
        case 'add-files':
            native_js_1.isNative ? (0, native_js_1.pickFiles)() : (0, util_js_1.$)('#file-input').click();
            break;
        case 'add-folder':
            native_js_1.isNative ? (0, native_js_1.pickFolder)() : (0, util_js_1.$)('#dir-input').click();
            break;
        case 'rescan':
            if (native_js_1.isNative) {
                (0, ui_js_1.toast)('Проверяю папку…', 'info', 1500);
                (0, native_js_1.rescan)();
            }
            break;
        case 'import-m3u':
            (0, util_js_1.$)('#m3u-input').click();
            break;
        case 'sort':
            (0, views_js_1.setSongSort)(d.v);
            render({ keepScroll: true });
            break;
        case 'edit-profile':
            editProfile();
            break;
        case 'edit-name':
            quickEdit('name');
            break;
        case 'edit-user':
            quickEdit('username');
            break;
        case 'lyrics-proxy':
            quickEdit('lyricsProxy');
            break;
        case 'set-theme':
            (0, theme_js_1.applyTheme)(d.v, el);
            break;
        case 'toggle-theme':
            (0, theme_js_1.toggleTheme)(el);
            break;
        case 'home-view':
            (0, state_js_1.setSetting)('homeView', d.v);
            break;
        case 'home-continue': { // та же песня уже в плеере — просто продолжаем; иначе включаем её (в альбоме — с неё)
            const t = state_js_1.state.tracks.get(d.id);
            if (!t)
                break;
            if ((0, player_js_1.current)()?.id === t.id) {
                if (player_js_1.audio.paused)
                    (0, player_js_1.toggle)();
                else
                    (0, nowplaying_js_1.openNP)();
                break;
            }
            const g = (0, state_js_1.derived)().groups.get(t._albumKey), list = g && g.tracks.length > 1 ? g.tracks : [t];
            (0, player_js_1.playList)(list.map(x => x.id), Math.max(0, list.indexOf(t)));
            break;
        }
        case 'shuffle-all':
            playIds((0, util_js_1.shuffleArray)((0, state_js_1.derived)().all.slice()), false);
            break;
        case 'recent-added':
            (0, views_js_1.setSongSort)('added');
            location.hash = '#/library/songs';
            break;
        case 'home-move': {
            const o = (0, views_js_1.homeOrder)(), i = o.indexOf(d.k), j = i + (+d.d);
            if (i < 0 || j < 0 || j >= o.length)
                break;
            [o[i], o[j]] = [o[j], o[i]];
            (0, state_js_1.setSetting)('homeOrder', o);
            break;
        }
        case 'home-toggle': {
            const hid = (0, views_js_1.homeHidden)();
            hid.has(d.k) ? hid.delete(d.k) : hid.add(d.k);
            if (d.k === 'recents')
                state_js_1.state.settings.homeRecents = true; // старый выключатель больше не используется
            (0, state_js_1.setSetting)('homeHidden', [...hid]);
            break;
        }
        case 'set-setting':
            (0, state_js_1.setSetting)(d.k, d.k === 'speed' || d.k === 'transition' ? parseFloat(d.v) : d.v);
            break;
        case 'toggle-setting':
            (0, state_js_1.setSetting)(d.k, !state_js_1.state.settings[d.k]);
            break;
        case 'sleep': {
            const v = d.v === 'track' ? 'track' : +d.v;
            (0, player_js_1.setSleep)(v);
            (0, ui_js_1.toast)(v === 0 ? 'Таймер сна выключен' : v === 'track' ? 'Остановлюсь в конце трека' : `Таймер сна: ${v} мин`, 'info', 2000);
            break;
        }
        case 'shortcuts':
            showShortcuts();
            break;
        case 'find-lyrics':
            findAllLyrics();
            break;
        case 'clear-recents':
            state_js_1.state.recents = [];
            (0, state_js_1.save)();
            (0, ui_js_1.toast)('История очищена', 'info');
            render({ keepScroll: true });
            break;
        case 'reset-settings':
            setSettings();
            break;
        case 'backup-export':
            exportBackup();
            break;
        case 'backup-import':
            (0, util_js_1.$)('#backup-input').click();
            break;
        case 'clear-library':
            clearLibrary();
            break;
        default: break;
    }
}
// ================= клики / клавиатура =================
document.addEventListener('click', e => {
    const rn = e.target.closest('[data-rail]');
    if (rn) {
        const r = rn.closest('.section')?.querySelector('.rail');
        if (r)
            r.scrollBy({ left: +rn.dataset.rail * Math.max(240, r.clientWidth * 0.85), behavior: 'smooth' });
        return;
    }
    const link = e.target.closest('a[href]');
    if (link) {
        if (link.closest('#np'))
            (0, nowplaying_js_1.closeNP)();
        return;
    } // ссылки (в т.ч. на артистов) работают как обычно
    const act = e.target.closest('[data-action]');
    if (act)
        return doAction(act, e);
    const tr = e.target.closest('[data-track][data-list]');
    if (tr)
        return playFrom(tr);
    const nav = e.target.closest('[data-nav]');
    if (nav)
        location.hash = nav.dataset.nav;
});
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches?.('[role="button"],[role="link"]') && !e.target.matches('button,a,input')) {
        e.preventDefault();
        e.target.click();
    }
});
const typing = t => t.matches?.('input:not([type=range]):not([type=checkbox]),textarea,select,[contenteditable]');
document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
        return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey)
        return;
    if (e.key === 'Escape') {
        if ((0, ui_js_1.closeTopModal)())
            return;
        if ((0, ui_js_1.closeMenu)())
            return;
        if ((0, nowplaying_js_1.isNPOpen)())
            return void (0, nowplaying_js_1.closeNP)();
        if (typing(e.target)) {
            e.target.blur();
            return;
        }
        goBack();
        return;
    }
    if (typing(e.target))
        return;
    const onRange = e.target.matches?.('input[type=range]');
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            (0, player_js_1.toggle)();
            break;
        case 'ArrowLeft':
            if (onRange)
                return;
            e.preventDefault();
            e.shiftKey ? (0, player_js_1.prev)() : (0, player_js_1.seekBy)(-(state_js_1.state.settings.seekStep || 5));
            break;
        case 'ArrowRight':
            if (onRange)
                return;
            e.preventDefault();
            e.shiftKey ? (0, player_js_1.next)() : (0, player_js_1.seekBy)(state_js_1.state.settings.seekStep || 5);
            break;
        case 'ArrowUp':
            if (onRange)
                return;
            e.preventDefault();
            (0, player_js_1.setVolume)(player_js_1.audio.volume + 0.05);
            break;
        case 'ArrowDown':
            if (onRange)
                return;
            e.preventDefault();
            (0, player_js_1.setVolume)(player_js_1.audio.volume - 0.05);
            break;
        case 'KeyD':
            (0, theme_js_1.toggleTheme)();
            break;
        case 'KeyM':
            (0, player_js_1.toggleMute)();
            break;
        case 'KeyS':
            (0, player_js_1.toggleShuffle)();
            break;
        case 'KeyR':
            (0, player_js_1.cycleRepeat)();
            break;
        case 'KeyN':
            (0, player_js_1.next)();
            break;
        case 'KeyP':
            (0, player_js_1.prev)();
            break;
        case 'KeyL': {
            const t = (0, player_js_1.current)();
            if (t)
                (0, state_js_1.toggleLike)(t.id);
            break;
        }
        case 'KeyF':
            (0, nowplaying_js_1.isNPOpen)() ? (0, nowplaying_js_1.closeNP)() : (0, nowplaying_js_1.openNP)();
            break;
        case 'KeyQ':
            (0, nowplaying_js_1.isNPOpen)() ? (0, nowplaying_js_1.setPane)('queue') : (0, nowplaying_js_1.openNP)('queue');
            break;
        case 'KeyT':
            (0, nowplaying_js_1.isNPOpen)() ? (0, nowplaying_js_1.setPane)('lyrics') : (0, nowplaying_js_1.openNP)('lyrics');
            break;
        case 'Slash':
            if (e.shiftKey) {
                showShortcuts();
            }
            else {
                e.preventDefault();
                focusSearch();
            }
            break;
        default: return;
    }
});
document.addEventListener('keyup', e => {
    if (e.code === 'Space' && e.target.matches?.('button,[role=button]'))
        e.preventDefault();
});
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.matches?.('button,[role=button],a'))
        e.preventDefault();
}, true);
function focusSearch() {
    if (matchMedia('(min-width: 900px)').matches)
        (0, util_js_1.$)('#search-side').focus();
    else {
        if (route().name !== 'search')
            location.hash = '#/search';
        setTimeout(() => (0, util_js_1.$)('#search-main')?.focus(), 60);
    }
}
function showShortcuts() {
    const rows = [['Пробел', 'Играть / пауза'], ['← / →', 'Перемотка на 5 секунд'], ['Shift + ← / →', 'Предыдущий / следующий трек'], ['↑ / ↓', 'Громкость'], ['M', 'Выключить звук'], ['S', 'Перемешать'], ['R', 'Повтор: выкл → все → один'],
        ['N / P', 'Следующий / предыдущий'], ['L', 'Нравится'], ['D', 'Сменить тему'], ['F', 'Открыть / закрыть Now Playing'], ['T', 'Текст песни'], ['Q', 'Очередь'], ['/', 'Поиск'], ['Esc', 'Назад, в конце — на главную']];
    (0, ui_js_1.openModal)({ title: 'Горячие клавиши', html: `<div class="kbd-list">${rows.map(([k, d]) => `<div><span>${d}</span><kbd>${k}</kbd></div>`).join('')}</div>` });
}
// ================= поиск =================
const doSearch = (0, util_js_1.debounce)(() => {
    if (route().name !== 'search') {
        location.hash = '#/search';
        return;
    }
    const box = (0, util_js_1.$)('#search-results');
    if (box)
        box.innerHTML = (0, views_js_1.searchResults)(query);
    syncRows();
}, 60);
document.addEventListener('input', e => {
    if (!e.target.matches?.('.search-input'))
        return;
    query = e.target.value;
    (0, util_js_1.$$)('.search-input').forEach(i => {
        if (i !== e.target)
            i.value = query;
    });
    doSearch();
});
// ================= настройки: тексты, резервная копия, сброс =================
let lyBusy = false;
// ---------- «Песни без данных» ----------
let fixBusy = '', peeked = 0;
// тексты, уже лежащие на устройстве, подтягиваем без интернета — иначе счётчик «без текста» врёт
async function peekAll() {
    const list = (0, state_js_1.derived)().all.filter(t => !t.lyrics && !t._peeked);
    if (!list.length || peeked)
        return;
    peeked = 1;
    let got = 0;
    for (const t of list) {
        t._peeked = true;
        if (await (0, lyrics_auto_js_1.peekLyrics)(t))
            got++;
    }
    peeked = 0;
    if (got && route().name === 'fix')
        render({ keepScroll: true });
}
const fixStep = label => {
    fixBusy = label;
    if (route().name === 'fix')
        render({ keepScroll: true });
};
async function fixAll() {
    if (fixBusy)
        return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
        return (0, ui_js_1.toast)('Нет интернета — искать негде', 'err');
    let artists = 0, texts = 0, covers = 0;
    try {
        // 1) артисты: «Артист - Название» в названии, иначе — каталог по названию и длине
        const noArtist = (0, tools_js_1.missing)().artist;
        fixStep(`Артисты: 0 из ${noArtist.length}`);
        for (const [i, t] of noArtist.entries()) {
            const own = state_js_1.state.tagEdits[t.id] || {};
            const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(t.title);
            let edit = null;
            if (dash)
                edit = { artist: dash[1].trim(), title: dash[2].trim() };
            else {
                const a = await (0, lyrics_auto_js_1.identifyArtist)(t);
                if (a)
                    edit = { artist: a };
            }
            if (edit) {
                (0, state_js_1.setTagEdit)(t.id, { ...own, ...edit });
                artists++;
            }
            if (i % 3 === 2)
                fixStep(`Артисты: ${i + 1} из ${noArtist.length}`);
        }
        // 2) обложки
        fixStep('Ищу обложки…');
        covers = await (0, covers_auto_js_1.runAutoCoversNow)();
        // 3) тексты
        const noText = (0, state_js_1.derived)().all.filter(t => !t.lyrics);
        let i = 0;
        fixStep(`Тексты: 0 из ${noText.length}`);
        const worker = async () => {
            while (i < noText.length) {
                const t = noText[i++];
                t._ly = undefined;
                if (await (0, lyrics_auto_js_1.ensureLyrics)(t))
                    texts++;
                if (i % 5 === 0)
                    fixStep(`Тексты: ${i} из ${noText.length}`);
            }
        };
        await Promise.all([worker(), worker(), worker()]);
    }
    finally {
        fixBusy = '';
        if (route().name === 'fix')
            render({ keepScroll: true });
    }
    const left = (0, tools_js_1.missing)();
    (0, ui_js_1.toast)(`Готово. Найдено: артистов — ${artists}, обложек — ${covers}, текстов — ${texts}. Осталось без данных: ${new Set([...left.artist, ...left.cover, ...left.lyrics]).size}.`, 'ok', 7000);
}
async function findAllLyrics() {
    if (lyBusy)
        return (0, ui_js_1.toast)('Поиск уже идёт…', 'info');
    const list = (0, state_js_1.derived)().all.filter(t => !t.lyrics);
    if (!list.length)
        return (0, ui_js_1.toast)('У всех песен уже есть текст', 'info');
    lyBusy = true;
    let found = 0, i = 0;
    const t0 = (0, ui_js_1.toast)(`Ищу тексты: ${list.length} песен…`, 'info', 3000);
    const worker = async () => {
        while (i < list.length) {
            const t = list[i++];
            if (await (0, lyrics_auto_js_1.ensureLyrics)(t))
                found++;
        }
    };
    await Promise.all([worker(), worker(), worker()]);
    lyBusy = false;
    (0, ui_js_1.toast)(`Готово: найдено ${found} из ${list.length}. Остальные — «Текст не найден».`, 'ok', 5000);
}
function setSettings() {
    (0, ui_js_1.openModal)({ title: 'Сбросить настройки?', html: '<p class="modal-text">Вид, цвета, фон и остальные параметры вернутся к значениям по умолчанию. Музыка, плейлисты и профиль не затрагиваются.</p>',
        actions: [{ label: 'Отмена' }, { label: 'Сбросить', primary: true, danger: true, onClick: () => { Object.assign(state_js_1.state.settings, state_js_1.DEFAULT_SETTINGS); (0, state_js_1.save)(); (0, state_js_1.emit)('settings', 'all'); } }] });
}
// ползунки своего эквалайзера: звук меняется сразу, без перерисовки страницы
document.addEventListener('input', e => {
    const r = e.target.closest && e.target.closest('.eq-slider');
    if (!r)
        return;
    const g = (state_js_1.state.settings.eqCustom || [0, 0, 0, 0, 0, 0]).slice();
    g[+r.dataset.i] = +r.value;
    const b = r.parentElement.querySelector('b');
    if (b)
        b.textContent = (g[+r.dataset.i] > 0 ? '+' : '') + g[+r.dataset.i];
    (0, state_js_1.setSetting)('eqCustom', g);
});
// ---------- вход по почте для синхронизации ----------
function emailSignIn() {
    (0, ui_js_1.openModal)({
        title: 'Вход в аккаунт Puro Cielo',
        html: `<div class="sm-form"><label class="sm-field wide"><span>Почта</span><input class="input" type="email" id="em-mail" autocomplete="email"></label>
      <label class="sm-field wide"><span>Пароль</span><input class="input" type="password" id="em-pass" autocomplete="current-password"></label>
      <p class="ti-note wide">Тот же аккаунт, что на сайте Puro Cielo. Нет аккаунта — нажмите «Создать».</p><p class="acc-err wide" id="em-err"></p></div>`,
        actions: [
            { label: 'Создать', keep: true, onClick: api => go(api, true) },
            { label: 'Войти', primary: true, keep: true, onClick: api => go(api, false) },
        ],
    });
    async function go(api, create) {
        const mail = api.el.querySelector('#em-mail').value.trim(), pass = api.el.querySelector('#em-pass').value;
        if (!mail || !pass)
            return;
        api.el.querySelector('#em-err').textContent = '';
        if (await (0, sync_js_1.signInEmail)(mail, pass, create)) {
            api.close();
            (0, ui_js_1.toast)('Вы вошли — синхронизация включена');
        }
        else
            api.el.querySelector('#em-err').textContent = sync_js_1.sync.error;
    }
}
(0, state_js_1.on)('sync', () => {
    if (route().name === 'settings')
        render({ keepScroll: true });
});
// ---------- редактор умного плейлиста ----------
function smartEditor(p) {
    const r = p?.rules || { sort: 'random' };
    const num = (k, label, ph) => `<label class="sm-field"><span>${label}</span><input class="input" type="number" min="0" step="1" data-r="${k}" value="${r[k] || ''}" placeholder="${ph}"></label>`;
    const sel = (k, label, opts) => `<label class="sm-field"><span>${label}</span><select class="input" data-r="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(r[k] || '') === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    (0, ui_js_1.openModal)({
        title: p ? 'Умный плейлист' : 'Новый умный плейлист', wide: true,
        html: `<div class="sm-form">
      <label class="sm-field wide"><span>Название</span><input class="input" data-r="name" value="${(0, util_js_1.esc)(p?.name || '')}" placeholder="Например, «Любимое, но забытое»" maxlength="80"></label>
      <label class="sm-check"><input type="checkbox" data-r="liked" ${r.liked ? 'checked' : ''}><span>Только понравившиеся</span></label>
      <label class="sm-field"><span>Артист содержит</span><input class="input" data-r="artist" value="${(0, util_js_1.esc)(r.artist || '')}" placeholder="любой"></label>
      <label class="sm-field"><span>Жанр содержит</span><input class="input" data-r="genre" value="${(0, util_js_1.esc)(r.genre || '')}" placeholder="любой"></label>
      ${num('minPlays', 'Прослушано не меньше, раз', 'неважно')}
      ${num('notPlayedDays', 'Не слушали дней', 'неважно')}
      ${num('addedDays', 'Добавлены за последние дней', 'когда угодно')}
      ${num('limit', 'Не больше песен', 'без ограничения')}
      ${sel('sort', 'Порядок', [['random', 'Случайный'], ['plays', 'Чаще слушаю'], ['added', 'Недавно добавленные'], ['title', 'По названию']])}
      <p class="sm-count" id="sm-count"></p></div>`,
        actions: [{ label: 'Отмена' }, { label: p ? 'Сохранить' : 'Создать', primary: true, onClick: api => {
                    const v = read(api.el);
                    const name = v.name.trim() || 'Умный плейлист';
                    delete v.name;
                    const sp = { id: p?.id || 'sm' + Date.now().toString(36), name, rules: v };
                    (0, state_js_1.saveSmart)(sp);
                    if (!p)
                        location.hash = '#/smart/' + sp.id;
                    else
                        render({ keepScroll: true });
                } }],
        onMount: api => {
            const upd = () => { const n = (0, state_js_1.smartTracks)({ id: 'preview', rules: read(api.el) }).length; api.el.querySelector('#sm-count').textContent = `Сейчас подходит: ${(0, util_js_1.plural)(n, ['песня', 'песни', 'песен'])}`; };
            api.el.addEventListener('input', upd);
            api.el.addEventListener('change', upd);
            upd();
        },
    });
    function read(root) {
        const v = {};
        root.querySelectorAll('[data-r]').forEach(i => {
            const k = i.dataset.r;
            if (i.type === 'checkbox')
                v[k] = i.checked;
            else if (i.type === 'number')
                v[k] = Math.max(0, parseInt(i.value, 10) || 0);
            else
                v[k] = i.value;
        });
        return v;
    }
}
function exportBackup() {
    const data = { app: 'puro-cielo', v: 1, covers: state_js_1.state.covers, playlists: state_js_1.state.playlists, likes: [...state_js_1.state.likes], plays: state_js_1.state.plays, profile: state_js_1.state.profile, settings: state_js_1.state.settings, theme: state_js_1.state.theme,
        // треки в плейлистах привязаны к id — сохраняем ещё и «имя» для справки
        names: Object.fromEntries([...state_js_1.state.tracks.values()].map(t => [t.id, `${t.artist} — ${t.title}`])) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = 'puro-cielo-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    (0, ui_js_1.toast)('Резервная копия сохранена');
}
(0, util_js_1.$)('#backup-input').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f)
        return;
    try {
        const d = JSON.parse(await f.text());
        if (d.app !== 'puro-cielo')
            throw 0;
        if (Array.isArray(d.playlists))
            state_js_1.state.playlists = d.playlists;
        if (Array.isArray(d.likes))
            state_js_1.state.likes = new Set(d.likes);
        if (d.plays)
            state_js_1.state.plays = d.plays;
        if (d.profile)
            Object.assign(state_js_1.state.profile, d.profile);
        if (d.settings)
            Object.assign(state_js_1.state.settings, d.settings);
        if (d.theme)
            state_js_1.state.theme = d.theme;
        if (d.covers && typeof d.covers === 'object')
            (0, state_js_1.setCovers)(d.covers);
        (0, state_js_1.save)();
        (0, theme_js_1.applyTheme)(state_js_1.state.theme);
        (0, theme_js_1.applySettings)();
        (0, i18n_js_1.setLang)(state_js_1.state.settings.lang);
        renderChrome();
        render({ keepScroll: true });
        (0, ui_js_1.toast)('Копия загружена');
    }
    catch {
        (0, ui_js_1.toast)('Это не файл резервной копии Puro Cielo', 'warn');
    }
});
// не гасить экран, пока играет музыка
let wake = null;
async function syncWake() {
    try {
        const want = state_js_1.state.settings.keepAwake && !player_js_1.audio.paused && 'wakeLock' in navigator;
        if (want && !wake) {
            wake = await navigator.wakeLock.request('screen');
            wake.addEventListener('release', () => { wake = null; });
        }
        else if (!want && wake) {
            await wake.release();
            wake = null;
        }
    }
    catch { /* ignore */ }
}
player_js_1.audio.addEventListener('play', syncWake);
player_js_1.audio.addEventListener('pause', syncWake);
(0, state_js_1.on)('settings', syncWake);
// ================= профиль =================
function cropImage(file, w, h) {
    return new Promise((res, rej) => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d');
            const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
            g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
            URL.revokeObjectURL(url);
            res(c.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
        img.src = url;
    });
}
const QUICK = {
    name: { title: 'Изменить имя', label: 'Отображаемое имя', max: 40, get: () => state_js_1.state.profile.name, set: v => { state_js_1.state.profile.name = v.trim() || 'Слушатель'; (0, state_js_1.save)(); (0, state_js_1.emit)('profile'); } },
    username: { title: 'Изменить ник', label: 'Имя пользователя', max: 30, pre: '@', get: () => state_js_1.state.profile.username,
        set: v => { state_js_1.state.profile.username = (v.trim().replace(/^@+/, '').replace(/[^\w.]/g, '') || 'listener').toLowerCase(); (0, state_js_1.save)(); (0, state_js_1.emit)('profile'); } },
    lyricsProxy: { title: 'Свой сервер текстов', label: 'Адрес Cloudflare Worker (https://…workers.dev)', max: 200, get: () => state_js_1.state.settings.lyricsProxy || '',
        set: v => {
            v = v.trim().replace(/\/+$/, '');
            if (v && !/^https:\/\//i.test(v)) {
                (0, ui_js_1.toast)('Адрес должен начинаться с https://', 'warn');
                return false;
            }
            (0, state_js_1.setSetting)('lyricsProxy', v);
        } },
};
function quickEdit(kind) {
    const q = QUICK[kind];
    (0, ui_js_1.openModal)({ title: q.title, html: `<label class="field"><span>${q.label}</span>${q.pre ? `<div class="input-pre"><i>${q.pre}</i><input class="input" id="qe" maxlength="${q.max}" value="${(0, util_js_1.esc)(q.get())}"></div>` : `<input class="input" id="qe" maxlength="${q.max}" value="${(0, util_js_1.esc)(q.get())}">`}</label>`,
        actions: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: () => q.set(document.getElementById('qe').value) }],
        onMount: () => {
            const i = document.getElementById('qe');
            i.focus();
            i.select();
            i.addEventListener('keydown', e => {
                if (e.key === 'Enter')
                    document.querySelector('.modal-foot [data-act="1"]').click();
            });
        } });
}
function editProfile() {
    const draft = { ...state_js_1.state.profile };
    (0, ui_js_1.openModal)({
        title: 'Профиль', wide: true,
        html: `<div class="pe">
      <div class="pe-banner" id="pe-banner"></div>
      <div class="pe-avatar" id="pe-avatar"></div>
      <div class="pe-btns"><button class="btn btn-soft sm" data-pick="banner">${(0, icons_js_1.icon)('upload')}Баннер</button><button class="btn btn-soft sm" data-pick="avatar">${(0, icons_js_1.icon)('upload')}Аватар</button><button class="btn btn-soft sm" data-reset>Сбросить</button></div>
      <label class="field"><span>Отображаемое имя</span><input class="input" id="pe-name" maxlength="40" value="${(0, util_js_1.esc)(draft.name)}"></label>
      <label class="field"><span>Имя пользователя</span><div class="input-pre"><i>@</i><input class="input" id="pe-user" maxlength="30" value="${(0, util_js_1.esc)(draft.username)}"></div></label>
      <input type="file" accept="image/*" id="pe-file" hidden></div>`,
        actions: [{ label: 'Отмена' }, {
                label: 'Сохранить', primary: true, onClick: () => {
                    state_js_1.state.profile = { ...draft, name: (0, util_js_1.$)('#pe-name').value.trim() || 'Слушатель', username: ((0, util_js_1.$)('#pe-user').value.trim().replace(/^@+/, '').replace(/[^\w.]/g, '') || 'listener').toLowerCase() };
                    (0, state_js_1.save)();
                    (0, state_js_1.emit)('profile');
                },
            }],
        onMount: api => {
            const paint = () => {
                (0, util_js_1.$)('#pe-banner').style.backgroundImage = draft.banner ? `url(${draft.banner})` : '';
                (0, util_js_1.$)('#pe-banner').classList.toggle('default', !draft.banner);
                (0, util_js_1.$)('#pe-avatar').innerHTML = draft.avatar ? `<span class="avatar xl"><img src="${draft.avatar}" alt=""></span>` : `<span class="avatar xl ph">${(0, util_js_1.esc)((((0, util_js_1.$)('#pe-name')?.value || draft.name).trim() || '?').charAt(0).toUpperCase())}</span>`;
            };
            paint();
            let kind = null;
            api.el.addEventListener('click', e => {
                const b = e.target.closest('[data-pick]');
                if (b) {
                    kind = b.dataset.pick;
                    (0, util_js_1.$)('#pe-file').value = '';
                    (0, util_js_1.$)('#pe-file').click();
                }
                if (e.target.closest('[data-reset]')) {
                    draft.avatar = draft.banner = null;
                    paint();
                }
            });
            (0, util_js_1.$)('#pe-name').addEventListener('input', () => {
                if (!draft.avatar)
                    paint();
            });
            (0, util_js_1.$)('#pe-file').addEventListener('change', async (ev) => {
                const f = ev.target.files[0];
                if (!f)
                    return;
                try {
                    if (kind === 'avatar')
                        draft.avatar = await cropImage(f, 320, 320);
                    else
                        draft.banner = await cropImage(f, 1400, 460);
                    paint();
                }
                catch {
                    (0, ui_js_1.toast)('Не удалось прочитать изображение', 'warn');
                }
            });
        },
    });
}
async function clearLibrary() {
    (0, ui_js_1.openModal)({
        title: 'Очистить библиотеку?', html: `<p class="modal-text">${native_js_1.isNative ? 'Кэш тегов и обложек будет удалён, а музыка в вашей папке останется нетронутой. Выберите папку заново, чтобы загрузить библиотеку.' : 'Все добавленные файлы будут удалены из браузера.'} Лайки и плейлисты сохранятся, но треки в них станут недоступны.</p>`,
        actions: [{ label: 'Отмена' }, { label: 'Очистить', primary: true, danger: true, onClick: async () => {
                    (0, player_js_1.stop)();
                    await (0, db_js_1.clearFiles)();
                    for (const id of state_js_1.state.tracks.keys())
                        (0, native_js_1.forgetFile)(id);
                    for (const t of state_js_1.state.tracks.values()) {
                        if (!t.url.startsWith('/f/'))
                            URL.revokeObjectURL(t.url);
                        if (t.cover)
                            URL.revokeObjectURL(t.cover);
                    }
                    state_js_1.state.tracks.clear();
                    state_js_1.state.hidden = [];
                    state_js_1.state.recents = [];
                    (0, state_js_1.save)();
                    (0, state_js_1.touchLibrary)();
                    (0, ui_js_1.toast)('Библиотека очищена', 'info');
                } }],
    });
}
// ================= импорт: кнопки и drag & drop =================
const fileInput = (0, util_js_1.$)('#file-input'), dirInput = (0, util_js_1.$)('#dir-input'), m3uInput = (0, util_js_1.$)('#m3u-input');
for (const inp of [fileInput, dirInput, m3uInput])
    inp.addEventListener('change', async () => { const fs = [...inp.files]; inp.value = ''; await (0, importer_js_1.importFiles)(fs); });
let dragDepth = 0;
const drop = (0, util_js_1.$)('#drop');
addEventListener('dragenter', e => {
    if (e.dataTransfer?.types?.includes('Files')) {
        dragDepth++;
        drop.classList.add('show');
    }
});
addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth)
        drop.classList.remove('show');
});
addEventListener('dragover', e => {
    if (e.dataTransfer?.types?.includes('Files'))
        e.preventDefault();
});
addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    drop.classList.remove('show');
    const p = (0, importer_js_1.filesFromDrop)(e.dataTransfer); // записи собираются синхронно
    await (0, importer_js_1.importFiles)(await p);
});
// ================= подписки =================
(0, state_js_1.on)('library', () => { render({ keepScroll: true }); renderSidePlaylists(); });
(0, state_js_1.on)('playlists', () => { render({ keepScroll: true }); renderSidePlaylists(); });
(0, state_js_1.on)('likes', syncLikes);
(0, state_js_1.on)('track', syncRows);
// карточка «Продолжить» на главной показывает ту песню, что играет сейчас
(0, state_js_1.on)('track', () => {
    if (route().name !== 'home')
        return;
    const el = (0, util_js_1.$)('.cont');
    if (!el) { // карточки ещё не было (до этого ничего не слушали) — перерисовываем главную, чтобы она появилась
        if ((0, player_js_1.current)() && !(0, views_js_1.homeHidden)().has('continue') && (0, util_js_1.$)('.quick, .section'))
            render({ keepScroll: true });
        return;
    }
    if (el.dataset.trackId !== (0, player_js_1.current)()?.id) {
        const html = (0, views_js_1.continueCard)();
        if (html)
            el.outerHTML = html;
    }
});
(0, state_js_1.on)('profile', () => { renderSideProfile(); render({ keepScroll: true }); });
(0, state_js_1.on)('theme', () => { render({ keepScroll: true }); syncThemeBtn(); });
(0, state_js_1.on)('settings', k => {
    (0, theme_js_1.applySettings)();
    if (k === 'stripSource') {
        (0, state_js_1.touchLibrary)();
        const t = (0, player_js_1.current)();
        if (t)
            (0, state_js_1.emit)('track', t);
    }
    if (k === 'lang' || k === 'all') {
        (0, i18n_js_1.setLang)(state_js_1.state.settings.lang);
        renderChrome();
        render({ keepScroll: true });
        (0, state_js_1.emit)('modes');
        (0, state_js_1.emit)('volume');
    }
    if (k === 'speed' || k === 'all')
        (0, player_js_1.setSpeed)(state_js_1.state.settings.speed);
    if (['all', 'corners', 'density', 'anim', 'homeRecents', 'homeOrder', 'homeHidden', 'bgCover', 'seekStep', 'keepAwake', 'homeView', 'cardSize', 'accent', 'lyricsSize', 'bgAnim', 'splash', 'autoLyrics', 'visualizer', 'speed', 'transition', 'eq'].includes(k))
        render({ keepScroll: true });
});
(0, state_js_1.on)('sleep', () => {
    if (['profile', 'settings'].includes(route().name))
        render({ keepScroll: true });
});
(0, state_js_1.on)('error', t => (0, ui_js_1.toast)(`Не удалось воспроизвести «${t?.title || 'трек'}». Возможно, формат не поддерживается.`, 'warn', 4500));
// ================= «назад»: Esc, Alt+←, кнопка мыши «назад», свайп от левого края =================
const navStack = [location.hash || '#/home'], scrollMem = new Map();
let lastHash = navStack[0];
function goBack() {
    if ((0, ui_js_1.closeTopModal)() || (0, ui_js_1.closeMenu)())
        return true;
    if ((0, nowplaying_js_1.isNPOpen)()) {
        (0, nowplaying_js_1.closeNP)();
        return true;
    }
    const r = route();
    if (r.name === 'home')
        return false;
    if (navStack.length > 1)
        history.back();
    else
        location.hash = '#/home'; // в итоге — на главную
    return true;
}
addEventListener('hashchange', () => {
    (0, ui_js_1.closeMenu)();
    scrollMem.set(lastHash, scrollY);
    const h = location.hash || '#/home';
    const back = navStack.length > 1 && navStack[navStack.length - 2] === h;
    if (back)
        navStack.pop();
    else if (navStack[navStack.length - 1] !== h)
        navStack.push(h);
    lastHash = h;
    render({ restore: back ? scrollMem.get(h) : null });
    renderSidePlaylists();
});
let swX = null, swY = 0;
addEventListener('touchstart', e => { const t = e.touches[0]; swX = t.clientX < 28 ? t.clientX : null; swY = t.clientY; }, { passive: true });
addEventListener('touchend', e => {
    if (swX == null)
        return;
    const t = e.changedTouches[0];
    if (t.clientX - swX > 70 && Math.abs(t.clientY - swY) < 70)
        goBack();
    swX = null;
}, { passive: true });
// ================= горизонтальные ряды: стрелки, колесо, перетаскивание =================
function syncRails() {
    (0, util_js_1.$$)('.section').forEach(sec => {
        const r = sec.querySelector('.rail'), b = sec.querySelectorAll('.rn');
        if (!r || b.length < 2)
            return;
        const max = r.scrollWidth - r.clientWidth;
        b[0].disabled = r.scrollLeft < 4;
        b[1].disabled = r.scrollLeft > max - 4;
        sec.classList.toggle('no-scroll', max < 6);
    });
}
view.addEventListener('scroll', syncRails, true);
addEventListener('resize', syncRails);
let drag = null, noClick = false;
view.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0)
        return;
    const r = e.target.closest('.rail');
    if (r)
        drag = { r, x: e.clientX, left: r.scrollLeft, moved: false };
});
addEventListener('pointermove', e => {
    if (!drag)
        return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true;
        drag.r.classList.add('dragging');
    }
    if (drag.moved)
        drag.r.scrollLeft = drag.left - dx;
});
addEventListener('pointerup', () => {
    if (!drag)
        return;
    if (drag.moved) {
        noClick = true;
        setTimeout(() => { noClick = false; }, 0);
    }
    drag.r.classList.remove('dragging');
    drag = null;
});
document.addEventListener('click', e => {
    if (noClick) {
        e.stopPropagation();
        e.preventDefault();
    }
}, true);
// колесо мыши над рядом листает его по горизонтали (на краях ряда — снова прокручивает страницу)
const wheelAnim = new WeakMap();
view.addEventListener('wheel', e => {
    if (e.ctrlKey || e.shiftKey)
        return;
    const r = e.target.closest?.('.rail');
    if (!r)
        return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY))
        return; // тачпад / горизонтальное колесо — как есть
    const max = r.scrollWidth - r.clientWidth;
    if (max < 6)
        return;
    let a = wheelAnim.get(r);
    const cur = a ? a.target : r.scrollLeft;
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * r.clientWidth : e.deltaY;
    if ((dy < 0 && cur <= 0) || (dy > 0 && cur >= max))
        return; // край — отдаём прокрутку странице
    e.preventDefault();
    const target = Math.max(0, Math.min(max, cur + dy * 1.6));
    if (!a) {
        a = { target };
        wheelAnim.set(r, a);
    }
    else
        a.target = target;
    if (a.raf)
        return;
    r.classList.add('wheeling');
    const step = () => {
        const d = a.target - r.scrollLeft;
        if (Math.abs(d) < 0.6) {
            r.scrollLeft = a.target;
            wheelAnim.delete(r);
            r.classList.remove('wheeling');
            syncRails();
            return;
        }
        r.scrollLeft += d * 0.22;
        a.raf = requestAnimationFrame(step);
    };
    a.raf = requestAnimationFrame(step);
}, { passive: false });
// сохранение при закрытии окна
addEventListener('pagehide', state_js_1.flushSave);
addEventListener('beforeunload', state_js_1.flushSave);
document.addEventListener('visibilitychange', () => {
    if (document.hidden)
        (0, state_js_1.flushSave)();
});
// ================= старт =================
(async () => {
    await (0, state_js_1.load)();
    (0, i18n_js_1.initI18n)(state_js_1.state.settings.lang);
    (0, sync_js_1.initSync)();
    (0, covers_auto_js_2.initAutoCovers)();
    (0, theme_js_1.applyTheme)(state_js_1.state.theme);
    (0, theme_js_1.applySettings)();
    (0, player_js_1.setVolume)(state_js_1.state.volume);
    (0, player_js_1.setSpeed)(state_js_1.state.settings.speed);
    renderChrome();
    (0, nowplaying_js_1.initPlayerUI)();
    (0, link_import_js_1.initLinkImport)();
    (0, bgfx_js_1.initBgFx)();
    (0, bgfx_js_1.runSplash)();
    render();
    const n = await (0, importer_js_1.restoreLibrary)();
    if (n)
        (0, ui_js_1.toast)(`Библиотека восстановлена: ${n}`, 'info', 2000);
    if (native_js_1.isNative)
        (0, native_js_1.rescan)();
})();
// Android: оболочка присылает список файлов выбранной папки; «назад» и фоновое воспроизведение
window.__puroNative = { onFetch: native_js_1.onNativeFetch, onScan: scan => (0, importer_js_1.syncNativeLibrary)(scan).then(() => {
        if (['profile', 'settings'].includes(route().name))
            render({ keepScroll: true });
    }) };
window.__puroBack = () => goBack();
// команды из уведомления / наушников (Android)
window.__puroCmd = c => {
    if (c === 'toggle')
        (0, player_js_1.toggle)();
    else if (c === 'play' && player_js_1.audio.paused)
        (0, player_js_1.toggle)();
    else if (c === 'pause' && !player_js_1.audio.paused)
        (0, player_js_1.toggle)();
    else if (c === 'next')
        (0, player_js_1.next)();
    else if (c === 'prev')
        (0, player_js_1.prev)();
};
if (native_js_1.isNative) {
    const pushPlayback = () => { const t = (0, player_js_1.current)(); (0, native_js_1.setPlayback)(!!t && !player_js_1.audio.paused, t?.title, t ? artistsOfTrack(t) : ''); };
    (0, state_js_1.on)('track', pushPlayback);
    (0, state_js_1.on)('state', pushPlayback);
}
// PWA: офлайн-кэш оболочки (только при открытии по http/https, не внутри приложения)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !native_js_1.isNative)
    navigator.serviceWorker.register('sw.js').catch(() => { });
window.__puro = { state: state_js_1.state, P: player_js_1.P, audio: player_js_1.audio, importFiles: importer_js_1.importFiles, derived: state_js_1.derived, normInfo: player_js_1.normInfo };

};
defs["artists.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.artistKey = exports.UNKNOWN = void 0;
exports.splitArtists = splitArtists;
exports.titleFeatured = titleFeatured;
exports.trackArtists = trackArtists;
const util_js_1 = require("./util.js");
// Разбор строки артистов: «A & B», «A; B», «A feat. B», «A (ft. B)», «A, B» → ['A', 'B']
// Названия, которые нельзя резать (содержат «&», «,» и т.п. внутри имени)
const KEEP = ['Tyler, The Creator', 'Florence & the Machine', 'Earth, Wind & Fire', 'Hall & Oates', 'Simon & Garfunkel', 'Crosby, Stills, Nash & Young',
    'Mumford & Sons', 'Kool & the Gang', 'Sonny & Cher', 'Echo & the Bunnymen', 'Siouxsie & the Banshees', 'Of Monsters and Men', 'Years & Years',
    'Brooks & Dunn', 'Bob Marley & The Wailers', 'Prince & The Revolution', 'Nick Cave & The Bad Seeds', 'Gerry & The Pacemakers', 'Tom Petty & The Heartbreakers',
    'AC/DC', 'Guns N\' Roses', 'Run-D.M.C.', 'Black Eyed Peas'];
const keepSorted = KEEP.slice().sort((a, b) => b.length - a.length);
const SEP = /\s*(?:;|&|,|\sfeat(?:uring)?\.?\s|\sft\.?\s|\sfeat(?:uring)?\.?$|\s×\s|\s+x\s+)\s*/i;
const FEAT_BRACKET = /[(\[]\s*(?:feat(?:uring)?\.?|ft\.?|with)\s+([^)\]]+)[)\]]/ig;
exports.UNKNOWN = 'Неизвестный артист';
function splitArtists(raw) {
    let s = String(raw || '').replace(/\u0000/g, ';').trim();
    if (!s)
        return [];
    s = s.replace(FEAT_BRACKET, ' feat. $1');
    const hold = [];
    for (const k of keepSorted) {
        const i = s.toLowerCase().indexOf(k.toLowerCase());
        if (i >= 0) {
            hold.push(s.slice(i, i + k.length));
            s = s.slice(0, i) + `\u0001${hold.length - 1}\u0001` + s.slice(i + k.length);
        }
    }
    const out = [], seen = new Set();
    for (let part of s.split(SEP)) {
        part = part.replace(/\u0001(\d+)\u0001/g, (_, n) => hold[+n]).trim();
        if (!part)
            continue;
        const key = (0, util_js_1.norm)(part);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(part);
    }
    return out;
}
// Артисты, указанные в названии: «Track (feat. B & C)»
function titleFeatured(title) {
    const out = [];
    for (const m of String(title || '').matchAll(new RegExp(FEAT_BRACKET.source, 'ig')))
        out.push(...splitArtists(m[1]));
    return out;
}
// Полный список артистов трека (без дубликатов, главный — первым)
function trackArtists(t) {
    const names = [...splitArtists(t.artist), ...titleFeatured(t.title)];
    const seen = new Set(), out = [];
    for (const n of names) {
        const k = (0, util_js_1.norm)(n);
        if (!seen.has(k)) {
            seen.add(k);
            out.push(n);
        }
    }
    return out.length ? out : [exports.UNKNOWN];
}
const artistKey = name => 'ar:' + (0, util_js_1.norm)(name);
exports.artistKey = artistKey;

};
defs["bgfx.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paletteFrom = paletteFrom;
exports.initBgFx = initBgFx;
exports.runSplash = runSplash;
const state_js_1 = require("./state.js");
const player_js_1 = require("./player.js");
const icons_js_1 = require("./icons.js");
// Фон по теме. Тёмная: почти чёрный и одно мягкое свечение в цвет обложки. Светлая: свет от самой обложки
// (она сильно размыта, а поверх плывут «облака» её цветов — пока музыка играет; на паузе они замирают).
const $ = s => document.querySelector(s);
const GRAPHITE = ['#5b5d66', '#3d3f47', '#7a7c86', '#2c2d33'];
// ---------- цвета обложки ----------
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn)
        return [0, 0, l];
    const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}
const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
// 4 цвета: самые «весомые» оттенки обложки, приглушённые до благородной яркости
function paletteFrom(url) {
    return new Promise(resolve => {
        if (!url)
            return resolve(null);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = c.height = 32;
                const x = c.getContext('2d', { willReadFrequently: true });
                x.drawImage(img, 0, 0, 32, 32);
                const px = x.getImageData(0, 0, 32, 32).data, bins = new Map();
                for (let i = 0; i < px.length; i += 4) {
                    const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
                    if (l < .08 || l > .95)
                        continue;
                    const k = s < .12 ? 'grey' : Math.round(h / 24) % 15;
                    const w = s < .12 ? .25 : .4 + s;
                    const b = bins.get(k) || { w: 0, h: 0, s: 0, l: 0, n: 0 };
                    b.w += w;
                    b.h += h;
                    b.s += s;
                    b.l += l;
                    b.n++;
                    bins.set(k, b);
                }
                const top = [...bins.values()].sort((a, b) => b.w - a.w).slice(0, 4).map(b => [b.h / b.n, b.s / b.n, b.l / b.n]);
                if (!top.length)
                    return resolve(null);
                while (top.length < 4)
                    top.push([(top[0][0] + 40 * top.length) % 360, top[0][1] * .8, top[0][2]]);
                resolve(top.map(([h, s, l], i) => hsl(h, Math.min(.85, s * 1.15 + .05), Math.min(.6, Math.max(.28, l * (i === 3 ? .7 : 1))))));
            }
            catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}
function initBgFx() {
    const cover = $('#bg-cover'), clouds = $('#bg-clouds'), root = document.documentElement;
    const sync = () => root.classList.toggle('is-playing', !player_js_1.audio.paused && !player_js_1.audio.ended && !!(0, player_js_1.current)());
    for (const e of ['play', 'pause', 'ended', 'emptied'])
        player_js_1.audio.addEventListener(e, sync);
    let lastUrl = null;
    const setPalette = cols => {
        (cols || GRAPHITE).forEach((v, i) => root.style.setProperty(`--c${i + 1}`, v));
        root.classList.toggle('has-glow', !!cols);
    };
    const paintCover = async () => {
        const t = (0, player_js_1.current)(), url = state_js_1.state.settings.bgCover !== false ? t?.cover || null : null;
        if (cover) {
            cover.style.backgroundImage = t?.cover ? `url("${t.cover}")` : '';
            cover.classList.toggle('on', !!t?.cover);
        }
        if (clouds) { // «облака»: те же цвета обложки, несколько размытых пятен, которые плывут, пока играет музыка
            if (t?.cover)
                clouds.style.setProperty('--img', `url("${t.cover}")`);
            clouds.classList.toggle('on', !!t?.cover);
        }
        sync();
        if (url === lastUrl)
            return;
        lastUrl = url;
        const cols = await paletteFrom(url);
        if (url === lastUrl)
            setPalette(cols);
    };
    // Главная, тёмная тема: верх страницы мягко окрашен в цвет песни из карточки «Продолжить»
    // (та, что играет, или последняя прослушанная) и плавно уходит в чёрный.
    let topUrl;
    const paintTop = async () => {
        root.classList.toggle('is-home', /^#?\/?(home)?$/.test(location.hash));
        const t = (0, player_js_1.current)() || (0, state_js_1.getTrack)(state_js_1.state.recents[0]);
        const url = state_js_1.state.settings.bgCover !== false ? t?.cover || null : null;
        if (url === topUrl)
            return;
        topUrl = url;
        const cols = await paletteFrom(url);
        if (url !== topUrl)
            return;
        if (cols) {
            root.style.setProperty('--h1', cols[0]);
            root.style.setProperty('--h2', cols[1]);
        }
        root.classList.toggle('has-top', !!cols);
    };
    addEventListener('hashchange', paintTop);
    for (const e of ['track', 'library', 'recents', 'covers'])
        (0, state_js_1.on)(e, paintTop);
    (0, state_js_1.on)('settings', k => {
        if (k === 'bgCover' || k === 'all') {
            topUrl = undefined;
            paintTop();
        }
    });
    paintTop();
    setPalette(null);
    (0, state_js_1.on)('track', paintCover);
    (0, state_js_1.on)('state', sync);
    (0, state_js_1.on)('settings', k => {
        if (k === 'bgCover' || k === 'all') {
            lastUrl = undefined;
            paintCover();
        }
    });
}
const greet = () => { const h = new Date().getHours(); return (h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер') + ', ' + state_js_1.state.profile.name; };
function runSplash() {
    const el = $('#splash');
    if (!el)
        return;
    if (!state_js_1.state.settings.splash) {
        el.remove();
        return;
    }
    $('#splash-mark').innerHTML = (0, icons_js_1.icon)('tower');
    $('#splash-hi').textContent = greet();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 800); }, 1900);
}

};
defs["covers-auto.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auto = void 0;
exports.runAutoCoversNow = runAutoCoversNow;
exports.scheduleAutoCovers = scheduleAutoCovers;
exports.initAutoCovers = initAutoCovers;
exports.setArtistPhoto = setArtistPhoto;
const db_js_1 = require("./db.js");
const state_js_1 = require("./state.js");
const lyrics_web_js_1 = require("./lyrics-web.js");
const artists_js_1 = require("./artists.js");
const jsonp_js_1 = require("./jsonp.js");
// Обложки сами: для альбомов и песен без картинки ищем её онлайн — сначала в каталоге iTunes (Apple Music),
// потом в MusicBrainz / Cover Art Archive. Берём, только если совпали и название, и артист.
// Обложка из файла и своя (карандашом) всегда важнее найденной. Найденное хранится на устройстве.
const ITUNES = 'https://itunes.apple.com/search';
const MB = 'https://musicbrainz.org/ws/2';
const RETRY = 14 * 864e5; // «не нашлось» — пробуем снова через две недели
exports.auto = { t: {}, a: {}, ar: {}, own: {}, miss: {} }; // t — песни, a — альбомы, ar — фото артистов, own — артисты, чьё фото задал сам пользователь
let loaded = false, running = false, timer = 0;
async function loadAuto() {
    if (loaded)
        return;
    loaded = true;
    try {
        const d = await (0, db_js_1.kvGet)('autoCovers');
        if (d && typeof d === 'object')
            Object.assign(exports.auto, { t: d.t || {}, a: d.a || {}, ar: d.v === 3 ? d.ar || {} : {}, own: d.own || {}, miss: d.v >= 2 ? Object.fromEntries(Object.entries(d.miss || {}).filter(([k]) => d.v === 3 || !k.startsWith('ar:'))) : {} }); // v3: фото артистов, найденные по одному имени, забываем — среди них были тёзки
    }
    catch { /* ignore */ }
}
const persist = () => (0, db_js_1.kvSet)('autoCovers', { ...exports.auto, v: 3 }).catch(() => { });
async function getJSON(url) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000);
    try {
        const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        return r.ok ? await r.json() : null;
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(tm);
    }
}
// картинка → data URL 500×500 (чтобы работала без интернета); если сайт не даёт прочитать — сама ссылка
async function toData(url, size = 500) {
    try {
        const r = await fetch(url);
        if (!r.ok)
            return null;
        const blob = await r.blob();
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.max(size / bmp.width, size / bmp.height);
        c.getContext('2d').drawImage(bmp, (size - bmp.width * s) / 2, (size - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
        return c.toDataURL('image/jpeg', .86);
    }
    catch {
        return url;
    }
}
// iTunes и Deezer не отдают CORS-заголовки, поэтому обычный fetch из браузера/приложения блокируется.
// Оба умеют JSONP: подключаем ответ как <script> с функцией обратного вызова.
// для сравнения убираем «(Deluxe Edition)», «- Single», «[Remastered 2011]», «feat. …» и т.п.
const EXTRA = /\s*[([](?:[^)\]]*?\b(?:deluxe|remaster(?:ed)?|edition|expanded|anniversary|bonus|version|single|ep|explicit|clean|feat\.?|ft\.?|with|prod\.?|radio edit|original mix)\b[^)\]]*)[)\]]/gi;
const clean = s => String(s || '').replace(EXTRA, '').replace(/\s+[-–—]\s+(?:single|ep)$/i, '').replace(/\s+(?:feat\.?|ft\.?)\s.+$/i, '').trim();
const same = (a, b) => (0, lyrics_web_js_1.titleMatch)(clean(a), clean(b)) || (0, lyrics_web_js_1.titleMatch)(a, b);
const artistOk = (theirs, artists) => !artists.length || (0, lyrics_web_js_1.artistMatch)(theirs, artists);
const big = u => String(u || '').replace(/\/\d+x\d+bb\./, '/600x600bb.');
const q = s => String(s || '').replace(/"/g, '');
async function deezer(path, query) {
    const j = await (0, jsonp_js_1.jsonp)(`https://api.deezer.com/search/${path}?${new URLSearchParams({ q: query, limit: '25', output: 'jsonp' })}`);
    return (j && j.data) || [];
}
async function itunes(entity, term) {
    const j = await (0, jsonp_js_1.jsonp)(`${ITUNES}?${new URLSearchParams({ term, entity, media: 'music', limit: '25' })}`);
    return (j && j.results) || [];
}
async function findAlbum(album, artists, firstTitle) {
    const a0 = artists[0] || '', name = clean(album) || album;
    // 1) Deezer: хорошо знает русскую и независимую музыку
    for (const query of [a0 ? `artist:"${q(a0)}" album:"${q(name)}"` : `album:"${q(name)}"`, `${a0} ${name}`.trim()]) {
        const hit = (await deezer('album', query)).find(r => same(r.title, album) && artistOk(r.artist?.name, artists));
        if (hit && (hit.cover_xl || hit.cover_big))
            return hit.cover_xl || hit.cover_big;
    }
    // 2) iTunes (Apple Music)
    const it = (await itunes('album', `${a0} ${name}`.trim())).find(r => same(r.collectionName, album) && artistOk(r.artistName, artists));
    if (it?.artworkUrl100)
        return big(it.artworkUrl100);
    // 3) по первой песне альбома: обложка её альбома, если название альбома похоже
    if (firstTitle && artists.length) {
        const tr = (await deezer('track', `artist:"${q(a0)}" track:"${q(clean(firstTitle))}"`)).find(r => same(r.title, firstTitle) && artistOk(r.artist?.name, artists) && same(r.album?.title, album));
        if (tr?.album?.cover_xl)
            return tr.album.cover_xl;
    }
    // 4) MusicBrainz + Cover Art Archive (у них CORS есть)
    const m = await getJSON(`${MB}/release?${new URLSearchParams({ query: `release:"${q(name)}"${a0 ? ` AND artist:"${q(a0)}"` : ''}`, fmt: 'json', limit: '8' })}`);
    const rel = (m?.releases || []).find(r => same(r.title, album) && artistOk((r['artist-credit'] || []).map(a => a.name).join(', '), artists));
    return rel ? `https://coverartarchive.org/release/${rel.id}/front-500` : null;
}
async function findSong(title, artists) {
    if (!artists.length)
        return null; // без артиста легко подставить чужую обложку — не ищем
    const a0 = artists[0], name = clean(title) || title;
    for (const query of [`artist:"${q(a0)}" track:"${q(name)}"`, `${a0} ${name}`]) {
        const hit = (await deezer('track', query)).find(r => same(r.title, title) && (0, lyrics_web_js_1.artistMatch)(r.artist?.name, artists));
        if (hit?.album?.cover_xl || hit?.album?.cover_big)
            return hit.album.cover_xl || hit.album.cover_big;
    }
    const it = (await itunes('song', `${a0} ${name}`)).find(r => same(r.trackName, title) && (0, lyrics_web_js_1.artistMatch)(r.artistName, artists));
    return it?.artworkUrl100 ? big(it.artworkUrl100) : null;
}
// Фото артиста из каталога Deezer. По одному имени искать нельзя — находятся тёзки с чужими фото.
// Поэтому ищем ПЕСНЮ этого артиста из медиатеки: совпали и название песни, и имя — значит, артист тот самый.
// Если артист в песне приглашённый, его фото берём из списка участников этой же песни.
const okPic = a => { const p = a && (a.picture_xl || a.picture_big); return p && !/\/artist\/\//.test(p) ? p : null; }; // «/artist//» — заглушка, фото нет
async function findArtist(name, tracks) {
    for (const tr of tracks || []) {
        const lead = tr.artists[0] || name;
        const hits = await deezer('track', `artist:"${q(lead)}" track:"${q(clean(tr.title) || tr.title)}"`);
        const song = hits.find(r => same(r.title_short || r.title, tr.title) && r.artist && (0, lyrics_web_js_1.artistMatch)(r.artist.name, tr.artists));
        if (!song)
            continue;
        if ((0, lyrics_web_js_1.nameEq)(song.artist.name, name)) {
            const p = okPic(song.artist);
            if (p)
                return p;
            continue;
        }
        const full = await (0, jsonp_js_1.jsonp)(`https://api.deezer.com/track/${song.id}?output=jsonp`);
        const me = ((full && full.contributors) || []).find(c => (0, lyrics_web_js_1.nameEq)(c.name, name));
        const p = okPic(me);
        if (p)
            return p;
    }
    return null;
}
// что искать: альбомы без обложки целиком, одиночные песни — по названию
function todo() {
    const d = (0, state_js_1.derived)(), now = Date.now(), jobs = [];
    const fresh = k => !(exports.auto.miss[k] && now - exports.auto.miss[k] < RETRY);
    for (const g of d.groups.values()) {
        const noCover = g.tracks.every(t => !t._tagCover && !state_js_1.state.covers.t[t.id]) && !state_js_1.state.covers.a[g.key];
        if (!noCover)
            continue;
        const artists = (g.artists || [g.artist]).filter(a => a && a !== artists_js_1.UNKNOWN);
        if (g.tracks.length > 1 && g.name && !exports.auto.a[g.key] && fresh('a:' + g.key))
            jobs.push({ kind: 'a', key: g.key, name: g.name, artists, first: g.tracks[0].title });
        else if (g.tracks.length === 1) {
            const t = g.tracks[0];
            if (!exports.auto.t[t.id] && fresh('t:' + t.id))
                jobs.push({ kind: 't', key: t.id, name: t.title, artists: (t._artists || []).filter(a => a !== artists_js_1.UNKNOWN), album: t.album });
        }
    }
    for (const a of d.artistList)
        if (a.name !== artists_js_1.UNKNOWN && !exports.auto.ar[a.key] && !exports.auto.own[a.key] && fresh('ar:' + a.key))
            jobs.push({ kind: 'ar', key: a.key, name: a.name, tracks: [...a.tracks.filter(t => t._artistKey === a.key), ...a.tracks.filter(t => t._artistKey !== a.key)].slice(0, 3).map(t => ({ title: t.title, artists: (t._artists || []).filter(x => x !== artists_js_1.UNKNOWN) })) });
    return jobs;
}
async function run(force = false) {
    if (running || (!force && state_js_1.state.settings.autoCovers === false) || (typeof navigator !== 'undefined' && navigator.onLine === false))
        return;
    running = true;
    await loadAuto();
    let found = 0;
    try {
        for (const j of todo()) {
            if (!force && state_js_1.state.settings.autoCovers === false)
                break;
            let url = j.kind === 'ar' ? await findArtist(j.name, j.tracks) : j.kind === 'a' ? await findAlbum(j.name, j.artists, j.first) : await findSong(j.name, j.artists);
            if (!url && j.kind === 't' && j.album)
                url = await findAlbum(j.album, j.artists); // сингл из альбома — обложка альбома
            if (url) {
                const data = await toData(url, j.kind === 'ar' ? 360 : 500);
                if (data) {
                    exports.auto[j.kind][j.key] = data;
                    delete exports.auto.miss[j.kind + ':' + j.key];
                    found++;
                    if (found % 3 === 0) { // показываем найденное по ходу, не дожидаясь конца
                        (0, state_js_1.touchLibrary)();
                        (0, state_js_1.emit)('covers');
                    }
                }
            }
            else
                exports.auto.miss[j.kind + ':' + j.key] = Date.now();
            persist();
            await new Promise(r => setTimeout(r, 350)); // бережно к сервисам
        }
    }
    finally {
        running = false;
        if (found) {
            (0, state_js_1.touchLibrary)();
            (0, state_js_1.emit)('covers');
        }
    }
}
// поиск по кнопке «Исправить всё»: забываем прежние «не нашлось» и ищем прямо сейчас; возвращает, сколько обложек добавилось
async function runAutoCoversNow() {
    await loadAuto();
    const count = () => Object.keys(exports.auto.t).length + Object.keys(exports.auto.a).length;
    const before = count();
    for (const k of Object.keys(exports.auto.miss))
        if (!k.startsWith('ar:'))
            delete exports.auto.miss[k];
    clearTimeout(timer);
    for (let i = 0; i < 40 && running; i++) // идёт фоновый поиск — ждём, пока закончит
        await new Promise(r => setTimeout(r, 500));
    await run(true);
    return count() - before;
}
function scheduleAutoCovers(ms = 2500) {
    clearTimeout(timer);
    timer = setTimeout(run, ms);
}
async function initAutoCovers() {
    (0, state_js_1.registerAutoCovers)(() => exports.auto);
    await loadAuto();
    if (Object.keys(exports.auto.t).length || Object.keys(exports.auto.a).length || Object.keys(exports.auto.ar).length) {
        (0, state_js_1.touchLibrary)();
        (0, state_js_1.emit)('covers');
    }
    (0, state_js_1.on)('library', () => scheduleAutoCovers());
    (0, state_js_1.on)('settings', k => {
        if (k === 'autoCovers') {
            (0, state_js_1.touchLibrary)();
            (0, state_js_1.emit)('covers');
            if (state_js_1.state.settings.autoCovers !== false) {
                exports.auto.miss = {};
                scheduleAutoCovers(300);
            }
        }
    });
    scheduleAutoCovers(4000);
}
// своё фото артиста (или «без фото»): выбор пользователя важнее найденного, заново не ищем
async function setArtistPhoto(key, data) {
    await loadAuto();
    if (data)
        exports.auto.ar[key] = data;
    else
        delete exports.auto.ar[key];
    exports.auto.own[key] = 1;
    persist();
    (0, state_js_1.touchLibrary)();
    (0, state_js_1.emit)('covers');
}

};
defs["db.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lySet = exports.lyKeys = exports.lyGet = exports.kvSet = exports.kvGet = exports.clearFiles = exports.delFile = exports.allFiles = exports.putFile = exports.putFileChecked = exports.getFileChecked = void 0;
// IndexedDB: файлы библиотеки ('files'), состояние приложения ('kv'), кэш текстов ('lyrics')
let dbp;
function open() {
    if (dbp)
        return dbp;
    dbp = new Promise((res, rej) => {
        let r;
        try {
            r = indexedDB.open('puro-library', 2);
        }
        catch (e) {
            return rej(e);
        }
        r.onupgradeneeded = () => {
            const db = r.result;
            if (!db.objectStoreNames.contains('files'))
                db.createObjectStore('files', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('kv'))
                db.createObjectStore('kv');
            if (!db.objectStoreNames.contains('lyrics'))
                db.createObjectStore('lyrics');
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
    return dbp;
}
async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
        const t = db.transaction(store, mode), s = t.objectStore(store);
        const req = fn(s);
        t.oncomplete = () => res(req && req.result);
        t.onerror = t.onabort = () => rej(t.error);
    });
}
const safe = f => async (...a) => {
    try {
        return await f(...a);
    }
    catch (e) {
        console.warn('IndexedDB:', e);
        return undefined;
    }
};
const getFileChecked = id => tx('files', 'readonly', s => s.get(id));
exports.getFileChecked = getFileChecked;
const putFileChecked = rec => tx('files', 'readwrite', s => s.put(rec));
exports.putFileChecked = putFileChecked;
exports.putFile = safe(exports.putFileChecked);
exports.allFiles = safe(async () => (await tx('files', 'readonly', s => s.getAll())) || []);
exports.delFile = safe(id => tx('files', 'readwrite', s => s.delete(id)));
exports.clearFiles = safe(() => tx('files', 'readwrite', s => s.clear()));
exports.kvGet = safe(k => tx('kv', 'readonly', s => s.get(k)));
exports.kvSet = safe((k, v) => tx('kv', 'readwrite', s => s.put(v, k)));
exports.lyGet = safe(k => tx('lyrics', 'readonly', s => s.get(k)));
exports.lyKeys = safe(async () => (await tx('lyrics', 'readonly', s => s.getAllKeys())) || []);
exports.lySet = safe((k, v) => tx('lyrics', 'readwrite', s => s.put(v, k)));

};
defs["firebase-config.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseConfig = void 0;
// Настройки веб-приложения Firebase (apiKey у веб-приложений не секретный: доступ защищают правила и список доменов).
exports.firebaseConfig = {
    apiKey: 'AIzaSyAxlmsUjoNW3zAdKXno0eX_KxyGCoF1pEQ',
    authDomain: 'purocielo-player.firebaseapp.com',
    projectId: 'purocielo-player',
    storageBucket: 'purocielo-player.firebasestorage.app',
    messagingSenderId: '502147686007',
    appId: '1:502147686007:web:8e981772bf940207ceb072',
};

};
defs["genius.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickGenius = pickGenius;
exports.geniusEmbed = geniusEmbed;
exports.embedText = embedText;
exports.cleanup = cleanup;
exports.geniusLyrics = geniusLyrics;
const lyrics_web_js_1 = require("./lyrics-web.js");
// Genius — главный источник обычного (не синхронного) текста.
// Сайт Genius не разрешает браузеру читать свои страницы (CORS), поэтому идём несколькими путями по очереди:
//  1) «посредник», если он есть: приложение для Windows/Android или свой Cloudflare Worker;
//  2) прямой запрос (вдруг разрешён);
//  3) публичные CORS-посредники (allorigins, corsproxy) — только для поиска и страницы песни;
//  4) сам текст — через официальный виджет Genius (embed.js): он подключается как <script> и CORS не нужен.
const PUBLIC = [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
    u => 'https://api.cors.lol/?url=' + encodeURIComponent(u),
    u => 'https://cors.eu.org/' + u,
];
async function get(u, ms = 4000, signal) {
    const ctl = new AbortController(), abort = () => ctl.abort(), tm = setTimeout(abort, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted)
        abort();
    try {
        const r = await fetch(u, { signal: ctl.signal });
        return r.ok ? await r.text() : '';
    }
    catch {
        return '';
    }
    finally {
        clearTimeout(tm);
        signal?.removeEventListener('abort', abort);
    }
}
// по очереди: посредник приложения → напрямую → публичные посредники; запоминаем, какой путь сработал
let goodRoute = -1;
async function fetchAny(u, fetchText, test, signal) {
    const routes = [
        fetchText ? () => fetchText(u) : null,
        () => get(u, 4000, signal),
        ...PUBLIC.map(p => () => get(p(u), 4000, signal)),
    ];
    const order = routes.map((_, i) => i);
    if (goodRoute >= 0)
        order.sort((a, b) => (b === goodRoute) - (a === goodRoute));
    for (const i of order) {
        if (signal?.aborted)
            return '';
        if (!routes[i])
            continue;
        let txt = '';
        try {
            txt = await routes[i]();
        }
        catch { /* следующий */ }
        if (txt && test(txt)) {
            goodRoute = i;
            return txt;
        }
    }
    return '';
}
const NOT_SONG = /\b(translations?|перевод|переклад|romanized|türkçe|traducción|tradução|übersetzung)\b/i;
// выбор песни из ответа поиска Genius: то же название и тот же артист; без переводов и пересказов
function pickGenius(json, artists, title, skip = []) {
    const sections = (json && json.response && json.response.sections) || [];
    const hits = [].concat(...sections.map(s => s.hits || [])).filter(h => h && h.result && (h.type === 'song' || h.index === 'song'));
    const ok = h => {
        const r = h.result, by = `${r.artist_names || ''}, ${r.primary_artist ? r.primary_artist.name : ''}`;
        if (skip.includes('genius:' + r.id))
            return false;
        if (NOT_SONG.test(by) || NOT_SONG.test(r.title || ''))
            return false;
        const t = r.title || r.title_with_featured || '';
        return ((0, lyrics_web_js_1.titleMatch)(t, title) || (0, lyrics_web_js_1.titleMatch)(String(t).replace(/\s*[([].*?[)\]]/g, ''), title)) && (!artists.length || (0, lyrics_web_js_1.artistMatch)(by, artists));
    };
    if (!artists.length) { // артиста не знаем: название должно совпасть буква в букву, быть приметным и встретиться у одной песни
        const want = (0, lyrics_web_js_1.norm)(title), same = hits.filter(h => !skip.includes('genius:' + h.result.id) && !NOT_SONG.test(`${h.result.artist_names || ''} ${h.result.title || ''}`) && (0, lyrics_web_js_1.norm)(h.result.title) === want);
        const one = want.length >= 8 && new Set(same.map(h => h.result.id)).size === 1 ? same[0] : null;
        return one ? { id: one.result.id, url: one.result.url } : null;
    }
    const h = hits.find(ok);
    return h ? { id: h.result.id, url: h.result.url } : null;
}
// The official widget runs in an isolated document. Late document.write calls
// must never replace the player page after a search is cancelled.
function geniusEmbed(id, ms = 5000, signal) {
    return new Promise(resolve => {
        if (signal?.aborted || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)
            return resolve('');
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0;visibility:hidden';
        const token = 'puro-lyrics-' + Math.random().toString(36).slice(2);
        let done = false;
        const end = html => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            window.removeEventListener('message', receive);
            signal?.removeEventListener('abort', cancel);
            frame.remove();
            resolve(embedText(html));
        };
        const receive = event => {
            if (event.source !== frame.contentWindow || event.data?.token !== token || typeof event.data.html !== 'string')
                return;
            end(event.data.html.slice(0, 500000));
        };
        const cancel = () => end('');
        const timer = setTimeout(cancel, ms);
        window.addEventListener('message', receive);
        signal?.addEventListener('abort', cancel, { once: true });
        frame.srcdoc = `<script>
            let captured = '';
            document.write = (...parts) => { captured += parts.join(''); };
            function finish() {
                const body = document.querySelector('.rg_embed_body');
                const html = captured || (body ? '<div class="rg_embed_body">' + body.innerHTML + '</div><div class="rg_embed_footer"></div>' : '');
                parent.postMessage({ token: ${JSON.stringify(token)}, html }, '*');
            }
        <\/script><div id="rg_embed_link_${Number(id)}" class="rg_embed_link" data-song-id="${Number(id)}"></div>
        <script src="https://genius.com/songs/${Number(id)}/embed.js" onload="setTimeout(finish,150)" onerror="finish()"><\/script>`;
        document.body.appendChild(frame);
    });
}
// html виджета → текст песни
function embedText(html) {
    html = String(html || '');
    if (!html)
        return '';
    const m = /<div[^>]*class=['"][^'"]*rg_embed_body[^'"]*['"][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*class=['"][^'"]*rg_embed_footer|$)/i.exec(html);
    let body = m ? m[1] : '';
    if (!body) {
        const s = html.indexOf('rg_embed_body');
        if (s < 0)
            return '';
        body = html.slice(html.indexOf('>', s) + 1);
        const f = body.search(/<div[^>]*rg_embed_footer|<div[^>]*rg_embed_header/i);
        if (f > 0)
            body = body.slice(0, f);
    }
    return cleanup((0, lyrics_web_js_1.htmlToText)(body));
}
// убираем шапку «N Contributors … Lyrics», «Embed», «You might also like» и лишние пустые строки
function cleanup(t) {
    return String(t || '')
        .replace(/^[\s\S]{0,300}?\bLyrics\b[^\n]*\n(?=\s*\[)/, '')
        .replace(/^\d+\s*Contributors?[^\n]*\n/i, '')
        .replace(/\n?You might also like\n?/gi, '\n')
        .replace(/\d*\s*Embed\s*$/i, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
const enough = t => !!t && t.split('\n').filter(l => l.trim()).length >= 4;
const looksJson = s => /^\s*\{/.test(s) && s.includes('"response"');
// cands: [{ artist, title }] — варианты из тегов/имени файла; artists — все артисты трека
async function geniusLyrics(cands, artists, fetchText, skip = [], { signal } = {}) {
    const seen = new Set();
    const queries = [];
    for (const c of cands) {
        for (const q of [`${c.artist} ${c.title}`.trim(), `${c.title} ${c.artist}`.trim(), c.title])
            if (q && !seen.has(q.toLowerCase())) {
                seen.add(q.toLowerCase());
                queries.push({ q, c });
            }
    }
    for (const { q, c } of queries.slice(0, 5)) {
        if (signal?.aborted)
            return null;
        const arts = c.artist ? [...new Set([c.artist, ...artists])] : artists;
        let hit = null;
        for (const ep of ['search/song', 'search/multi']) {
            const raw = await fetchAny(`https://genius.com/api/${ep}?per_page=10&q=${encodeURIComponent(q)}`, fetchText, looksJson, signal);
            if (!raw)
                break; // поиск недоступен ни одним путём
            try {
                hit = pickGenius(JSON.parse(raw), arts, c.title, skip);
            }
            catch { /* битый ответ */ }
            if (hit)
                break;
        }
        if (!hit)
            continue;
        // текст: виджет (без CORS) → страница песни
        let text = '';
        try {
            text = await geniusEmbed(hit.id, 5000, signal);
        }
        catch { /* дальше */ }
        if (!enough(text) && hit.url) {
            const page = await fetchAny(hit.url, fetchText, s => s.includes('data-lyrics-container'), signal);
            text = cleanup((0, lyrics_web_js_1.extractGenius)(page));
        }
        if (enough(text))
            return { text, ref: 'genius:' + hit.id };
    }
    return null;
}

};
defs["i18n.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EN_PLURAL = exports.isEn = exports.getLang = void 0;
exports.tr = tr;
exports.initI18n = initI18n;
exports.setLang = setLang;
// Язык интерфейса. Плеер написан по-русски; для English готовые строки на странице переводятся по словарю
// (тексты кнопок, подсказки, всплывающие сообщения). Названия песен, артистов и тексты песен не трогаются.
let lang = 'ru';
const getLang = () => lang;
exports.getLang = getLang;
const isEn = () => lang === 'en';
exports.isEn = isEn;
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
    'Браузер не дал открыть окошко. Разрешите всплывающие окна для этого сайта.': 'The browser blocked the window. Allow pop-ups for this site.', 'Фото артиста': 'Artist photo', 'Выбрать фото…': 'Choose a photo…', 'Убрать фото': 'Remove photo', 'Фото артиста обновлено': 'Artist photo updated', 'Фото убрано': 'Photo removed', 'Продолжить': 'Continue', 'Слушать дальше': 'Keep listening', 'Открыть альбом': 'Open album', 'Перемешать всё': 'Shuffle all', 'Быстрые кнопки': 'Quick buttons', 'Выше': 'Move up', 'Ниже': 'Move down', 'Порядок разделов на главной: стрелками двигайте выше или ниже, выключателем — скрывайте.': 'Order of sections on the home page: move them with the arrows, hide them with the switch.', 'Если у песни или альбома нет обложки, плеер найдёт её сам. Заодно найдёт фото артистов.': 'If a song or album has no cover, the player finds one itself. It also finds artist photos.', 'Удалить песню?': 'Delete this song?', 'Удалить песню': 'Delete song', 'Удалить из медиатеки': 'Delete from library', 'Удалить': 'Delete', 'Добавить копию песни?': 'Add a copy of the song?', 'Добавить копии песен?': 'Add copies of the songs?', 'Добавить копию': 'Add a copy', 'Добавить копии': 'Add copies', 'Не добавлять': 'Don’t add', 'Фон от обложки': 'Background from cover', 'Тёмная тема: чёрный фон и мягкое свечение в цвет обложки. Светлая тема: свет от самой обложки.': 'Dark theme: black background with a soft glow in the cover colour. Light theme: light from the cover itself.', 'Движение фона': 'Background motion', 'Свет от обложки медленно плывёт.': 'The light from the cover drifts slowly.', 'Искать обложки': 'Find covers', 'Если у песни или альбома нет обложки, плеер найдёт её сам (iTunes, MusicBrainz).': 'If a song or album has no cover, the player finds one itself (iTunes, MusicBrainz).', 'Убирать приписки сайтов': 'Remove site tags', 'Например, «Династия (Sefon.Pro)» → «Династия». Файлы не меняются.': 'For example, “Song (Sefon.Pro)” → “Song”. Files aren’t changed.', 'Живой градиент': 'Living gradient', 'Цвета обложки играющей песни медленно перетекают по фону.': 'Colours from the playing song’s cover slowly flow across the background.', 'Звёздная пыль': 'Stardust', 'Мерцающие искры, которые оживают в такт музыке.': 'Twinkling sparks that come alive with the beat.', 'Цвета из обложки': 'Colours from the cover', 'Фон и искры окрашиваются в цвета текущего трека.': 'The background and sparks take on the current track’s colours.', 'Это не тот текст': 'Wrong lyrics', 'Ищу другой текст…': 'Looking for other lyrics…', 'Нашёл другой вариант': 'Found another version', 'Другого текста не нашлось — можно добавить свой через карандаш': 'No other lyrics found — you can add your own with the pencil', 'Firebase не пускает к данным синхронизации: опубликуйте новые правила Firestore (файл AUTH-SETUP.md в репозитории).': 'Firebase denies access to sync data: publish the new Firestore rules (AUTH-SETUP.md in the repository).', 'Нет связи с сервером — синхронизирую, когда появится интернет.': 'No connection to the server — will sync when the internet is back.', 'Текст и обложка': 'Lyrics and cover', 'Обложка трека…': 'Track cover…', 'Обложка трека обновлена': 'Track cover updated',
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
exports.EN_PLURAL = { 'песня': ['song', 'songs'], 'трек': ['track', 'tracks'], 'альбом': ['album', 'albums'], 'сингл': ['single', 'singles'], 'файл': ['file', 'files'], 'раз': ['time', 'times'], 'прослушивание': ['play', 'plays'] };
function tr(s) {
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
function initI18n(l) {
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
function setLang(l) {
    const next = l === 'en' ? 'en' : 'ru';
    const was = lang;
    lang = next;
    document.documentElement.lang = next;
    if (next === 'en')
        walk(document.body);
    else if (was === 'en')
        restore(document.body);
}

};
defs["icons.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.icon = icon;
// Набор иконок: S — линейные (stroke), F — залитые (fill)
const S = d => ({ s: 1, d }), F = d => ({ s: 0, d });
const speaker = '<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" fill="currentColor" stroke="none"/>';
const ICONS = {
    play: F('<path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/>'),
    pause: F('<rect x="6" y="4.5" width="4.2" height="15" rx="1.4"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4"/>'),
    next: F('<path d="M5 6.2v11.6a1 1 0 0 0 1.55.83l8-5.8a1 1 0 0 0 0-1.66l-8-5.8A1 1 0 0 0 5 6.2z"/><rect x="16.5" y="5" width="2.8" height="14" rx="1.2"/>'),
    prev: F('<path d="M19 6.2v11.6a1 1 0 0 1-1.55.83l-8-5.8a1 1 0 0 1 0-1.66l8-5.8A1 1 0 0 1 19 6.2z"/><rect x="4.7" y="5" width="2.8" height="14" rx="1.2"/>'),
    shuffle: S('<path d="M16 4h4v4M4 20 20 4M20 16v4h-4M4 4l5 5M15 15l5 5"/>'),
    repeat: S('<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
    'repeat-one': S('<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/><path d="m10.6 10.2 1.6-1v6.2"/>'),
    heart: S('<path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.4 3.3 4.2 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/>'),
    'heart-fill': F('<path d="M12 20.8s-7.9-4.8-9.7-9.8C1 7.3 3.2 3.8 6.9 3.8c2.2 0 3.7 1.1 5.1 3 1.4-1.9 2.9-3 5.1-3 3.7 0 5.9 3.500 4.600 7.200-1.800 5-9.700 9.800-9.700 9.800z"/>'),
    queue: S('<path d="M4 6h16M4 12h9M4 18h7"/><path d="M16.5 14.5v6l5-3z" fill="currentColor"/>'),
    lyrics: S('<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 9h8M8 12.5h5"/>'),
    'vol-low': S(speaker + '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>'),
    'vol-high': S(speaker + '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18.3 6.700a7 7 0 0 1 0 10.600"/>'),
    'vol-mute': S(speaker + '<path d="m16 9.500 5 5M21 9.500l-5 5"/>'),
    search: S('<circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200"/>'),
    home: S('<path d="M4 11.200 12 4l8 7.200V19a1 1 0 0 1-1 1h-4.500v-5.500h-5V20H5a1 1 0 0 1-1-1z"/>'),
    library: S('<rect x="3.500" y="3.500" width="7" height="7" rx="2"/><rect x="13.500" y="3.500" width="7" height="7" rx="2"/><rect x="3.500" y="13.500" width="7" height="7" rx="2"/><rect x="13.500" y="13.500" width="7" height="7" rx="2"/>'),
    user: S('<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    more: F('<circle cx="5" cy="12" r="1.800"/><circle cx="12" cy="12" r="1.800"/><circle cx="19" cy="12" r="1.800"/>'),
    close: S('<path d="m6 6 12 12M18 6 6 18"/>'),
    'chev-down': S('<path d="m6 9 6 6 6-6"/>'),
    'chev-up': S('<path d="m6 15 6-6 6 6"/>'),
    'chev-right': S('<path d="m9 6 6 6-6 6"/>'),
    'chev-left': S('<path d="m15 6-6 6 6 6"/>'),
    refresh: S('<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4.500h-4.500"/>'),
    lyrics: S('<path d="M5 6.500h14M5 11.500h14M5 16.500h8"/>'),
    sparkle: S('<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/><path d="M19 16v4M17 18h4"/>'),
    note: S('<path d="M9 18V6l11-2v12"/><circle cx="6.500" cy="18" r="2.500" fill="currentColor"/><circle cx="17.500" cy="16" r="2.500" fill="currentColor"/>'),
    disc: S('<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="2.500"/>'),
    single: S('<circle cx="12" cy="12" r="8.500"/><path d="M12 8v6.500"/><circle cx="10.500" cy="14.500" r="1.500" fill="currentColor"/>'),
    playlist: S('<path d="M4 6h12M4 11h12M4 16h7"/><path d="M19 13v6M16 16h6"/>'),
    sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2M12 19.500v2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M2.500 12h2M19.500 12h2M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/>'),
    moon: S('<path d="M20 14.500A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.500z"/>'),
    upload: S('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
    download: S('<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>'),
    trash: S('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
    edit: S('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    pip: S('<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="11.5" y="11.5" width="7" height="5" rx="1.2" fill="currentColor" stroke="none"/>'),
    folder: S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    check: S('<path d="m5 12.500 4.500 4.500L19 7"/>'),
    copy: S('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 5.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2"/>'),
    next2: S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    keyboard: S('<rect x="2.500" y="6" width="19" height="12" rx="2.500"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
    'view-rail': S('<rect x="3" y="7" width="7" height="10" rx="2"/><rect x="12.500" y="7" width="7" height="10" rx="2"/><path d="M21.500 9v6"/>'),
    'view-grid': S('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
    'view-list': S('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.500" cy="6" r="1" fill="currentColor"/><circle cx="4.500" cy="12" r="1" fill="currentColor"/><circle cx="4.500" cy="18" r="1" fill="currentColor"/>'),
    settings: S('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    speed: S('<path d="M4.5 17a8.500 8.500 0 1 1 15 0"/><path d="m12 13 4-5"/><circle cx="12" cy="13" r="1.300" fill="currentColor"/>'),
    translate: S('<path d="M4 5h9M8.500 3v2c0 4-2.500 7-5 8.500M6 9c1.500 2.500 4 4.500 6.500 5.500"/><path d="m13 21 4-9 4 9M14.300 18h5.400"/>'),
    chart: S('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    smart: S('<path d="M4 6h10M4 12h7M4 18h6"/><path d="m17 11 1.200 2.800L21 15l-2.800 1.200L17 19l-1.200-2.800L13 15l2.800-1.200z"/>'),
    mix: S('<path d="M3 7h3.500c2 0 3.200.900 4.300 2.600l2.400 4.800c1.100 1.700 2.300 2.600 4.300 2.600H21"/><path d="M3 17h3.500c1.400 0 2.400-.400 3.200-1.200M14.300 8.200c.800-.800 1.800-1.200 3.200-1.200H21"/><path d="m18.500 4.500 2.500 2.500-2.500 2.500M18.500 14.500l2.500 2.500-2.500 2.500"/>'),
    tower: F('<path fill-rule=\"evenodd\" d=\"M13.43 2.24L12.91 2.63L12.55 3.28L12.30 4.06L12.12 4.85L11.96 5.64L11.80 6.41L11.61 7.17L11.41 7.92L11.20 8.67L11.00 9.43L10.81 10.21L10.63 10.99L10.47 11.79L10.30 12.57L10.11 13.35L9.90 14.09L9.65 14.80L9.31 15.38L8.79 15.69L8.04 15.66L7.17 15.46L6.32 15.38L5.57 15.52L4.85 15.80L4.11 16.11L3.38 16.45L2.74 16.92L2.28 17.56L2.05 18.35L2.05 19.16L2.31 19.87L2.77 20.46L3.38 20.93L4.07 21.29L4.82 21.55L5.60 21.72L6.41 21.79L7.23 21.78L8.04 21.67L8.83 21.48L9.58 21.21L10.29 20.85L10.94 20.42L11.51 19.92L11.99 19.34L12.37 18.70L12.69 18.01L12.95 17.27L13.17 16.52L13.36 15.74L13.56 14.97L13.75 14.20L13.94 13.43L14.13 12.66L14.32 11.89L14.51 11.12L14.71 10.36L14.90 9.59L15.11 8.82L15.31 8.04L15.53 7.26L15.79 6.56L16.31 6.33L17.03 6.56L17.76 6.94L18.43 7.43L19.02 8.00L19.50 8.62L19.93 9.29L20.36 9.97L20.86 10.62L21.34 10.79L21.71 10.26L21.93 9.52L22.02 8.73L21.97 7.92L21.80 7.13L21.52 6.37L21.12 5.67L20.64 5.04L20.07 4.50L19.45 4.02L18.77 3.62L18.06 3.30L17.33 3.05L16.58 2.85L15.81 2.66L14.98 2.42L14.15 2.22zM6.64 17.64L6.75 17.63L6.85 17.63L6.96 17.63L7.07 17.63L7.17 17.64L7.28 17.66L7.38 17.68L7.48 17.70L7.58 17.72L7.68 17.76L7.78 17.79L7.87 17.83L7.95 17.87L8.04 17.92L8.11 17.96L8.19 18.02L8.25 18.07L8.31 18.13L8.36 18.20L8.41 18.26L8.44 18.33L8.47 18.40L8.49 18.48L8.50 18.55L8.50 18.63L8.49 18.71L8.47 18.79L8.45 18.87L8.41 18.95L8.38 19.03L8.33 19.10L8.28 19.17L8.22 19.24L8.16 19.30L8.09 19.36L8.02 19.41L7.94 19.46L7.86 19.50L7.77 19.53L7.68 19.56L7.59 19.59L7.49 19.61L7.39 19.63L7.29 19.64L7.19 19.65L7.08 19.66L6.97 19.66L6.87 19.66L6.76 19.65L6.65 19.64L6.54 19.63L6.44 19.61L6.33 19.59L6.23 19.57L6.13 19.54L6.04 19.51L5.94 19.47L5.86 19.44L5.77 19.39L5.70 19.35L5.62 19.30L5.56 19.25L5.50 19.19L5.45 19.14L5.41 19.07L5.37 19.01L5.35 18.94L5.33 18.87L5.32 18.80L5.33 18.72L5.34 18.64L5.36 18.56L5.38 18.48L5.42 18.41L5.46 18.33L5.50 18.25L5.56 18.18L5.62 18.11L5.68 18.05L5.75 17.99L5.82 17.93L5.90 17.88L5.98 17.83L6.07 17.79L6.16 17.75L6.25 17.72L6.34 17.69L6.44 17.67L6.54 17.65zM11.76 12.79L11.83 12.77L11.91 12.76L12.00 12.75L12.08 12.76L12.17 12.78L12.25 12.81L12.34 12.85L12.41 12.89L12.49 12.94L12.55 13.00L12.61 13.06L12.66 13.13L12.70 13.20L12.73 13.28L12.74 13.36L12.76 13.44L12.76 13.53L12.76 13.62L12.75 13.71L12.74 13.81L12.73 13.90L12.71 14.00L12.69 14.11L12.68 14.21L12.66 14.32L12.64 14.42L12.62 14.53L12.60 14.64L12.58 14.74L12.56 14.85L12.53 14.95L12.50 15.05L12.48 15.15L12.44 15.25L12.41 15.34L12.37 15.43L12.33 15.51L12.29 15.59L12.24 15.66L12.19 15.73L12.14 15.79L12.08 15.84L12.01 15.89L11.94 15.92L11.87 15.95L11.79 15.97L11.71 15.98L11.62 15.98L11.53 15.98L11.45 15.96L11.36 15.94L11.28 15.91L11.20 15.87L11.12 15.83L11.06 15.78L11.00 15.72L10.95 15.65L10.91 15.58L10.87 15.51L10.85 15.43L10.83 15.34L10.82 15.25L10.82 15.16L10.82 15.07L10.82 14.97L10.83 14.87L10.85 14.78L10.86 14.68L10.88 14.58L10.90 14.48L10.93 14.38L10.95 14.28L10.98 14.18L11.01 14.09L11.05 13.99L11.08 13.89L11.11 13.79L11.15 13.70L11.19 13.60L11.22 13.50L11.26 13.41L11.31 13.31L11.35 13.23L11.40 13.14L11.45 13.06L11.50 12.99L11.56 12.93L11.62 12.87L11.68 12.82zM12.88 8.50L12.96 8.49L13.04 8.48L13.12 8.49L13.20 8.51L13.28 8.54L13.35 8.58L13.43 8.62L13.50 8.68L13.56 8.74L13.62 8.80L13.67 8.88L13.71 8.95L13.74 9.03L13.76 9.11L13.77 9.20L13.78 9.28L13.78 9.37L13.77 9.47L13.76 9.56L13.74 9.66L13.73 9.76L13.71 9.86L13.69 9.96L13.67 10.06L13.65 10.17L13.63 10.28L13.61 10.38L13.59 10.49L13.57 10.59L13.55 10.69L13.52 10.80L13.50 10.89L13.47 10.99L13.44 11.08L13.41 11.17L13.38 11.25L13.34 11.33L13.30 11.40L13.25 11.47L13.20 11.53L13.15 11.58L13.09 11.63L13.03 11.67L12.96 11.69L12.89 11.71L12.81 11.72L12.73 11.73L12.65 11.72L12.56 11.70L12.48 11.68L12.39 11.65L12.31 11.61L12.24 11.57L12.17 11.52L12.11 11.46L12.05 11.40L12.00 11.33L11.97 11.25L11.94 11.18L11.92 11.10L11.91 11.01L11.90 10.92L11.90 10.83L11.91 10.74L11.92 10.64L11.93 10.55L11.95 10.45L11.96 10.36L11.98 10.26L12.00 10.16L12.03 10.06L12.05 9.97L12.08 9.87L12.11 9.77L12.14 9.68L12.17 9.58L12.20 9.48L12.24 9.39L12.28 9.29L12.32 9.19L12.36 9.10L12.41 9.01L12.45 8.92L12.50 8.84L12.56 8.76L12.62 8.69L12.68 8.63L12.74 8.57L12.81 8.53zM13.96 4.25L14.03 4.24L14.10 4.24L14.18 4.25L14.26 4.27L14.33 4.30L14.41 4.34L14.48 4.39L14.55 4.44L14.61 4.50L14.67 4.57L14.72 4.64L14.76 4.71L14.80 4.79L14.82 4.87L14.84 4.95L14.85 5.04L14.85 5.12L14.85 5.21L14.84 5.30L14.82 5.39L14.81 5.49L14.79 5.59L14.77 5.68L14.75 5.79L14.72 5.89L14.70 5.99L14.68 6.09L14.65 6.19L14.62 6.30L14.60 6.40L14.57 6.49L14.53 6.59L14.50 6.68L14.46 6.77L14.43 6.86L14.38 6.94L14.34 7.02L14.30 7.09L14.25 7.15L14.19 7.21L14.14 7.27L14.08 7.31L14.02 7.35L13.95 7.38L13.88 7.40L13.81 7.41L13.73 7.41L13.65 7.40L13.57 7.38L13.49 7.36L13.41 7.33L13.33 7.29L13.26 7.24L13.20 7.19L13.14 7.13L13.08 7.07L13.04 7.00L13.00 6.93L12.98 6.85L12.96 6.76L12.95 6.68L12.95 6.59L12.96 6.50L12.96 6.40L12.98 6.31L13.00 6.21L13.02 6.12L13.04 6.02L13.06 5.92L13.08 5.83L13.11 5.73L13.13 5.63L13.16 5.54L13.19 5.45L13.22 5.35L13.26 5.26L13.29 5.16L13.33 5.07L13.37 4.98L13.41 4.89L13.45 4.80L13.50 4.71L13.54 4.63L13.59 4.55L13.65 4.48L13.70 4.42L13.76 4.36L13.82 4.31L13.89 4.28z\"/>'),
};
function icon(name, cls = '') {
    const i = ICONS[name];
    if (!i)
        return '';
    const attrs = i.s ? 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"';
    return `<svg class="ic ${cls}" viewBox="0 0 24 24" ${attrs} aria-hidden="true">${i.d}</svg>`;
}

};
defs["importer.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTrack = buildTrack;
exports.restoreLibrary = restoreLibrary;
exports.importDownloadedAudio = importDownloadedAudio;
exports.importFiles = importFiles;
exports.filesFromDrop = filesFromDrop;
exports.syncNativeLibrary = syncNativeLibrary;
const tags_js_1 = require("./tags.js");
const lrc_js_1 = require("./lrc.js");
const m3u_js_1 = require("./m3u.js");
const state_js_1 = require("./state.js");
const db_js_1 = require("./db.js");
const native_js_1 = require("./native.js");
const util_js_1 = require("./util.js");
const ui_js_1 = require("./ui.js");
const trackId = f => `${f.name}|${f.size}`;
function getDuration(url) {
    return new Promise(res => {
        const a = new Audio();
        a.preload = 'metadata';
        let done = false;
        const fin = v => {
            if (done)
                return;
            done = true;
            a.removeAttribute('src');
            a.load();
            res(v);
        };
        a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : 0);
        a.onerror = () => fin(0);
        setTimeout(() => fin(0), 8000);
        a.src = url;
    });
}
function lyricsFrom(meta, lrcText) {
    if (lrcText) {
        const p = (0, lrc_js_1.parseLrc)(lrcText);
        if (p.synced)
            return { type: 'synced', lines: p.lines, source: 'lrc' };
        return { type: 'plain', text: lrcText, source: 'lrc' };
    }
    if (meta.lyricsSync && meta.lyricsSync.length > 1)
        return { type: 'synced', lines: meta.lyricsSync, source: 'sylt' };
    if (meta.lyricsText) {
        const p = (0, lrc_js_1.parseLrc)(meta.lyricsText);
        if (p.synced)
            return { type: 'synced', lines: p.lines, source: 'uslt' };
        return { type: 'plain', text: meta.lyricsText.trim(), source: 'uslt' };
    }
    return null;
}
async function buildTrack({ id, blob, name, lrc, addedAt, url: remoteUrl, coverBlob = null, albumInfo = null }) {
    const meta = await (0, tags_js_1.readMeta)(blob, name);
    const url = remoteUrl || URL.createObjectURL(blob);
    const base = (0, util_js_1.stripExt)(name);
    let { title, artist } = meta;
    if (!title) {
        const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
        if (m && !artist) {
            artist = m[1].trim();
            title = m[2].trim();
        }
        else
            title = base.replace(/^\d{1,3}[\s.\-_)]+(?=\D)/, '').trim() || base;
    }
    const duration = await getDuration(url);
    const size = blob.size;
    let bitrate = meta.bitrate || 0, approx = false;
    if (duration && (meta.vbr || !bitrate)) {
        bitrate = Math.round(((meta.audioBytes || size) * 8) / duration / 1000);
        approx = true;
    }
    const artwork = meta.cover || coverBlob;
    const cover = artwork ? URL.createObjectURL(artwork) : null;
    return {
        id, name, url, size, title, artist: artist || '', albumArtist: albumInfo?.artist || meta.albumArtist || '', album: albumInfo?.title || meta.album || '',
        year: meta.year || '', genre: meta.genre || '', trackNo: albumInfo?.position || meta.trackNo || 0, discNo: meta.discNo || 0,
        cover, _coverBlob: artwork || null, coverType: artwork?.type || '', duration, sampleRate: meta.sampleRate || 0, bitrate, approx,
        bits: meta.bits || 0, codec: meta.codec || (0, util_js_1.extOf)(name).toUpperCase(), channels: meta.channels || 0,
        _albumInfo: albumInfo, lyrics: lyricsFrom(meta, lrc), hasLrc: !!lrc, addedAt: addedAt || Date.now(),
    };
}
async function restoreLibrary() {
    const recs = await (0, db_js_1.allFiles)();
    if (!recs || !recs.length)
        return 0;
    recs.sort((a, b) => a.addedAt - b.addedAt);
    await pool(recs, 4, async (r) => {
        try {
            if (r.native) {
                if (native_js_1.isNative)
                    state_js_1.state.tracks.set(r.id, restoreNative(r));
                return;
            } // из папки: берём сохранённые теги, файл читает оболочка
            state_js_1.state.tracks.set(r.id, await buildTrack(r));
        }
        catch (e) {
            console.warn('restore', r.id, e);
        }
    });
    (0, state_js_1.touchLibrary)();
    return recs.length;
}
function restoreNative(r) {
    const t = { ...r.meta, id: r.id, url: (0, native_js_1.nativeUrl)(r.docId), addedAt: r.addedAt, cover: r.coverBlob ? URL.createObjectURL(r.coverBlob) : null };
    t._n = { size: r.size, mtime: r.mtime };
    return t;
}
async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
        while (i < items.length) {
            const it = items[i++];
            await fn(it);
        }
    }));
}
const readText = async (f) => {
    const buf = new Uint8Array(await f.arrayBuffer());
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('�'))
        t = new TextDecoder('windows-1251').decode(buf);
    return t;
};
function findTrackByName(base, title) {
    const nb = (0, util_js_1.norm)((0, util_js_1.stripExt)(base));
    let hit = null;
    for (const t of state_js_1.state.tracks.values()) {
        if ((0, util_js_1.norm)((0, util_js_1.stripExt)(t.name)) === nb)
            return t;
        if (!hit && title && ((0, util_js_1.norm)(t.title) === (0, util_js_1.norm)(title) || (0, util_js_1.norm)(`${t.artist} - ${t.title}`) === (0, util_js_1.norm)(title)))
            hit = t;
    }
    return hit;
}
// Для загрузки по ссылке сообщаем об успехе только после записи файла на устройство.
async function importDownloadedAudio(file, { coverBlob = null, albumInfo = null } = {}) {
    const id = trackId(file);
    if (state_js_1.state.tracks.has(id)) {
        if (!coverBlob && !albumInfo)
            return { added: false };
        const track = state_js_1.state.tracks.get(id);
        try {
            const saved = await (0, db_js_1.getFileChecked)(id);
            await (0, db_js_1.putFileChecked)({ ...(saved || { id, blob: file, name: file.name, addedAt: track.addedAt }), ...(coverBlob ? { coverBlob } : {}), ...(albumInfo ? { albumInfo } : {}) });
        }
        catch {
            throw new Error('Не удалось сохранить обложку. Проверьте свободное место и доступ к хранилищу браузера.');
        }
        const old = track._tagCover;
        if (coverBlob) {
            track._tagCover = URL.createObjectURL(coverBlob);
            track._coverBlob = coverBlob;
            track.coverType = coverBlob.type;
        }
        if (albumInfo) {
            track._albumInfo = albumInfo;
            track.album = albumInfo.title;
            track.albumArtist = albumInfo.artist;
            track.trackNo = albumInfo.position;
            if (track._orig)
                Object.assign(track._orig, { album: track.album, albumArtist: track.albumArtist });
        }
        (0, state_js_1.touchLibrary)();
        (0, state_js_1.emit)('covers');
        if (coverBlob && old?.startsWith('blob:'))
            URL.revokeObjectURL(old);
        return { added: false, coverUpdated: !!coverBlob };
    }
    const rec = { id, blob: file, name: file.name, addedAt: Date.now(), coverBlob, albumInfo };
    const track = await buildTrack(rec);
    try {
        if (!track.duration)
            throw new Error('Не удалось прочитать аудио. Проверьте формат файла.');
        try {
            await (0, db_js_1.putFileChecked)(rec);
        }
        catch {
            throw new Error('Не удалось сохранить трек. Проверьте свободное место и доступ к хранилищу браузера.');
        }
        state_js_1.state.tracks.set(id, track);
        (0, state_js_1.touchLibrary)();
        return { added: true };
    }
    catch (e) {
        URL.revokeObjectURL(track.url);
        if (track.cover)
            URL.revokeObjectURL(track.cover);
        throw e;
    }
}
async function importFiles(fileList) {
    const files = [...fileList];
    const audio = [], lrcs = [], m3us = [];
    for (const f of files) {
        const e = (0, util_js_1.extOf)(f.name);
        if (e === 'lrc')
            lrcs.push(f);
        else if (e === 'm3u' || e === 'm3u8')
            m3us.push(f);
        else if (tags_js_1.AUDIO_EXT.has(e) || (f.type || '').startsWith('audio/'))
            audio.push(f);
    }
    if (!audio.length && !lrcs.length && !m3us.length) {
        (0, ui_js_1.toast)('Не нашёл поддерживаемых файлов', 'warn');
        return;
    }
    const lrcMap = new Map();
    for (const l of lrcs)
        lrcMap.set((0, util_js_1.norm)((0, util_js_1.stripExt)(l.name)), l);
    let added = 0, dup = 0, bad = 0;
    if (audio.length)
        (0, ui_js_1.toast)(`Загружаю ${audio.length} ${audio.length === 1 ? 'файл' : 'файлов'}…`, 'info', 1800);
    const stamp = Date.now();
    // Копии: тот же файл или песня с тем же названием, артистом и длиной. Их не добавляем молча — сначала спрашиваем.
    const copies = [];
    const twin = t => {
        const k = (0, util_js_1.norm)(t.title) + '|' + (0, util_js_1.norm)(t.artist);
        for (const x of state_js_1.state.tracks.values())
            if ((0, util_js_1.norm)((x._orig || x).title) + '|' + (0, util_js_1.norm)((x._orig || x).artist) === k && Math.abs((x.duration || 0) - (t.duration || 0)) <= 1)
                return x;
        return null;
    };
    const build = async (f, id) => {
        const l = lrcMap.get((0, util_js_1.norm)((0, util_js_1.stripExt)(f.name)));
        const rec = { id, blob: f, name: f.name, lrc: l ? await readText(l) : null, addedAt: stamp + added };
        return { rec, t: await buildTrack(rec) };
    };
    const put = ({ rec, t }) => { state_js_1.state.tracks.set(rec.id, t); added++; (0, db_js_1.putFile)(rec); };
    await pool(audio, 4, async (f) => {
        const id = trackId(f);
        if (state_js_1.state.tracks.has(id)) {
            copies.push({ f, title: state_js_1.state.tracks.get(id).title });
            return;
        }
        try {
            const b = await build(f, id);
            if (!b.t.duration) {
                URL.revokeObjectURL(b.t.url);
                bad++;
                return;
            }
            if (twin(b.t)) {
                copies.push({ f, title: b.t.title, built: b });
                return;
            }
            put(b);
        }
        catch (err) {
            console.warn(err);
            bad++;
        }
    });
    if (copies.length) {
        const one = copies.length === 1;
        const yes = await (0, ui_js_1.confirmBox)({
            title: one ? 'Добавить копию песни?' : 'Добавить копии песен?',
            text: one ? `«${copies[0].title}» уже есть в медиатеке. Вы хотите добавить копию песни?` : `В медиатеке уже есть ${copies.length} из этих песен. Вы хотите добавить копии?`,
            ok: one ? 'Добавить копию' : 'Добавить копии', cancel: 'Не добавлять',
        });
        for (const [i, c] of copies.entries()) {
            if (!yes) {
                dup++;
                if (c.built)
                    URL.revokeObjectURL(c.built.t.url);
                continue;
            }
            try {
                const b = c.built || await build(c.f, `${trackId(c.f)}|copy${stamp}${i}`);
                if (!b.t.duration) {
                    bad++;
                    continue;
                }
                put(b);
            }
            catch (err) {
                console.warn(err);
                bad++;
            }
        }
    }
    // отдельные .lrc к уже загруженным трекам
    let lrcAttached = 0;
    for (const l of lrcs) {
        const t = findTrackByName(l.name);
        if (!t || (t.hasLrc && audio.length)) {
            if (!t)
                (0, ui_js_1.toast)(`Для «${l.name}» не найден трек с таким именем`, 'warn');
            continue;
        }
        const text = await readText(l);
        const p = (0, lrc_js_1.parseLrc)(text);
        t.lyrics = p.synced ? { type: 'synced', lines: p.lines, source: 'lrc' } : { type: 'plain', text, source: 'lrc' };
        t.hasLrc = true;
        lrcAttached++;
        (0, db_js_1.putFile)({ id: t.id, blob: await (await fetch(t.url)).blob(), name: t.name, lrc: text, addedAt: t.addedAt, coverBlob: t._coverBlob || null, albumInfo: t._albumInfo || null });
        (0, state_js_1.emit)('lyrics', t);
    }
    (0, state_js_1.touchLibrary)();
    for (const m of m3us) {
        const entries = (0, m3u_js_1.parseM3U)(await readText(m));
        const ids = [];
        let miss = 0;
        for (const en of entries) {
            const t = findTrackByName(en.base, en.title);
            t ? ids.push(t.id) : miss++;
        }
        if (ids.length) {
            const p = (0, state_js_1.createPlaylist)((0, util_js_1.stripExt)(m.name), ids);
            (0, ui_js_1.toast)(`Плейлист «${p.name}»: ${ids.length} треков${miss ? `, не найдено: ${miss}` : ''}`, miss ? 'warn' : 'ok', 4000);
        }
        else
            (0, ui_js_1.toast)(`Плейлист «${m.name}»: ни один трек не найден в библиотеке — сначала добавьте музыку`, 'warn', 5000);
    }
    const parts = [];
    if (added)
        parts.push(`добавлено: ${added}`);
    if (lrcAttached)
        parts.push(`текстов .lrc: ${lrcAttached}`);
    if (dup)
        parts.push(`уже были: ${dup}`);
    if (bad)
        parts.push(`не удалось прочитать: ${bad}`);
    if (parts.length && (audio.length || lrcAttached))
        (0, ui_js_1.toast)(parts.join(' · '), bad ? 'warn' : 'ok', 3500);
}
// ---------- drag & drop (в т.ч. папки) ----------
async function filesFromDrop(dt) {
    const entries = [];
    for (const it of dt.items || [])
        if (it.kind === 'file') {
            const e = it.webkitGetAsEntry?.();
            if (e)
                entries.push(e);
        }
    if (!entries.length)
        return [...dt.files];
    const out = [];
    const walk = async (e) => {
        if (e.isFile)
            await new Promise(r => e.file(f => { out.push(f); r(); }, r));
        else if (e.isDirectory) {
            const rd = e.createReader();
            for (;;) {
                const batch = await new Promise(r => rd.readEntries(r, () => r([])));
                if (!batch.length)
                    break;
                for (const c of batch)
                    await walk(c);
            }
        }
    };
    for (const e of entries)
        await walk(e);
    return out;
}
// ---------- медиатека из одной папки (Android) ----------
let syncing = false;
async function syncNativeLibrary(scan) {
    if (syncing)
        return;
    if (!scan || !scan.ok) {
        (0, ui_js_1.toast)(scan?.error ? `Не удалось прочитать папку: ${scan.error}` : 'Не удалось прочитать папку', 'warn', 4500);
        return;
    }
    syncing = true;
    try {
        const files = scan.files || [];
        const gone = new Set(state_js_1.state.hidden || []); // удалённые пользователем песни из папки не возвращаем
        const audio = files.filter(f => tags_js_1.AUDIO_EXT.has((0, util_js_1.extOf)(f.name)) && !gone.has((0, native_js_1.nativeId)(f.id)));
        const lrcs = new Map(files.filter(f => (0, util_js_1.extOf)(f.name) === 'lrc').map(f => [(0, util_js_1.norm)((0, util_js_1.stripExt)(f.name)), f]));
        const m3us = files.filter(f => ['m3u', 'm3u8'].includes((0, util_js_1.extOf)(f.name)));
        const present = new Set(audio.map(f => (0, native_js_1.nativeId)(f.id)));
        // 1) удалённые из папки файлы убираем из библиотеки
        let removed = 0;
        for (const id of [...state_js_1.state.tracks.keys()]) {
            if (!(0, native_js_1.isNativeId)(id) || present.has(id))
                continue;
            const t = state_js_1.state.tracks.get(id);
            if (t?.cover)
                URL.revokeObjectURL(t.cover);
            state_js_1.state.tracks.delete(id);
            (0, db_js_1.delFile)(id);
            removed++;
        }
        // 2) новые и изменённые
        const todo = audio.filter(f => { const t = state_js_1.state.tracks.get((0, native_js_1.nativeId)(f.id)); return !t || !t._n || t._n.size !== f.size || t._n.mtime !== f.mtime; });
        if (todo.length)
            (0, ui_js_1.toast)(`Сканирую папку «${scan.folder || ''}»: ${todo.length} ${todo.length === 1 ? 'файл' : 'файлов'}…`, 'info', 2500);
        let added = 0, bad = 0, done = 0;
        const stamp = Date.now();
        await pool(todo, 4, async (f) => {
            const id = (0, native_js_1.nativeId)(f.id), url = (0, native_js_1.nativeUrl)(f.id);
            try {
                const l = lrcs.get((0, util_js_1.norm)((0, util_js_1.stripExt)(f.name)));
                let lrc = null;
                if (l) {
                    try {
                        lrc = await readText(await (await fetch((0, native_js_1.nativeUrl)(l.id))).blob());
                    }
                    catch { /* без текста */ }
                }
                const old = state_js_1.state.tracks.get(id);
                const t = await buildTrack({ id, blob: new native_js_1.RemoteFile(url, f.size, f.name), name: f.name, lrc, addedAt: old?.addedAt || stamp + added, url });
                if (!t.duration) {
                    bad++;
                    return;
                }
                t._n = { size: f.size, mtime: f.mtime };
                state_js_1.state.tracks.set(id, t);
                added++;
                const { url: _u, cover: _c, _coverBlob, _n, ...meta } = t;
                for (const k of Object.keys(meta))
                    if (k.startsWith('_'))
                        delete meta[k];
                (0, db_js_1.putFile)({ id, native: true, docId: f.id, name: f.name, size: f.size, mtime: f.mtime, addedAt: t.addedAt, meta, coverBlob: _coverBlob || null });
            }
            catch (e) {
                console.warn('native scan', f.name, e);
                bad++;
            }
            if (++done % 40 === 0)
                (0, state_js_1.touchLibrary)();
        });
        (0, state_js_1.touchLibrary)();
        // 3) плейлисты .m3u / .m3u8 из папки — один раз
        for (const f of m3us) {
            const key = `puro.m3u.${f.id}|${f.mtime}`;
            try {
                if (localStorage.getItem(key))
                    continue;
            }
            catch { /* ignore */ }
            try {
                const entries = (0, m3u_js_1.parseM3U)(await readText(await (await fetch((0, native_js_1.nativeUrl)(f.id))).blob()));
                const ids = [];
                for (const en of entries) {
                    const t = findTrackByName(en.base, en.title);
                    if (t)
                        ids.push(t.id);
                }
                if (ids.length) {
                    (0, state_js_1.createPlaylist)((0, util_js_1.stripExt)(f.name), ids);
                    try {
                        localStorage.setItem(key, '1');
                    }
                    catch { /* ignore */ }
                }
            }
            catch (e) {
                console.warn('m3u', f.name, e);
            }
        }
        const parts = [];
        if (added)
            parts.push(`добавлено: ${added}`);
        if (removed)
            parts.push(`удалено: ${removed}`);
        if (bad)
            parts.push(`не удалось прочитать: ${bad}`);
        if (!audio.length)
            (0, ui_js_1.toast)('В выбранной папке нет аудиофайлов', 'warn', 4000);
        else if (parts.length)
            (0, ui_js_1.toast)(parts.join(' · '), bad ? 'warn' : 'ok', 3500);
    }
    finally {
        syncing = false;
    }
}

};
defs["jsonp.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonp = jsonp;
// JSONP: ответ сервиса подключается как <script> — так можно спрашивать сервисы без CORS (Deezer, iTunes)
let seq = 0;
function jsonp(url, param = 'callback', timeout = 9000) {
    return new Promise(res => {
        const cb = '__puroJsonp' + (++seq) + '_' + Date.now(), sc = document.createElement('script');
        let done = false;
        const end = v => { if (done)
            return; done = true; clearTimeout(tm); try {
            delete window[cb];
        }
        catch {
            window[cb] = undefined;
        } sc.remove(); res(v); };
        const tm = setTimeout(() => end(null), timeout);
        window[cb] = d => end(d);
        sc.onerror = () => end(null);
        sc.src = url + (url.includes('?') ? '&' : '?') + param + '=' + cb;
        document.head.appendChild(sc);
    });
}

};
defs["link-download.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DOWNLOAD = exports.isSoundCloudLink = void 0;
exports.audioLink = audioLink;
exports.downloadAudio = downloadAudio;
exports.downloadArtwork = downloadArtwork;
exports.resolveAudioLink = resolveAudioLink;
const tags_js_1 = require("./tags.js");
const util_js_1 = require("./util.js");
const SOUNDCLOUD_SERVICE = 'https://purocielo-audio-service.pipeddahlia1.chatgpt.site/download';
const isSoundCloudLink = url => /(^|\.)soundcloud\.com$/.test(url.hostname) || ['snd.sc', 'soundcloud.app.goo.gl'].includes(url.hostname);
exports.isSoundCloudLink = isSoundCloudLink;
exports.MAX_DOWNLOAD = 100 * 1024 * 1024;
const TYPES = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'application/ogg': 'ogg', 'audio/opus': 'opus', 'audio/mp4': 'm4a', 'video/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm' };
function audioLink(raw) {
    let url;
    try {
        url = new URL(raw.trim());
    }
    catch {
        throw new Error('Введите полную ссылку, начиная с https://');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('Нужна ссылка HTTP или HTTPS без логина и пароля.');
    url.hash = '';
    return url;
}
function filename(response, url, mime) {
    const disposition = response.headers.get('content-disposition') || '';
    const utf = /filename\*=UTF-8''([^;]+)/i.exec(disposition), plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(disposition);
    let name = utf?.[1] || plain?.[1] || plain?.[2] || new URL(response.url || url).pathname.split('/').pop() || 'Track';
    try {
        name = decodeURIComponent(name);
    }
    catch { /* Keep literal name. */ }
    name = name.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_').trim().slice(0, 160) || 'Track';
    if (!tags_js_1.AUDIO_EXT.has((0, util_js_1.extOf)(name))) {
        if (!TYPES[mime])
            throw new Error('По ссылке не найден поддерживаемый аудиофайл.');
        name += '.' + TYPES[mime];
    }
    return name;
}
async function downloadAudio(raw, { signal, onProgress = () => { }, onArtworkURL = () => { } } = {}) {
    const url = audioLink(raw);
    const soundcloud = (0, exports.isSoundCloudLink)(url);
    const response = await fetch(soundcloud ? SOUNDCLOUD_SERVICE : url.href, { signal, credentials: 'omit', referrerPolicy: 'no-referrer',
        ...(soundcloud ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.href }) } : {}),
    });
    if (soundcloud && !response.ok) {
        let data;
        try {
            data = await response.json();
        }
        catch { /* Gateway errors may be HTML. */ }
        throw new Error(typeof data?.error === 'string' && data.error.length < 400 ? data.error : 'Сервис SoundCloud временно недоступен. Попробуйте позже.');
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Сайт не отдал файл. Проверьте ссылку и доступ к нему.');
    }
    if (soundcloud)
        onArtworkURL(artworkEndpoint(response.headers.get('X-Puro-Artwork')));
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (/html|json|xml|mpegurl/.test(mime) || mime.startsWith('text/')) {
        await response.body?.cancel();
        throw new Error('Это ссылка на страницу или плейлист. Нужна прямая ссылка на аудиофайл.');
    }
    let name;
    try {
        name = filename(response, url.href, mime);
    }
    catch (e) {
        await response.body?.cancel();
        throw e;
    }
    const total = Number(response.headers.get('content-length')) || 0;
    if (total > exports.MAX_DOWNLOAD) {
        await response.body?.cancel();
        throw new Error('Файл слишком большой. Максимум — 100 МБ.');
    }
    if (!response.body?.getReader)
        throw new Error('Этот браузер не поддерживает загрузку по ссылке.');
    const reader = response.body.getReader(), parts = [];
    let received = 0;
    try {
        while (true) {
            if (signal?.aborted)
                throw new DOMException('Cancelled', 'AbortError');
            const { done, value } = await reader.read();
            if (done)
                break;
            received += value.byteLength;
            if (received > exports.MAX_DOWNLOAD)
                throw new Error('Файл слишком большой. Максимум — 100 МБ.');
            parts.push(value);
            onProgress(received, total);
        }
    }
    catch (e) {
        await reader.cancel().catch(() => { });
        throw e;
    }
    finally {
        reader.releaseLock();
    }
    if (signal?.aborted)
        throw new DOMException('Cancelled', 'AbortError');
    if (!received)
        throw new Error('По ссылке пришёл пустой файл.');
    return new File(parts, name, { type: mime || 'application/octet-stream' });
}
// Accept artwork only from the same service, never from an arbitrary response URL.
function artworkEndpoint(raw) {
    if (!raw)
        return null;
    try {
        const url = new URL(raw, SOUNDCLOUD_SERVICE);
        return url.origin === new URL(SOUNDCLOUD_SERVICE).origin && url.pathname === '/artwork' && !url.username && !url.password ? url.href : null;
    }
    catch {
        return null;
    }
}
async function downloadArtwork(raw, { signal } = {}) {
    const url = artworkEndpoint(raw);
    if (!url)
        return null;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted)
        cancel();
    const timer = setTimeout(cancel, 12000), limit = 2 * 1024 * 1024;
    let reader;
    try {
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(mime) || Number(response.headers.get('content-length')) > limit) {
            await response.body?.cancel();
            return null;
        }
        reader = response.body.getReader();
        const parts = [];
        let size = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > limit) {
                await reader.cancel();
                return null;
            }
            parts.push(value);
        }
        if (!size)
            return null;
        const blob = new Blob(parts, { type: mime });
        // A successful HTTP response may still contain a corrupt image.
        const bitmap = await createImageBitmap(blob);
        bitmap.close();
        return blob;
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        reader?.releaseLock();
        if (signal?.aborted)
            throw new DOMException('Cancelled', 'AbortError');
    }
}
async function resolveAudioLink(raw, { signal } = {}) {
    const url = audioLink(raw);
    const collection = url.pathname.includes('/sets/') || ['on.soundcloud.com', 'snd.sc', 'soundcloud.app.goo.gl'].includes(url.hostname);
    if (!(0, exports.isSoundCloudLink)(url) || !collection)
        return { kind: 'track', url: url.href };
    const response = await fetch(new URL('/resolve', SOUNDCLOUD_SERVICE), { method: 'POST', signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.href }) });
    const data = await response.json();
    if (!response.ok)
        throw new Error(typeof data?.error === 'string' && data.error.length < 400 ? data.error : 'Не удалось получить альбом SoundCloud.');
    const publicTrack = raw => {
        const u = audioLink(raw);
        if (!(0, exports.isSoundCloudLink)(u) || u.protocol !== 'https:')
            throw new Error('Некорректная ссылка на трек альбома.');
        return u.href;
    };
    if (data.kind === 'track')
        return { kind: 'track', url: publicTrack(data.url) };
    if (data.kind !== 'album' || !Array.isArray(data.tracks) || !data.tracks.length || data.tracks.length > 100)
        throw new Error('Поддерживаются альбомы до 100 треков.');
    return { kind: 'album', title: String(data.title || 'SoundCloud').slice(0, 200), artist: String(data.artist || 'SoundCloud').slice(0, 200), artwork: artworkEndpoint(data.artwork),
        tracks: data.tracks.map((t, i) => ({ url: t.url ? publicTrack(t.url) : null, position: i + 1 })) };
}

};
defs["link-import.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initLinkImport = initLinkImport;
exports.openLinkImport = openLinkImport;
const link_download_js_1 = require("./link-download.js");
const importer_js_1 = require("./importer.js");
const icons_js_1 = require("./icons.js");
const i18n_js_1 = require("./i18n.js");
const ui_js_1 = require("./ui.js");
let job = null, message = '', error = false, received = 0, total = 0, phase = '', lastURL = '';
let modal = null, formNumber = 0;
const forms = () => [...document.querySelectorAll('.link-import')];
function markup() {
    const id = 'audio-link-' + (++formNumber);
    return `<form class="link-import"><label for="${id}">Загрузить по ссылке</label><div class="link-import-entry"><input id="${id}" name="audio-url" type="url" placeholder="https://soundcloud.com/…" required autocomplete="off" spellcheck="false" aria-describedby="${id}-hint"><button class="icon-btn" type="submit" title="Скачать в медиатеку" aria-label="Скачать в медиатеку">${(0, icons_js_1.icon)('download')}</button><button class="icon-btn" type="button" data-link-cancel title="Отменить загрузку" aria-label="Отменить загрузку" hidden>${(0, icons_js_1.icon)('close')}</button></div><small id="${id}-hint">Трек или альбом SoundCloud · до 100 МБ на трек</small><progress max="100" hidden aria-label="Загрузка аудио"></progress><p class="link-import-status" role="status" aria-live="polite" hidden></p></form>`;
}
function paint() {
    for (const form of forms()) {
        form.setAttribute('aria-busy', String(!!job));
        form.querySelector('input').disabled = !!job;
        form.querySelector('[type=submit]').hidden = !!job;
        const cancel = form.querySelector('[data-link-cancel]');
        cancel.hidden = !job;
        cancel.disabled = phase === 'saving';
        const progress = form.querySelector('progress');
        progress.hidden = !job;
        if (total)
            progress.value = Math.min(100, received / total * 100);
        else
            progress.removeAttribute('value');
        const status = form.querySelector('.link-import-status');
        status.hidden = !message;
        status.classList.toggle('error', error);
        status.textContent = message;
    }
}
function bind(form) {
    form.querySelector('input').value = lastURL;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (job)
            return;
        lastURL = form.querySelector('input').value.trim();
        const controller = new AbortController();
        job = controller;
        phase = 'download';
        error = false;
        received = total = 0;
        message = 'Подключаюсь…';
        paint();
        let timedOut = false, timer, lastPaint = 0, album = false, completed = 0, added = 0, skipped = 0, failed = 0, missingCovers = 0;
        const armTimer = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; controller.abort(); }, 120000); };
        const savedMessage = () => (0, i18n_js_1.isEn)() ? `Saved: ${completed}` : `Сохранено: ${completed}`;
        armTimer();
        try {
            const source = await (0, link_download_js_1.resolveAudioLink)(lastURL, { signal: controller.signal });
            album = source.kind === 'album';
            let albumCover = null;
            if (album && source.artwork) {
                phase = 'artwork';
                message = 'Загружаю обложку…';
                paint();
                albumCover = await (0, link_download_js_1.downloadArtwork)(source.artwork, { signal: controller.signal });
            }
            const entries = album ? source.tracks : [{ url: source.url }];
            let albumBytes = 0;
            for (const [index, entry] of entries.entries()) {
                if (controller.signal.aborted)
                    throw new DOMException('Cancelled', 'AbortError');
                if (!entry.url) {
                    failed++;
                    continue;
                }
                armTimer();
                const prefix = album ? `${index + 1}/${entries.length} · ` : '';
                phase = 'download';
                received = total = 0;
                message = prefix + ((0, i18n_js_1.isEn)() ? 'Connecting…' : 'Подключаюсь…');
                paint();
                let artworkURL = null;
                try {
                    const file = await (0, link_download_js_1.downloadAudio)(entry.url, { signal: controller.signal, onArtworkURL: url => { artworkURL = url; }, onProgress: (bytes, size) => {
                            received = bytes;
                            total = size;
                            if (Date.now() - lastPaint < 160)
                                return;
                            lastPaint = Date.now();
                            message = prefix + (total ? `${(0, i18n_js_1.isEn)() ? 'Downloading' : 'Загрузка'}: ${Math.min(100, Math.round(received / total * 100))}%` : `${(0, i18n_js_1.isEn)() ? 'Downloaded' : 'Загружено'}: ${(received / 1048576).toFixed(1)} ${(0, i18n_js_1.isEn)() ? 'MB' : 'МБ'}`);
                            paint();
                        } });
                    albumBytes += file.size;
                    if (albumBytes > 1024 * 1024 * 1024)
                        throw new Error('Альбом превышает 1 ГБ. Уже загруженные треки сохранены.');
                    let coverBlob = albumCover;
                    if (!coverBlob && artworkURL) {
                        phase = 'artwork';
                        message = prefix + ((0, i18n_js_1.isEn)() ? 'Downloading artwork…' : 'Загружаю обложку…');
                        received = total = 0;
                        paint();
                        coverBlob = await (0, link_download_js_1.downloadArtwork)(artworkURL, { signal: controller.signal });
                    }
                    clearTimeout(timer);
                    if (controller.signal.aborted)
                        throw new DOMException('Cancelled', 'AbortError');
                    phase = 'saving';
                    message = prefix + ((0, i18n_js_1.isEn)() ? 'Saving to library…' : 'Сохраняю в медиатеку…');
                    paint();
                    const result = await (0, importer_js_1.importDownloadedAudio)(file, { coverBlob, albumInfo: album ? { title: source.title, artist: source.artist, position: entry.position } : null });
                    completed++;
                    result.added ? added++ : skipped++;
                    if ((artworkURL || source.artwork) && !coverBlob)
                        missingCovers++;
                    message = result.coverUpdated ? 'Обложка сохранена' : result.added ? 'Трек добавлен в медиатеку' : 'Этот файл уже есть в медиатеке';
                    if (artworkURL && !coverBlob)
                        message = result.added ? 'Трек добавлен. Обложка временно недоступна.' : 'Трек уже есть. Обложка временно недоступна.';
                }
                catch (e) {
                    if (!album || controller.signal.aborted || phase === 'saving' || albumBytes > 1024 * 1024 * 1024)
                        throw e;
                    failed++;
                }
            }
            if (album) {
                message = (0, i18n_js_1.isEn)() ? `Album: added ${added}, already in library ${skipped}, unavailable ${failed}.` : `Альбом: добавлено ${added}, уже в медиатеке ${skipped}, недоступно ${failed}.`;
                if (missingCovers)
                    message += (0, i18n_js_1.isEn)() ? ` Without artwork: ${missingCovers}.` : ` Без обложки: ${missingCovers}.`;
                error = failed > 0;
            }
        }
        catch (e) {
            error = e.name !== 'AbortError' || timedOut;
            message = timedOut ? 'Загрузка заняла слишком много времени. Попробуйте ещё раз.' : e.name === 'AbortError' ? 'Загрузка отменена' : e instanceof TypeError ? 'Не удалось скачать файл. Сайт может запрещать загрузку по ссылке — попробуйте скачать файл вручную.' : e.message;
            if (album && completed)
                message += ` ${savedMessage()}.`;
        }
        finally {
            clearTimeout(timer);
            job = null;
            phase = '';
            paint();
        }
    });
    form.querySelector('[data-link-cancel]').addEventListener('click', () => { if (phase !== 'saving')
        job?.abort(); });
    paint();
}
function initLinkImport() {
    const host = document.getElementById('side-link-import');
    host.innerHTML = markup();
    bind(host.querySelector('form'));
}
function openLinkImport() {
    if (modal?.el.isConnected && !modal.el.inert) {
        modal.el.querySelector('input')?.focus();
        return;
    }
    modal = (0, ui_js_1.openModal)({ title: 'Загрузить по ссылке', html: markup(), onMount: api => bind(api.el.querySelector('form')) });
}

};
defs["loudness.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gainFor = exports.loadLoud = exports.loud = void 0;
exports.guessGain = guessGain;
exports.analyse = analyse;
exports.measure = measure;
exports.forgetLoud = forgetLoud;
const db_js_1 = require("./db.js");
// Одинаковая громкость. Плеер один раз измеряет, насколько громко записана песня, и запоминает поправку:
// тихие песни делает громче, громкие — тише. Сам файл не меняется.
// Измерение: песня раскодируется с низкой частотой (так она занимает мало памяти), делится на отрезки по 0,4 с,
// тихие отрезки (паузы, вступления) отбрасываются — как в стандарте громкости BS.1770, только без частотного фильтра.
const TARGET = -14; // к какой громкости приводим, дБ
const MAX_UP = 9, MAX_DOWN = -12; // пределы поправки, дБ
const RATE = 8000, BLOCK = 0.4;
exports.loud = {}; // id песни → поправка в дБ
let loaded = null, saveTimer = 0;
const loadLoud = () => loaded || (loaded = (async () => {
    try {
        const d = await (0, db_js_1.kvGet)('loud');
        if (d && typeof d === 'object')
            Object.assign(exports.loud, d);
    }
    catch { /* ignore */ }
})());
exports.loadLoud = loadLoud;
const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => (0, db_js_1.kvSet)('loud', exports.loud).catch(() => { }), 1500); };
const gainFor = id => (id in exports.loud ? exports.loud[id] : null);
exports.gainFor = gainFor;
// пока песня не измерена, берём среднюю поправку по уже измеренным — так скачок громкости после измерения меньше
function guessGain() {
    const v = Object.values(exports.loud);
    return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
function analyse(channels) {
    const n = channels[0].length, size = Math.round(RATE * BLOCK), blocks = [];
    let peak = 0;
    for (let s = 0; s + size <= n; s += size) {
        let sum = 0;
        for (const ch of channels)
            for (let i = s; i < s + size; i++) {
                const v = ch[i];
                sum += v * v;
                if (v > peak)
                    peak = v;
                else if (-v > peak)
                    peak = -v;
            }
        blocks.push(sum / (size * channels.length));
    }
    const db = x => 10 * Math.log10(x);
    let kept = blocks.filter(b => b > 1e-7); // тише −70 дБ — тишина
    if (!kept.length)
        return null;
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const gate = mean(kept) / 10; // на 10 дБ тише среднего — тоже не считаем
    kept = kept.filter(b => b >= gate);
    const level = db(mean(kept));
    let g = Math.max(MAX_DOWN, Math.min(MAX_UP, TARGET - level));
    if (peak > 0)
        g = Math.min(g, 20 * Math.log10(0.89 / peak)); // усиливаем только пока пики не упрутся в потолок
    return Math.round(Math.max(MAX_DOWN, g) * 10) / 10;
}
const busy = new Map();
function measure(t) {
    if (!t || !t.url || typeof window === 'undefined')
        return Promise.resolve(null);
    if (t.id in exports.loud)
        return Promise.resolve(exports.loud[t.id]);
    if (busy.has(t.id))
        return busy.get(t.id);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || (t.size || 0) > 90e6 || (t.duration || 0) > 1200) // очень длинные записи не трогаем — берегём память
        return Promise.resolve(null);
    const p = (async () => {
        try {
            await (0, exports.loadLoud)();
            const buf = await (await fetch(t.url)).arrayBuffer();
            const ctx = new OAC(1, 1, RATE);
            const au = await new Promise((res, rej) => {
                const r = ctx.decodeAudioData(buf, res, rej);
                if (r && r.catch)
                    r.catch(rej);
            });
            const ch = [];
            for (let i = 0; i < Math.min(2, au.numberOfChannels); i++)
                ch.push(au.getChannelData(i));
            const g = analyse(ch);
            if (g == null)
                return null;
            exports.loud[t.id] = g;
            persist();
            return g;
        }
        catch {
            return null;
        }
        finally {
            busy.delete(t.id);
        }
    })();
    busy.set(t.id, p);
    return p;
}
function forgetLoud(ids) {
    for (const id of ids)
        delete exports.loud[id];
    persist();
}

};
defs["lrc.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLrc = parseLrc;
exports.activeLine = activeLine;
// Парсер .lrc: несколько меток на строку, [offset:], enhanced-теги <mm:ss.xx>, метаданные.
function parseLrc(text) {
    const lines = [], meta = {};
    let offset = 0;
    const stampRe = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
    for (const raw of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
        let line = raw.trim();
        if (!line)
            continue;
        const stamps = [];
        let m;
        while ((m = stampRe.exec(line))) {
            const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
            stamps.push(+m[1] * 60 + +m[2] + frac);
            line = line.slice(m[0].length).trimStart();
        }
        if (stamps.length) {
            const t = line.replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').replace(/\s+/g, ' ').trim();
            let words = null; // enhanced LRC: <мм:сс.хх>слово — метки отдельных слов
            if (/<\d+:\d+/.test(line)) {
                const parts = [...line.matchAll(/<(\d+):(\d+)(?:[.:](\d+))?>\s*([^<]*)/g)].map(m => ({ t: +m[1] * 60 + +m[2] + (m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0), text: m[4].trim() })).filter(x => x.text);
                const joined = parts.map(x => x.text).join(' ');
                if (parts.length && joined === t)
                    words = parts;
            }
            for (const s of stamps)
                lines.push(words ? { t: s, text: t, words: words.map(w => ({ ...w, t: w.t - (stamps[0] - s) })) } : { t: s, text: t });
            continue;
        }
        const tag = /^\[([a-zA-Z#]+):(.*)\]$/.exec(line);
        if (tag) {
            if (tag[1].toLowerCase() === 'offset')
                offset = (parseInt(tag[2], 10) || 0) / 1000;
            else
                meta[tag[1].toLowerCase()] = tag[2].trim();
        }
    }
    for (const l of lines) {
        l.t = Math.max(0, l.t - offset);
        if (l.words)
            for (const w of l.words)
                w.t = Math.max(0, w.t - offset);
    }
    lines.sort((a, b) => a.t - b.t);
    return { lines, meta, synced: lines.length > 1 };
}
// Индекс активной строки для времени t (бинарный поиск)
function activeLine(lines, t) {
    let lo = 0, hi = lines.length - 1, r = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid].t <= t) {
            r = mid;
            lo = mid + 1;
        }
        else
            hi = mid - 1;
    }
    return r;
}

};
defs["lyrics-auto.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFoundOnline = exports.pickBest = exports.cleanTitle = void 0;
exports.candidates = candidates;
exports.identifyArtist = identifyArtist;
exports.peekLyrics = peekLyrics;
exports.getOffset = getOffset;
exports.setOffset = setOffset;
exports.rawLyrics = rawLyrics;
exports.setManualLyrics = setManualLyrics;
exports.rejectLyrics = rejectLyrics;
exports.ensureLyrics = ensureLyrics;
const state_js_1 = require("./state.js");
const lrc_js_1 = require("./lrc.js");
const db_js_1 = require("./db.js");
const sync_js_1 = require("./sync.js");
const util_js_1 = require("./util.js");
const artists_js_1 = require("./artists.js");
const lyrics_web_js_1 = require("./lyrics-web.js");
const jsonp_js_1 = require("./jsonp.js");
const native_js_1 = require("./native.js");
const genius_js_1 = require("./genius.js");
const lyrics_search_js_1 = require("./lyrics-search.js");
var lyrics_search_js_2 = require("./lyrics-search.js");
Object.defineProperty(exports, "cleanTitle", { enumerable: true, get: function () { return lyrics_search_js_2.cleanTitle; } });
Object.defineProperty(exports, "pickBest", { enumerable: true, get: function () { return lyrics_search_js_2.pickBest; } });
// Автоматический поиск текста песни.
// Порядок: встроенные теги (USLT/SYLT) и .lrc → кэш → онлайн-база LRCLIB (по артисту, названию и длительности).
// Если текст не найден — в плеере показывается «Текст не найден». Само аудио приложение не «распознаёт».
const MISS_TTL = 30 * 60 * 1000; // короткий кэш промахов: новые тексты появляются постоянно
// Исполнители трека без «Неизвестного артиста»
const realArtists = t => (t._artists || (0, artists_js_1.splitArtists)(t.artist)).filter(a => a && a !== artists_js_1.UNKNOWN);
const primaryArtist = t => realArtists(t)[0] || '';
// Варианты «артист + название» для поиска: из тегов; «Артист - Название» внутри названия; из имени файла
function candidates(t) {
    const out = [], seen = new Set();
    const add = (artist, title) => {
        artist = String(artist || '').trim();
        for (const variant of (0, lyrics_search_js_1.titleVariants)(title)) {
            const k = (0, util_js_1.norm)(artist) + '|' + (0, util_js_1.norm)(variant);
            if (variant && !seen.has(k)) {
                seen.add(k);
                out.push({ artist, title: variant });
            }
        }
    };
    const arts = realArtists(t);
    const title = (0, lyrics_search_js_1.cleanTitle)(t.title);
    const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
    if (dash) { // «hitmar - plan»: пробуем артиста из названия, затем исходные теги
        // SoundCloud uploader names often differ from the artist inside the title.
        add(dash[1], dash[2]);
    }
    for (const a of arts)
        add(a, title);
    if (!arts.length && t._guess) // артист, узнанный по названию и длине (см. identify)
        add(t._guess, title);
    if (!arts.length) {
        const f = /^(.+?)\s+[-–—]\s+(.+)$/.exec(String(t.name || '').replace(/\.[^.]+$/, '').replace(/_/g, ' '));
        if (f)
            add(f[1], f[2]);
        add('', title);
    }
    return out;
}
// Песня для хранения текста: «артист + название + длина». Не зависит от файла и от версии поиска.
const songKey = t => `${(0, util_js_1.norm)(primaryArtist(t))}|${(0, util_js_1.norm)((0, lyrics_search_js_1.cleanTitle)(t.title))}|${Math.round(t.duration || 0)}${(0, lyrics_search_js_1.recordingVariant)(t.title) ? '|' + (0, lyrics_search_js_1.recordingVariant)(t.title) : ''}`;
const keyOf = t => `v8|${songKey(t)}`; // обычный кэш: сбрасывается, когда меняются правила поиска
const okKey = t => 'ok|' + songKey(t); // точные тексты: хранятся всегда и уходят в аккаунт
// «Точный» текст — тот, в котором мы уверены: совпали и название, и артист, либо текст вписал сам пользователь.
// Его больше не ищем: он лежит на устройстве постоянно и синхронизируется через аккаунт.
async function keepSure(t, ly) {
    const k = okKey(t), rec = { ly, at: Date.now(), up: false };
    await (0, db_js_1.lySet)(k, rec);
    if (await (0, sync_js_1.cloudLyricsPut)(songKey(t), ly))
        (0, db_js_1.lySet)(k, { ...rec, up: true });
}
async function dropSure(t) {
    await (0, db_js_1.lySet)(okKey(t), { at: 0 });
    cloudTried.delete(songKey(t));
    (0, sync_js_1.cloudLyricsDel)(songKey(t));
}
const cloudTried = new Set(); // в аккаунте уже спрашивали (за этот запуск)
// после входа в аккаунт отправляем точные тексты, найденные раньше без входа
let flushedFor = false;
async function flushSure() {
    if (!(0, sync_js_1.cloudReady)() || flushedFor)
        return;
    flushedFor = true;
    cloudTried.clear();
    for (const k of (await (0, db_js_1.lyKeys)()) || []) {
        if (typeof k !== 'string' || !k.startsWith('ok|'))
            continue;
        const r = await (0, db_js_1.lyGet)(k);
        if (r && r.ly && !r.up && await (0, sync_js_1.cloudLyricsPut)(k.slice(3), r.ly))
            (0, db_js_1.lySet)(k, { ...r, up: true });
    }
}
(0, state_js_1.on)('sync', () => {
    if ((0, sync_js_1.cloudReady)())
        flushSure();
    else
        flushedFor = false;
});
function toLyrics(d) {
    if (!d)
        return null;
    if (d.syncedLyrics) {
        const p = (0, lrc_js_1.parseLrc)(d.syncedLyrics);
        if (p.synced)
            return { type: 'synced', lines: p.lines, source: 'lrclib', ref: d.id, sure: !!d._sure };
    }
    if (d.plainLyrics && d.plainLyrics.trim())
        return { type: 'plain', text: d.plainLyrics.trim(), source: 'lrclib', ref: d.id, sure: !!d._sure };
    return null;
}
async function getJSON(url, ms = 6000, signal) {
    const ctl = new AbortController();
    const abort = () => ctl.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted)
        abort();
    const timer = setTimeout(abort, ms);
    try {
        const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        if (r.status === 404)
            return { notFound: true };
        if (!r.ok)
            throw new Error('HTTP ' + r.status);
        return { data: await r.json() };
    }
    finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}
// У файла нет артиста в тегах — узнаём его по названию и длине в каталогах Deezer и iTunes.
// Берём, только если название совпало, а длина отличается не больше чем на 2 секунды.
async function identifyArtist(t) {
    t._guess = undefined;
    await identify(t);
    return t._guess || '';
}
// Текст, который уже лежит на устройстве (свой, точный или из кэша), — без интернета. Нужен, чтобы честно посчитать «песни без текста».
async function peekLyrics(t) {
    if (!t || t.lyrics)
        return !!t?.lyrics;
    if (!t._manualChecked && await applyManual(t))
        return true;
    for (const k of [okKey(t), keyOf(t)]) {
        const r = await (0, db_js_1.lyGet)(k).catch(() => null);
        if (r && r.ly) {
            t.lyrics = r.ly;
            return true;
        }
    }
    return false;
}
async function identify(t) {
    if (t._guess !== undefined || typeof document === 'undefined')
        return;
    t._guess = '';
    const dur = Math.round(t.duration || 0), title = (0, lyrics_search_js_1.cleanTitle)(t.title);
    if (!dur || (0, lyrics_web_js_1.norm)(title).length < 3)
        return;
    try {
        const [d, i] = await Promise.all([
            (0, jsonp_js_1.jsonp)(`https://api.deezer.com/search/track?${new URLSearchParams({ q: title, limit: '40', output: 'jsonp' })}`, 'callback', 4000),
            (0, jsonp_js_1.jsonp)(`https://itunes.apple.com/search?${new URLSearchParams({ term: title, entity: 'song', media: 'music', limit: '40' })}`, 'callback', 4000),
        ]);
        const matches = [
            ...((d?.data || []).map(x => ({ title: x.title_short || x.title, artist: x.artist?.name, dur: x.duration }))),
            ...((i?.results || []).map(x => ({ title: x.trackName, artist: x.artistName, dur: Math.round((x.trackTimeMillis || 0) / 1000) }))),
        ].filter(x => x.artist && (0, lyrics_web_js_1.titleMatch)((0, lyrics_search_js_1.cleanTitle)(x.title), title) && Math.abs(x.dur - dur) <= 2);
        if (new Set(matches.map(x => (0, lyrics_web_js_1.norm)(x.artist))).size === 1)
            t._guess = matches[0].artist;
    }
    catch { /* Catalog failures do not stop lyrics providers. */ }
}
async function lookup(t, bad = []) {
    // Search the lyrics catalog first. Metadata catalogs are a fallback for truly untagged files.
    let result = await (0, lyrics_search_js_1.searchLyrics)({ candidates: candidates(t), duration: t.duration, album: t.album, variant: (0, lyrics_search_js_1.recordingVariant)(t.title), bad });
    if (!result.record && !realArtists(t).length && !candidates(t).some(c => c.artist)) {
        await identify(t);
        if (t._guess)
            result = await (0, lyrics_search_js_1.searchLyrics)({ candidates: candidates(t), duration: t.duration, album: t.album, variant: (0, lyrics_search_js_1.recordingVariant)(t.title), bad });
    }
    return result;
}
// Stop waiting on a slow native bridge or cloud lookup; late results cannot overwrite a newer choice.
function abortable(task, signal) {
    return new Promise(resolve => {
        if (signal?.aborted)
            return resolve(null);
        const abort = () => resolve(null);
        signal?.addEventListener('abort', abort, { once: true });
        Promise.resolve().then(task).then(resolve, () => resolve(null)).finally(() => signal?.removeEventListener('abort', abort));
    });
}
async function bounded(task, ms) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
    try {
        return await abortable(() => task(ctl.signal), ctl.signal);
    }
    finally {
        clearTimeout(timer);
        ctl.abort();
    }
}
async function firstFound(tasks, signal) {
    return abortable(() => new Promise(resolve => {
        let left = tasks.length;
        if (!left)
            return resolve(null);
        for (const task of tasks)
            Promise.resolve().then(task).catch(() => null).then(result => {
                if (result)
                    resolve(result);
                if (--left === 0)
                    resolve(null);
            });
    }), signal);
}
// Кто скачает страницу сайта, который браузеру читать нельзя: Windows-приложение, APK или свой Worker
function siteFetcher(signal) {
    const proxy = (state_js_1.state.settings.lyricsProxy || '').replace(/\/+$/, '');
    const wrap = fn => u => abortable(() => fn(u), signal);
    if (typeof window !== 'undefined' && window.PuroDesktop && window.PuroDesktop.fetchText)
        return wrap(u => window.PuroDesktop.fetchText(u));
    if (native_js_1.isNative)
        return wrap(u => (0, native_js_1.nativeFetchText)(u));
    if (proxy)
        return wrap(async (u) => {
            try {
                const r = await fetch(`${proxy}/fetch?url=${encodeURIComponent(u)}`, { signal });
                return r.ok ? await r.text() : '';
            }
            catch {
                return '';
            }
        });
    return null;
}
// Genius — основной источник обычного текста
async function fromGenius(t, skip, signal) {
    if (typeof window === 'undefined')
        return null;
    const cands = candidates(t).filter(c => c.title);
    if (!cands.length)
        return null;
    try {
        const g = await (0, genius_js_1.geniusLyrics)(cands, realArtists(t), siteFetcher(signal), skip, { signal });
        if (g)
            return { type: 'plain', text: g.text, source: 'genius', ref: g.ref, sure: realArtists(t).length > 0 }; // артист из тегов совпал — уверены
    }
    catch { /* дальше */ }
    if (!signal?.aborted && window.PuroDesktop && window.PuroDesktop.genius && !skip.length) { // старое приложение для Windows
        try {
            const c = cands[0], txt = await abortable(() => window.PuroDesktop.genius(c.artist, c.title), signal);
            if (txt)
                return { type: 'plain', text: txt, source: 'genius' };
        }
        catch { /* дальше */ }
    }
    return null;
}
// Доп. источники. Свой сервер (Cloudflare Worker) отдаёт NetEase с метками времени и Genius.
async function fromOVH(t, skip, signal) {
    const c = candidates(t)[0];
    if (!c?.artist || skip.includes('ovh'))
        return null;
    try {
        const r = await getJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(c.artist)}/${encodeURIComponent(c.title)}`, 6500, signal);
        const text = String(r.data?.lyrics || '').replace(/^Paroles de la chanson[^\n]*\n/i, '').trim();
        const title = (0, lyrics_web_js_1.norm)(c.title);
        if (text && title.length >= 4 && (0, lyrics_web_js_1.norm)(text).includes(title))
            return { type: 'plain', text, source: 'lyrics.ovh', ref: 'ovh' };
    }
    catch { /* independent source */ }
    return null;
}
async function extraSources(t, skip, signal) {
    const c = candidates(t)[0] || { artist: primaryArtist(t), title: (0, lyrics_search_js_1.cleanTitle)(t.title) };
    const { artist, title } = c, proxy = (state_js_1.state.settings.lyricsProxy || '').replace(/\/+$/, '');
    const fetchText = siteFetcher(signal), tasks = [];
    if (proxy && !skip.includes('proxy'))
        tasks.push(async () => {
            const r = await getJSON(`${proxy}/lyrics?${new URLSearchParams({ artist, title, duration: String(Math.round(t.duration || 0)) })}`, 8000, signal);
            const d = r.data;
            if (d?.synced) {
                const p = (0, lrc_js_1.parseLrc)(d.synced);
                if (p.synced && !(0, lyrics_search_js_1.recordingVariant)(t.title))
                    return { type: 'synced', lines: p.lines, source: d.source || 'online', ref: 'proxy' };
                if (p.lines?.length)
                    return { type: 'plain', text: p.lines.map(l => l.text).join('\n'), source: d.source || 'online', ref: 'proxy' };
            }
            return d?.plain?.trim() ? { type: 'plain', text: d.plain.trim(), source: d.source || 'online', ref: 'proxy' } : null;
        });
    if (fetchText)
        tasks.push(async () => {
            const w = await (0, lyrics_web_js_1.webLyrics)(artist, title, fetchText, { skip: ['genius', ...skip] });
            return w ? { type: 'plain', text: w.text, source: w.source, ref: w.source } : null;
        });
    if (!skip.includes('lyrist'))
        tasks.push(async () => {
            const r = await getJSON(`https://lyrist.vercel.app/api/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`, 6500, signal);
            const d = r.data;
            return d?.lyrics?.trim() && (0, lyrics_web_js_1.titleMatch)(d.title || '', title) && (0, lyrics_web_js_1.artistMatch)(d.artist || '', [artist])
                ? { type: 'plain', text: d.lyrics.trim(), source: 'lyrist', ref: 'lyrist', sure: true } : null;
        });
    return firstFound(tasks, signal);
}
async function fallbackLyrics(t, skip) {
    return bounded(signal => firstFound([
        () => fromGenius(t, skip, signal), () => fromOVH(t, skip, signal), () => extraSources(t, skip, signal),
    ], signal), 15000);
}
// ---- сдвиг синхронизации для конкретного трека (секунды) ----
async function getOffset(t) {
    try {
        const r = await (0, db_js_1.lyGet)('off:' + t.id);
        return r && typeof r.off === 'number' ? r.off : 0;
    }
    catch {
        return 0;
    }
}
async function setOffset(t, off) { off = Math.round(off * 10) / 10; t._off = off; await (0, db_js_1.lySet)('off:' + t.id, { off, at: Date.now() }); }
const running = new Map();
// Возвращает true, если у трека появился текст. t._ly: 'loading' | 'none' | undefined
// ---- свои тексты: вставленные или загруженные из файла вручную ----
const lyFromText = text => { const p = (0, lrc_js_1.parseLrc)(text); return p.synced ? { type: 'synced', lines: p.lines, source: 'manual' } : { type: 'plain', text: String(text).trim(), source: 'manual' }; };
function rawLyrics(t) {
    const ly = t?.lyrics;
    if (!ly)
        return '';
    if (ly.type === 'plain')
        return ly.text;
    const f = s => `[${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}]`;
    return ly.lines.map(l => f(l.t) + l.text).join('\n');
}
async function setManualLyrics(t, text) {
    t._lyRevision = (t._lyRevision || 0) + 1;
    text = String(text || '').trim();
    await (0, db_js_1.lySet)('manual:' + t.id, { text, at: Date.now() });
    t._manualChecked = true;
    t._ly = undefined;
    t.lyrics = text ? lyFromText(text) : null;
    (0, state_js_1.emit)('lyrics', t);
    (0, state_js_1.emit)('lyrics-state', t);
    text ? keepSure(t, { ...t.lyrics, sure: true }) : dropSure(t); // свой текст — точный по определению
}
async function applyManual(t) {
    t._manualChecked = true;
    try {
        const m = await (0, db_js_1.lyGet)('manual:' + t.id);
        if (m && m.text) {
            t.lyrics = lyFromText(m.text);
            t._ly = undefined;
            (0, state_js_1.emit)('lyrics', t);
            return true;
        }
    }
    catch { /* ignore */ }
    return false;
}
// «Это не тот текст»: запоминаем неверный вариант и ищем снова без него
const OWN = ['manual', 'lrc', 'sylt', 'uslt'];
const isFoundOnline = ly => !!ly && !OWN.includes(ly.source);
exports.isFoundOnline = isFoundOnline;
async function rejectLyrics(t) {
    const ly = t && t.lyrics;
    if (!(0, exports.isFoundOnline)(ly))
        return false;
    const bad = (await (0, db_js_1.lyGet)('bad|' + t.id).catch(() => null)) || { ids: [] };
    if (ly.ref != null)
        bad.ids = [...new Set([...(bad.ids || []), ly.ref])];
    else
        bad.all = true; // текст с сайта или другого сервиса — больше не ищем автоматически
    await (0, db_js_1.lySet)('bad|' + t.id, bad);
    await (0, db_js_1.lySet)(keyOf(t), { at: 0 });
    await dropSure(t);
    t.lyrics = null;
    t._ly = undefined;
    (0, state_js_1.emit)('lyrics', t);
    return ensureLyrics(t);
}
function ensureLyrics(t, { retryMiss = false, prefetch = false } = {}) {
    if (!t || (t.lyrics && t._manualChecked))
        return Promise.resolve(!!t?.lyrics);
    if (!prefetch)
        t._lyForeground = true;
    if (retryMiss)
        t._lyRetryRequested = true;
    if (running.has(t.id))
        return running.get(t.id);
    if (!t.lyrics)
        t._ly = 'loading';
    const revision = t._lyRevision || 0, identity = songKey(t);
    const unchanged = () => (t._lyRevision || 0) === revision && songKey(t) === identity;
    const p = (async () => {
        const key = keyOf(t);
        try {
            if (!t._manualChecked && await applyManual(t))
                return true;
            if (t.lyrics)
                return true;
            const use = ly => { if (!unchanged())
                return !!t.lyrics; t.lyrics = ly; t._ly = undefined; (0, state_js_1.emit)('lyrics', t); return true; };
            // 1) точный текст, сохранённый на этом устройстве
            const sure = await (0, db_js_1.lyGet)(okKey(t)).catch(() => null);
            if (sure && sure.ly)
                return use(sure.ly);
            const cached = await (0, db_js_1.lyGet)(key);
            if (cached?.ly)
                return use(cached.ly);
            // 2) сохранённый текст из аккаунта, если на устройстве ещё ничего нет
            const sk = songKey(t);
            if (!prefetch && (0, sync_js_1.cloudReady)() && !cloudTried.has(sk) && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
                cloudTried.add(sk);
                const c = await bounded(() => (0, sync_js_1.cloudLyricsGet)(sk), 1500);
                if (c && (c.lines || c.text)) {
                    (0, db_js_1.lySet)(okKey(t), { ly: c, at: Date.now(), up: true });
                    return use(c);
                }
            }
            // 3) онлайн-поиск с коротким кэшем промахов
            if (!state_js_1.state.settings.autoLyrics) {
                t._ly = 'none';
                return false;
            }
            if (cached && cached.miss && Date.now() - cached.at < MISS_TTL && !(t._lyRetryRequested && (!t._lyAttempt || Date.now() - t._lyAttempt > 60000))) {
                t._ly = 'none';
                return false;
            }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                t._ly = 'offline';
                return false;
            }
            // варианты, которые пользователь отметил «Это не тот текст»
            const bad = (await (0, db_js_1.lyGet)('bad|' + t.id).catch(() => null)) || {};
            if (bad.all) {
                t._ly = 'none';
                (0, db_js_1.lySet)(key, { miss: true, at: Date.now() });
                return false;
            }
            if (t._lyForeground)
                t._lyAttempt = Date.now();
            const result = await lookup(t, bad.ids || []), d = result.record;
            if (!unchanged())
                return !!t.lyrics;
            let ly = d && !d.instrumental ? toLyrics(d) : null;
            // Display a verified plain result immediately; optional providers are only for misses.
            if (!ly && !t._lyForeground) {
                t._ly = undefined;
                return false;
            }
            if (!ly && !d?.instrumental)
                ly = await fallbackLyrics(t, bad.ids || []);
            if (!unchanged())
                return !!t.lyrics;
            if (ly) {
                (0, db_js_1.lySet)(key, { ly, at: Date.now() });
                if (ly.sure)
                    keepSure(t, ly);
                return use(ly);
            }
            if (result.failed) {
                t._ly = 'error';
                return false;
            }
            (0, db_js_1.lySet)(key, { miss: true, instrumental: !!(d && d.instrumental), at: Date.now() });
            t._ly = 'none';
            return false;
        }
        catch (e) {
            if (unchanged())
                t._ly = 'error';
            return false;
        } // нет сети / сервис недоступен — не запоминаем как «нет текста»
        finally {
            running.delete(t.id);
            t._lyRetryRequested = false;
            t._lyForeground = false;
            (0, state_js_1.emit)('lyrics-state', t);
        }
    })();
    running.set(t.id, p);
    (0, state_js_1.emit)('lyrics-state', t);
    return p;
}

};
defs["lyrics-search.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanTitle = cleanTitle;
exports.titleVariants = titleVariants;
exports.recordingVariant = recordingVariant;
exports.pickBest = pickBest;
exports.searchLyrics = searchLyrics;
const lyrics_web_js_1 = require("./lyrics-web.js");
const lrc_js_1 = require("./lrc.js");
const NOISE = /\b(official|audio|lyrics?|visuali[sz]er|music video|hd|hq|prod\.?|feat\.?|ft\.?|remaster(?:ed)?|sped\s*up|speed\s*up|slowed|reverb|nightcore|remix|edit|version|live|8d)\b/i;
function cleanTitle(value) {
    const raw = String(value || '').trim();
    return raw.replace(/[([{]([^\])}]+)[\])}]/g, (all, text) => NOISE.test(text) ? ' ' : all)
        .replace(/@[\w.]+/g, ' ').replace(/\b\d{2,3}\s?bpm\b/gi, ' ')
        .replace(/(?:^|\s)(?:www\.)?[\w-]+\.(?:pro|net|ru|com|me|fm|org|cc|to|club|info|biz|su|io)\b/gi, ' ')
        .replace(/\s(?:prod(?:uced)?\.?(?:\s?by)?|feat\.?|ft\.?|при уч\.?)\s.*$/i, '')
        .replace(/\s+[-–—]\s+(?:remaster(?:ed)?|live|radio edit|single version|sped\s*up|slowed|nightcore)\b.*$/i, '')
        .replace(/\s+/g, ' ').replace(/^[\s\-–—|_.,]+|[\s\-–—|_.,]+$/g, '').trim() || raw;
}
function titleVariants(title) {
    const full = cleanTitle(title);
    return [...new Set([full, full.replace(/\s*\[[^\]]*\]/g, ' '), full.replace(/\s*[([{][^\])}]*[\])}]/g, ' ')].map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}
function recordingVariant(title) {
    const s = String(title || '').toLowerCase();
    return [
        [/\b(sped\s*up|speed\s*up|nightcore)\b/, 'fast'],
        [/\b(slowed|slowed\s*down)\b/, 'slow'],
        [/\bremix\b/, 'remix'], [/\blive\b/, 'live'], [/\b(acoustic|unplugged)\b/, 'acoustic'],
    ].filter(([re]) => re.test(s)).map(([, tag]) => tag).join('+');
}
function pickBest(list, duration, variant = '') {
    const knownDuration = Number.isFinite(duration) && duration > 0;
    const difference = x => knownDuration && Number(x.duration) > 0 ? Math.abs(x.duration - duration) : Infinity;
    const sorted = list.filter(Boolean).slice().sort((a, b) => (b._sure ? 1 : 0) - (a._sure ? 1 : 0) || (a._rank || 0) - (b._rank || 0) || difference(a) - difference(b));
    const timingFits = x => difference(x) <= 4 && recordingVariant(x.trackName || '') === variant;
    const timed = sorted.find(x => {
        if (!x.syncedLyrics || !timingFits(x))
            return false;
        const parsed = (0, lrc_js_1.parseLrc)(x.syncedLyrics);
        return parsed.synced && parsed.lines.length > 1 && parsed.lines.every(l => Number.isFinite(l.t) && l.t >= 0 && l.t <= duration + 4);
    });
    if (timed)
        return timed;
    const plain = sorted.find(x => x._sure && (x.plainLyrics || x.syncedLyrics));
    if (plain)
        return { ...plain, syncedLyrics: null, plainLyrics: (plain.plainLyrics || String(plain.syncedLyrics).replace(/^\s*(?:\[[^\]]*\])+\s?/gm, '')).trim() };
    return sorted.find(x => x._sure && x.instrumental && timingFits(x)) || null;
}
// A failed request must not prevent the next query or another provider from running.
// Three bounded batches: exact recording, artist/title search, then free-text search.
async function searchLyrics({ candidates, duration = 0, album = '', variant = '', bad = [] }, { signal } = {}) {
    const controller = new AbortController(), stop = () => controller.abort();
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted)
        stop();
    const deadline = setTimeout(stop, 12000), found = [], seen = new Set();
    let failures = 0;
    const request = async (params) => {
        if (controller.signal.aborted) {
            failures++;
            return null;
        }
        const requestController = new AbortController(), abort = () => requestController.abort();
        controller.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 3500);
        try {
            const r = await fetch('https://lrclib.net/api/' + params, { signal: requestController.signal, headers: { Accept: 'application/json' } });
            if (r.status === 404)
                return null;
            if (!r.ok)
                throw new Error('Lyrics HTTP ' + r.status);
            return await r.json();
        }
        catch {
            failures++;
            return null;
        }
        finally {
            clearTimeout(timer);
            controller.signal.removeEventListener('abort', abort);
        }
    };
    const cands = candidates.slice(0, 3);
    const take = (data, c, rank) => {
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        const matches = rows.filter(x => x && (0, lyrics_web_js_1.titleMatch)(cleanTitle(x.trackName || ''), c.title) && (x.syncedLyrics || x.plainLyrics || x.instrumental));
        const identities = new Set(matches.filter(x => Math.abs(Number(x.duration) - duration) <= 2).map(x => (0, lyrics_web_js_1.norm)(x.artistName)));
        for (const x of matches) {
            const sure = !!c.artist && (0, lyrics_web_js_1.artistMatch)(x.artistName || '', [c.artist]);
            // Untagged files: accept only an unambiguous exact title and matching duration.
            const inferred = !c.artist && (0, lyrics_web_js_1.norm)(c.title).length >= 8 && (0, lyrics_web_js_1.norm)(cleanTitle(x.trackName)) === (0, lyrics_web_js_1.norm)(c.title) && duration > 0 && Math.abs(Number(x.duration) - duration) <= 2 && identities.size === 1;
            if ((!sure && !inferred) || seen.has(x.id) || bad.includes(x.id))
                continue;
            seen.add(x.id);
            found.push({ ...x, _sure: sure, _rank: rank, _inferred: inferred });
        }
    };
    const best = () => pickBest(found, duration, variant);
    try {
        await Promise.all(cands.map(async (c, i) => {
            if (!c.artist)
                return;
            const q = new URLSearchParams({ track_name: c.title, artist_name: c.artist });
            if (album)
                q.set('album_name', album);
            if (duration > 0)
                q.set('duration', String(Math.round(duration)));
            take(await request('get?' + q), c, i);
        }));
        if (best())
            return { record: best(), failed: failures > 0 };
        await Promise.all(cands.map(async (c, i) => {
            const q = new URLSearchParams({ track_name: c.title });
            if (c.artist)
                q.set('artist_name', c.artist);
            take(await request('search?' + q), c, i);
        }));
        if (best())
            return { record: best(), failed: failures > 0 };
        await Promise.all(cands.slice(0, 2).map(async (c, i) => take(await request('search?' + new URLSearchParams({ q: `${c.artist} ${c.title}`.trim() })), c, i)));
        return { record: best(), failed: failures > 0 };
    }
    finally {
        clearTimeout(deadline);
        stop();
        signal?.removeEventListener('abort', stop);
    }
}

};
defs["lyrics-web.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksLikeLyrics = exports.azUrl = exports.artistParts = exports.htmlToText = exports.decodeEntities = exports.norm = void 0;
exports.extractGenius = extractGenius;
exports.titleMatch = titleMatch;
exports.nameEq = nameEq;
exports.artistMatch = artistMatch;
exports.artistNear = artistNear;
exports.pickGeniusHit = pickGeniusHit;
exports.pickLyricsCom = pickLyricsCom;
exports.extractLyricsCom = extractLyricsCom;
exports.extractAz = extractAz;
exports.linksByText = linksByText;
exports.bestTextBlock = bestTextBlock;
exports.webLyrics = webLyrics;
// Тексты с сайтов: Genius, Lyrics.com, AZLyrics, Text-pesni, Vse-pesni.
// Браузер не может читать эти сайты напрямую (CORS), поэтому страницу скачивает «посредник»:
//  • приложение для Windows — главный процесс Electron;  • APK — нативный мост;  • сайт/PWA — свой Cloudflare Worker (/fetch).
// Здесь только разбор HTML и выбор нужной песни; функции чистые, их можно проверять без сети.
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
exports.norm = norm;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" };
const decodeEntities = s => String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
        const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
});
exports.decodeEntities = decodeEntities;
const htmlToText = h => (0, exports.decodeEntities)(String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '')
    .replace(/<br\s*\/?>[ \t]*\r?\n?/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
exports.htmlToText = htmlToText;
// ---- Genius ----
function extractGenius(html) {
    const out = [];
    const re = /<div[^>]*data-lyrics-container="true"[^>]*>/g;
    let m;
    while ((m = re.exec(html))) {
        let i = re.lastIndex, depth = 1;
        const tag = /<(\/?)div\b[^>]*>/g;
        tag.lastIndex = i;
        let t;
        while (depth > 0 && (t = tag.exec(html)))
            depth += t[1] ? -1 : 1;
        out.push(html.slice(i, t ? t.index : html.length));
    }
    if (!out.length)
        return '';
    return (0, exports.htmlToText)(out.join('\n').replace(/<div[^>]*data-exclude-from-selection="true"[\s\S]*?<\/div>/g, ''));
}
// Строгое совпадение названия: одинаковые или почти одинаковые («washed» ≠ «washed out», ≠ «brainwashed»)
function titleMatch(a, b) {
    a = (0, exports.norm)(a);
    b = (0, exports.norm)(b);
    if (!a || !b)
        return false;
    if (a === b)
        return true;
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    return l.includes(s) && s.length >= 4 && s.length / l.length >= 0.85;
}
// ---- сравнение артистов ----
// Раньше хватало вхождения букв («Aria» находилась внутри «Mariah Carey») — отсюда чужие тексты.
// Теперь сравниваются имена целиком: «perubaby, boolymon» → два имени, подходит любое из них.
// Имя, записанное другим алфавитом («Скриптонит» / «Skryptonite»), сравнивается после транслитерации.
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'i', є: 'e', ґ: 'g' };
const fold = n => n.replace(/(.)\1+/g, '$1').replace(/[а-яіїєґ]/g, c => TR[c] ?? c).replace(/kh/g, 'h').replace(/ph/g, 'f').replace(/[yj]/g, 'i').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/ck/g, 'k').replace(/c(?![h])/g, 'k').replace(/(.)\1+/g, '$1');
function lev(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++)
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[b.length];
}
function nameEq(a, b) {
    const sx = v => (0, exports.norm)(String(v || '').replace(/\$/g, 's'));
    const x = sx(a), y = sx(b);
    if (!x || !y)
        return false;
    if (x === y)
        return true;
    const cross = /[а-яіїєґ]/.test(x) !== /[а-яіїєґ]/.test(y);
    const fx = fold(x), fy = fold(y);
    if (cross && fx === fy && fx.length >= 3)
        return true;
    if (Math.min(fx.length, fy.length) < 5)
        return false;
    const sim = (p, q) => 1 - lev(p, q) / Math.max(p.length, q.length);
    if (cross) { // «Нойз МС» = «Noize MC»: кириллическое «МС» — это латинское MC
        const mc = v => fold(v.replace(/мс/g, 'мк'));
        return Math.max(sim(fx, fy), sim(mc(x), mc(y))) >= 0.78;
    }
    return sim(fx, fy) >= 0.86;
}
const SEP_HARD = /\s*(?:[,;/]|&|\bfeat\.?|\bft\.?|\bfeaturing\b)\s*/i;
const SEP_SOFT = /\s*(?:[,;/+×]|&|\bfeat\.?|\bft\.?|\bfeaturing\b|\s(?:x|and|и|with|vs\.?)\s)\s*/i;
const artistParts = s => { const raw = String(s || ''); return [...new Set([raw, ...raw.split(SEP_HARD), ...raw.split(SEP_SOFT)].map(x => x.trim()).filter(Boolean))]; };
exports.artistParts = artistParts;
// Артист совпадает, если хотя бы одно из наших имён равно одному из их имён
function artistMatch(theirs, ours) {
    const T = (0, exports.artistParts)(theirs);
    if (!T.length)
        return false;
    return [].concat(ours).some(o => (0, exports.artistParts)(o).some(a => T.some(t => nameEq(a, t))));
}
// Слабее, чем artistMatch: одно имя целыми словами входит в другое («Macan» в «DJ Macan Remix»).
// Буквы внутри чужого слова («Aria» в «Mariah») не считаются. Годится только вместе с совпавшей длиной песни.
const words = s => String(s || '').toLowerCase().split(/[^\p{L}\p{N}$]+/u).map(w => (0, exports.norm)(w.replace(/\$/g, 's'))).filter(Boolean);
function artistNear(theirs, ours) {
    const T = words(theirs);
    const inside = (small, big) => small.length && small.join('').length >= 3 && big.some((_, i) => small.every((w, k) => big[i + k] === w));
    return [].concat(ours).some(o => { const O = words(o); return inside(O, T) || inside(T, O); });
}
const sameSong = (a, b) => titleMatch(a, b);
const sameArtist = (a, b) => artistMatch(a, b);
function pickGeniusHit(json, artist, title) {
    const hits = [].concat(...((json && json.response && json.response.sections) || []).map(s => s.hits || [])).filter(h => h.type === 'song' && h.result);
    const h = hits.find(h => sameSong(h.result.title, title) && (!artist || sameArtist((h.result.artist_names || '') + ', ' + (h.result.primary_artist && h.result.primary_artist.name || ''), artist)));
    return h ? h.result.url : '';
}
// ---- Lyrics.com ----
function pickLyricsCom(html, artist, title) {
    const re = /href="(\/lyric\/\d+\/[^"]+)"[^>]*>([^<]*)</g;
    let m;
    const want = (0, exports.norm)(title);
    while ((m = re.exec(html))) {
        const slug = decodeURIComponent(m[1]).toLowerCase();
        if (titleMatch(m[2], title)) {
            if (!artist || (0, exports.norm)(slug).includes((0, exports.norm)(artist).slice(0, 5)))
                return 'https://www.lyrics.com' + m[1];
        }
    }
    return '';
}
function extractLyricsCom(html) { const m = /<pre[^>]*id="lyric-body-text"[^>]*>([\s\S]*?)<\/pre>/i.exec(html); return m ? (0, exports.htmlToText)(m[1]) : ''; }
// ---- AZLyrics (адрес собирается из имён, только латиница) ----
const azUrl = (artist, title) => {
    const f = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const a = f(artist), t = f(title);
    return a && t ? `https://www.azlyrics.com/lyrics/${a}/${t}.html` : '';
};
exports.azUrl = azUrl;
function extractAz(html) { const m = /Sorry about that\.\s*-->([\s\S]*?)<\/div>/i.exec(html); return m ? (0, exports.htmlToText)(m[1]) : ''; }
// ---- общий разбор для русскоязычных сайтов: ссылка по тексту → страница → самый «похожий на стихи» блок ----
function linksByText(html, origin, title, artist) {
    const want = (0, exports.norm)(title), who = (0, exports.norm)(artist);
    const out = [];
    const re = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html))) {
        const text = (0, exports.norm)((0, exports.htmlToText)(m[2]));
        if (!text || !text.includes(want))
            continue;
        // в ссылке «Артист - Название»: без имени артиста должно остаться само название, а не «название + ещё слова»
        const rest = who && text.includes(who) ? text.replace(who, '') : text;
        if (!titleMatch(rest, want) && rest !== want)
            continue;
        let href = m[1];
        if (href.startsWith('//'))
            href = 'https:' + href;
        else if (href.startsWith('/'))
            href = origin + href;
        else if (!/^https?:/.test(href))
            continue;
        if (!href.startsWith(origin))
            continue;
        out.push({ href, score: (who && text.includes(who) ? 2 : 0) + (text === want ? 1 : 0) });
    }
    return out.sort((a, b) => b.score - a.score).map(x => x.href);
}
function bestTextBlock(html) {
    const cleaned = String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<nav[\s\S]*?<\/nav>|<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>|<form[\s\S]*?<\/form>/gi, '');
    let best = '', bestScore = 0;
    const re = /<(div|article|pre|section|p|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = re.exec(cleaned))) {
        const inner = m[2];
        if (/<(div|article|section|table)\b/i.test(inner))
            continue; // только самые вложенные блоки
        const links = (inner.match(/<a\b/gi) || []).length;
        const text = (0, exports.htmlToText)(inner), lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 6 || lines.length > 220)
            continue;
        const avg = text.length / lines.length;
        if (avg > 90 || avg < 8)
            continue;
        const score = lines.length * 2 - links * 3 - Math.max(0, avg - 50);
        if (score > bestScore) {
            bestScore = score;
            best = text;
        }
    }
    return best;
}
const BAD = /cookie|javascript|реклама|все права защищены|войти|регистрац/i;
const looksLikeLyrics = t => !!t && t.split('\n').filter(l => l.trim()).length >= 6 && !BAD.test(t.slice(0, 400));
exports.looksLikeLyrics = looksLikeLyrics;
const SITES = [
    { id: 'text-pesni', origin: 'https://text-pesni.com', search: q => [`https://text-pesni.com/search/?q=${q}`, `https://text-pesni.com/?s=${q}`] },
    { id: 'vse-pesni', origin: 'https://vse-pesni.com', search: q => [`https://vse-pesni.com/?s=${q}`, `https://vse-pesni.com/search/?q=${q}`] },
];
// fetchText(url) → строка HTML/JSON или '' при ошибке. Возвращает { text, source } или null.
async function webLyrics(artist, title, fetchText, { skip = [] } = {}) {
    const tryRun = async (id, fn) => {
        if (skip.includes(id))
            return null;
        try {
            const text = await fn();
            return text && text.length > 40 ? { text, source: id } : null;
        }
        catch {
            return null;
        }
    };
    const q = encodeURIComponent(`${artist} ${title}`.trim()), cyr = /[а-яё]/i.test(artist + title);
    const jobs = [
        ['genius', async () => {
                const j = JSON.parse(await fetchText('https://genius.com/api/search/multi?per_page=5&q=' + q) || 'null');
                const url = pickGeniusHit(j, artist, title);
                return url ? extractGenius(await fetchText(url)) : '';
            }],
        ['lyricscom', async () => {
                if (cyr)
                    return '';
                const url = pickLyricsCom(await fetchText(`https://www.lyrics.com/serp.php?st=${q}&qtype=2`), artist, title);
                return url ? extractLyricsCom(await fetchText(url)) : '';
            }],
        ['azlyrics', async () => { const url = cyr ? '' : (0, exports.azUrl)(artist, title); return url ? extractAz(await fetchText(url)) : ''; }],
        ...SITES.map(s => [s.id, async () => {
                for (const su of s.search(q)) {
                    const links = linksByText(await fetchText(su), s.origin, title, artist).slice(0, 2);
                    for (const l of links) {
                        const t = bestTextBlock(await fetchText(l));
                        if ((0, exports.looksLikeLyrics)(t))
                            return t;
                    }
                }
                return '';
            }]),
    ];
    // русские песни — сначала русскоязычные сайты, остальные — как есть
    if (cyr)
        jobs.sort((a, b) => (['text-pesni', 'vse-pesni'].includes(b[0]) ? 1 : 0) - (['text-pesni', 'vse-pesni'].includes(a[0]) ? 1 : 0));
    for (const [id, fn] of jobs) {
        const r = await tryRun(id, fn);
        if (r)
            return r;
    }
    return null;
}

};
defs["m3u.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseM3U = parseM3U;
exports.buildM3U = buildM3U;
const util_js_1 = require("./util.js");
function parseM3U(text) {
    const out = [];
    let info = null;
    for (let raw of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line)
            continue;
        if (line.startsWith('#EXTINF:')) {
            const c = line.indexOf(',');
            info = c >= 0 ? line.slice(c + 1).trim() : null;
            continue;
        }
        if (line.startsWith('#'))
            continue;
        let path = line;
        try {
            path = decodeURIComponent(line.replace(/^file:\/+/, '/'));
        }
        catch { /* keep raw */ }
        out.push({ path, base: (0, util_js_1.baseName)(path), title: info });
        info = null;
    }
    return out;
}
function buildM3U(name, tracks) {
    const lines = ['#EXTM3U', '#PLAYLIST:' + name];
    for (const t of tracks) {
        lines.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist ? t.artist + ' - ' : ''}${t.title}`);
        lines.push(t.name);
    }
    return lines.join('\n') + '\n';
}

};
defs["miniwin.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.miniWindowOpen = exports.canMiniWindow = void 0;
exports.toggleMiniWindow = toggleMiniWindow;
const player_js_1 = require("./player.js");
const state_js_1 = require("./state.js");
const icons_js_1 = require("./icons.js");
const util_js_1 = require("./util.js");
const native_js_1 = require("./native.js");
const ui_js_1 = require("./ui.js");
// Мини-плеер в отдельном окошке (компьютер): обложка, название и кнопки.
// В Chrome и Edge окно держится поверх остальных программ (Document Picture-in-Picture);
// в других браузерах открывается обычное маленькое окно.
let win = null;
const canMiniWindow = () => !native_js_1.isNative && typeof window !== 'undefined' && (('documentPictureInPicture' in window) || matchMedia('(pointer: fine)').matches);
exports.canMiniWindow = canMiniWindow;
const miniWindowOpen = () => !!win && !win.closed;
exports.miniWindowOpen = miniWindowOpen;
const CSS = `
*{box-sizing:border-box;margin:0}html,body{height:100%}
body{font-family:Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#0b0b0d;color:#fff;overflow:hidden;user-select:none}
.bg{position:fixed;inset:-25%;background-size:cover;background-position:center;filter:blur(50px) saturate(1.4);opacity:.55}
.dim{position:fixed;inset:0;background:linear-gradient(180deg,rgba(9,9,11,.25),rgba(9,9,11,.82))}
.box{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px}
.cov{width:min(58vw,46vh);aspect-ratio:1;border-radius:16px;background:#222 center/cover;box-shadow:0 18px 50px rgba(0,0,0,.55);flex:none;display:grid;place-items:center;color:rgba(255,255,255,.4)}
.cov svg{width:38%;height:38%}
.t{width:100%;text-align:center;min-width:0}
.t b{display:block;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t span{display:block;font-size:13px;opacity:.72;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{width:100%;display:flex;align-items:center;gap:8px;font-size:11px;opacity:.85;font-variant-numeric:tabular-nums}
.bar input{flex:1;accent-color:#fff;height:4px;min-width:0}
.ctl{display:flex;align-items:center;gap:14px}
button{border:0;background:none;color:#fff;cursor:pointer;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;transition:background .15s,transform .15s}
button:hover{background:rgba(255,255,255,.14)}button:active{transform:scale(.94)}
button svg{width:22px;height:22px}
.pp{width:52px;height:52px;background:#fff;color:#111}.pp:hover{background:#fff}.pp svg{width:24px;height:24px}
.like.on{color:#ff5a79}
.empty{opacity:.7;font-size:14px;text-align:center;padding:0 12px}
@media (max-height:260px){.cov{display:none}}
@media (max-height:170px){.bar{display:none}}
`;
function draw() {
    if (!(0, exports.miniWindowOpen)())
        return;
    const d = win.document, t = (0, player_js_1.current)(), $ = s => d.querySelector(s);
    if (!t) {
        delete $('.box').dataset.track;
        $('.box').innerHTML = `<div class="empty">Ничего не играет.<br>Включите песню в плеере.</div>`;
        $('.bg').style.backgroundImage = '';
        d.title = 'Puro Cielo';
        return;
    }
    const trackKey = JSON.stringify([t.id, t.title, t.artist, t.cover]);
    if ($('.box').dataset.track !== trackKey) {
        $('.box').dataset.track = trackKey;
        $('.box').innerHTML = `
      <div class="cov" ${t.cover ? `style="background-image:url('${t.cover}')"` : ''}>${t.cover ? '' : (0, icons_js_1.icon)('note')}</div>
      <div class="t"><b>${(0, util_js_1.esc)(t.title)}</b><span>${(0, util_js_1.esc)(t.artist || '')}</span></div>
      <div class="bar"><span class="cur">0:00</span><input type="range" min="0" max="1000" value="0" aria-label="Перемотка"><span class="dur">0:00</span></div>
      <div class="ctl"><button class="like" data-a="like" aria-label="Нравится"></button><button data-a="prev" aria-label="Предыдущий">${(0, icons_js_1.icon)('prev')}</button><button class="pp" data-a="toggle" aria-label="Играть / пауза"></button><button data-a="next" aria-label="Следующий">${(0, icons_js_1.icon)('next')}</button><button data-a="back" aria-label="Открыть плеер" title="Открыть плеер">${(0, icons_js_1.icon)('chev-up')}</button></div>`;
        $('.bg').style.backgroundImage = t.cover ? `url('${t.cover}')` : '';
        d.title = `${t.title} — ${t.artist || 'Puro Cielo'}`;
    }
    $('.pp').innerHTML = (0, icons_js_1.icon)((0, player_js_1.isPlaying)() ? 'pause' : 'play');
    const liked = state_js_1.state.likes.has(t.id), lk = $('.like');
    lk.classList.toggle('on', liked);
    lk.innerHTML = (0, icons_js_1.icon)(liked ? 'heart-fill' : 'heart');
    tick();
}
function tick() {
    if (!(0, exports.miniWindowOpen)())
        return;
    const d = win.document, r = d.querySelector('.bar input');
    if (!r)
        return;
    const dur = isFinite(player_js_1.audio.duration) ? player_js_1.audio.duration : 0;
    if (!r.matches(':active'))
        r.value = dur ? Math.round(player_js_1.audio.currentTime / dur * 1000) : 0;
    d.querySelector('.cur').textContent = (0, util_js_1.fmtTime)(player_js_1.audio.currentTime || 0);
    d.querySelector('.dur').textContent = (0, util_js_1.fmtTime)(dur);
}
function build(w) {
    const d = w.document;
    d.documentElement.lang = 'ru';
    d.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Puro Cielo</title><style>${CSS}</style>`;
    d.body.innerHTML = `<div class="bg"></div><div class="dim"></div><div class="box"></div>`;
    d.addEventListener('click', e => {
        const b = e.target.closest('[data-a]');
        if (!b)
            return;
        const a = b.dataset.a, t = (0, player_js_1.current)();
        if (a === 'toggle')
            (0, player_js_1.toggle)();
        else if (a === 'next')
            (0, player_js_1.next)();
        else if (a === 'prev')
            (0, player_js_1.prev)();
        else if (a === 'like' && t)
            (0, state_js_1.toggleLike)(t.id);
        else if (a === 'back') {
            try {
                window.focus();
            }
            catch { /* ignore */ }
            w.close();
        }
    });
    d.addEventListener('input', e => {
        if (e.target.matches('.bar input') && isFinite(player_js_1.audio.duration))
            (0, player_js_1.seek)(e.target.value / 1000 * player_js_1.audio.duration);
    });
    d.addEventListener('keydown', e => {
        if (e.code === 'Space') {
            e.preventDefault();
            (0, player_js_1.toggle)();
        }
        else if (e.code === 'ArrowRight')
            (0, player_js_1.next)();
        else if (e.code === 'ArrowLeft')
            (0, player_js_1.prev)();
    });
    const closed = () => { win = null; document.documentElement.classList.remove('mini-win'); };
    w.addEventListener('pagehide', closed);
    w.addEventListener('unload', closed);
}
async function toggleMiniWindow() {
    if ((0, exports.miniWindowOpen)()) {
        win.close();
        win = null;
        document.documentElement.classList.remove('mini-win');
        return;
    }
    let w = null;
    if ('documentPictureInPicture' in window) {
        try {
            w = await window.documentPictureInPicture.requestWindow({ width: 300, height: 400 });
        }
        catch { /* запрещено или не поддерживается — обычное окно */ }
    }
    if (!w) {
        try {
            w = window.open('', 'puro-mini', 'popup=yes,width=300,height=420');
        }
        catch { /* ignore */ }
    }
    if (!w)
        return (0, ui_js_1.toast)('Браузер не дал открыть окошко. Разрешите всплывающие окна для этого сайта.', 'err', 5000);
    win = w;
    build(w);
    document.documentElement.classList.add('mini-win');
    draw();
}
for (const e of ['track', 'state', 'likes', 'covers', 'track-meta'])
    (0, state_js_1.on)(e, draw);
player_js_1.audio.addEventListener('timeupdate', tick);
player_js_1.audio.addEventListener('play', draw);
player_js_1.audio.addEventListener('pause', draw);
if (typeof window !== 'undefined')
    window.addEventListener('pagehide', () => {
        if ((0, exports.miniWindowOpen)())
            win.close();
    });

};
defs["motion.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motionEnabled = void 0;
exports.cancelMotion = cancelMotion;
exports.revealElement = revealElement;
exports.revealView = revealView;
exports.dismissElement = dismissElement;
// Короткие анимации интерфейса: только видимые элементы, без постоянных циклов.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const active = new Set(), byElement = new WeakMap();
const motionEnabled = () => !reduced.matches && !document.documentElement.classList.contains('no-anim');
exports.motionEnabled = motionEnabled;
function cancelMotion() {
    for (const animation of active)
        animation.cancel();
}
if (reduced.addEventListener)
    reduced.addEventListener('change', () => { if (reduced.matches)
        cancelMotion(); });
function animate(el, frames, options) {
    byElement.get(el)?.cancel();
    if (!(0, exports.motionEnabled)() || !el?.animate)
        return null;
    const animation = el.animate(frames, { duration: 360, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards', ...options });
    byElement.set(el, animation);
    active.add(animation);
    const clean = () => {
        active.delete(animation);
        if (byElement.get(el) === animation)
            byElement.delete(el);
    };
    animation.finished.then(clean, clean);
    return animation;
}
function revealElement(el, { distance = 8, delay = 0, duration = 360 } = {}) {
    if (!el || !(0, exports.motionEnabled)())
        return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth)
        return;
    return animate(el, distance ? [
        { opacity: 0, transform: `translateY(${distance}px)` },
        { opacity: 1, transform: 'translateY(0)' },
    ] : [{ opacity: .25 }, { opacity: 1 }], { delay, duration });
}
function revealView(view) {
    if (!(0, exports.motionEnabled)())
        return;
    let count = 0, inspected = 0;
    for (const el of view.querySelectorAll('.card, .lrow, .row, .setting, .empty')) {
        if (++inspected > 80)
            break;
        if (revealElement(el, { delay: count * 22, duration: 380 }))
            count++;
        if (count >= 12)
            break;
    }
}
function dismissElement(el) {
    // Уходящее меню сразу перестаёт перехватывать мышь и клавиатуру.
    el.inert = true;
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden', 'true');
    const animation = animate(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 0, transform: 'translateY(4px) scale(.985)' }], { duration: 160, fill: 'forwards' });
    if (animation)
        animation.finished.then(() => el.remove(), () => el.remove());
    else
        el.remove();
}

};
defs["native.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNativeFetch = exports.nativeFetchText = exports.forgetFile = exports.pickFiles = exports.setPlayback = exports.folderName = exports.rescan = exports.pickFolder = exports.RemoteFile = exports.isNativeId = exports.nativeId = exports.nativeUrl = exports.isNative = exports.bridge = void 0;
// Мост к Android-оболочке (WebView). В браузере и в Electron window.PuroNative нет — тогда всё работает как раньше.
exports.bridge = typeof window !== 'undefined' ? window.PuroNative || null : null;
exports.isNative = !!exports.bridge;
// Файлы выбранной папки оболочка отдаёт с того же адреса, что и приложение: /f/<id документа> (с поддержкой Range)
const nativeUrl = docId => '/f/' + encodeURIComponent(docId);
exports.nativeUrl = nativeUrl;
const nativeId = docId => 'n:' + docId;
exports.nativeId = nativeId;
const isNativeId = id => typeof id === 'string' && id.startsWith('n:');
exports.isNativeId = isNativeId;
// «Файл» без копирования: теги читаются кусками через Range-запросы
class RemoteFile {
    constructor(url, size, name = '', type = '') { this.url = url; this.size = size; this.name = name; this.type = type; }
    slice(a = 0, b = this.size) {
        const url = this.url, end = Math.min(b, this.size);
        return {
            arrayBuffer: async () => {
                if (end <= a)
                    return new ArrayBuffer(0);
                const r = await fetch(url, { headers: { Range: `bytes=${a}-${end - 1}` } });
                const buf = await r.arrayBuffer();
                return r.status === 206 ? buf : buf.slice(a, end);
            },
        };
    }
    async arrayBuffer() { return (await fetch(this.url)).arrayBuffer(); }
}
exports.RemoteFile = RemoteFile;
const pickFolder = () => {
    try {
        exports.bridge?.pickFolder();
    }
    catch { /* ignore */ }
};
exports.pickFolder = pickFolder;
const rescan = () => {
    try {
        exports.bridge?.sync();
    }
    catch { /* ignore */ }
};
exports.rescan = rescan;
const folderName = () => {
    try {
        return exports.bridge?.folderName() || '';
    }
    catch {
        return '';
    }
};
exports.folderName = folderName;
const setPlayback = (playing, title, artist) => {
    try {
        exports.bridge?.setPlayback(!!playing, title || '', artist || '');
    }
    catch { /* ignore */ }
};
exports.setPlayback = setPlayback;
const pickFiles = () => {
    try {
        exports.bridge?.pickFiles();
    }
    catch { /* ignore */ }
};
exports.pickFiles = pickFiles;
// Трек, добавленный по одному, забываем и в оболочке (иначе при следующем сканировании он вернётся)
const forgetFile = id => {
    try {
        if (typeof id === 'string' && id.startsWith('n:uri:'))
            exports.bridge?.forget(id.slice(2));
    }
    catch { /* ignore */ }
};
exports.forgetFile = forgetFile;
// Загрузка страницы сайта через оболочку (WebView сам не может из-за CORS)
const pend = new Map();
let seq = 0;
const nativeFetchText = (url, ms = 14000) => new Promise(res => {
    const id = 'f' + (++seq);
    const timer = setTimeout(() => { pend.delete(id); res(''); }, ms);
    pend.set(id, txt => { clearTimeout(timer); res(txt || ''); });
    try {
        exports.bridge.fetchText(id, url);
    }
    catch {
        clearTimeout(timer);
        pend.delete(id);
        res('');
    }
});
exports.nativeFetchText = nativeFetchText;
const onNativeFetch = (id, txt) => {
    const f = pend.get(id);
    if (f) {
        pend.delete(id);
        f(txt);
    }
};
exports.onNativeFetch = onNativeFetch;

};
defs["nowplaying.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNPOpen = exports.fmtBR = exports.fmtSR = void 0;
exports.techParts = techParts;
exports.syncLikeBtns = syncLikeBtns;
exports.setPane = setPane;
exports.openNP = openNP;
exports.closeNP = closeNP;
exports.initPlayerUI = initPlayerUI;
const translate_js_1 = require("./translate.js");
const player_js_1 = require("./player.js");
const state_js_1 = require("./state.js");
const lyrics_auto_js_1 = require("./lyrics-auto.js");
const ui_js_1 = require("./ui.js");
const icons_js_1 = require("./icons.js");
const lrc_js_1 = require("./lrc.js");
const util_js_1 = require("./util.js");
const views_js_1 = require("./views.js");
const actions_js_1 = require("./actions.js");
const miniwin_js_1 = require("./miniwin.js");
const motion_js_1 = require("./motion.js");
const mini = (0, util_js_1.$)('#mini'), np = (0, util_js_1.$)('#np'), lyBox = (0, util_js_1.$)('#np-lyrics'), qBox = (0, util_js_1.$)('#np-queue');
const miniSeek = (0, util_js_1.$)('#mini-seek'), npSeek = (0, util_js_1.$)('#np-seek'), miniVol = (0, util_js_1.$)('#mini-vol'), npVol = (0, util_js_1.$)('#np-vol');
const isDesktop = () => matchMedia('(min-width: 900px)').matches;
let npOpen = false, dragging = 0;
// ---------- формат технической информации ----------
const fmtSR = sr => sr ? `${(sr / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',')} кГц` : '';
exports.fmtSR = fmtSR;
const fmtBR = t => t.bitrate ? `${t.approx ? '≈ ' : ''}${Math.round(t.bitrate).toLocaleString('ru-RU')} кбит/с` : '';
exports.fmtBR = fmtBR;
function techParts(t) {
    const p = [];
    if (t.codec)
        p.push(t.codec);
    if (t.bits && ['FLAC', 'WAV', 'ALAC'].includes(t.codec))
        p.push(`${t.bits} бит`);
    if (t.sampleRate)
        p.push((0, exports.fmtSR)(t.sampleRate));
    if (t.bitrate)
        p.push((0, exports.fmtBR)(t));
    return p;
}
// ---------- иконки в статических кнопках ----------
const setIc = (id, name) => {
    const el = document.getElementById(id);
    if (el)
        el.innerHTML = (0, icons_js_1.icon)(name);
};
function initIcons() {
    [['m-shuffle', 'shuffle'], ['m-prev', 'prev'], ['m-next', 'next'], ['m-repeat', 'repeat'], ['m-like', 'heart'], ['m-lyrics', 'lyrics'], ['m-queue', 'queue'], ['m-expand', 'chev-up'], ['m-pip', 'pip'],
        ['mm-next', 'next'], ['np-close', 'chev-down'], ['np-more', 'more'], ['np-like', 'heart'], ['n-shuffle', 'shuffle'], ['n-prev', 'prev'], ['n-next', 'next'], ['n-repeat', 'repeat'],
        ['n-vol-hi', 'vol-high'], ['np-edit', 'edit'], ['np-pane-toggle', 'lyrics']].forEach(([a, b]) => setIc(a, b));
    ['m-play', 'mm-play', 'n-play'].forEach(id => setIc(id, 'play'));
    syncVolume();
    syncTheme();
}
const syncTheme = () => setIc('np-theme', state_js_1.state.theme === 'dark' ? 'sun' : 'moon');
// ---------- диапазоны ----------
const paint = el => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
function bindSeek(el) {
    el.addEventListener('pointerdown', () => { dragging++; });
    const end = () => {
        if (dragging)
            dragging = Math.max(0, dragging - 1);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('input', () => {
        paint(el);
        const d = player_js_1.audio.duration || 0, t = (el.value / 1000) * d;
        for (const [c, s] of [['mini-cur', miniSeek], ['np-cur', npSeek]]) {
            if (s !== el) {
                s.value = el.value;
                paint(s);
            }
            (0, util_js_1.$)('#' + c).textContent = (0, util_js_1.fmtTime)(t);
        }
    });
    el.addEventListener('change', () => { const d = player_js_1.audio.duration || 0; (0, player_js_1.seek)((el.value / 1000) * d); dragging = 0; });
}
function bindVol(el) {
    el.addEventListener('input', () => (0, player_js_1.setVolume)(el.value / 100));
}
function syncVolume() {
    const v = player_js_1.P.muted ? 0 : player_js_1.audio.volume;
    for (const el of [miniVol, npVol]) {
        el.value = Math.round(v * 100);
        paint(el);
    }
    const ic = v === 0 ? 'vol-mute' : v < 0.5 ? 'vol-low' : 'vol-high';
    setIc('m-mute', ic);
    setIc('n-mute', ic);
}
// ---------- обновление по состоянию ----------
function syncPlay() {
    const pl = (0, player_js_1.isPlaying)(), cur = (0, player_js_1.current)();
    for (const id of ['m-play', 'mm-play', 'n-play']) {
        const b = document.getElementById(id);
        b.innerHTML = (0, icons_js_1.icon)(pl ? 'pause' : 'play');
        b.setAttribute('aria-label', pl ? 'Пауза' : 'Играть');
    }
    document.body.classList.toggle('is-playing', pl);
    (0, util_js_1.$)('#np-art').classList.toggle('paused', !pl);
    if (pl)
        startLoop();
    if (!cur)
        return;
}
function syncModes() {
    for (const id of ['m-shuffle', 'n-shuffle']) {
        const b = document.getElementById(id);
        b.classList.toggle('on', player_js_1.P.shuffle);
        b.setAttribute('aria-pressed', player_js_1.P.shuffle);
    }
    for (const id of ['m-repeat', 'n-repeat']) {
        const b = document.getElementById(id);
        b.classList.toggle('on', player_js_1.P.repeat !== 'off');
        b.innerHTML = (0, icons_js_1.icon)(player_js_1.P.repeat === 'one' ? 'repeat-one' : 'repeat');
        b.setAttribute('aria-label', 'Повтор: ' + ({ off: 'выкл', all: 'все', one: 'один' }[player_js_1.P.repeat]));
    }
    renderQueue();
}
function syncLikeBtns() {
    const t = (0, player_js_1.current)(), on_ = !!t && state_js_1.state.likes.has(t.id);
    for (const id of ['m-like', 'np-like']) {
        const b = document.getElementById(id);
        b.classList.toggle('on', on_);
        b.innerHTML = (0, icons_js_1.icon)(on_ ? 'heart-fill' : 'heart');
    }
}
let displayedTrack = null, lyricsPrefetchTimer;
function prepareNextLyrics(track) {
    clearTimeout(lyricsPrefetchTimer);
    lyricsPrefetchTimer = setTimeout(() => {
        if (!track || (0, player_js_1.current)()?.id !== track.id || !(0, player_js_1.isPlaying)() || !state_js_1.state.settings.autoLyrics || navigator.onLine === false || navigator.connection?.saveData || player_js_1.P.repeat === 'one')
            return;
        const index = player_js_1.P.idx + 1 < player_js_1.P.queue.length ? player_js_1.P.idx + 1 : player_js_1.P.repeat === 'all' ? 0 : -1;
        const next = state_js_1.state.tracks.get(player_js_1.P.queue[index]);
        if (next && next.id !== track.id && !next.lyrics)
            (0, lyrics_auto_js_1.ensureLyrics)(next, { prefetch: true });
    }, 1800);
}
function renderTrack(t) {
    const changed = !!t && displayedTrack !== t.id;
    displayedTrack = t?.id || null;
    mini.hidden = !t;
    document.body.classList.toggle('has-mini', !!t);
    if (!t) {
        closeNP();
        return;
    }
    (0, util_js_1.$)('#mini-cover').innerHTML = (0, views_js_1.cov)(t.cover, t._albumKey || t.id);
    (0, util_js_1.$)('#mini-title').textContent = t.title;
    (0, util_js_1.$)('#mini-artist').innerHTML = (0, views_js_1.artistLinks)((0, views_js_1.artistsOf)(t)) + (t.album ? ' — ' + (0, util_js_1.esc)(t.album) : '');
    const tp = techParts(t);
    (0, util_js_1.$)('#mini-tech').innerHTML = tp.map(x => `<span>${(0, util_js_1.esc)(x)}</span>`).join('');
    (0, util_js_1.$)('#np-cover').innerHTML = (0, views_js_1.cov)(t.cover, t._albumKey || t.id);
    (0, util_js_1.$)('#np-bg').src = t.cover || '';
    (0, util_js_1.$)('#np-bg').style.display = t.cover ? '' : 'none';
    (0, util_js_1.$)('#np-title').textContent = t.title;
    (0, util_js_1.$)('#np-artist').innerHTML = (0, views_js_1.artistLinks)((0, views_js_1.artistsOf)(t));
    (0, util_js_1.$)('#np-album').innerHTML = [t.album ? (0, views_js_1.albumLink)(t) : '', (0, util_js_1.esc)(t.year || ''), (0, util_js_1.esc)(t.genre || '')].filter(Boolean).join(' · ');
    (0, util_js_1.$)('#np-chips').innerHTML = tp.map((x, i) => `<span class="chip-s ${i === 0 ? 'codec' : ''}">${(0, util_js_1.esc)(x)}</span>`).join('');
    (0, util_js_1.$)('#mini-dur').textContent = (0, util_js_1.$)('#np-dur').textContent = (0, util_js_1.fmtTime)(t.duration);
    if (changed) {
        ['mini-title', 'mini-artist', 'np-title', 'np-artist', 'np-cover'].forEach((id, i) => {
            if (id.startsWith('np-') && !npOpen)
                return;
            (0, motion_js_1.revealElement)((0, util_js_1.$)('#' + id), { distance: 0, delay: i % 2 * 35, duration: 320 });
        });
    }
    const lyricsReady = (0, lyrics_auto_js_1.ensureLyrics)(t);
    if (changed)
        lyricsReady.then(() => prepareNextLyrics(t));
    syncLikeBtns();
    renderLyrics(t);
    renderQueue();
    syncPlay();
    document.title = `${t.title} — ${(0, views_js_1.artistsOf)(t).join(', ') || 'Puro Cielo'}`;
}
function syncMeta() {
    const d = player_js_1.audio.duration;
    if (isFinite(d))
        (0, util_js_1.$)('#mini-dur').textContent = (0, util_js_1.$)('#np-dur').textContent = (0, util_js_1.fmtTime)(d);
}
// ---------- Караоке ----------
let lines = [], lyEls = [], lastIdx = -2, lastWords = -1, userScrollUntil = 0, lyType = null, curOff = 0, wTimes = null, wLast = [];
function renderLyrics(t) {
    lines = [];
    lyEls = [];
    lastIdx = -2;
    lastWords = -1;
    lyType = null;
    wTimes = null;
    wLast = [];
    let ly = t?.lyrics;
    lyBox.scrollTop = 0;
    lyBox.classList.remove('plain');
    curOff = 0;
    if (!ly) {
        const loading = t && t._ly === 'loading';
        const missing = t?._ly === 'offline' ? 'Для поиска текста нужен интернет' : t?._ly === 'error' ? 'Поиск текста временно недоступен' : 'Текст не найден';
        lyBox.innerHTML = loading
            ? `<div class="ly-empty"><span class="ly-spin"></span><h3>Ищу текст…</h3></div>`
            : `<div class="ly-empty">${(0, icons_js_1.icon)('lyrics')}<h3>${missing}</h3>${state_js_1.state.settings.autoLyrics ? '<button class="btn btn-soft sm" data-ly="retry">Искать снова</button>' : ''}<button class="btn btn-soft sm" data-ly="edit">${(0, icons_js_1.icon)('edit')}Добавить текст</button></div>`;
        return;
    }
    lyType = ly.type;
    // перевод строчкой под оригиналом (если включён и уже загружен)
    const trOn = state_js_1.state.settings.lyTranslate && (0, translate_js_1.canTranslate)(ly);
    const tr = trOn ? (0, translate_js_1.cachedTranslation)(t) : null;
    if (trOn && !tr)
        (0, translate_js_1.loadTranslation)(t);
    const trLine = i => (tr && tr[i] ? `<span class="ly-tr">${(0, util_js_1.esc)(tr[i])}</span>` : '');
    if (ly.type === 'plain') {
        lyBox.classList.add('plain');
        lyBox.innerHTML = `<div class="ly-plain">${(0, util_js_1.esc)(ly.text).split(/\n/).map((l, i) => l.trim() ? `<p>${l}${trLine(i)}</p>` : '<br>').join('')}</div>`;
        return;
    }
    lines = ly.lines;
    lyBox.innerHTML = `<div class="ly-pad"></div>${lines.map((l, i) => l.text
        ? `<p class="ly" data-i="${i}">${(0, util_js_1.esc)(l.text).split(' ').map(w => `<span class="w">${w}</span>`).join(' ')}${trLine(i)}</p>`
        : `<p class="ly gap" data-i="${i}"><span class="dots"><i></i><i></i><i></i></span></p>`).join('')}<div class="ly-pad"></div>`;
    lyEls = [...lyBox.querySelectorAll('.ly')];
}
function editLyrics() {
    const t = (0, player_js_1.current)();
    if (!t)
        return;
    (0, ui_js_1.openModal)({ title: 'Текст песни', wide: true,
        html: `<p class="modal-text">Вставьте текст или загрузите файл <b>.lrc</b> / <b>.txt</b>. Если в тексте есть метки времени вида <code>[01:23.45]</code>, он будет идти как караоке.</p>
      <textarea class="input ly-area" id="ly-area" rows="12" placeholder="Текст песни…">${(0, util_js_1.esc)((0, lyrics_auto_js_1.rawLyrics)(t))}</textarea>
      <input type="file" id="ly-file" accept=".lrc,.txt,text/plain" hidden>
      <div class="pe-btns"><button class="btn btn-soft sm" id="ly-pick">${(0, icons_js_1.icon)('upload')}Из файла</button>${t.lyrics ? `<button class="btn btn-soft sm btn-danger" id="ly-del">${(0, icons_js_1.icon)('trash')}Удалить текст</button>` : ''}</div>`,
        actions: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: async () => { await (0, lyrics_auto_js_1.setManualLyrics)(t, document.getElementById('ly-area').value); (0, ui_js_1.toast)('Текст сохранён'); } }],
        onMount: api => {
            const area = document.getElementById('ly-area'), file = document.getElementById('ly-file');
            document.getElementById('ly-pick').onclick = () => file.click();
            file.onchange = async () => {
                const f = file.files[0];
                if (f)
                    area.value = await f.text();
            };
            const d = document.getElementById('ly-del');
            if (d)
                d.onclick = async () => { await (0, lyrics_auto_js_1.setManualLyrics)(t, ''); (0, ui_js_1.toast)('Текст удалён', 'info'); api.close?.(); };
        } });
}
// Времена слов внутри строки: если в .lrc есть метки слов — берём их, иначе делим строку пропорционально длине слов
function wordTimes(i) {
    const l = lines[i], next = lines[i + 1], ws = l.text.split(' ');
    const gap = next ? next.t - l.t : 6;
    // метки слов уже есть (enhanced LRC или выравнивание по звуку)
    if (l.words && l.words.length === ws.length)
        return l.words.map((w, k) => ({ a: w.t, b: w.b || (l.words[k + 1] ? l.words[k + 1].t : l.t + Math.min(gap, 4)), held: !!w.held }));
    const sing = (0, util_js_1.clamp)(l.text.length * 0.07 + 0.5, 1.2, 9), dur = Math.max(0.6, Math.min(sing, gap * 0.94));
    const wt = ws.map(w => Math.max(2, w.length)), sum = wt.reduce((x, y) => x + y, 0);
    let acc = 0;
    return wt.map(w => { const a = l.t + dur * acc / sum; acc += w; return { a, b: l.t + dur * acc / sum, held: false }; });
}
function updateLyrics(t, force) {
    if (lyType !== 'synced' || !lines.length)
        return;
    t -= curOff;
    const idx = (0, lrc_js_1.activeLine)(lines, t + 0.12);
    if (idx !== lastIdx || force) {
        lastIdx = idx;
        lastWords = -1;
        wTimes = null;
        wLast = [];
        lyEls.forEach((el, i) => {
            el.classList.toggle('active', i === idx);
            el.classList.toggle('past', i < idx);
            el.classList.toggle('wordsync', !!(lines[i].words && lines[i].words.length === lines[i].text.split(' ').length));
            el.dataset.d = Math.min(Math.abs(i - idx), 5);
            if (i !== idx)
                el.querySelectorAll('.w').forEach(w => w.style.removeProperty('--wp'));
        });
        const el = lyEls[idx];
        if (el && npOpen && Date.now() > userScrollUntil)
            lyBox.scrollTo({ top: el.offsetTop - lyBox.clientHeight * 0.5 + el.offsetHeight / 2, behavior: force ? 'auto' : 'smooth' });
    }
    const el = lyEls[idx];
    if (!el || el.classList.contains('gap') || !el.classList.contains('wordsync'))
        return; // как в Spotify: светится строка; по словам — только если в .lrc есть метки слов
    const ws = el.querySelectorAll('.w');
    if (!wTimes)
        wTimes = wordTimes(idx);
    // подсвечивается только слово, которое поётся сейчас; спетые чуть светлее, будущие приглушены
    let cur = -1;
    for (let k = 0; k < ws.length && wTimes[k]; k++)
        if (t >= wTimes[k].a)
            cur = k;
    if (cur !== wLast[0]) {
        wLast[0] = cur;
        ws.forEach((w, k) => { w.classList.toggle('cur', k === cur); w.classList.toggle('sung', k < cur); w.classList.toggle('held', k === cur && !!wTimes[k].held); });
    }
}
['wheel', 'touchmove'].forEach(ev => lyBox.addEventListener(ev, () => { userScrollUntil = Date.now() + 3500; }, { passive: true }));
lyBox.addEventListener('click', e => {
    if (e.target.closest('[data-ly="edit"]')) {
        editLyrics();
        return;
    }
    const p = e.target.closest('.ly');
    if (!p)
        return;
    const l = lines[+p.dataset.i];
    if (!l)
        return;
    (0, player_js_1.seek)(l.t);
    userScrollUntil = 0;
    if (player_js_1.audio.paused)
        (0, player_js_1.toggle)();
});
// ---------- Очередь ----------
function qRow(id, i, kind) {
    const t = (0, state_js_1.getTrack)(id);
    if (!t)
        return '';
    return `<div class="q-row ${kind}" data-qi="${i}" tabindex="0" role="button">
    <div class="q-cov">${(0, views_js_1.cov)(t.cover, t._albumKey || t.id)}${kind === 'now' ? '<span class="q-eq"><span class="eq"><i></i><i></i><i></i></span></span>' : ''}</div>
    <div class="q-text"><b>${(0, util_js_1.esc)(t.title)}</b><span>${(0, util_js_1.esc)((0, views_js_1.artistsOf)(t).join(', '))}</span></div>
    <span class="q-time">${(0, util_js_1.fmtTime)(t.duration)}</span>
    <button class="icon-btn sm" data-qremove="${i}" aria-label="Убрать из очереди">${(0, icons_js_1.icon)('close')}</button></div>`;
}
function renderQueue() {
    const q = player_js_1.P.queue;
    if (!q.length) {
        qBox.innerHTML = `<div class="ly-empty">${(0, icons_js_1.icon)('queue')}<h3>Очередь пуста</h3><p>Запустите альбом, плейлист или трек — они появятся здесь.</p></div>`;
        return;
    }
    const before = q.slice(Math.max(0, player_js_1.P.idx - 15), player_js_1.P.idx), after = q.slice(player_js_1.P.idx + 1);
    qBox.innerHTML = `<div class="q-head"><h3>Очередь</h3><div class="q-tools">
      <button class="icon-btn ${player_js_1.P.shuffle ? 'on' : ''}" data-act="shuffle" aria-label="Перемешать">${(0, icons_js_1.icon)('shuffle')}</button>
      <button class="icon-btn ${player_js_1.P.repeat !== 'off' ? 'on' : ''}" data-act="repeat" aria-label="Повтор">${(0, icons_js_1.icon)(player_js_1.P.repeat === 'one' ? 'repeat-one' : 'repeat')}</button>
      ${after.length ? '<button class="btn btn-soft sm" data-qclear>Очистить</button>' : ''}</div></div>
    ${before.length ? `<div class="q-label">Ранее</div>${before.map((id, k) => qRow(id, player_js_1.P.idx - before.length + k, 'past')).join('')}` : ''}
    <div class="q-label">Сейчас играет</div>${qRow(q[player_js_1.P.idx], player_js_1.P.idx, 'now')}
    <div class="q-label">Далее${after.length ? ` · ${after.length}` : ''}</div>${after.length ? after.map((id, k) => qRow(id, player_js_1.P.idx + 1 + k, 'next')).join('') : '<p class="hint">Дальше ничего нет. Добавьте треки через меню «⋯».</p>'}`;
}
qBox.addEventListener('click', e => {
    if (e.target.closest('[data-qclear]'))
        return (0, player_js_1.clearUpcoming)();
    const rm = e.target.closest('[data-qremove]');
    if (rm) {
        e.stopPropagation();
        return (0, player_js_1.removeFromQueue)(+rm.dataset.qremove);
    }
    const act = e.target.closest('[data-act]');
    if (act)
        return act.dataset.act === 'shuffle' ? (0, player_js_1.toggleShuffle)() : (0, player_js_1.cycleRepeat)();
    const row = e.target.closest('[data-qi]');
    if (row)
        (0, player_js_1.playTrackInQueue)(+row.dataset.qi);
});
qBox.addEventListener('keydown', e => {
    if (e.key === 'Enter')
        e.target.closest?.('[data-qi]')?.click();
});
// ---------- Визуализатор ----------
const cv = (0, util_js_1.$)('#np-viz'), g = cv.getContext('2d');
const BARS = 56;
const levels = new Float32Array(BARS);
let freq = null, accent = '#F5F5F7', dpr = 1;
function sizeViz() { dpr = Math.min(2, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); }
new ResizeObserver(sizeViz).observe(cv);
function drawViz() {
    const an = (0, player_js_1.getAnalyser)(), w = cv.width, h = cv.height;
    let any = false;
    if (an && (0, player_js_1.isPlaying)()) {
        if (!freq)
            freq = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(freq);
    }
    else
        freq = null;
    g.clearRect(0, 0, w, h);
    const usable = (an ? an.frequencyBinCount : 256) * 0.62, gap = 3 * dpr, bw = (w - gap * (BARS - 1)) / BARS;
    if (bw <= 0)
        return false;
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, accent + '55');
    grad.addColorStop(1, accent);
    g.fillStyle = grad;
    for (let i = 0; i < BARS; i++) {
        let target = 0;
        if (freq) {
            const a = Math.floor(Math.pow(i / BARS, 1.7) * usable), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / BARS, 1.7) * usable));
            let s = 0;
            for (let k = a; k < b; k++)
                s += freq[k];
            target = s / (b - a) / 255;
            target = Math.pow(target, 1.25) * (0.75 + 0.5 * (i / BARS));
        }
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.55 : 0.12);
        if (levels[i] > 0.01)
            any = true;
        const bh = Math.max(3 * dpr, (0, util_js_1.clamp)(levels[i], 0, 1) * h), x = i * (bw + gap);
        g.beginPath();
        g.roundRect(x, h - bh, bw, bh, Math.min(bw / 2, 4 * dpr));
        g.fill();
    }
    return any;
}
const readAccent = () => { accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent; };
// ---------- главный цикл ----------
let raf = 0;
function frame() {
    const t = player_js_1.audio.currentTime, d = player_js_1.audio.duration || 0;
    if (!dragging) {
        const v = d ? Math.round((t / d) * 1000) : 0;
        for (const s of [miniSeek, npSeek]) {
            s.value = v;
            paint(s);
        }
        (0, util_js_1.$)('#mini-cur').textContent = (0, util_js_1.$)('#np-cur').textContent = (0, util_js_1.fmtTime)(t);
    }
    (0, util_js_1.$)('#mini-thin-fill').style.width = (d ? (t / d) * 100 : 0) + '%';
    if (npOpen) {
        updateLyrics(t);
        return state_js_1.state.settings.visualizer ? drawViz() : false;
    }
    return false;
}
function startLoop() {
    if (raf)
        return;
    const loop = () => { const more = frame(); raf = (0, player_js_1.isPlaying)() || more ? requestAnimationFrame(loop) : 0; };
    raf = requestAnimationFrame(loop);
}
// ---------- открытие / закрытие ----------
const lyricsOn = () => state_js_1.state.settings.showLyrics !== false;
function setPane(p) {
    if (p === 'lyrics' && !lyricsOn())
        p = 'player';
    const changed = np.dataset.pane !== p;
    if (changed && p === 'lyrics' && (0, player_js_1.current)())
        (0, lyrics_auto_js_1.ensureLyrics)((0, player_js_1.current)(), { retryMiss: true });
    np.dataset.pane = p;
    if (changed && npOpen)
        (0, motion_js_1.revealElement)(np.querySelector(p === 'queue' ? '.pane-queue' : p === 'lyrics' ? '.pane-lyrics' : '.np-player'), { distance: 0, duration: 280 });
    (0, util_js_1.$)('#np-pane-toggle')?.classList.toggle('on', p !== 'player');
}
// Режим «без текста»: правая часть гаснет, плеер плавно переезжает в центр
function centerShift() {
    const body = np.querySelector('.np-body'), side = np.querySelector('.np-side');
    if (!body || !side)
        return;
    const gap = parseFloat(getComputedStyle(body).columnGap) || 0;
    body.style.setProperty('--shift', isDesktop() ? ((side.offsetWidth + gap) / 2).toFixed(1) + 'px' : '0px');
}
function applyLyricsMode(redo) {
    const on = lyricsOn();
    centerShift();
    np.classList.toggle('nolyr', !on);
    const b = (0, util_js_1.$)('#np-lyr-toggle');
    if (b) {
        if (isDesktop())
            b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
        b.setAttribute('aria-label', on ? 'Скрыть текст' : 'Показать текст');
        b.title = b.getAttribute('aria-label');
    }
    setPane(np.dataset.pane === 'lyrics' && !on ? 'player' : np.dataset.pane);
    if (on && redo && (0, player_js_1.current)()) {
        renderLyrics((0, player_js_1.current)());
        updateLyrics(player_js_1.audio.currentTime, true);
    }
}
function openNP(pane) {
    if (!(0, player_js_1.current)())
        return;
    (0, lyrics_auto_js_1.ensureLyrics)((0, player_js_1.current)(), { retryMiss: true });
    renderLyrics((0, player_js_1.current)());
    if (pane)
        setPane(pane);
    else
        setPane(isDesktop() ? np.dataset.pane : 'player'); // на телефоне плеер открывается с обложки
    npOpen = true;
    np.classList.add('open');
    np.setAttribute('aria-hidden', 'false');
    document.body.classList.add('np-open');
    readAccent();
    sizeViz();
    updateLyrics(player_js_1.audio.currentTime, true);
    startLoop();
    frame();
    setTimeout(() => (0, util_js_1.$)('#np-close').focus({ preventScroll: true }), 300);
}
function closeNP() {
    if (!npOpen)
        return false;
    npOpen = false;
    np.classList.remove('open');
    np.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('np-open');
    return true;
}
const isNPOpen = () => npOpen;
exports.isNPOpen = isNPOpen;
addEventListener('resize', () => { setPane(np.dataset.pane); centerShift(); });
// ---------- init ----------
function initPlayerUI() {
    initIcons();
    (0, util_js_1.$)('#np-lyr-toggle').innerHTML = (0, icons_js_1.icon)('lyrics');
    bindSeek(miniSeek);
    bindSeek(npSeek);
    bindVol(miniVol);
    if ((0, miniwin_js_1.canMiniWindow)() && (0, util_js_1.$)('#m-pip'))
        (0, util_js_1.$)('#m-pip').hidden = false;
    bindVol(npVol);
    setPane('player');
    syncModes();
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || b.closest('#np-queue'))
            return;
        switch (b.dataset.act) {
            case 'toggle':
                e.stopPropagation();
                (0, player_js_1.toggle)();
                break;
            case 'next':
                e.stopPropagation();
                (0, player_js_1.next)();
                break;
            case 'prev':
                (0, player_js_1.prev)();
                break;
            case 'shuffle':
                (0, player_js_1.toggleShuffle)();
                break;
            case 'repeat':
                (0, player_js_1.cycleRepeat)();
                break;
            case 'mute':
                (0, player_js_1.toggleMute)();
                break;
            case 'like': {
                const t = (0, player_js_1.current)();
                if (t)
                    (0, state_js_1.toggleLike)(t.id);
                break;
            }
            case 'open':
                openNP('player');
                break;
            case 'mini-window':
                (0, miniwin_js_1.toggleMiniWindow)();
                break;
            case 'open-lyrics':
                openNP('lyrics');
                break;
            case 'open-queue':
                if (npOpen && np.dataset.pane === 'queue')
                    setPane(isDesktop() ? 'lyrics' : 'player');
                else if (npOpen)
                    setPane('queue');
                else
                    openNP('queue');
                break;
            default: break;
        }
    });
    (0, util_js_1.$)('#mini-open').addEventListener('click', e => {
        if (e.target.closest('input,a'))
            return;
        openNP();
    });
    (0, util_js_1.$)('#mini-open').addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target === e.currentTarget)
            openNP();
    });
    (0, util_js_1.$)('#np-close').addEventListener('click', closeNP);
    // на телефоне: кнопка вверху справа переключает плеер ↔ текст (из очереди — обратно к плееру)
    (0, util_js_1.$)('#np-pane-toggle').addEventListener('click', () => {
        setPane(np.dataset.pane === 'player' ? 'lyrics' : 'player');
        if (np.dataset.pane === 'lyrics')
            updateLyrics(player_js_1.audio.currentTime, true);
    });
    // текст и обложка трека (карандаш рядом с лайком)
    (0, util_js_1.$)('#np-edit').addEventListener('click', e => {
        const t = (0, player_js_1.current)();
        if (!t)
            return;
        (0, ui_js_1.openMenu)(e.currentTarget, [
            { icon: 'lyrics', label: t.lyrics ? 'Изменить текст' : 'Добавить текст', onClick: () => editLyrics() },
            ...((0, lyrics_auto_js_1.isFoundOnline)(t.lyrics) ? [{ icon: 'close', label: 'Это не тот текст', onClick: async () => {
                        (0, ui_js_1.toast)('Ищу другой текст…', 'info', 2000);
                        const ok = await (0, lyrics_auto_js_1.rejectLyrics)(t);
                        (0, ui_js_1.toast)(ok ? 'Нашёл другой вариант' : 'Другого текста не нашлось — можно добавить свой через карандаш', ok ? 'info' : 'warn');
                    } }] : []),
            { icon: 'upload', label: 'Обложка трека…', onClick: async () => {
                    const url = await (0, ui_js_1.pickImage)();
                    if (url) {
                        (0, state_js_1.setTrackCover)(t.id, url);
                        (0, ui_js_1.toast)('Обложка трека обновлена');
                    }
                } },
            ...((0, state_js_1.hasOwnCover)(t.id) ? [{ icon: 'refresh', label: 'Вернуть обложку из файла', onClick: () => (0, state_js_1.setTrackCover)(t.id, null) }] : []),
        ]);
    });
    (0, util_js_1.$)('#np-lyr-toggle').addEventListener('click', () => {
        if (!isDesktop()) { // на телефоне — к тексту
            setPane('lyrics');
            updateLyrics(player_js_1.audio.currentTime, true);
            return;
        }
        state_js_1.state.settings.showLyrics = !lyricsOn();
        (0, state_js_1.save)();
        (0, state_js_1.emit)('settings', 'showLyrics');
    });
    (0, state_js_1.on)('settings', k => {
        if (k === 'showLyrics' || k === 'all')
            applyLyricsMode(true);
    });
    applyLyricsMode(false);
    (0, util_js_1.$)('#np-more').addEventListener('click', e => {
        const t = (0, player_js_1.current)();
        if (!t)
            return;
        const qOpen = np.dataset.pane === 'queue';
        const extra = [{ icon: 'queue', label: qOpen ? 'Скрыть очередь' : 'Очередь', onClick: () => setPane(qOpen ? (isDesktop() && lyricsOn() ? 'lyrics' : 'player') : 'queue') }];
        if ((0, translate_js_1.canTranslate)(t.lyrics))
            extra.push({ icon: 'translate', label: state_js_1.state.settings.lyTranslate ? 'Скрыть перевод' : 'Перевод текста', onClick: () => {
                    state_js_1.state.settings.lyTranslate = !state_js_1.state.settings.lyTranslate;
                    (0, state_js_1.save)();
                    renderLyrics(t);
                    updateLyrics(player_js_1.audio.currentTime, true);
                } });
        (0, actions_js_1.trackMenu)(e.currentTarget, t.id, { np: true, extra });
    });
    // свайп вниз по Now Playing на мобильных
    let y0 = null;
    np.addEventListener('touchstart', e => { y0 = e.target.closest('.pane') ? null : e.touches[0].clientY; }, { passive: true });
    np.addEventListener('touchend', e => {
        if (y0 != null && e.changedTouches[0].clientY - y0 > 110)
            closeNP();
        y0 = null;
    }, { passive: true });
    (0, state_js_1.on)('track', renderTrack);
    // перевод загрузился — перерисовываем текст, если это всё ещё та же песня
    (0, state_js_1.on)('translation', t => {
        if ((0, player_js_1.current)()?.id === t.id) {
            renderLyrics(t);
            updateLyrics(player_js_1.audio.currentTime, true);
        }
    });
    (0, state_js_1.on)('translation-error', () => (0, ui_js_1.toast)('Перевод сейчас недоступен (лимит бесплатного сервиса — несколько песен в день)', 'warn'));
    // своя обложка поменялась — обновляем плеер, фон и мини-плеер
    (0, state_js_1.on)('covers', () => {
        (0, state_js_1.derived)();
        const t = (0, player_js_1.current)();
        if (t)
            (0, state_js_1.emit)('track', t);
    });
    (0, state_js_1.on)('track-meta', t => {
        (0, state_js_1.derived)();
        if ((0, player_js_1.current)()?.id === t.id)
            (0, state_js_1.emit)('track', t);
    });
    (0, state_js_1.on)('state', syncPlay);
    (0, state_js_1.on)('modes', syncModes);
    (0, state_js_1.on)('queue', renderQueue);
    (0, state_js_1.on)('volume', syncVolume);
    (0, state_js_1.on)('meta', syncMeta);
    (0, state_js_1.on)('seeked', () => { frame(); updateLyrics(player_js_1.audio.currentTime, true); });
    (0, state_js_1.on)('likes', syncLikeBtns);
    (0, state_js_1.on)('theme', () => { syncTheme(); readAccent(); });
    (0, state_js_1.on)('lyrics', t => {
        if ((0, player_js_1.current)()?.id === t.id) {
            renderTrack(t);
        }
    });
    (0, state_js_1.on)('lyrics-state', t => {
        if ((0, player_js_1.current)()?.id === t.id && !t.lyrics)
            renderLyrics(t);
    });
    syncPlay();
}
lyBox.addEventListener('click', e => {
    if (!e.target.closest('[data-ly="retry"]') || !(0, player_js_1.current)())
        return;
    (0, player_js_1.current)()._lyAttempt = 0;
    (0, lyrics_auto_js_1.ensureLyrics)((0, player_js_1.current)(), { retryMiss: true });
});

};
defs["player.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleepState = exports.isPlaying = exports.normInfo = exports.current = exports.eqGains = exports.EQ_PRESETS = exports.EQ_BANDS = exports.getAnalyser = exports.P = exports.audio = void 0;
exports.playList = playList;
exports.playTrackInQueue = playTrackInQueue;
exports.toggle = toggle;
exports.next = next;
exports.prev = prev;
exports.seek = seek;
exports.seekBy = seekBy;
exports.setVolume = setVolume;
exports.toggleMute = toggleMute;
exports.toggleShuffle = toggleShuffle;
exports.cycleRepeat = cycleRepeat;
exports.addNext = addNext;
exports.addToQueue = addToQueue;
exports.removeFromQueue = removeFromQueue;
exports.clearUpcoming = clearUpcoming;
exports.stop = stop;
exports.purge = purge;
exports.setSpeed = setSpeed;
exports.setSleep = setSleep;
const state_js_1 = require("./state.js");
const util_js_1 = require("./util.js");
const loudness_js_1 = require("./loudness.js");
exports.audio = new Audio();
exports.audio.preload = 'auto';
exports.P = {
    queue: [], // id[] в порядке воспроизведения
    orig: null, // исходный порядок (когда включён shuffle)
    idx: -1,
    shuffle: false,
    repeat: 'off', // off | all | one
    muted: false,
};
let actx, analyser, fadeGain, normGain, eqNodes = [];
const getAnalyser = () => analyser;
exports.getAnalyser = getAnalyser;
// ---------- эквалайзер: 6 полос ----------
exports.EQ_BANDS = [60, 230, 910, 3600, 9000, 14000];
exports.EQ_PRESETS = {
    flat: { name: 'Без изменений', g: [0, 0, 0, 0, 0, 0] },
    bass: { name: 'Больше баса', g: [6, 4, 1, 0, 0, 0] },
    vocal: { name: 'Голос', g: [-2, -1, 2, 4, 2, 0] },
    treble: { name: 'Больше высоких', g: [0, 0, 0, 1, 4, 6] },
    loud: { name: 'Громко и ярко', g: [5, 2, -1, 0, 3, 5] },
    soft: { name: 'Мягко', g: [1, 1, 0, -2, -3, -4] },
};
const eqGains = () => (state_js_1.state.settings.eq === 'custom' ? state_js_1.state.settings.eqCustom : (exports.EQ_PRESETS[state_js_1.state.settings.eq] || exports.EQ_PRESETS.flat).g) || exports.EQ_PRESETS.flat.g;
exports.eqGains = eqGains;
function applyEq() {
    const g = (0, exports.eqGains)();
    eqNodes.forEach((n, i) => { n.gain.value = g[i] || 0; });
}
const current = () => (0, state_js_1.getTrack)(exports.P.queue[exports.P.idx]) || null;
exports.current = current;
// ---------- одинаковая громкость ----------
const normOn = () => state_js_1.state.settings.normalize !== false;
const normDb = t => {
    if (!normOn() || !t)
        return 0;
    const g = (0, loudness_js_1.gainFor)(t.id);
    return g == null ? Math.min(0, (0, loudness_js_1.guessGain)()) : g;
};
const lin = db => Math.pow(10, db / 20);
// ramp — за сколько секунд плавно перейти к новой громкости (0 — сразу, для начала песни)
function applyNorm(ramp = 0) {
    if (!normGain || !actx)
        return;
    const v = lin(normDb((0, exports.current)())), now = actx.currentTime;
    normGain.gain.cancelScheduledValues(now);
    if (ramp)
        normGain.gain.setTargetAtTime(v, now, ramp / 3);
    else
        normGain.gain.setValueAtTime(v, now);
}
const normInfo = () => ({ on: normOn(), db: normDb((0, exports.current)()), measured: !!(0, exports.current)() && (0, loudness_js_1.gainFor)((0, exports.current)().id) != null, node: normGain ? normGain.gain.value : null });
exports.normInfo = normInfo;
// измеряем играющую песню и заранее — следующую, чтобы она сразу началась с нужной громкостью
async function normTrack() {
    if (!normOn())
        return;
    await (0, loudness_js_1.loadLoud)();
    const t = (0, exports.current)();
    if (!t)
        return;
    if ((0, loudness_js_1.gainFor)(t.id) == null) {
        await (0, loudness_js_1.measure)(t);
        if ((0, exports.current)() === t)
            applyNorm(1.2);
    }
    const ni = nextIndex(), nx = ni >= 0 ? (0, state_js_1.getTrack)(exports.P.queue[ni]) : null;
    if (nx && (0, loudness_js_1.gainFor)(nx.id) == null)
        setTimeout(() => {
            if ((0, exports.current)() === t)
                (0, loudness_js_1.measure)(nx);
        }, 4000);
}
(0, state_js_1.on)('track', () => { normTrack(); });
(0, state_js_1.on)('settings', k => {
    if (k === 'normalize' || k === 'all') {
        applyNorm(0.4);
        normTrack();
    }
});
const isPlaying = () => !exports.audio.paused && !exports.audio.ended;
exports.isPlaying = isPlaying;
function ensureGraph() {
    if (actx) {
        if (actx.state === 'suspended')
            actx.resume();
        return;
    }
    try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = actx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        const src = actx.createMediaElementSource(exports.audio);
        // звук → эквалайзер → громкость перехода → выравнивание громкости → анализатор (спектр) → колонки
        eqNodes = exports.EQ_BANDS.map((f, i) => {
            const n = actx.createBiquadFilter();
            n.type = i === 0 ? 'lowshelf' : i === exports.EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
            n.frequency.value = f;
            n.Q.value = 1.1;
            return n;
        });
        fadeGain = actx.createGain();
        let node = src;
        for (const n of eqNodes) {
            node.connect(n);
            node = n;
        }
        node.connect(fadeGain);
        normGain = actx.createGain();
        fadeGain.connect(normGain);
        normGain.connect(analyser);
        analyser.connect(actx.destination);
        applyEq();
        applyNorm(0);
        if (actx.state === 'suspended')
            actx.resume();
    }
    catch (e) {
        console.warn('WebAudio недоступен', e);
        actx = null;
    }
}
(0, state_js_1.on)('settings', k => {
    if (k === 'eq' || k === 'eqCustom' || k === 'all') {
        if ((0, exports.eqGains)().some(Boolean))
            ensureGraph();
        applyEq();
    }
});
// ---------- переход между треками ----------
// Плавный: старый трек доигрывает в отдельном «призрачном» плеере и затихает, новый — нарастает.
// «Без пауз»: следующий трек заранее подгружается и включается ровно в момент окончания текущего.
let fading = null, preload = null, lastLoadAt = 0;
// пауза от пользователя останавливает и затихающий трек (смена src сама вызывает pause — её пропускаем)
exports.audio.addEventListener('pause', () => {
    if (performance.now() - lastLoadAt > 400)
        stopFade();
});
function nextIndex() {
    if (exports.P.repeat === 'one')
        return -1;
    if (exports.P.idx + 1 < exports.P.queue.length)
        return exports.P.idx + 1;
    return exports.P.repeat === 'all' && exports.P.queue.length > 1 ? 0 : -1;
}
function stopFade() {
    if (!fading)
        return;
    clearInterval(fading.timer);
    fading.ghost.pause();
    fading.ghost.removeAttribute('src');
    fading = null;
    if (fadeGain && actx)
        fadeGain.gain.cancelScheduledValues(actx.currentTime), fadeGain.gain.value = 1;
}
function crossfade(sec) {
    const ni = nextIndex();
    if (ni < 0)
        return false;
    stopFade();
    const ghost = new Audio(exports.audio.currentSrc || exports.audio.src);
    ghost.playbackRate = exports.audio.playbackRate;
    ghost.currentTime = exports.audio.currentTime;
    const vol = (exports.P.muted ? 0 : state_js_1.state.volume) * Math.min(1, lin(normDb((0, exports.current)()))); // уходящая песня — с её поправкой громкости
    ghost.volume = vol;
    ghost.play().catch(() => { });
    const t0 = performance.now(), ms = sec * 1000;
    fading = { ghost, timer: setInterval(() => {
            const k = Math.min(1, (performance.now() - t0) / ms);
            ghost.volume = Math.max(0, vol * (1 - k));
            if (k >= 1 || ghost.ended)
                stopFade();
        }, 50) };
    const ghostRef = fading;
    exports.P.idx = ni;
    load(true, { fadeIn: sec });
    if (fading !== ghostRef) // load() не должен гасить только что запущенный переход
        fading = ghostRef;
    return true;
}
function warmNext() {
    const ni = nextIndex(), t = ni >= 0 ? (0, state_js_1.getTrack)(exports.P.queue[ni]) : null;
    if (!t || (preload && preload.id === t.id))
        return;
    preload = { id: t.id, el: new Audio() };
    preload.el.preload = 'auto';
    preload.el.src = t.url;
}
let gapRaf = 0;
function gaplessWatch() {
    cancelAnimationFrame(gapRaf);
    const tick = () => {
        if (exports.audio.paused || !isFinite(exports.audio.duration))
            return;
        const left = (exports.audio.duration - exports.audio.currentTime) / (exports.audio.playbackRate || 1);
        if (left <= 0.06 && nextIndex() >= 0 && !sleepEndOfTrack) {
            exports.P.idx = nextIndex();
            load();
            return;
        }
        gapRaf = requestAnimationFrame(tick);
    };
    gapRaf = requestAnimationFrame(tick);
}
exports.audio.addEventListener('timeupdate', () => {
    const tr = +state_js_1.state.settings.transition || 0;
    if (!tr || exports.audio.paused || !isFinite(exports.audio.duration) || fading)
        return;
    const left = (exports.audio.duration - exports.audio.currentTime) / (exports.audio.playbackRate || 1);
    if (left < 20)
        warmNext();
    if (tr === -1 && left < 1.2)
        gaplessWatch();
    else if (tr > 0 && left <= tr && exports.audio.duration > tr * 3 && !sleepEndOfTrack)
        crossfade(tr);
});
let counted = false;
function load(autoplay = true, { fadeIn = 0 } = {}) {
    const t = (0, exports.current)();
    if (!t)
        return;
    if (!fadeIn)
        stopFade();
    cancelAnimationFrame(gapRaf);
    lastLoadAt = performance.now();
    counted = false;
    exports.audio.src = t.url;
    exports.audio.defaultPlaybackRate = exports.audio.playbackRate = state_js_1.state.settings.speed || 1;
    exports.audio.currentTime = 0;
    (0, state_js_1.emit)('track', t);
    (0, state_js_1.emit)('queue');
    if (autoplay) {
        ensureGraph();
        applyNorm(0);
        if (fadeGain && actx) {
            fadeGain.gain.cancelScheduledValues(actx.currentTime);
            fadeGain.gain.setValueAtTime(fadeIn ? 0.0001 : 1, actx.currentTime);
            if (fadeIn)
                fadeGain.gain.linearRampToValueAtTime(1, actx.currentTime + fadeIn);
        }
        exports.audio.play().catch(err => {
            if (err.name !== 'AbortError')
                console.warn(err);
        });
    }
    (0, state_js_1.pushRecent)(t.id);
    updateMediaSession(t);
}
function playList(ids, start = 0, { shuffle } = {}) {
    ids = ids.filter(id => (0, state_js_1.getTrack)(id));
    if (!ids.length)
        return;
    if (shuffle !== undefined)
        exports.P.shuffle = shuffle;
    exports.P.orig = null;
    if (exports.P.shuffle) {
        exports.P.orig = ids.slice();
        const cur = ids[start];
        exports.P.queue = [cur, ...(0, util_js_1.shuffleArray)(ids.filter((_, i) => i !== start))];
        exports.P.idx = 0;
    }
    else {
        exports.P.queue = ids.slice();
        exports.P.idx = start;
    }
    (0, state_js_1.emit)('modes');
    load();
}
function playTrackInQueue(i) {
    if (i >= 0 && i < exports.P.queue.length) {
        exports.P.idx = i;
        load();
    }
}
function toggle() {
    if (!(0, exports.current)())
        return;
    ensureGraph();
    if (exports.audio.paused) {
        if (exports.audio.ended)
            exports.audio.currentTime = 0;
        exports.audio.play().catch(() => { });
    }
    else
        exports.audio.pause();
}
function next(auto = false) {
    if (!exports.P.queue.length)
        return;
    if (auto && exports.P.repeat === 'one') {
        exports.audio.currentTime = 0;
        exports.audio.play().catch(() => { });
        return;
    }
    if (exports.P.idx + 1 < exports.P.queue.length) {
        exports.P.idx++;
        load();
    }
    else if (exports.P.repeat === 'all') {
        exports.P.idx = 0;
        load();
    }
    else if (auto) {
        exports.audio.pause();
        exports.audio.currentTime = 0;
        (0, state_js_1.emit)('state');
    }
    else {
        exports.audio.currentTime = 0;
    }
}
function prev() {
    if (!exports.P.queue.length)
        return;
    if (exports.audio.currentTime > 3 || exports.P.idx === 0) {
        if (exports.P.idx === 0 && exports.P.repeat === 'all' && exports.audio.currentTime <= 3 && exports.P.queue.length > 1) {
            exports.P.idx = exports.P.queue.length - 1;
            load();
        }
        else
            exports.audio.currentTime = 0;
    }
    else {
        exports.P.idx--;
        load();
    }
}
function seek(t) {
    if (isFinite(exports.audio.duration))
        exports.audio.currentTime = (0, util_js_1.clamp)(t, 0, exports.audio.duration);
}
function seekBy(d) { seek(exports.audio.currentTime + d); }
function setVolume(v) {
    v = (0, util_js_1.clamp)(v, 0, 1);
    exports.audio.volume = v;
    state_js_1.state.volume = v;
    if (v > 0 && exports.P.muted) {
        exports.P.muted = false;
        exports.audio.muted = false;
    }
    (0, state_js_1.save)();
    (0, state_js_1.emit)('volume');
}
function toggleMute() { exports.P.muted = !exports.P.muted; exports.audio.muted = exports.P.muted; (0, state_js_1.emit)('volume'); }
function toggleShuffle() {
    exports.P.shuffle = !exports.P.shuffle;
    const cur = exports.P.queue[exports.P.idx];
    if (exports.P.shuffle) {
        exports.P.orig = exports.P.queue.slice();
        if (cur !== undefined)
            exports.P.queue = [cur, ...(0, util_js_1.shuffleArray)(exports.P.queue.filter((_, i) => i !== exports.P.idx))], exports.P.idx = 0;
    }
    else if (exports.P.orig) {
        const extra = exports.P.queue.filter(id => !exports.P.orig.includes(id));
        exports.P.queue = [...exports.P.orig.filter(id => (0, state_js_1.getTrack)(id)), ...extra];
        exports.P.idx = Math.max(0, exports.P.queue.indexOf(cur));
        exports.P.orig = null;
    }
    (0, state_js_1.emit)('modes');
    (0, state_js_1.emit)('queue');
}
function cycleRepeat() { exports.P.repeat = exports.P.repeat === 'off' ? 'all' : exports.P.repeat === 'all' ? 'one' : 'off'; (0, state_js_1.emit)('modes'); }
// ----- очередь -----
function addNext(ids) {
    ids = [].concat(ids).filter(id => (0, state_js_1.getTrack)(id));
    if (!ids.length)
        return;
    if (exports.P.idx < 0)
        return playList(ids, 0);
    exports.P.queue.splice(exports.P.idx + 1, 0, ...ids);
    if (exports.P.orig)
        exports.P.orig.push(...ids);
    (0, state_js_1.emit)('queue');
}
function addToQueue(ids) {
    ids = [].concat(ids).filter(id => (0, state_js_1.getTrack)(id));
    if (!ids.length)
        return;
    if (exports.P.idx < 0)
        return playList(ids, 0);
    exports.P.queue.push(...ids);
    if (exports.P.orig)
        exports.P.orig.push(...ids);
    (0, state_js_1.emit)('queue');
}
function removeFromQueue(i) {
    if (i < 0 || i >= exports.P.queue.length)
        return;
    const id = exports.P.queue[i];
    exports.P.queue.splice(i, 1);
    if (exports.P.orig) {
        const j = exports.P.orig.indexOf(id);
        if (j >= 0)
            exports.P.orig.splice(j, 1);
    }
    if (i < exports.P.idx)
        exports.P.idx--;
    else if (i === exports.P.idx) {
        if (!exports.P.queue.length) {
            stop();
            return;
        }
        if (exports.P.idx >= exports.P.queue.length)
            exports.P.idx = 0;
        load(!exports.audio.paused);
        return;
    }
    (0, state_js_1.emit)('queue');
}
function clearUpcoming() {
    if (exports.P.idx < 0)
        return;
    exports.P.queue.length = exports.P.idx + 1;
    if (exports.P.orig)
        exports.P.orig = exports.P.orig.filter(id => exports.P.queue.includes(id));
    (0, state_js_1.emit)('queue');
}
function stop() {
    exports.audio.pause();
    exports.audio.removeAttribute('src');
    exports.audio.load();
    exports.P.queue = [];
    exports.P.orig = null;
    exports.P.idx = -1;
    (0, state_js_1.emit)('track', null);
    (0, state_js_1.emit)('queue');
    (0, state_js_1.emit)('state');
    if ('mediaSession' in navigator)
        navigator.mediaSession.metadata = null;
}
// Трек удалён из библиотеки
function purge(ids) {
    const set = new Set(ids);
    const cur = exports.P.queue[exports.P.idx];
    if (set.has(cur)) {
        stop();
        return;
    }
    exports.P.queue = exports.P.queue.filter(id => !set.has(id));
    if (exports.P.orig)
        exports.P.orig = exports.P.orig.filter(id => !set.has(id));
    exports.P.idx = exports.P.queue.indexOf(cur);
    (0, state_js_1.emit)('queue');
}
// ----- события audio -----
exports.audio.addEventListener('ended', () => {
    if (sleepEndOfTrack) {
        sleepEndOfTrack = false;
        (0, state_js_1.emit)('sleep');
        exports.audio.pause();
        return;
    }
    next(true);
});
// прослушивание засчитывается после 30 секунд (или половины короткого трека)
exports.audio.addEventListener('timeupdate', () => {
    if (counted)
        return;
    const t = (0, exports.current)();
    if (!t)
        return;
    if (exports.audio.currentTime >= Math.min(30, (exports.audio.duration || 60) * 0.5)) {
        counted = true;
        (0, state_js_1.bumpPlay)(t.id);
    }
});
exports.audio.addEventListener('play', () => { (0, state_js_1.emit)('state'); setPos(); });
exports.audio.addEventListener('pause', () => (0, state_js_1.emit)('state'));
exports.audio.addEventListener('loadedmetadata', () => { (0, state_js_1.emit)('meta'); setPos(); });
exports.audio.addEventListener('durationchange', () => (0, state_js_1.emit)('meta'));
exports.audio.addEventListener('seeked', () => { (0, state_js_1.emit)('seeked'); setPos(); });
exports.audio.addEventListener('error', () => {
    if (exports.audio.src) {
        (0, state_js_1.emit)('error', (0, exports.current)());
    }
});
// ----- Media Session (медиаклавиши, экран блокировки) -----
function updateMediaSession(t) {
    if (!('mediaSession' in navigator))
        return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist, album: t.album,
        artwork: t.cover ? [{ src: t.cover, sizes: '512x512', type: t.coverType || 'image/jpeg' }] : [],
    });
}
function setPos() {
    if (!('mediaSession' in navigator) || !isFinite(exports.audio.duration))
        return;
    try {
        navigator.mediaSession.setPositionState({ duration: exports.audio.duration, position: exports.audio.currentTime, playbackRate: exports.audio.playbackRate });
    }
    catch { /* ignore */ }
}
if ('mediaSession' in navigator) {
    const h = (a, f) => {
        try {
            navigator.mediaSession.setActionHandler(a, f);
        }
        catch { /* unsupported */ }
    };
    h('play', () => { if (exports.audio.paused)
        toggle(); });
    h('pause', () => { if (!exports.audio.paused)
        toggle(); });
    h('nexttrack', () => next());
    h('previoustrack', prev);
    h('seekto', d => seek(d.seekTime));
    h('seekbackward', () => seekBy(-10));
    h('seekforward', () => seekBy(10));
}
exports.audio.volume = state_js_1.state.volume;
// ----- скорость и таймер сна -----
function setSpeed(v) { exports.audio.defaultPlaybackRate = exports.audio.playbackRate = v; setPos(); }
let sleepTimer = 0, sleepEndOfTrack = false;
exports.sleepState = { until: 0, endOfTrack: false };
function setSleep(minutes) {
    clearTimeout(sleepTimer);
    sleepTimer = 0;
    sleepEndOfTrack = false;
    exports.sleepState.until = 0;
    exports.sleepState.endOfTrack = false;
    if (minutes === 'track') {
        sleepEndOfTrack = true;
        exports.sleepState.endOfTrack = true;
    }
    else if (minutes > 0) {
        exports.sleepState.until = Date.now() + minutes * 60000;
        sleepTimer = setTimeout(() => { exports.sleepState.until = 0; fadeOutAndPause(); (0, state_js_1.emit)('sleep'); }, minutes * 60000);
    }
    (0, state_js_1.emit)('sleep');
}
function fadeOutAndPause() {
    const v0 = exports.audio.volume;
    let k = 0;
    const iv = setInterval(() => {
        k++;
        exports.audio.volume = Math.max(0, v0 * (1 - k / 20));
        if (k >= 20) {
            clearInterval(iv);
            exports.audio.pause();
            exports.audio.volume = v0;
        }
    }, 100);
}

};
defs["state.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playlistTracks = exports.getTrack = exports.hasAlbumCover = exports.autoCovers = exports.hasOwnCover = exports.emit = exports.on = exports.state = exports.DEFAULT_SETTINGS = void 0;
exports.load = load;
exports.setTrackCover = setTrackCover;
exports.setAlbumCover = setAlbumCover;
exports.registerAutoCovers = registerAutoCovers;
exports.setCovers = setCovers;
exports.save = save;
exports.flushSave = flushSave;
exports.setSetting = setSetting;
exports.touchLibrary = touchLibrary;
exports.derived = derived;
exports.removeTracks = removeTracks;
exports.createPlaylist = createPlaylist;
exports.addToPlaylist = addToPlaylist;
exports.removeFromPlaylist = removeFromPlaylist;
exports.renamePlaylist = renamePlaylist;
exports.deletePlaylist = deletePlaylist;
exports.toggleLike = toggleLike;
exports.pushRecent = pushRecent;
exports.bumpPlay = bumpPlay;
exports.setTagEdit = setTagEdit;
exports.saveSmart = saveSmart;
exports.deleteSmart = deleteSmart;
exports.lastPlayed = lastPlayed;
exports.smartTracks = smartTracks;
exports.likedTracks = likedTracks;
const util_js_1 = require("./util.js");
const artists_js_1 = require("./artists.js");
const db_js_1 = require("./db.js");
const LS = 'puro.state.v1';
exports.DEFAULT_SETTINGS = {
    accent: 'white', // white | gold | rose | sky | mint | violet
    cardSize: 'm', // s | m | l
    homeView: 'rail', // rail | grid | list
    lyricsSize: 'm', // s | m | l
    lyTranslate: false, // перевод текста песни под строками
    autoLyrics: true, // искать тексты онлайн, если их нет в файле
    bgAnim: true, // плавающие «облака»
    splash: true, // заставка при запуске
    visualizer: true, // спектр в Now Playing
    speed: 1, // скорость воспроизведения
    transition: 0, // переход между треками: 0 — обычный, -1 — без пауз, N — плавный переход N секунд
    eq: 'flat', // эквалайзер: готовая настройка или 'custom'
    eqCustom: [0, 0, 0, 0, 0, 0], // свои значения полос, дБ
    bgCover: true, // свечение от обложки играющего трека
    stripSource: true, // убирать приписки сайтов из названий («(Sefon.Pro)» и т.п.)
    autoCovers: true, // искать обложки онлайн для песен и альбомов без обложки
    corners: 'round', // round | sharp — скругление обложек
    density: 'cozy', // cozy | compact — плотность списков
    anim: true, // анимации интерфейса
    seekStep: 5, // шаг перемотки стрелками, сек
    showLyrics: true, // показывать текст справа; выключено — плеер по центру
    lang: 'ru', // ru | en — язык интерфейса
    lyricsProxy: '', // адрес Cloudflare Worker для NetEase / Genius
    homeRecents: true, // блок «Недавно прослушанное» (старый выключатель; теперь см. homeHidden)
    normalize: true, // одинаковая громкость песен
    homeOrder: [], // порядок разделов главной (пусто — обычный)
    homeHidden: [], // скрытые разделы главной
    keepAwake: false, // не гасить экран во время музыки
};
exports.state = {
    playLog: [], // [id, когда, длительность] — журнал прослушиваний
    smart: [], // умные плейлисты: { id, name, rules }
    tagEdits: {}, // свои данные трека: id → { title, artist, album, year }
    covers: { t: {}, a: {} }, // свои обложки: t — трек → картинка, a — альбом → картинка
    tracks: new Map(), // id -> track
    playlists: [], // {id, name, ids[], created}
    likes: new Set(),
    recents: [], // id[]
    hidden: [], // песни из папки (Android), которые пользователь удалил: при пересканировании не возвращаются
    plays: {}, // id -> сколько раз прослушан
    profile: { name: 'Слушатель', username: 'listener', avatar: null, banner: null },
    settings: { ...exports.DEFAULT_SETTINGS },
    theme: 'dark',
    volume: 0.85,
    version: 0,
};
const handlers = {};
const on = (e, f) => ((handlers[e] || (handlers[e] = [])).push(f), f);
exports.on = on;
const emit = (e, ...a) => (handlers[e] || []).forEach(f => {
    try {
        f(...a);
    }
    catch (err) {
        console.error(err);
    }
});
exports.emit = emit;
function apply(s) {
    if (!s || typeof s !== 'object')
        return;
    if (Array.isArray(s.playlists))
        exports.state.playlists = s.playlists;
    if (Array.isArray(s.likes))
        exports.state.likes = new Set(s.likes);
    if (Array.isArray(s.hidden))
        exports.state.hidden = s.hidden;
    if (Array.isArray(s.recents))
        exports.state.recents = s.recents;
    if (s.plays && typeof s.plays === 'object')
        exports.state.plays = s.plays;
    if (s.profile)
        Object.assign(exports.state.profile, s.profile);
    if (s.settings)
        Object.assign(exports.state.settings, s.settings);
    if (s.theme)
        exports.state.theme = s.theme;
    if (typeof s.volume === 'number')
        exports.state.volume = s.volume;
    if (Array.isArray(s.playLog))
        exports.state.playLog = s.playLog;
    if (Array.isArray(s.smart))
        exports.state.smart = s.smart;
    if (s.tagEdits && typeof s.tagEdits === 'object')
        exports.state.tagEdits = s.tagEdits;
}
const snapshot = () => ({
    playlists: exports.state.playlists, likes: [...exports.state.likes], recents: exports.state.recents.slice(0, 30), hidden: exports.state.hidden, plays: exports.state.plays, playLog: exports.state.playLog, smart: exports.state.smart, tagEdits: exports.state.tagEdits,
    profile: exports.state.profile, settings: exports.state.settings, theme: exports.state.theme, volume: exports.state.volume, savedAt: Date.now(),
});
// Состояние хранится дважды: в localStorage (мгновенно) и в IndexedDB (надёжно сбрасывается на диск).
// При запуске берём более свежую копию — так «Недавно прослушанное» не пропадает после перезапуска.
async function load() {
    let a = null, b = null;
    try {
        a = JSON.parse(localStorage.getItem(LS) || 'null');
    }
    catch { /* ignore */ }
    try {
        b = await Promise.race([(0, db_js_1.kvGet)('state'), new Promise(r => setTimeout(() => r(null), 1500))]);
    }
    catch { /* ignore */ }
    const best = (a?.savedAt || 0) >= (b?.savedAt || 0) ? a : b;
    apply(best || a || b);
    try {
        const c = await Promise.race([(0, db_js_1.kvGet)('covers'), new Promise(r => setTimeout(() => r(null), 1500))]);
        if (c && typeof c === 'object')
            exports.state.covers = { t: c.t || {}, a: c.a || {} };
    }
    catch { /* ignore */ }
}
// ---------- свои обложки: для трека или для всего альбома (картинки хранятся в IndexedDB) ----------
function saveCovers() { (0, db_js_1.kvSet)('covers', exports.state.covers); touchLibrary(); (0, exports.emit)('covers'); }
function setTrackCover(id, url) {
    if (url)
        exports.state.covers.t[id] = url;
    else
        delete exports.state.covers.t[id];
    saveCovers();
}
function setAlbumCover(key, url) {
    const g = derived().groups.get(key);
    if (url) {
        exports.state.covers.a[key] = url;
        if (g) // обложка альбома заменяет и свои обложки отдельных треков этого альбома
            for (const t of g.tracks)
                delete exports.state.covers.t[t.id];
    }
    else
        delete exports.state.covers.a[key];
    saveCovers();
}
const hasOwnCover = id => !!exports.state.covers.t[id];
exports.hasOwnCover = hasOwnCover;
// найденные онлайн обложки (модуль covers-auto.js регистрирует их здесь, чтобы state не зависел от сети)
let autoSrc = null;
const autoCovers = () => (autoSrc ? autoSrc() : null);
exports.autoCovers = autoCovers;
function registerAutoCovers(fn) { autoSrc = fn; }
function setCovers(c) { exports.state.covers = { t: { ...(c.t || {}) }, a: { ...(c.a || {}) } }; saveCovers(); }
const hasAlbumCover = key => !!exports.state.covers.a[key];
exports.hasAlbumCover = hasAlbumCover;
let idbTimer = 0;
function save() {
    const snap = snapshot();
    try {
        localStorage.setItem(LS, JSON.stringify(snap));
    }
    catch (e) {
        console.warn('Не удалось сохранить состояние', e);
    }
    clearTimeout(idbTimer);
    idbTimer = setTimeout(() => (0, db_js_1.kvSet)('state', snap), 250);
}
function flushSave() {
    clearTimeout(idbTimer);
    const snap = snapshot();
    try {
        localStorage.setItem(LS, JSON.stringify(snap));
    }
    catch { /* ignore */ }
    (0, db_js_1.kvSet)('state', snap);
}
function setSetting(k, v) { exports.state.settings[k] = v; save(); (0, exports.emit)('settings', k, v); }
// ---------- производные коллекции ----------
let cache = null, cacheVer = -1;
function touchLibrary() { exports.state.version++; cache = null; (0, exports.emit)('library'); }
const yearOf = g => parseInt(g.year, 10) || 0;
const newest = (a, b) => yearOf(b) - yearOf(a) || b.addedAt - a.addedAt;
function derived() {
    if (cache && cacheVer === exports.state.version)
        return cache;
    const groups = new Map(), artists = new Map();
    const all = [...exports.state.tracks.values()];
    // 0) свои правки данных трека (название, артист, альбом, год) поверх тегов из файла
    for (const t of all) {
        if (!t._orig)
            t._orig = { title: t.title, artist: t.artist, album: t.album, year: t.year, albumArtist: t.albumArtist };
        const own = exports.state.tagEdits[t.id] || {};
        Object.assign(t, t._orig, own);
        // убираем приписки сайтов, откуда скачан трек (кроме полей, которые пользователь задал сам)
        if (exports.state.settings.stripSource !== false)
            for (const k of ['title', 'artist', 'album', 'albumArtist'])
                if (!(k in own) && t[k]) {
                    const v = (0, util_js_1.stripSource)(t[k]);
                    t[k] = v || (k === 'title' ? t[k] : '');
                }
    }
    // 1) артисты каждого трека: «A & B», «A; B», «A feat. B» → отдельные артисты
    for (const t of all) {
        t._artists = (0, artists_js_1.trackArtists)(t);
        t._artistKeys = t._artists.map(artists_js_1.artistKey);
        t._artistKey = t._artistKeys[0];
    }
    // 2) релизы (альбомы / синглы)
    for (const t of all) {
        const tag = t.albumArtist ? (0, artists_js_1.splitArtists)(t.albumArtist) : [];
        const lead = tag[0] || t._artists[0];
        const key = t.album ? 'a:' + (0, util_js_1.norm)(lead) + '::' + (0, util_js_1.norm)(t.album) : 's:' + t.id;
        let g = groups.get(key);
        if (!g) {
            g = { key, name: t.album || t.title, year: t.year, genre: t.genre, tracks: [], cover: null, untitled: !t.album, addedAt: t.addedAt, tag };
            groups.set(key, g);
        }
        g.tracks.push(t);
        if (t._tagCover === undefined)
            t._tagCover = t.cover || null; // обложка из самого файла
        const ac = exports.state.settings.autoCovers !== false ? (0, exports.autoCovers)() : null;
        t.cover = exports.state.covers.t[t.id] || exports.state.covers.a[key] || t._tagCover || (ac && (ac.a[key] || ac.t[t.id])) || null;
        if (!g.cover && t.cover)
            g.cover = t.cover;
        if (!g.year && t.year)
            g.year = t.year;
        if (!g.genre && t.genre)
            g.genre = t.genre;
        g.addedAt = Math.max(g.addedAt, t.addedAt);
        t._albumKey = key;
    }
    // 3) основные исполнители релиза
    for (const g of groups.values()) {
        if (g.tag.length) {
            g.main = g.tag;
            g.artists = g.tag;
        }
        else if (g.tracks.length === 1) {
            g.main = [g.tracks[0]._artists[0]];
            g.artists = g.tracks[0]._artists;
        }
        else {
            const cnt = new Map(), names = new Map();
            for (const t of g.tracks)
                for (const n of t._artists) {
                    const k = (0, artists_js_1.artistKey)(n);
                    cnt.set(k, (cnt.get(k) || 0) + 1);
                    if (!names.has(k))
                        names.set(k, n);
                }
            const need = Math.ceil(g.tracks.length * 0.6);
            let ks = [...cnt].filter(([, c]) => c >= need).sort((a, b) => b[1] - a[1]).map(([k]) => k);
            if (!ks.length)
                ks = [g.tracks[0]._artistKeys[0]];
            g.main = ks.map(k => names.get(k));
            g.artists = g.main;
        }
        g.artist = g.artists.join(', ');
        g.mainKeys = new Set(g.main.map(artists_js_1.artistKey));
        g.artistKeys = g.artists.map(artists_js_1.artistKey);
    }
    // 4) артисты: свои релизы и «совместные» (где артист только участвует)
    for (const g of groups.values())
        for (const t of g.tracks)
            t._artists.forEach((name, i) => {
                const ak = t._artistKeys[i];
                let a = artists.get(ak);
                if (!a) {
                    a = { key: ak, name, tracks: [], own: new Set(), collab: new Set(), genres: new Set(), cover: null };
                    artists.set(ak, a);
                }
                a.tracks.push(t);
                (g.mainKeys.has(ak) ? a.own : a.collab).add(g);
                if (t.genre)
                    a.genres.add((0, util_js_1.norm)(t.genre));
            });
    const byNo = (a, b) => (a.discNo || 0) - (b.discNo || 0) || (a.trackNo || 0) - (b.trackNo || 0) || a.title.localeCompare(b.title, 'ru');
    for (const g of groups.values())
        g.tracks.sort(byNo);
    const cmp = (a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    const gl = [...groups.values()];
    const albums = gl.filter(g => g.tracks.length > 1).sort(cmp);
    const singles = gl.filter(g => g.tracks.length === 1).sort(cmp);
    const artistList = [...artists.values()].sort(cmp);
    for (const a of artistList) {
        a.own = [...a.own].sort(newest);
        a.collab = [...a.collab].sort(newest);
        a.groups = [...a.own, ...a.collab];
        // картинка артиста: его фото (найденное онлайн) или обложка его собственного релиза.
        // Обложку общего трека не берём — иначе у двух артистов одна и та же картинка.
        const acA = exports.state.settings.autoCovers !== false ? (0, exports.autoCovers)() : null;
        a.photo = (acA && acA.ar && acA.ar[a.key]) || null;
        a.cover = a.photo || a.own.find(g => g.cover)?.cover || null;
        a.backdrop = a.cover || a.collab.find(g => g.cover)?.cover || null;
    }
    const songs = all.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }));
    cache = { groups, artists, albums, singles, artistList, songs, all };
    cacheVer = exports.state.version;
    return cache;
}
// ---------- плейлисты / лайки / недавние ----------
const getTrack = id => exports.state.tracks.get(id);
exports.getTrack = getTrack;
// Удалить песни из медиатеки: из списков, плейлистов, понравившихся. Сам файл на устройстве не трогаем.
function removeTracks(ids) {
    const set = new Set(ids);
    let covers = false;
    for (const id of set) {
        const t = exports.state.tracks.get(id);
        if (!t)
            continue;
        try {
            if (t.url && !t.url.startsWith('/f/'))
                URL.revokeObjectURL(t.url);
        }
        catch { /* ignore */ }
        exports.state.tracks.delete(id);
        (0, db_js_1.delFile)(id);
        exports.state.likes.delete(id);
        delete exports.state.plays[id];
        delete exports.state.tagEdits[id];
        if (exports.state.covers.t[id]) {
            delete exports.state.covers.t[id];
            covers = true;
        }
        if (String(id).startsWith('n:') && !exports.state.hidden.includes(id))
            exports.state.hidden.push(id);
    }
    for (const p of exports.state.playlists)
        p.ids = p.ids.filter(id => !set.has(id));
    exports.state.recents = exports.state.recents.filter(id => !set.has(id));
    if (covers)
        (0, db_js_1.kvSet)('covers', exports.state.covers);
    save();
    touchLibrary();
    (0, exports.emit)('playlists');
    (0, exports.emit)('likes');
    (0, exports.emit)('recents');
}
const playlistTracks = p => p.ids.map(exports.getTrack).filter(Boolean);
exports.playlistTracks = playlistTracks;
function createPlaylist(name, ids = []) {
    const p = { id: (0, util_js_1.uid)(), name: name.trim() || 'Новый плейлист', ids: [...new Set(ids)], created: Date.now() };
    exports.state.playlists.push(p);
    save();
    (0, exports.emit)('playlists');
    return p;
}
function addToPlaylist(pid, ids) {
    const p = exports.state.playlists.find(x => x.id === pid);
    if (!p)
        return 0;
    let n = 0;
    for (const id of ids)
        if (!p.ids.includes(id)) {
            p.ids.push(id);
            n++;
        }
    save();
    (0, exports.emit)('playlists');
    return n;
}
function removeFromPlaylist(pid, id) {
    const p = exports.state.playlists.find(x => x.id === pid);
    if (!p)
        return;
    p.ids = p.ids.filter(x => x !== id);
    save();
    (0, exports.emit)('playlists');
}
function renamePlaylist(pid, name) {
    const p = exports.state.playlists.find(x => x.id === pid);
    if (!p)
        return;
    p.name = name.trim() || p.name;
    save();
    (0, exports.emit)('playlists');
}
function deletePlaylist(pid) { exports.state.playlists = exports.state.playlists.filter(x => x.id !== pid); save(); (0, exports.emit)('playlists'); }
function toggleLike(id) {
    const on_ = !exports.state.likes.has(id);
    on_ ? exports.state.likes.add(id) : exports.state.likes.delete(id);
    save();
    (0, exports.emit)('likes', id, on_);
    return on_;
}
function pushRecent(id) {
    exports.state.recents = [id, ...exports.state.recents.filter(x => x !== id)].slice(0, 30);
    save();
    (0, exports.emit)('recents');
}
// прослушивание: счётчик + запись в журнал (для «Итогов» и умных плейлистов); журнал — последние 5000 записей
function bumpPlay(id) {
    exports.state.plays[id] = (exports.state.plays[id] || 0) + 1;
    const t = (0, exports.getTrack)(id);
    exports.state.playLog.push([id, Date.now(), Math.round(t?.duration || 0)]);
    if (exports.state.playLog.length > 5000)
        exports.state.playLog.splice(0, exports.state.playLog.length - 5000);
    save();
    (0, exports.emit)('plays', id);
}
// ---------- умные плейлисты: собираются сами по правилам ----------
function setTagEdit(id, edit) {
    if (edit && Object.keys(edit).length)
        exports.state.tagEdits[id] = edit;
    else
        delete exports.state.tagEdits[id];
    save();
    touchLibrary();
    const t = (0, exports.getTrack)(id);
    if (t)
        (0, exports.emit)('track-meta', t);
}
function saveSmart(p) {
    const i = exports.state.smart.findIndex(x => x.id === p.id);
    if (i >= 0)
        exports.state.smart[i] = p;
    else
        exports.state.smart.push(p);
    save();
    (0, exports.emit)('playlists');
}
function deleteSmart(id) { exports.state.smart = exports.state.smart.filter(x => x.id !== id); save(); (0, exports.emit)('playlists'); }
function lastPlayed() {
    const m = new Map();
    for (const [id, at] of exports.state.playLog)
        m.set(id, at);
    return m;
}
function smartTracks(p) {
    const r = p.rules || {}, now = Date.now(), DAY = 864e5, last = lastPlayed();
    const has = (s, q) => String(s || '').toLowerCase().includes(String(q).toLowerCase().trim());
    let list = derived().all.filter(t => (!r.liked || exports.state.likes.has(t.id))
        && (!r.artist || has(t.artist, r.artist) || has(t.albumArtist, r.artist))
        && (!r.genre || has(t.genre, r.genre))
        && (!r.minPlays || (exports.state.plays[t.id] || 0) >= r.minPlays)
        && (!r.notPlayedDays || !last.has(t.id) || now - last.get(t.id) > r.notPlayedDays * DAY)
        && (!r.addedDays || now - (t.addedAt || 0) <= r.addedDays * DAY));
    const sorts = {
        random: () => (0, util_js_1.seededShuffle)(list, (0, util_js_1.hash)('smart:' + p.id) ^ util_js_1.SESSION_SEED),
        plays: () => list.sort((a, b) => (exports.state.plays[b.id] || 0) - (exports.state.plays[a.id] || 0)),
        added: () => list.sort((a, b) => b.addedAt - a.addedAt),
        title: () => list.sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' })),
    };
    list = (sorts[r.sort] || sorts.random)();
    return r.limit ? list.slice(0, r.limit) : list;
}
function likedTracks() { return [...exports.state.likes].map(exports.getTrack).filter(Boolean); }

};
defs["sync.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncNow = exports.canGoogle = exports.cloudReady = exports.pkeyOf = exports.sync = void 0;
exports.payload = payload;
exports.cloudLyricsGet = cloudLyricsGet;
exports.cloudLyricsPut = cloudLyricsPut;
exports.cloudLyricsDel = cloudLyricsDel;
exports.initSync = initSync;
exports.signInGoogle = signInGoogle;
exports.signInEmail = signInEmail;
exports.signOutSync = signOutSync;
const firebase_config_js_1 = require("./firebase-config.js");
const state_js_1 = require("./state.js");
const util_js_1 = require("./util.js");
const native_js_1 = require("./native.js");
const db_js_1 = require("./db.js");
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
const DEVICE = (() => {
    try {
        let d = localStorage.getItem('puro-device');
        if (!d)
            localStorage.setItem('puro-device', d = Math.random().toString(36).slice(2, 10));
        return d;
    }
    catch {
        return 'dev';
    }
})();
// не переносим то, что относится к конкретному устройству
const LOCAL_SETTINGS = ['keepAwake', 'lyricsProxy'];
exports.sync = { status: 'off', user: null, lastAt: 0, error: '' };
let F = null, A = null, auth = null, db = null, unsub = null, timer = 0, applying = false, uidNow = '';
const set = patch => { Object.assign(exports.sync, patch); (0, state_js_1.emit)('sync'); };
const metaKey = uid => 'puro-sync-' + uid;
const readMeta = uid => {
    try {
        return JSON.parse(localStorage.getItem(metaKey(uid)) || '{}');
    }
    catch {
        return {};
    }
};
const writeMeta = (uid, m) => {
    try {
        localStorage.setItem(metaKey(uid), JSON.stringify(m));
    }
    catch { /* ignore */ }
};
// ---------- переносимые ключи песен ----------
const pkeyOf = t => `${t.name}|${t.size}`;
exports.pkeyOf = pkeyOf;
function keyMaps() {
    const toP = new Map(), toId = new Map();
    for (const t of state_js_1.state.tracks.values()) {
        const p = (0, exports.pkeyOf)(t);
        toP.set(t.id, p);
        toId.set(p, t.id);
    }
    return { P: id => toP.get(id) || id, I: p => toId.get(p) || p };
}
const mapKeys = (o, f) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [f(k), v]));
// ---------- что отправляем ----------
function payload() {
    const { P } = keyMaps();
    const settings = { ...state_js_1.state.settings };
    for (const k of LOCAL_SETTINGS)
        delete settings[k];
    return {
        likes: [...state_js_1.state.likes].map(P).sort(),
        playlists: state_js_1.state.playlists.map(p => ({ id: p.id, name: p.name, created: p.created || 0, ids: p.ids.map(P) })),
        smart: state_js_1.state.smart,
        plays: mapKeys(Object.fromEntries(Object.entries(state_js_1.state.plays).filter(([, n]) => n > 0)), P),
        tagEdits: mapKeys(state_js_1.state.tagEdits, P),
        settings, theme: state_js_1.state.theme,
        profile: { name: state_js_1.state.profile.name, username: state_js_1.state.profile.username },
    };
}
// картинки: docId → { kind, key, data }
function localBlobs() {
    const { P } = keyMaps(), out = {};
    for (const [id, data] of Object.entries(state_js_1.state.covers.t))
        out['ct_' + (0, util_js_1.hash)(P(id)).toString(36)] = { kind: 'ct', key: P(id), data };
    for (const [key, data] of Object.entries(state_js_1.state.covers.a))
        out['ca_' + (0, util_js_1.hash)(key).toString(36)] = { kind: 'ca', key, data };
    if (state_js_1.state.profile.avatar)
        out.avatar = { kind: 'avatar', key: '', data: state_js_1.state.profile.avatar };
    if (state_js_1.state.profile.banner)
        out.banner = { kind: 'banner', key: '', data: state_js_1.state.profile.banner };
    return out;
}
const blobIndex = blobs => Object.fromEntries(Object.entries(blobs).map(([id, b]) => [id, (0, util_js_1.hash)(b.data).toString(36)]));
const fingerprint = () => (0, util_js_1.hash)(JSON.stringify(payload()) + JSON.stringify(blobIndex(localBlobs()))).toString(36);
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
            state_js_1.state.likes = new Set(R.likes.map(I));
        if (Array.isArray(R.playlists))
            state_js_1.state.playlists = R.playlists.map(p => ({ ...p, ids: (p.ids || []).map(I) }));
        if (Array.isArray(R.smart))
            state_js_1.state.smart = R.smart;
        if (R.plays)
            state_js_1.state.plays = mapKeys(R.plays, I);
        if (R.tagEdits)
            state_js_1.state.tagEdits = mapKeys(R.tagEdits, I);
        if (R.settings) {
            const keep = Object.fromEntries(LOCAL_SETTINGS.map(k => [k, state_js_1.state.settings[k]]));
            Object.assign(state_js_1.state.settings, R.settings, keep);
        }
        if (R.theme)
            state_js_1.state.theme = R.theme;
        if (R.profile) {
            if (R.profile.name)
                state_js_1.state.profile.name = R.profile.name;
            if (R.profile.username)
                state_js_1.state.profile.username = R.profile.username;
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
            state_js_1.state.covers = covers;
            await (0, db_js_1.kvSet)('covers', covers);
            state_js_1.state.profile.avatar = avatar;
            state_js_1.state.profile.banner = banner;
        }
        (0, state_js_1.save)();
        (0, state_js_1.touchLibrary)();
        (0, state_js_1.emit)('covers');
        (0, state_js_1.emit)('likes');
        (0, state_js_1.emit)('playlists');
        (0, state_js_1.emit)('settings', 'all');
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
    if (!firebase_config_js_1.firebaseConfig.apiKey)
        return false;
    const mock = typeof window !== 'undefined' && window.__puroFirebase; // для проверок
    const [app, au, fs] = mock ? mock : await Promise.all([importUrl(`${G}/firebase-app.js`), importUrl(`${G}/firebase-auth.js`), importUrl(`${G}/firebase-firestore.js`)]);
    const a = app.initializeApp(firebase_config_js_1.firebaseConfig, 'puro-player');
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
    unsub = F.onSnapshot(F.doc(db, 'sync', user.uid), s => {
        if (!applying && s.exists() && s.data().device !== DEVICE)
            reconcile(s.data());
    }, () => { });
    // свои изменения отправляем раз в несколько секунд, если что-то поменялось
    timer = setInterval(() => {
        if (!applying && fingerprint() !== readMeta(user.uid).fp)
            reconcile();
    }, 5000);
    // ник, занятый на сайте, — в профиль
    F.getDoc(F.doc(db, 'users', user.uid)).then(s => {
        const n = s.exists() && s.data().username;
        if (n && state_js_1.state.profile.username !== n) {
            state_js_1.state.profile.username = n;
            (0, state_js_1.save)();
            (0, state_js_1.emit)('settings', 'profile');
        }
    }).catch(() => { });
}
// На Android файлы могут появиться после синхронизации: привязываем все данные треков.
(0, state_js_1.on)('library', () => {
    if (applying || !uidNow)
        return;
    const { I } = keyMaps();
    let changed = false;
    const fix = id => {
        const n = I(id);
        if (n !== id)
            changed = true;
        return n;
    };
    state_js_1.state.likes = new Set([...state_js_1.state.likes].map(fix));
    for (const p of state_js_1.state.playlists)
        p.ids = p.ids.map(fix);
    state_js_1.state.plays = mapKeys(state_js_1.state.plays, fix);
    state_js_1.state.tagEdits = mapKeys(state_js_1.state.tagEdits, fix);
    state_js_1.state.covers.t = mapKeys(state_js_1.state.covers.t, fix);
    if (changed) {
        (0, state_js_1.save)();
        (0, db_js_1.kvSet)('covers', state_js_1.state.covers);
        (0, state_js_1.touchLibrary)();
    }
});
// ---------- тексты песен в аккаунте ----------
// Точно подобранный текст (совпали название и артист, либо его вписал сам пользователь) кладём в аккаунт,
// чтобы на другом устройстве и после очистки кэша он появлялся сразу, без нового поиска.
// Песня узнаётся по «артист + название + длина», поэтому текст подойдёт и к другому файлу той же песни.
// Отдельные документы читаются по одному, только когда текст нужен, — основную синхронизацию это не замедляет.
const lyDoc = key => 'ly_' + (0, util_js_1.hash)(key).toString(36) + (0, util_js_1.hash)([...key].reverse().join('')).toString(36);
const cloudReady = () => !!(uidNow && F);
exports.cloudReady = cloudReady;
async function cloudLyricsGet(key) {
    if (!(0, exports.cloudReady)())
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
async function cloudLyricsPut(key, ly) {
    if (!(0, exports.cloudReady)())
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
async function cloudLyricsDel(key) {
    if (!(0, exports.cloudReady)())
        return false;
    try {
        await F.deleteDoc(F.doc(db, 'sync', uidNow, 'blobs', lyDoc(key)));
        return true;
    }
    catch {
        return false;
    }
}
async function initSync() {
    try {
        // если раньше входили на этом устройстве — поднимаем Firebase сразу
        if (Object.keys(localStorage).some(k => k.startsWith('puro-sync-')))
            await loadFirebase();
    }
    catch { /* без интернета — синхронизации просто нет */ }
}
const canGoogle = () => !native_js_1.isNative && !(typeof window !== 'undefined' && window.PuroDesktop); // OAuth-popup не работает внутри нативных оболочек; доступен вход по почте.
exports.canGoogle = canGoogle;
async function signInGoogle() {
    set({ status: 'loading', error: '' });
    try {
        await loadFirebase();
        await A.signInWithPopup(auth, new A.GoogleAuthProvider());
    }
    catch (e) {
        set({ status: exports.sync.user ? 'in' : 'off', error: authError(e) });
    }
}
async function signInEmail(email, pass, create = false) {
    set({ status: 'loading', error: '' });
    try {
        await loadFirebase();
        await (create ? A.createUserWithEmailAndPassword : A.signInWithEmailAndPassword)(auth, email, pass);
        return true;
    }
    catch (e) {
        set({ status: exports.sync.user ? 'in' : 'off', error: authError(e) });
        return false;
    }
}
async function signOutSync() {
    if (auth)
        await A.signOut(auth);
}
const syncNow = () => reconcile();
exports.syncNow = syncNow;
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

};
defs["tagedit.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mbSearch = mbSearch;
exports.openTrackInfo = openTrackInfo;
const state_js_1 = require("./state.js");
const ui_js_1 = require("./ui.js");
const util_js_1 = require("./util.js");
const icons_js_1 = require("./icons.js");
// «Данные трека»: своё название, артист, альбом, год + поиск в MusicBrainz (открытая база музыки) с обложкой
// из Cover Art Archive. Файл не меняется — правки хранятся в плеере поверх тегов.
const MB = 'https://musicbrainz.org/ws/2';
const CAA = 'https://coverartarchive.org/release';
const q = s => String(s || '').replace(/["\\]/g, ' ').trim();
async function mbSearch(title, artist) {
    const parts = [`recording:"${q(title)}"`];
    if (q(artist))
        parts.push(`artist:"${q(artist)}"`);
    const r = await fetch(`${MB}/recording?${new URLSearchParams({ query: parts.join(' AND '), fmt: 'json', limit: '10' })}`, { headers: { Accept: 'application/json' } });
    if (!r.ok)
        throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const out = [];
    for (const rec of d.recordings || []) {
        const artistName = (rec['artist-credit'] || []).map(a => (a.name || a.artist?.name || '') + (a.joinphrase || '')).join('').trim();
        const rels = (rec.releases || []).slice().sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
        const rel = rels.find(x => x.status === 'Official') || rels[0];
        out.push({ id: rec.id, title: rec.title, artist: artistName, album: rel?.title || '', year: (rel?.date || rec['first-release-date'] || '').slice(0, 4),
            length: rec.length ? Math.round(rec.length / 1000) : 0, releaseId: rel?.id || '', score: rec.score || 0 });
    }
    return out;
}
// обложка → data URL (чтобы работала и без интернета); если браузер не дал прочитать — просто ссылка
async function coverData(releaseId) {
    const url = `${CAA}/${releaseId}/front-500`;
    try {
        const r = await fetch(url);
        if (!r.ok)
            return null;
        const b = await r.blob();
        return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(url); fr.readAsDataURL(b); });
    }
    catch {
        return url;
    }
}
function openTrackInfo(id) {
    const t = (0, state_js_1.getTrack)(id);
    if (!t)
        return;
    const g = (0, state_js_1.derived)().groups.get(t._albumKey);
    const inAlbum = g && g.tracks.length > 1;
    let pickedRelease = '';
    const field = (k, label) => `<label class="sm-field ${k === 'title' ? 'wide' : ''}"><span>${label}</span><input class="input" data-f="${k}" value="${(0, util_js_1.esc)(t[k] || '')}"></label>`;
    (0, ui_js_1.openModal)({
        title: 'Данные трека', wide: true,
        html: `<div class="sm-form">
      ${field('title', 'Название')}${field('artist', 'Артист')}${field('album', 'Альбом')}${field('year', 'Год')}
      <p class="ti-note wide">Файл не меняется — данные хранятся в плеере. Поиск текста песни пойдёт уже по новым данным.</p>
      <div class="ti-mb wide"><button class="btn btn-soft sm" id="ti-search">${(0, icons_js_1.icon)('search')}Найти в MusicBrainz</button><span id="ti-status"></span></div>
      <div class="ti-results wide" id="ti-results"></div>
      ${inAlbum ? `<label class="sm-check wide" id="ti-album-wrap" hidden><input type="checkbox" id="ti-album-cover" checked><span>Обложку — на весь альбом «${(0, util_js_1.esc)(g.name)}»</span></label>` : ''}
    </div>`,
        actions: [
            ...(state_js_1.state.tagEdits[id] ? [{ label: 'Вернуть из файла', onClick: () => { (0, state_js_1.setTagEdit)(id, null); (0, ui_js_1.toast)('Данные трека — снова из файла'); } }] : []),
            { label: 'Отмена' },
            { label: 'Сохранить', primary: true, onClick: async (api) => {
                    const v = {};
                    api.el.querySelectorAll('[data-f]').forEach(i => {
                        const k = i.dataset.f, val = i.value.trim();
                        if (val !== String(t._orig?.[k] || ''))
                            v[k] = val;
                    });
                    (0, state_js_1.setTagEdit)(id, v);
                    if (pickedRelease) {
                        const url = await coverData(pickedRelease);
                        if (url) {
                            const all = api.el.querySelector('#ti-album-cover');
                            if (all && all.checked && g)
                                (0, state_js_1.setAlbumCover)(g.key, url);
                            else
                                (0, state_js_1.setTrackCover)(id, url);
                        }
                    }
                    t.lyrics = null; // текст поищется заново по новым данным
                    t._ly = undefined;
                    (0, ui_js_1.toast)('Данные трека сохранены');
                } },
        ],
        onMount: api => {
            const $ = s => api.el.querySelector(s);
            $('#ti-search').addEventListener('click', async () => {
                const title = $('[data-f="title"]').value, artist = $('[data-f="artist"]').value;
                $('#ti-status').textContent = 'Ищу…';
                $('#ti-results').innerHTML = '';
                try {
                    const res = await mbSearch(title, artist);
                    $('#ti-status').textContent = res.length ? 'Выберите подходящий вариант:' : 'Ничего не найдено — попробуйте изменить название или артиста.';
                    $('#ti-results').innerHTML = res.map((r, i) => `<button class="ti-res" data-i="${i}">
              <span class="ti-cov">${r.releaseId ? `<img src="${CAA}/${r.releaseId}/front-250" alt="" loading="lazy" onerror="this.remove()">` : ''}${(0, icons_js_1.icon)('disc')}</span>
              <span class="ti-txt"><b>${(0, util_js_1.esc)(r.title)}</b><span>${(0, util_js_1.esc)(r.artist)}${r.album ? ' · ' + (0, util_js_1.esc)(r.album) : ''}${r.year ? ' · ' + r.year : ''}</span></span>
              <span class="ti-len">${r.length ? (0, util_js_1.fmtTime)(r.length) : ''}</span></button>`).join('');
                    $('#ti-results').onclick = e => {
                        const b = e.target.closest('.ti-res');
                        if (!b)
                            return;
                        const r = res[+b.dataset.i];
                        api.el.querySelectorAll('.ti-res').forEach(x => x.classList.toggle('on', x === b));
                        $('[data-f="title"]').value = r.title;
                        $('[data-f="artist"]').value = r.artist;
                        $('[data-f="album"]').value = r.album;
                        $('[data-f="year"]').value = r.year;
                        pickedRelease = r.releaseId;
                        const w = $('#ti-album-wrap');
                        if (w)
                            w.hidden = !pickedRelease;
                    };
                }
                catch {
                    $('#ti-status').textContent = 'MusicBrainz сейчас недоступен — попробуйте позже.';
                }
            });
        },
    });
}

};
defs["tags.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIO_EXT = void 0;
exports.readMeta = readMeta;
// Собственный парсер метаданных без зависимостей:
// MP3 (ID3v1/v2.2/2.3/2.4: TIT2, TPE1, TALB, год, жанр, APIC, USLT, SYLT, MPEG-заголовок),
// FLAC (STREAMINFO, Vorbis comments, PICTURE), OGG Vorbis/Opus, WAV (fmt, LIST INFO, id3), M4A/MP4/AAC (ilst, covr).
const dec = (enc, bytes) => new TextDecoder(enc).decode(bytes);
const u32be = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u16le = (b, i) => b[i] | (b[i + 1] << 8);
const syncsafe = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
const slice = async (file, a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());
const GENRES = 'Blues,Classic Rock,Country,Dance,Disco,Funk,Grunge,Hip-Hop,Jazz,Metal,New Age,Oldies,Other,Pop,R&B,Rap,Reggae,Rock,Techno,Industrial,Alternative,Ska,Death Metal,Pranks,Soundtrack,Euro-Techno,Ambient,Trip-Hop,Vocal,Jazz+Funk,Fusion,Trance,Classical,Instrumental,Acid,House,Game,Sound Clip,Gospel,Noise,AlternRock,Bass,Soul,Punk,Space,Meditative,Instrumental Pop,Instrumental Rock,Ethnic,Gothic,Darkwave,Techno-Industrial,Electronic,Pop-Folk,Eurodance,Dream,Southern Rock,Comedy,Cult,Gangsta,Top 40,Christian Rap,Pop/Funk,Jungle,Native American,Cabaret,New Wave,Psychadelic,Rave,Showtunes,Trailer,Lo-Fi,Tribal,Acid Punk,Acid Jazz,Polka,Retro,Musical,Rock & Roll,Hard Rock'.split(',');
// ---------- текст ----------
// Много русских MP3 хранят cp1251, но помечают её как ISO-8859-1 — угадываем.
function decodeLatin(bytes) {
    let high = 0, letters = 0;
    for (const c of bytes) {
        if (c >= 0x80)
            high++;
        if (c >= 0x41)
            letters++;
    }
    if (high >= 2 && high / Math.max(letters, 1) > 0.4) {
        const t = dec('windows-1251', bytes);
        if (/[А-Яа-яЁё]/.test(t))
            return t;
    }
    return dec('windows-1252', bytes);
}
function decodeText(encByte, bytes) {
    let s;
    if (encByte === 1) {
        if (bytes[0] === 0xff && bytes[1] === 0xfe)
            s = dec('utf-16le', bytes.subarray(2));
        else if (bytes[0] === 0xfe && bytes[1] === 0xff)
            s = dec('utf-16be', bytes.subarray(2));
        else
            s = dec('utf-16le', bytes);
    }
    else if (encByte === 2)
        s = dec('utf-16be', bytes);
    else if (encByte === 3)
        s = dec('utf-8', bytes);
    else
        s = decodeLatin(bytes);
    return s.replace(/\u0000+$/g, '');
}
function findTerm(b, start, encByte) {
    if (encByte === 1 || encByte === 2) {
        for (let i = start; i + 1 < b.length; i += 2)
            if (b[i] === 0 && b[i + 1] === 0)
                return [i, 2];
        return [b.length, 0];
    }
    const i = b.indexOf(0, start);
    return i < 0 ? [b.length, 0] : [i, 1];
}
function unsync(b) {
    const out = [];
    for (let i = 0; i < b.length; i++) {
        out.push(b[i]);
        if (b[i] === 0xff && b[i + 1] === 0)
            i++;
    }
    return Uint8Array.from(out);
}
function mkCover(bytes, mime) {
    if (!bytes || !bytes.length)
        return null;
    if (!mime || !/^image\//.test(mime) || mime === 'image/') {
        mime = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : 'image/jpeg';
    }
    return new Blob([bytes], { type: mime });
}
function yearOf(s) { const m = String(s || '').match(/(\d{4})/); return m ? m[1] : ''; }
function genreOf(s) {
    if (!s)
        return '';
    const m = s.match(/^\((\d+)\)\s*(.*)$/) || s.match(/^(\d+)$/);
    if (m) {
        const n = +m[1];
        return (m[2] && !/^\d+$/.test(m[2]) ? m[2] : GENRES[n]) || '';
    }
    return s;
}
// ---------- ID3v2 ----------
function parseId3Bytes(buf) {
    const out = { _frames: 0 };
    if (ascii(buf, 0, 3) !== 'ID3')
        return out;
    const ver = buf[3], flags = buf[5], size = syncsafe(buf, 6);
    let data = buf.subarray(10, 10 + size);
    if (flags & 0x80 && ver < 4)
        data = unsync(data);
    let pos = 0;
    if (flags & 0x40 && ver >= 3)
        pos = ver === 4 ? syncsafe(data, 0) : u32be(data, 0) + 4;
    const idLen = ver === 2 ? 3 : 4, hLen = ver === 2 ? 6 : 10;
    const uslt = [], sylt = [], pics = [];
    while (pos + hLen <= data.length) {
        const id = ascii(data, pos, idLen);
        if (!/^[A-Z0-9]{3,4}$/.test(id))
            break;
        let fsize = ver === 2 ? (data[pos + 3] << 16) | (data[pos + 4] << 8) | data[pos + 5]
            : ver === 4 ? syncsafe(data, pos + 4) : u32be(data, pos + 4);
        const fflags = ver >= 3 ? (data[pos + 8] << 8) | data[pos + 9] : 0;
        let body = data.subarray(pos + hLen, pos + hLen + fsize);
        pos += hLen + fsize;
        if (ver === 4) {
            if (fflags & 0x01)
                body = body.subarray(4); // data length indicator
            if (fflags & 0x02)
                body = unsync(body); // frame-level unsynchronisation
        }
        if (!body.length)
            continue;
        out._frames++;
        const text = () => decodeText(body[0], body.subarray(1));
        switch (id) {
            case 'TIT2':
            case 'TT2':
                out.title = text();
                break;
            case 'TPE1':
            case 'TP1':
                out.artist = text().split('\u0000')[0];
                break;
            case 'TPE2':
            case 'TP2':
                out.albumArtist = text();
                break;
            case 'TALB':
            case 'TAL':
                out.album = text();
                break;
            case 'TYER':
            case 'TYE':
                out.year = out.year || yearOf(text());
                break;
            case 'TDRC':
                out.year = yearOf(text()) || out.year;
                break;
            case 'TORY':
            case 'TDOR':
                out.year = out.year || yearOf(text());
                break;
            case 'TCON':
            case 'TCO':
                out.genre = genreOf(text().split('\u0000')[0]);
                break;
            case 'TRCK':
            case 'TRK':
                out.trackNo = parseInt(text(), 10) || 0;
                break;
            case 'TPOS':
            case 'TPA':
                out.discNo = parseInt(text(), 10) || 0;
                break;
            case 'APIC':
            case 'PIC': {
                const e = body[0];
                let mime, i;
                if (id === 'PIC') {
                    mime = 'image/' + ascii(body, 1, 3).toLowerCase().replace('jpg', 'jpeg');
                    i = 4;
                }
                else {
                    const z = body.indexOf(0, 1);
                    mime = ascii(body, 1, z - 1);
                    i = z + 1;
                }
                const type = body[i];
                i++;
                const [t, tl] = findTerm(body, i, e);
                i = t + tl;
                pics.push({ type, bytes: body.subarray(i), mime });
                break;
            }
            case 'USLT':
            case 'ULT': {
                const e = body[0];
                let i = 4;
                const [t, tl] = findTerm(body, i, e);
                i = t + tl;
                const txt = decodeText(e, body.subarray(i));
                if (txt.trim())
                    uslt.push(txt);
                break;
            }
            case 'SYLT':
            case 'SLT': {
                const e = body[0], fmt = body[4];
                let i = 6;
                const [t, tl] = findTerm(body, i, e);
                i = t + tl;
                const lines = [];
                while (i < body.length) {
                    const [z, zl] = findTerm(body, i, e);
                    const txt = decodeText(e, body.subarray(i, z)).replace(/^\n/, '');
                    i = z + zl;
                    if (i + 4 > body.length)
                        break;
                    const stamp = u32be(body, i);
                    i += 4;
                    lines.push({ t: fmt === 2 ? stamp / 1000 : -1, text: txt.trim() });
                }
                if (fmt === 2 && lines.length)
                    sylt.push(lines);
                break;
            }
            default: break;
        }
    }
    const pic = pics.find(p => p.type === 3) || pics[0];
    if (pic)
        out.cover = mkCover(pic.bytes, pic.mime);
    if (uslt.length)
        out.lyricsText = uslt[0];
    if (sylt.length)
        out.lyricsSync = sylt[0];
    return out;
}
function parseId3v1(b) {
    if (b.length < 128 || ascii(b, 0, 3) !== 'TAG')
        return {};
    const t = (i, n) => decodeLatin(b.subarray(i, i + n).filter(c => c !== 0)).trim();
    const o = { title: t(3, 30), artist: t(33, 30), album: t(63, 30), year: t(93, 4), genre: GENRES[b[127]] || '' };
    if (b[125] === 0 && b[126])
        o.trackNo = b[126];
    return o;
}
// ---------- MPEG-аудио ----------
const BR = {
    '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function mpegHeader(b, i) {
    if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0)
        return null;
    const vb = (b[i + 1] >> 3) & 3, lb = (b[i + 1] >> 1) & 3, br = b[i + 2] >> 4, sr = (b[i + 2] >> 2) & 3;
    if (vb === 1 || lb === 0 || br === 0 || br === 15 || sr === 3)
        return null;
    const layer = 4 - lb, v1 = vb === 3;
    const table = BR[(v1 ? '1' : '2') + '-' + (layer === 3 && !v1 ? 2 : layer)];
    const bitrate = table[br], sampleRate = SR[vb][sr], pad = (b[i + 2] >> 1) & 1;
    const spf = layer === 1 ? 384 : (layer === 3 && !v1 ? 576 : 1152);
    const frameLen = layer === 1 ? (Math.floor(12 * bitrate * 1000 / sampleRate) + pad) * 4
        : Math.floor((spf / 8) * bitrate * 1000 / sampleRate) + pad;
    const mono = ((b[i + 3] >> 6) & 3) === 3;
    return { layer, v1, bitrate, sampleRate, spf, frameLen, channels: mono ? 1 : 2, mono };
}
function readMpeg(b, from) {
    for (let i = from; i < b.length - 4 && i < from + 65536; i++) {
        const h = mpegHeader(b, i);
        if (!h || h.frameLen < 21)
            continue;
        const next = i + h.frameLen;
        if (next + 4 < b.length && !mpegHeader(b, next))
            continue; // проверяем следующий фрейм
        const out = { codec: h.layer === 3 ? 'MP3' : 'MP' + h.layer, sampleRate: h.sampleRate, bitrate: h.bitrate, channels: h.channels, vbr: false };
        const xo = i + 4 + (h.v1 ? (h.mono ? 17 : 32) : (h.mono ? 9 : 17));
        const tag = ascii(b, xo, 4);
        if (tag === 'Xing' || tag === 'Info') {
            if (tag === 'Xing')
                out.vbr = true;
        }
        else if (ascii(b, i + 36, 4) === 'VBRI')
            out.vbr = true;
        return out;
    }
    return {};
}
// ---------- ID3 (MP3 и файлы без обёртки) ----------
async function readMp3(file) {
    const head = await slice(file, 0, 10);
    let meta = {}, audioStart = 0;
    if (ascii(head, 0, 3) === 'ID3') {
        const size = syncsafe(head, 6) + 10 + (head[5] & 0x10 ? 10 : 0);
        meta = parseId3Bytes(await slice(file, 0, size));
        audioStart = size;
    }
    const mpegBuf = await slice(file, audioStart, audioStart + 70000);
    Object.assign(meta, readMpeg(mpegBuf, 0));
    const tail = await slice(file, Math.max(0, file.size - 128), file.size);
    let tagBytes = audioStart;
    if (ascii(tail, 0, 3) === 'TAG') {
        const v1 = parseId3v1(tail);
        tagBytes += 128;
        for (const k of Object.keys(v1))
            if (!meta[k] && v1[k])
                meta[k] = v1[k];
    }
    meta.audioBytes = Math.max(1, file.size - tagBytes);
    return meta;
}
// ---------- Vorbis comments (FLAC / OGG) ----------
function parseVorbisComments(b, start) {
    const out = {};
    let i = start;
    const vlen = u32le(b, i);
    i += 4 + vlen;
    const n = u32le(b, i);
    i += 4;
    const td = new TextDecoder('utf-8');
    for (let k = 0; k < n && i + 4 <= b.length; k++) {
        const l = u32le(b, i);
        i += 4;
        const s = td.decode(b.subarray(i, i + l));
        i += l;
        const eq = s.indexOf('=');
        if (eq < 0)
            continue;
        const key = s.slice(0, eq).toUpperCase(), val = s.slice(eq + 1);
        switch (key) {
            case 'TITLE':
                out.title = val;
                break;
            case 'ARTIST':
                out.artist = out.artist || val;
                break;
            case 'ALBUMARTIST':
            case 'ALBUM ARTIST':
                out.albumArtist = val;
                break;
            case 'ALBUM':
                out.album = val;
                break;
            case 'DATE':
            case 'YEAR':
            case 'ORIGINALDATE':
                out.year = out.year || yearOf(val);
                break;
            case 'GENRE':
                out.genre = out.genre || val;
                break;
            case 'TRACKNUMBER':
                out.trackNo = parseInt(val, 10) || 0;
                break;
            case 'DISCNUMBER':
                out.discNo = parseInt(val, 10) || 0;
                break;
            case 'LYRICS':
            case 'UNSYNCEDLYRICS':
            case 'SYNCEDLYRICS':
                out.lyricsText = out.lyricsText || val;
                break;
            case 'METADATA_BLOCK_PICTURE': {
                try {
                    const bin = atob(val), pb = Uint8Array.from(bin, c => c.charCodeAt(0));
                    Object.assign(out, parseFlacPicture(pb));
                }
                catch { /* ignore */ }
                break;
            }
            default: break;
        }
    }
    return out;
}
function parseFlacPicture(b) {
    let i = 4;
    const ml = u32be(b, i);
    i += 4;
    const mime = ascii(b, i, ml);
    i += ml;
    const dl = u32be(b, i);
    i += 4 + dl + 16;
    const len = u32be(b, i);
    i += 4;
    return { cover: mkCover(b.subarray(i, i + len), mime) };
}
// ---------- FLAC ----------
async function readFlac(file) {
    const meta = { codec: 'FLAC' };
    let pos = 4, last = false;
    while (!last && pos < file.size) {
        const h = await slice(file, pos, pos + 4);
        last = !!(h[0] & 0x80);
        const type = h[0] & 0x7f, len = (h[1] << 16) | (h[2] << 8) | h[3];
        pos += 4;
        if (type === 0) {
            const b = await slice(file, pos, pos + 34);
            meta.sampleRate = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4);
            meta.channels = ((b[12] >> 1) & 7) + 1;
            meta.bits = (((b[12] & 1) << 4) | (b[13] >> 4)) + 1;
        }
        else if (type === 4) {
            Object.assign(meta, parseVorbisComments(await slice(file, pos, pos + len), 0));
        }
        else if (type === 6) {
            const c = parseFlacPicture(await slice(file, pos, pos + len));
            if (c.cover && !meta.cover)
                meta.cover = c.cover;
        }
        pos += len;
    }
    meta.audioBytes = Math.max(1, file.size - pos);
    return meta;
}
// ---------- OGG (Vorbis / Opus) ----------
async function readOgg(file) {
    const buf = await slice(file, 0, Math.min(file.size, 4 * 1024 * 1024));
    const payloads = [];
    let pos = 0, total = 0;
    while (pos + 27 <= buf.length && ascii(buf, pos, 4) === 'OggS' && payloads.length < 40) {
        const ns = buf[pos + 26];
        let len = 0;
        for (let i = 0; i < ns; i++)
            len += buf[pos + 27 + i];
        const start = pos + 27 + ns;
        payloads.push(buf.subarray(start, start + len));
        total += len;
        pos = start + len;
        if (total > 3.5 * 1024 * 1024)
            break;
    }
    const all = new Uint8Array(total);
    let o = 0;
    for (const p of payloads) {
        all.set(p, o);
        o += p.length;
    }
    const meta = {};
    const find = sig => {
        const s = Array.from(sig, c => c.charCodeAt(0));
        outer: for (let i = 0; i < all.length - s.length; i++) {
            for (let j = 0; j < s.length; j++)
                if (all[i + j] !== s[j])
                    continue outer;
            return i;
        }
        return -1;
    };
    const vi = find('\x01vorbis'), oi = find('OpusHead');
    if (vi >= 0) {
        meta.codec = 'Vorbis';
        meta.channels = all[vi + 11];
        meta.sampleRate = u32le(all, vi + 12);
        const nb = u32le(all, vi + 20);
        if (nb > 0 && nb < 4e6)
            meta.nominalBitrate = Math.round(nb / 1000);
    }
    else if (oi >= 0) {
        meta.codec = 'Opus';
        meta.channels = all[oi + 9];
        meta.sampleRate = 48000;
    }
    const ci = find('\x03vorbis'), ti = find('OpusTags');
    if (ci >= 0)
        Object.assign(meta, parseVorbisComments(all, ci + 7));
    else if (ti >= 0)
        Object.assign(meta, parseVorbisComments(all, ti + 8));
    meta.audioBytes = file.size;
    return meta;
}
// ---------- WAV ----------
async function readWav(file) {
    const meta = { codec: 'WAV' };
    let pos = 12;
    while (pos + 8 <= file.size) {
        const h = await slice(file, pos, pos + 8);
        const id = ascii(h, 0, 4), size = u32le(h, 4);
        if (id === 'fmt ') {
            const b = await slice(file, pos + 8, pos + 8 + Math.min(size, 24));
            meta.channels = u16le(b, 2);
            meta.sampleRate = u32le(b, 4);
            meta.bitrate = Math.round(u32le(b, 8) * 8 / 1000);
            meta.bits = u16le(b, 14);
        }
        else if (id === 'LIST' && size < 1e6) {
            const b = await slice(file, pos + 8, pos + 8 + size);
            if (ascii(b, 0, 4) === 'INFO') {
                let i = 4;
                while (i + 8 <= b.length) {
                    const k = ascii(b, i, 4), l = u32le(b, i + 4);
                    const v = decodeLatin(b.subarray(i + 8, i + 8 + l).filter(c => c !== 0)).trim();
                    if (k === 'INAM')
                        meta.title = v;
                    else if (k === 'IART')
                        meta.artist = v;
                    else if (k === 'IPRD')
                        meta.album = v;
                    else if (k === 'ICRD')
                        meta.year = yearOf(v);
                    else if (k === 'IGNR')
                        meta.genre = v;
                    else if (k === 'ITRK')
                        meta.trackNo = parseInt(v, 10) || 0;
                    i += 8 + l + (l & 1);
                }
            }
        }
        else if ((id === 'id3 ' || id === 'ID3 ') && size < 30e6) {
            const t = parseId3Bytes(await slice(file, pos + 8, pos + 8 + size));
            for (const k of Object.keys(t))
                if (t[k] && !meta[k])
                    meta[k] = t[k];
        }
        pos += 8 + size + (size & 1);
    }
    meta.audioBytes = file.size;
    return meta;
}
// ---------- MP4 / M4A / AAC ----------
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'ilst']);
function walkMp4(b, start, end, ctx) {
    let i = start;
    while (i + 8 <= end) {
        let size = u32be(b, i);
        const type = ascii(b, i + 4, 4);
        let hdr = 8;
        if (size === 1) {
            size = u32be(b, i + 12);
            hdr = 16;
        }
        if (size === 0)
            size = end - i;
        if (size < hdr || i + size > end + 1)
            break;
        const bs = i + hdr, be = Math.min(i + size, end);
        if (ctx.inIlst) {
            const d = findData(b, bs, be);
            if (d)
                ctx.items[type] = d;
        }
        else if (type === 'meta')
            walkMp4(b, bs + 4, be, ctx);
        else if (type === 'ilst')
            walkMp4(b, bs, be, { ...ctx, inIlst: true, items: ctx.items });
        else if (type === 'stsd') {
            const t = ascii(b, bs + 12, 4);
            if (t === 'mp4a' || t === 'alac') {
                ctx.meta.codec = t === 'alac' ? 'ALAC' : 'AAC';
                const e = bs + 16; // начало содержимого sample entry
                ctx.meta.channels = ((b[e + 16] << 8) | b[e + 17]) || 2;
                ctx.meta.sampleRate = u32be(b, e + 8 + 16) >>> 16;
                ctx.meta.bits = (b[e + 8 + 10] << 8) | b[e + 8 + 11];
            }
        }
        else if (CONTAINERS.has(type))
            walkMp4(b, bs, be, ctx);
        i += size;
    }
}
function findData(b, s, e) {
    let i = s;
    while (i + 8 <= e) {
        const size = u32be(b, i), type = ascii(b, i + 4, 4);
        if (size < 8)
            break;
        if (type === 'data')
            return { flags: u32be(b, i + 8) & 0xffffff, bytes: b.subarray(i + 16, i + size) };
        i += size;
    }
    return null;
}
async function readMp4(file) {
    const meta = { codec: 'AAC' };
    let pos = 0, moov = null;
    while (pos + 8 <= file.size) {
        const h = await slice(file, pos, pos + 16);
        let size = u32be(h, 0), hdr = 8;
        const type = ascii(h, 4, 4);
        if (size === 1) {
            size = u32be(h, 12);
            hdr = 16;
        }
        if (size === 0)
            size = file.size - pos;
        if (size < 8)
            break;
        if (type === 'moov') {
            moov = await slice(file, pos, pos + size);
            break;
        }
        pos += size;
    }
    if (!moov)
        return meta;
    const ctx = { meta, items: {} };
    walkMp4(moov, 0, moov.length, ctx);
    const text = k => ctx.items[k] ? dec('utf-8', ctx.items[k].bytes) : '';
    meta.title = text('©nam');
    meta.artist = text('©ART');
    meta.album = text('©alb');
    meta.albumArtist = text('aART');
    meta.year = yearOf(text('©day'));
    meta.genre = text('©gen');
    meta.lyricsText = text('©lyr');
    const tr = ctx.items.trkn;
    if (tr && tr.bytes.length >= 4)
        meta.trackNo = (tr.bytes[2] << 8) | tr.bytes[3];
    const cv = ctx.items.covr;
    if (cv)
        meta.cover = mkCover(cv.bytes, cv.flags === 14 ? 'image/png' : 'image/jpeg');
    meta.audioBytes = file.size;
    return meta;
}
// ---------- ADTS (сырой AAC) ----------
async function readAdts(file) {
    const b = await slice(file, 0, 4096);
    const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];
    for (let i = 0; i < b.length - 7; i++) {
        if (b[i] === 0xff && (b[i + 1] & 0xf6) === 0xf0) {
            return { codec: 'AAC', sampleRate: rates[(b[i + 2] >> 2) & 15], channels: ((b[i + 2] & 1) << 2) | (b[i + 3] >> 6), audioBytes: file.size };
        }
    }
    return {};
}
exports.AUDIO_EXT = new Set(['mp3', 'flac', 'ogg', 'oga', 'opus', 'wav', 'wave', 'm4a', 'mp4', 'aac', 'm4b', 'weba', 'webm']);
async function readMeta(file, name = file.name || '') {
    const ext = (name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
    let meta = {};
    try {
        const h = await slice(file, 0, 12);
        const sig = ascii(h, 0, 4);
        if (sig.startsWith('ID3'))
            meta = await readMp3(file);
        else if (sig === 'fLaC')
            meta = await readFlac(file);
        else if (sig === 'OggS')
            meta = await readOgg(file);
        else if (sig === 'RIFF')
            meta = await readWav(file);
        else if (ascii(h, 4, 4) === 'ftyp')
            meta = await readMp4(file);
        else if (ext === 'aac')
            meta = await readAdts(file);
        else
            meta = await readMp3(file);
    }
    catch (e) {
        console.warn('readMeta failed for', name, e);
    }
    delete meta._frames;
    return meta;
}

};
defs["theme.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTheme = applyTheme;
exports.toggleTheme = toggleTheme;
exports.applySettings = applySettings;
const state_js_1 = require("./state.js");
const motion_js_1 = require("./motion.js");
let reveal = null, sequence = 0, chosenTheme = null;
// Передаём кнопку только для действий пользователя; запуск и импорт настроек мгновенные.
function applyTheme(t = state_js_1.state.theme, origin = null) {
    const root = document.documentElement, theme = t === 'light' ? 'light' : 'dark';
    chosenTheme = theme;
    (0, motion_js_1.cancelMotion)();
    const id = ++sequence;
    if (reveal) {
        reveal.transition?.skipTransition();
        reveal.animation?.cancel();
        reveal.cover?.remove();
        reveal = null;
    }
    root.classList.remove('player-theme-reveal', 'player-theme-collapse');
    let committed = false;
    const commit = () => {
        if (id !== sequence || committed)
            return;
        committed = true;
        state_js_1.state.theme = theme;
        root.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09090B' : '#F5F5F7');
        (0, state_js_1.save)();
        (0, state_js_1.emit)('theme');
    };
    if (!origin || root.dataset.theme === theme || !state_js_1.state.settings.anim || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        commit();
        return;
    }
    const rect = origin.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight, rect.top + rect.height / 2));
    const radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 2;
    const small = `circle(0px at ${x}px ${y}px)`, large = `circle(${radius}px at ${x}px ${y}px)`;
    const collapse = theme === 'dark', from = collapse ? large : small, to = collapse ? small : large;
    root.style.setProperty('--player-theme-from', from);
    root.classList.add('player-theme-reveal');
    root.classList.toggle('player-theme-collapse', collapse);
    const current = {};
    reveal = current;
    const finish = () => {
        if (id !== sequence)
            return;
        current.animation?.cancel();
        current.cover?.remove();
        reveal = null;
        root.classList.remove('player-theme-reveal', 'player-theme-collapse');
    };
    const timing = { duration: 650, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' };
    if (typeof document.startViewTransition === 'function') {
        try {
            const transition = document.startViewTransition(commit);
            current.transition = transition;
            transition.ready.then(() => {
                if (id !== sequence)
                    return;
                current.animation = root.animate({ clipPath: [from, to] }, {
                    ...timing, pseudoElement: collapse ? '::view-transition-old(root)' : '::view-transition-new(root)',
                });
            }).catch(commit);
            transition.finished.then(finish, finish);
        }
        catch (_) {
            commit();
            finish();
        }
        return;
    }
    // В старых WebView — цветовая волна с мягким появлением интерфейса.
    const cover = document.createElement('div');
    cover.className = 'player-theme-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.backgroundColor = '#F5F5F7';
    document.body.appendChild(cover);
    current.cover = cover;
    if (typeof cover.animate !== 'function') {
        commit();
        finish();
        return;
    }
    if (collapse)
        commit();
    current.animation = cover.animate({ clipPath: [from, to] }, timing);
    current.animation.finished.then(() => {
        if (id !== sequence)
            return;
        commit();
        if (collapse) {
            finish();
            return;
        }
        current.animation = cover.animate({ opacity: [1, 0] }, { duration: 140, fill: 'forwards' });
        current.animation.finished.then(finish, finish);
    }).catch(finish);
}
function toggleTheme(origin) {
    origin || (origin = [...document.querySelectorAll('[data-action="toggle-theme"], [data-action="set-theme"]')]
        .find(el => el.getClientRects().length));
    applyTheme((chosenTheme || state_js_1.state.theme) === 'dark' ? 'light' : 'dark', origin);
}
// Пользовательские настройки → атрибуты <html> (цвет акцента, размеры, фон)
function applySettings() {
    const r = document.documentElement, s = state_js_1.state.settings;
    r.dataset.accent = 'white';
    r.dataset.card = s.cardSize;
    r.dataset.lysize = s.lyricsSize;
    r.dataset.corners = s.corners;
    r.dataset.density = s.density;
    r.classList.toggle('no-bg-anim', !s.bgAnim);
    r.classList.toggle('no-bg-cover', !s.bgCover);
    r.classList.toggle('no-anim', !s.anim);
    if (!s.anim)
        (0, motion_js_1.cancelMotion)();
}

};
defs["tools.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeMB = exports.extOf = exports.hasArtist = void 0;
exports.quality = quality;
exports.duplicateGroups = duplicateGroups;
exports.inherit = inherit;
exports.missing = missing;
const state_js_1 = require("./state.js");
const lyrics_web_js_1 = require("./lyrics-web.js");
const artists_js_1 = require("./artists.js");
// Порядок в медиатеке: поиск повторов и песен, которым чего-то не хватает.
const LOSSLESS = /\.(flac|wav|aiff?|ape|wv)$/i;
const known = a => a && a !== artists_js_1.UNKNOWN;
const hasArtist = t => (t._artists || [t.artist]).some(known);
exports.hasArtist = hasArtist;
// какая копия лучше: без потерь > выше битрейт > есть обложка/текст > любимая и чаще слушают
function quality(t) {
    return (LOSSLESS.test(t.name || '') ? 5000 : 0) + Math.min(t.bitrate || 0, 2000) + (t.cover ? 200 : 0) + (t.lyrics ? 100 : 0)
        + (state_js_1.state.likes.has(t.id) ? 60 : 0) + Math.min(state_js_1.state.plays[t.id] || 0, 50);
}
// Повторы: то же название, тот же артист и та же длина (±2 с). В каждой группе keep — лучшая копия, extra — лишние.
function duplicateGroups() {
    const by = new Map();
    for (const t of (0, state_js_1.derived)().all) {
        const title = (0, lyrics_web_js_1.norm)(t.title);
        if (!title)
            continue;
        const k = title + '|' + (0, lyrics_web_js_1.norm)((0, exports.hasArtist)(t) ? t.artist : '');
        (by.get(k) || by.set(k, []).get(k)).push(t);
    }
    const out = [];
    for (const [k, list] of by) {
        if (list.length < 2)
            continue;
        list.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        let cl = [list[0]];
        const flush = () => {
            if (cl.length > 1) {
                const s = [...cl].sort((a, b) => quality(b) - quality(a) || (a.addedAt || 0) - (b.addedAt || 0));
                out.push({ key: k + '|' + Math.round(s[0].duration || 0), keep: s[0], extra: s.slice(1) });
            }
        };
        for (let i = 1; i < list.length; i++) {
            if (Math.abs((list[i].duration || 0) - (cl[cl.length - 1].duration || 0)) <= 2)
                cl.push(list[i]);
            else {
                flush();
                cl = [list[i]];
            }
        }
        flush();
    }
    return out.sort((a, b) => a.keep.title.localeCompare(b.keep.title, 'ru'));
}
// перед удалением лишней копии переносим на оставшуюся лайк, место в плейлистах и счётчик прослушиваний
function inherit(keep, extra) {
    for (const x of extra) {
        if (state_js_1.state.likes.has(x.id))
            state_js_1.state.likes.add(keep.id);
        state_js_1.state.plays[keep.id] = (state_js_1.state.plays[keep.id] || 0) + (state_js_1.state.plays[x.id] || 0);
        for (const p of state_js_1.state.playlists)
            if (p.ids.includes(x.id))
                p.ids = p.ids.includes(keep.id) ? p.ids.filter(id => id !== x.id) : p.ids.map(id => (id === x.id ? keep.id : id));
    }
    if (!state_js_1.state.plays[keep.id])
        delete state_js_1.state.plays[keep.id];
    (0, state_js_1.save)();
}
// чего не хватает
function missing() {
    const all = (0, state_js_1.derived)().all;
    return { all, artist: all.filter(t => !(0, exports.hasArtist)(t)), cover: all.filter(t => !t.cover), lyrics: all.filter(t => !t.lyrics) };
}
const extOf = t => (/\.([a-z0-9]{2,5})$/i.exec(t.name || '') || [])[1]?.toUpperCase() || '';
exports.extOf = extOf;
const sizeMB = t => t.size ? (t.size / 1048576).toFixed(1).replace('.', ',') + ' МБ' : '';
exports.sizeMB = sizeMB;

};
defs["translate.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetLang = void 0;
exports.detectLang = detectLang;
exports.canTranslate = canTranslate;
exports.cachedTranslation = cachedTranslation;
exports.loadTranslation = loadTranslation;
const db_js_1 = require("./db.js");
const state_js_1 = require("./state.js");
const i18n_js_1 = require("./i18n.js");
// Перевод текста песни строчкой под оригиналом.
// Сервис — MyMemory (бесплатно, без ключа, можно прямо из браузера). Лимит у него ~5000 символов в день
// на пользователя — это несколько песен; готовые переводы запоминаются и повторно не запрашиваются.
const API = 'https://api.mymemory.translated.net/get';
const CHUNK = 450; // MyMemory принимает до 500 байт за запрос
// Язык песни по буквам (автоопределение у MyMemory не работает)
function detectLang(text) {
    const s = String(text || '');
    const count = re => (s.match(re) || []).length;
    const cyr = count(/[а-яё]/gi), lat = count(/[a-z]/gi), ko = count(/[가-힯]/g), ja = count(/[぀-ヿ]/g), zh = count(/[一-鿿]/g);
    const max = Math.max(cyr, lat, ko, ja, zh);
    if (!max)
        return '';
    if (max === ko)
        return 'ko';
    if (max === ja || (zh && ja))
        return 'ja';
    if (max === zh)
        return 'zh-CN';
    if (max === cyr)
        return /[їієґ]/i.test(s) ? 'uk' : 'ru';
    if (/[ñ¿¡]/i.test(s))
        return 'es';
    if (/[ãõ]/i.test(s) || /\b(você|não)\b/i.test(s))
        return 'pt';
    if (/[äöüß]/i.test(s))
        return 'de';
    if (/[èêëçàâœ]/i.test(s) && /\b(je|tu|le|la|les|et|est|pas)\b/i.test(s))
        return 'fr';
    return 'en';
}
const targetLang = () => ((0, i18n_js_1.isEn)() ? 'en' : 'ru');
exports.targetLang = targetLang;
const lyricLines = ly => ly.type === 'synced' ? ly.lines.map(l => l.text || '') : String(ly.text || '').split('\n');
function canTranslate(ly) {
    if (!ly)
        return false;
    const src = detectLang(lyricLines(ly).join('\n'));
    return !!src && src !== (0, exports.targetLang)();
}
const mem = new Map(); // ключ → массив переводов строк (по индексу строки)
const keyOf = (t, ly) => `tr|${(0, exports.targetLang)()}|${t.id}|${lyricLines(ly).length}`;
function cachedTranslation(t) {
    const ly = t && t.lyrics;
    return ly ? mem.get(keyOf(t, ly)) || null : null;
}
const pending = new Set();
async function ask(q, pair) {
    const r = await fetch(`${API}?${new URLSearchParams({ q, langpair: pair })}`);
    if (!r.ok)
        throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.responseStatus && +d.responseStatus !== 200)
        throw new Error(String(d.responseDetails || d.responseStatus));
    return String(d.responseData?.translatedText || '');
}
// Переводит строки кусками; если сервис склеил строки — переводит этот кусок построчно
async function translateLines(lines, pair) {
    const out = new Array(lines.length).fill('');
    const idx = lines.map((l, i) => (l.trim() ? i : -1)).filter(i => i >= 0);
    let group = [];
    const flush = async () => {
        if (!group.length)
            return;
        const res = (await ask(group.map(i => lines[i].trim()).join('\n'), pair)).split('\n');
        if (res.length === group.length)
            group.forEach((i, k) => { out[i] = res[k].trim(); });
        else
            for (const i of group)
                out[i] = (await ask(lines[i].trim(), pair)).trim();
        group = [];
    };
    let size = 0;
    for (const i of idx) {
        const len = new TextEncoder().encode(lines[i]).length + 1;
        if (size + len > CHUNK) {
            await flush();
            size = 0;
        }
        group.push(i);
        size += len;
    }
    await flush();
    return out;
}
async function loadTranslation(t) {
    const ly = t && t.lyrics;
    if (!ly || !canTranslate(ly))
        return null;
    const key = keyOf(t, ly);
    if (mem.has(key))
        return mem.get(key);
    if (pending.has(key))
        return null;
    pending.add(key);
    try {
        const saved = await (0, db_js_1.lyGet)(key).catch(() => null);
        let tr = saved && Array.isArray(saved.tr) ? saved.tr : null;
        if (!tr) {
            const lines = lyricLines(ly);
            tr = await translateLines(lines, `${detectLang(lines.join('\n'))}|${(0, exports.targetLang)()}`);
            if (tr.some(Boolean))
                (0, db_js_1.lySet)(key, { tr, at: Date.now() });
        }
        mem.set(key, tr);
        (0, state_js_1.emit)('translation', t);
        return tr;
    }
    catch (e) {
        (0, state_js_1.emit)('translation-error', String(e && e.message || e));
        return null;
    }
    finally {
        pending.delete(key);
    }
}

};
defs["ui.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topModal = void 0;
exports.toast = toast;
exports.closeMenu = closeMenu;
exports.openMenu = openMenu;
exports.openModal = openModal;
exports.confirmBox = confirmBox;
exports.closeTopModal = closeTopModal;
exports.promptText = promptText;
exports.pickImage = pickImage;
const icons_js_1 = require("./icons.js");
const util_js_1 = require("./util.js");
const motion_js_1 = require("./motion.js");
// ---------- toast ----------
function toast(msg, kind = 'ok', ms = 2600) {
    const root = document.getElementById('toasts');
    if (!root)
        return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${(0, util_js_1.esc)(msg)}</span>`;
    root.appendChild(el);
    requestAnimationFrame(() => { if (el.isConnected && !el.inert)
        el.classList.add('in'); });
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 350); }, ms);
}
// ---------- контекстное меню ----------
let menuEl = null;
function closeMenu() {
    if (menuEl) {
        (0, motion_js_1.dismissElement)(menuEl);
        menuEl = null;
        return true;
    }
    return false;
}
let menuY = 0;
function openMenu(anchor, items, { x, y } = {}) {
    closeMenu();
    menuY = scrollY;
    const root = document.getElementById('popover-root');
    const el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = items.map((it, i) => it.sep
        ? '<div class="menu-sep"></div>'
        : `<button class="menu-item ${it.danger ? 'danger' : ''}" role="menuitem" data-mi="${i}">${it.icon ? (0, icons_js_1.icon)(it.icon) : '<span class="ic"></span>'}<span>${(0, util_js_1.esc)(it.label)}</span></button>`).join('');
    root.appendChild(el);
    menuEl = el;
    const r = anchor ? anchor.getBoundingClientRect() : { left: x, right: x, top: y, bottom: y, width: 0 };
    const mw = el.offsetWidth, mh = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    let left = Math.min(Math.max(8, r.right - mw), vw - mw - 8);
    if (!anchor)
        left = Math.min(x, vw - mw - 8);
    let top = r.bottom + 6, origin = 'top';
    if (top + mh > vh - 8) {
        top = Math.max(8, r.top - mh - 6);
        origin = 'bottom';
    }
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.transformOrigin = `${origin} ${r.right - left > mw / 2 ? 'right' : 'left'}`;
    requestAnimationFrame(() => { if (el.isConnected && !el.inert)
        el.classList.add('in'); });
    el.addEventListener('click', e => {
        const b = e.target.closest('[data-mi]');
        if (!b)
            return;
        const it = items[+b.dataset.mi];
        closeMenu();
        it.onClick?.();
    });
    el.querySelector('.menu-item')?.focus();
}
document.addEventListener('pointerdown', e => {
    if (menuEl && !menuEl.contains(e.target) && !e.target.closest('[data-action="menu"],[data-action="np-menu"]'))
        closeMenu();
}, true);
addEventListener('resize', closeMenu);
// меню закрывается при прокрутке страницы, но не когда сам листается текст песни или очередь
// (и не от мелкого подрагивания страницы — только если её заметно прокрутили)
document.addEventListener('scroll', e => {
    const page = e.target === document || e.target === document.documentElement;
    if (page ? Math.abs(scrollY - menuY) >= 24 : !!(e.target.closest && e.target.closest('.rail')))
        closeMenu();
}, true);
// ---------- модальные окна ----------
const stack = [];
function openModal({ title, html = '', actions = [], wide = false, onMount }) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${(0, util_js_1.esc)(title)}">
    <div class="modal-head"><h2>${(0, util_js_1.esc)(title)}</h2><button class="icon-btn" data-close aria-label="Закрыть">${(0, icons_js_1.icon)('close')}</button></div>
    <div class="modal-body">${html}</div>
    ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : 'btn-soft'} ${a.danger ? 'btn-danger' : ''}" data-act="${i}">${(0, util_js_1.esc)(a.label)}</button>`).join('')}</div>` : ''}
  </div>`;
    root.appendChild(wrap);
    let closing = false;
    const api = { el: wrap, close() {
            if (closing)
                return;
            closing = true;
            wrap.inert = true;
            wrap.style.pointerEvents = 'none';
            wrap.classList.remove('in');
            const i = stack.indexOf(api);
            if (i >= 0)
                stack.splice(i, 1);
            if ((0, motion_js_1.motionEnabled)())
                setTimeout(() => wrap.remove(), 250);
            else
                wrap.remove();
        } };
    stack.push(api);
    wrap.addEventListener('mousedown', e => {
        if (e.target === wrap)
            api.close();
    });
    wrap.addEventListener('click', e => {
        if (e.target.closest('[data-close]'))
            return api.close();
        const b = e.target.closest('[data-act]');
        if (b) {
            const a = actions[+b.dataset.act];
            const r = a.onClick?.(api);
            if (r !== false && !a.keep)
                api.close();
        }
    });
    requestAnimationFrame(() => { if (closing)
        return; wrap.classList.add('in'); wrap.querySelector('input,textarea')?.focus(); });
    onMount?.(api);
    return api;
}
function confirmBox({ title, text, ok = 'Да', cancel = 'Отмена', danger = false }) {
    return new Promise(resolve => {
        let done = false;
        const fin = v => {
            if (!done) {
                done = true;
                resolve(v);
            }
        };
        openModal({
            title, html: `<p class="modal-text">${(0, util_js_1.esc)(text)}</p>`,
            actions: [{ label: cancel, onClick: () => fin(false) }, { label: ok, primary: true, danger, onClick: () => fin(true) }],
            onMount: api => { const orig = api.close; api.close = () => { orig(); setTimeout(() => fin(false), 0); }; },
        });
    });
}
const topModal = () => stack[stack.length - 1];
exports.topModal = topModal;
function closeTopModal() {
    const m = stack[stack.length - 1];
    if (m) {
        m.close();
        return true;
    }
    return false;
}
function promptText({ title, label, value = '', ok = 'Готово', placeholder = '' }) {
    return new Promise(resolve => {
        let done = false;
        const fin = v => {
            if (!done) {
                done = true;
                resolve(v);
            }
        };
        const m = openModal({
            title, html: `<label class="field"><span>${(0, util_js_1.esc)(label)}</span><input class="input" id="prompt-in" value="${(0, util_js_1.esc)(value)}" placeholder="${(0, util_js_1.esc)(placeholder)}" maxlength="80"></label>`,
            actions: [{ label: 'Отмена', onClick: () => fin(null) }, { label: ok, primary: true, onClick: () => fin(m.el.querySelector('#prompt-in').value.trim() || null) }],
            onMount: api => {
                const inp = api.el.querySelector('#prompt-in');
                inp.select();
                inp.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        fin(inp.value.trim() || null);
                        api.close();
                    }
                });
                const orig = api.close;
                api.close = () => { fin(null); orig(); };
            },
        });
    });
}
// ---------- выбор картинки: файл → квадрат w×h (jpeg, data URL) или null, если отменили ----------
function pickImage(w = 600, h = 600) {
    return new Promise(resolve => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.addEventListener('change', () => {
            const f = inp.files[0];
            if (!f)
                return resolve(null);
            const img = new Image(), url = URL.createObjectURL(f);
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
                c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
                URL.revokeObjectURL(url);
                resolve(c.toDataURL('image/jpeg', 0.88));
            };
            img.onerror = () => { URL.revokeObjectURL(url); toast('Не удалось прочитать изображение', 'warn'); resolve(null); };
            img.src = url;
        });
        inp.click();
    });
}

};
defs["util.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_SEED = exports.extOf = exports.stripExt = exports.baseName = exports.uid = exports.clamp = exports.enc = exports.esc = exports.$$ = exports.$ = void 0;
exports.fmtTime = fmtTime;
exports.fmtTotal = fmtTotal;
exports.plural = plural;
exports.hash = hash;
exports.norm = norm;
exports.debounce = debounce;
exports.shuffleArray = shuffleArray;
exports.seededShuffle = seededShuffle;
exports.stripSource = stripSource;
const i18n = require("./i18n.js");
const $ = (s, r = document) => r.querySelector(s);
exports.$ = $;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
exports.$$ = $$;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
exports.esc = esc;
exports.enc = encodeURIComponent;
function fmtTime(s) {
    if (!isFinite(s) || s < 0)
        s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
function fmtTotal(sec) {
    const m = Math.round(sec / 60), en = i18n.isEn();
    if (m < 60)
        return en ? `${m} min` : `${m} мин`;
    const h = Math.floor(m / 60);
    return en ? `${h} h ${m % 60} min` : `${h} ч ${m % 60} мин`;
}
function plural(n, forms) {
    if (i18n.isEn() && i18n.EN_PLURAL[forms[0]])
        return `${n} ${i18n.EN_PLURAL[forms[0]][n === 1 ? 0 : 1]}`;
    const a = Math.abs(n) % 100, b = a % 10;
    const f = a > 10 && a < 20 ? forms[2] : b > 1 && b < 5 ? forms[1] : b === 1 ? forms[0] : forms[2];
    return `${n} ${f}`;
}
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ё/g, 'е').trim();
}
function debounce(fn, ms = 120) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function shuffleArray(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
exports.clamp = clamp;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
exports.uid = uid;
const baseName = p => String(p).split(/[\\/]/).pop();
exports.baseName = baseName;
const stripExt = n => n.replace(/\.[^./\\]+$/, '');
exports.stripExt = stripExt;
const extOf = n => (n.match(/\.([^./\\]+)$/) || [, ''])[1].toLowerCase();
exports.extOf = extOf;
// псевдослучайный порядок, стабильный в пределах сессии
exports.SESSION_SEED = (Math.random() * 4294967296) >>> 0;
function seededShuffle(arr, seed) {
    const a = arr.slice();
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
// ---------- приписки сайтов, откуда скачан трек: «Династия (Sefon.Pro)» → «Династия» ----------
const TLD = '(?:pro|net|ru|com|me|fm|org|cc|to|club|info|biz|su|io|top|xyz|online|site|mobi|tv|kz|ua|by|uz|in|cx|ws|la|cloud|music|space)';
const SITES = '(?:sefon(?:\\s?pro)?|hitmo(?:top)?|muzofond|zaycev(?:\\s?net)?|mp3party|muzmo|drivemusic|lightaudio|mp3uks?|bidgar|muzlome|musify|z1\\.fm|patefon|ipleer|playvk|xitmuzon|mp3-?xa|rus\\.?mp3|primemusic|trekson|music7s|muzati|mp3cc|mp3bob|mixkit|newtunes|topmuzon)';
const SRC_RES = [
    // в скобках: (Sefon.Pro), [zaycev.net], {www.site.ru}, (скачано с muzofond.fm), (Hitmo)
    new RegExp(`\\s*[(\\[{][^)\\]}]*(?:\\b(?:www\\.)?[\\w-]+\\.${TLD}\\b|\\b${SITES}\\b|скача(?:но|ть)|download(?:ed)?\\s+(?:from|at)|free\\s+download)[^)\\]}]*[)\\]}]`, 'gi'),
    // после разделителя: «… - Sefon.Pro», «… | www.site.ru», «… _ Hitmo»
    new RegExp(`\\s*(?:[-–—|_~/]|::)\\s*(?:www\\.)?(?:[\\w-]+\\.${TLD}|${SITES})\\s*$`, 'gi'),
    new RegExp(`^\\s*(?:www\\.)?(?:[\\w-]+\\.${TLD}|${SITES})\\s*(?:[-–—|_~/]|::)\\s*`, 'gi'),
    // голый адрес сайта в конце или начале: «Династия Sefon.Pro», «www.site.ru Династия»
    new RegExp(`\\s+(?:www\\.)?[\\w-]+\\.${TLD}\\s*$`, 'gi'),
    new RegExp(`^\\s*(?:www\\.)?[\\w-]+\\.${TLD}\\s+`, 'gi'),
];
function stripSource(s) {
    let t = String(s || '');
    if (!t)
        return t;
    for (let i = 0; i < 2; i++)
        for (const re of SRC_RES)
            t = t.replace(re, '');
    t = t.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—|_.,]+|[\s\-–—|_,]+$/g, '').trim();
    // поле целиком было адресом сайта (например, альбом «zaycev.net») → пусто
    if (new RegExp(`^(?:www\\.)?(?:[\\w-]+\\.${TLD}|${SITES})$`, 'i').test(t))
        return '';
    return t;
}

};
defs["views.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCENTS = exports.setSongSort = exports.songSort = exports.homeHidden = exports.HOME_SECTIONS = exports.viewSwitch = exports.artistArt = exports.albumLink = exports.artistLinks = exports.artistsOf = exports.avatarHTML = exports.mosaic = exports.cov = exports.registerList = exports.lists = void 0;
exports.trackRow = trackRow;
exports.mixes = mixes;
exports.mixById = mixById;
exports.mixView = mixView;
exports.homeOrder = homeOrder;
exports.continueCard = continueCard;
exports.homeView = homeView;
exports.libraryView = libraryView;
exports.albumView = albumView;
exports.artistView = artistView;
exports.playlistView = playlistView;
exports.likedView = likedView;
exports.smartView = smartView;
exports.smartRulesText = smartRulesText;
exports.statsView = statsView;
exports.searchView = searchView;
exports.searchResults = searchResults;
exports.profileView = profileView;
exports.settingsView = settingsView;
exports.duplicatesView = duplicatesView;
exports.fixView = fixView;
exports.sidebarPlaylists = sidebarPlaylists;
const state_js_1 = require("./state.js");
const icons_js_1 = require("./icons.js");
const util_js_1 = require("./util.js");
const artists_js_1 = require("./artists.js");
const tools_js_1 = require("./tools.js");
const sync_js_1 = require("./sync.js");
const i18n_js_1 = require("./i18n.js");
const player_js_1 = require("./player.js");
const native_js_1 = require("./native.js");
// ---------- реестр списков (для воспроизведения «в контексте») ----------
let seq = 0;
exports.lists = new Map();
const registerList = tracks => {
    const id = ++seq;
    exports.lists.set(id, tracks);
    if (exports.lists.size > 60)
        exports.lists.delete(exports.lists.keys().next().value);
    return id;
};
exports.registerList = registerList;
// ---------- базовые компоненты ----------
const PH = [['#2c2c30', '#0f0f11', '#F5F5F7'], ['#F5F5F7', '#9a9aa2', '#111'], ['#1c1c1f', '#44444a', '#F5F5F7'], ['#E4E4E8', '#8e8e96', '#111'], ['#3a3a40', '#141416', '#E4E4E8'], ['#0f0f11', '#34343a', '#F5F5F7']];
const phStyle = seed => { const h = (0, util_js_1.hash)(String(seed)); const p = PH[h % PH.length]; return `background:linear-gradient(${(h >> 3) % 360}deg,${p[0]},${p[1]});color:${p[2]}`; };
const cov = (src, seed, cls = '') => src
    ? `<div class="cov ${cls}"><img src="${src}" alt="" loading="lazy" draggable="false"></div>`
    : `<div class="cov ph ${cls}" style="${phStyle(seed)}">${(0, icons_js_1.icon)('note')}</div>`;
exports.cov = cov;
const mosaic = (tracks, seed, cls = '') => {
    const covers = [...new Set(tracks.map(t => t.cover).filter(Boolean))];
    if (covers.length >= 4)
        return `<div class="cov mosaic ${cls}">${covers.slice(0, 4).map(c => `<img src="${c}" alt="" draggable="false">`).join('')}</div>`;
    return (0, exports.cov)(covers[0] || null, seed, cls);
};
exports.mosaic = mosaic;
const avatarHTML = (cls = '') => state_js_1.state.profile.avatar
    ? `<span class="avatar ${cls}"><img src="${state_js_1.state.profile.avatar}" alt=""></span>`
    : `<span class="avatar ph ${cls}">${(0, util_js_1.esc)((state_js_1.state.profile.name || '?').trim().charAt(0).toUpperCase())}</span>`;
exports.avatarHTML = avatarHTML;
const albumHref = k => '#/album/' + (0, util_js_1.enc)(k);
const artistHref = k => '#/artist/' + (0, util_js_1.enc)(k);
const artistsOf = t => t._artists || (0, artists_js_1.trackArtists)(t);
exports.artistsOf = artistsOf;
// Каждый артист — отдельная ссылка, между ними запятая
const artistLinks = names => names.map(n => `<a class="alink" href="${artistHref((0, artists_js_1.artistKey)(n))}">${(0, util_js_1.esc)(n)}</a>`).join(', ');
exports.artistLinks = artistLinks;
const albumLink = t => t.album ? `<a class="alink" href="${albumHref(t._albumKey || '')}">${(0, util_js_1.esc)(t.album)}</a>` : '';
exports.albumLink = albumLink;
function section(title, body, { href, more = 'Показать все' } = {}) {
    const arrows = body.startsWith('<div class="rail') ? `<span class="rail-nav"><button class="rn" data-rail="-1" aria-label="Назад">${(0, icons_js_1.icon)('chev-left')}</button><button class="rn" data-rail="1" aria-label="Вперёд">${(0, icons_js_1.icon)('chev-right')}</button></span>` : '';
    return `<section class="section"><div class="section-head"><h2>${(0, util_js_1.esc)(title)}</h2><div class="sec-r">${href ? `<a class="more-link" href="${href}">${more}${(0, icons_js_1.icon)('chev-right')}</a>` : ''}${arrows}</div></div>${body}</section>`;
}
const rail = html => `<div class="rail">${html}</div>`;
const albumCard = g => `<article class="card" tabindex="0" role="link" data-nav="${albumHref(g.key)}">
  <div class="card-art">${(0, exports.cov)(g.cover, g.key)}<button class="play-fab" data-action="play-album" data-key="${(0, util_js_1.esc)(g.key)}" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button></div>
  <h3 class="card-title">${(0, util_js_1.esc)(g.name)}</h3><p class="card-sub">${(0, exports.artistLinks)(g.artists)}${g.year ? ' · ' + (0, util_js_1.esc)(g.year) : ''}</p></article>`;
const singleCard = g => `<article class="card" tabindex="0" role="link" data-nav="${albumHref(g.key)}">
  <div class="card-art">${(0, exports.cov)(g.cover, g.key)}<button class="play-fab" data-action="play-album" data-key="${(0, util_js_1.esc)(g.key)}" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button></div>
  <h3 class="card-title">${(0, util_js_1.esc)(g.name)}</h3><p class="card-sub">${(0, exports.artistLinks)(g.artists)} · ${g.tracks.length === 1 ? 'Сингл' : 'EP'}</p></article>`;
// у артиста без своей картинки — первая буква имени, а не обложка чужого трека
const artistArt = a => a.cover ? (0, exports.cov)(a.cover, a.key, 'round') : `<div class="cov ph round letter" style="${phStyle(a.key)}">${(0, util_js_1.esc)((String(a.name || '?').trim()[0] || '?').toUpperCase())}</div>`;
exports.artistArt = artistArt;
const artistCard = (a, { sub = true } = {}) => `<article class="card card-artist" tabindex="0" role="link" data-nav="${artistHref(a.key)}">
  <div class="card-art round">${(0, exports.artistArt)(a)}<button class="play-fab" data-action="play-artist" data-key="${(0, util_js_1.esc)(a.key)}" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button></div>
  <h3 class="card-title center">${(0, util_js_1.esc)(a.name)}</h3>${sub ? `<p class="card-sub center">${(0, util_js_1.plural)(a.tracks.length, ['песня', 'песни', 'песен'])}</p>` : ''}</article>`;
const playlistCard = p => {
    const ts = (0, state_js_1.playlistTracks)(p);
    return `<article class="card" tabindex="0" role="link" data-nav="#/playlist/${p.id}">
  <div class="card-art">${(0, exports.mosaic)(ts, p.id)}<button class="play-fab" data-action="play-playlist" data-id="${p.id}" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button></div>
  <h3 class="card-title">${(0, util_js_1.esc)(p.name)}</h3><p class="card-sub">${(0, util_js_1.plural)(ts.length, ['песня', 'песни', 'песен'])}</p></article>`;
};
const likedCard = () => `<article class="card" tabindex="0" role="link" data-nav="#/liked">
  <div class="card-art"><div class="cov liked-cov">${(0, icons_js_1.icon)('heart-fill')}</div><button class="play-fab" data-action="play-liked" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button></div>
  <h3 class="card-title">Понравившееся</h3><p class="card-sub">${(0, util_js_1.plural)(state_js_1.state.likes.size, ['песня', 'песни', 'песен'])}</p></article>`;
const smartCard = p => {
    const ts = (0, state_js_1.smartTracks)(p);
    return `<article class="card" tabindex="0" role="link" data-nav="#/smart/${p.id}">
  <div class="card-art"><div class="smart-art">${(0, exports.mosaic)(ts, p.id)}<span class="smart-badge">${(0, icons_js_1.icon)('smart')}</span></div><button class="play-fab" data-action="play-smart" data-id="${p.id}" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button></div>
  <h3 class="card-title">${(0, util_js_1.esc)(p.name)}</h3><p class="card-sub">Умный · ${(0, util_js_1.plural)(ts.length, ['песня', 'песни', 'песен'])}</p></article>`;
};
const newSmartCard = () => `<article class="card card-new" tabindex="0" role="button" data-action="new-smart">
  <div class="card-art"><div class="cov new-cov">${(0, icons_js_1.icon)('smart')}</div></div><h3 class="card-title">Умный плейлист</h3><p class="card-sub">Собирается сам по правилам</p></article>`;
const newPlaylistCard = () => `<article class="card card-new" tabindex="0" role="button" data-action="new-playlist">
  <div class="card-art"><div class="cov new-cov">${(0, icons_js_1.icon)('plus')}</div></div><h3 class="card-title">Новый плейлист</h3><p class="card-sub">Создать</p></article>`;
const recentCard = (t, i, lid) => `<article class="card" tabindex="0" role="button" data-track="${(0, util_js_1.esc)(t.id)}" data-list="${lid}" data-i="${i}">
  <div class="card-art">${(0, exports.cov)(t.cover, t._albumKey || t.id)}<span class="play-fab static">${(0, icons_js_1.icon)('play')}</span></div>
  <h3 class="card-title">${(0, util_js_1.esc)(t.title)}</h3><p class="card-sub">${(0, exports.artistLinks)((0, exports.artistsOf)(t))}</p></article>`;
// строки для режима «Список» на главной
const lrow = ({ cover, title, sub, nav, act, round }) => `<article class="lrow" tabindex="0" role="${nav ? 'link' : 'button'}" ${nav ? `data-nav="${nav}"` : act ? `data-action="${act}"` : ''}>
  <div class="lrow-cov ${round ? 'round' : ''}">${cover}</div>
  <div class="lrow-main"><div class="lrow-title">${(0, util_js_1.esc)(title)}</div><div class="lrow-sub">${sub}</div></div>
  ${nav && act ? `<button class="icon-btn lrow-play" ${act} aria-label="Играть">${(0, icons_js_1.icon)('play')}</button>` : ''}</article>`;
const albumRow = (g, single) => lrow({ cover: (0, exports.cov)(g.cover, g.key), title: g.name, nav: albumHref(g.key), act: `data-action="play-album" data-key="${(0, util_js_1.esc)(g.key)}"`,
    sub: `${(0, exports.artistLinks)(g.artists)}${single ? ' · ' + (g.tracks.length === 1 ? 'Сингл' : 'EP') : g.year ? ' · ' + (0, util_js_1.esc)(g.year) : ''}` });
const artistRow = a => lrow({ cover: (0, exports.artistArt)(a), round: true, title: a.name, nav: artistHref(a.key), act: `data-action="play-artist" data-key="${(0, util_js_1.esc)(a.key)}"`, sub: (0, util_js_1.plural)(a.tracks.length, ['песня', 'песни', 'песен']) });
const playlistRow = p => { const ts = (0, state_js_1.playlistTracks)(p); return lrow({ cover: (0, exports.mosaic)(ts, p.id), title: p.name, nav: `#/playlist/${p.id}`, act: `data-action="play-playlist" data-id="${p.id}"`, sub: (0, util_js_1.plural)(ts.length, ['песня', 'песни', 'песен']) }); };
const likedRow = () => lrow({ cover: `<div class="cov liked-cov">${(0, icons_js_1.icon)('heart-fill')}</div>`, title: 'Понравившееся', nav: '#/liked', act: 'data-action="play-liked"', sub: (0, util_js_1.plural)(state_js_1.state.likes.size, ['песня', 'песни', 'песен']) });
const newPlaylistRow = () => lrow({ cover: `<div class="cov new-cov">${(0, icons_js_1.icon)('plus')}</div>`, title: 'Новый плейлист', act: 'new-playlist', sub: 'Создать' });
function trackRow(t, i, lid, o = {}) {
    const cur = (0, player_js_1.current)()?.id === t.id;
    return `<div class="row ${cur ? 'is-current' : ''}" tabindex="0" role="button" data-track="${(0, util_js_1.esc)(t.id)}" data-list="${lid}" data-i="${i}">
    <div class="row-lead">
      ${o.cover ? `<div class="row-cover">${(0, exports.cov)(t.cover, t._albumKey || t.id)}<span class="row-cover-ov"><span class="eq"><i></i><i></i><i></i></span>${(0, icons_js_1.icon)('play')}</span></div>`
        : `<span class="num">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span><span class="row-play">${(0, icons_js_1.icon)('play')}</span>`}
    </div>
    <div class="row-main"><div class="row-title">${(0, util_js_1.esc)(t.title)}</div><div class="row-artist">${(0, exports.artistLinks)((0, exports.artistsOf)(t))}</div></div>
    <div class="row-album">${t.album ? (0, exports.albumLink)(t) : '—'}</div>
    <button class="icon-btn row-del" data-action="delete-track" data-id="${(0, util_js_1.esc)(t.id)}" aria-label="Удалить песню" title="Удалить песню">${(0, icons_js_1.icon)('trash')}</button>
    <button class="icon-btn like ${state_js_1.state.likes.has(t.id) ? 'on' : ''}" data-action="like" data-id="${(0, util_js_1.esc)(t.id)}" aria-label="Нравится">${(0, icons_js_1.icon)(state_js_1.state.likes.has(t.id) ? 'heart-fill' : 'heart')}</button>
    <div class="row-time">${(0, util_js_1.fmtTime)(t.duration)}</div>
    <button class="icon-btn" data-action="menu" data-id="${(0, util_js_1.esc)(t.id)}" ${o.pid ? `data-pid="${o.pid}"` : ''} aria-label="Ещё">${(0, icons_js_1.icon)('more')}</button>
  </div>`;
}
const trackList = (tracks, o = {}) => { const lid = (0, exports.registerList)(tracks); return `<div class="tracklist" data-lid="${lid}">${tracks.map((t, i) => trackRow(t, i, lid, o)).join('')}</div>`; };
function emptyState(compact) {
    return `<div class="empty ${compact ? 'compact' : ''}">
    <div class="empty-icon">${(0, icons_js_1.icon)('tower')}</div>
    <h2>${compact ? 'Здесь пока пусто' : 'Добавьте свою музыку'}</h2>
    <p>${native_js_1.isNative ? 'Выберите одну папку с музыкой — вся медиатека загрузится из неё, как в Poweramp.' : 'Перетащите файлы или целую папку прямо в окно. Поддерживаются MP3, FLAC, AAC / M4A, OGG, WAV, тексты <b>.lrc</b> и плейлисты <b>.m3u / .m3u8</b>.'}</p>
    <div class="empty-actions">${native_js_1.isNative ? `<button class="btn btn-primary" data-action="add-folder">${(0, icons_js_1.icon)('folder')}Выбрать папку с музыкой</button><button class="btn btn-soft" data-action="add-files">${(0, icons_js_1.icon)('upload')}Добавить треки</button>` : `<button class="btn btn-primary" data-action="add-files">${(0, icons_js_1.icon)('upload')}Выбрать файлы</button><button class="btn btn-soft" data-action="add-folder">${(0, icons_js_1.icon)('folder')}Выбрать папку</button>`}</div>
  </div>`;
}
const themeBtn = () => `<button class="icon-btn lg theme-btn" data-action="toggle-theme" aria-label="Сменить тему" title="Сменить тему (D)">${(0, icons_js_1.icon)(state_js_1.state.theme === 'dark' ? 'sun' : 'moon')}</button>`;
function pageHead(title, sub = '', extra = '') {
    return `<header class="page-head"><div><h1>${(0, util_js_1.esc)(title)}</h1>${sub ? `<p class="page-sub">${(0, util_js_1.esc)(sub)}</p>` : ''}</div><div class="page-head-r">${extra}<button class="icon-btn lg import-link-mobile" data-action="import-link" aria-label="Загрузить по ссылке" title="Загрузить по ссылке">${(0, icons_js_1.icon)('download')}</button><button class="icon-btn lg" data-nav="#/settings" aria-label="Настройки" title="Настройки">${(0, icons_js_1.icon)('settings')}</button>${themeBtn()}<button class="avatar-btn" data-nav="#/profile" aria-label="Профиль">${(0, exports.avatarHTML)()}</button></div></header>`;
}
function hero({ art, eyebrow, title, subHTML = '', meta = '', actions = '', bg = '', round = false }) {
    return `<section class="hero">
    ${bg ? `<div class="hero-bg" style="background-image:url('${bg}')"></div>` : '<div class="hero-bg plain"></div>'}
    <div class="hero-in"><div class="hero-art ${round ? 'round' : ''}">${art}</div>
      <div class="hero-text"><p class="eyebrow">${(0, util_js_1.esc)(eyebrow)}</p><h1>${(0, util_js_1.esc)(title)}</h1>${subHTML ? `<p class="hero-sub">${subHTML}</p>` : ''}${meta ? `<p class="hero-meta">${meta}</p>` : ''}
      <div class="hero-actions">${actions}</div></div></div></section>`;
}
const playBtns = (playAct, shufAct, attrs) => `<button class="btn btn-primary" data-action="${playAct}" ${attrs}>${(0, icons_js_1.icon)('play')}Играть</button><button class="btn btn-soft" data-action="${shufAct}" ${attrs}>${(0, icons_js_1.icon)('shuffle')}Перемешать</button>`;
// ---------- миксы: собираются из того, что слушает пользователь ----------
const MIX_MAX = 50;
function mixes() {
    const d = (0, state_js_1.derived)(), all = d.all, pl = state_js_1.state.plays, likes = state_js_1.state.likes;
    const seed = k => (0, util_js_1.hash)('mix:' + k) ^ util_js_1.SESSION_SEED;
    const recent = new Set(state_js_1.state.recents);
    // 1) понравившиеся вперемешку
    const liked = (0, util_js_1.seededShuffle)((0, state_js_1.likedTracks)(), seed('liked'));
    // 2) самые прослушанные
    const top = all.filter(t => pl[t.id] > 0).sort((a, b) => pl[b.id] - pl[a.id] || (likes.has(b.id) ? 1 : 0) - (likes.has(a.id) ? 1 : 0));
    // 3) любимые артисты: прослушивания + лайки (лайк = 3 прослушивания), берём пятёрку лучших
    const score = a => a.tracks.reduce((s, t) => s + (pl[t.id] || 0) + (likes.has(t.id) ? 3 : 0), 0);
    const favArtists = d.artistList.map(a => [a, score(a)]).filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 5).map(x => x[0]);
    const favSet = new Map();
    for (const a of favArtists)
        for (const t of a.tracks)
            favSet.set(t.id, t);
    const artists = (0, util_js_1.seededShuffle)([...favSet.values()], seed('artists'));
    // 4) давно не слушали: то, что нравилось или слушалось, но не попадало в недавние
    const forgotten = (0, util_js_1.seededShuffle)(all.filter(t => !recent.has(t.id) && (pl[t.id] > 0 || likes.has(t.id))), seed('forgotten'));
    // 5) ещё не слушали: ни одного прослушивания, сначала недавно добавленные
    const fresh = all.filter(t => !pl[t.id] && !likes.has(t.id)).sort((a, b) => b.addedAt - a.addedAt);
    const fav = favArtists.slice(0, 3).map(a => a.name).join(', ');
    return [
        { id: 'liked', n: 1, name: 'Микс понравившегося', desc: 'Ваши лайки в случайном порядке', tracks: liked },
        { id: 'top', n: 2, name: 'Самое прослушиваемое', desc: 'Треки, которые вы включаете чаще всего', tracks: top },
        { id: 'artists', n: 3, name: 'Любимые артисты', desc: fav ? `${fav} и не только` : 'Слушайте и ставьте лайки — микс соберётся сам', tracks: artists },
        { id: 'forgotten', n: 4, name: 'Давно не слушали', desc: 'Любимое, что давно не звучало', tracks: forgotten },
        { id: 'fresh', n: 5, name: 'Ещё не слушали', desc: 'Песни из библиотеки, до которых не дошли руки', tracks: fresh },
    ].map(m => ({ ...m, tracks: m.tracks.slice(0, MIX_MAX) }));
}
function mixById(id) { return mixes().find(m => m.id === id) || null; }
const mixArt = m => `<div class="mix-art mix-${m.n}">${(0, exports.mosaic)(m.tracks, 'mix' + m.id)}<span class="mix-shade"></span><span class="mix-label">${(0, icons_js_1.icon)('mix')}<b>${(0, util_js_1.esc)(m.name)}</b></span></div>`;
const mixCard = m => `<article class="card" tabindex="0" role="link" data-nav="#/mix/${m.id}">
  <div class="card-art">${mixArt(m)}<button class="play-fab" data-action="play-mix" data-id="${m.id}" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button></div>
  <h3 class="card-title">${(0, util_js_1.esc)(m.name)}</h3><p class="card-sub">${m.tracks.length ? (0, util_js_1.plural)(m.tracks.length, ['песня', 'песни', 'песен']) : 'Пока пусто'}</p></article>`;
const mixRow = m => lrow({ cover: mixArt(m), title: m.name, nav: `#/mix/${m.id}`, act: `data-action="play-mix" data-id="${m.id}"`, sub: m.tracks.length ? (0, util_js_1.plural)(m.tracks.length, ['песня', 'песни', 'песен']) : 'Пока пусто' });
function mixView(id) {
    const m = mixById(id);
    if (!m)
        return notFound();
    const total = m.tracks.reduce((s, t) => s + t.duration, 0);
    return hero({ art: mixArt(m), eyebrow: 'Микс', title: m.name, bg: m.tracks.find(t => t.cover)?.cover, subHTML: (0, util_js_1.esc)(m.desc),
        meta: `${(0, util_js_1.plural)(m.tracks.length, ['песня', 'песни', 'песен'])}${m.tracks.length ? ', ' + (0, util_js_1.fmtTotal)(total) : ''}`,
        actions: m.tracks.length ? playBtns('play-mix', 'shuffle-mix', `data-id="${m.id}"`) : '' })
        + `<div class="detail">${m.tracks.length ? trackList(m.tracks, { cover: true }) : `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('mix')}</div><h2>Пока пусто</h2><p>${(0, util_js_1.esc)(m.desc)}. Слушайте музыку и ставьте лайки — микс обновится сам.</p></div>`}</div>`;
}
// ---------- экраны ----------
function greeting() {
    const h = new Date().getHours();
    const g = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    return `${g}, ${state_js_1.state.profile.name}`;
}
// Раздел главной в выбранном виде: лента / сетка / список
function block(mode, title, { cards, rows, href, railMax = 14, gridMax = 18, listMax = 8 }) {
    if (mode === 'grid')
        return section(title, `<div class="grid">${cards.slice(0, gridMax).join('')}</div>`, { href });
    if (mode === 'list')
        return section(title, `<div class="list-rows">${rows.slice(0, listMax).join('')}</div>`, { href });
    return section(title, rail(cards.slice(0, railMax).join('')), { href });
}
const HOME_VIEWS = [['rail', 'view-rail', 'Лента'], ['grid', 'view-grid', 'Сетка'], ['list', 'view-list', 'Список']];
const viewSwitch = mode => `<div class="seg seg-icons" role="group" aria-label="Вид главной">${HOME_VIEWS.map(([k, ic, n]) => `<button class="${k === mode ? 'on' : ''}" data-action="home-view" data-v="${k}" title="${n}" aria-label="${n}">${(0, icons_js_1.icon)(ic)}</button>`).join('')}</div>`;
exports.viewSwitch = viewSwitch;
// Разделы главной: порядок и видимость настраиваются (Настройки → Главная)
exports.HOME_SECTIONS = [['continue', 'Продолжить'], ['quick', 'Быстрые кнопки'], ['recents', 'Недавно прослушанное'], ['mixes', 'Миксы для вас'], ['albums', 'Альбомы'], ['singles', 'Синглы'], ['playlists', 'Плейлисты'], ['artists', 'Артисты']];
function homeOrder() {
    const all = exports.HOME_SECTIONS.map(x => x[0]), o = (state_js_1.state.settings.homeOrder || []).filter(k => all.includes(k));
    return [...o, ...all.filter(k => !o.includes(k))];
}
const homeHidden = () => new Set([...(state_js_1.state.settings.homeHidden || []), ...(state_js_1.state.settings.homeRecents === false ? ['recents'] : [])]);
exports.homeHidden = homeHidden;
// «Продолжить»: песня, на которой остановились (или которая играет сейчас)
function continueCard() {
    const t = (0, player_js_1.current)() || (0, state_js_1.getTrack)(state_js_1.state.recents[0]);
    if (!t)
        return '';
    const g = (0, state_js_1.derived)().groups.get(t._albumKey);
    return `<section class="cont" data-track-id="${(0, util_js_1.esc)(t.id)}">
    ${t.cover ? `<div class="cont-bg" style="background-image:url('${t.cover}')"></div>` : ''}
    <div class="cont-art">${(0, exports.cov)(t.cover, t._albumKey || t.id)}</div>
    <div class="cont-text"><p class="eyebrow">Продолжить</p><h2>${(0, util_js_1.esc)(t.title)}</h2><p class="cont-sub">${(0, exports.artistLinks)((0, exports.artistsOf)(t))}${t.album ? ' · ' + (0, exports.albumLink)(t) : ''}</p>
      <div class="cont-actions"><button class="btn btn-primary" data-action="home-continue" data-id="${(0, util_js_1.esc)(t.id)}">${(0, icons_js_1.icon)('play')}Слушать дальше</button>${g && g.tracks.length > 1 ? `<a class="btn btn-soft" href="${albumHref(g.key)}">${(0, icons_js_1.icon)('disc')}Открыть альбом</a>` : ''}</div></div></section>`;
}
const quickBar = () => `<div class="quick"><button class="qbtn" data-action="shuffle-all">${(0, icons_js_1.icon)('shuffle')}Перемешать всё</button><a class="qbtn" href="#/liked">${(0, icons_js_1.icon)('heart-fill')}Понравившееся</a><button class="qbtn" data-action="recent-added">${(0, icons_js_1.icon)('plus')}Недавно добавленные</button></div>`;
function homeView() {
    const d = (0, state_js_1.derived)(), mode = state_js_1.state.settings.homeView || 'rail';
    if (!d.all.length)
        return pageHead('Главная', greeting()) + emptyState();
    const hidden = (0, exports.homeHidden)();
    const artists = d.artistList.filter(a => a.name !== artists_js_1.UNKNOWN); // «Неизвестного артиста» на главной не показываем
    const parts = {
        continue: () => continueCard(),
        quick: () => quickBar(),
        recents: () => {
            const rec = state_js_1.state.recents.map(state_js_1.getTrack).filter(Boolean).slice(0, 18);
            if (!rec.length)
                return '';
            const lid = (0, exports.registerList)(rec);
            return mode === 'list'
                ? section('Недавно прослушанное', `<div class="tracklist" data-lid="${lid}">${rec.slice(0, 8).map((t, i) => trackRow(t, i, lid, { cover: true })).join('')}</div>`)
                : block(mode, 'Недавно прослушанное', { cards: rec.map((t, i) => recentCard(t, i, lid)), rows: [] });
        },
        mixes: () => {
            const mx = mixes().filter(m => m.tracks.length); // пустые миксы не показываем
            return mx.length ? block(mode, 'Миксы для вас', { cards: mx.map(mixCard), rows: mx.map(mixRow), listMax: 5 }) : '';
        },
        albums: () => d.albums.length ? block(mode, 'Альбомы', { cards: d.albums.map(albumCard), rows: d.albums.map(g => albumRow(g, false)), href: '#/library/albums' }) : '',
        singles: () => d.singles.length ? block(mode, 'Синглы', { cards: d.singles.map(singleCard), rows: d.singles.map(g => albumRow(g, true)), href: '#/library/singles' }) : '',
        playlists: () => block(mode, 'Плейлисты', { cards: [likedCard(), ...state_js_1.state.playlists.map(playlistCard), newPlaylistCard()], rows: [likedRow(), ...state_js_1.state.playlists.map(playlistRow), newPlaylistRow()], href: '#/library/playlists', railMax: 14, gridMax: 18, listMax: 8 }),
        artists: () => artists.length ? block(mode, 'Артисты', { cards: artists.map(a => artistCard(a)), rows: artists.map(artistRow), href: '#/library/artists' }) : '',
    };
    return pageHead('Главная', greeting(), (0, exports.viewSwitch)(mode)) + homeOrder().filter(k => !hidden.has(k)).map(k => parts[k]()).join('');
}
const TABS = [['media', 'Медиатека'], ['albums', 'Альбомы'], ['singles', 'Синглы'], ['playlists', 'Плейлисты'], ['artists', 'Артисты'], ['songs', 'Песни']];
exports.songSort = 'title';
const setSongSort = v => { exports.songSort = v; };
exports.setSongSort = setSongSort;
function libraryView(tab = 'albums') {
    const d = (0, state_js_1.derived)();
    const tabs = `<nav class="seg-tabs" role="tablist">${TABS.map(([k, n]) => `<a role="tab" aria-selected="${k === tab}" class="${k === tab ? 'active' : ''}" href="#/library/${k}">${n}</a>`).join('')}</nav>`;
    const actions = native_js_1.isNative ? `<button class="btn btn-soft sm" data-action="add-files">${(0, icons_js_1.icon)('plus')}Треки</button><button class="btn btn-soft sm" data-action="add-folder">${(0, icons_js_1.icon)('folder')}Папка</button>` : `<button class="btn btn-soft sm" data-action="add-files">${(0, icons_js_1.icon)('plus')}Добавить</button>`;
    const title = tab === 'media' ? 'Медиатека' : 'Библиотека';
    const sub = tab === 'media' ? `${(0, util_js_1.plural)(d.albums.length, ['альбом', 'альбома', 'альбомов'])} · ${(0, util_js_1.plural)(d.singles.length, ['сингл', 'сингла', 'синглов'])}` : (0, util_js_1.plural)(d.all.length, ['песня', 'песни', 'песен']);
    let h = pageHead(title, sub, actions) + tabs;
    let body = '';
    if (tab === 'media') {
        const rel = [...d.albums, ...d.singles].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
        body = rel.length ? `<div class="grid">${rel.map(g => g.tracks.length > 1 ? albumCard(g) : singleCard(g)).join('')}</div>` : emptyState(true);
    }
    else if (tab === 'albums')
        body = d.albums.length ? `<div class="grid">${d.albums.map(albumCard).join('')}</div>` : emptyState(true);
    else if (tab === 'singles')
        body = d.singles.length ? `<div class="grid">${d.singles.map(singleCard).join('')}</div>` : emptyState(true);
    else if (tab === 'artists')
        body = d.artistList.length ? `<div class="grid artists">${[...d.artistList.filter(a => a.name !== artists_js_1.UNKNOWN), ...d.artistList.filter(a => a.name === artists_js_1.UNKNOWN)].map(a => artistCard(a)).join('')}</div>` : emptyState(true);
    else if (tab === 'playlists') {
        body = `<div class="grid">${likedCard()}${state_js_1.state.playlists.map(playlistCard).join('')}${state_js_1.state.smart.map(smartCard).join('')}${newPlaylistCard()}${newSmartCard()}</div>
`;
    }
    else {
        if (!d.all.length)
            body = emptyState(true);
        else {
            let songs = d.songs.slice();
            const by = { title: null, artist: (a, b) => (a.artist || '').localeCompare(b.artist || '', 'ru') || a.title.localeCompare(b.title, 'ru'), added: (a, b) => b.addedAt - a.addedAt, duration: (a, b) => b.duration - a.duration, album: (a, b) => (a.album || '').localeCompare(b.album || '', 'ru') };
            if (by[exports.songSort])
                songs.sort(by[exports.songSort]);
            const chips = [['title', 'Название'], ['artist', 'Артист'], ['album', 'Альбом'], ['added', 'Недавно добавленные'], ['duration', 'Длительность']];
            body = `<div class="chips">${chips.map(([k, n]) => `<button class="chip ${k === exports.songSort ? 'on' : ''}" data-action="sort" data-v="${k}">${n}</button>`).join('')}</div>${trackList(songs, { cover: true })}`;
        }
    }
    return h + body;
}
function albumView(key) {
    const g = (0, state_js_1.derived)().groups.get(key);
    if (!g)
        return notFound();
    const total = g.tracks.reduce((s, t) => s + t.duration, 0);
    const meta = [g.genre, g.year].filter(Boolean).map(util_js_1.esc).join(' · ');
    return hero({
        art: (0, exports.cov)(g.cover, g.key), eyebrow: g.tracks.length > 1 ? 'Альбом' : 'Сингл', title: g.name, bg: g.cover,
        subHTML: (0, exports.artistLinks)(g.artists),
        meta: `${meta}${meta ? ' · ' : ''}${(0, util_js_1.plural)(g.tracks.length, ['песня', 'песни', 'песен'])}, ${(0, util_js_1.fmtTotal)(total)}`,
        actions: playBtns('play-album', 'shuffle-album', `data-key="${(0, util_js_1.esc)(g.key)}"`) + `<button class="icon-btn lg" data-action="album-menu" data-key="${(0, util_js_1.esc)(g.key)}" aria-label="Ещё">${(0, icons_js_1.icon)('more')}</button>`,
    }) + `<div class="detail">${trackList(g.tracks, {})}</div>`;
}
// ---------- страница артиста ----------
function topSongs(a, n = 9) {
    const pl = state_js_1.state.plays, rec = id => state_js_1.state.recents.indexOf(id) + 1 || 999;
    const top = a.tracks.filter(t => pl[t.id] > 0).sort((x, y) => pl[y.id] - pl[x.id] || rec(x.id) - rec(y.id)).slice(0, n);
    if (top.length < n) { // ещё не слушали — добираем случайными (стабильно в рамках сессии)
        const rest = (0, util_js_1.seededShuffle)(a.tracks.filter(t => !top.includes(t)), (0, util_js_1.hash)(a.key) ^ util_js_1.SESSION_SEED);
        top.push(...rest.slice(0, n - top.length));
    }
    return top;
}
function similarArtists(a, d, n = 12) {
    const score = new Map();
    for (const t of a.tracks)
        for (const k of t._artistKeys)
            if (k !== a.key)
                score.set(k, (score.get(k) || 0) + 5); // соавторы — в первую очередь
    for (const o of d.artistList) {
        if (o === a)
            continue;
        let c = 0;
        for (const g of o.genres)
            if (a.genres.has(g))
                c++;
        if (c)
            score.set(o.key, (score.get(o.key) || 0) + c);
    }
    const rnd = new Map(d.artistList.map(o => [o.key, ((0, util_js_1.hash)(o.key + a.key) ^ util_js_1.SESSION_SEED) % 1000 / 1000]));
    const list = d.artistList.filter(o => o !== a).sort((x, y) => (score.get(y.key) || 0) - (score.get(x.key) || 0) || rnd.get(x.key) - rnd.get(y.key));
    return list.slice(0, n);
}
const topRow = (t, i, lid) => {
    const g = (0, state_js_1.derived)().groups.get(t._albumKey);
    const rel = g ? (g.tracks.length === 1 ? `${g.name} · Сингл` : g.name) : (t.album || '');
    const sub = [rel, t.year].filter(Boolean).map(util_js_1.esc).join(' · ');
    const liked = state_js_1.state.likes.has(t.id);
    return `<div class="trow ${(0, player_js_1.current)()?.id === t.id ? 'is-current' : ''}" tabindex="0" role="button" data-track="${(0, util_js_1.esc)(t.id)}" data-list="${lid}" data-i="${i}">
    <div class="trow-cov">${(0, exports.cov)(t.cover, t._albumKey || t.id)}<span class="trow-ov"><span class="eq"><i></i><i></i><i></i></span>${(0, icons_js_1.icon)('play')}</span></div>
    <div class="trow-main"><div class="trow-title">${(0, util_js_1.esc)(t.title)}</div><div class="trow-sub">${sub}</div></div>
    <button class="icon-btn sm like ${liked ? 'on' : ''}" data-action="like" data-id="${(0, util_js_1.esc)(t.id)}" aria-label="Нравится">${(0, icons_js_1.icon)(liked ? 'heart-fill' : 'heart')}</button>
    <button class="icon-btn sm" data-action="menu" data-id="${(0, util_js_1.esc)(t.id)}" aria-label="Ещё">${(0, icons_js_1.icon)('more')}</button>
  </div>`;
};
function artistView(key) {
    const d = (0, state_js_1.derived)(), a = d.artists.get(key);
    if (!a)
        return notFound();
    const own = a.own, albums = own.filter(g => g.tracks.length > 3), eps = own.filter(g => g.tracks.length <= 3);
    const latest = own[0] || a.collab[0];
    const top = topSongs(a), lid = (0, exports.registerList)(top);
    const similar = similarArtists(a, d);
    let h = `<section class="artist-hero">
    ${(a.backdrop || a.cover) ? `<div class="hero-bg" style="background-image:url('${a.backdrop || a.cover}')"></div>` : '<div class="hero-bg plain"></div>'}
    <div class="artist-avatar">${(0, exports.artistArt)(a)}</div>
    <h1 class="artist-name">${(0, util_js_1.esc)(a.name)}</h1>
    <div class="artist-actions">
      <button class="icon-btn lg ghost" data-action="shuffle-artist" data-key="${(0, util_js_1.esc)(a.key)}" aria-label="Перемешать">${(0, icons_js_1.icon)('shuffle')}</button>
      <button class="play-btn" data-action="play-artist" data-key="${(0, util_js_1.esc)(a.key)}" aria-label="Играть">${(0, icons_js_1.icon)('play')}</button>
      <button class="icon-btn lg ghost" data-action="radio-artist" data-key="${(0, util_js_1.esc)(a.key)}" aria-label="Случайные песни артиста">${(0, icons_js_1.icon)('queue')}</button>
      <button class="icon-btn lg ghost" data-action="artist-photo" data-key="${(0, util_js_1.esc)(a.key)}" aria-label="Фото артиста" title="Фото артиста">${(0, icons_js_1.icon)('edit')}</button>
    </div>
  </section><div class="artist-body">`;
    if (latest || top.length) {
        h += `<div class="a-row1">`;
        if (latest) {
            const lt = latest.tracks.length;
            h += `<section class="latest"><h3 class="a-h">Последний релиз</h3>
        <article class="latest-card" tabindex="0" role="link" data-nav="${albumHref(latest.key)}">
          <div class="latest-cov">${(0, exports.cov)(latest.cover, latest.key)}</div>
          <div class="latest-text"><span class="latest-date">${(0, util_js_1.esc)(latest.year || '')}</span><b>${(0, util_js_1.esc)(latest.name)}</b><span class="latest-sub">${lt === 1 ? 'Сингл' : (0, util_js_1.plural)(lt, ['песня', 'песни', 'песен'])}</span></div>
        </article></section>`;
        }
        h += `<section class="tops"><h3 class="a-h">Топ-песни</h3><div class="top-grid">${top.map((t, i) => topRow(t, i, lid)).join('')}</div></section></div>`;
    }
    if (albums.length)
        h += section('Альбомы', rail(albums.map(albumCard).join('')));
    if (eps.length)
        h += section('Синглы и EP', rail(eps.map(singleCard).join('')));
    if (a.collab.length)
        h += section('Совместные проекты', rail(a.collab.map(g => (g.tracks.length > 3 ? albumCard : singleCard)(g)).join('')));
    if (similar.length)
        h += section('Похожие артисты', rail(similar.map(o => artistCard(o, { sub: false })).join('')));
    return h + '</div>';
}
function playlistLike({ id, name, tracks, eyebrow, art, bg, special, emptyHTML }) {
    const total = tracks.reduce((s, t) => s + t.duration, 0);
    const acts = tracks.length ? playBtns('play-playlist', 'shuffle-playlist', `data-id="${id}"`) : '';
    const more = special ? '' : `<button class="icon-btn lg" data-action="playlist-menu" data-id="${id}" aria-label="Ещё">${(0, icons_js_1.icon)('more')}</button>`;
    return hero({ art, eyebrow, title: name, bg, meta: `${(0, util_js_1.plural)(tracks.length, ['песня', 'песни', 'песен'])}${tracks.length ? ', ' + (0, util_js_1.fmtTotal)(total) : ''}`, actions: acts + more })
        + `<div class="detail">${tracks.length ? trackList(tracks, { pid: special ? '' : id }) : emptyHTML}</div>`;
}
function playlistView(id) {
    const p = state_js_1.state.playlists.find(x => x.id === id);
    if (!p)
        return notFound();
    const tracks = (0, state_js_1.playlistTracks)(p);
    return playlistLike({ id: p.id, name: p.name, tracks, eyebrow: 'Плейлист', art: (0, exports.mosaic)(tracks, p.id), bg: tracks.find(t => t.cover)?.cover,
        emptyHTML: `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('playlist')}</div><h2>Плейлист пуст</h2><p>Откройте меню «⋯» у любого трека и выберите «Добавить в плейлист».</p></div>` });
}
function likedView() {
    const tracks = (0, state_js_1.likedTracks)();
    return playlistLike({ id: 'liked', name: 'Понравившееся', tracks, eyebrow: 'Плейлист', art: `<div class="cov liked-cov">${(0, icons_js_1.icon)('heart-fill')}</div>`, bg: '', special: true,
        emptyHTML: `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('heart')}</div><h2>Пока ничего нет</h2><p>Нажмите на сердечко рядом с треком — он появится здесь.</p></div>` })
        .replace('data-action="play-playlist"', 'data-action="play-liked"').replace('data-action="shuffle-playlist"', 'data-action="shuffle-liked"');
}
// ---------- умный плейлист ----------
function smartView(id) {
    const p = state_js_1.state.smart.find(x => x.id === id);
    if (!p)
        return notFound();
    const tracks = (0, state_js_1.smartTracks)(p), total = tracks.reduce((s, t) => s + t.duration, 0);
    return hero({ art: `<div class="smart-art">${(0, exports.mosaic)(tracks, p.id)}<span class="smart-badge">${(0, icons_js_1.icon)('smart')}</span></div>`, eyebrow: 'Умный плейлист', title: p.name, bg: tracks.find(t => t.cover)?.cover,
        subHTML: (0, util_js_1.esc)(smartRulesText(p.rules)),
        meta: `${(0, util_js_1.plural)(tracks.length, ['песня', 'песни', 'песен'])}${tracks.length ? ', ' + (0, util_js_1.fmtTotal)(total) : ''}`,
        actions: (tracks.length ? playBtns('play-smart', 'shuffle-smart', `data-id="${p.id}"`) : '') + `<button class="icon-btn lg" data-action="smart-menu" data-id="${p.id}" aria-label="Ещё">${(0, icons_js_1.icon)('more')}</button>` })
        + `<div class="detail">${tracks.length ? trackList(tracks, {}) : `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('smart')}</div><h2>Под правила пока ничего не подходит</h2><p>Измените правила в меню «⋯» — плейлист обновится сам.</p></div>`}</div>`;
}
function smartRulesText(r = {}) {
    const p = [];
    if (r.liked)
        p.push('понравившиеся');
    if (r.artist)
        p.push(`артист: ${r.artist}`);
    if (r.genre)
        p.push(`жанр: ${r.genre}`);
    if (r.minPlays)
        p.push(`прослушано от ${r.minPlays} раз`);
    if (r.notPlayedDays)
        p.push(`не слушали ${r.notPlayedDays} дн.`);
    if (r.addedDays)
        p.push(`добавлены за ${r.addedDays} дн.`);
    if (r.limit)
        p.push(`не больше ${r.limit}`);
    return p.length ? p.join(' · ') : 'Все песни библиотеки';
}
// ---------- итоги ----------
const PERIODS = [['week', 'Неделя', 7], ['month', 'Месяц', 30], ['year', 'Год', 365], ['all', 'Всё время', 0]];
function statsView(period = 'month') {
    const per = PERIODS.find(x => x[0] === period) || PERIODS[1], since = per[2] ? Date.now() - per[2] * 864e5 : 0;
    const log = state_js_1.state.playLog.filter(x => x[1] >= since);
    // «Всё время» — ещё и прослушивания до появления журнала (из счётчиков)
    const counts = new Map();
    if (per[0] === 'all')
        for (const [id, n] of Object.entries(state_js_1.state.plays))
            counts.set(id, n);
    else
        for (const [id] of log)
            counts.set(id, (counts.get(id) || 0) + 1);
    const plays = [...counts.values()].reduce((a, b) => a + b, 0);
    const secs = per[0] === 'all' ? [...counts].reduce((s, [id, n]) => s + n * ((0, state_js_1.getTrack)(id)?.duration || 0), 0) : log.reduce((s, x) => s + (x[2] || 0), 0);
    const topTracks = [...counts].map(([id, n]) => [(0, state_js_1.getTrack)(id), n]).filter(x => x[0]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const art = new Map();
    for (const [id, n] of counts) {
        const t = (0, state_js_1.getTrack)(id);
        if (t)
            for (const a of (0, artists_js_1.trackArtists)(t))
                art.set(a, (art.get(a) || 0) + n);
    }
    const topArtists = [...art].sort((a, b) => b[1] - a[1]).slice(0, 6);
    // по дням недели
    const days = [0, 0, 0, 0, 0, 0, 0];
    for (const x of log)
        days[(new Date(x[1]).getDay() + 6) % 7]++;
    const dmax = Math.max(1, ...days);
    const tabs = `<div class="seg stats-tabs">${PERIODS.map(([k, n]) => `<button class="${k === per[0] ? 'on' : ''}" data-nav="#/stats/${k}">${n}</button>`).join('')}</div>`;
    let h = pageHead('Итоги', 'Что и сколько вы слушали') + tabs;
    if (!plays)
        return h + `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('chart')}</div><h2>Пока нечего считать</h2><p>Прослушивание засчитывается после 30 секунд песни. Послушайте музыку — итоги появятся здесь.</p></div>`;
    const mins = Math.round(secs / 60);
    h += `<div class="stats-kpis"><div class="kpi"><b>${mins < 600 ? mins + ' мин' : Math.round(mins / 60) + ' ч'}</b><span>музыки</span></div><div class="kpi"><b>${plays}</b><span>прослушиваний</span></div><div class="kpi"><b>${counts.size}</b><span>разных песен</span></div><div class="kpi"><b>${art.size}</b><span>артистов</span></div></div>`;
    if (topArtists.length)
        h += `<section class="section"><div class="section-head"><h2>Любимые артисты</h2></div><div class="stats-artists">${topArtists.map(([a, n], i) => `<a class="stats-artist" href="#/artist/${(0, util_js_1.enc)((0, artists_js_1.artistKey)(a))}"><span class="rank">${i + 1}</span><span class="name">${(0, util_js_1.esc)(a)}</span><span class="n">${(0, util_js_1.plural)(n, ['раз', 'раза', 'раз'])}</span></a>`).join('')}</div></section>`;
    if (topTracks.length) {
        const lid = (0, exports.registerList)(topTracks.map(x => x[0]));
        h += `<section class="section"><div class="section-head"><h2>Самые прослушиваемые песни</h2></div><div class="tracklist" data-lid="${lid}">${topTracks.map(([t, n], i) => trackRow(t, i, lid, { cover: true }).replace(/<div class="row-album">[\s\S]*?<\/div>\n/, `<div class="row-album stats-n">${(0, util_js_1.plural)(n, ['прослушивание', 'прослушивания', 'прослушиваний'])}</div>\n`)).join('')}</div></section>`;
    }
    if (log.length)
        h += `<section class="section"><div class="section-head"><h2>По дням недели</h2></div><div class="stats-days">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => `<div class="day"><i style="height:${Math.round(days[i] / dmax * 100)}%" title="${days[i]}"></i><span>${d}</span></div>`).join('')}</div></section>`;
    return h;
}
function notFound() { return `<div class="empty"><div class="empty-icon">${(0, icons_js_1.icon)('disc')}</div><h2>Не найдено</h2><p>Возможно, библиотека была очищена.</p><a class="btn btn-primary" href="#/home">На главную</a></div>`; }
// ---------- поиск ----------
function searchView(q = '') {
    return pageHead('Поиск') + `<div class="search-box big">${(0, icons_js_1.icon)('search')}<input class="search-input input-bare" type="search" placeholder="Песни, альбомы, артисты, плейлисты" autocomplete="off" value="${(0, util_js_1.esc)(q)}" id="search-main"></div><div id="search-results">${searchResults(q)}</div>`;
}
const scLink = q => `<a class="sc-link" href="https://soundcloud.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">${(0, icons_js_1.icon)('search')}Искать «${(0, util_js_1.esc)(q)}» на SoundCloud<span>откроется на сайте SoundCloud</span></a>`;
function searchResults(q) {
    const d = (0, state_js_1.derived)();
    const tokens = (0, util_js_1.norm)(q).split(/\s+/).filter(Boolean);
    if (!tokens.length)
        return d.all.length ? `<p class="hint">Начните вводить — результаты появятся сразу.</p>` : emptyState(true);
    const all = (s) => { const n = (0, util_js_1.norm)(s); return tokens.every(t => n.includes(t)); };
    const songs = d.all.filter(t => all(`${t.title} ${t.artist} ${t.album} ${t.genre} ${t.year}`));
    const albums = d.albums.filter(g => all(`${g.name} ${g.artist} ${g.year} ${g.genre}`));
    const singles = d.singles.filter(g => all(`${g.name} ${g.artist}`));
    const artists = d.artistList.filter(a => all(a.name));
    const pls = state_js_1.state.playlists.filter(p => all(p.name));
    if (!songs.length && !albums.length && !singles.length && !artists.length && !pls.length)
        return `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('search')}</div><h2>Ничего не найдено</h2><p>По запросу «${(0, util_js_1.esc)(q)}» в вашей библиотеке нет совпадений.</p></div>` + scLink(q);
    let h = '';
    if (artists.length)
        h += section('Артисты', rail(artists.slice(0, 12).map(a => artistCard(a)).join('')));
    if (albums.length)
        h += section('Альбомы', rail(albums.slice(0, 12).map(albumCard).join('')));
    if (singles.length)
        h += section('Синглы', rail(singles.slice(0, 12).map(singleCard).join('')));
    if (pls.length)
        h += section('Плейлисты', rail(pls.map(playlistCard).join('')));
    if (songs.length)
        h += section('Песни', trackList(songs.slice(0, 60), { cover: true }));
    return h + scLink(q);
}
// ---------- профиль и настройки ----------
exports.ACCENTS = [['white', 'Белый', '#F5F5F7'], ['gold', 'Золото', '#F5C84B'], ['rose', 'Роза', '#FF8FA3'], ['sky', 'Небо', '#7CC4FF'], ['mint', 'Мята', '#6EE7B7'], ['violet', 'Сирень', '#B69CFF']];
const seg = (k, opts, cur) => `<div class="seg">${opts.map(([v, n]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-action="set-setting" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
const sw = (k, on_) => `<button class="switch ${on_ ? 'on' : ''}" role="switch" aria-checked="${!!on_}" data-action="toggle-setting" data-k="${k}"><i></i></button>`;
const srow = (title, desc, ctl) => `<div class="setting"><div><h3>${title}</h3>${desc ? `<p>${desc}</p>` : ''}</div><div class="setting-ctl">${ctl}</div></div>`;
const sleepLabel = () => player_js_1.sleepState.endOfTrack ? 'до конца трека' : player_js_1.sleepState.until ? `ещё ${Math.max(1, Math.round((player_js_1.sleepState.until - Date.now()) / 60000))} мин` : 'выключен';
function profileView() {
    const p = state_js_1.state.profile, d = (0, state_js_1.derived)(), s = state_js_1.state.settings;
    const banner = p.banner ? `<img src="${p.banner}" alt="">` : '';
    return `<section class="profile">
    <div class="profile-banner ${p.banner ? '' : 'default'}">${banner}<button class="btn btn-glass sm" data-action="edit-profile">${(0, icons_js_1.icon)('edit')}Изменить</button></div>
    <div class="profile-body">
      <div class="profile-avatar">${(0, exports.avatarHTML)('xl')}</div>
      <div class="profile-id"><h1>${(0, util_js_1.esc)(p.name)}<button class="icon-btn sm pe-edit" data-action="edit-name" aria-label="Изменить имя" title="Изменить имя">${(0, icons_js_1.icon)('edit')}</button></h1><p class="handle">@${(0, util_js_1.esc)(p.username)}<button class="icon-btn sm pe-edit" data-action="edit-user" aria-label="Изменить ник" title="Изменить ник">${(0, icons_js_1.icon)('edit')}</button></p></div>
      <div class="stats">
        <div><b>${d.all.length}</b><span>песен</span></div><div><b>${d.albums.length + d.singles.length}</b><span>релизов</span></div>
        <div><b>${d.artistList.length}</b><span>артистов</span></div><div><b>${state_js_1.state.likes.size}</b><span>нравится</span></div><div><b>${state_js_1.state.playlists.length}</b><span>плейлистов</span></div>
      </div>

    </div></section>`;
}
// аккаунт и синхронизация между устройствами
function accountSection() {
    const u = sync_js_1.sync.user;
    const when = sync_js_1.sync.lastAt ? new Date(sync_js_1.sync.lastAt).toLocaleString((0, i18n_js_1.isEn)() ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const err = sync_js_1.sync.error ? `<p class="acc-err">${(0, util_js_1.esc)(sync_js_1.sync.error)}</p>` : '';
    if (sync_js_1.sync.status === 'in' && u)
        return `<h2 class="sg-title">Аккаунт</h2><div class="settings">
        ${srow((0, util_js_1.esc)(u.email || u.name || 'Аккаунт Puro Cielo'), `Синхронизация включена: лайки, плейлисты, прослушивания, обложки, точные тексты песен и настройки одинаковые на всех ваших устройствах.${when ? ` Последний раз: ${when}.` : ''}`, `<button class="btn btn-soft sm" data-action="sync-now">${(0, icons_js_1.icon)('refresh')}Сейчас</button><button class="btn btn-soft sm" data-action="sync-out">Выйти</button>`)}
      </div>${err}`;
    return `<h2 class="sg-title">Аккаунт</h2><div class="settings">
        ${srow('Синхронизация между устройствами', 'Войдите тем же аккаунтом, что на сайте, — лайки, плейлисты, прослушивания, обложки, точные тексты песен и настройки станут общими для телефона и компьютера. Музыка остаётся на каждом устройстве.', sync_js_1.sync.status === 'loading' ? '<span class="ly-spin"></span>' : `${(0, sync_js_1.canGoogle)() ? `<button class="btn btn-soft sm" data-action="sync-google">Google</button>` : ''}<button class="btn btn-primary sm" data-action="sync-email">Войти по почте</button>`)}
      </div>${err}`;
}
function settingsView() {
    const s = state_js_1.state.settings;
    const sleepOpts = [[0, 'Выкл'], [15, '15'], [30, '30'], [45, '45'], [60, '60'], ['track', 'Трек']];
    const sleepCur = player_js_1.sleepState.endOfTrack ? 'track' : player_js_1.sleepState.until ? Math.round((player_js_1.sleepState.until - Date.now()) / 60000 / 15) * 15 : 0;
    return `<div class="settings-page"><header class="page-head"><div><h1>Настройки</h1><p class="page-sub">Подстройте плеер под себя</p></div></header>
      ${accountSection()}
      <h2 class="sg-title">Внешний вид</h2>
      <div class="settings">
        ${srow('Тема оформления', 'Тёмная по умолчанию, светлая — для яркого дня.', `<div class="seg"><button class="${state_js_1.state.theme === 'dark' ? 'on' : ''}" data-action="set-theme" data-v="dark">${(0, icons_js_1.icon)('moon')}Тёмная</button><button class="${state_js_1.state.theme === 'light' ? 'on' : ''}" data-action="set-theme" data-v="light">${(0, icons_js_1.icon)('sun')}Светлая</button></div>`)}
        ${srow('Главный экран', 'Как показывать альбомы, синглы, плейлисты и артистов.', (0, exports.viewSwitch)(s.homeView))}
        ${srow('Скругление обложек', 'Мягкие или строгие углы.', seg('corners', [['round', 'Мягкие'], ['sharp', 'Острые']], s.corners))}
        ${srow('Плотность списков', 'Компактный режим вмещает больше строк.', seg('density', [['cozy', 'Свободно'], ['compact', 'Компактно']], s.density))}
        ${srow('Анимации интерфейса', 'Выключите, если приложение работает на слабом устройстве.', sw('anim', s.anim))}
        ${srow('Размер карточек', 'Обложки в рядах и сетках.', seg('cardSize', [['s', 'Мелкие'], ['m', 'Средние'], ['l', 'Крупные']], s.cardSize))}
        ${srow('Язык', 'Язык интерфейса плеера.', seg('lang', [['ru', 'Русский'], ['en', 'English']], s.lang || 'ru'))}
      </div>

      <h2 class="sg-title">Главная</h2>
      <div class="settings home-order">
        <p class="set-note">Порядок разделов на главной: стрелками двигайте выше или ниже, выключателем — скрывайте.</p>
        ${(() => { const o = homeOrder(), hid = (0, exports.homeHidden)(), names = Object.fromEntries(exports.HOME_SECTIONS); return o.map((k, i) => `<div class="setting ho-row"><div><h3>${names[k]}</h3></div><div class="setting-ctl"><button class="icon-btn" data-action="home-move" data-k="${k}" data-d="-1" aria-label="Выше" title="Выше" ${i === 0 ? 'disabled' : ''}>${(0, icons_js_1.icon)('chev-up')}</button><button class="icon-btn" data-action="home-move" data-k="${k}" data-d="1" aria-label="Ниже" title="Ниже" ${i === o.length - 1 ? 'disabled' : ''}>${(0, icons_js_1.icon)('chev-down')}</button><button class="switch ${hid.has(k) ? '' : 'on'}" role="switch" aria-checked="${!hid.has(k)}" data-action="home-toggle" data-k="${k}"><i></i></button></div></div>`).join(''); })()}
      </div>

      <h2 class="sg-title">Фон</h2>
      <div class="settings">
        ${srow('Фон от обложки', 'Тёмная тема: чёрный фон и мягкое свечение в цвет обложки. Светлая тема: свет от самой обложки.', sw('bgCover', s.bgCover))}
        ${srow('Движение фона', 'Свет от обложки медленно плывёт.', sw('bgAnim', s.bgAnim))}
      </div>

      <h2 class="sg-title">Воспроизведение</h2>
      <div class="settings">
        ${srow('Искать обложки', 'Если у песни или альбома нет обложки, плеер найдёт её сам. Заодно найдёт фото артистов.', sw('autoCovers', s.autoCovers !== false))}
        ${srow('Убирать приписки сайтов', 'Например, «Династия (Sefon.Pro)» → «Династия». Файлы не меняются.', sw('stripSource', s.stripSource !== false))}
        ${srow('Тексты песен', 'Если в файле нет текста, плеер сам ищет его онлайн. Не нашёл — покажет «Текст не найден».', sw('autoLyrics', s.autoLyrics))}
        ${srow('Найти тексты для всей библиотеки', 'Плеер сам проверит все песни без текста. Не нашёл — будет «Текст не найден».', `<button class="btn btn-soft sm" data-action="find-lyrics">${(0, icons_js_1.icon)('lyrics')}Найти</button>`)}
        ${srow('Показывать текст справа', 'Выключите, если хотите просто слушать: плеер плавно переедет в центр. Тот же переключатель есть в самом плеере.', sw('showLyrics', s.showLyrics !== false))}
        ${srow('Свой сервер текстов', s.lyricsProxy ? (0, util_js_1.esc)(s.lyricsProxy) : 'Адрес вашего Cloudflare Worker: добавляет NetEase и Genius (см. папку worker).', `<button class="btn btn-soft sm" data-action="lyrics-proxy">${(0, icons_js_1.icon)('edit')}Указать</button>`)}
        ${srow('Размер текста', 'Строки в режиме караоке.', seg('lyricsSize', [['s', 'Мелкий'], ['m', 'Средний'], ['l', 'Крупный']], s.lyricsSize))}
        ${srow('Таймер сна', `Музыка плавно затихнет и остановится. Сейчас: ${sleepLabel()}.`, `<div class="seg">${sleepOpts.map(([v, n]) => `<button class="${String(sleepCur) === String(v) ? 'on' : ''}" data-action="sleep" data-v="${v}">${n}</button>`).join('')}</div>`)}
        ${srow('Одинаковая громкость', 'Тихие песни звучат громче, громкие — тише, и не нужно тянуться к регулятору. Плеер измеряет громкость, когда песня включается первый раз; файлы не меняются.', sw('normalize', s.normalize !== false))}
        ${srow('Переход между треками', 'Плавный: конец песни затихает, следующая нарастает. «Без пауз» — для альбомов, где песни перетекают одна в другую.', seg('transition', [[0, 'Обычный'], [-1, 'Без пауз'], [3, '3 с'], [6, '6 с'], [10, '10 с']], s.transition || 0))}
        ${srow('Эквалайзер', 'Подстройка звука: готовая настройка или своя.', seg('eq', [...Object.entries(player_js_1.EQ_PRESETS).map(([k, p]) => [k, p.name]), ['custom', 'Своя']], s.eq || 'flat'))}
        ${s.eq === 'custom' ? `<div class="setting eq-row">${player_js_1.EQ_BANDS.map((f, i) => `<label class="eq-band"><input type="range" class="eq-slider" min="-12" max="12" step="1" value="${(s.eqCustom || [])[i] || 0}" data-i="${i}" aria-label="${f < 1000 ? f + ' Гц' : f / 1000 + ' кГц'}"><b>${(s.eqCustom || [])[i] > 0 ? '+' : ''}${(s.eqCustom || [])[i] || 0}</b><span>${f < 1000 ? f + ' Гц' : f / 1000 + ' кГц'}</span></label>`).join('')}</div>` : ''}
        ${srow('Шаг перемотки', 'Стрелки ← / → на клавиатуре.', seg('seekStep', [[5, '5 с'], [10, '10 с'], [15, '15 с'], [30, '30 с']], s.seekStep))}
        ${srow('Спектр в Now Playing', 'Анимация звука рядом с обложкой.', sw('visualizer', s.visualizer))}
      </div>

      <h2 class="sg-title">Порядок в медиатеке</h2>
      <div class="settings">
        ${srow('Песни без данных', 'Песни без артиста, обложки или текста. Плеер попробует найти всё сам.', `<a class="btn btn-soft sm" href="#/fix">${(0, icons_js_1.icon)('sparkle')}Открыть</a>`)}
        ${srow('Дубликаты', 'Песни, которые есть в медиатеке дважды. Лишние копии можно удалить одной кнопкой.', `<a class="btn btn-soft sm" href="#/duplicates">${(0, icons_js_1.icon)('copy')}Открыть</a>`)}
      </div>

      <h2 class="sg-title">Приложение</h2>
      <div class="settings">
        ${srow('Заставка при запуске', 'Логотип и приветствие при открытии.', sw('splash', s.splash))}
        ${native_js_1.isNative ? srow('Папка с музыкой', (0, native_js_1.folderName)() ? `Выбрана: ${(0, util_js_1.esc)((0, native_js_1.folderName)())}. Новые файлы подхватываются при каждом запуске.` : 'Выберите одну папку — вся медиатека загрузится из неё, как в Poweramp.', `<div class="row-btns"><button class="btn btn-primary sm" data-action="add-folder">${(0, icons_js_1.icon)('folder')}${(0, native_js_1.folderName)() ? 'Сменить' : 'Выбрать'}</button>${(0, native_js_1.folderName)() ? `<button class="btn btn-soft sm" data-action="rescan">Обновить</button>` : ''}</div>`) : ''}
        ${srow('Не гасить экран', 'Пока играет музыка (если поддерживается).', sw('keepAwake', s.keepAwake))}
        ${srow('Резервная копия', 'Плейлисты, лайки, настройки и профиль — в один файл.', `<div class="row-btns"><button class="btn btn-soft sm" data-action="backup-export">${(0, icons_js_1.icon)('download')}Сохранить</button><button class="btn btn-soft sm" data-action="backup-import">${(0, icons_js_1.icon)('upload')}Загрузить</button></div>`)}
        ${srow('Недавно прослушанное', 'Очистить историю на главной.', `<button class="btn btn-soft sm" data-action="clear-recents">${(0, icons_js_1.icon)('trash')}Очистить</button>`)}
        ${srow('Сбросить настройки', 'Вернуть всё по умолчанию (музыка и плейлисты останутся).', `<button class="btn btn-soft sm btn-danger" data-action="reset-settings">${(0, icons_js_1.icon)('refresh')}Сбросить</button>`)}
        ${srow('Горячие клавиши', 'Пробел, стрелки, N / P, S, R, L, M, D, F, Q…', `<button class="btn btn-soft sm" data-action="shortcuts">${(0, icons_js_1.icon)('keyboard')}Показать</button>`)}
        ${srow('Библиотека', native_js_1.isNative ? 'Можно выбрать папку целиком или добавлять треки по одному. Сами файлы остаются на устройстве.' : 'Файлы хранятся только в вашем браузере (IndexedDB).', `<div class="row-btns"><button class="btn btn-soft sm" data-action="add-files">${(0, icons_js_1.icon)('plus')}Добавить</button><button class="btn btn-soft sm btn-danger" data-action="clear-library">${(0, icons_js_1.icon)('trash')}Очистить</button></div>`)}
      </div>
  </div>`;
}
// ---------- Дубликаты ----------
function duplicatesView() {
    const groups = (0, tools_js_1.duplicateGroups)(), extra = groups.reduce((n, g) => n + g.extra.length, 0);
    const back = `<a class="btn btn-soft sm" href="#/settings">${(0, icons_js_1.icon)('chev-left')}Настройки</a>`;
    if (!groups.length)
        return pageHead('Дубликаты', 'Повторов нет', back) + `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('check')}</div><h2>Повторов не найдено</h2><p>Плеер сравнил названия, артистов и длину всех песен — одинаковых нет.</p></div>`;
    const row = (t, keep) => `<div class="dup-row ${keep ? 'keep' : ''}" data-track-id="${(0, util_js_1.esc)(t.id)}">
      <button class="dup-cover" data-action="play-id" data-id="${(0, util_js_1.esc)(t.id)}" aria-label="Слушать">${(0, exports.cov)(t.cover, t._albumKey || t.id)}<span>${(0, icons_js_1.icon)('play')}</span></button>
      <div class="dup-main"><div class="dup-name">${(0, util_js_1.esc)(t.name || t.title)}</div><div class="dup-meta">${[(0, tools_js_1.extOf)(t), t.bitrate ? `${Math.round(t.bitrate)} кбит/с` : '', (0, tools_js_1.sizeMB)(t), (0, util_js_1.fmtTime)(t.duration), t.album ? (0, util_js_1.esc)(t.album) : ''].filter(Boolean).join(' · ')}</div></div>
      <span class="dup-badge">${keep ? 'Оставить' : 'Лишняя'}</span>
      <button class="icon-btn" data-action="delete-track" data-id="${(0, util_js_1.esc)(t.id)}" aria-label="Удалить песню" title="Удалить песню">${(0, icons_js_1.icon)('trash')}</button>
    </div>`;
    return pageHead('Дубликаты', `Лишних копий: ${extra}`, `${back}<button class="btn btn-primary sm" data-action="dedupe">${(0, icons_js_1.icon)('trash')}Удалить все лишние</button>`) +
        `<p class="tool-note">Повтор — это песня с тем же названием, артистом и длиной. В каждой группе плеер оставляет лучшую копию: без потерь качества, с большим битрейтом, с обложкой и текстом.</p>` +
        groups.map(g => `<section class="dup-group"><header><div><h3>${(0, util_js_1.esc)(g.keep.title)}</h3><p>${(0, util_js_1.esc)(g.keep.artist || '')}</p></div><button class="btn btn-soft sm" data-action="dedupe" data-key="${(0, util_js_1.esc)(g.key)}">Удалить лишние (${g.extra.length})</button></header>${row(g.keep, true)}${g.extra.map(t => row(t, false)).join('')}</section>`).join('');
}
// ---------- Песни без данных ----------
function fixView(busy = '') {
    const m = (0, tools_js_1.missing)(), back = `<a class="btn btn-soft sm" href="#/settings">${(0, icons_js_1.icon)('chev-left')}Настройки</a>`;
    const total = new Set([...m.artist, ...m.cover, ...m.lyrics]).size;
    if (!m.all.length)
        return pageHead('Песни без данных', '', back) + emptyState(true);
    if (!total)
        return pageHead('Песни без данных', 'Всё на месте', back) + `<div class="empty compact"><div class="empty-icon">${(0, icons_js_1.icon)('check')}</div><h2>Всё на месте</h2><p>У каждой песни есть артист, обложка и текст.</p></div>`;
    const part = (title, list, note) => list.length ? `<section class="section"><div class="section-head"><h2>${title} · ${list.length}</h2></div><p class="tool-note">${note}</p>${trackList(list.slice(0, 30), { cover: true })}${list.length > 30 ? `<p class="tool-note">…и ещё ${list.length - 30}</p>` : ''}</section>` : '';
    return pageHead('Песни без данных', `Чего-то не хватает у ${total} из ${m.all.length} песен`, `${back}<button class="btn btn-primary sm" data-action="fix-all" ${busy ? 'disabled' : ''}>${(0, icons_js_1.icon)('sparkle')}${busy || 'Исправить всё'}</button>`) +
        `<p class="tool-note">«Исправить всё» по очереди ищет артистов (по названию и длине песни), обложки и тексты. Найденное записывается в плеере, сами файлы не меняются. Любую песню можно поправить и вручную — через «⋯» в её строке.</p>` +
        part('Без артиста', m.artist, 'В файле не указан артист.') + part('Без обложки', m.cover, 'Нет картинки ни в файле, ни в плеере.') + part('Без текста', m.lyrics, 'Текст ещё не найден или его нет в открытых источниках.');
}
function sidebarPlaylists() {
    const items = [`<a class="side-link sub" href="#/liked" data-route="liked"><span class="mini-cov liked">${(0, icons_js_1.icon)('heart-fill')}</span><span>Понравившееся</span></a>`];
    for (const p of state_js_1.state.playlists)
        items.push(`<a class="side-link sub" href="#/playlist/${p.id}" data-route="playlist/${p.id}">${(0, exports.mosaic)((0, state_js_1.playlistTracks)(p).slice(0, 4), p.id, 'mini-cov')}<span>${(0, util_js_1.esc)(p.name)}</span></a>`);
    for (const p of state_js_1.state.smart)
        items.push(`<a class="side-link sub" href="#/smart/${p.id}" data-route="smart/${p.id}"><span class="mini-cov smart-mini">${(0, icons_js_1.icon)('smart')}</span><span>${(0, util_js_1.esc)(p.name)}</span></a>`);
    return items.join('');
}

};
defs["vocal.js"]=function(module,exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TUNE = void 0;
exports.vocalActivity = vocalActivity;
exports.fineEnvelope = fineEnvelope;
exports.alignWords = alignWords;
exports.activityFromSamples = activityFromSamples;
exports.layoutOnActivity = layoutOnActivity;
exports.alignText = alignText;
// Где в треке «поют»: грубая карта активности по громкости в диапазоне голоса (≈250–3500 Гц).
// Нужна только для обычного текста без меток времени: строки раскладываются по участкам, где есть звук,
// а вступление, проигрыши и тишина в конце пропускаются. Это приближение, а не распознавание слов.
const STEP = 0.5; // секунд на ячейку
const cache = new Map();
async function vocalActivity(t) {
    if (!t || !t.url)
        return null;
    if (cache.has(t.id))
        return cache.get(t.id);
    const job = (async () => {
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OAC)
            return null;
        const res = await fetch(t.url);
        if (!res.ok)
            return null;
        const len = +res.headers.get('content-length') || 0;
        if (len > 70 * 1024 * 1024)
            return null; // очень большие файлы не разбираем
        const raw = await res.arrayBuffer();
        const sr = 16000, dur = Math.max(1, t.duration || 180);
        const ctx = new OAC(2, Math.ceil(sr * dur), sr);
        const buf = await new Promise((ok, no) => ctx.decodeAudioData(raw, ok, no));
        const off = new OAC(2, buf.length, sr), src = off.createBufferSource();
        src.buffer = buf;
        const hp = off.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 250;
        const lp = off.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3500;
        src.connect(hp);
        hp.connect(lp);
        lp.connect(off.destination);
        src.start();
        const out = await off.startRendering(), L = out.getChannelData(0), R = out.numberOfChannels > 1 ? out.getChannelData(1) : L;
        const data = new Float32Array(L.length), side = new Float32Array(L.length);
        for (let i = 0; i < L.length; i++) {
            data[i] = (L[i] + R[i]) / 2;
            side[i] = (L[i] - R[i]) / 2;
        }
        const r = activityFromSamples(data, sr, side);
        if (r)
            r.fine = fineEnvelope(data, sr, side);
        return r;
    })().catch(() => null);
    cache.set(t.id, job);
    return job;
}
// Массив 0/1 по ячейкам STEP секунд: true — есть заметный звук
const FSTEP = 0.02;
// Точная огибающая (20 мс) и «начала звуков»: по ним определяется, где кончается одно слово и начинается другое, а какое тянется
function fineEnvelope(data, sr, side) {
    const per = Math.max(1, Math.floor(sr * FSTEP)), n = Math.floor(data.length / per), env = new Float32Array(n), onset = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let s = 0, q = 0;
        for (let k = i * per, e = k + per; k < e; k++) {
            s += data[k] * data[k];
            if (side)
                q += side[k] * side[k];
        }
        env[i] = Math.sqrt(Math.max(s * 0.15, s - 0.7 * q) / per);
    }
    const lg = Array.from(env, v => Math.log(v + 1e-4));
    for (let i = 3; i < n; i++)
        onset[i] = Math.max(0, lg[i] - (lg[i - 1] + lg[i - 2] + lg[i - 3]) / 3 - 0.08);
    for (let i = n - 2; i > 0; i--)
        onset[i] = Math.max(onset[i], onset[i - 1] * 0.6);
    return { step: FSTEP, env, onset };
}
const syllables = w => Math.max(1, (String(w).toLowerCase().match(/[aeiouyаеёиоуыэюяії]+/g) || []).length);
// Времена слов строки по звуку: возвращает [{a, b, held}] или null, если звука для разбора нет
function alignWords(words, start, limit, fine) {
    const n = words.length;
    if (!fine || n < 2)
        return null;
    const { step, env, onset } = fine;
    const i0 = Math.max(0, Math.floor((start - 0.3) / step)), i1 = Math.min(env.length - 1, Math.floor(limit / step));
    if (i1 - i0 < 15)
        return null;
    let peak = 0;
    for (let i = i0; i <= i1; i++)
        if (env[i] > peak)
            peak = env[i];
    if (peak < 1e-3)
        return null;
    const thr = peak * 0.16;
    let first = i0;
    while (first < i1 && env[first] < thr)
        first++;
    let last = i1;
    while (last > first && env[last] < thr)
        last--;
    const t0 = first * step, t1 = (last + 1) * step, L = t1 - t0;
    if (L < 0.6)
        return null;
    const syl = words.map(syllables), tot = syl.reduce((a, b) => a + b, 0);
    let acc = 0;
    const exp = syl.map(c => { const e = t0 + L * acc / tot; acc += c; return e; });
    // кандидаты: найденные начала звуков и «виртуальные» точки там, где звука не нашлось (протяжные места)
    let mx = 0;
    for (let i = first; i <= last; i++)
        if (onset[i] > mx)
            mx = onset[i];
    const cand = [];
    if (mx > 0)
        for (let i = first + 3; i < last - 2; i++)
            if (onset[i] > mx * 0.22 && onset[i] >= onset[i - 1] && onset[i] > onset[i + 1]) {
                const t = i * step;
                if (cand.length && t - cand[cand.length - 1].t < 0.11) {
                    if (onset[i] > cand[cand.length - 1].w * mx) {
                        cand[cand.length - 1] = { t, w: onset[i] / mx };
                    }
                    continue;
                }
                cand.push({ t, w: onset[i] / mx });
            }
    for (let k = 1; k < n; k++)
        if (!cand.some(c => Math.abs(c.t - exp[k]) < 0.12))
            cand.push({ t: exp[k], w: 0 });
    cand.sort((x, y) => x.t - y.t);
    const m = cand.length, NEG = -1e9, lam = 5;
    const dp = Array.from({ length: n }, () => new Float64Array(m).fill(NEG)), from = Array.from({ length: n }, () => new Int32Array(m).fill(-1));
    for (let j = 0; j < m; j++)
        dp[1][j] = cand[j].w * 1.6 - lam * ((cand[j].t - exp[1]) / L) ** 2;
    for (let k = 2; k < n; k++)
        for (let j = 0; j < m; j++) {
            let best = NEG, bi = -1;
            for (let q = 0; q < j; q++)
                if (dp[k - 1][q] > best && cand[j].t - cand[q].t >= 0.09) {
                    best = dp[k - 1][q];
                    bi = q;
                }
            if (bi >= 0) {
                dp[k][j] = best + cand[j].w * 1.6 - lam * ((cand[j].t - exp[k]) / L) ** 2;
                from[k][j] = bi;
            }
        }
    let bj = -1, bs = NEG;
    for (let j = 0; j < m; j++)
        if (dp[n - 1][j] > bs) {
            bs = dp[n - 1][j];
            bj = j;
        }
    if (bj < 0)
        return null;
    const starts = new Array(n);
    starts[0] = t0;
    for (let k = n - 1, j = bj; k >= 1; k--) {
        starts[k] = cand[j].t;
        j = from[k][j];
    }
    const out = starts.map((a, k) => ({ a, b: k + 1 < n ? starts[k + 1] : t1, held: false }));
    // протяжное слово: на слог уходит заметно больше времени, чем у остальных слов строки
    const rate = out.map((w, k) => (w.b - w.a) / syl[k]);
    out.forEach((w, k) => {
        const others = rate.filter((_, j) => j !== k).sort((x, y) => x - y), med = others[Math.floor(others.length / 2)] || rate[k];
        w.held = w.b - w.a >= 0.8 && rate[k] > 2.2 * Math.max(0.12, med);
    });
    return out;
}
function activityFromSamples(data, sr, side) {
    const n = Math.max(1, Math.floor(data.length / (sr * STEP))), e = new Float32Array(n), per = Math.floor(sr * STEP);
    for (let i = 0; i < n; i++) {
        let s = 0, q = 0;
        for (let k = i * per, end = Math.min(data.length, k + per); k < end; k++) {
            s += data[k] * data[k];
            if (side)
                q += side[k] * side[k];
        }
        e[i] = Math.sqrt(Math.max(s * 0.15, s - 0.7 * q) / per);
    }
    const sorted = Array.from(e).sort((a, b) => a - b), p90 = sorted[Math.floor(n * 0.9)] || 0;
    if (p90 < 1e-4)
        return null;
    const thr = p90 * 0.22;
    const act = Array.from(e, v => v > thr);
    // короткие провалы (дыхание, паузы между словами) считаем частью пения, длинные (≥ 3 с) — проигрышем
    const GAP = Math.round(3 / STEP);
    for (let i = 0; i < n;) {
        if (act[i]) {
            i++;
            continue;
        }
        let j = i;
        while (j < n && !act[j])
            j++;
        if (i > 0 && j < n && j - i < GAP)
            for (let k = i; k < j; k++)
                act[k] = true;
        i = j;
    }
    // одиночные всплески (< 1.5 с) вне пения не считаем
    const MIN = Math.round(1.5 / STEP);
    for (let i = 0; i < n;) {
        if (!act[i]) {
            i++;
            continue;
        }
        let j = i;
        while (j < n && act[j])
            j++;
        if (j - i < MIN)
            for (let k = i; k < j; k++)
                act[k] = false;
        i = j;
    }
    return { step: STEP, act };
}
// Времена строк: «время пения» делится пропорционально весам, а затем переводится в реальное время трека (пропуская проигрыши)
function layoutOnActivity(weights, dur, a) {
    const { step, act } = a, n = act.length, cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++)
        cum[i + 1] = cum[i] + (act[i] ? step : 0);
    const total = cum[n];
    if (total < dur * 0.2)
        return null;
    const sum = weights.reduce((s, w) => s + w, 0) || 1, out = [];
    let acc = 0;
    for (const w of weights) {
        const T = acc / sum * total;
        let lo = 0, hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (cum[mid] <= T)
                lo = mid;
            else
                hi = mid - 1;
        }
        out.push(Math.min(dur - 1, lo * step + (T - cum[lo])));
        acc += w;
    }
    return out;
}
// Где заканчивается звук, начавшийся в момент t (но не позже limit)
function sungEnd(fine, t, limit) {
    const { step, env } = fine;
    let i = Math.floor(t / step), end = Math.min(env.length - 1, Math.floor(limit / step));
    let peak = 0;
    for (let k = i; k <= Math.min(end, i + 50); k++)
        if (env[k] > peak)
            peak = env[k];
    const thr = peak * 0.16;
    let quiet = 0, last = i;
    for (let k = i; k <= end; k++) {
        if (env[k] >= thr) {
            last = k;
            quiet = 0;
        }
        else if (++quiet > 12)
            break;
    }
    return (last + 1) * step;
}
exports.TUNE = { R: 3, W: 3 };
// Выравнивание обычного текста по звуку: слоги текста сопоставляются с найденными «началами звуков» в порядке следования,
// при этом время каждого слога не уходит далеко от ожидаемого. Возвращает строки со временем каждого слова или null.
function alignText(text, dur, a) {
    if (!a || !a.fine)
        return null;
    const raw = String(text).split(/\r?\n/).map(l => l.trim()), items = [];
    for (const l of raw) {
        if (l) {
            const ws = l.split(/\s+/);
            items.push({ text: ws.join(' '), ws });
        }
        else if (items.length)
            items[items.length - 1].gap = true;
    }
    if (!items.length)
        return null;
    const sylls = [];
    items.forEach((it, li) => it.ws.forEach((w, wi) => {
        for (let k = 0, c = syllables(w); k < c; k++)
            sylls.push({ li, wi, first: k === 0, wt: 1 });
        const last = sylls[sylls.length - 1];
        if (wi === it.ws.length - 1)
            last.wt += it.gap ? 3 : 1;
    }));
    const S = sylls.length;
    if (S < 4)
        return null;
    const exp = layoutOnActivity(sylls.map(x => x.wt), dur, a);
    if (!exp)
        return null;
    const { step, onset } = a.fine, n = onset.length, stepA = a.step;
    let mx = 0;
    for (let i = 0; i < n; i++)
        if (onset[i] > mx)
            mx = onset[i];
    if (mx <= 0)
        return null;
    const cand = [];
    for (let i = 3; i < n - 2; i++) {
        if (!(onset[i] > mx * 0.2 && onset[i] >= onset[i - 1] && onset[i] > onset[i + 1]))
            continue;
        const t = i * step;
        if (!a.act[Math.min(a.act.length - 1, Math.floor(t / stepA))])
            continue; // только там, где «поют»
        if (cand.length && t - cand[cand.length - 1].t < 0.09) {
            if (onset[i] / mx > cand[cand.length - 1].w)
                cand[cand.length - 1] = { t, w: onset[i] / mx };
            continue;
        }
        cand.push({ t, w: onset[i] / mx });
    }
    if (cand.length < S * 0.5)
        return null;
    for (const e of exp)
        if (!cand.some(c => Math.abs(c.t - e) < 0.1))
            cand.push({ t: e, w: 0 });
    cand.sort((x, y) => x.t - y.t);
    const M = cand.length, NEG = -1e9;
    // штраф за отклонение от ожидаемого времени: до 2,5 с почти не штрафуем (темп в песне неравномерный), дальше растёт
    const R = exports.TUNE.R, pen = (t, e) => { const d = Math.max(0, Math.abs(t - e) - exports.TUNE.W); return (d / 3) ** 2 + 0.03 * Math.abs(t - e); };
    const from = Array.from({ length: S }, () => new Int32Array(M));
    let prev = new Float64Array(M);
    for (let j = 0; j < M; j++)
        prev[j] = cand[j].w * R - pen(cand[j].t, exp[0]);
    for (let i = 1; i < S; i++) {
        const cur = new Float64Array(M).fill(NEG);
        let best = NEG, bi = -1; // best — лучший prev по строго меньшим j
        for (let j = 0; j < M; j++) {
            if (bi >= 0) {
                cur[j] = best + cand[j].w * R - pen(cand[j].t, exp[i]);
                from[i][j] = bi;
            }
            if (prev[j] > best) {
                best = prev[j];
                bi = j;
            }
        }
        prev = cur;
    }
    let bj = 0;
    for (let j = 1; j < M; j++)
        if (prev[j] > prev[bj])
            bj = j;
    const ts = new Array(S);
    for (let i = S - 1, j = bj; i >= 0; i--) {
        ts[i] = cand[j].t;
        j = from[i][j];
    }
    // слоги → слова → строки
    const lines = items.map(it => ({ text: it.text, words: [] }));
    sylls.forEach((sy, i) => {
        if (sy.first)
            lines[sy.li].words.push({ t: ts[i], text: items[sy.li].ws[sy.wi], syl: syllables(items[sy.li].ws[sy.wi]) });
    });
    lines.forEach((l, li) => {
        const nextLine = lines[li + 1] && lines[li + 1].words[0] ? lines[li + 1].words[0].t : dur;
        l.t = l.words[0].t;
        l.words.forEach((w, k) => {
            const nxt = l.words[k + 1];
            w.b = nxt ? nxt.t : Math.min(sungEnd(a.fine, w.t, nextLine - 0.05), w.t + 6);
            if (w.b - w.t < 0.12)
                w.b = w.t + 0.12;
        });
        const rate = l.words.map(w => (w.b - w.t) / w.syl);
        l.words.forEach((w, k) => { const o = rate.filter((_, j) => j !== k).sort((x, y) => x - y), med = o[Math.floor(o.length / 2)] || rate[k]; w.held = w.b - w.t >= 0.8 && rate[k] > 2.2 * Math.max(0.12, med); });
    });
    return lines;
}

};
req("app.js")})();
