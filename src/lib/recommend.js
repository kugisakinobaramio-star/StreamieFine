// Personalization engine: learns taste from watchlist + watch progress +
// explicit genre picks, then scores unseen titles.
export function buildProfile(items, prefs = { genres: [], cats: [] }) {
  const genres = {}, cats = {};
  for (const t of items) {
    if (!t) continue;
    for (const g of t.genres || []) genres[g] = (genres[g] || 0) + 1;
    if (t.category) cats[t.category] = (cats[t.category] || 0) + 1;
  }
  for (const g of prefs.genres || []) genres[g] = (genres[g] || 0) + 2;
  for (const c of prefs.cats || []) cats[c] = (cats[c] || 0) + 2;
  const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]);
  const topCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  return { genres, cats, topGenres, topCats };
}
function score(t, profile) {
  let s = 0;
  for (const g of t.genres || []) s += (profile.genres[g] || 0) * 2;
  s += (profile.cats[t.category] || 0) * 1.5;
  s += (t.rating || 6) / 10;
  return s;
}
export function recommend(pool, history, profile, n = 12) {
  const seen = new Set(history.map((t) => t?.id));
  return pool.filter((t) => t && !seen.has(t.id)).map((t) => {
    const shared = (t.genres || []).filter((g) => profile.genres[g]).slice(0, 2);
    return { item: t, score: score(t, profile), reason: shared.length ? shared.join(' • ') : (t.category || '') };
  }).sort((a, b) => b.score - a.score).slice(0, n);
}
export function similarTo(item, pool, n = 10) {
  if (!item) return [];
  const gs = new Set(item.genres || []);
  return pool.filter((t) => t && t.id !== item.id && t.category === item.category)
    .map((t) => ({ item: t, overlap: (t.genres || []).filter((g) => gs.has(g)).length, rating: t.rating || 0 }))
    .filter((x) => x.overlap > 0).sort((a, b) => b.overlap - a.overlap || b.rating - a.rating)
    .slice(0, n).map((x) => x.item);
}