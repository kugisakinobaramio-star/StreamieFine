# StreamieFine — Anime, Movies, Series & Animation Streaming Platform

A Netflix-style streaming web app with 4 content verticals: **Anime, Movies, TV Series, Animation**.

## Features
- Home with auto-rotating hero, trending rail, category tiles, Continue Watching
- Dedicated browse pages per category with genre filter + sorting (rating / newest / A-Z)
- Title details pages with episodes (series/anime), cast, related titles
- Working video player page with episode selector + quality selector, progress saved to Continue Watching
- Search across titles, genres, categories
- My List (watchlist) + demo sign-in, all persisted in localStorage
- Responsive dark cinematic UI

## Run it
```sh
npm install
npm run dev
```
Open the printed local URL (default http://localhost:5173).

## Structure
- `src/data/catalog.js` — 24-title demo catalog (posters via picsum, playable sample MP4s)
- `src/store/StoreContext.jsx` — user, watchlist, progress state
- `src/components/ui.jsx` — Navbar, Hero, rows, cards, modal, footer
- `src/pages/` — Home, Browse, TitleDetails, Watch, Misc (MyList/Search/Login)

To add real streams: replace `video` URLs in `catalog.js` with your HLS/MP4 links, and `poster`/`backdrop` with real artwork.
## Live sources (no API keys)
- **Anime — AniList GraphQL** (`src/lib/anilist.js`): trending/popular/top/search + details, `https://graphql.anilist.co`, keyless.
- **Movies/Series/Animation — TMDB via Cinemeta** (`src/lib/cinemeta.js`): top catalogs + full meta incl. TMDB id (`moviedb_id`), IMDb id, episodes, posters — all TMDB-sourced images, no key.
- **Stremio streams** (`src/lib/stremio.js`): default Torrentio addon queried as `stream/movie/{imdb}` and `stream/series/{imdb}:{s}:{e}`; direct HTTP links play in-app, torrents show as magnets. Add your configured Torrentio/MediaFusion/Comet addon in **Settings → Stream Settings**.
- **Embed servers** (`src/lib/servers.js`): VidSrc XYZ / CC / TO, 2Embed, Smashy, EmbedSU for movies & series; SUB/DUB anime servers via AniList id. If one is down, switch tabs.

Run: `npm install && npm run dev`.

## HTTP providers (no torrents by default)
- **Embed servers** (`src/lib/servers.js`): VidSrc x3, 2Embed, Smashy, EmbedSU + anime SUB/DUB.
- **HTTP Files tab**: direct playable/downloadable files from Stremio addons (Debrid-backed addons give instant HTTP links).
- **YouTube tab** (`src/lib/httpStreams.js`): trailer/episode search + per-video quality picker via auto-rotating Invidious instances; direct play + download.
- **Odysee tab**: Lighthouse search + one-click embeds.
- **Rumble tab**: pre-filled search links + paste-any-Rumble-URL oEmbed player.
- Torrents hidden unless enabled in Settings → Stream Settings.
- **Watchlist** (`/mylist`): category filters, sorting, one-tap remove.

## MKissa (manga + anime) + Manga vertical
- New **Manga** category: live AniList manga (trending / top / search), details with chapter counts.
- **MKissa handoff** (`src/lib/mkissa.js`): exact deep links to mkissa.to anime/manga search + browse + Play-store app, on details pages, Watch MKissa tab, and manga panels.
- Note: MKissa's data API is private (Cloudflare + unpublished persisted queries), verified by bundle analysis — so integration is deep-link based, not scraped. If they publish an API, `mkissa.js` is the single place to wire it.

## Personalization (auto-suggestions)
- First visit asks your taste (categories + genres) → `sf_prefs`; editable in Settings.
- Engine (`src/lib/recommend.js`) scores unseen titles from watchlist + watch progress + taste.
- Home shows **Picked for you** + **Because you watched X** rails automatically.
- Watch remembers your fastest server per category (`sf_srv_*`) — switching teaches it, cutting buffering.
- All free sources, lazy images, API preconnects for speed.
