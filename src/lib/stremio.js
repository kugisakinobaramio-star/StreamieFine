// Stremio addon network client.
// This build keeps the addon architecture from the uploaded v3 source while
// restricting StreamieFine to legitimate/non-torrent streams.
export const DEFAULT_ADDONS = [
  { url: 'https://watchhub.strem.io', name: 'WatchHub', note: 'Official Stremio addon for finding legitimate streaming/rental services' },
  { url: 'https://caching.stremio.net/publicdomainmovies.now.sh', name: 'Public Domain Movies', note: 'Official public-domain movie catalog' },
  { url: 'https://v3-channels.strem.io', name: 'YouTube', note: 'Official Stremio YouTube addon' },
  { url: 'https://opensubtitles-v3.strem.io', name: 'OpenSubtitles v3', note: 'Official subtitle addon', subtitlesOnly: true },
];

const LS_KEY = 'sf_addons';

export const normBase = (u) => (u || '').trim().replace(/\/+$/, '');

export function loadAddons() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (Array.isArray(saved) && saved.length) {
      const urls = new Set(saved.map((a) => normBase(a.url)));
      const missing = DEFAULT_ADDONS
        .filter((a) => !urls.has(normBase(a.url)))
        .map((a) => ({ ...a }));
      return [...missing, ...saved];
    }
  } catch { /* use defaults */ }
  return DEFAULT_ADDONS.map((a) => ({ ...a }));
}

export function saveAddons(addons) {
  localStorage.setItem(LS_KEY, JSON.stringify(addons));
}

export async function fetchManifest(base, timeoutMs = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${normBase(base)}/manifest.json`, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const m = await r.json();
    return {
      name: m.name || 'Addon',
      version: m.version,
      types: m.types || [],
      id: m.id,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStreamsFrom(base, resource, timeoutMs = 10000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${normBase(base)}/${resource}`, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return Array.isArray(data?.streams) ? data.streams : [];
  } finally {
    clearTimeout(timer);
  }
}

// type: movie | series. Series is queried episode-first with a pack fallback.
export async function fetchStremioStreams({ type, imdbId, season = 1, episode = 1, addons }) {
  if (!imdbId) return { results: [], streams: [] };

  const list = addons?.length ? addons : loadAddons();
  const jobs = list
    .filter((a) => !a.subtitlesOnly && a.url)
    .map(async (addon) => {
      const base = normBase(addon.url);
      try {
        if (type === 'movie') {
          const streams = await fetchStreamsFrom(base, `stream/movie/${encodeURIComponent(imdbId)}.json`);
          return { addon, streams };
        }

        const episodeResource = `stream/series/${encodeURIComponent(imdbId)}:${season}:${episode}.json`;
        const packResource = `stream/series/${encodeURIComponent(imdbId)}.json`;
        const [episodeResult, packResult] = await Promise.allSettled([
          fetchStreamsFrom(base, episodeResource),
          fetchStreamsFrom(base, packResource),
        ]);
        return {
          addon,
          streams: [
            ...(episodeResult.status === 'fulfilled' ? episodeResult.value : []),
            ...(packResult.status === 'fulfilled' ? packResult.value : []),
          ],
        };
      } catch (error) {
        return { addon, streams: [], error: String(error?.message || error) };
      }
    });

  const results = await Promise.all(jobs);
  const streams = dedupe(
    results.flatMap((result) => (result.streams || []).map((stream) => normalizeStream(stream, result.addon)))
      .filter((stream) => stream.kind !== 'torrent'),
  );

  return { results, streams: sortStreams(streams) };
}

export function normalizeStream(stream, addon) {
  const title = String(stream?.title || stream?.name || stream?.description || '').trim();
  const isDirect = typeof stream?.url === 'string' && /^https?:\/\//i.test(stream.url);
  const isYouTube = Boolean(stream?.ytId);
  const externalUrl = typeof stream?.externalUrl === 'string' && /^https?:\/\//i.test(stream.externalUrl)
    ? stream.externalUrl
    : null;
  const quality = /2160|4k/i.test(title) ? '4K'
    : /1080/i.test(title) ? '1080p'
    : /720/i.test(title) ? '720p'
    : /480/i.test(title) ? '480p'
    : (stream?.quality || '—');

  return {
    raw: stream,
    addonName: addon?.name || addon?.url || 'Addon',
    addonUrl: addon?.url || '',
    name: title.replace(/\n/g, ' • ') || 'Stream',
    detail: title.split('\n')[0] || 'Stream',
    quality,
    kind: isDirect ? 'direct' : isYouTube ? 'youtube' : externalUrl ? 'external' : 'other',
    url: isDirect ? stream.url : null,
    ytId: stream?.ytId || null,
    externalUrl,
    subtitles: stream?.subtitles || [],
    behaviorHints: stream?.behaviorHints || {},
  };
}

function dedupe(streams) {
  const seen = new Set();
  return streams.filter((stream) => {
    const key = stream.url || stream.ytId || `${stream.addonUrl}:${stream.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortStreams(streams) {
  const rank = { '4K': 0, '1080p': 1, '720p': 2, '480p': 3, '—': 4 };
  return [...streams].sort((a, b) => (rank[a.quality] ?? 5) - (rank[b.quality] ?? 5));
}
