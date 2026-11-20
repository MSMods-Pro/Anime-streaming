import { useState } from 'react';
import { Film } from 'lucide-react';

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fallbackTitle?: string;
  aspectClassName?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  loading = 'lazy',
  fallbackTitle,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#141821] via-[#10131a] to-[#0b0d12] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Film className="mb-2 h-6 w-6 text-[#687080]" aria-hidden="true" />
        {fallbackTitle && (
          <span className="line-clamp-2 text-xs font-medium text-[#9aa2b1]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`${className} transition-opacity duration-300 ${
        loaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
