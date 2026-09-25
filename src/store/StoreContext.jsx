import { createContext, useContext, useEffect, useState } from 'react';
import { getById } from '../data/catalog';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_user')) || null; } catch { return null; }
  });
  const [myList, setMyList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_list')) || []; } catch { return []; }
  });
  const [progress, setProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_prog')) || {}; } catch { return {}; }
  });
  const [snaps, setSnaps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_snaps')) || {}; } catch { return {}; }
  });
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_prefs')) || { genres: [], cats: [] }; } catch { return { genres: [], cats: [] }; }
  });

  useEffect(() => { localStorage.setItem('sf_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('sf_list', JSON.stringify(myList)); }, [myList]);
  useEffect(() => { localStorage.setItem('sf_prog', JSON.stringify(progress)); }, [progress]);
  useEffect(() => { try { localStorage.setItem('sf_snaps', JSON.stringify(snaps)); } catch { /* quota */ } }, [snaps]);
  useEffect(() => { try { localStorage.setItem('sf_prefs', JSON.stringify(prefs)); } catch { /* quota */ } }, [prefs]);

  const toggleList = (id, snap) => {
    setMyList((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    if (snap) setSnaps((m) => ({ ...m, [id]: snap }));
  };
  const lookup = (id) => snaps[id] || getById(id);
  const saveProgress = (id, pct) => setProgress((p) => ({ ...p, [id]: pct }));
  const login = (name) => setUser({ name });
  const logout = () => setUser(null);

  return <Ctx.Provider value={{ user, login, logout, myList, toggleList, progress, saveProgress, lookup, prefs, setPrefs }}>{children}</Ctx.Provider>;
}
