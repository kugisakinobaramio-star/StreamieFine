// MKissa (mkissa.to) — manga + anime site with mobile app.
export const MK = {
  site: 'https://mkissa.to',
  app: 'https://play.google.com/store/apps/details?id=com.mkissa.animemanga',
};
export const mkSearchUrl = (format, query) =>
  `${MK.site}/search/${format === 'manga' ? 'manga' : 'anime'}?query=${encodeURIComponent(query)}`;
export const mkBrowseUrl = (format) => `${MK.site}/${format === 'manga' ? 'manga' : 'anime'}`;