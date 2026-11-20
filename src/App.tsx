import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Navbar } from './components/layout/Navbar';
import { SearchOverlay } from './components/layout/SearchOverlay';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MoviesPage } from './pages/MoviesPage';
import { AnimeDetailPage } from './pages/AnimeDetailPage';
import { WatchPage } from './pages/WatchPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { HistoryPage } from './pages/HistoryPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard shortcut (`/` or `Cmd+K` / `Ctrl+K`) to open Search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (!inInput && e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090C] text-[#F4F5F7]">
      <ScrollToTop />
      <Navbar onOpenSearch={() => setSearchOpen(true)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/anime/:id" element={<AnimeDetailPage />} />
            <Route path="/watch/:id" element={<WatchPage />} />
            <Route path="/watch/:id/:ep" element={<WatchPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </MotionConfig>
  );
}
