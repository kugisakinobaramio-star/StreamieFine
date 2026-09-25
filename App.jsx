import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './StoreContextStoreContext';
import { Navbar, Footer } from './ui';
import Home from './Home';
import Browse from './Browse';
import TitleDetails from './TitleDetails';
import Watch from './Watch';
import { MyList, Search, Login, Settings } from './Misc';
export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse/:category" element={<Browse />} />
          <Route path="/title/:id" element={<TitleDetails />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/mylist" element={<MyList />} />
          <Route path="/search" element={<Search />} />
          <Route path="/login" element={<Login />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<div className="page"><h1>404</h1><p className="sub">Page not found.</p></div>} />
        </Routes>
        <Footer />
      </HashRouter>
    </StoreProvider>
  );
}
