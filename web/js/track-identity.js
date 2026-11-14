// Only explicit repost-channel labels are corrected. Ordinary artist names stay intact.
export const isUploadChannel = value => /\baudios?\s+station\b/i.test(String(value || ''));
export function trackIdentity(raw) {
    if (!isUploadChannel(raw.artist)) return {};
    const match = /^(.+?)\s+[-–—]\s+(.+)$/.exec(String(raw.title || '').trim());
    if (!match || isUploadChannel(match[1])) return { artist: '' };
    const title = match[2].replace(/\s*\[(?:slump(?:\s+audios?\s+station)?|[^\]]*\baudios?\s+station\b[^\]]*)\]\s*$/i, '').trim();
    return title ? { artist: match[1].trim(), title } : { artist: '' };
}
