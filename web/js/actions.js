import { openTrackInfo } from './tagedit.js';
import { addToPlaylist, createPlaylist, derived, getTrack, playlistTracks, removeFromPlaylist, removeTracks, setSetting, state, toggleLike } from './state.js';
import { forgetFile } from './native.js';
import { duplicateGroups, inherit } from './tools.js';
import { addNext, addToQueue, purge } from './player.js';
import { confirmBox, openMenu, openModal, promptText, toast } from './ui.js';
import { icon } from './icons.js';
import { esc, plural } from './util.js';
import { mosaic } from './views.js';

export async function newPlaylistFlow(ids = []) {
    const name = await promptText({ title: 'Новый плейлист', label: 'Название', placeholder: 'Например, «Ночной драйв»', ok: 'Создать' });
    if (!name)
        return null;
    const p = createPlaylist(name, ids);
    toast(ids.length ? `«${p.name}»: добавлено ${plural(ids.length, ['трек', 'трека', 'треков'])}` : `Плейлист «${p.name}» создан`);
    return p;
}
export function addToPlaylistModal(ids) {
    ids = [].concat(ids);
    const list = state.playlists.map(p => `<button class="pl-pick" data-pid="${p.id}">${mosaic(playlistTracks(p).slice(0, 4), p.id, 'mini-cov')}<span><b>${esc(p.name)}</b><small>${plural(p.ids.length, ['песня', 'песни', 'песен'])}</small></span></button>`).join('');
    openModal({
        title: 'Добавить в плейлист',
        html: `<button class="pl-pick new" data-new>${'<span class="mini-cov new">' + icon('plus') + '</span>'}<span><b>Новый плейлист…</b><small>Создать и добавить</small></span></button>${list}`,
        onMount: api => api.el.addEventListener('click', async (e) => {
            const pick = e.target.closest('.pl-pick');
            if (!pick)
                return;
            if (pick.dataset.new !== undefined) {
                api.close();
                await newPlaylistFlow(ids);
                return;
            }
            const n = addToPlaylist(pick.dataset.pid, ids);
            const p = state.playlists.find(x => x.id === pick.dataset.pid);
            toast(n ? `Добавлено в «${p.name}»` : `Уже в «${p.name}»`, n ? 'ok' : 'info');
            api.close();
        }),
    });
}
export async function deleteTrackFlow(id) {
    const t = getTrack(id);
    if (!t)
        return;
    const yes = await confirmBox({ title: 'Удалить песню?', text: `«${t.title}» исчезнет из медиатеки, плейлистов и понравившихся. Сам файл на устройстве останется.`, ok: 'Удалить', danger: true });
    if (!yes)
        return;
    purge([id]);
    forgetFile(id);
    removeTracks([id]);
    toast(`Песня «${t.title}» удалена`);
}
// Дубликаты: удалить лишние копии (в одной группе или во всех). Лайки, плейлисты и прослушивания переходят на оставшуюся копию.
export async function dedupeFlow(key) {
    const groups = duplicateGroups().filter(g => !key || g.key === key);
    const extra = groups.flatMap(g => g.extra);
    if (!extra.length)
        return;
    const yes = await confirmBox({ title: extra.length === 1 ? 'Удалить лишнюю копию?' : 'Удалить лишние копии?', text: `Будет удалено песен: ${extra.length}. В каждой группе останется лучшая копия; лайки и плейлисты перейдут на неё. Сами файлы на устройстве останутся.`, ok: 'Удалить', danger: true });
    if (!yes)
        return;
    for (const g of groups)
        inherit(g.keep, g.extra);
    const ids = extra.map(t => t.id);
    purge(ids);
    ids.forEach(forgetFile);
    removeTracks(ids);
    toast(`Удалено лишних копий: ${ids.length}`);
}
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const fmtSpeed = v => String(v).replace('.', ',') + '×';
function speedMenu(anchor) {
    const cur = state.settings.speed || 1;
    openMenu(anchor, SPEEDS.map(v => ({ icon: v === cur ? 'check' : '', label: fmtSpeed(v), onClick: () => setSetting('speed', v) })));
}
export function trackMenu(anchor, id, { pid, np, extra = [] } = {}) {
    const t = getTrack(id);
    if (!t)
        return;
    const liked = state.likes.has(id);
    const items = [
        ...extra,
        ...(np ? [{ icon: 'speed', label: `Скорость: ${fmtSpeed(state.settings.speed || 1)}`, keep: true, onClick: () => speedMenu(anchor) }, { sep: true }] : []),
        { icon: 'next2', label: 'Играть следующим', onClick: () => { addNext(id); toast('Добавлено: следующим'); } },
        { icon: 'queue', label: 'В конец очереди', onClick: () => { addToQueue(id); toast('Добавлено в очередь'); } },
        { sep: true },
        { icon: 'playlist', label: 'Добавить в плейлист…', onClick: () => addToPlaylistModal(id) },
        { icon: liked ? 'heart-fill' : 'heart', label: liked ? 'Убрать из понравившихся' : 'Нравится', onClick: () => toggleLike(id) },
        { sep: true },
        { icon: 'edit', label: 'Данные трека…', onClick: () => openTrackInfo(id) },
        { icon: 'search', label: 'Найти на SoundCloud', onClick: () => window.open('https://soundcloud.com/search?q=' + encodeURIComponent(`${(t._artists || [t.artist])[0] || ''} ${t.title}`.trim()), '_blank', 'noopener') },
        { icon: 'disc', label: 'Перейти к альбому', onClick: () => { derived(); location.hash = '#/album/' + encodeURIComponent(t._albumKey); } },
        { icon: 'user', label: 'Перейти к артисту', onClick: () => { derived(); location.hash = '#/artist/' + encodeURIComponent(t._artistKey); } },
    ];
    if (pid)
        items.push({ sep: true }, { icon: 'trash', label: 'Убрать из плейлиста', danger: true, onClick: () => removeFromPlaylist(pid, id) });
    items.push({ sep: true }, { icon: 'trash', label: 'Удалить из медиатеки', danger: true, onClick: () => deleteTrackFlow(id) });
    openMenu(anchor, items);
}
