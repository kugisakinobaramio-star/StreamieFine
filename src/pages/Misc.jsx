import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { catalog } from '../data/catalog';
import { fetchAnimeList } from '../lib/anilist';
import { fetchCatalog } from '../lib/cinemeta';
import { DEFAULT_ADDONS, fetchManifest, loadAddons, saveAddons, normBase } from '../lib/stremio';
import { useStore } from '../store/StoreContext';
import { TitleCard, DetailsModal, TastePicker } from '../components/ui';
import { buildProfile } from '../lib/recommend';

export function MyList() {
  const { myList, lookup, toggleList } = useStore();
  const [qv, setQv] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const all = myList.map(lookup).filter(Boolean);
  const cats = ['all', 'anime', 'manga', 'movie', 'series', 'animation'];
  let items = filter === 'all' ? all : all.filter((t) => t.category === filter);
  items = [...items].sort((a, b) => sort === 'rating' ? (b.rating || 0) - (a.rating || 0) : sort === 'title' ? a.title.localeCompare(b.title) : 0);
  if (sort === 'recent') items = items.reverse();
  return (
    <div className="page">
      <h1>My Watchlist</h1><p className="sub">{all.length} saved • anime, movies, series & animation in one place</p>
      <div className="filters">
        {cats.map((c) => <button key={c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>{c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}</button>)}
        <select className="sel" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Recently added</option><option value="rating">Top rated</option><option value="title">A–Z</option>
        </select>
      </div>
      {items.length ? <div className="grid">{items.map((t) => (
        <div key={t.id} style={{ position: 'relative' }}>
          <TitleCard item={t} onQuickView={setQv} />
          <button className="icon-btn" title="Remove" style={{ position: 'absolute', top: 8, right: 8 }} onClick={() => toggleList(t.id)}>✕</button>
        </div>
      ))}</div>
        : <div className="empty"><h3>{all.length ? 'Nothing in this filter' : 'Your watchlist is empty'}</h3><p>Tap + on any title to save it here.</p><br /><Link to="/" className="btn btn-grad">Discover titles</Link></div>}
      {qv && <DetailsModal item={qv} onClose={() => setQv(null)} />}
    </div>
  );
}

let catCache = null;
async function livePool() {
  if (!catCache) {
    const [m, s] = await Promise.all([fetchCatalog('movie', 'top'), fetchCatalog('series', 'top')]);
    catCache = [...m, ...s];
  }
  return catCache;
}

export function Search() {
  const [sp] = useSearchParams();
  const raw = sp.get('q') || '';
  const q = raw.toLowerCase();
  const [qv, setQv] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!q) { setResults(catalog); return; }
    let dead = false;
    setLoading(true);
    (async () => {
      try {
        const [anime, manga, pool] = await Promise.all([
          fetchAnimeList({ search: raw, perPage: 10 }).catch(() => ({ items: [] })),
          fetchAnimeList({ search: raw, perPage: 6, kind: 'MANGA' }).catch(() => ({ items: [] })),
          livePool().catch(() => []),
        ]);
        const tmdbHits = (pool || []).filter((t) => (t.title + ' ' + t.genres.join(' ')).toLowerCase().includes(q)).slice(0, 18);
        const demoHits = catalog.filter((t) => (t.title + ' ' + t.genres.join(' ') + ' ' + t.category).toLowerCase().includes(q));
        if (!dead) setResults([...(anime.items || []), ...((manga || {}).items || []), ...tmdbHits, ...demoHits]);
      } catch { if (!dead) setResults(catalog.filter((t) => (t.title + ' ' + t.genres.join(' ')).toLowerCase().includes(q))); }
      if (!dead) setLoading(false);
    })();
    return () => { dead = true; };
  }, [q]);
  return (
    <div className="page">
      <h1>{raw ? `Results for "${raw}"` : 'Search'}</h1>
      <p className="sub">{loading ? 'Searching AniList + TMDB…' : `${results.length} titles found`}</p>
      <div className="grid">{results.map((t) => <TitleCard key={t.id} item={t} onQuickView={setQv} />)}</div>
      {qv && <DetailsModal item={qv} onClose={() => setQv(null)} />}
    </div>
  );
}

export function Login() {
  const [name, setName] = useState('');
  const { login, user } = useStore();
  const nav = useNavigate();
  if (user) { nav('/'); return null; }
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo" style={{ marginBottom: 12 }}>Streamie<span>Fine</span></div>
        <h2>Welcome back</h2><p className="sub">Sign in to sync My List and Continue Watching</p>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { login(name.trim()); nav('/'); } }}>
          <div className="field"><label>Display name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" /></div>
          <div className="field"><label>Password (demo)</label><input type="password" placeholder="any password works" /></div>
          <button className="btn btn-grad w-full">Sign In</button>
        </form>
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--mut)' }}>Demo profile is created instantly. No real auth.</p>
      </div>
    </div>
  );
}

