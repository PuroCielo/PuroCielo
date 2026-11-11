import { derived, getTrack, likedTracks, playlistTracks, smartTracks, state } from './state.js';
import { icon } from './icons.js';
import { SESSION_SEED, enc, esc, fmtTime, fmtTotal, hash, norm, plural, seededShuffle } from './util.js';
import { UNKNOWN, artistKey, trackArtists } from './artists.js';
import { canGoogle, sync } from './sync.js';
import { isEn } from './i18n.js';
import { EQ_BANDS, EQ_PRESETS, current, sleepState } from './player.js';
import { folderName, isNative } from './native.js';

// ---------- реестр списков (для воспроизведения «в контексте») ----------
let seq = 0;
export const lists = new Map();
export const registerList = tracks => { const id = ++seq; lists.set(id, tracks); if (lists.size > 60)
    lists.delete(lists.keys().next().value); return id; };
// ---------- базовые компоненты ----------
const PH = [['#2c2c30', '#0f0f11', '#F5F5F7'], ['#F5F5F7', '#9a9aa2', '#111'], ['#1c1c1f', '#44444a', '#F5F5F7'], ['#E4E4E8', '#8e8e96', '#111'], ['#3a3a40', '#141416', '#E4E4E8'], ['#0f0f11', '#34343a', '#F5F5F7']];
const phStyle = seed => { const h = hash(String(seed)); const p = PH[h % PH.length]; return `background:linear-gradient(${(h >> 3) % 360}deg,${p[0]},${p[1]});color:${p[2]}`; };
export const cov = (src, seed, cls = '') => src
    ? `<div class="cov ${cls}"><img src="${src}" alt="" loading="lazy" draggable="false"></div>`
    : `<div class="cov ph ${cls}" style="${phStyle(seed)}">${icon('note')}</div>`;
export const mosaic = (tracks, seed, cls = '') => {
    const covers = [...new Set(tracks.map(t => t.cover).filter(Boolean))];
    if (covers.length >= 4)
        return `<div class="cov mosaic ${cls}">${covers.slice(0, 4).map(c => `<img src="${c}" alt="" draggable="false">`).join('')}</div>`;
    return cov(covers[0] || null, seed, cls);
};
export const avatarHTML = (cls = '') => state.profile.avatar
    ? `<span class="avatar ${cls}"><img src="${state.profile.avatar}" alt=""></span>`
    : `<span class="avatar ph ${cls}">${esc((state.profile.name || '?').trim().charAt(0).toUpperCase())}</span>`;
