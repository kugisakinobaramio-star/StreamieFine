// MKissa (mkissa.to) — manga + anime site with mobile app.
// Their data API is locked (Cloudflare + private persisted queries), so we
// integrate via exact deep links (verified route shapes) + handoff.
export const MK = {
  site: 'https://mkissa.to',
  app: 'https://play.google.com/store/apps/details?id=com.mkissa.animemanga',
};
export const mkSearchUrl = (format, query) =>
  `${MK.site}/search/${format === 'manga' ? 'manga' : 'anime'}?query=${encodeURIComponent(query)}`;
export const mkBrowseUrl = (format) => `${MK.site}/${format === 'manga' ? 'manga' : 'anime'}`;