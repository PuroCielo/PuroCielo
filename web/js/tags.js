// Собственный парсер метаданных без зависимостей:
// MP3 (ID3v1/v2.2/2.3/2.4: TIT2, TPE1, TALB, год, жанр, APIC, USLT, SYLT, MPEG-заголовок),
// FLAC (STREAMINFO, Vorbis comments, PICTURE), OGG Vorbis/Opus, WAV (fmt, LIST INFO, id3), M4A/MP4/AAC (ilst, covr).
const dec = (enc, bytes) => new TextDecoder(enc).decode(bytes);
const u32be = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u16le = (b, i) => b[i] | (b[i + 1] << 8);
const syncsafe = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
const slice = async (file, a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());
const GENRES = 'Blues,Classic Rock,Country,Dance,Disco,Funk,Grunge,Hip-Hop,Jazz,Metal,New Age,Oldies,Other,Pop,R&B,Rap,Reggae,Rock,Techno,Industrial,Alternative,Ska,Death Metal,Pranks,Soundtrack,Euro-Techno,Ambient,Trip-Hop,Vocal,Jazz+Funk,Fusion,Trance,Classical,Instrumental,Acid,House,Game,Sound Clip,Gospel,Noise,AlternRock,Bass,Soul,Punk,Space,Meditative,Instrumental Pop,Instrumental Rock,Ethnic,Gothic,Darkwave,Techno-Industrial,Electronic,Pop-Folk,Eurodance,Dream,Southern Rock,Comedy,Cult,Gangsta,Top 40,Christian Rap,Pop/Funk,Jungle,Native American,Cabaret,New Wave,Psychadelic,Rave,Showtunes,Trailer,Lo-Fi,Tribal,Acid Punk,Acid Jazz,Polka,Retro,Musical,Rock & Roll,Hard Rock'.split(',');
// ---------- текст ----------
// Много русских MP3 хранят cp1251, но помечают её как ISO-8859-1 — угадываем.
function decodeLatin(bytes) {
    let high = 0, letters = 0;
    for (const c of bytes) {
        if (c >= 0x80)
            high++;
        if (c >= 0x41)
            letters++;
    }
    if (high >= 2 && high / Math.max(letters, 1) > 0.4) {
        const t = dec('windows-1251', bytes);
        if (/[А-Яа-яЁё]/.test(t))
            return t;
    }
    return dec('windows-1252', bytes);
}
function decodeText(encByte, bytes) {
    let s;
    if (encByte === 1) {
        if (bytes[0] === 0xff && bytes[1] === 0xfe)
            s = dec('utf-16le', bytes.subarray(2));
        else if (bytes[0] === 0xfe && bytes[1] === 0xff)
            s = dec('utf-16be', bytes.subarray(2));
        else
            s = dec('utf-16le', bytes);
    }
    else if (encByte === 2)
        s = dec('utf-16be', bytes);
    else if (encByte === 3)
        s = dec('utf-8', bytes);
    else
        s = decodeLatin(bytes);
    return s.replace(/\u0000+$/g, '');
}
function findTerm(b, start, encByte) {
    if (encByte === 1 || encByte === 2) {
        for (let i = start; i + 1 < b.length; i += 2)
            if (b[i] === 0 && b[i + 1] === 0)
                return [i, 2];
        return [b.length, 0];
    }
    const i = b.indexOf(0, start);
    return i < 0 ? [b.length, 0] : [i, 1];
}
function unsync(b) {
    const out = [];
    for (let i = 0; i < b.length; i++) {
        out.push(b[i]);
        if (b[i] === 0xff && b[i + 1] === 0)
            i++;
    }
    return Uint8Array.from(out);
}
function mkCover(bytes, mime) {
    if (!bytes || !bytes.length)
        return null;
    if (!mime || !/^image\//.test(mime) || mime === 'image/') {
        mime = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : 'image/jpeg';
    }
    return new Blob([bytes], { type: mime });
}
function yearOf(s) { const m = String(s || '').match(/(\d{4})/); return m ? m[1] : ''; }
function genreOf(s) {
    if (!s)
        return '';
    const m = s.match(/^\((\d+)\)\s*(.*)$/) || s.match(/^(\d+)$/);
    if (m) {
        const n = +m[1];
        return (m[2] && !/^\d+$/.test(m[2]) ? m[2] : GENRES[n]) || '';
    }
    return s;
}
// ---------- ID3v2 ----------
function parseId3Bytes(buf) {
    const out = { _frames: 0 };
    if (ascii(buf, 0, 3) !== 'ID3')
        return out;
    const ver = buf[3], flags = buf[5], size = syncsafe(buf, 6);
    let data = buf.subarray(10, 10 + size);
    if (flags & 0x80 && ver < 4)
        data = unsync(data);
    let pos = 0;
    if (flags & 0x40 && ver >= 3)
        pos = ver === 4 ? syncsafe(data, 0) : u32be(data, 0) + 4;
    const idLen = ver === 2 ? 3 : 4, hLen = ver === 2 ? 6 : 10;
    const uslt = [], sylt = [], pics = [];
    while (pos + hLen <= data.length) {
        const id = ascii(data, pos, idLen);
        if (!/^[A-Z0-9]{3,4}$/.test(id))
            break;
        let fsize = ver === 2 ? (data[pos + 3] << 16) | (data[pos + 4] << 8) | data[pos + 5]
            : ver === 4 ? syncsafe(data, pos + 4) : u32be(data, pos + 4);
        const fflags = ver >= 3 ? (data[pos + 8] << 8) | data[pos + 9] : 0;
        let body = data.subarray(pos + hLen, pos + hLen + fsize);
        pos += hLen + fsize;
        if (ver === 4) {
            if (fflags & 0x01)
                body = body.subarray(4); // data length indicator
            if (fflags & 0x02)
                body = unsync(body); // frame-level unsynchronisation
        }
        if (!body.length)
            continue;
        out._frames++;
        const text = () => decodeText(body[0], body.subarray(1));
        switch (id) {
            case 'TIT2':
            case 'TT2':
                out.title = text();
                break;
            case 'TPE1':
            case 'TP1':
                out.artist = text().split('\u0000')[0];
                break;
            case 'TPE2':
            case 'TP2':
                out.albumArtist = text();
                break;
            case 'TALB':
            case 'TAL':
                out.album = text();
                break;
            case 'TYER':
            case 'TYE':
                out.year = out.year || yearOf(text());
                break;
            case 'TDRC':
                out.year = yearOf(text()) || out.year;
                break;
            case 'TORY':
            case 'TDOR':
                out.year = out.year || yearOf(text());
                break;
            case 'TCON':
            case 'TCO':
                out.genre = genreOf(text().split('\u0000')[0]);
                break;
            case 'TRCK':
            case 'TRK':
                out.trackNo = parseInt(text(), 10) || 0;
                break;
            case 'TPOS':
            case 'TPA':
                out.discNo = parseInt(text(), 10) || 0;
                break;
            case 'APIC':
            case 'PIC': {
                const e = body[0];
                let mime, i;
                if (id === 'PIC') {
                    mime = 'image/' + ascii(body, 1, 3).toLowerCase().replace('jpg', 'jpeg');
                    i = 4;
                }
                else {
                    const z = body.indexOf(0, 1);
                    mime = ascii(body, 1, z - 1);
                    i = z + 1;
                }
                const type = body[i];
                i++;
                const [t, tl] = findTerm(body, i, e);
                i = t + tl;
                pics.push({ type, bytes: body.subarray(i), mime });
                break;
            }
            case 'USLT':
            case 'ULT': {
                const e = body[0];
                let i = 4;
                const [t, tl] = findTerm(body, i, e);
                i = t + tl;
                const txt = decodeText(e, body.subarray(i));
                if (txt.trim())
                    uslt.push(txt);
                break;
            }
            case 'SYLT':
            case 'SLT': {
                const e = body[0], fmt = body[4];
                let i = 6;
                const [t, tl] = findTerm(body, i, e);
                i = t + tl;
                const lines = [];
                while (i < body.length) {
                    const [z, zl] = findTerm(body, i, e);
                    const txt = decodeText(e, body.subarray(i, z)).replace(/^\n/, '');
                    i = z + zl;
                    if (i + 4 > body.length)
                        break;
                    const stamp = u32be(body, i);
                    i += 4;
                    lines.push({ t: fmt === 2 ? stamp / 1000 : -1, text: txt.trim() });
                }
                if (fmt === 2 && lines.length)
                    sylt.push(lines);
                break;
            }
            default: break;
        }
    }
    const pic = pics.find(p => p.type === 3) || pics[0];
    if (pic)
        out.cover = mkCover(pic.bytes, pic.mime);
    if (uslt.length)
        out.lyricsText = uslt[0];
    if (sylt.length)
        out.lyricsSync = sylt[0];
    return out;
}
function parseId3v1(b) {
    if (b.length < 128 || ascii(b, 0, 3) !== 'TAG')
        return {};
    const t = (i, n) => decodeLatin(b.subarray(i, i + n).filter(c => c !== 0)).trim();
    const o = { title: t(3, 30), artist: t(33, 30), album: t(63, 30), year: t(93, 4), genre: GENRES[b[127]] || '' };
    if (b[125] === 0 && b[126])
        o.trackNo = b[126];
    return o;
}
// ---------- MPEG-аудио ----------
const BR = {
    '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function mpegHeader(b, i) {
    if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0)
        return null;
    const vb = (b[i + 1] >> 3) & 3, lb = (b[i + 1] >> 1) & 3, br = b[i + 2] >> 4, sr = (b[i + 2] >> 2) & 3;
    if (vb === 1 || lb === 0 || br === 0 || br === 15 || sr === 3)
        return null;
    const layer = 4 - lb, v1 = vb === 3;
    const table = BR[(v1 ? '1' : '2') + '-' + (layer === 3 && !v1 ? 2 : layer)];
    const bitrate = table[br], sampleRate = SR[vb][sr], pad = (b[i + 2] >> 1) & 1;
    const spf = layer === 1 ? 384 : (layer === 3 && !v1 ? 576 : 1152);
    const frameLen = layer === 1 ? (Math.floor(12 * bitrate * 1000 / sampleRate) + pad) * 4
        : Math.floor((spf / 8) * bitrate * 1000 / sampleRate) + pad;
    const mono = ((b[i + 3] >> 6) & 3) === 3;
    return { layer, v1, bitrate, sampleRate, spf, frameLen, channels: mono ? 1 : 2, mono };
}
function readMpeg(b, from) {
    for (let i = from; i < b.length - 4 && i < from + 65536; i++) {
        const h = mpegHeader(b, i);
        if (!h || h.frameLen < 21)
            continue;
        const next = i + h.frameLen;
        if (next + 4 < b.length && !mpegHeader(b, next))
            continue; // проверяем следующий фрейм
        const out = { codec: h.layer === 3 ? 'MP3' : 'MP' + h.layer, sampleRate: h.sampleRate, bitrate: h.bitrate, channels: h.channels, vbr: false };
        const xo = i + 4 + (h.v1 ? (h.mono ? 17 : 32) : (h.mono ? 9 : 17));
        const tag = ascii(b, xo, 4);
        if (tag === 'Xing' || tag === 'Info') {
            if (tag === 'Xing')
                out.vbr = true;
        }
        else if (ascii(b, i + 36, 4) === 'VBRI')
            out.vbr = true;
        return out;
    }
    return {};
}
// ---------- ID3 (MP3 и файлы без обёртки) ----------
async function readMp3(file) {
    const head = await slice(file, 0, 10);
    let meta = {}, audioStart = 0;
    if (ascii(head, 0, 3) === 'ID3') {
        const size = syncsafe(head, 6) + 10 + (head[5] & 0x10 ? 10 : 0);
        meta = parseId3Bytes(await slice(file, 0, size));
        audioStart = size;
    }
    const mpegBuf = await slice(file, audioStart, audioStart + 70000);
    Object.assign(meta, readMpeg(mpegBuf, 0));
    const tail = await slice(file, Math.max(0, file.size - 128), file.size);
    let tagBytes = audioStart;
    if (ascii(tail, 0, 3) === 'TAG') {
        const v1 = parseId3v1(tail);
        tagBytes += 128;
        for (const k of Object.keys(v1))
            if (!meta[k] && v1[k])
                meta[k] = v1[k];
    }
    meta.audioBytes = Math.max(1, file.size - tagBytes);
    return meta;
}
// ---------- Vorbis comments (FLAC / OGG) ----------
function parseVorbisComments(b, start) {
    const out = {};
    let i = start;
    const vlen = u32le(b, i);
    i += 4 + vlen;
    const n = u32le(b, i);
    i += 4;
    const td = new TextDecoder('utf-8');
    for (let k = 0; k < n && i + 4 <= b.length; k++) {
        const l = u32le(b, i);
        i += 4;
        const s = td.decode(b.subarray(i, i + l));
        i += l;
        const eq = s.indexOf('=');
        if (eq < 0)
            continue;
        const key = s.slice(0, eq).toUpperCase(), val = s.slice(eq + 1);
        switch (key) {
            case 'TITLE':
                out.title = val;
                break;
            case 'ARTIST':
                out.artist = out.artist || val;
                break;
            case 'ALBUMARTIST':
            case 'ALBUM ARTIST':
                out.albumArtist = val;
                break;
            case 'ALBUM':
                out.album = val;
                break;
            case 'DATE':
            case 'YEAR':
            case 'ORIGINALDATE':
                out.year = out.year || yearOf(val);
                break;
            case 'GENRE':
                out.genre = out.genre || val;
                break;
            case 'TRACKNUMBER':
                out.trackNo = parseInt(val, 10) || 0;
                break;
            case 'DISCNUMBER':
                out.discNo = parseInt(val, 10) || 0;
                break;
            case 'LYRICS':
            case 'UNSYNCEDLYRICS':
            case 'SYNCEDLYRICS':
                out.lyricsText = out.lyricsText || val;
                break;
            case 'METADATA_BLOCK_PICTURE': {
                try {
                    const bin = atob(val), pb = Uint8Array.from(bin, c => c.charCodeAt(0));
                    Object.assign(out, parseFlacPicture(pb));
                }
                catch { /* ignore */ }
                break;
            }
            default: break;
        }
    }
    return out;
}
function parseFlacPicture(b) {
    let i = 4;
    const ml = u32be(b, i);
    i += 4;
    const mime = ascii(b, i, ml);
    i += ml;
    const dl = u32be(b, i);
    i += 4 + dl + 16;
    const len = u32be(b, i);
    i += 4;
    return { cover: mkCover(b.subarray(i, i + len), mime) };
}
// ---------- FLAC ----------
async function readFlac(file) {
    const meta = { codec: 'FLAC' };
    let pos = 4, last = false;
    while (!last && pos < file.size) {
        const h = await slice(file, pos, pos + 4);
        last = !!(h[0] & 0x80);
        const type = h[0] & 0x7f, len = (h[1] << 16) | (h[2] << 8) | h[3];
        pos += 4;
        if (type === 0) {
            const b = await slice(file, pos, pos + 34);
            meta.sampleRate = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4);
            meta.channels = ((b[12] >> 1) & 7) + 1;
            meta.bits = (((b[12] & 1) << 4) | (b[13] >> 4)) + 1;
        }
        else if (type === 4) {
            Object.assign(meta, parseVorbisComments(await slice(file, pos, pos + len), 0));
        }
        else if (type === 6) {
            const c = parseFlacPicture(await slice(file, pos, pos + len));
            if (c.cover && !meta.cover)
                meta.cover = c.cover;
        }
        pos += len;
    }
    meta.audioBytes = Math.max(1, file.size - pos);
    return meta;
}
// ---------- OGG (Vorbis / Opus) ----------
async function readOgg(file) {
    const buf = await slice(file, 0, Math.min(file.size, 4 * 1024 * 1024));
    const payloads = [];
    let pos = 0, total = 0;
    while (pos + 27 <= buf.length && ascii(buf, pos, 4) === 'OggS' && payloads.length < 40) {
        const ns = buf[pos + 26];
        let len = 0;
        for (let i = 0; i < ns; i++)
            len += buf[pos + 27 + i];
        const start = pos + 27 + ns;
        payloads.push(buf.subarray(start, start + len));
        total += len;
        pos = start + len;
        if (total > 3.5 * 1024 * 1024)
            break;
    }
    const all = new Uint8Array(total);
    let o = 0;
    for (const p of payloads) {
        all.set(p, o);
        o += p.length;
    }
    const meta = {};
    const find = sig => { const s = Array.from(sig, c => c.charCodeAt(0)); outer: for (let i = 0; i < all.length - s.length; i++) {
        for (let j = 0; j < s.length; j++)
            if (all[i + j] !== s[j])
                continue outer;
        return i;
    } return -1; };
    const vi = find('\x01vorbis'), oi = find('OpusHead');
    if (vi >= 0) {
        meta.codec = 'Vorbis';
        meta.channels = all[vi + 11];
        meta.sampleRate = u32le(all, vi + 12);
        const nb = u32le(all, vi + 20);
        if (nb > 0 && nb < 4e6)
            meta.nominalBitrate = Math.round(nb / 1000);
    }
    else if (oi >= 0) {
        meta.codec = 'Opus';
        meta.channels = all[oi + 9];
        meta.sampleRate = 48000;
    }
    const ci = find('\x03vorbis'), ti = find('OpusTags');
    if (ci >= 0)
        Object.assign(meta, parseVorbisComments(all, ci + 7));
    else if (ti >= 0)
        Object.assign(meta, parseVorbisComments(all, ti + 8));
    meta.audioBytes = file.size;
    return meta;
}
// ---------- WAV ----------
async function readWav(file) {
    const meta = { codec: 'WAV' };
    let pos = 12;
    while (pos + 8 <= file.size) {
        const h = await slice(file, pos, pos + 8);
        const id = ascii(h, 0, 4), size = u32le(h, 4);
        if (id === 'fmt ') {
            const b = await slice(file, pos + 8, pos + 8 + Math.min(size, 24));
            meta.channels = u16le(b, 2);
            meta.sampleRate = u32le(b, 4);
            meta.bitrate = Math.round(u32le(b, 8) * 8 / 1000);
            meta.bits = u16le(b, 14);
        }
        else if (id === 'LIST' && size < 1e6) {
            const b = await slice(file, pos + 8, pos + 8 + size);
            if (ascii(b, 0, 4) === 'INFO') {
                let i = 4;
                while (i + 8 <= b.length) {
                    const k = ascii(b, i, 4), l = u32le(b, i + 4);
                    const v = decodeLatin(b.subarray(i + 8, i + 8 + l).filter(c => c !== 0)).trim();
                    if (k === 'INAM')
                        meta.title = v;
                    else if (k === 'IART')
                        meta.artist = v;
                    else if (k === 'IPRD')
                        meta.album = v;
                    else if (k === 'ICRD')
                        meta.year = yearOf(v);
                    else if (k === 'IGNR')
                        meta.genre = v;
                    else if (k === 'ITRK')
                        meta.trackNo = parseInt(v, 10) || 0;
                    i += 8 + l + (l & 1);
                }
            }
        }
        else if ((id === 'id3 ' || id === 'ID3 ') && size < 30e6) {
            const t = parseId3Bytes(await slice(file, pos + 8, pos + 8 + size));
            for (const k of Object.keys(t))
                if (t[k] && !meta[k])
                    meta[k] = t[k];
        }
        pos += 8 + size + (size & 1);
    }
    meta.audioBytes = file.size;
    return meta;
}
// ---------- MP4 / M4A / AAC ----------
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'ilst']);
function walkMp4(b, start, end, ctx) {
    let i = start;
    while (i + 8 <= end) {
        let size = u32be(b, i);
        const type = ascii(b, i + 4, 4);
        let hdr = 8;
        if (size === 1) {
            size = u32be(b, i + 12);
            hdr = 16;
        }
        if (size === 0)
            size = end - i;
        if (size < hdr || i + size > end + 1)
            break;
        const bs = i + hdr, be = Math.min(i + size, end);
        if (ctx.inIlst) {
            const d = findData(b, bs, be);
            if (d)
                ctx.items[type] = d;
        }
        else if (type === 'meta')
            walkMp4(b, bs + 4, be, ctx);
        else if (type === 'ilst')
            walkMp4(b, bs, be, { ...ctx, inIlst: true, items: ctx.items });
        else if (type === 'stsd') {
            const t = ascii(b, bs + 12, 4);
            if (t === 'mp4a' || t === 'alac') {
                ctx.meta.codec = t === 'alac' ? 'ALAC' : 'AAC';
                const e = bs + 16; // начало содержимого sample entry
                ctx.meta.channels = ((b[e + 16] << 8) | b[e + 17]) || 2;
                ctx.meta.sampleRate = u32be(b, e + 8 + 16) >>> 16;
                ctx.meta.bits = (b[e + 8 + 10] << 8) | b[e + 8 + 11];
            }
        }
        else if (CONTAINERS.has(type))
            walkMp4(b, bs, be, ctx);
        i += size;
    }
}
function findData(b, s, e) {
    let i = s;
    while (i + 8 <= e) {
        const size = u32be(b, i), type = ascii(b, i + 4, 4);
        if (size < 8)
            break;
        if (type === 'data')
            return { flags: u32be(b, i + 8) & 0xffffff, bytes: b.subarray(i + 16, i + size) };
        i += size;
    }
    return null;
}
async function readMp4(file) {
    const meta = { codec: 'AAC' };
    let pos = 0, moov = null;
    while (pos + 8 <= file.size) {
        const h = await slice(file, pos, pos + 16);
        let size = u32be(h, 0), hdr = 8;
        const type = ascii(h, 4, 4);
        if (size === 1) {
            size = u32be(h, 12);
            hdr = 16;
        }
        if (size === 0)
            size = file.size - pos;
        if (size < 8)
            break;
        if (type === 'moov') {
            moov = await slice(file, pos, pos + size);
            break;
        }
        pos += size;
    }
    if (!moov)
        return meta;
    const ctx = { meta, items: {} };
    walkMp4(moov, 0, moov.length, ctx);
    const text = k => ctx.items[k] ? dec('utf-8', ctx.items[k].bytes) : '';
    meta.title = text('©nam');
    meta.artist = text('©ART');
    meta.album = text('©alb');
    meta.albumArtist = text('aART');
    meta.year = yearOf(text('©day'));
    meta.genre = text('©gen');
    meta.lyricsText = text('©lyr');
    const tr = ctx.items.trkn;
    if (tr && tr.bytes.length >= 4)
        meta.trackNo = (tr.bytes[2] << 8) | tr.bytes[3];
    const cv = ctx.items.covr;
    if (cv)
        meta.cover = mkCover(cv.bytes, cv.flags === 14 ? 'image/png' : 'image/jpeg');
    meta.audioBytes = file.size;
    return meta;
}
// ---------- ADTS (сырой AAC) ----------
async function readAdts(file) {
    const b = await slice(file, 0, 4096);
    const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];
    for (let i = 0; i < b.length - 7; i++) {
        if (b[i] === 0xff && (b[i + 1] & 0xf6) === 0xf0) {
            return { codec: 'AAC', sampleRate: rates[(b[i + 2] >> 2) & 15], channels: ((b[i + 2] & 1) << 2) | (b[i + 3] >> 6), audioBytes: file.size };
        }
    }
    return {};
}
export const AUDIO_EXT = new Set(['mp3', 'flac', 'ogg', 'oga', 'opus', 'wav', 'wave', 'm4a', 'mp4', 'aac', 'm4b', 'weba', 'webm']);
export async function readMeta(file, name = file.name || '') {
    const ext = (name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
    let meta = {};
    try {
        const h = await slice(file, 0, 12);
        const sig = ascii(h, 0, 4);
        if (sig.startsWith('ID3'))
            meta = await readMp3(file);
        else if (sig === 'fLaC')
            meta = await readFlac(file);
        else if (sig === 'OggS')
            meta = await readOgg(file);
        else if (sig === 'RIFF')
            meta = await readWav(file);
        else if (ascii(h, 4, 4) === 'ftyp')
            meta = await readMp4(file);
        else if (ext === 'aac')
            meta = await readAdts(file);
        else
            meta = await readMp3(file);
    }
    catch (e) {
        console.warn('readMeta failed for', name, e);
    }
    delete meta._frames;
    return meta;
}
