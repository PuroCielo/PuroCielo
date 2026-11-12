const HOSTS = new Set(['genius.com', 'www.azlyrics.com', 'search.azlyrics.com',
  'www.lyrics.com', 'lyrics.com', 'text-pesni.com', 'www.text-pesni.com', 'vse-pesni.com', 'www.vse-pesni.com']);
const LIMIT = 4_000_000;
function allowed(url) { return url.protocol === 'https:' && HOSTS.has(url.hostname) && !url.username && !url.password; }
async function fetchText(raw, fetchFn = fetch) {
  try {
    let url = new URL(String(raw));
    const signal = AbortSignal.timeout(12000);
    for (let redirects = 0; redirects <= 4; redirects++) {
      if (!allowed(url)) return '';
      const response = await fetchFn(url.href, { redirect: 'manual', signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ru,en;q=0.8' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location) return '';
        url = new URL(location, url);
        continue;
      }
      if (!response.ok || !response.body) { await response.body?.cancel(); return ''; }
      if (Number(response.headers.get('content-length')) > LIMIT) { await response.body.cancel(); return ''; }
      const reader = response.body.getReader(), chunks = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > LIMIT) { await reader.cancel(); return ''; }
        chunks.push(Buffer.from(value));
      }
      const buffer = Buffer.concat(chunks);
      const charset = (response.headers.get('content-type') || '') + buffer.subarray(0, 2048).toString('latin1');
      return new TextDecoder(/1251/i.test(charset) ? 'windows-1251' : 'utf-8').decode(buffer);
    }
  } catch { /* Сеть недоступна: плеер попробует следующий источник. */ }
  return '';
}
module.exports = { fetchText };
