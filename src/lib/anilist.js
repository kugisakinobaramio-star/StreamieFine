const EP = 'https://graphql.anilist.co';

async function gql(query, variables = {}) {
  const r = await fetch(EP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error('AniList ' + r.status);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0]?.message || 'AniList error');
  return j.data;
}

const FRAG = `
  id idMal type title { romaji english native }
  coverImage { large extraLarge }
  bannerImage trailer { id site }
  description averageScore popularity
  startDate { year } episodes duration chapters volumes status format genres
  studios { nodes { name } } seasonYear
`;

function strip(html = '') {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
}

export function mapAnime(m, kind = null) {
  const title = m.title?.english || m.title?.romaji || m.title?.native || 'Unknown';
  const isManga = (kind || m.type) === 'MANGA';
  return {
    id: `al-${m.id}`,
    anilistId: m.id,
    malId: m.idMal || null,
    title,
    category: isManga ? 'manga' : 'anime',
    genres: m.genres || [],
    year: m.startDate?.year || m.seasonYear || null,
    rating: m.averageScore ? +(m.averageScore / 10).toFixed(1) : null,
    maturity: 'TV-14',
    episodesCount: m.episodes || null,
    chapters: m.chapters || null,
    volumes: m.volumes || null,
    duration: m.duration ? `${m.duration}m / ep` : null,
    status: m.status || null,
    studio: m.studios?.nodes?.[0]?.name || null,
    poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
    backdrop: m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large || null,
    synopsis: strip(m.description || ''),
    trailerYt: m.trailer?.site === 'youtube' ? m.trailer.id : null,
    source: 'anilist',
  };
}

export async function fetchAnimeList({ sort = 'TRENDING_DESC', genre = null, page = 1, perPage = 18, search = null, kind = 'ANIME' } = {}) {
  const data = await gql(
    `query ($page: Int, $perPage: Int, $sort: [MediaSort], $genre: [String], $search: String, $type: MediaType) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(type: $type, sort: $sort, genre_in: $genre, search: $search, isAdult: false) { ${FRAG} }
      }
    }`,
    { page, perPage, sort: [sort], genre: genre && genre !== 'All' ? [genre] : null, search, type: kind }
  );
  return {
    items: (data.Page?.media || []).map((m) => mapAnime(m, kind)),
    pageInfo: data.Page?.pageInfo || {},
  };
}

export async function fetchAnimeDetails(anilistId, kind = 'ANIME') {
  const data = await gql(
    `query ($id: Int, $type: MediaType) {
      Media(id: $id, type: $type) {
        ${FRAG}
        streamingEpisodes { title thumbnail url site }
        relations { edges { relationType node { id title { romaji english } coverImage { large } } } }
      }
    }`,
    { id: Number(anilistId), type: kind }
  );
  const m = data.Media;
  if (!m) throw new Error('Title not found');
  const item = mapAnime(m, kind);
  item.streamingEpisodes = (m.streamingEpisodes || []).map((s) => ({
    title: s.title, thumb: s.thumbnail, url: s.url, site: s.site,
  }));
  return item;
}

export const ANIME_SORTS = [
  ['TRENDING_DESC', 'Trending'],
  ['POPULARITY_DESC', 'Most Popular'],
  ['SCORE_DESC', 'Top Rated'],
  ['START_DATE_DESC', 'Newest'],
];
