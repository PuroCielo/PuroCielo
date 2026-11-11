import { derived, getTrack, setAlbumCover, setTagEdit, setTrackCover, state } from './state.js';
import { openModal, toast } from './ui.js';
import { esc, fmtTime } from './util.js';
import { icon } from './icons.js';

// «Данные трека»: своё название, артист, альбом, год + поиск в MusicBrainz (открытая база музыки) с обложкой
// из Cover Art Archive. Файл не меняется — правки хранятся в плеере поверх тегов.
const MB = 'https://musicbrainz.org/ws/2';
const CAA = 'https://coverartarchive.org/release';
const q = s => String(s || '').replace(/["\\]/g, ' ').trim();
export async function mbSearch(title, artist) {
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
export function openTrackInfo(id) {
    const t = getTrack(id);
    if (!t)
        return;
    const g = derived().groups.get(t._albumKey);
    const inAlbum = g && g.tracks.length > 1;
    let pickedRelease = '';
    const field = (k, label) => `<label class="sm-field ${k === 'title' ? 'wide' : ''}"><span>${label}</span><input class="input" data-f="${k}" value="${esc(t[k] || '')}"></label>`;
    openModal({
        title: 'Данные трека', wide: true,
        html: `<div class="sm-form">
      ${field('title', 'Название')}${field('artist', 'Артист')}${field('album', 'Альбом')}${field('year', 'Год')}
      <p class="ti-note wide">Файл не меняется — данные хранятся в плеере. Поиск текста песни пойдёт уже по новым данным.</p>
      <div class="ti-mb wide"><button class="btn btn-soft sm" id="ti-search">${icon('search')}Найти в MusicBrainz</button><span id="ti-status"></span></div>
      <div class="ti-results wide" id="ti-results"></div>
      ${inAlbum ? `<label class="sm-check wide" id="ti-album-wrap" hidden><input type="checkbox" id="ti-album-cover" checked><span>Обложку — на весь альбом «${esc(g.name)}»</span></label>` : ''}
    </div>`,
        actions: [
            ...(state.tagEdits[id] ? [{ label: 'Вернуть из файла', onClick: () => { setTagEdit(id, null); toast('Данные трека — снова из файла'); } }] : []),
            { label: 'Отмена' },
            { label: 'Сохранить', primary: true, onClick: async (api) => {
                    const v = {};
                    api.el.querySelectorAll('[data-f]').forEach(i => {
                        const k = i.dataset.f, val = i.value.trim();
                        if (val !== String(t._orig?.[k] || ''))
                            v[k] = val;
                    });
                    setTagEdit(id, v);
                    if (pickedRelease) {
                        const url = await coverData(pickedRelease);
                        if (url) {
                            const all = api.el.querySelector('#ti-album-cover');
                            if (all && all.checked && g)
                                setAlbumCover(g.key, url);
                            else
                                setTrackCover(id, url);
                        }
                    }
                    t.lyrics = null; // текст поищется заново по новым данным
                    t._ly = undefined;
                    toast('Данные трека сохранены');
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
              <span class="ti-cov">${r.releaseId ? `<img src="${CAA}/${r.releaseId}/front-250" alt="" loading="lazy" onerror="this.remove()">` : ''}${icon('disc')}</span>
              <span class="ti-txt"><b>${esc(r.title)}</b><span>${esc(r.artist)}${r.album ? ' · ' + esc(r.album) : ''}${r.year ? ' · ' + r.year : ''}</span></span>
              <span class="ti-len">${r.length ? fmtTime(r.length) : ''}</span></button>`).join('');
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
