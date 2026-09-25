import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { byCat } from './data/catalog';
import { resolveTitle } from './lib/resolve';
import { fetchAnimeList } from './lib/anilist';
import { mkSearchUrl, mkBrowseUrl } from './lib/mkissa';
import { fetchCatalog } from './lib/cinemeta';
import { useStore } from './store/StoreContext';
import { ContentRow, DetailsModal } from './components/ui';

export default function TitleDetails() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const typeHint = sp.get('t');
  const [t, setT] = useState(null);
  const [related, setRelated] = useState([]);
  const [err, setErr] = useState(null);
  const { myList, toggleList } = useStore();
  const [qv, setQv] = useState(null);

  useEffect(() => {
    let dead = false;
    setT(null); setErr(null); setRelated([]);
    (async () => {
      try {
        const item = await resolveTitle(id, typeHint);
        if (dead) return;
        setT(item);
        try {
          if (item.category === 'anime' || item.category === 'manga') {
            const r = await fetchAnimeList({ sort: 'TRENDING_DESC', perPage: 12, kind: item.category === 'manga' ? 'MANGA' : 'ANIME' });
            setRelated(r.items.filter((x) => x.id !== item.id));
          } else {
            const pool = await fetchCatalog(item.rawType === 'series' ? 'series' : 'movie', 'top');
            setRelated(pool.filter((x) => x.id !== item.id && x.genres.some((g) => (item.genres || []).includes(g))).slice(0, 12));
          }
        } catch { setRelated(byCat(item.category).filter((x) => x.id !== item.id)); }
      } catch (e) { if (!dead) setErr(String(e.message || e)); }
    })();
    return () => { dead = true; };
  }, [id]);

  if (err) return <div className="page"><h1>Not found</h1><p className="sub">{err}</p><Link to="/">← Home</Link></div>;
  if (!t) return <div className="page"><h1>Loading…</h1><p className="sub">Fetching live details (AniList / TMDB)…</p></div>;
  const inList = myList.includes(t.id);
  const eps = t.episodes || (t.streamingEpisodes || []).map((s, i) => ({ title: s.title || `Episode ${i + 1}`, thumb: s.thumb || t.backdrop, desc: s.site || '', index: i }));
  const isManga = t.category === 'manga';
  const watchTo = isManga ? null : t.category === 'anime' ? `/watch/${t.id}?ep=1` : t.episodes?.length ? `/watch/${t.id}?s=${t.episodes[0].season || 1}&e=${t.episodes[0].number || 1}` : `/watch/${t.id}`;

  return (
    <>
      <div className="details-hero">
        <div className="hero-bg" style={{ backgroundImage: `url(${t.backdrop})` }} />
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="badge-row">
            <span className="pill hot">{t.category.toUpperCase()}</span>
            {t.rating && <span className="pill">★ {t.rating}</span>}
            <span className="pill">{t.maturity}</span>
            <span className="pill">{t.source === 'anilist' ? 'AniList' : t.source === 'tmdb' ? 'TMDB' : 'Demo'}</span>
          </div>
          <h1>{t.title}</h1>
          <div className="hero-meta">
            {t.rating ? <span className="match">{Math.round(t.rating * 10)}% Match</span> : null}
            {t.year && <span>{t.year}</span>}
            <span>{t.duration || (t.episodesCount ? `${t.episodesCount} Episodes` : '') || (eps.length ? `${eps.length} Episodes` : '')}</span>
            <span>{(t.genres || []).join(' • ')}</span>
          </div>
          <p className="desc">{t.synopsis}</p>
          <div className="hero-btns">
            {isManga ? (
              <a href={mkSearchUrl('manga', t.title)} target="_blank" rel="noreferrer" className="btn btn-play">📚 Read on MKissa</a>
            ) : (
              <Link to={watchTo} className="btn btn-play">▶ {eps.length ? 'Play E1' : 'Play Now'}</Link>
            )}
            <button className="btn btn-ghost" onClick={() => toggleList(t.id, t)}>{inList ? '✓ In My List' : '+ My List'}</button>
          </div>
        </div>
      </div>
      <div className="details-body">
        <div>
          <h3 style={{ marginBottom: 12 }}>{isManga ? 'Manga info' : eps.length ? `Episodes (${eps.length})` : 'About this title'}</h3>
          {isManga && (
            <div className="side-box" style={{ marginBottom: 16 }}>
              <h4>Chapters / Volumes</h4>
              <p>{t.chapters ? `${t.chapters} chapters` : 'Ongoing'} {t.volumes ? `• ${t.volumes} volumes` : ''} • Status: {t.status || '—'}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a className="btn btn-grad btn-sm" href={mkSearchUrl('manga', t.title)} target="_blank" rel="noreferrer">📚 Read on MKissa</a>
                <a className="btn btn-ghost btn-sm" href={mkBrowseUrl('manga')} target="_blank" rel="noreferrer">Browse MKissa manga →</a>
              </div>
            </div>
          )}
          {eps.length ? eps.slice(0, 40).map((e, i) => {
            const to = t.category === 'anime' ? `/watch/${t.id}?ep=${i + 1}` : `/watch/${t.id}?s=${e.season || 1}&e=${e.number ?? i + 1}`;
            return (
              <Link key={i} to={to} className="ep">
                <img src={e.thumb} alt={e.title} loading="lazy" />
                <div><h5>{i + 1}. {e.title}</h5>{e.desc && <p>{e.desc}</p>}</div>
                <span style={{ marginLeft: 'auto', fontSize: 22 }}>▶</span>
              </Link>
            );
          }) : <p style={{ color: '#d6d6e2', lineHeight: 1.7 }}>{t.category === 'manga' ? 'Find chapters on MKissa — free manga reader with a mobile app.' : 'Available in HD with subtitles. Pick a server on the watch page.'}</p>}
        </div>
        <aside className="side-box">
          <h4>Cast</h4><p>{Array.isArray(t.cast) ? t.cast.join(', ') : (t.cast || t.studio || '—')}</p>
          <h4>Genres</h4><p>{(t.genres || []).join(', ')}</p>
          <h4>Details</h4><p>Year: {t.year || '—'}<br />Rating: {t.rating ? `★ ${t.rating}/10` : '—'}<br />Maturity: {t.maturity}<br />Source: {t.source === 'anilist' ? 'AniList GraphQL (no key)' : t.source === 'tmdb' ? 'TMDB via Cinemeta (no key)' : 'Demo'}</p>
          {t.trailerYt && <a className="btn btn-ghost btn-sm" href={`https://www.youtube.com/watch?v=${t.trailerYt}`} target="_blank" rel="noreferrer">▶ Trailer</a>}
        </aside>
      </div>
      <ContentRow title="More like this" items={related} onQuickView={setQv} />
      {qv && <DetailsModal item={qv} onClose={() => setQv(null)} />}
    </>
  );
}
