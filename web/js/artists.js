import { norm } from './util.js';

// Разбор строки артистов: «A & B», «A; B», «A feat. B», «A (ft. B)», «A, B» → ['A', 'B']
// Названия, которые нельзя резать (содержат «&», «,» и т.п. внутри имени)
const KEEP = ['Tyler, The Creator', 'Florence & the Machine', 'Earth, Wind & Fire', 'Hall & Oates', 'Simon & Garfunkel', 'Crosby, Stills, Nash & Young',
    'Mumford & Sons', 'Kool & the Gang', 'Sonny & Cher', 'Echo & the Bunnymen', 'Siouxsie & the Banshees', 'Of Monsters and Men', 'Years & Years',
    'Brooks & Dunn', 'Bob Marley & The Wailers', 'Prince & The Revolution', 'Nick Cave & The Bad Seeds', 'Gerry & The Pacemakers', 'Tom Petty & The Heartbreakers',
    'AC/DC', 'Guns N\' Roses', 'Run-D.M.C.', 'Black Eyed Peas'];
const keepSorted = KEEP.slice().sort((a, b) => b.length - a.length);
const SEP = /\s*(?:;|&|,|\sfeat(?:uring)?\.?\s|\sft\.?\s|\sfeat(?:uring)?\.?$|\s×\s|\s+x\s+)\s*/i;
const FEAT_BRACKET = /[(\[]\s*(?:feat(?:uring)?\.?|ft\.?|with)\s+([^)\]]+)[)\]]/ig;
export const UNKNOWN = 'Неизвестный артист';
export function splitArtists(raw) {
    let s = String(raw || '').replace(/\u0000/g, ';').trim();
    if (!s)
        return [];
    s = s.replace(FEAT_BRACKET, ' feat. $1');
    const hold = [];
    for (const k of keepSorted) {
        const i = s.toLowerCase().indexOf(k.toLowerCase());
        if (i >= 0) {
            hold.push(s.slice(i, i + k.length));
            s = s.slice(0, i) + `\u0001${hold.length - 1}\u0001` + s.slice(i + k.length);
        }
    }
    const out = [], seen = new Set();
    for (let part of s.split(SEP)) {
        part = part.replace(/\u0001(\d+)\u0001/g, (_, n) => hold[+n]).trim();
        if (!part)
            continue;
        const key = norm(part);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(part);
    }
    return out;
}
// Артисты, указанные в названии: «Track (feat. B & C)»
export function titleFeatured(title) {
    const out = [];
    for (const m of String(title || '').matchAll(new RegExp(FEAT_BRACKET.source, 'ig')))
        out.push(...splitArtists(m[1]));
    return out;
}
// Полный список артистов трека (без дубликатов, главный — первым)
export function trackArtists(t) {
    const names = [...splitArtists(t.artist), ...titleFeatured(t.title)];
    const seen = new Set(), out = [];
    for (const n of names) {
        const k = norm(n);
        if (!seen.has(k)) {
            seen.add(k);
            out.push(n);
        }
    }
    return out.length ? out : [UNKNOWN];
}
export const artistKey = name => 'ar:' + norm(name);
