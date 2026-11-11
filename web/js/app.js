import { DEFAULT_SETTINGS, addToPlaylist, createPlaylist, deletePlaylist, deleteSmart, derived, emit, flushSave, hasAlbumCover, likedTracks, load, on, playlistTracks, renamePlaylist, save, saveSmart, setAlbumCover, setCovers, setSetting, smartTracks, state, toggleLike, touchLibrary } from './state.js';
import { P, addNext, addToQueue, audio, current, cycleRepeat, next, playList, prev, seekBy, setSleep, setSpeed, setVolume, stop, toggle, toggleMute, toggleShuffle } from './player.js';
import { filesFromDrop, importFiles, restoreLibrary, syncNativeLibrary } from './importer.js';
import { forgetFile, isNative, onNativeFetch, pickFiles, pickFolder, rescan, setPlayback } from './native.js';
import { closeNP, initPlayerUI, isNPOpen, openNP, setPane } from './nowplaying.js';
import { albumView, artistView, avatarHTML, continueCard, homeHidden, homeOrder, homeView, libraryView, likedView, lists, mixById, mixView, playlistView, profileView, searchResults, searchView, setSongSort, settingsView, sidebarPlaylists, smartView, statsView } from './views.js';
import { deleteTrackFlow, newPlaylistFlow, trackMenu } from './actions.js';
import { closeMenu, closeTopModal, openMenu, openModal, pickImage, toast } from './ui.js';
import { applySettings, applyTheme, toggleTheme } from './theme.js';
import { icon } from './icons.js';
import { initBgFx, runSplash } from './bgfx.js';
import { ensureLyrics } from './lyrics-auto.js';
import { $, $$, debounce, esc, plural, shuffleArray } from './util.js';
import { buildM3U } from './m3u.js';
import { clearFiles } from './db.js';
import { initI18n, setLang } from './i18n.js';
import { initAutoCovers, setArtistPhoto } from './covers-auto.js';
import { initSync, signInEmail, signInGoogle, signOutSync, sync, syncNow } from './sync.js';

