import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { byCat, categories } from './data/catalog';
import { fetchAnimeList, ANIME_SORTS } from './lib/anilist';
import { fetchCatalog } from './lib/cinemeta';
import { TitleCard, DetailsModal } from './components/ui';

const ANIME_GENRES = ['All', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];

export default function Browse() {
  const { category } = useParams();
  const [genre, setGenre] = useState('All');
  const [sort, setSort] = useState('rating');
  const [qv, setQv] = useState(null);
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveOk, setLiveOk] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const cat = categories.find((c) => c.id === category);

  useEffect(() => { setGenre('All'); setSort('rating'); setPage(1); setLive([]); }, [category]);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    (async () => {
      try {
        if (category === 'anime' || category === 'manga') {
          const sortMap = { rating: 'SCORE_DESC', trending: 'TRENDING_DESC', popular: 'POPULARITY_DESC', newest: 'START_DATE_DESC' };
          const r = await fetchAnimeList({ sort: sortMap[sort] || 'SCORE_DESC', genre, page, perPage: 18, kind: category === 'manga' ? 'MANGA' : 'ANIME' });
          if (dead) return;
          setLive((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
          setHasNext(!!r.pageInfo.hasNextPage);
        } else {
          const [movies, series] = await Promise.all([fetchCatalog('movie', 'top'), fetchCatalog('series', 'top')]);
          if (dead) return;
          let pool = category === 'movie' ? movies : category === 'series' ? series.filter((t) => t.category === 'series') : [...movies, ...series].filter((t) => t.category === 'animation');
          if (genre !== 'All') pool = pool.filter((t) => t.genres.includes(genre));
          const s = [...pool];
          if (sort === 'rating') s.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          if (sort === 'year') s.sort((a, b) => (b.year || 0) - (a.year || 0));
          if (sort === 'title') s.sort((a, b) => a.title.localeCompare(b.title));
          setLive(s);
          setHasNext(false);
        }
        setLiveOk(true);
      } catch { setLiveOk(false); }
      if (!dead) setLoading(false);
    })();
    return () => { dead = true; };
  }, [category, genre, sort, page]);

  const fallback = useMemo(() => {
    let list = byCat(category);
    if (genre !== 'All') list = list.filter((t) => t.genres.includes(genre));
    return list;
  }, [category, genre]);

  const items = liveOk && live.length ? live : fallback;
  const genres = (category === 'anime' || category === 'manga') ? ANIME_GENRES : ['All', ...new Set([...byCat(category).flatMap((t) => t.genres), ...live.flatMap((t) => t.genres || [])])];

  return (
    <div className="page">
      <h1>{cat?.label || 'Browse'}</h1>
      <p className="sub">{cat?.desc} • {(category === 'anime' || category === 'manga') ? 'AniList (live, no key)' : 'TMDB via Cinemeta (live, no key)'} • {items.length} titles</p>
      <div className="filters">
        {genres.slice(0, 16).map((g) => <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => { setGenre(g); setPage(1); setLive([]); }}>{g}</button>)}
        <select className="sel" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); setLive([]); }}>
          {(category === 'anime' || category === 'manga')
            ? <><option value="trending">Trending</option><option value="popular">Most Popular</option><option value="rating">Top Rated</option><option value="newest">Newest</option></>
            : <><option value="rating">Top Rated</option><option value="year">Newest</option><option value="title">A–Z</option></>}
        </select>
      </div>
      {loading && !items.length ? <div className="empty">Loading live catalog…</div> : (
        <div className="grid">{items.map((t) => <TitleCard key={t.id} item={t} onQuickView={setQv} />)}</div>
      )}
      {(category === 'anime' || category === 'manga') && hasNext && <div style={{ textAlign: 'center', marginTop: 22 }}><button className="btn btn-ghost" onClick={() => setPage((p) => p + 1)}>Load more</button></div>}
      {!liveOk && <p className="sub" style={{ marginTop: 16 }}>Live catalog unreachable — showing offline demo titles.</p>}
      {qv && <DetailsModal item={qv} onClose={() => setQv(null)} />}
    </div>
  );
}
