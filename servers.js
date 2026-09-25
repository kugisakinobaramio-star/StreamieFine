// Iframe embed servers ("more servers"). These run client-side; if one is down, switch tabs.
// URL patterns change over time — keep them all in this one file.

function movieServers(tmdbId, imdbId) {
  const t = tmdbId, i = imdbId;
  return [
    { id: 'vidsrc-xyz', name: 'VidSrc', tag: 'Fast', url: t ? `https://vidsrc.xyz/embed/movie/${t}` : null },
    { id: 'vidsrc-cc', name: 'VidSrc CC', tag: '4K', url: t ? `https://vidsrc.cc/v2/embed/movie/${t}` : null },
    { id: 'vidsrc-to', name: 'VidSrc TO', tag: 'Backup', url: t ? `https://vidsrc.to/embed/movie/${t}` : null },
    { id: '2embed', name: '2Embed', tag: 'Backup', url: i ? `https://www.2embed.cc/embed/${i}` : null },
    { id: 'smashy', name: 'Smashy', tag: 'Movies', url: t ? `https://player.smashy.stream/movie/${t}` : null },
    { id: 'embedsu', name: 'EmbedSU', tag: 'Multi', url: t ? `https://embed.su/embed/movie/${t}` : null },
  ].filter((s) => s.url);
}

function seriesServers(tmdbId, imdbId, season, episode) {
  const t = tmdbId, i = imdbId, s = season ?? 1, e = episode ?? 1;
  return [
    { id: 'vidsrc-xyz', name: 'VidSrc', tag: 'Fast', url: t ? `https://vidsrc.xyz/embed/tv/${t}/${s}/${e}` : null },
    { id: 'vidsrc-cc', name: 'VidSrc CC', tag: '4K', url: t ? `https://vidsrc.cc/v2/embed/tv/${t}/${s}/${e}` : null },
    { id: 'vidsrc-to', name: 'VidSrc TO', tag: 'Backup', url: t ? `https://vidsrc.to/embed/tv/${t}/${s}/${e}` : null },
    { id: '2embed', name: '2Embed', tag: 'Backup', url: i ? `https://www.2embed.cc/embedtv/${i}&s=${s}&e=${e}` : null },
    { id: 'smashy', name: 'Smashy', tag: 'Series', url: t ? `https://player.smashy.stream/tv/${t}?s=${s}&e=${e}` : null },
    { id: 'embedsu', name: 'EmbedSU', tag: 'Multi', url: t ? `https://embed.su/embed/tv/${t}/${s}/${e}` : null },
  ].filter((s2) => s2.url);
}

function animeServers(anilistId, tmdbId, imdbId, episode, season = 1) {
  const list = [];
  if (anilistId) {
    list.push(
      { id: 'vidsrc-anime-sub', name: 'Anime SUB', tag: 'Sub', url: `https://vidsrc.cc/v2/embed/anime/${anilistId}/${episode || 1}/sub` },
      { id: 'vidsrc-anime-dub', name: 'Anime DUB', tag: 'Dub', url: `https://vidsrc.cc/v2/embed/anime/${anilistId}/${episode || 1}/dub` },
    );
  }
  // Many anime also exist on TMDB — TV embeds work when we know the TMDB id.
  list.push(...seriesServers(tmdbId, imdbId, season, episode || 1).map((s) => ({ ...s, id: `tmdb-${s.id}`, name: `${s.name} (TMDB)` })));
  return list.filter((s) => s.url);
}

export function getServersFor(item, { season, episode } = {}) {
  if (!item) return [];
  if (item.category === 'anime') return animeServers(item.anilistId, item.tmdbId, item.imdbId, episode || 1, season || 1);
  if (item.rawType === 'series' || item.category === 'series' || item.category === 'animation' || item.episodes) {
    return seriesServers(item.tmdbId, item.imdbId, season || 1, episode || 1);
  }
  return movieServers(item.tmdbId, item.imdbId);
}

// Remember the user's fastest-feeling server per category (no-buffer shortcut).
export function getPreferredServer(category) {
  try { return localStorage.getItem('sf_srv_' + category) || null; } catch { return null; }
}
export function setPreferredServer(category, serverId) {
  try { localStorage.setItem('sf_srv_' + category, serverId); } catch { /* ignore */ }
}