const albumHref = k => '#/album/' + enc(k);
const artistHref = k => '#/artist/' + enc(k);
export const artistsOf = t => t._artists || trackArtists(t);
// Каждый артист — отдельная ссылка, между ними запятая
export const artistLinks = names => names.map(n => `<a class="alink" href="${artistHref(artistKey(n))}">${esc(n)}</a>`).join(', ');
export const albumLink = t => t.album ? `<a class="alink" href="${albumHref(t._albumKey || '')}">${esc(t.album)}</a>` : '';
function section(title, body, { href, more = 'Показать все' } = {}) {
    const arrows = body.startsWith('<div class="rail') ? `<span class="rail-nav"><button class="rn" data-rail="-1" aria-label="Назад">${icon('chev-left')}</button><button class="rn" data-rail="1" aria-label="Вперёд">${icon('chev-right')}</button></span>` : '';
    return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2><div class="sec-r">${href ? `<a class="more-link" href="${href}">${more}${icon('chev-right')}</a>` : ''}${arrows}</div></div>${body}</section>`;
}
const rail = html => `<div class="rail">${html}</div>`;
const albumCard = g => `<article class="card" tabindex="0" role="link" data-nav="${albumHref(g.key)}">
  <div class="card-art">${cov(g.cover, g.key)}<button class="play-fab" data-action="play-album" data-key="${esc(g.key)}" aria-label="Играть">${icon('play')}</button></div>
  <h3 class="card-title">${esc(g.name)}</h3><p class="card-sub">${artistLinks(g.artists)}${g.year ? ' · ' + esc(g.year) : ''}</p></article>`;
const singleCard = g => `<article class="card" tabindex="0" role="link" data-nav="${albumHref(g.key)}">
  <div class="card-art">${cov(g.cover, g.key)}<button class="play-fab" data-action="play-album" data-key="${esc(g.key)}" aria-label="Играть">${icon('play')}</button></div>
  <h3 class="card-title">${esc(g.name)}</h3><p class="card-sub">${artistLinks(g.artists)} · ${g.tracks.length === 1 ? 'Сингл' : 'EP'}</p></article>`;
// у артиста без своей картинки — первая буква имени, а не обложка чужого трека
export const artistArt = a => a.cover ? cov(a.cover, a.key, 'round') : `<div class="cov ph round letter" style="${phStyle(a.key)}">${esc((String(a.name || '?').trim()[0] || '?').toUpperCase())}</div>`;
const artistCard = (a, { sub = true } = {}) => `<article class="card card-artist" tabindex="0" role="link" data-nav="${artistHref(a.key)}">
  <div class="card-art round">${artistArt(a)}<button class="play-fab" data-action="play-artist" data-key="${esc(a.key)}" aria-label="Играть">${icon('play')}</button></div>
  <h3 class="card-title center">${esc(a.name)}</h3>${sub ? `<p class="card-sub center">${plural(a.tracks.length, ['песня', 'песни', 'песен'])}</p>` : ''}</article>`;
const playlistCard = p => {
    const ts = playlistTracks(p);
    return `<article class="card" tabindex="0" role="link" data-nav="#/playlist/${p.id}">
  <div class="card-art">${mosaic(ts, p.id)}<button class="play-fab" data-action="play-playlist" data-id="${p.id}" aria-label="Играть">${icon('play')}</button></div>
  <h3 class="card-title">${esc(p.name)}</h3><p class="card-sub">${plural(ts.length, ['песня', 'песни', 'песен'])}</p></article>`;
};
const likedCard = () => `<article class="card" tabindex="0" role="link" data-nav="#/liked">
  <div class="card-art"><div class="cov liked-cov">${icon('heart-fill')}</div><button class="play-fab" data-action="play-liked" aria-label="Играть">${icon('play')}</button></div>
  <h3 class="card-title">Понравившееся</h3><p class="card-sub">${plural(state.likes.size, ['песня', 'песни', 'песен'])}</p></article>`;
const smartCard = p => {
    const ts = smartTracks(p);
    return `<article class="card" tabindex="0" role="link" data-nav="#/smart/${p.id}">
  <div class="card-art"><div class="smart-art">${mosaic(ts, p.id)}<span class="smart-badge">${icon('smart')}</span></div><button class="play-fab" data-action="play-smart" data-id="${p.id}" aria-label="Играть">${icon('play')}</button></div>
  <h3 class="card-title">${esc(p.name)}</h3><p class="card-sub">Умный · ${plural(ts.length, ['песня', 'песни', 'песен'])}</p></article>`;
};
const newSmartCard = () => `<article class="card card-new" tabindex="0" role="button" data-action="new-smart">
  <div class="card-art"><div class="cov new-cov">${icon('smart')}</div></div><h3 class="card-title">Умный плейлист</h3><p class="card-sub">Собирается сам по правилам</p></article>`;
const newPlaylistCard = () => `<article class="card card-new" tabindex="0" role="button" data-action="new-playlist">
  <div class="card-art"><div class="cov new-cov">${icon('plus')}</div></div><h3 class="card-title">Новый плейлист</h3><p class="card-sub">Создать</p></article>`;
const recentCard = (t, i, lid) => `<article class="card" tabindex="0" role="button" data-track="${esc(t.id)}" data-list="${lid}" data-i="${i}">
  <div class="card-art">${cov(t.cover, t._albumKey || t.id)}<span class="play-fab static">${icon('play')}</span></div>
  <h3 class="card-title">${esc(t.title)}</h3><p class="card-sub">${artistLinks(artistsOf(t))}</p></article>`;
// строки для режима «Список» на главной
const lrow = ({ cover, title, sub, nav, act, round }) => `<article class="lrow" tabindex="0" role="${nav ? 'link' : 'button'}" ${nav ? `data-nav="${nav}"` : act ? `data-action="${act}"` : ''}>
  <div class="lrow-cov ${round ? 'round' : ''}">${cover}</div>
  <div class="lrow-main"><div class="lrow-title">${esc(title)}</div><div class="lrow-sub">${sub}</div></div>
  ${nav && act ? `<button class="icon-btn lrow-play" ${act} aria-label="Играть">${icon('play')}</button>` : ''}</article>`;
const albumRow = (g, single) => lrow({ cover: cov(g.cover, g.key), title: g.name, nav: albumHref(g.key), act: `data-action="play-album" data-key="${esc(g.key)}"`,
    sub: `${artistLinks(g.artists)}${single ? ' · ' + (g.tracks.length === 1 ? 'Сингл' : 'EP') : g.year ? ' · ' + esc(g.year) : ''}` });
const artistRow = a => lrow({ cover: artistArt(a), round: true, title: a.name, nav: artistHref(a.key), act: `data-action="play-artist" data-key="${esc(a.key)}"`, sub: plural(a.tracks.length, ['песня', 'песни', 'песен']) });
const playlistRow = p => { const ts = playlistTracks(p); return lrow({ cover: mosaic(ts, p.id), title: p.name, nav: `#/playlist/${p.id}`, act: `data-action="play-playlist" data-id="${p.id}"`, sub: plural(ts.length, ['песня', 'песни', 'песен']) }); };
const likedRow = () => lrow({ cover: `<div class="cov liked-cov">${icon('heart-fill')}</div>`, title: 'Понравившееся', nav: '#/liked', act: 'data-action="play-liked"', sub: plural(state.likes.size, ['песня', 'песни', 'песен']) });
const newPlaylistRow = () => lrow({ cover: `<div class="cov new-cov">${icon('plus')}</div>`, title: 'Новый плейлист', act: 'new-playlist', sub: 'Создать' });
export function trackRow(t, i, lid, o = {}) {
    const cur = current()?.id === t.id;
    return `<div class="row ${cur ? 'is-current' : ''}" tabindex="0" role="button" data-track="${esc(t.id)}" data-list="${lid}" data-i="${i}">
    <div class="row-lead">
      ${o.cover ? `<div class="row-cover">${cov(t.cover, t._albumKey || t.id)}<span class="row-cover-ov"><span class="eq"><i></i><i></i><i></i></span>${icon('play')}</span></div>`
        : `<span class="num">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span><span class="row-play">${icon('play')}</span>`}
    </div>
    <div class="row-main"><div class="row-title">${esc(t.title)}</div><div class="row-artist">${artistLinks(artistsOf(t))}</div></div>
    <div class="row-album">${t.album ? albumLink(t) : '—'}</div>
    <button class="icon-btn row-del" data-action="delete-track" data-id="${esc(t.id)}" aria-label="Удалить песню" title="Удалить песню">${icon('trash')}</button>
    <button class="icon-btn like ${state.likes.has(t.id) ? 'on' : ''}" data-action="like" data-id="${esc(t.id)}" aria-label="Нравится">${icon(state.likes.has(t.id) ? 'heart-fill' : 'heart')}</button>
    <div class="row-time">${fmtTime(t.duration)}</div>
    <button class="icon-btn" data-action="menu" data-id="${esc(t.id)}" ${o.pid ? `data-pid="${o.pid}"` : ''} aria-label="Ещё">${icon('more')}</button>
  </div>`;
}
const trackList = (tracks, o = {}) => { const lid = registerList(tracks); return `<div class="tracklist" data-lid="${lid}">${tracks.map((t, i) => trackRow(t, i, lid, o)).join('')}</div>`; };
function emptyState(compact) {
    return `<div class="empty ${compact ? 'compact' : ''}">
    <div class="empty-icon">${icon('tower')}</div>
    <h2>${compact ? 'Здесь пока пусто' : 'Добавьте свою музыку'}</h2>
    <p>${isNative ? 'Выберите одну папку с музыкой — вся медиатека загрузится из неё, как в Poweramp.' : 'Перетащите файлы или целую папку прямо в окно. Поддерживаются MP3, FLAC, AAC / M4A, OGG, WAV, тексты <b>.lrc</b> и плейлисты <b>.m3u / .m3u8</b>.'}</p>
    <div class="empty-actions">${isNative ? `<button class="btn btn-primary" data-action="add-folder">${icon('folder')}Выбрать папку с музыкой</button><button class="btn btn-soft" data-action="add-files">${icon('upload')}Добавить треки</button>` : `<button class="btn btn-primary" data-action="add-files">${icon('upload')}Выбрать файлы</button><button class="btn btn-soft" data-action="add-folder">${icon('folder')}Выбрать папку</button>`}</div>
  </div>`;
}
const themeBtn = () => `<button class="icon-btn lg theme-btn" data-action="toggle-theme" aria-label="Сменить тему" title="Сменить тему (D)">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>`;
function pageHead(title, sub = '', extra = '') {
    return `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="page-sub">${esc(sub)}</p>` : ''}</div><div class="page-head-r">${extra}<button class="icon-btn lg" data-nav="#/settings" aria-label="Настройки" title="Настройки">${icon('settings')}</button>${themeBtn()}<button class="avatar-btn" data-nav="#/profile" aria-label="Профиль">${avatarHTML()}</button></div></header>`;
}
function hero({ art, eyebrow, title, subHTML = '', meta = '', actions = '', bg = '', round = false }) {
    return `<section class="hero">
    ${bg ? `<div class="hero-bg" style="background-image:url('${bg}')"></div>` : '<div class="hero-bg plain"></div>'}
    <div class="hero-in"><div class="hero-art ${round ? 'round' : ''}">${art}</div>
      <div class="hero-text"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${subHTML ? `<p class="hero-sub">${subHTML}</p>` : ''}${meta ? `<p class="hero-meta">${meta}</p>` : ''}
      <div class="hero-actions">${actions}</div></div></div></section>`;
}
const playBtns = (playAct, shufAct, attrs) => `<button class="btn btn-primary" data-action="${playAct}" ${attrs}>${icon('play')}Играть</button><button class="btn btn-soft" data-action="${shufAct}" ${attrs}>${icon('shuffle')}Перемешать</button>`;
// ---------- миксы: собираются из того, что слушает пользователь ----------
const MIX_MAX = 50;
export function mixes() {
    const d = derived(), all = d.all, pl = state.plays, likes = state.likes;
    const seed = k => hash('mix:' + k) ^ SESSION_SEED;
    const recent = new Set(state.recents);
    // 1) понравившиеся вперемешку
    const liked = seededShuffle(likedTracks(), seed('liked'));
    // 2) самые прослушанные
    const top = all.filter(t => pl[t.id] > 0).sort((a, b) => pl[b.id] - pl[a.id] || (likes.has(b.id) ? 1 : 0) - (likes.has(a.id) ? 1 : 0));
    // 3) любимые артисты: прослушивания + лайки (лайк = 3 прослушивания), берём пятёрку лучших
    const score = a => a.tracks.reduce((s, t) => s + (pl[t.id] || 0) + (likes.has(t.id) ? 3 : 0), 0);
    const favArtists = d.artistList.map(a => [a, score(a)]).filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 5).map(x => x[0]);
    const favSet = new Map();
    for (const a of favArtists)
        for (const t of a.tracks)
            favSet.set(t.id, t);
    const artists = seededShuffle([...favSet.values()], seed('artists'));
    // 4) давно не слушали: то, что нравилось или слушалось, но не попадало в недавние
    const forgotten = seededShuffle(all.filter(t => !recent.has(t.id) && (pl[t.id] > 0 || likes.has(t.id))), seed('forgotten'));
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
export function mixById(id) { return mixes().find(m => m.id === id) || null; }
const mixArt = m => `<div class="mix-art mix-${m.n}">${mosaic(m.tracks, 'mix' + m.id)}<span class="mix-shade"></span><span class="mix-label">${icon('mix')}<b>${esc(m.name)}</b></span></div>`;
const mixCard = m => `<article class="card" tabindex="0" role="link" data-nav="#/mix/${m.id}">
  <div class="card-art">${mixArt(m)}<button class="play-fab" data-action="play-mix" data-id="${m.id}" aria-label="Играть">${icon('play')}</button></div>
  <h3 class="card-title">${esc(m.name)}</h3><p class="card-sub">${m.tracks.length ? plural(m.tracks.length, ['песня', 'песни', 'песен']) : 'Пока пусто'}</p></article>`;
const mixRow = m => lrow({ cover: mixArt(m), title: m.name, nav: `#/mix/${m.id}`, act: `data-action="play-mix" data-id="${m.id}"`, sub: m.tracks.length ? plural(m.tracks.length, ['песня', 'песни', 'песен']) : 'Пока пусто' });
export function mixView(id) {
    const m = mixById(id);
    if (!m)
        return notFound();
    const total = m.tracks.reduce((s, t) => s + t.duration, 0);
    return hero({ art: mixArt(m), eyebrow: 'Микс', title: m.name, bg: m.tracks.find(t => t.cover)?.cover, subHTML: esc(m.desc),
        meta: `${plural(m.tracks.length, ['песня', 'песни', 'песен'])}${m.tracks.length ? ', ' + fmtTotal(total) : ''}`,
        actions: m.tracks.length ? playBtns('play-mix', 'shuffle-mix', `data-id="${m.id}"`) : '' })
        + `<div class="detail">${m.tracks.length ? trackList(m.tracks, { cover: true }) : `<div class="empty compact"><div class="empty-icon">${icon('mix')}</div><h2>Пока пусто</h2><p>${esc(m.desc)}. Слушайте музыку и ставьте лайки — микс обновится сам.</p></div>`}</div>`;
}
// ---------- экраны ----------
function greeting() {
    const h = new Date().getHours();
    const g = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    return `${g}, ${state.profile.name}`;
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
export const viewSwitch = mode => `<div class="seg seg-icons" role="group" aria-label="Вид главной">${HOME_VIEWS.map(([k, ic, n]) => `<button class="${k === mode ? 'on' : ''}" data-action="home-view" data-v="${k}" title="${n}" aria-label="${n}">${icon(ic)}</button>`).join('')}</div>`;
// Разделы главной: порядок и видимость настраиваются (Настройки → Главная)
export const HOME_SECTIONS = [['continue', 'Продолжить'], ['quick', 'Быстрые кнопки'], ['recents', 'Недавно прослушанное'], ['mixes', 'Миксы для вас'], ['albums', 'Альбомы'], ['singles', 'Синглы'], ['playlists', 'Плейлисты'], ['artists', 'Артисты']];
export function homeOrder() {
    const all = HOME_SECTIONS.map(x => x[0]), o = (state.settings.homeOrder || []).filter(k => all.includes(k));
    return [...o, ...all.filter(k => !o.includes(k))];
}
export const homeHidden = () => new Set([...(state.settings.homeHidden || []), ...(state.settings.homeRecents === false ? ['recents'] : [])]);
// «Продолжить»: песня, на которой остановились (или которая играет сейчас)
export function continueCard() {
    const t = current() || getTrack(state.recents[0]);
    if (!t)
        return '';
    const g = derived().groups.get(t._albumKey);
    return `<section class="cont" data-track-id="${esc(t.id)}">
    ${t.cover ? `<div class="cont-bg" style="background-image:url('${t.cover}')"></div>` : ''}
    <div class="cont-art">${cov(t.cover, t._albumKey || t.id)}</div>
    <div class="cont-text"><p class="eyebrow">Продолжить</p><h2>${esc(t.title)}</h2><p class="cont-sub">${artistLinks(artistsOf(t))}${t.album ? ' · ' + albumLink(t) : ''}</p>
      <div class="cont-actions"><button class="btn btn-primary" data-action="home-continue" data-id="${esc(t.id)}">${icon('play')}Слушать дальше</button>${g && g.tracks.length > 1 ? `<a class="btn btn-soft" href="${albumHref(g.key)}">${icon('disc')}Открыть альбом</a>` : ''}</div></div></section>`;
}
const quickBar = () => `<div class="quick"><button class="qbtn" data-action="shuffle-all">${icon('shuffle')}Перемешать всё</button><a class="qbtn" href="#/liked">${icon('heart-fill')}Понравившееся</a><button class="qbtn" data-action="recent-added">${icon('plus')}Недавно добавленные</button></div>`;
export function homeView() {
    const d = derived(), mode = state.settings.homeView || 'rail';
    if (!d.all.length)
        return pageHead('Главная', greeting()) + emptyState();
    const hidden = homeHidden();
    const artists = d.artistList.filter(a => a.name !== UNKNOWN); // «Неизвестного артиста» на главной не показываем
    const parts = {
        continue: () => continueCard(),
        quick: () => quickBar(),
        recents: () => {
            const rec = state.recents.map(getTrack).filter(Boolean).slice(0, 18);
            if (!rec.length)
                return '';
            const lid = registerList(rec);
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
        playlists: () => block(mode, 'Плейлисты', { cards: [likedCard(), ...state.playlists.map(playlistCard), newPlaylistCard()], rows: [likedRow(), ...state.playlists.map(playlistRow), newPlaylistRow()], href: '#/library/playlists', railMax: 14, gridMax: 18, listMax: 8 }),
        artists: () => artists.length ? block(mode, 'Артисты', { cards: artists.map(a => artistCard(a)), rows: artists.map(artistRow), href: '#/library/artists' }) : '',
    };
    return pageHead('Главная', greeting(), viewSwitch(mode)) + homeOrder().filter(k => !hidden.has(k)).map(k => parts[k]()).join('');
}
const TABS = [['media', 'Медиатека'], ['albums', 'Альбомы'], ['singles', 'Синглы'], ['playlists', 'Плейлисты'], ['artists', 'Артисты'], ['songs', 'Песни']];
export let songSort = 'title';
export const setSongSort = v => { songSort = v; };
export function libraryView(tab = 'albums') {
    const d = derived();
    const tabs = `<nav class="seg-tabs" role="tablist">${TABS.map(([k, n]) => `<a role="tab" aria-selected="${k === tab}" class="${k === tab ? 'active' : ''}" href="#/library/${k}">${n}</a>`).join('')}</nav>`;
    const actions = isNative ? `<button class="btn btn-soft sm" data-action="add-files">${icon('plus')}Треки</button><button class="btn btn-soft sm" data-action="add-folder">${icon('folder')}Папка</button>` : `<button class="btn btn-soft sm" data-action="add-files">${icon('plus')}Добавить</button>`;
    const title = tab === 'media' ? 'Медиатека' : 'Библиотека';
    const sub = tab === 'media' ? `${plural(d.albums.length, ['альбом', 'альбома', 'альбомов'])} · ${plural(d.singles.length, ['сингл', 'сингла', 'синглов'])}` : plural(d.all.length, ['песня', 'песни', 'песен']);
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
        body = d.artistList.length ? `<div class="grid artists">${[...d.artistList.filter(a => a.name !== UNKNOWN), ...d.artistList.filter(a => a.name === UNKNOWN)].map(a => artistCard(a)).join('')}</div>` : emptyState(true);
    else if (tab === 'playlists') {
        body = `<div class="grid">${likedCard()}${state.playlists.map(playlistCard).join('')}${state.smart.map(smartCard).join('')}${newPlaylistCard()}${newSmartCard()}</div>
`;
    }
    else {
        if (!d.all.length)
            body = emptyState(true);
        else {
            let songs = d.songs.slice();
            const by = { title: null, artist: (a, b) => (a.artist || '').localeCompare(b.artist || '', 'ru') || a.title.localeCompare(b.title, 'ru'), added: (a, b) => b.addedAt - a.addedAt, duration: (a, b) => b.duration - a.duration, album: (a, b) => (a.album || '').localeCompare(b.album || '', 'ru') };
            if (by[songSort])
                songs.sort(by[songSort]);
            const chips = [['title', 'Название'], ['artist', 'Артист'], ['album', 'Альбом'], ['added', 'Недавно добавленные'], ['duration', 'Длительность']];
            body = `<div class="chips">${chips.map(([k, n]) => `<button class="chip ${k === songSort ? 'on' : ''}" data-action="sort" data-v="${k}">${n}</button>`).join('')}</div>${trackList(songs, { cover: true })}`;
        }
    }
    return h + body;
}
export function albumView(key) {
    const g = derived().groups.get(key);
    if (!g)
        return notFound();
    const total = g.tracks.reduce((s, t) => s + t.duration, 0);
    const meta = [g.genre, g.year].filter(Boolean).map(esc).join(' · ');
    return hero({
        art: cov(g.cover, g.key), eyebrow: g.tracks.length > 1 ? 'Альбом' : 'Сингл', title: g.name, bg: g.cover,
        subHTML: artistLinks(g.artists),
        meta: `${meta}${meta ? ' · ' : ''}${plural(g.tracks.length, ['песня', 'песни', 'песен'])}, ${fmtTotal(total)}`,
        actions: playBtns('play-album', 'shuffle-album', `data-key="${esc(g.key)}"`) + `<button class="icon-btn lg" data-action="album-menu" data-key="${esc(g.key)}" aria-label="Ещё">${icon('more')}</button>`,
    }) + `<div class="detail">${trackList(g.tracks, {})}</div>`;
}
// ---------- страница артиста ----------
function topSongs(a, n = 9) {
    const pl = state.plays, rec = id => state.recents.indexOf(id) + 1 || 999;
    const top = a.tracks.filter(t => pl[t.id] > 0).sort((x, y) => pl[y.id] - pl[x.id] || rec(x.id) - rec(y.id)).slice(0, n);
    if (top.length < n) { // ещё не слушали — добираем случайными (стабильно в рамках сессии)
        const rest = seededShuffle(a.tracks.filter(t => !top.includes(t)), hash(a.key) ^ SESSION_SEED);
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
    const rnd = new Map(d.artistList.map(o => [o.key, (hash(o.key + a.key) ^ SESSION_SEED) % 1000 / 1000]));
    const list = d.artistList.filter(o => o !== a).sort((x, y) => (score.get(y.key) || 0) - (score.get(x.key) || 0) || rnd.get(x.key) - rnd.get(y.key));
    return list.slice(0, n);
}
const topRow = (t, i, lid) => {
    const g = derived().groups.get(t._albumKey);
    const rel = g ? (g.tracks.length === 1 ? `${g.name} · Сингл` : g.name) : (t.album || '');
    const sub = [rel, t.year].filter(Boolean).map(esc).join(' · ');
    const liked = state.likes.has(t.id);
    return `<div class="trow ${current()?.id === t.id ? 'is-current' : ''}" tabindex="0" role="button" data-track="${esc(t.id)}" data-list="${lid}" data-i="${i}">
    <div class="trow-cov">${cov(t.cover, t._albumKey || t.id)}<span class="trow-ov"><span class="eq"><i></i><i></i><i></i></span>${icon('play')}</span></div>
    <div class="trow-main"><div class="trow-title">${esc(t.title)}</div><div class="trow-sub">${sub}</div></div>
    <button class="icon-btn sm like ${liked ? 'on' : ''}" data-action="like" data-id="${esc(t.id)}" aria-label="Нравится">${icon(liked ? 'heart-fill' : 'heart')}</button>
    <button class="icon-btn sm" data-action="menu" data-id="${esc(t.id)}" aria-label="Ещё">${icon('more')}</button>
  </div>`;
};
export function artistView(key) {
    const d = derived(), a = d.artists.get(key);
    if (!a)
        return notFound();
    const own = a.own, albums = own.filter(g => g.tracks.length > 3), eps = own.filter(g => g.tracks.length <= 3);
    const latest = own[0] || a.collab[0];
    const top = topSongs(a), lid = registerList(top);
    const similar = similarArtists(a, d);
    let h = `<section class="artist-hero">
    ${(a.backdrop || a.cover) ? `<div class="hero-bg" style="background-image:url('${a.backdrop || a.cover}')"></div>` : '<div class="hero-bg plain"></div>'}
    <div class="artist-avatar">${artistArt(a)}</div>
    <h1 class="artist-name">${esc(a.name)}</h1>
    <div class="artist-actions">
      <button class="icon-btn lg ghost" data-action="shuffle-artist" data-key="${esc(a.key)}" aria-label="Перемешать">${icon('shuffle')}</button>
      <button class="play-btn" data-action="play-artist" data-key="${esc(a.key)}" aria-label="Играть">${icon('play')}</button>
      <button class="icon-btn lg ghost" data-action="radio-artist" data-key="${esc(a.key)}" aria-label="Случайные песни артиста">${icon('queue')}</button>
      <button class="icon-btn lg ghost" data-action="artist-photo" data-key="${esc(a.key)}" aria-label="Фото артиста" title="Фото артиста">${icon('edit')}</button>
    </div>
  </section><div class="artist-body">`;
    if (latest || top.length) {
        h += `<div class="a-row1">`;
        if (latest) {
            const lt = latest.tracks.length;
            h += `<section class="latest"><h3 class="a-h">Последний релиз</h3>
        <article class="latest-card" tabindex="0" role="link" data-nav="${albumHref(latest.key)}">
          <div class="latest-cov">${cov(latest.cover, latest.key)}</div>
          <div class="latest-text"><span class="latest-date">${esc(latest.year || '')}</span><b>${esc(latest.name)}</b><span class="latest-sub">${lt === 1 ? 'Сингл' : plural(lt, ['песня', 'песни', 'песен'])}</span></div>
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
    const more = special ? '' : `<button class="icon-btn lg" data-action="playlist-menu" data-id="${id}" aria-label="Ещё">${icon('more')}</button>`;
    return hero({ art, eyebrow, title: name, bg, meta: `${plural(tracks.length, ['песня', 'песни', 'песен'])}${tracks.length ? ', ' + fmtTotal(total) : ''}`, actions: acts + more })
        + `<div class="detail">${tracks.length ? trackList(tracks, { pid: special ? '' : id }) : emptyHTML}</div>`;
}
export function playlistView(id) {
    const p = state.playlists.find(x => x.id === id);
    if (!p)
        return notFound();
    const tracks = playlistTracks(p);
    return playlistLike({ id: p.id, name: p.name, tracks, eyebrow: 'Плейлист', art: mosaic(tracks, p.id), bg: tracks.find(t => t.cover)?.cover,
        emptyHTML: `<div class="empty compact"><div class="empty-icon">${icon('playlist')}</div><h2>Плейлист пуст</h2><p>Откройте меню «⋯» у любого трека и выберите «Добавить в плейлист».</p></div>` });
}
export function likedView() {
    const tracks = likedTracks();
    return playlistLike({ id: 'liked', name: 'Понравившееся', tracks, eyebrow: 'Плейлист', art: `<div class="cov liked-cov">${icon('heart-fill')}</div>`, bg: '', special: true,
        emptyHTML: `<div class="empty compact"><div class="empty-icon">${icon('heart')}</div><h2>Пока ничего нет</h2><p>Нажмите на сердечко рядом с треком — он появится здесь.</p></div>` })
        .replace('data-action="play-playlist"', 'data-action="play-liked"').replace('data-action="shuffle-playlist"', 'data-action="shuffle-liked"');
}
// ---------- умный плейлист ----------
export function smartView(id) {
    const p = state.smart.find(x => x.id === id);
    if (!p)
        return notFound();
    const tracks = smartTracks(p), total = tracks.reduce((s, t) => s + t.duration, 0);
    return hero({ art: `<div class="smart-art">${mosaic(tracks, p.id)}<span class="smart-badge">${icon('smart')}</span></div>`, eyebrow: 'Умный плейлист', title: p.name, bg: tracks.find(t => t.cover)?.cover,
        subHTML: esc(smartRulesText(p.rules)),
        meta: `${plural(tracks.length, ['песня', 'песни', 'песен'])}${tracks.length ? ', ' + fmtTotal(total) : ''}`,
        actions: (tracks.length ? playBtns('play-smart', 'shuffle-smart', `data-id="${p.id}"`) : '') + `<button class="icon-btn lg" data-action="smart-menu" data-id="${p.id}" aria-label="Ещё">${icon('more')}</button>` })
        + `<div class="detail">${tracks.length ? trackList(tracks, {}) : `<div class="empty compact"><div class="empty-icon">${icon('smart')}</div><h2>Под правила пока ничего не подходит</h2><p>Измените правила в меню «⋯» — плейлист обновится сам.</p></div>`}</div>`;
}
export function smartRulesText(r = {}) {
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
export function statsView(period = 'month') {
    const per = PERIODS.find(x => x[0] === period) || PERIODS[1], since = per[2] ? Date.now() - per[2] * 864e5 : 0;
    const log = state.playLog.filter(x => x[1] >= since);
    // «Всё время» — ещё и прослушивания до появления журнала (из счётчиков)
    const counts = new Map();
    if (per[0] === 'all')
        for (const [id, n] of Object.entries(state.plays))
            counts.set(id, n);
    else
        for (const [id] of log)
            counts.set(id, (counts.get(id) || 0) + 1);
    const plays = [...counts.values()].reduce((a, b) => a + b, 0);
    const secs = per[0] === 'all' ? [...counts].reduce((s, [id, n]) => s + n * (getTrack(id)?.duration || 0), 0) : log.reduce((s, x) => s + (x[2] || 0), 0);
    const topTracks = [...counts].map(([id, n]) => [getTrack(id), n]).filter(x => x[0]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const art = new Map();
    for (const [id, n] of counts) {
        const t = getTrack(id);
        if (t)
            for (const a of trackArtists(t))
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
        return h + `<div class="empty compact"><div class="empty-icon">${icon('chart')}</div><h2>Пока нечего считать</h2><p>Прослушивание засчитывается после 30 секунд песни. Послушайте музыку — итоги появятся здесь.</p></div>`;
    const mins = Math.round(secs / 60);
    h += `<div class="stats-kpis"><div class="kpi"><b>${mins < 600 ? mins + ' мин' : Math.round(mins / 60) + ' ч'}</b><span>музыки</span></div><div class="kpi"><b>${plays}</b><span>прослушиваний</span></div><div class="kpi"><b>${counts.size}</b><span>разных песен</span></div><div class="kpi"><b>${art.size}</b><span>артистов</span></div></div>`;
    if (topArtists.length)
        h += `<section class="section"><div class="section-head"><h2>Любимые артисты</h2></div><div class="stats-artists">${topArtists.map(([a, n], i) => `<a class="stats-artist" href="#/artist/${enc(artistKey(a))}"><span class="rank">${i + 1}</span><span class="name">${esc(a)}</span><span class="n">${plural(n, ['раз', 'раза', 'раз'])}</span></a>`).join('')}</div></section>`;
    if (topTracks.length) {
        const lid = registerList(topTracks.map(x => x[0]));
        h += `<section class="section"><div class="section-head"><h2>Самые прослушиваемые песни</h2></div><div class="tracklist" data-lid="${lid}">${topTracks.map(([t, n], i) => trackRow(t, i, lid, { cover: true }).replace(/<div class="row-album">[\s\S]*?<\/div>\n/, `<div class="row-album stats-n">${plural(n, ['прослушивание', 'прослушивания', 'прослушиваний'])}</div>\n`)).join('')}</div></section>`;
    }
    if (log.length)
        h += `<section class="section"><div class="section-head"><h2>По дням недели</h2></div><div class="stats-days">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => `<div class="day"><i style="height:${Math.round(days[i] / dmax * 100)}%" title="${days[i]}"></i><span>${d}</span></div>`).join('')}</div></section>`;
    return h;
}
function notFound() { return `<div class="empty"><div class="empty-icon">${icon('disc')}</div><h2>Не найдено</h2><p>Возможно, библиотека была очищена.</p><a class="btn btn-primary" href="#/home">На главную</a></div>`; }
// ---------- поиск ----------
export function searchView(q = '') {
    return pageHead('Поиск') + `<div class="search-box big">${icon('search')}<input class="search-input input-bare" type="search" placeholder="Песни, альбомы, артисты, плейлисты" autocomplete="off" value="${esc(q)}" id="search-main"></div><div id="search-results">${searchResults(q)}</div>`;
}
const scLink = q => `<a class="sc-link" href="https://soundcloud.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">${icon('search')}Искать «${esc(q)}» на SoundCloud<span>откроется на сайте SoundCloud</span></a>`;
export function searchResults(q) {
    const d = derived();
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    if (!tokens.length)
        return d.all.length ? `<p class="hint">Начните вводить — результаты появятся сразу.</p>` : emptyState(true);
    const all = (s) => { const n = norm(s); return tokens.every(t => n.includes(t)); };
    const songs = d.all.filter(t => all(`${t.title} ${t.artist} ${t.album} ${t.genre} ${t.year}`));
    const albums = d.albums.filter(g => all(`${g.name} ${g.artist} ${g.year} ${g.genre}`));
    const singles = d.singles.filter(g => all(`${g.name} ${g.artist}`));
    const artists = d.artistList.filter(a => all(a.name));
    const pls = state.playlists.filter(p => all(p.name));
    if (!songs.length && !albums.length && !singles.length && !artists.length && !pls.length)
        return `<div class="empty compact"><div class="empty-icon">${icon('search')}</div><h2>Ничего не найдено</h2><p>По запросу «${esc(q)}» в вашей библиотеке нет совпадений.</p></div>` + scLink(q);
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
export const ACCENTS = [['white', 'Белый', '#F5F5F7'], ['gold', 'Золото', '#F5C84B'], ['rose', 'Роза', '#FF8FA3'], ['sky', 'Небо', '#7CC4FF'], ['mint', 'Мята', '#6EE7B7'], ['violet', 'Сирень', '#B69CFF']];
const seg = (k, opts, cur) => `<div class="seg">${opts.map(([v, n]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-action="set-setting" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
const sw = (k, on_) => `<button class="switch ${on_ ? 'on' : ''}" role="switch" aria-checked="${!!on_}" data-action="toggle-setting" data-k="${k}"><i></i></button>`;
const srow = (title, desc, ctl) => `<div class="setting"><div><h3>${title}</h3>${desc ? `<p>${desc}</p>` : ''}</div><div class="setting-ctl">${ctl}</div></div>`;
const sleepLabel = () => sleepState.endOfTrack ? 'до конца трека' : sleepState.until ? `ещё ${Math.max(1, Math.round((sleepState.until - Date.now()) / 60000))} мин` : 'выключен';
export function profileView() {
    const p = state.profile, d = derived(), s = state.settings;
    const banner = p.banner ? `<img src="${p.banner}" alt="">` : '';
    return `<section class="profile">
    <div class="profile-banner ${p.banner ? '' : 'default'}">${banner}<button class="btn btn-glass sm" data-action="edit-profile">${icon('edit')}Изменить</button></div>
    <div class="profile-body">
      <div class="profile-avatar">${avatarHTML('xl')}</div>
      <div class="profile-id"><h1>${esc(p.name)}<button class="icon-btn sm pe-edit" data-action="edit-name" aria-label="Изменить имя" title="Изменить имя">${icon('edit')}</button></h1><p class="handle">@${esc(p.username)}<button class="icon-btn sm pe-edit" data-action="edit-user" aria-label="Изменить ник" title="Изменить ник">${icon('edit')}</button></p></div>
      <div class="stats">
        <div><b>${d.all.length}</b><span>песен</span></div><div><b>${d.albums.length + d.singles.length}</b><span>релизов</span></div>
        <div><b>${d.artistList.length}</b><span>артистов</span></div><div><b>${state.likes.size}</b><span>нравится</span></div><div><b>${state.playlists.length}</b><span>плейлистов</span></div>
      </div>

    </div></section>`;
}
// аккаунт и синхронизация между устройствами
function accountSection() {
    const u = sync.user;
    const when = sync.lastAt ? new Date(sync.lastAt).toLocaleString(isEn() ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const err = sync.error ? `<p class="acc-err">${esc(sync.error)}</p>` : '';
    if (sync.status === 'in' && u)
        return `<h2 class="sg-title">Аккаунт</h2><div class="settings">
        ${srow(esc(u.email || u.name || 'Аккаунт Puro Cielo'), `Синхронизация включена: лайки, плейлисты, прослушивания, обложки, точные тексты песен и настройки одинаковые на всех ваших устройствах.${when ? ` Последний раз: ${when}.` : ''}`, `<button class="btn btn-soft sm" data-action="sync-now">${icon('refresh')}Сейчас</button><button class="btn btn-soft sm" data-action="sync-out">Выйти</button>`)}
      </div>${err}`;
    return `<h2 class="sg-title">Аккаунт</h2><div class="settings">
        ${srow('Синхронизация между устройствами', 'Войдите тем же аккаунтом, что на сайте, — лайки, плейлисты, прослушивания, обложки, точные тексты песен и настройки станут общими для телефона и компьютера. Музыка остаётся на каждом устройстве.',
        sync.status === 'loading' ? '<span class="ly-spin"></span>' : `${canGoogle() ? `<button class="btn btn-soft sm" data-action="sync-google">Google</button>` : ''}<button class="btn btn-primary sm" data-action="sync-email">Войти по почте</button>`)}
      </div>${err}`;
}
export function settingsView() {
    const s = state.settings;
    const sleepOpts = [[0, 'Выкл'], [15, '15'], [30, '30'], [45, '45'], [60, '60'], ['track', 'Трек']];
    const sleepCur = sleepState.endOfTrack ? 'track' : sleepState.until ? Math.round((sleepState.until - Date.now()) / 60000 / 15) * 15 : 0;
    return `<div class="settings-page"><header class="page-head"><div><h1>Настройки</h1><p class="page-sub">Подстройте плеер под себя</p></div></header>
      ${accountSection()}
      <h2 class="sg-title">Внешний вид</h2>
      <div class="settings">
        ${srow('Тема оформления', 'Тёмная по умолчанию, светлая — для яркого дня.', `<div class="seg"><button class="${state.theme === 'dark' ? 'on' : ''}" data-action="set-theme" data-v="dark">${icon('moon')}Тёмная</button><button class="${state.theme === 'light' ? 'on' : ''}" data-action="set-theme" data-v="light">${icon('sun')}Светлая</button></div>`)}
        ${srow('Главный экран', 'Как показывать альбомы, синглы, плейлисты и артистов.', viewSwitch(s.homeView))}
        ${srow('Скругление обложек', 'Мягкие или строгие углы.', seg('corners', [['round', 'Мягкие'], ['sharp', 'Острые']], s.corners))}
        ${srow('Плотность списков', 'Компактный режим вмещает больше строк.', seg('density', [['cozy', 'Свободно'], ['compact', 'Компактно']], s.density))}
        ${srow('Анимации интерфейса', 'Выключите, если приложение работает на слабом устройстве.', sw('anim', s.anim))}
        ${srow('Размер карточек', 'Обложки в рядах и сетках.', seg('cardSize', [['s', 'Мелкие'], ['m', 'Средние'], ['l', 'Крупные']], s.cardSize))}
        ${srow('Язык', 'Язык интерфейса плеера.', seg('lang', [['ru', 'Русский'], ['en', 'English']], s.lang || 'ru'))}
      </div>

      <h2 class="sg-title">Главная</h2>
      <div class="settings home-order">
        <p class="set-note">Порядок разделов на главной: стрелками двигайте выше или ниже, выключателем — скрывайте.</p>
        ${(() => { const o = homeOrder(), hid = homeHidden(), names = Object.fromEntries(HOME_SECTIONS); return o.map((k, i) => `<div class="setting ho-row"><div><h3>${names[k]}</h3></div><div class="setting-ctl"><button class="icon-btn" data-action="home-move" data-k="${k}" data-d="-1" aria-label="Выше" title="Выше" ${i === 0 ? 'disabled' : ''}>${icon('chev-up')}</button><button class="icon-btn" data-action="home-move" data-k="${k}" data-d="1" aria-label="Ниже" title="Ниже" ${i === o.length - 1 ? 'disabled' : ''}>${icon('chev-down')}</button><button class="switch ${hid.has(k) ? '' : 'on'}" role="switch" aria-checked="${!hid.has(k)}" data-action="home-toggle" data-k="${k}"><i></i></button></div></div>`).join(''); })()}
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
        ${srow('Найти тексты для всей библиотеки', 'Плеер сам проверит все песни без текста. Не нашёл — будет «Текст не найден».', `<button class="btn btn-soft sm" data-action="find-lyrics">${icon('lyrics')}Найти</button>`)}
        ${srow('Показывать текст справа', 'Выключите, если хотите просто слушать: плеер плавно переедет в центр. Тот же переключатель есть в самом плеере.', sw('showLyrics', s.showLyrics !== false))}
        ${srow('Свой сервер текстов', s.lyricsProxy ? esc(s.lyricsProxy) : 'Адрес вашего Cloudflare Worker: добавляет NetEase и Genius (см. папку worker).', `<button class="btn btn-soft sm" data-action="lyrics-proxy">${icon('edit')}Указать</button>`)}
        ${srow('Размер текста', 'Строки в режиме караоке.', seg('lyricsSize', [['s', 'Мелкий'], ['m', 'Средний'], ['l', 'Крупный']], s.lyricsSize))}
        ${srow('Таймер сна', `Музыка плавно затихнет и остановится. Сейчас: ${sleepLabel()}.`, `<div class="seg">${sleepOpts.map(([v, n]) => `<button class="${String(sleepCur) === String(v) ? 'on' : ''}" data-action="sleep" data-v="${v}">${n}</button>`).join('')}</div>`)}
        ${srow('Переход между треками', 'Плавный: конец песни затихает, следующая нарастает. «Без пауз» — для альбомов, где песни перетекают одна в другую.', seg('transition', [[0, 'Обычный'], [-1, 'Без пауз'], [3, '3 с'], [6, '6 с'], [10, '10 с']], s.transition || 0))}
        ${srow('Эквалайзер', 'Подстройка звука: готовая настройка или своя.', seg('eq', [...Object.entries(EQ_PRESETS).map(([k, p]) => [k, p.name]), ['custom', 'Своя']], s.eq || 'flat'))}
        ${s.eq === 'custom' ? `<div class="setting eq-row">${EQ_BANDS.map((f, i) => `<label class="eq-band"><input type="range" class="eq-slider" min="-12" max="12" step="1" value="${(s.eqCustom || [])[i] || 0}" data-i="${i}" aria-label="${f < 1000 ? f + ' Гц' : f / 1000 + ' кГц'}"><b>${(s.eqCustom || [])[i] > 0 ? '+' : ''}${(s.eqCustom || [])[i] || 0}</b><span>${f < 1000 ? f + ' Гц' : f / 1000 + ' кГц'}</span></label>`).join('')}</div>` : ''}
        ${srow('Шаг перемотки', 'Стрелки ← / → на клавиатуре.', seg('seekStep', [[5, '5 с'], [10, '10 с'], [15, '15 с'], [30, '30 с']], s.seekStep))}
        ${srow('Спектр в Now Playing', 'Анимация звука рядом с обложкой.', sw('visualizer', s.visualizer))}
      </div>

      <h2 class="sg-title">Приложение</h2>
      <div class="settings">
        ${srow('Заставка при запуске', 'Логотип и приветствие при открытии.', sw('splash', s.splash))}
        ${isNative ? srow('Папка с музыкой', folderName() ? `Выбрана: ${esc(folderName())}. Новые файлы подхватываются при каждом запуске.` : 'Выберите одну папку — вся медиатека загрузится из неё, как в Poweramp.', `<div class="row-btns"><button class="btn btn-primary sm" data-action="add-folder">${icon('folder')}${folderName() ? 'Сменить' : 'Выбрать'}</button>${folderName() ? `<button class="btn btn-soft sm" data-action="rescan">Обновить</button>` : ''}</div>`) : ''}
        ${srow('Не гасить экран', 'Пока играет музыка (если поддерживается).', sw('keepAwake', s.keepAwake))}
        ${srow('Резервная копия', 'Плейлисты, лайки, настройки и профиль — в один файл.', `<div class="row-btns"><button class="btn btn-soft sm" data-action="backup-export">${icon('download')}Сохранить</button><button class="btn btn-soft sm" data-action="backup-import">${icon('upload')}Загрузить</button></div>`)}
        ${srow('Недавно прослушанное', 'Очистить историю на главной.', `<button class="btn btn-soft sm" data-action="clear-recents">${icon('trash')}Очистить</button>`)}
        ${srow('Сбросить настройки', 'Вернуть всё по умолчанию (музыка и плейлисты останутся).', `<button class="btn btn-soft sm btn-danger" data-action="reset-settings">${icon('refresh')}Сбросить</button>`)}
        ${srow('Горячие клавиши', 'Пробел, стрелки, N / P, S, R, L, M, D, F, Q…', `<button class="btn btn-soft sm" data-action="shortcuts">${icon('keyboard')}Показать</button>`)}
        ${srow('Библиотека', isNative ? 'Можно выбрать папку целиком или добавлять треки по одному. Сами файлы остаются на устройстве.' : 'Файлы хранятся только в вашем браузере (IndexedDB).', `<div class="row-btns"><button class="btn btn-soft sm" data-action="add-files">${icon('plus')}Добавить</button><button class="btn btn-soft sm btn-danger" data-action="clear-library">${icon('trash')}Очистить</button></div>`)}
      </div>
  </div>`;
}
export function sidebarPlaylists() {
    const items = [`<a class="side-link sub" href="#/liked" data-route="liked"><span class="mini-cov liked">${icon('heart-fill')}</span><span>Понравившееся</span></a>`];
    for (const p of state.playlists)
        items.push(`<a class="side-link sub" href="#/playlist/${p.id}" data-route="playlist/${p.id}">${mosaic(playlistTracks(p).slice(0, 4), p.id, 'mini-cov')}<span>${esc(p.name)}</span></a>`);
    for (const p of state.smart)
        items.push(`<a class="side-link sub" href="#/smart/${p.id}" data-route="smart/${p.id}"><span class="mini-cov smart-mini">${icon('smart')}</span><span>${esc(p.name)}</span></a>`);
    return items.join('');
}
