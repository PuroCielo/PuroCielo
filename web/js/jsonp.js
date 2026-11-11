// JSONP: ответ сервиса подключается как <script> — так можно спрашивать сервисы без CORS (Deezer, iTunes)
let seq = 0;
export function jsonp(url, param = 'callback') {
    return new Promise(res => {
        const cb = '__puroJsonp' + (++seq) + '_' + Date.now(), sc = document.createElement('script');
        let done = false;
        const end = v => { if (done) return; done = true; clearTimeout(tm); try { delete window[cb]; } catch { window[cb] = undefined; } sc.remove(); res(v); };
        const tm = setTimeout(() => end(null), 9000);
        window[cb] = d => end(d);
        sc.onerror = () => end(null);
        sc.src = url + (url.includes('?') ? '&' : '?') + param + '=' + cb;
        document.head.appendChild(sc);
    });
}
