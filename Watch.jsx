import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { resolveTitle, episodeRef } from './lib/resolve';
import { getServersFor, getPreferredServer, setPreferredServer } from './lib/servers';
import { fetchStremioStreams, loadAddons, sortStreams } from './lib/stremio';
import { youTubeSearch, youTubeFiles, odyseeSearch, rumbleSearchUrl, rumbleEmbed, downloadUrl } from './lib/httpStreams';
import { useStore } from './store/StoreContext';
import { mkSearchUrl, mkBrowseUrl, MK } from './lib/mkissa';

const showTorrents = () => { try { return localStorage.getItem('sf_show_torrents') === '1'; } catch { return false; } };
const safeName = (s) => (s || 'video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);

export default function Watch() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const [item, setItem] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('servers');
  const [srvIdx, setSrvIdx] = useState(0);
  const [direct, setDirect] = useState(null);
  const [embedMain, setEmbedMain] = useState(null);
  const [httpFiles, setHttpFiles] = useState([]);
  const [torrents, setTorrents] = useState([]);
  const [sLoading, setSLoading] = useState(false);
  const [yt, setYt] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytFiles, setYtFiles] = useState({});
  const [ytQuality, setYtQuality] = useState({});
  const [od, setOd] = useState([]);
  const [odLoading, setOdLoading] = useState(false);
  const [rumbleUrl, setRumbleUrl] = useState('');
  const [rumbleErr, setRumbleErr] = useState('');
  const { saveProgress } = useStore();

  const sParam = Number(sp.get('s') || NaN);
  const eParam = Number(sp.get('e') || NaN);
  const epParam = Number(sp.get('ep') || NaN);

  useEffect(() => {
    let dead = false;
    setItem(null); setErr(null); setDirect(null); setEmbedMain(null); setSrvIdx(0);
    setHttpFiles([]); setTorrents([]); setYt([]); setYtFiles({}); setOd([]);
    (async () => {
      try {
        const it = await resolveTitle(id, sp.get('t'));
        if (!dead) { setItem(it); setTab(it.category === 'manga' ? 'mkissa' : 'servers'); if (it.category !== 'manga') saveProgress(it.id, 5); }
      } catch (e) { if (!dead) setErr(String(e.message || e)); }
    })();
    return () => { dead = true; };
  }, [id]);

  const ref = useMemo(() => {
    if (!item) return null;
    if (item.category === 'anime') return episodeRef(item, { epIndex: (Number.isFinite(epParam) ? epParam : 1) - 1 });
    if (Number.isFinite(sParam) && Number.isFinite(eParam)) return episodeRef(item, { season: sParam, episode: eParam });
    return episodeRef(item, { epIndex: 0 });
  }, [item, sParam, eParam, epParam]);

  const servers = useMemo(() => {
    if (!item || !ref) return [];
    const list = [];
    if (item.video) list.push({ id: 'demo-file', name: 'Demo File', tag: 'Sample', url: item.video, demo: true });
    list.push(...getServersFor(item, { season: ref.season, episode: ref.episode }));
    return list;
  }, [item, ref]);
  const active = servers[Math.min(srvIdx, Math.max(servers.length - 1, 0))] || null;
  useEffect(() => {
    if (!item || !servers.length) return;
    const pref = getPreferredServer(item.category);
    const idx = servers.findIndex((s) => s.id === pref);
    if (idx > 0) setSrvIdx(idx);
  }, [item?.id, servers.length]);
  const pickServer = (i) => { setSrvIdx(i); setDirect(null); setEmbedMain(null); if (item && servers[i]) setPreferredServer(item.category, servers[i].id); };

  const epLabel = useMemo(() => {
    if (!item || !ref) return '';
    if (item.category === 'anime') return `E${ref.episode}`;
    if (item.rawType === 'series' || item.episodes) return `S${ref.season}E${ref.episode}`;
    return '';
  }, [item, ref]);

  const queries = useMemo(() => {
    if (!item) return {};
    const base = `${item.title} ${item.year || ''}`.trim();
    const epQ = item.category === 'anime' ? `${item.title} episode ${ref?.episode || 1}` : (item.episodes ? `${item.title} season ${ref?.season || 1} episode ${ref?.episode || 1}` : `${item.title} full movie`);
    return { trailer: `${base} official trailer`, episode: epQ };
  }, [item, ref]);

  // Stremio: HTTP-only by default; torrents only if user enabled them in Settings.
  useEffect(() => {
    if (!item?.imdbId) return;
    let dead = false;
    setSLoading(true);
    const isSeries = item.rawType === 'series' || item.category === 'series' || item.category === 'animation' || item.episodes;
    (async () => {
      try {
        const { streams: raw } = await fetchStremioStreams({
          type: isSeries ? 'series' : 'movie', imdbId: item.imdbId,
          season: ref?.season || 1, episode: ref?.episode || 1, addons: loadAddons(),
        });
        if (!dead) {
          const sorted = sortStreams(raw);
          setHttpFiles(sorted.filter((s) => s.kind === 'direct'));
          setTorrents(sorted.filter((s) => s.kind === 'torrent'));
        }
      } catch { /* panel shows empty state */ }
      if (!dead) setSLoading(false);
    })();
    return () => { dead = true; };
  }, [item?.imdbId, ref?.season, ref?.episode]);

  // Lazy-load YouTube / Odysee when their tabs open.
  useEffect(() => {
    if (tab !== 'youtube' || !item || yt.length || ytLoading) return;
    let dead = false; setYtLoading(true);
    (async () => {
      try {
        const [a, b] = await Promise.all([youTubeSearch(queries.trailer, 6).catch(() => []), youTubeSearch(queries.episode, 6).catch(() => [])]);
        if (!dead) setYt([...a, ...b.filter((x) => !a.some((y) => y.videoId === x.videoId))]);
      } catch { /* empty */ }
      if (!dead) setYtLoading(false);
    })();
    return () => { dead = true; };
  }, [tab, item]);
  useEffect(() => {
    if (tab !== 'odysee' || !item || od.length || odLoading) return;
    let dead = false; setOdLoading(true);
    odyseeSearch(queries.episode, 12).then((r) => { if (!dead) setOd(r); }).catch(() => {}).finally(() => { if (!dead) setOdLoading(false); });
    return () => { dead = true; };
  }, [tab, item]);

  const gotoEp = (season, episode) => {
    setDirect(null); setEmbedMain(null); setSrvIdx(0); setYt([]); setOd([]);
    setSp((p) => {
      const n = new URLSearchParams(p);
      if (item.category === 'anime') { n.set('ep', String(episode)); n.delete('s'); n.delete('e'); }
      else { n.set('s', String(season)); n.set('e', String(episode)); n.delete('ep'); }
      return n;
    });
  };

  const playDirect = (url, label) => { setEmbedMain(null); setDirect({ url, label }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const playEmbed = (src, label) => { setDirect(null); setEmbedMain({ src, label }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const expandYt = async (v) => {
    if (ytFiles[v.videoId]) return;
    try {
      const files = await youTubeFiles(v.videoId);
      setYtFiles((m) => ({ ...m, [v.videoId]: files }));
      if (files[0]) setYtQuality((m) => ({ ...m, [v.videoId]: 0 }));
    } catch { setYtFiles((m) => ({ ...m, [v.videoId]: [] })); }
  };
  const doRumble = async () => {
    setRumbleErr('');
    try {
      const r = await rumbleEmbed(rumbleUrl.trim());
      playEmbed(r.embed, r.title);
    } catch { setRumbleErr('Could not embed that link. Paste a rumble.com video URL.'); }
  };

  if (err) return <div className="page"><h1>Not found</h1><p className="sub">{err}</p><Link to="/">← Home</Link></div>;
  if (!item || !ref) return <div className="page"><h1>Loading player…</h1><p className="sub">Resolving title + servers…</p></div>;

  const eps = item.category === 'anime'
    ? Array.from({ length: Math.min(item.episodesCount || 12, 60) }, (_, i) => ({ n: i + 1, title: `Episode ${i + 1}` }))
    : (item.episodes || []).map((e, i) => ({ s: e.season || 1, n: e.number ?? i + 1, title: e.title, thumb: e.thumb }));
  const dlName = safeName(`${item.title}-${epLabel || 'full'}`) + '.mp4';
  const isManga = item.category === 'manga';
  const tabs = isManga
    ? [['mkissa', '📚 MKissa']]
    : [['servers', 'Servers'], ['http', `HTTP Files${httpFiles.length ? ` (${httpFiles.length})` : ''}`], ['youtube', 'YouTube'], ['odysee', 'Odysee'], ['rumble', 'Rumble'], ['mkissa', 'MKissa']];

  return (
    <div className="watch-wrap">
      <div className="video-box">
        <Link to={`/title/${item.id}`} style={{ color: 'var(--mut)', fontSize: 14 }}>← Back to {item.title}</Link>
        <h2 style={{ margin: '10px 0 4px', fontSize: 24 }}>{item.title}{epLabel ? ` — ${epLabel}` : ''}</h2>
        <p style={{ color: 'var(--mut)', fontSize: 13, marginBottom: 14 }}>
          {item.category.toUpperCase()} • {item.year || ''} • {item.maturity} • {item.source === 'anilist' ? 'AniList' : item.source === 'tmdb' ? 'TMDB' : 'Demo'}
          {direct && ` • Playing: ${direct.label || 'direct file'}`}
          {embedMain && ` • Playing: ${embedMain.label || 'embed'}`}
        </p>

        {isManga ? (
          <div className="ep" style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <img src={item.poster} alt={item.title} style={{ width: 150, borderRadius: 10 }} />
            <div style={{ flex: 1 }}>
              <h5>📚 {item.chapters ? `${item.chapters} chapters` : 'Ongoing manga'}{item.volumes ? ` • ${item.volumes} volumes` : ''}</h5>
              <p>{(item.synopsis || '').slice(0, 220)}{item.synopsis?.length > 220 ? '…' : ''}</p>
              <div className="quality-row" style={{ marginTop: 10 }}>
                <a className="btn btn-grad btn-sm" href={mkSearchUrl('manga', item.title)} target="_blank" rel="noreferrer">📚 Read on MKissa</a>
                <a className="btn btn-ghost btn-sm" href={mkBrowseUrl('manga')} target="_blank" rel="noreferrer">Browse manga →</a>
                <a className="btn btn-ghost btn-sm" href={MK.app} target="_blank" rel="noreferrer">Get the app</a>
              </div>
            </div>
          </div>
        ) : direct ? (
          <video key={direct.url} className="player" controls autoPlay preload="metadata"
            onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) saveProgress(item.id, Math.round((v.currentTime / v.duration) * 100)); }}>
            <source src={direct.url} />
          </video>
        ) : embedMain ? (
          <iframe key={embedMain.src} src={embedMain.src} className="player" style={{ minHeight: 480, border: 'none' }} allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" title={embedMain.label || 'embed'} />
        ) : active?.demo ? (
          <video key={active.url} className="player" controls autoPlay preload="metadata"
            onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) saveProgress(item.id, Math.round((v.currentTime / v.duration) * 100)); }}>
            <source src={active.url} type="video/mp4" />
          </video>
        ) : active ? (
          <iframe key={active.url} src={active.url} className="player" style={{ minHeight: 480, border: 'none' }} allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" title={active.name} />
        ) : <div className="empty">No servers available for this title.</div>}

        {(direct) && (
          <div className="quality-row">
            <button className="btn btn-grad btn-sm" onClick={() => downloadUrl(direct.url, dlName)}>⬇ Download</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(direct.url)}>Copy link</button>
            <button className="chip" onClick={() => setDirect(null)}>✕ Close</button>
          </div>
        )}

        <div className="quality-row" style={{ marginTop: 16 }}>
          {tabs.map(([k, label]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>)}
        </div>

        {tab === 'servers' && (
          <div>
            <div className="quality-row">
              {servers.map((s, i) => (
                <button key={s.id} className={`chip ${i === Math.min(srvIdx, servers.length - 1) && !direct && !embedMain ? 'on' : ''}`}
                  onClick={() => pickServer(i)}>{s.name}{s.tag ? ` • ${s.tag}` : ''}</button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--mut)' }}>Your fastest server is remembered per category — switching teaches it. If one buffers, switch tabs. {active?.demo && <><button className="btn btn-grad btn-sm" style={{ marginLeft: 8 }} onClick={() => downloadUrl(active.url, dlName)}>⬇ Download sample</button></>}</p>
          </div>
        )}

        {tab === 'http' && (
          <div>
            {sLoading && <p className="sub">Querying HTTP file sources…</p>}
            {!sLoading && !httpFiles.length && <p className="sub">No direct HTTP files found for this {epLabel || 'title'} yet. Try Servers or YouTube tabs — or add a Debrid-backed Stremio addon in Settings for more HTTP links.</p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {httpFiles.slice(0, 30).map((s, i) => (
                <div key={i} className="ep" style={{ cursor: 'default' }}>
                  <div style={{ flex: 1 }}>
                    <h5><span className="pill" style={{ marginRight: 8 }}>{s.quality}</span>{s.name} <span style={{ color: 'var(--mut)', fontWeight: 400 }}>• {s.addonName}</span></h5>
                    <p>{s.detail}{s.size ? ` • ${s.size}` : ''}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-grad btn-sm" onClick={() => playDirect(s.url, `${s.quality} • ${s.addonName}`)}>▶ Play</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadUrl(s.url, dlName)}>⬇</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(s.url)}>Copy</button>
                  </div>
                </div>
              ))}
            </div>
            {showTorrents() && torrents.length > 0 && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--mut)', fontSize: 13 }}>Torrent/magnet sources ({torrents.length}) — needs torrent client</summary>
                <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                  {torrents.slice(0, 15).map((s, i) => (
                    <div key={i} className="ep" style={{ cursor: 'default' }}>
                      <div style={{ flex: 1 }}><h5><span className="pill" style={{ marginRight: 8 }}>{s.quality}</span>{s.name}</h5><p>{s.detail}{s.size ? ` • ${s.size}` : ''}{s.seeders ? ` • 👤 ${s.seeders}` : ''}</p></div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(s.magnet)}>Copy magnet</button>
                        <a className="btn btn-ghost btn-sm" href={s.magnet}>Open</a>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {tab === 'youtube' && (
          <div>
            {ytLoading && <p className="sub">Searching YouTube (trailers + episodes)…</p>}
            {!ytLoading && !yt.length && <p className="sub">YouTube API unreachable right now. <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(queries.episode)}`} target="_blank" rel="noreferrer">Search YouTube directly →</a></p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {yt.map((v) => (
                <div key={v.videoId} className="ep" style={{ cursor: 'default' }}>
                  <img src={v.thumb} alt="" style={{ width: 150 }} />
                  <div style={{ flex: 1 }}>
                    <h5>{v.title}</h5><p>{v.author}{v.length ? ` • ${v.length}` : ''}{v.views ? ` • ${v.views} views` : ''}</p>
                    {ytFiles[v.videoId]?.length > 0 && (
                      <div className="quality-row" style={{ margin: '8px 0 0' }}>
                        {ytFiles[v.videoId].map((f, i) => (
                          <button key={f.key} className={`chip ${ytQuality[v.videoId] === i ? 'on' : ''}`} onClick={() => setYtQuality((m) => ({ ...m, [v.videoId]: i }))}>{f.quality} • {f.container}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!ytFiles[v.videoId] && <button className="btn btn-ghost btn-sm" onClick={() => expandYt(v)}>Qualities</button>}
                    {ytFiles[v.videoId]?.length > 0 && <>
                      <button className="btn btn-grad btn-sm" onClick={() => { const f = ytFiles[v.videoId][ytQuality[v.videoId] || 0]; playDirect(f.url, `YouTube ${f.quality}`); }}>▶ Play</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { const f = ytFiles[v.videoId][ytQuality[v.videoId] || 0]; downloadUrl(f.url, dlName); }}>⬇</button>
                    </>}
                    <a className="btn btn-ghost btn-sm" href={v.watchUrl} target="_blank" rel="noreferrer">YouTube</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'odysee' && (
          <div>
            {odLoading && <p className="sub">Searching Odysee…</p>}
            {!odLoading && !od.length && <p className="sub">No Odysee uploads found for this query. <a href={`https://odysee.com/$/search?q=${encodeURIComponent(queries.episode)}`} target="_blank" rel="noreferrer">Search Odysee directly →</a></p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {od.map((o) => (
                <div key={o.claimId} className="ep" style={{ cursor: 'default' }}>
                  <div style={{ flex: 1 }}><h5>▶ {o.title}</h5><p>odysee.com • {o.name}</p></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-grad btn-sm" onClick={() => playEmbed(o.embed, o.title)}>▶ Watch</button>
                    <a className="btn btn-ghost btn-sm" href={o.page} target="_blank" rel="noreferrer">Odysee</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'rumble' && (
          <div>
            <p className="sub">Rumble has no public search API, so open a pre-filled search or paste any Rumble video link to embed it here.</p>
            <div className="quality-row">
              <a className="btn btn-ghost btn-sm" href={rumbleSearchUrl(queries.trailer)} target="_blank" rel="noreferrer">🔍 Trailer search →</a>
              <a className="btn btn-ghost btn-sm" href={rumbleSearchUrl(queries.episode)} target="_blank" rel="noreferrer">🔍 Episode search →</a>
            </div>
            <div className="field" style={{ marginTop: 12 }}><label>Paste Rumble video URL to play it here</label><input value={rumbleUrl} onChange={(e) => setRumbleUrl(e.target.value)} placeholder="https://rumble.com/v...-....html" /></div>
            <button className="btn btn-grad btn-sm" onClick={doRumble}>▶ Embed & play</button>
            {rumbleErr && <p className="sub" style={{ marginTop: 8 }}>{rumbleErr}</p>}
          </div>
        )}

        {tab === 'mkissa' && (
          <div>
            <p className="sub">MKissa (mkissa.to) hosts free anime + manga with a mobile app. Its data API is private, so StreamieFine hands off with exact deep links.</p>
            <div className="quality-row">
              <a className="btn btn-grad btn-sm" href={mkSearchUrl(isManga ? 'manga' : 'anime', item.title)} target="_blank" rel="noreferrer">{isManga ? '📚 Read this manga →' : '▶ Watch this anime →'}</a>
              <a className="btn btn-ghost btn-sm" href={mkBrowseUrl(isManga ? 'manga' : 'anime')} target="_blank" rel="noreferrer">Browse MKissa →</a>
              <a className="btn btn-ghost btn-sm" href={MK.app} target="_blank" rel="noreferrer">Get the app</a>
            </div>
            {!isManga && <p className="sub" style={{ marginTop: 10 }}>Tip: on MKissa, anime episodes play through their FileLotion player with SUB/DUB options.</p>}
          </div>
        )}

        {!isManga && eps.length > 1 && (
          <div style={{ margin: '26px 0' }}>
            <h4 style={{ marginBottom: 10 }}>Episodes ({eps.length})</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 180, overflowY: 'auto' }}>
              {eps.map((e, i) => {
                const on = item.category === 'anime' ? e.n === ref.episode : e.s === ref.season && e.n === ref.episode;
                return <button key={i} className={`chip ${on ? 'on' : ''}`} onClick={() => gotoEp(e.s || 1, e.n)}>{item.category === 'anime' ? `E${e.n}` : `S${e.s} E${e.n}`}</button>;
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 8 }}>
          <Link to="/settings" style={{ fontSize: 13, color: 'var(--mut)' }}>⚙ Manage addons & sources →</Link>
          {item.trailerYt && <a href={`https://www.youtube.com/watch?v=${item.trailerYt}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>▶ Trailer</a>}
        </div>
      </div>
    </div>
  );
}
