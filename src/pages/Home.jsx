import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalog, byCat, trending, categories } from '../data/catalog';
import { fetchAnimeList } from '../lib/anilist';
import { fetchCatalog } from '../lib/cinemeta';
import { buildProfile, recommend, similarTo } from '../lib/recommend';
import { useStore } from '../store/StoreContext';
import { Hero, ContentRow, DetailsModal, ContinueWatching, TastePicker } from '../components/ui';

export default function Home() {
  const [qv, setQv] = useState(null);
  const [live, setLive] = useState(null);
  const [liveOk, setLiveOk] = useState(false);
  const [showTaste, setShowTaste] = useState(false);
  const { myList, lookup, progress, prefs } = useStore();

  useEffect(() => {
    try { if (!localStorage.getItem('sf_onboarded')) setShowTaste(true); } catch {}
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [anime, manga, movies, series] = await Promise.all([
          fetchAnimeList({ sort: 'TRENDING_DESC', perPage: 14 }),
          fetchAnimeList({ sort: 'TRENDING_DESC', perPage: 14, kind: 'MANGA' }).catch(() => ({ items: [] })),
          fetchCatalog('movie', 'top'),
          fetchCatalog('series', 'top'),
        ]);
        if (dead) return;
        const anim = [...movies, ...series].filter((t) => t.category === 'animation').slice(0, 14);
        setLive({ anime: anime.items, manga: manga.items || [], movies: movies.slice(0, 18), series: series.slice(0, 18), anim });
        setLiveOk(true);
      } catch { setLiveOk(false); }
    })();
    return () => { dead = true; };
  }, []);

  const anime = liveOk ? live.anime : byCat('anime');
  const movies = liveOk ? live.movies : byCat('movie');
  const series = liveOk ? live.series : byCat('series');
  const anim = liveOk ? live.anim : byCat('animation');
  const manga = liveOk ? (live.manga || []) : [];
  const feat = liveOk
    ? [...anime.slice(0, 2), ...movies.slice(0, 2), ...series.slice(0, 2)]
    : (catalog.filter((t) => t.featured).length ? catalog.filter((t) => t.featured) : trending);

  const pool = useMemo(() => [...anime, ...movies, ...series, ...anim, ...manga], [liveOk, live]);
  const history = useMemo(() => {
    const fromList = myList.map(lookup).filter(Boolean);
    const inProg = Object.keys(progress).map(lookup).filter(Boolean);
    const seen = new Set();
    return [...fromList, ...inProg].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }, [myList, progress]);
  const profile = useMemo(() => buildProfile(history, prefs), [history, prefs]);
  const forYou = useMemo(() => (history.length || (prefs.genres || []).length ? recommend(pool, history, profile, 12) : []), [pool, history, profile]);
  const anchors = useMemo(() => history.slice(0, 2).map((h) => ({ base: h, items: similarTo(h, pool, 10) })).filter((a) => a.items.length >= 3), [history, pool]);
  const topGenre = profile.topGenres[0]?.[0];

  return (
    <>
      <Hero items={feat} />
      <div style={{ marginTop: -20 }}>
        {!liveOk && <div className="section"><span className="pill">Offline demo catalog — live AniList + TMDB rows will appear when online</span></div>}
        <ContinueWatching onQuickView={setQv} />
        {(history.length > 0 || (prefs.genres || []).length > 0) && (
          <div className="section">
            <div className="sec-head"><h2>✦ Picked for you{topGenre ? ` — ${topGenre} lover` : ''}</h2><Link to="/settings">Tune taste →</Link></div>
            <div className="rail row-scroll">
              {forYou.map(({ item }) => (
                <div key={item.id} style={{ flex: '0 0 auto', width: 176 }}>
                  <Link to={`/title/${item.id}`}><img src={item.poster} alt={item.title} loading="lazy" style={{ width: '100%', height: 248, objectFit: 'cover', borderRadius: 12 }} /></Link>
                  <h4 style={{ fontSize: 13.5, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                  <div className="csub" style={{ fontSize: 12, color: 'var(--mut)' }}>★ {item.rating ?? '—'} • {item.year || ''}</div>
                </div>
              ))}
            </div>
            {forYou.length > 0 && <p className="sub">Auto-suggested from your watchlist{topGenre ? ` + love of ${topGenre}` : ''} • {history.length} in history</p>}
          </div>
        )}
        {!(history.length || (prefs.genres || []).length) && (
          <div className="section">
            <div className="ep" style={{ cursor: 'pointer' }} onClick={() => setShowTaste(true)}>
              <div style={{ flex: 1 }}><h5>✦ Get personal suggestions</h5><p>Tell us 3 genres you love — recommendations appear here automatically.</p></div>
              <button className="btn btn-grad btn-sm">Start</button>
            </div>
          </div>
        )}
        {anchors.map(({ base, items }) => (
          <ContentRow key={base.id} title={`Because you watched ${base.title}`} items={items} onQuickView={setQv} />
        ))}
        <ContentRow title="🎌 Trending Anime (AniList • live)" items={anime} link="/browse/anime" onQuickView={setQv} />
        <div className="section">
          <div className="sec-head"><h2>Browse by Category</h2></div>
          <div className="cat-tiles">
            {categories.map((c) => (
              <Link key={c.id} to={`/browse/${c.id}`} className="cat-tile" style={{ background: c.grad }}>
                <h3>{c.label} →</h3><p>{c.desc}</p>
              </Link>
            ))}
          </div>
        </div>
        <ContentRow title="🎬 Top Movies (TMDB • live)" items={movies} link="/browse/movie" onQuickView={setQv} />
        <ContentRow title="📺 Top TV Series (TMDB • live)" items={series} link="/browse/series" onQuickView={setQv} />
        <ContentRow title="✨ Animation (TMDB • live)" items={anim} link="/browse/animation" onQuickView={setQv} />
        <ContentRow title="📚 Trending Manga (AniList • read on MKissa)" items={manga} link="/browse/manga" onQuickView={setQv} />
      </div>
      {qv && <DetailsModal item={qv} onClose={() => setQv(null)} />}
      {showTaste && (
        <div className="modal-bg" onClick={() => setShowTaste(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-body"><TastePicker onDone={() => setShowTaste(false)} /></div></div>
        </div>
      )}
    </>
  );
}
