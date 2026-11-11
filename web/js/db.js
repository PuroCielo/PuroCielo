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
const safe = f => async (...a) => { try {
    return await f(...a);
}
catch (e) {
    console.warn('IndexedDB:', e);
    return undefined;
} };
export const putFile = safe(rec => tx('files', 'readwrite', s => s.put(rec)));
export const allFiles = safe(async () => (await tx('files', 'readonly', s => s.getAll())) || []);
export const delFile = safe(id => tx('files', 'readwrite', s => s.delete(id)));
export const clearFiles = safe(() => tx('files', 'readwrite', s => s.clear()));
export const kvGet = safe(k => tx('kv', 'readonly', s => s.get(k)));
export const kvSet = safe((k, v) => tx('kv', 'readwrite', s => s.put(v, k)));
export const lyGet = safe(k => tx('lyrics', 'readonly', s => s.get(k)));
export const lyKeys = safe(async () => (await tx('lyrics', 'readonly', s => s.getAllKeys())) || []);
export const lySet = safe((k, v) => tx('lyrics', 'readwrite', s => s.put(v, k)));