function TasteStats() {
  const { myList, lookup, progress } = useStore();
  const saved = myList.map(lookup).filter(Boolean);
  const watching = Object.keys(progress).length;
  const p = buildProfile(saved, { genres: [], cats: [] });
  const top = p.topGenres.slice(0, 3).map(([g]) => g).join(', ');
  return <p className="sub" style={{ marginTop: 10 }}>{saved.length} saved • {watching} in progress{top ? ` • top genres: ${top}` : ''}</p>;
}

export function Settings() {
  const [showT, setShowT] = useState(() => { try { return localStorage.getItem('sf_show_torrents') === '1'; } catch { return false; } });
  const [addons, setAddons] = useState(loadAddons);
  const [names, setNames] = useState({});
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    addons.forEach((a) => {
      if (names[a.url]) return;
      fetchManifest(a.url).then((m) => setNames((n) => ({ ...n, [a.url]: `${m.name}${m.version ? ' v' + m.version : ''}` })))
        .catch(() => setNames((n) => ({ ...n, [a.url]: '⚠ unreachable' })));
    });
  }, [addons]);
  const persist = (list) => { setAddons(list); saveAddons(list); };
  const add = () => {
    const url = normBase(input);
    if (!url.startsWith('http')) { setMsg('Paste a full addon URL, e.g. your Torrentio configure link base.'); return; }
    if (addons.some((a) => normBase(a.url) === url)) { setMsg('Already added.'); return; }
    persist([...addons, { url, note: 'custom' }]);
    setInput(''); setMsg('Addon added — verifying manifest above.');
  };
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>Stream Settings</h1>
      <div className="side-box" style={{ marginBottom: 16 }}>
        <h4>✦ Your taste (drives auto-suggestions)</h4>
        <TastePicker />
        <TasteStats />
      </div>
      <div className="ep" style={{ cursor: 'default', marginBottom: 16 }}>
        <div style={{ flex: 1 }}><h5>HTTP-only mode (recommended)</h5><p>Watch pages show direct files, embeds, YouTube, Odysee & Rumble. Torrents stay hidden.</p></div>
        <button className={`chip ${!showT ? 'on' : ''}`} onClick={() => { setShowT(false); try { localStorage.setItem('sf_show_torrents', '0'); } catch {} }}>HTTP only</button>
        <button className={`chip ${showT ? 'on' : ''}`} onClick={() => { setShowT(true); try { localStorage.setItem('sf_show_torrents', '1'); } catch {} }}>+ Torrents</button>
      </div>
      <p className="sub">Stremio addons power the direct-file sources on watch pages. Paste any Stremio addon base URL — e.g. your configured Torrentio link (<i>https://torrentio.strem.fun/&lt;your-config&gt;</i>), MediaFusion or Comet configure URL.</p>
      <div style={{ display: 'grid', gap: 10, margin: '18px 0' }}>
        {addons.map((a, i) => (
          <div key={a.url} className="ep" style={{ cursor: 'default' }}>
            <div style={{ flex: 1 }}><h5>{names[a.url] || 'Checking…'}</h5><p style={{ wordBreak: 'break-all' }}>{a.url}</p></div>
            <button className="btn btn-ghost btn-sm" disabled={addons.length <= 1} onClick={() => persist(addons.filter((_, x) => x !== i))}>Remove</button>
          </div>
        ))}
      </div>
      <div className="field"><label>New addon base URL</label><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://torrentio.strem.fun/..." /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-grad btn-sm" onClick={add}>+ Add addon</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { persist(DEFAULT_ADDONS.map((a) => ({ ...a }))); setMsg('Reset to defaults.'); }}>Reset defaults</button>
      </div>
      {msg && <p className="sub" style={{ marginTop: 12 }}>{msg}</p>}
      <div className="side-box" style={{ marginTop: 22 }}>
        <h4>🎞 Pexels video source</h4>
        <p>Pexels provides a free video API. Add your own API key to enable the Pexels tab on watch pages. The key is stored only in this browser.</p>
        <div className="field"><label>Pexels API key</label><input type="password" value={localStorage.getItem('sf_pexels_key') || ''} onChange={(e) => { try { localStorage.setItem('sf_pexels_key', e.target.value); } catch {} setMsg('Pexels key saved locally.'); }} placeholder="Paste your Pexels API key" /></div>
        <p className="sub">You can request a key from Pexels. Keep it private and do not commit it to GitHub.</p>
      </div>
      <div className="side-box" style={{ marginTop: 22 }}
        <h4>How to get more sources</h4>
        <p>1. Open your Stremio addon (Torrentio / MediaFusion / Comet) configure page.<br />2. Pick providers + Debrid options, click Install — copy the manifest URL.<br />3. Strip everything after the host config path and paste the base URL here.<br />Debrid (Real-Debrid / Premiumize) links play instantly; plain torrents show as magnets.</p>
      </div>
    </div>
  );
}