const view = $('#view');
let query = '';
// ================= роутер =================
function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path] = h.split('?');
    const p = path.split('/');
    const dec = s => { try {
        return decodeURIComponent(s || '');
    }
    catch {
        return s || '';
    } };
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
            html = libraryView(r.arg || 'albums');
            break;
        case 'album':
            html = albumView(r.arg);
            break;
        case 'artist':
            html = artistView(r.arg);
            break;
        case 'playlist':
            html = playlistView(r.arg);
            break;
        case 'liked':
            html = likedView();
            break;
        case 'mix':
            html = mixView(r.arg);
            break;
        case 'smart':
            html = smartView(r.arg);
            break;
        case 'stats':
            html = statsView(r.arg || 'month');
            break;
        case 'search':
            html = searchView(query);
            break;
        case 'profile':
            html = profileView();
            break;
        case 'settings':
            html = settingsView();
            break;
        default: html = homeView();
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
    $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === key));
    $$('#tabbar a').forEach(a => a.classList.toggle('active', key.startsWith(a.dataset.tab)));
    syncRows();
    syncRails();
    if (r.name === 'search' && !keepScroll) {
        const i = $('#search-main');
        if (i && matchMedia('(max-width: 899px)').matches)
            i.focus();
    }
}
// ================= боковая панель / таб-бар =================
function renderChrome() {
    $('#brand-mark').innerHTML = icon('tower');
    $('#ic-search').innerHTML = icon('search');
    $('#side-add').innerHTML = icon('plus');
    $('#side-settings').innerHTML = icon('settings');
    $('#side-upload').innerHTML = isNative ? icon('folder') + 'Выбрать папку' : icon('upload') + 'Добавить музыку';
    $('#drop-ic').innerHTML = icon('upload');
    if (isNative)
        $('#side-upload').dataset.action = 'add-folder';
    const nav = [['home', 'home', 'Главная'], ['library/media', 'library', 'Медиатека'], ['library/albums', 'disc', 'Альбомы'], ['library/singles', 'single', 'Синглы'], ['library/playlists', 'playlist', 'Плейлисты'], ['library/artists', 'user', 'Артисты'], ['library/songs', 'note', 'Песни'], ['stats', 'chart', 'Итоги']];
    $('#side-nav').innerHTML = nav.map(([k, ic, n]) => `<a class="side-link" href="#/${k}" data-route="${k}">${icon(ic)}<span>${n}</span></a>`).join('');
    $('#tabbar').innerHTML = [['home', 'home', 'Главная', '#/home'], ['search', 'search', 'Поиск', '#/search'], ['library', 'library', 'Библиотека', '#/library/media'], ['profile', 'user', 'Профиль', '#/profile']]
        .map(([k, ic, n, h]) => `<a href="${h}" data-tab="${k}">${icon(ic)}<span>${n}</span></a>`).join('');
    renderSidePlaylists();
    renderSideProfile();
    syncThemeBtn();
}
function syncThemeBtn() { const b = $('#side-theme'); if (b)
    b.innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon'); }
function renderSidePlaylists() { $('#side-playlists').innerHTML = sidebarPlaylists(); const key = routeKey(route()); $$('#side-playlists [data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === key)); }
function renderSideProfile() { $('#side-profile').innerHTML = `${avatarHTML()}<span class="sp-text"><b>${esc(state.profile.name)}</b><small>@${esc(state.profile.username)}</small></span>`; }
// ================= синхронизация текущего трека / лайков в списках =================
function syncRows() {
    const id = current()?.id;
    $$('[data-track]').forEach(el => el.classList.toggle('is-current', el.dataset.track === id));
}
function syncLikes() {
    $$('.like[data-id]').forEach(b => { const on_ = state.likes.has(b.dataset.id); b.classList.toggle('on', on_); b.innerHTML = icon(on_ ? 'heart-fill' : 'heart'); });
    if (route().name === 'liked')
        render({ keepScroll: true });
}
// ================= воспроизведение из контекста =================
function playFrom(el) {
    const list = lists.get(+el.dataset.list);
    if (!list)
        return;
    const i = +el.dataset.i, id = list[i]?.id;
    if (id && current()?.id === id && P.queue.length)
        return toggle();
    playList(list.map(t => t.id), i, { shuffle: false });
}
const ids = ts => ts.map(t => t.id);
const playIds = (list, shuffle) => { if (!list.length)
    return toast('Здесь пока нет песен', 'info'); playList(ids(list), shuffle ? Math.floor(Math.random() * list.length) : 0, { shuffle }); };
const artistTracks = a => a.tracks;
const artistsOfTrack = t => (t._artists || [t.artist]).filter(Boolean).join(', ');
function playlistMenu(anchor, id) {
    const p = state.playlists.find(x => x.id === id);
    if (!p)
        return;
    openMenu(anchor, [
        { icon: 'edit', label: 'Переименовать', onClick: async () => { const { promptText } = await import('./ui.js'); const n = await promptText({ title: 'Переименовать плейлист', label: 'Название', value: p.name, ok: 'Сохранить' }); if (n)
                renamePlaylist(id, n); } },
        { icon: 'download', label: 'Экспорт в .m3u8', onClick: () => exportM3U(p) },
        { sep: true },
        { icon: 'trash', label: 'Удалить плейлист', danger: true, onClick: () => { deletePlaylist(id); toast(`Плейлист «${p.name}» удалён`); location.hash = '#/library/playlists'; } },
    ]);
}
// «⋯» на странице альбома: своя обложка сразу для всех песен альбома
function albumMenu(anchor, key) {
    const g = derived().groups.get(key);
    if (!g)
        return;
    const what = g.tracks.length > 1 ? 'альбома' : 'сингла';
    openMenu(anchor, [
        { icon: 'upload', label: `Обложка ${what}…`, onClick: async () => { const url = await pickImage(); if (url) {
                setAlbumCover(key, url);
                toast(`Обложка ${what} обновлена`);
            } } },
        ...(hasAlbumCover(key) ? [{ icon: 'refresh', label: 'Вернуть обложку из файла', onClick: () => setAlbumCover(key, null) }] : []),
        { sep: true },
        { icon: 'next2', label: 'Играть следующим', onClick: () => { addNext(g.tracks.map(t => t.id)); toast('Добавлено: следующим'); } },
        { icon: 'queue', label: 'В конец очереди', onClick: () => { addToQueue(g.tracks.map(t => t.id)); toast('Добавлено в очередь'); } },
    ]);
}
function exportM3U(p) {
    const blob = new Blob([buildM3U(p.name, playlistTracks(p))], { type: 'audio/x-mpegurl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = p.name.replace(/[\\/:*?"<>|]+/g, '_') + '.m3u8';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Плейлист сохранён как .m3u8');
}
function doAction(el, e) {
    const d = el.dataset;
    switch (el.dataset.action) {
        case 'play-album':
        case 'shuffle-album': {
            e.stopPropagation();
            const g = derived().groups.get(d.key);
            if (g)
                playIds(g.tracks, el.dataset.action === 'shuffle-album');
            break;
        }
        case 'radio-artist': {
            e.stopPropagation();
            const a = derived().artists.get(d.key);
            if (a)
                playIds(shuffleArray(a.tracks), false);
            break;
        }
        case 'play-artist':
        case 'shuffle-artist': {
            e.stopPropagation();
            const a = derived().artists.get(d.key);
            if (a)
                playIds(artistTracks(a), el.dataset.action === 'shuffle-artist');
            break;
        }
        case 'play-playlist':
        case 'shuffle-playlist': {
            e.stopPropagation();
            const p = state.playlists.find(x => x.id === d.id);
            if (p)
                playIds(playlistTracks(p), el.dataset.action === 'shuffle-playlist');
            break;
        }
        case 'play-mix':
        case 'shuffle-mix': {
            e.stopPropagation();
            const m = mixById(d.id);
            if (m)
                playIds(m.tracks, el.dataset.action === 'shuffle-mix');
            break;
        }
        case 'play-liked':
        case 'shuffle-liked':
            e.stopPropagation();
            playIds(likedTracks(), el.dataset.action === 'shuffle-liked');
            break;
        case 'like':
            e.stopPropagation();
            toggleLike(d.id);
            break;
        case 'artist-photo': {
            e.stopPropagation();
            const key = d.key, a = derived().artists.get(key);
            openMenu(el, [
                { icon: 'edit', label: 'Выбрать фото…', onClick: async () => { const img = await pickImage(360, 360); if (img) { await setArtistPhoto(key, img); toast('Фото артиста обновлено'); } } },
                ...(a && a.photo ? [{ icon: 'trash', label: 'Убрать фото', danger: true, onClick: async () => { await setArtistPhoto(key, null); toast('Фото убрано'); } }] : []),
            ]);
            break;
        }
        case 'delete-track':
            e.stopPropagation();
            deleteTrackFlow(d.id);
            break;
        case 'menu':
            e.stopPropagation();
            trackMenu(el, d.id, { pid: d.pid });
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
            const p = state.smart.find(x => x.id === d.id);
            if (p)
                playIds(smartTracks(p), el.dataset.action === 'shuffle-smart');
            break;
        }
        case 'sync-google':
            signInGoogle();
            break;
        case 'sync-email':
            emailSignIn();
            break;
        case 'sync-now':
            syncNow();
            toast('Синхронизирую…', 'info', 1500);
            break;
        case 'sync-out':
            signOutSync();
            break;
        case 'new-smart':
            e.stopPropagation();
            smartEditor();
            break;
        case 'smart-menu': {
            e.stopPropagation();
            const p = state.smart.find(x => x.id === d.id);
            if (p)
                openMenu(el, [
                    { icon: 'edit', label: 'Изменить правила', onClick: () => smartEditor(p) },
                    { icon: 'download', label: 'Сохранить как обычный плейлист', onClick: () => {
                            const np = createPlaylist(p.name);
                            addToPlaylist(np.id, smartTracks(p).map(t => t.id));
                            toast(`Плейлист «${p.name}» создан`);
                            location.hash = '#/playlist/' + np.id;
                        } },
                    { sep: true },
                    { icon: 'trash', label: 'Удалить плейлист', danger: true, onClick: () => { deleteSmart(p.id); toast(`Плейлист «${p.name}» удалён`); location.hash = '#/library/playlists'; } },
                ]);
            break;
        }
        case 'new-playlist':
            e.stopPropagation();
            newPlaylistFlow().then(p => { if (p)
                location.hash = '#/playlist/' + p.id; });
            break;
        case 'add-files':
            isNative ? pickFiles() : $('#file-input').click();
            break;
        case 'add-folder':
            isNative ? pickFolder() : $('#dir-input').click();
            break;
        case 'rescan':
            if (isNative) {
                toast('Проверяю папку…', 'info', 1500);
                rescan();
            }
            break;
        case 'import-m3u':
            $('#m3u-input').click();
            break;
        case 'sort':
            setSongSort(d.v);
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
            applyTheme(d.v);
            break;
        case 'toggle-theme':
            toggleTheme();
            break;
        case 'home-view':
            setSetting('homeView', d.v);
            break;
        case 'home-continue': { // та же песня уже в плеере — просто продолжаем; иначе включаем её (в альбоме — с неё)
            const t = state.tracks.get(d.id);
            if (!t)
                break;
            if (current()?.id === t.id) {
                if (audio.paused)
                    toggle();
                else
                    openNP();
                break;
            }
            const g = derived().groups.get(t._albumKey), list = g && g.tracks.length > 1 ? g.tracks : [t];
            playList(list.map(x => x.id), Math.max(0, list.indexOf(t)));
            break;
        }
        case 'shuffle-all':
            playIds(shuffleArray(derived().all.slice()), false);
            break;
        case 'recent-added':
            setSongSort('added');
            location.hash = '#/library/songs';
            break;
        case 'home-move': {
            const o = homeOrder(), i = o.indexOf(d.k), j = i + (+d.d);
            if (i < 0 || j < 0 || j >= o.length)
                break;
            [o[i], o[j]] = [o[j], o[i]];
            setSetting('homeOrder', o);
            break;
        }
        case 'home-toggle': {
            const hid = homeHidden();
            hid.has(d.k) ? hid.delete(d.k) : hid.add(d.k);
            if (d.k === 'recents')
                state.settings.homeRecents = true; // старый выключатель больше не используется
            setSetting('homeHidden', [...hid]);
            break;
        }
        case 'set-setting':
            setSetting(d.k, d.k === 'speed' || d.k === 'transition' ? parseFloat(d.v) : d.v);
            break;
        case 'toggle-setting':
            setSetting(d.k, !state.settings[d.k]);
            break;
        case 'sleep': {
            const v = d.v === 'track' ? 'track' : +d.v;
            setSleep(v);
            toast(v === 0 ? 'Таймер сна выключен' : v === 'track' ? 'Остановлюсь в конце трека' : `Таймер сна: ${v} мин`, 'info', 2000);
            break;
        }
        case 'shortcuts':
            showShortcuts();
            break;
        case 'find-lyrics':
            findAllLyrics();
            break;
        case 'clear-recents':
            state.recents = [];
            save();
            toast('История очищена', 'info');
            render({ keepScroll: true });
            break;
        case 'reset-settings':
            setSettings();
            break;
        case 'backup-export':
            exportBackup();
            break;
        case 'backup-import':
            $('#backup-input').click();
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
            closeNP();
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
        if (closeTopModal())
            return;
        if (closeMenu())
            return;
        if (isNPOpen())
            return void closeNP();
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
            toggle();
            break;
        case 'ArrowLeft':
            if (onRange)
                return;
            e.preventDefault();
            e.shiftKey ? prev() : seekBy(-(state.settings.seekStep || 5));
            break;
        case 'ArrowRight':
            if (onRange)
                return;
            e.preventDefault();
            e.shiftKey ? next() : seekBy(state.settings.seekStep || 5);
            break;
        case 'ArrowUp':
            if (onRange)
                return;
            e.preventDefault();
            setVolume(audio.volume + 0.05);
            break;
        case 'ArrowDown':
            if (onRange)
                return;
            e.preventDefault();
            setVolume(audio.volume - 0.05);
            break;
        case 'KeyD':
            toggleTheme();
            break;
        case 'KeyM':
            toggleMute();
            break;
        case 'KeyS':
            toggleShuffle();
            break;
        case 'KeyR':
            cycleRepeat();
            break;
        case 'KeyN':
            next();
            break;
        case 'KeyP':
            prev();
            break;
        case 'KeyL': {
            const t = current();
            if (t)
                toggleLike(t.id);
            break;
        }
        case 'KeyF':
            isNPOpen() ? closeNP() : openNP();
            break;
        case 'KeyQ':
            isNPOpen() ? setPane('queue') : openNP('queue');
            break;
        case 'KeyT':
            isNPOpen() ? setPane('lyrics') : openNP('lyrics');
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
document.addEventListener('keyup', e => { if (e.code === 'Space' && e.target.matches?.('button,[role=button]'))
    e.preventDefault(); });
document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target.matches?.('button,[role=button],a'))
    e.preventDefault(); }, true);
function focusSearch() {
    if (matchMedia('(min-width: 900px)').matches)
        $('#search-side').focus();
    else {
        if (route().name !== 'search')
            location.hash = '#/search';
        setTimeout(() => $('#search-main')?.focus(), 60);
    }
}
function showShortcuts() {
    const rows = [['Пробел', 'Играть / пауза'], ['← / →', 'Перемотка на 5 секунд'], ['Shift + ← / →', 'Предыдущий / следующий трек'], ['↑ / ↓', 'Громкость'], ['M', 'Выключить звук'], ['S', 'Перемешать'], ['R', 'Повтор: выкл → все → один'],
        ['N / P', 'Следующий / предыдущий'], ['L', 'Нравится'], ['D', 'Сменить тему'], ['F', 'Открыть / закрыть Now Playing'], ['T', 'Текст песни'], ['Q', 'Очередь'], ['/', 'Поиск'], ['Esc', 'Назад, в конце — на главную']];
    openModal({ title: 'Горячие клавиши', html: `<div class="kbd-list">${rows.map(([k, d]) => `<div><span>${d}</span><kbd>${k}</kbd></div>`).join('')}</div>` });
}
// ================= поиск =================
const doSearch = debounce(() => {
    if (route().name !== 'search') {
        location.hash = '#/search';
        return;
    }
    const box = $('#search-results');
    if (box)
        box.innerHTML = searchResults(query);
    syncRows();
}, 60);
document.addEventListener('input', e => {
    if (!e.target.matches?.('.search-input'))
        return;
    query = e.target.value;
    $$('.search-input').forEach(i => { if (i !== e.target)
        i.value = query; });
    doSearch();
});
// ================= настройки: тексты, резервная копия, сброс =================
let lyBusy = false;
async function findAllLyrics() {
    if (lyBusy)
        return toast('Поиск уже идёт…', 'info');
    const list = derived().all.filter(t => !t.lyrics);
    if (!list.length)
        return toast('У всех песен уже есть текст', 'info');
    lyBusy = true;
    let found = 0, i = 0;
    const t0 = toast(`Ищу тексты: ${list.length} песен…`, 'info', 3000);
    const worker = async () => { while (i < list.length) {
        const t = list[i++];
        if (await ensureLyrics(t))
            found++;
    } };
    await Promise.all([worker(), worker(), worker()]);
    lyBusy = false;
    toast(`Готово: найдено ${found} из ${list.length}. Остальные — «Текст не найден».`, 'ok', 5000);
}
function setSettings() {
    openModal({ title: 'Сбросить настройки?', html: '<p class="modal-text">Вид, цвета, фон и остальные параметры вернутся к значениям по умолчанию. Музыка, плейлисты и профиль не затрагиваются.</p>',
        actions: [{ label: 'Отмена' }, { label: 'Сбросить', primary: true, danger: true, onClick: () => { Object.assign(state.settings, DEFAULT_SETTINGS); save(); emit('settings', 'all'); } }] });
}
// ползунки своего эквалайзера: звук меняется сразу, без перерисовки страницы
document.addEventListener('input', e => {
    const r = e.target.closest && e.target.closest('.eq-slider');
    if (!r)
        return;
    const g = (state.settings.eqCustom || [0, 0, 0, 0, 0, 0]).slice();
    g[+r.dataset.i] = +r.value;
    const b = r.parentElement.querySelector('b');
    if (b)
        b.textContent = (g[+r.dataset.i] > 0 ? '+' : '') + g[+r.dataset.i];
    setSetting('eqCustom', g);
});
// ---------- вход по почте для синхронизации ----------
function emailSignIn() {
    openModal({
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
        if (await signInEmail(mail, pass, create)) {
            api.close();
            toast('Вы вошли — синхронизация включена');
        }
        else
            api.el.querySelector('#em-err').textContent = sync.error;
    }
}
on('sync', () => { if (route().name === 'settings')
    render({ keepScroll: true }); });
// ---------- редактор умного плейлиста ----------
function smartEditor(p) {
    const r = p?.rules || { sort: 'random' };
    const num = (k, label, ph) => `<label class="sm-field"><span>${label}</span><input class="input" type="number" min="0" step="1" data-r="${k}" value="${r[k] || ''}" placeholder="${ph}"></label>`;
    const sel = (k, label, opts) => `<label class="sm-field"><span>${label}</span><select class="input" data-r="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(r[k] || '') === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    openModal({
        title: p ? 'Умный плейлист' : 'Новый умный плейлист', wide: true,
        html: `<div class="sm-form">
      <label class="sm-field wide"><span>Название</span><input class="input" data-r="name" value="${esc(p?.name || '')}" placeholder="Например, «Любимое, но забытое»" maxlength="80"></label>
      <label class="sm-check"><input type="checkbox" data-r="liked" ${r.liked ? 'checked' : ''}><span>Только понравившиеся</span></label>
      <label class="sm-field"><span>Артист содержит</span><input class="input" data-r="artist" value="${esc(r.artist || '')}" placeholder="любой"></label>
      <label class="sm-field"><span>Жанр содержит</span><input class="input" data-r="genre" value="${esc(r.genre || '')}" placeholder="любой"></label>
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
                    saveSmart(sp);
                    if (!p)
                        location.hash = '#/smart/' + sp.id;
                    else
                        render({ keepScroll: true });
                } }],
        onMount: api => {
            const upd = () => { const n = smartTracks({ id: 'preview', rules: read(api.el) }).length; api.el.querySelector('#sm-count').textContent = `Сейчас подходит: ${plural(n, ['песня', 'песни', 'песен'])}`; };
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
    const data = { app: 'puro-cielo', v: 1, covers: state.covers, playlists: state.playlists, likes: [...state.likes], plays: state.plays, profile: state.profile, settings: state.settings, theme: state.theme,
        // треки в плейлистах привязаны к id — сохраняем ещё и «имя» для справки
        names: Object.fromEntries([...state.tracks.values()].map(t => [t.id, `${t.artist} — ${t.title}`])) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = 'puro-cielo-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Резервная копия сохранена');
}
$('#backup-input').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f)
        return;
    try {
        const d = JSON.parse(await f.text());
        if (d.app !== 'puro-cielo')
            throw 0;
        if (Array.isArray(d.playlists))
            state.playlists = d.playlists;
        if (Array.isArray(d.likes))
            state.likes = new Set(d.likes);
        if (d.plays)
            state.plays = d.plays;
        if (d.profile)
            Object.assign(state.profile, d.profile);
        if (d.settings)
            Object.assign(state.settings, d.settings);
        if (d.theme)
            state.theme = d.theme;
        if (d.covers && typeof d.covers === 'object')
            setCovers(d.covers);
        save();
        applyTheme(state.theme);
        applySettings();
        setLang(state.settings.lang);
        renderChrome();
        render({ keepScroll: true });
        toast('Копия загружена');
    }
    catch {
        toast('Это не файл резервной копии Puro Cielo', 'warn');
    }
});
// не гасить экран, пока играет музыка
let wake = null;
async function syncWake() {
    try {
        const want = state.settings.keepAwake && !audio.paused && 'wakeLock' in navigator;
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
audio.addEventListener('play', syncWake);
audio.addEventListener('pause', syncWake);
on('settings', syncWake);
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
    name: { title: 'Изменить имя', label: 'Отображаемое имя', max: 40, get: () => state.profile.name, set: v => { state.profile.name = v.trim() || 'Слушатель'; save(); emit('profile'); } },
    username: { title: 'Изменить ник', label: 'Имя пользователя', max: 30, pre: '@', get: () => state.profile.username,
        set: v => { state.profile.username = (v.trim().replace(/^@+/, '').replace(/[^\w.]/g, '') || 'listener').toLowerCase(); save(); emit('profile'); } },
    lyricsProxy: { title: 'Свой сервер текстов', label: 'Адрес Cloudflare Worker (https://…workers.dev)', max: 200, get: () => state.settings.lyricsProxy || '',
        set: v => { v = v.trim().replace(/\/+$/, ''); if (v && !/^https:\/\//i.test(v)) {
            toast('Адрес должен начинаться с https://', 'warn');
            return false;
        } setSetting('lyricsProxy', v); } },
};
function quickEdit(kind) {
    const q = QUICK[kind];
    openModal({ title: q.title, html: `<label class="field"><span>${q.label}</span>${q.pre ? `<div class="input-pre"><i>${q.pre}</i><input class="input" id="qe" maxlength="${q.max}" value="${esc(q.get())}"></div>` : `<input class="input" id="qe" maxlength="${q.max}" value="${esc(q.get())}">`}</label>`,
        actions: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: () => q.set(document.getElementById('qe').value) }],
        onMount: () => { const i = document.getElementById('qe'); i.focus(); i.select(); i.addEventListener('keydown', e => { if (e.key === 'Enter')
            document.querySelector('.modal-foot [data-act="1"]').click(); }); } });
}
function editProfile() {
    const draft = { ...state.profile };
    openModal({
        title: 'Профиль', wide: true,
        html: `<div class="pe">
      <div class="pe-banner" id="pe-banner"></div>
      <div class="pe-avatar" id="pe-avatar"></div>
      <div class="pe-btns"><button class="btn btn-soft sm" data-pick="banner">${icon('upload')}Баннер</button><button class="btn btn-soft sm" data-pick="avatar">${icon('upload')}Аватар</button><button class="btn btn-soft sm" data-reset>Сбросить</button></div>
      <label class="field"><span>Отображаемое имя</span><input class="input" id="pe-name" maxlength="40" value="${esc(draft.name)}"></label>
      <label class="field"><span>Имя пользователя</span><div class="input-pre"><i>@</i><input class="input" id="pe-user" maxlength="30" value="${esc(draft.username)}"></div></label>
      <input type="file" accept="image/*" id="pe-file" hidden></div>`,
        actions: [{ label: 'Отмена' }, {
                label: 'Сохранить', primary: true, onClick: () => {
                    state.profile = { ...draft, name: $('#pe-name').value.trim() || 'Слушатель', username: ($('#pe-user').value.trim().replace(/^@+/, '').replace(/[^\w.]/g, '') || 'listener').toLowerCase() };
                    save();
                    emit('profile');
                },
            }],
        onMount: api => {
            const paint = () => {
                $('#pe-banner').style.backgroundImage = draft.banner ? `url(${draft.banner})` : '';
                $('#pe-banner').classList.toggle('default', !draft.banner);
                $('#pe-avatar').innerHTML = draft.avatar ? `<span class="avatar xl"><img src="${draft.avatar}" alt=""></span>` : `<span class="avatar xl ph">${esc((($('#pe-name')?.value || draft.name).trim() || '?').charAt(0).toUpperCase())}</span>`;
            };
            paint();
            let kind = null;
            api.el.addEventListener('click', e => {
                const b = e.target.closest('[data-pick]');
                if (b) {
                    kind = b.dataset.pick;
                    $('#pe-file').value = '';
                    $('#pe-file').click();
                }
                if (e.target.closest('[data-reset]')) {
                    draft.avatar = draft.banner = null;
                    paint();
                }
            });
            $('#pe-name').addEventListener('input', () => { if (!draft.avatar)
                paint(); });
            $('#pe-file').addEventListener('change', async (ev) => {
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
                    toast('Не удалось прочитать изображение', 'warn');
                }
            });
        },
    });
}
async function clearLibrary() {
    openModal({
        title: 'Очистить библиотеку?', html: `<p class="modal-text">${isNative ? 'Кэш тегов и обложек будет удалён, а музыка в вашей папке останется нетронутой. Выберите папку заново, чтобы загрузить библиотеку.' : 'Все добавленные файлы будут удалены из браузера.'} Лайки и плейлисты сохранятся, но треки в них станут недоступны.</p>`,
        actions: [{ label: 'Отмена' }, { label: 'Очистить', primary: true, danger: true, onClick: async () => {
                    stop();
                    await clearFiles();
                    for (const id of state.tracks.keys())
                        forgetFile(id);
                    for (const t of state.tracks.values()) {
                        if (!t.url.startsWith('/f/'))
                            URL.revokeObjectURL(t.url);
                        if (t.cover)
                            URL.revokeObjectURL(t.cover);
                    }
                    state.tracks.clear();
                    state.hidden = [];
                    state.recents = [];
                    save();
                    touchLibrary();
                    toast('Библиотека очищена', 'info');
                } }],
    });
}
// ================= импорт: кнопки и drag & drop =================
const fileInput = $('#file-input'), dirInput = $('#dir-input'), m3uInput = $('#m3u-input');
for (const inp of [fileInput, dirInput, m3uInput])
    inp.addEventListener('change', async () => { const fs = [...inp.files]; inp.value = ''; await importFiles(fs); });
