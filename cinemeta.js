// TMDB-backed metadata with NO API key, via Stremio Cinemeta (sourced from TMDB/IMDb/Fanart).
// Catalog:  https://v3-cinemeta.strem.io/catalog/<movie|series>/top.json  (follows redirect)
// Meta:     https://v3-cinemeta.strem.io/meta/<movie|series>/<imdbId>.json  -> includes moviedb_id (TMDB id)
const BASE = 'https://v3-cinemeta.strem.io';

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Cinemeta ' + r.status);
  return r.json();
}

function yearOf(releaseInfo) {
  const m = /(\d{4})/.exec(releaseInfo || '');
  return m ? Number(m[1]) : null;
}

export function mapMeta(type, m) {
  const isMovie = type === 'movie';
  const vids = m.videos || [];
  const episodes = !isMovie && vids.length
    ? vids.filter((v) => v.season >= 1).map((v) => ({
        title: v.name || `S${v.season} E${v.episode}`,
        season: v.season, number: v.episode,
        thumb: v.thumbnail || m.background || m.poster,
        desc: v.overview || v.description || '',
        id: v.id,
      }))
    : null;
  const genres = m.genre || m.genres || [];
  return {
    id: m.imdb_id || `tmdb-${m.moviedb_id}`,
    imdbId: m.imdb_id || null,
    tmdbId: m.moviedb_id || null,
    title: m.name,
    category: isMovie ? 'movie' : (/animation/i.test(genres.join(' ')) ? 'animation' : 'series'),
    rawType: type,
    genres,
    year: yearOf(m.releaseInfo || m.released),
    rating: m.imdbRating ? +Number(m.imdbRating).toFixed(1) : null,
    maturity: m.certification || (isMovie ? 'PG-13' : 'TV-14'),
    duration: m.runtime || null,
    cast: (m.cast || []).slice(0, 8),
    director: m.director || [],
    poster: m.poster?.replace('/small/', '/medium/') || m.poster,
    backdrop: m.background || m.poster,
    synopsis: m.description || '',
    trailerYt: (m.trailers || []).find((t) => t.type === 'Trailer')?.source || (m.trailerStreams?.[0]?.ytId) || null,
    episodes,
    source: 'tmdb',
  };
}

export async function fetchCatalog(type = 'movie', catalogId = 'top') {
  const j = await getJSON(`${BASE}/catalog/${type}/${catalogId}.json`);
  return (j.metas || []).map((m) => ({
    id: m.imdb_id,
    imdbId: m.imdb_id,
    tmdbId: null,
    title: m.name,
    category: type === 'movie' ? 'movie' : (/animation/i.test((m.genre || []).join(' ')) ? 'animation' : 'series'),
    rawType: type,
    genres: m.genre || [],
    year: yearOf(m.releaseInfo),
    rating: m.imdbRating ? +Number(m.imdbRating).toFixed(1) : null,
    poster: m.poster?.replace('/small/', '/medium/') || m.poster,
    backdrop: m.background || m.poster,
    synopsis: m.description || '',
    source: 'tmdb',
  }));
}

const metaCache = new Map();
export async function fetchMeta(imdbId, typeHint = null) {
  const types = typeHint ? [typeHint] : ['movie', 'series'];
  for (const t of types) {
    const key = `${t}:${imdbId}`;
    if (metaCache.has(key)) return metaCache.get(key);
    try {
      const j = await getJSON(`${BASE}/meta/${t}/${imdbId}.json`);
      if (j?.meta) {
        const mapped = mapMeta(t, j.meta);
        metaCache.set(key, mapped);
        return mapped;
      }
    } catch { /* try next type */ }
  }
  throw new Error('Title not found');
}
