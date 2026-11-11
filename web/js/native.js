// Мост к Android-оболочке (WebView). В браузере и в Electron window.PuroNative нет — тогда всё работает как раньше.
export const bridge = typeof window !== 'undefined' ? window.PuroNative || null : null;
export const isNative = !!bridge;
// Файлы выбранной папки оболочка отдаёт с того же адреса, что и приложение: /f/<id документа> (с поддержкой Range)
export const nativeUrl = docId => '/f/' + encodeURIComponent(docId);
export const nativeId = docId => 'n:' + docId;
export const isNativeId = id => typeof id === 'string' && id.startsWith('n:');
// «Файл» без копирования: теги читаются кусками через Range-запросы
export class RemoteFile {
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
export const pickFolder = () => { try {
    bridge?.pickFolder();
}
catch { /* ignore */ } };
export const rescan = () => { try {
    bridge?.sync();
}
catch { /* ignore */ } };
export const folderName = () => { try {
    return bridge?.folderName() || '';
}
catch {
    return '';
} };
export const setPlayback = (playing, title, artist) => { try {
    bridge?.setPlayback(!!playing, title || '', artist || '');
}
catch { /* ignore */ } };
export const pickFiles = () => { try {
    bridge?.pickFiles();
}
catch { /* ignore */ } };
// Трек, добавленный по одному, забываем и в оболочке (иначе при следующем сканировании он вернётся)
export const forgetFile = id => { try {
    if (typeof id === 'string' && id.startsWith('n:uri:'))
        bridge?.forget(id.slice(2));
}
catch { /* ignore */ } };
// Загрузка страницы сайта через оболочку (WebView сам не может из-за CORS)
const pend = new Map();
let seq = 0;
export const nativeFetchText = (url, ms = 14000) => new Promise(res => {
    const id = 'f' + (++seq);
    const timer = setTimeout(() => { pend.delete(id); res(''); }, ms);
    pend.set(id, txt => { clearTimeout(timer); res(txt || ''); });
    try {
        bridge.fetchText(id, url);
    }
    catch {
        clearTimeout(timer);
        pend.delete(id);
        res('');
    }
});
export const onNativeFetch = (id, txt) => { const f = pend.get(id); if (f) {
    pend.delete(id);
    f(txt);
} };
