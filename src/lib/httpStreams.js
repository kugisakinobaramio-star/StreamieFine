// HTTP-only providers (no torrents): YouTube via Invidious API pools,
// Odysee via Lighthouse search + embeds, Rumble via oEmbed + search links.
import { useEffect, useState } from 'react';
const INVIDIOUS_HOSTS = [
  'https://invidious.darkness.services','https://yewtu.be','https://inv.tux.pizza',
  'https://invidious.nerdvpn.de','https://invidious.reallyaweso.me','https://iv.duti.dev',
];
let workingHost = null;
async function ivFetch(path, timeoutMs = 9000) {
  const hosts = [...(workingHost ? [workingHost] : []), ...INVIDIOUS_HOSTS.filter((h) => h !== workingHost)];
  let lastErr = null;
  for (const h of hosts) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try { const r = await fetch(`${h}${path}`, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); workingHost = h; return j; }
    catch (e) { lastErr = e; } finally { clearTimeout(t); }
  }
  throw lastErr || new Error('All Invidious instances unreachable');
}
export async function youTubeSearch(query, maxResults = 10) {
  const j = await ivFetch(`/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`);
  return (Array.isArray(j) ? j : []).filter((v) => v.videoId).slice(0, maxResults).map((v) => ({
    videoId: v.videoId,title: v.title,author: v.author,length: v.lengthSeconds ? fmtDur(v.lengthSeconds) : '',
    views: v.viewCount ? fmtViews(v.viewCount) : '',thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
  }));
}
export async function youTubeFiles(videoId) {
  const j = await ivFetch(`/api/v1/videos/${videoId}`);
  const files = [...(j.formatStreams || []), ...(j.adaptiveFormats || []).filter((f) => f.url && f.audioTrack)];
  return files.filter((f) => f.url).slice(0, 12).map((f, i) => ({
    key: `${f.itag || i}`,quality: f.qualityLabel || f.quality || '—',container: (f.container || 'mp4').toUpperCase(),fps: f.fps || null,size: f.size || null,url: f.url,
  }));
}
function fmtDur(s) { s = Number(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`; }
function fmtViews(n) { n = Number(n); if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(n); }
export async function odyseeSearch(query, size = 12) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
  try { const r = await fetch(`https://lighthouse.odysee.com/search?s=${encodeURIComponent(query)}&size=${size}&from=0`, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); return (Array.isArray(j) ? j : []).filter((c) => c.name && c.claimId).map((c) => ({ name:c.name,claimId:c.claimId,title:prettify(c.name),embed:`https://odysee.com/$/embed/${c.name}:${c.claimId}`,page:`https://odysee.com/${c.name}:${c.claimId}` })); } finally { clearTimeout(t); }
}
function prettify(name) { return decodeURIComponent(name).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,(c)=>c.toUpperCase()).slice(0,90); }
export async function pixabaySearch(query, perPage = 12) {
  const url = `https://pixabay.com/api/videos/?q=${encodeURIComponent(query)}&per_page=${Math.min(Math.max(perPage, 3), 20)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Pixabay API requires a configured API key');
  const j = await r.json();
  return (j.hits || []).map((v) => ({
    id: v.id,
    title: v.tags || 'Pixabay video',
    duration: v.duration || 0,
    thumb: v.videos?.tiny?.thumbnail || v.videos?.small?.thumbnail || '',
    files: Object.entries(v.videos || {}).filter(([, f]) => f?.url).map(([quality, f]) => ({
      quality, url: f.url, width: f.width, height: f.height, size: f.size || null,
    })),
    page: v.pageURL,
  }));
}
export const rumbleSearchUrl = (q) => `https://rumble.com/search/video?q=${encodeURIComponent(q)}`;
export async function rumbleEmbed(rawUrl) { const m=/rumble\.com\//.exec(rawUrl||''); if(!m) throw new Error('Not a Rumble URL'); const r=await fetch(`https://rumble.com/api/Media/oEmbed.json?url=${encodeURIComponent(rawUrl)}`); if(!r.ok) throw new Error('oEmbed failed'); const j=await r.json(); const src=/src="([^"]+)"/.exec(j.html||'')?.[1]; if(!src) throw new Error('No embed found'); return {title:j.title,embed:src,author:j.author_name}; }
export function downloadUrl(url, filename) { const a=document.createElement('a'); a.href=url; a.download=filename||'streamiefine-video.mp4'; a.target='_blank'; a.rel='noreferrer'; document.body.appendChild(a); a.click(); a.remove(); }