let dragDepth = 0;
const drop = $('#drop');
addEventListener('dragenter', e => { if (e.dataTransfer?.types?.includes('Files')) {
    dragDepth++;
    drop.classList.add('show');
} });
addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth)
    drop.classList.remove('show'); });
addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files'))
    e.preventDefault(); });
addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    drop.classList.remove('show');
    const p = filesFromDrop(e.dataTransfer); // записи собираются синхронно
    await importFiles(await p);
});
// ================= подписки =================
on('library', () => { render({ keepScroll: true }); renderSidePlaylists(); });
on('playlists', () => { render({ keepScroll: true }); renderSidePlaylists(); });
on('likes', syncLikes);
on('track', syncRows);
// карточка «Продолжить» на главной показывает ту песню, что играет сейчас
on('track', () => { const el = route().name === 'home' && $('.cont'); if (el && el.dataset.trackId !== current()?.id) {
    const html = continueCard();
    if (html)
        el.outerHTML = html;
} });
on('profile', () => { renderSideProfile(); render({ keepScroll: true }); });
on('theme', () => { render({ keepScroll: true }); syncThemeBtn(); });
on('settings', k => {
    applySettings();
    if (k === 'stripSource') {
        touchLibrary();
        const t = current();
        if (t)
            emit('track', t);
    }
    if (k === 'lang' || k === 'all') {
        setLang(state.settings.lang);
        renderChrome();
        render({ keepScroll: true });
        emit('modes');
        emit('volume');
    }
    if (k === 'speed' || k === 'all')
        setSpeed(state.settings.speed);
    if (['all', 'corners', 'density', 'anim', 'homeRecents', 'homeOrder', 'homeHidden', 'bgCover', 'seekStep', 'keepAwake', 'homeView', 'cardSize', 'accent', 'lyricsSize', 'bgAnim', 'splash', 'autoLyrics', 'visualizer', 'speed', 'transition', 'eq'].includes(k))
        render({ keepScroll: true });
});
on('sleep', () => { if (['profile', 'settings'].includes(route().name))
    render({ keepScroll: true }); });
