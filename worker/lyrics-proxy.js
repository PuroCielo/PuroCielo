// Cloudflare Worker: тексты из NetEase (с метками времени, без ключа) и Genius (нужен токен GENIUS_TOKEN).
// Деплой: dash.cloudflare.com → Workers & Pages → Create → Hello World → Edit code → вставить этот файл → Deploy.
// Для Genius: Settings → Variables → добавьте секрет GENIUS_TOKEN (токен с genius.com/api-clients).
// Адрес вида https://имя.ваш-аккаунт.workers.dev вставьте в плеер: Настройки → Свой сервер текстов.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });
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
async function genius(artist, title, token) {
  if (!token) return null;
  const r = await (await fetch(`https://api.genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}`, { headers: { Authorization: 'Bearer ' + token } })).json();
  const hit = r.response && r.response.hits && r.response.hits[0] && r.response.hits[0].result;
  if (!hit) return null;
  const html = await (await fetch(hit.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const parts = [...html.matchAll(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g)].map(m => m[1]);
  if (!parts.length) return null;
  const text = parts.join('\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim();
  return text ? { plain: text, source: 'genius' } : null;
}
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Headers': '*' } });
    const u = new URL(req.url);
    if (u.pathname !== '/lyrics') return json({ ok: true });
    const artist = u.searchParams.get('artist') || '', title = u.searchParams.get('title') || '', dur = +u.searchParams.get('duration') || 0;
    if (!title) return json({ error: 'title' }, 400);
    try { const n = await netease(artist, title, dur); if (n) return json(n); } catch (e) { /* дальше */ }
    try { const g = await genius(artist, title, env.GENIUS_TOKEN); if (g) return json(g); } catch (e) { /* дальше */ }
    return json({ notFound: true }, 404);
  },
};
