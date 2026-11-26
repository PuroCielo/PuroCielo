import { toast } from './ui.js';
import { emit } from './state.js';
const endpoint = 'http://127.0.0.1:43127';
let token = '', connecting = false, active = null;
export const desktopConnected = () => !!token;
export const desktopConnecting = () => connecting;
function changed() { emit('alignment-connection'); }
export async function connectDesktop() {
    if (connecting) return;
    connecting = true; changed();
    try {
        const response = await fetch(endpoint + '/session', { cache: 'no-store', signal: AbortSignal.timeout(15000), credentials: 'omit' });
        if (!response.ok) throw new Error();
        const session = await response.json();
        if (session.protocol !== 1 || !/^[a-f0-9]{64}$/.test(session.token)) throw new Error();
        token = session.token;
    } catch {
        token = '';
        throw new Error('Откройте Puro Cielo для Windows версии 1.15.0 или новее и разрешите браузеру доступ к локальной сети. Затем подключитесь снова.');
    } finally { connecting = false; changed(); }
}
function cancel() {
    const job = active;
    if (!job) return;
    active = null;
    fetch(endpoint + '/cancel', { method: 'POST', headers: { Authorization: 'Bearer ' + job.token, 'X-Puro-Job': job.id }, credentials: 'omit', signal: AbortSignal.timeout(5000) }).catch(() => {});
    job.controller.abort();
}
export function disconnectDesktop() { cancel(); token = ''; changed(); }
async function request(route, payload) {
    if (!token) throw new Error('Подключитесь к Windows-приложению в настройках');
    if (active) throw new Error('Другая песня уже синхронизируется');
    const job = { id: crypto.randomUUID(), token, controller: new AbortController() };
    active = job;
    try {
        const { wav, ...metadata } = payload;
        const json = new TextEncoder().encode(JSON.stringify(metadata));
        const prefix = new Uint8Array(4); new DataView(prefix.buffer).setUint32(0, json.length, true);
        const response = await fetch(endpoint + route, { method: 'POST', credentials: 'omit', headers: { Authorization: 'Bearer ' + job.token, 'X-Puro-Job': job.id, 'Content-Type': 'application/octet-stream' }, body: new Blob([prefix, json, wav]), signal: job.controller.signal });
        if (response.status === 401) { token = ''; changed(); toast('Подключитесь к Windows-приложению снова в настройках', 'warn', 7000); }
        const result = await response.json();
        if (!response.ok && !result.error) throw new Error();
        return result;
    } catch (error) {
        if (job.controller.signal.aborted) throw new Error('Обработка отменена');
        token = ''; changed();
        toast('Соединение с Windows-приложением потеряно. Подключитесь снова в настройках.', 'warn', 7000);
        throw new Error('Соединение с Windows-приложением потеряно. Откройте приложение и подключитесь снова в настройках.');
    } finally { if (active === job) active = null; }
}
const remote = { alignLyrics: payload => request('/align', payload), forceAlign: payload => request('/refine', payload), cancelAlignment: cancel };
export const alignmentAPI = () => window.PuroDesktop?.alignLyrics ? window.PuroDesktop : token ? remote : null;
