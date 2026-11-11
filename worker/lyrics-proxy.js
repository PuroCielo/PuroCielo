// Cloudflare Worker: тексты из NetEase (с метками времени, без ключа) и Genius (без ключа).
// Деплой: dash.cloudflare.com → Workers & Pages → Create → Hello World → Edit code → вставить этот файл → Deploy.
// Genius работает без токена и ключей.
// Адрес вида https://имя.ваш-аккаунт.workers.dev вставьте в плеер: Настройки → Свой сервер текстов.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });
// Разбор страницы Genius без DOM: собираем содержимое всех блоков data-lyrics-container с учётом вложенных div.
function extractGenius(html) {
  const out = []; const re = /<div[^>]*data-lyrics-container="true"[^>]*>/g; let m;
  while ((m = re.exec(html))) {
    let i = re.lastIndex, depth = 1; const tag = /<(\/?)div\b[^>]*>/g; tag.lastIndex = i; let t;
    while (depth > 0 && (t = tag.exec(html))) depth += t[1] ? -1 : 1;
    out.push(html.slice(i, t ? t.index : html.length));
  }
  if (!out.length) return '';
  return out.join('\n').replace(/<div[^>]*data-exclude-from-selection="true"[\s\S]*?<\/div>/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
}
async function geniusLyrics(artist, title, fetchFn = fetch) {
  const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en' };
  const r = await fetchFn('https://genius.com/api/search/multi?per_page=5&q=' + encodeURIComponent(`${artist} ${title}`), { headers: H });
  if (!r.ok) return null;
  const j = await r.json();
  const hits = [].concat(...((j.response && j.response.sections) || []).map(s => s.hits || [])).filter(h => h.type === 'song' && h.result);
  const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const want = norm(title), who = norm(artist);
  const best = hits.find(h => norm(h.result.title).includes(want) || want.includes(norm(h.result.title))) && hits.find(h => (norm(h.result.title).includes(want) || want.includes(norm(h.result.title))) && (!who || norm(h.result.primary_artist && h.result.primary_artist.name).includes(who) || who.includes(norm(h.result.primary_artist && h.result.primary_artist.name))));
  if (!best) return null;
  const p = await fetchFn(best.result.url, { headers: H });
  if (!p.ok) return null;
  const text = extractGenius(await p.text());
  return text.length > 40 ? text : null;
}


const UA = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' };

async function netease(artist, title, dur) {
  const q = encodeURIComponent(`${artist} ${title}`);
  const s = await (await fetch(`https://music.163.com/api/search/get?s=${q}&type=1&limit=6`, { headers: UA })).json();
  const songs = (s.result && s.result.songs) || [];
  songs.sort((a, b) => Math.abs((a.duration || 0) / 1000 - dur) - Math.abs((b.duration || 0) / 1000 - dur));
  for (const song of songs) {
    if (dur && Math.abs(song.duration / 1000 - dur) > 8) continue;
    const l = await (await fetch(`https://music.163.com/api/song/lyric?id=${song.id}&lv=1&tv=-1`, { headers: UA })).json();
    const lrc = l.lrc && l.lrc.lyric;
    if (lrc && /\[\d+:\d+/.test(lrc)) return { synced: lrc, source: 'netease' };
  }
  return null;
}
// /fetch?url=… — отдаёт HTML страницы с текстом песни (для поиска по сайтам из браузера, где их нельзя открыть напрямую).
// Только сайты с текстами из этого списка — чтобы Worker не стал открытым прокси для чего угодно.
const FETCH_HOSTS = ['genius.com', 'www.azlyrics.com', 'search.azlyrics.com', 'www.lyrics.com', 'text-pesni.com', 'vse-pesni.com'];
async function proxyPage(raw) {
  let target;
  try { target = new URL(raw); } catch { return json({ error: 'url' }, 400); }
  if (target.protocol !== 'https:' || !FETCH_HOSTS.includes(target.hostname)) return json({ error: 'host' }, 403);
  const r = await fetch(target.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'ru,en;q=0.8' }, redirect: 'follow' });
  const body = await r.text();
  return new Response(body.length > 3e6 ? '' : body, { status: r.ok ? 200 : r.status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Headers': '*' } });
    const u = new URL(req.url);
    if (u.pathname === '/fetch') return proxyPage(u.searchParams.get('url'));
    if (u.pathname !== '/lyrics') return json({ ok: true });
    const artist = u.searchParams.get('artist') || '', title = u.searchParams.get('title') || '', dur = +u.searchParams.get('duration') || 0;
    if (!title) return json({ error: 'title' }, 400);
    try { const n = await netease(artist, title, dur); if (n) return json(n); } catch (e) { /* дальше */ }
    try { const g0 = await geniusLyrics(artist, title); const g = g0 ? { plain: g0, source: 'genius' } : null; if (g) return json(g); } catch (e) { /* дальше */ }
    return json({ notFound: true }, 404);
  },
};
