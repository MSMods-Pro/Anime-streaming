import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bookmark, Clock, Compass, Film, Home, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { BrandMark } from '../common/BrandMark';

interface NavbarProps {
  onOpenSearch: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/discover', label: 'Discover', icon: Compass, end: false },
  { to: '/movies', label: 'Movies', icon: Film, end: false },
  { to: '/watchlist', label: 'Watchlist', icon: Bookmark, end: false },
  { to: '/history', label: 'History', icon: Clock, end: false },
] as const;

export function Navbar({ onOpenSearch }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isWatchRoute = location.pathname.startsWith('/watch');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Desktop & Mobile Top Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-200 ${
          scrolled || isWatchRoute
            ? 'border-b border-white/[0.08] bg-[#08090C]/90 backdrop-blur-md'
            : 'bg-gradient-to-b from-[#08090C]/85 via-[#08090C]/45 to-transparent'
        }`}
      >
        <div className="mx-auto flex h-12 md:h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="rounded-lg py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5383B]"
            aria-label="ANIVEXA Home"
          >
            <BrandMark />
          </Link>

          {/* Zone 2: Desktop Single-Line Navigation Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5383B] rounded ${
                    isActive
                      ? 'text-white'
                      : 'text-[#9aa2b1] hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="anivexa-nav-underline"
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[#E5383B]"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action (Global Search Trigger) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Open Search"
              className="inline-flex min-h-[40px] items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 md:px-4 py-1.5 text-sm font-medium text-[#F4F5F7] transition-colors hover:border-white/20 hover:bg-white/[0.09] whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5383B]"
            >
              <Search className="h-4 w-4 text-[#9aa2b1]" aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden lg:inline-block font-mono-tabular text-[11px] text-[#687080]">
                /
              </kbd>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Compact 56px height to keep sticky footprint minimal) */}
      {!isWatchRoute && (
        <nav
          aria-label="Mobile navigation"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#08090C]/95 backdrop-blur-md pb-safe md:hidden"
        >
          <div className="grid h-14 grid-cols-5 items-center">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                      isActive ? 'text-[#E5383B]' : 'text-[#9aa2b1]'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium tracking-tight">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
