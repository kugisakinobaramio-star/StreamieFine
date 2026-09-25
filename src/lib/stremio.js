// Stremio addon network client. Addons expose: <base>/manifest.json and
// <base>/stream/<movie|series|anime>/<id>.json  (series episodes: <imdb>:S:E)
export const DEFAULT_ADDONS = [
  { url: 'https://watchhub.strem.io', name: 'WatchHub', note: 'Official Stremio addon for finding legitimate streaming/rental services' },
  { url: 'https://caching.stremio.net/publicdomainmovies.now.sh', name: 'Public Domain Movies', note: 'Official public-domain movie catalog' },
  { url: 'https://opensubtitles-v3.strem.io', name: 'OpenSubtitles v3', note: 'Official subtitle addon', subtitlesOnly: true },
];

const LS_KEY = 'sf_addons';
export function loadAddons() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (Array.isArray(saved) && saved.length) {
      const urls = new Set(saved.map((a) => normBase(a.url)));
      const missingDefaults = DEFAULT_ADDONS.filter((a) => !urls.has(normBase(a.url))).map((a) => ({ ...a }));
      return [...missingDefaults, ...saved];
    }
  } catch { /* fall through */ }
  return DEFAULT_ADDONS.map((a) => ({ ...a }));
}
export function saveAddons(addons) {
  localStorage.setItem(LS_KEY, JSON.stringify(addons));
}
export const normBase = (u) => (u || '').trim().replace(/\/+$/, '');

export async function fetchManifest(base, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${normBase(base)}/manifest.json`, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const m = await r.json();
    return { name: m.name || 'Addon', version: m.version, types: m.types, id: m.id };
  } finally { clearTimeout(t); }
}

async function fetchStreamsFrom(base, resource, timeoutMs = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${normBase(base)}/${resource}`, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()).streams || [];
  } finally { clearTimeout(t); }
}

// type: 'movie' | 'series'; for series pass season+episode (episode-specific first, then pack fallback)
export async function fetchStremioStreams({ type, imdbId, season, episode, addons }) {
  const list = addons && addons.length ? addons : loadAddons();
  const jobs = [];
  for (const a of list) {
    if (a.subtitlesOnly) continue;
    const base = normBase(a.url);
    if (type === 'movie') {
      jobs.push(fetchStreamsFrom(base, `stream/movie/${imdbId}.json`).then((s) => ({ addon: a, streams: s })).catch((e) => ({ addon: a, error: String(e) })));
    } else {
      const epRes = `stream/series/${imdbId}:${season}:${episode}.json`;
      const packRes = `stream/series/${imdbId}.json`;
      jobs.push(
        Promise.allSettled([fetchStreamsFrom(base, epRes), fetchStreamsFrom(base, packRes)]).then(([ep, pack]) => {
          const streams = [...(ep.status === 'fulfilled' ? ep.value : []), ...(pack.status === 'fulfilled' ? pack.value : [])];
          const err = ep.status === 'rejected' && pack.status === 'rejected' ? String(ep.reason) : null;
          return { addon: a, streams, error: err };
        })
      );
    }
  }
  const results = await Promise.all(jobs);
  const flat = [];
  for (const r of results) {
    for (const s of r.streams || []) flat.push(normalizeStream(s, r.addon));
  }
  return { results, streams: dedupe(flat) };
}

function parseTorrentTitle(title = '') {
  const seeders = (/👤\s*([\d.]+)k?/i.exec(title) || [])[1] || null;
  const size = (/💾\s*([\d.]+\s*[KMGT]?B)/i.exec(title) || [])[1] || null;
  const first = (title.split('\n')[0] || '').slice(0, 120);
  return { seeders, size, first };
}

export function normalizeStream(s, addon) {
  const isDirect = typeof s.url === 'string' && /^https?:\/\//.test(s.url);
  const isTorrent = !!s.infoHash;
  const isYouTube = !!s.ytId;
  const name = (s.name || '').replace(/\n/g, ' ').trim();
  const { seeders, size, first } = parseTorrentTitle(s.title || s.description || '');
  const quality = /2160|4k/i.test(name + ' ' + first) ? '4K' : /1080/i.test(name + ' ' + first) ? '1080p' : /720/i.test(name + ' ' + first) ? '720p' : /480/i.test(name + ' ' + first) ? '480p' : (s.quality || '—');
  return {
    raw: s, addonName: addon?.name || addon?.url || 'addon',
    addonUrl: addon?.url, name: name || 'Stream', detail: first,
    quality, seeders, size,
    kind: isDirect ? 'direct' : isTorrent ? 'torrent' : isYouTube ? 'youtube' : 'other',
    url: isDirect ? s.url : null,
    ytId: s.ytId || null,
    infoHash: s.infoHash || null,
    magnet: s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : null,
    subtitles: s.subtitles || [],
    behaviorHints: s.behaviorHints || {},
  };
}

function dedupe(streams) {
  const seen = new Set();
  return streams.filter((s) => {
    const k = s.url || s.ytId || `${s.infoHash}:${s.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sortStreams(streams) {
  const qRank = { '4K': 0, '1080p': 1, '720p': 2, '480p': 3, '—': 4 };
  const parseSeed = (x) => {
    if (!x) return -1;
    const n = parseFloat(x);
    return /k$/i.test(x) ? n * 1000 : n;
  };
  return [...streams].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'direct' ? -1 : b.kind === 'direct' ? 1 : a.kind === 'youtube' ? 1 : -1;
    if ((qRank[a.quality] ?? 5) !== (qRank[b.quality] ?? 5)) return (qRank[a.quality] ?? 5) - (qRank[b.quality] ?? 5);
    return parseSeed(b.seeders) - parseSeed(a.seeders);
  });
}
