import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { getById } from '../data/catalog';
import { useStore as _us } from '../store/StoreContext'; /* lookup hook */

export function Navbar({ onQuickView }) {
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout } = useStore();
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', f);
    return () => window.removeEventListener('scroll', f);
  }, []);
  const links = [
    ['/', 'Home'], ['/browse/anime', 'Anime'], ['/browse/movie', 'Movies'],
    ['/browse/series', 'Series'], ['/browse/animation', 'Animation'], ['/browse/manga', 'Manga'], ['/mylist', 'My List'], ['/settings', '⚙']
  ];
  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="logo">Streamie<span>Fine</span><small>STREAM • ANIME • FILM</small></Link>
      <div className="nav-links">
        {links.map(([to, l]) => <Link key={to} to={to} className={loc.pathname === to ? 'active' : ''}>{l}</Link>)}
      </div>
      <div className="nav-right">
        <form className="search-box" onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`); }}>
          <span>🔍</span>
          <input placeholder="Search titles..." value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {user ? (
          <><div className="avatar">{user.name[0]?.toUpperCase()}</div><button className="btn btn-ghost btn-sm" onClick={logout}>Out</button></>
        ) : (
          <Link to="/login" className="btn btn-grad btn-sm">Sign In</Link>
        )}
      </div>
    </nav>
  );
}

export function Hero({ items }) {
  const [i, setI] = useState(0);
  const { myList, toggleList } = useStore();
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);
  const t = items[i];
  if (!t) return null;
  const inList = myList.includes(t.id);
  return (
    <header className="hero">
      <div className="hero-bg" style={{ backgroundImage: `url(${t.backdrop})` }} key={t.id} />
      <div className="hero-shade" />
      <div className="hero-content">
        <div className="badge-row">
          <span className="pill hot"># {i + 1} Trending Now</span>
          <span className="pill">{t.category.toUpperCase()}</span>
          <span className="pill">★ {t.rating ?? '—'}</span>
        </div>
        <h1>{t.title}</h1>
        <div className="hero-meta">
          {t.rating ? <span className="match">{Math.round(t.rating * 10)}% Match</span> : null}
          <span>{t.year}</span><span>{t.duration || `${t.seasons || 1} Season${(t.seasons || 1) > 1 ? 's' : ''}`}</span>
          <span>{t.maturity}</span><span>{(t.genres || []).join(' • ')}</span>
        </div>
        <p className="desc">{t.synopsis}</p>
        <div className="hero-btns">
          <Link to={`/watch/${t.id}`} className="btn btn-play">▶ Play</Link>
          <Link to={`/title/${t.id}`} className="btn btn-ghost">ⓘ More Info</Link>
          <button className="btn btn-ghost" onClick={() => toggleList(t.id, t)}>{inList ? '✓ In My List' : '+ My List'}</button>
        </div>
      </div>
      <div className="hero-dots">{items.map((_, d) => <button key={d} className={`dot ${d === i ? 'on' : ''}`} onClick={() => setI(d)} />)}</div>
    </header>
  );
}

export function TitleCard({ item, onQuickView, progress }) {
  const { myList, toggleList } = useStore();
  const inList = myList.includes(item.id);
  return (
    <div className="card" onClick={() => onQuickView ? onQuickView(item) : null}>
      <span className="card-top">★ {item.rating ?? '—'}</span>
      <Link to={`/title/${item.id}`} onClick={(e) => e.stopPropagation()}>
        <img src={item.poster} alt={item.title} loading="lazy" />
      </Link>
      <div className="cbody">
        <h4>{item.title}</h4>
        <div className="csub"><span>{item.year} • {item.category}</span><span className="rate">{item.maturity}</span></div>
        {progress > 0 && <div className="progress"><i style={{ width: `${progress}%` }} /></div>}
      </div>
      <div className="card-hover">
        <Link to={`/watch/${item.id}`} className="icon-btn" onClick={(e) => e.stopPropagation()}>▶</Link>
        <Link to={`/title/${item.id}`} className="icon-btn" onClick={(e) => e.stopPropagation()}>ⓘ</Link>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleList(item.id, item); }}>{inList ? '✓' : '+'}</button>
      </div>
    </div>
  );
}

export function ContentRow({ title, items, link, onQuickView, progressMap }) {
  if (!items?.length) return null;
  return (
    <div className="section">
      <div className="sec-head"><h2>{title}</h2>{link && <Link to={link}>Explore all →</Link>}</div>
      <div className="rail row-scroll">
        {items.map((t) => <TitleCard key={t.id} item={t} onQuickView={onQuickView} progress={progressMap?.[t.id] || 0} />)}
      </div>
    </div>
  );
}

export function DetailsModal({ item, onClose }) {
  const { toggleList, myList } = useStore();
  if (!item) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hero" style={{ backgroundImage: `url(${item.backdrop})` }}>
          <div><h2 style={{ fontSize: 32, fontWeight: 900 }}>{item.title}</h2>
            <div className="hero-meta" style={{ margin: '8px 0 14px' }}>
              {item.rating ? <span className="match">{Math.round(item.rating * 10)}% Match</span> : null}<span>{item.year}</span><span>{item.maturity}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to={`/watch/${item.id}`} className="btn btn-play btn-sm">▶ Play</Link>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleList(item.id, item)}>{myList.includes(item.id) ? '✓ In List' : '+ My List'}</button>
            </div>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ lineHeight: 1.65, color: '#d6d6e2' }}>{item.synopsis}</p>
          <p style={{ marginTop: 14, fontSize: 13, color: 'var(--mut)' }}><b>Cast:</b> {item.cast} &nbsp;•&nbsp; <b>Genres:</b> {item.genres.join(', ')}</p>
          <div style={{ marginTop: 18, textAlign: 'right' }}><Link to={`/title/${item.id}`} className="btn btn-grad btn-sm">Full Details →</Link></div>
        </div>
      </div>
    </div>
  );
}

export function ContinueWatching({ onQuickView }) {
  const { progress } = useStore();
  const { lookup: _lk } = _us();
  const ids = Object.keys(progress).filter((k) => progress[k] > 1 && progress[k] < 97);
  if (!ids.length) return null;
  const items = ids.map(_lk).filter(Boolean);
  return <ContentRow title="▶ Continue Watching" items={items} onQuickView={onQuickView} progressMap={progress} />;
}

export function Footer() {
  return (
    <footer>
      <div className="logo" style={{ fontSize: 20 }}>Streamie<span>Fine</span></div>
      <p style={{ marginTop: 8 }}>Unlimited anime, movies, series & animation. Stream in HD with subs & dubs.</p>
      <div className="f-grid">
        <div><b>Browse</b><br /><br /><Link to="/browse/anime">Anime</Link><br /><Link to="/browse/movie">Movies</Link><br /><Link to="/browse/series">Series</Link><br /><Link to="/browse/animation">Animation</Link></div>
        <div><b>Account</b><br /><br /><Link to="/mylist">My List</Link><br /><Link to="/login">Sign In</Link><br /><Link to="/search">Search</Link></div>
        <div><b>Company</b><br /><br /><span>About • Careers • Press • Help Center</span></div>
        <div><b>Notice</b><br /><br /><span>Demo catalog with sample streams for preview purposes.</span></div>
      </div>
      <p>© 2026 StreamieFine. Made for fans.</p>
    </footer>
  );
}

const TASTE_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Horror', 'Kids', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'];
const TASTE_CATS = [['anime', '🎌 Anime'], ['movie', '🎬 Movies'], ['series', '📺 Series'], ['animation', '✨ Animation'], ['manga', '📚 Manga']];

export function TastePicker({ onDone }) {
  const { prefs, setPrefs } = useStore();
  const [genres, setGenres] = useState(prefs.genres || []);
  const [cats, setCats] = useState(prefs.cats || []);
  const tog = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>What do you love to watch?</h2>
      <p className="sub">Pick a few — StreamieFine will auto-suggest titles to match your taste. Change anytime in Settings.</p>
      <h4 style={{ margin: '16px 0 8px' }}>Categories</h4>
      <div className="filters">{TASTE_CATS.map(([id, l]) => <button key={id} className={`chip ${cats.includes(id) ? 'on' : ''}`} onClick={() => tog(cats, setCats, id)}>{l}</button>)}</div>
      <h4 style={{ margin: '6px 0 8px' }}>Genres</h4>
      <div className="filters">{TASTE_GENRES.map((g) => <button key={g} className={`chip ${genres.includes(g) ? 'on' : ''}`} onClick={() => tog(genres, setGenres, g)}>{g}</button>)}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="btn btn-grad" onClick={() => { setPrefs({ genres, cats }); try { localStorage.setItem('sf_onboarded', '1'); } catch {} onDone && onDone(); }}>Save my taste ✦</button>
        <button className="btn btn-ghost" onClick={() => { try { localStorage.setItem('sf_onboarded', '1'); } catch {} onDone && onDone(); }}>Skip</button>
      </div>
    </div>
  );
}
