import { Link } from 'react-router-dom';
import { BrandMark } from '../common/BrandMark';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#08090C] pb-24 pt-12 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <div className="max-w-md">
            <BrandMark />
            <p className="mt-3 text-sm leading-relaxed text-[#9aa2b1]">
              Cinematic anime discovery and multi-provider streaming. Metadata sourced from
              AniList; watchlist, watch history, and playback progress are saved locally in
              your browser.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#9aa2b1]">
            <Link to="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <Link to="/discover" className="transition-colors hover:text-white">
              Discover
            </Link>
            <Link to="/movies" className="transition-colors hover:text-white">
              Movies
            </Link>
            <Link to="/watchlist" className="transition-colors hover:text-white">
              Watchlist
            </Link>
            <Link to="/history" className="transition-colors hover:text-white">
              History
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-white/[0.06] pt-6 text-xs text-[#687080] sm:flex-row">
          <p>ANIVEXA Streaming Platform</p>
          <p>Local browser persistence enabled · No account required</p>
        </div>
      </div>
    </footer>
  );
}