on('error', t => toast(`Не удалось воспроизвести «${t?.title || 'трек'}». Возможно, формат не поддерживается.`, 'warn', 4500));
// ================= «назад»: Esc, Alt+←, кнопка мыши «назад», свайп от левого края =================
const navStack = [location.hash || '#/home'], scrollMem = new Map();
let lastHash = navStack[0];
function goBack() {
    if (closeTopModal() || closeMenu())
        return true;
    if (isNPOpen()) {
        closeNP();
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
    closeMenu();
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
addEventListener('touchend', e => { if (swX == null)
    return; const t = e.changedTouches[0]; if (t.clientX - swX > 70 && Math.abs(t.clientY - swY) < 70)
    goBack(); swX = null; }, { passive: true });
// ================= горизонтальные ряды: стрелки, колесо, перетаскивание =================
function syncRails() {
    $$('.section').forEach(sec => {
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
addEventListener('pointerup', () => { if (!drag)
    return; if (drag.moved) {
    noClick = true;
    setTimeout(() => { noClick = false; }, 0);
} drag.r.classList.remove('dragging'); drag = null; });
document.addEventListener('click', e => { if (noClick) {
    e.stopPropagation();
    e.preventDefault();
} }, true);
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
addEventListener('pagehide', flushSave);
addEventListener('beforeunload', flushSave);
document.addEventListener('visibilitychange', () => { if (document.hidden)
    flushSave(); });
// ================= старт =================
(async () => {
    await load();
    initI18n(state.settings.lang);
    initSync();
    initAutoCovers();
    applyTheme(state.theme);
    applySettings();
    setVolume(state.volume);
    setSpeed(state.settings.speed);
    renderChrome();
    initPlayerUI();
    initBgFx();
    runSplash();
    render();
    const n = await restoreLibrary();
    if (n)
        toast(`Библиотека восстановлена: ${n}`, 'info', 2000);
    if (isNative)
        rescan();
})();
// Android: оболочка присылает список файлов выбранной папки; «назад» и фоновое воспроизведение
window.__puroNative = { onFetch: onNativeFetch, onScan: scan => syncNativeLibrary(scan).then(() => { if (['profile', 'settings'].includes(route().name))
        render({ keepScroll: true }); }) };
window.__puroBack = () => goBack();
// команды из уведомления / наушников (Android)
window.__puroCmd = c => { if (c === 'toggle')
    toggle();
else if (c === 'next')
    next();
else if (c === 'prev')
    prev(); };
if (isNative) {
    const pushPlayback = () => { const t = current(); setPlayback(!!t && !audio.paused, t?.title, t ? artistsOfTrack(t) : ''); };
    on('track', pushPlayback);
    on('state', pushPlayback);
}
// PWA: офлайн-кэш оболочки (только при открытии по http/https, не внутри приложения)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !isNative)
    navigator.serviceWorker.register('sw.js').catch(() => { });
window.__puro = { state: state, P: P, audio: audio, importFiles: importFiles, derived: derived };
