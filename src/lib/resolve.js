import { getById } from '../data/catalog';
import { fetchAnimeDetails } from './anilist';
import { fetchMeta } from './cinemeta';
export async function resolveTitle(id, typeHint = null) {
  const local = getById(id); if (local) return { ...local, source: local.source || 'demo' };
  if (/^al-\d+$/.test(id)) return fetchAnimeDetails(id.slice(3), typeHint === 'manga' ? 'MANGA' : 'ANIME');
  if (/^tt\d+$/.test(id)) return fetchMeta(id, typeHint);
  throw new Error('Unknown title ' + id);
}
export function episodeRef(item, { epIndex = 0, season, episode } = {}) {
  if (item.category === 'anime') { const n=(item.streamingEpisodes||[])[epIndex]; return {season:1,episode:epIndex+1,title:n?.title||`Episode ${epIndex+1}`,thumb:n?.thumbnail||item.backdrop}; }
  if (item.episodes?.length) { const e=item.episodes[season&&episode?item.episodes.findIndex((x)=>x.season===season&&x.number===episode):epIndex]||item.episodes[epIndex]||item.episodes[0]; const idx=item.episodes.indexOf(e); return {season:e.season??1,episode:e.number??idx+1,title:e.title,thumb:e.thumb,index:idx}; }
  return {season:season||1,episode:episode||1,title:null,thumb:item.backdrop,index:0};
}