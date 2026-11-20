import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertCircle,
  Captions,
  Check,
  ExternalLink,
  FastForward,
  Keyboard,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AudioType,
  NormalizedStream,
  NormalizedSubtitle,
  ProviderName,
} from '../../types/anivexa';
import { PROVIDER_LABELS } from '../../services/anivexa';
import type { PlayerPreferences } from '../../types/user';
import { formatTimecode } from '../../utils/format';
import { getActiveSubtitleCues, parseWebVtt, type SubtitleCue } from '../../utils/subtitles';

interface AnivexaPlayerProps {
  animeTitle: string;
  episodeNumber: number;
  episodeTitle?: string | null;
  provider: ProviderName;
  audio: AudioType;
  streams: NormalizedStream[];
  activeStreamIndex: number;
  onSelectStreamIndex: (idx: number) => void;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  initialTime?: number;
  hasPrevEpisode: boolean;
  hasNextEpisode: boolean;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  onProgressUpdate: (position: number, duration: number) => void;
  onEnded?: () => void;
  loadingSource: boolean;
  sourceError: string | null;
  onRetrySource: () => void;
  prefs: PlayerPreferences;
  onUpdatePrefs: (patch: Partial<PlayerPreferences>) => void;
}

interface QualityOption {
  index: number;
  label: string;
}

interface HlsAudioOption {
  index: number;
  label: string;
}

export function AnivexaPlayer({
  animeTitle,
  episodeNumber,
  episodeTitle,
  provider,
  audio,
  streams,
  activeStreamIndex,
  onSelectStreamIndex,
  intro,
  outro,
  initialTime = 0,
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
  onProgressUpdate,
  onEnded,
  loadingSource,
  sourceError,
  onRetrySource,
  prefs,
  onUpdatePrefs,
}: AnivexaPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' | 'center' }>({
    time: 0,
    side: 'center',
  });
  const appliedInitialTimeRef = useRef<string>('');
  const progressThrottleRef = useRef<number>(0);

  const activeStream = streams[activeStreamIndex] ?? null;

  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverSeek, setHoverSeek] = useState<{ ratio: number; time: number } | null>(null);
  const [isHoldSpeed, setIsHoldSpeed] = useState(false);
  const [seekFeedback, setSeekFeedback] = useState<{
    dir: 'back' | 'forward';
    seconds: number;
    key: number;
  } | null>(null);
  const [activeMenu, setActiveMenu] = useState<
    'none' | 'settings' | 'subtitles' | 'shortcuts'
  >('none');

  // HLS levels & audio tracks
  const [qualityLevels, setQualityLevels] = useState<QualityOption[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [hlsAudioTracks, setHlsAudioTracks] = useState<HlsAudioOption[]>([]);
  const [currentHlsAudio, setCurrentHlsAudio] = useState<number>(-1);

  // Subtitles state
  const [selectedSubId, setSelectedSubId] = useState<string>('off');
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);

  // Reset embed fallback & errors when stream changes
  useEffect(() => {
    setUseEmbedFallback(false);
    setPlaybackError(null);
    setQualityLevels([]);
    setCurrentQuality(-1);
    setHlsAudioTracks([]);
    setCurrentHlsAudio(-1);
    setSubtitleOffset(0);
  }, [activeStream?.id]);

  // Auto-select default subtitle track when stream changes
  useEffect(() => {
    const subs = activeStream?.subtitles ?? [];
    if (subs.length === 0) {
      setSelectedSubId('off');
      setSubtitleCues([]);
      return;
    }
    const def =
      subs.find((s) => s.isDefault) ||
      subs.find((s) => s.lang.startsWith('en') || s.label.toLowerCase().includes('english')) ||
      subs[0];
    setSelectedSubId(def ? def.id : 'off');
  }, [activeStream]);

  // Fetch & parse selected external subtitle track
  useEffect(() => {
    if (!activeStream || selectedSubId === 'off') {
      setSubtitleCues([]);
      setSubtitleError(null);
      return;
    }

    const track: NormalizedSubtitle | undefined = activeStream.subtitles.find(
      (s) => s.id === selectedSubId
    );
    if (!track) {
      setSubtitleCues([]);
      return;
    }

    const controller = new AbortController();
    setSubtitleError(null);

    fetch(track.proxyUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setSubtitleCues(parseWebVtt(text));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSubtitleCues([]);
        setSubtitleError('Failed to load subtitle track');
      });

    return () => controller.abort();
  }, [activeStream, selectedSubId]);

  const activeCaptionLines = useMemo(() => {
    if (selectedSubId === 'off' || subtitleCues.length === 0) return [];
    return getActiveSubtitleCues(subtitleCues, currentTime, subtitleOffset);
  }, [selectedSubId, subtitleCues, currentTime, subtitleOffset]);

  // Control visibility auto-hide
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (isPlaying && activeMenu === 'none') {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying, activeMenu]);

  useEffect(() => {
    if (!isPlaying || activeMenu !== 'none') {
      setControlsVisible(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    } else {
      showControlsTemporarily();
    }
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, activeMenu, showControlsTemporarily]);

  // Initialize video / HLS.js playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStream) return;
    if (activeStream.kind === 'embed' || useEmbedFallback) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    let cancelled = false;
    setPlaybackError(null);
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamKey = `${provider}-${episodeNumber}-${activeStream.id}`;

    const applySavedPosition = () => {
      if (
        initialTime > 5 &&
        appliedInitialTimeRef.current !== streamKey &&
        Number.isFinite(video.duration) &&
        initialTime < video.duration - 5
      ) {
        video.currentTime = initialTime;
        appliedInitialTimeRef.current = streamKey;
      }
    };

    video.volume = prefs.volume;
    video.muted = prefs.muted;
    video.playbackRate = isHoldSpeed ? 2 : prefs.playbackSpeed;

    if (activeStream.kind === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60,
        });
        hlsRef.current = hls;

        hls.loadSource(activeStream.playbackUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
          if (cancelled) return;
          const levels: QualityOption[] = data.levels.map((lvl, idx) => ({
            index: idx,
            label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
          }));
          setQualityLevels(levels);
          setCurrentQuality(-1);

          if (hls.audioTracks?.length > 1) {
            setHlsAudioTracks(
              hls.audioTracks.map((t, idx) => ({
                index: idx,
                label: t.name || t.lang || `Audio ${idx + 1}`,
              }))
            );
            setCurrentHlsAudio(hls.audioTrack);
          }
          setIsBuffering(false);
          applySavedPosition();
          video.play().catch(() => {
            // Autoplay may be blocked by browser policy; user can click play
          });
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
          if (hls.audioTracks?.length > 1) {
            setHlsAudioTracks(
              hls.audioTracks.map((t, idx) => ({
                index: idx,
                label: t.name || t.lang || `Audio ${idx + 1}`,
              }))
            );
            setCurrentHlsAudio(hls.audioTrack);
          }
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (cancelled) return;
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              hls.destroy();
              setIsBuffering(false);
              if (activeStream.embedFallbackUrl) {
                setUseEmbedFallback(true);
              } else {
                setPlaybackError(
                  `Stream playback failed (${data.details || 'manifest error'}). Try switching server or provider.`
                );
              }
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = activeStream.playbackUrl;
        video.addEventListener('loadedmetadata', applySavedPosition, { once: true });
      } else {
        setPlaybackError('HLS playback is not supported in this browser.');
      }
    } else if (activeStream.kind === 'mp4') {
      video.src = activeStream.playbackUrl;
      video.addEventListener('loadedmetadata', applySavedPosition, { once: true });
      video.play().catch(() => {});
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeStream, useEmbedFallback, provider, episodeNumber]);

  // Sync prefs to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = prefs.volume;
    video.muted = prefs.muted;
  }, [prefs.volume, prefs.muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = isHoldSpeed ? 2 : prefs.playbackSpeed;
  }, [prefs.playbackSpeed, isHoldSpeed]);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
      video.currentTime = target;
      setCurrentTime(target);
      setSeekFeedback({
        dir: delta < 0 ? 'back' : 'forward',
        seconds: Math.abs(delta),
        key: Date.now(),
      });
      showControlsTemporarily();
    },
    [showControlsTemporarily]
  );

  const toggleMute = useCallback(() => {
    onUpdatePrefs({ muted: !prefs.muted });
  }, [prefs.muted, onUpdatePrefs]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen denied or unsupported
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP not supported for current state
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (activeStream?.kind === 'embed' || useEmbedFallback) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          seekBy(-prefs.seekSeconds);
          break;
        case 'arrowright':
          e.preventDefault();
          seekBy(prefs.seekSeconds);
          break;
        case 'j':
          e.preventDefault();
          seekBy(-10);
          break;
        case 'l':
          e.preventDefault();
          seekBy(10);
          break;
        case 'arrowup':
          e.preventDefault();
          onUpdatePrefs({ volume: Math.min(1, Number((prefs.volume + 0.1).toFixed(2))), muted: false });
          break;
        case 'arrowdown':
          e.preventDefault();
          onUpdatePrefs({ volume: Math.max(0, Number((prefs.volume - 0.1).toFixed(2))) });
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'c':
          e.preventDefault();
          if (activeStream?.subtitles.length) {
            setSelectedSubId((prev) =>
              prev === 'off' ? activeStream.subtitles[0].id : 'off'
            );
          }
          break;
        case 'n':
          if (hasNextEpisode) {
            e.preventDefault();
            onNextEpisode();
          }
          break;
        case 'p':
          if (hasPrevEpisode) {
            e.preventDefault();
            onPrevEpisode();
          }
          break;
        case '?':
          e.preventDefault();
          setActiveMenu((prev) => (prev === 'shortcuts' ? 'none' : 'shortcuts'));
          break;
        case 'escape':
          setActiveMenu('none');
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeStream,
    useEmbedFallback,
    togglePlay,
    seekBy,
    prefs.seekSeconds,
    prefs.volume,
    onUpdatePrefs,
    toggleMute,
    toggleFullscreen,
    hasNextEpisode,
    hasPrevEpisode,
    onNextEpisode,
    onPrevEpisode,
  ]);

  // Clear seek feedback banner automatically
  useEffect(() => {
    if (!seekFeedback) return;
    const t = window.setTimeout(() => setSeekFeedback(null), 650);
    return () => window.clearTimeout(t);
  }, [seekFeedback]);

  // Video surface touch/pointer handlers (double-tap seek + hold-to-2x)
  const handleSurfacePointerDown = () => {
    if (!isPlaying) return;
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      setIsHoldSpeed(true);
    }, 360);
  };

  const handleSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldSpeed) {
      setIsHoldSpeed(false);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const side: 'left' | 'right' | 'center' =
      relX < 0.3 ? 'left' : relX > 0.7 ? 'right' : 'center';

    const now = Date.now();
    if (
      now - lastTapRef.current.time < 280 &&
      lastTapRef.current.side === side &&
      side !== 'center'
    ) {
      seekBy(side === 'left' ? -prefs.seekSeconds : prefs.seekSeconds);
      lastTapRef.current = { time: 0, side: 'center' };
    } else {
      lastTapRef.current = { time: now, side };
      if (e.pointerType === 'mouse') {
        togglePlay();
      } else {
        // Touch: toggle controls visibility cleanly, or play if paused
        if (!isPlaying) togglePlay();
        else setControlsVisible((v) => !v);
      }
    }
  };

  const showSkipIntro =
    intro && currentTime >= intro.start && currentTime < intro.end - 1;
  const showSkipOutro =
    outro && currentTime >= outro.start && currentTime < outro.end - 1;

  const isEmbedMode = Boolean(
    activeStream && (activeStream.kind === 'embed' || useEmbedFallback)
  );
  const embedUrl =
    activeStream?.kind === 'embed'
      ? activeStream.playbackUrl
      : activeStream?.embedFallbackUrl || '';

  return (
    <div
      ref={containerRef}
      onMouseMove={showControlsTemporarily}
      className={`group/player relative w-full overflow-hidden rounded-xl border border-white/10 bg-black select-none ${
        isFullscreen ? 'h-screen rounded-none border-none' : 'aspect-video'
      }`}
    >
      {/* Loading State */}
      {loadingSource && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#08090C]/90 px-4 text-center">
          <Loader2 className="h-9 w-9 animate-spin text-[#E5383B]" />
          <p className="mt-3 text-sm font-medium text-white">
            Loading Episode {episodeNumber} from {PROVIDER_LABELS[provider]}
          </p>
        </div>
      )}

      {/* Source Error State */}
      {!loadingSource && sourceError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#08090C]/95 px-6 text-center">
          <AlertCircle className="h-9 w-9 text-[#E5383B]" />
          <p className="mt-3 font-display text-base font-semibold text-white">
            Unable to load stream from {PROVIDER_LABELS[provider]}
          </p>
          <p className="mt-1 max-w-md text-xs text-[#9aa2b1]">{sourceError}</p>
          <button
            type="button"
            onClick={onRetrySource}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#f0484b]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retry Provider</span>
          </button>
        </div>
      )}

      {/* No Streams State */}
      {!loadingSource && !sourceError && !activeStream && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#08090C] px-6 text-center">
          <p className="font-display text-base font-semibold text-white">
            No playable streams returned
          </p>
          <p className="mt-1 text-xs text-[#9aa2b1]">
            Select another provider or switch between SUB and DUB below.
          </p>
        </div>
      )}

      {/* External Iframe Embed Mode (Explicitly separated from direct video) */}
      {!loadingSource && !sourceError && activeStream && isEmbedMode && (
        <div className="relative h-full w-full bg-black">
          <div className="absolute left-3 top-3 z-20 rounded-md border border-white/15 bg-black/80 px-2.5 py-1 text-[11px] font-medium text-[#D1D5DB] backdrop-blur-sm">
            External Embed Player ({activeStream.server}) · Custom controls unavailable
          </div>
          <iframe
            src={embedUrl}
            title={`${animeTitle} Episode ${episodeNumber} Embed`}
            className="h-full w-full border-0"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Direct Custom Video Mode (HLS / MP4) */}
      {!loadingSource && !sourceError && activeStream && !isEmbedMode && (
        <>
          <video
            ref={videoRef}
            playsInline
            crossOrigin="anonymous"
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              setIsPlaying(false);
              if (videoRef.current) {
                onProgressUpdate(videoRef.current.currentTime, videoRef.current.duration);
              }
            }}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
            onCanPlay={() => setIsBuffering(false)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuration(v.duration || 0);
            }}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              setCurrentTime(v.currentTime);
              if (v.buffered.length > 0) {
                setBufferedEnd(v.buffered.end(v.buffered.length - 1));
              }
              const now = Date.now();
              if (now - progressThrottleRef.current > 4000) {
                progressThrottleRef.current = now;
                onProgressUpdate(v.currentTime, v.duration);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              if (videoRef.current) {
                onProgressUpdate(videoRef.current.duration, videoRef.current.duration);
              }
              onEnded?.();
            }}
            onError={() => {
              setIsBuffering(false);
              if (activeStream.embedFallbackUrl) {
                setUseEmbedFallback(true);
              } else {
                setPlaybackError('Video element encountered a playback error.');
              }
            }}
            className="h-full w-full bg-black object-contain"
          />

          {/* Interactive Gesture Overlay */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onPointerDown={handleSurfacePointerDown}
            onPointerUp={handleSurfacePointerUp}
            onPointerCancel={() => {
              if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
              setIsHoldSpeed(false);
            }}
          />

          {/* Buffering Indicator */}
          {isBuffering && !playbackError && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="rounded-full bg-black/65 p-3.5 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-[#E5383B]" />
              </div>
            </div>
          )}

          {/* Hold-to-2x Speed Badge */}
          {isHoldSpeed && (
            <div className="pointer-events-none absolute left-1/2 top-5 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-black/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <FastForward className="h-3.5 w-3.5 text-[#E5383B]" />
              <span>2x Speed</span>
            </div>
          )}

          {/* Double-tap / Double-click Seek Feedback */}
          {seekFeedback && (
            <div
              key={seekFeedback.key}
              className={`pointer-events-none absolute top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-black/75 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm ${
                seekFeedback.dir === 'back' ? 'left-8' : 'right-8'
              }`}
            >
              {seekFeedback.dir === 'back' ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              <span className="font-mono-tabular">
                {seekFeedback.dir === 'back' ? '-' : '+'}
                {seekFeedback.seconds}s
              </span>
            </div>
          )}

          {/* Playback Error Overlay */}
          {playbackError && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 px-6 text-center">
              <AlertCircle className="h-9 w-9 text-[#E5383B]" />
              <p className="mt-3 text-sm font-semibold text-white">{playbackError}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onRetrySource}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E5383B] px-4 py-2 text-xs font-medium text-white hover:bg-[#f0484b]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
                {streams.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onSelectStreamIndex((activeStreamIndex + 1) % streams.length)}
                    className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15"
                  >
                    Switch Server
                  </button>
                )}
                {activeStream.embedFallbackUrl && (
                  <button
                    type="button"
                    onClick={() => setUseEmbedFallback(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Use Embed Fallback</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Custom Synchronized Subtitle Overlay */}
          {activeCaptionLines.length > 0 && (
            <div
              className={`pointer-events-none absolute left-1/2 z-20 w-[90%] max-w-3xl -translate-x-1/2 text-center transition-all duration-200 ${
                controlsVisible ? 'bottom-20 sm:bottom-24' : 'bottom-6 sm:bottom-8'
              }`}
            >
              <div className="inline-block rounded bg-black/75 px-3 py-1.5 backdrop-blur-[2px]">
                {activeCaptionLines.map((line, i) => (
                  <p
                    key={i}
                    className={`whitespace-pre-line font-medium leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                      prefs.subtitleSize === 'sm'
                        ? 'text-xs sm:text-sm'
                        : prefs.subtitleSize === 'lg'
                        ? 'text-base sm:text-xl'
                        : 'text-sm sm:text-base'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Skip Intro / Outro Quick Action */}
          {(showSkipIntro || showSkipOutro) && (
            <button
              type="button"
              onClick={() => {
                if (!videoRef.current) return;
                if (showSkipIntro && intro) videoRef.current.currentTime = intro.end;
                else if (showSkipOutro && outro) videoRef.current.currentTime = outro.end;
              }}
              className="absolute bottom-20 right-4 z-20 rounded-lg border border-white/25 bg-black/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[#E5383B]"
            >
              {showSkipIntro ? 'Skip Intro' : 'Skip Outro'}
            </button>
          )}

          {/* Top Episode Info Bar (Auto-hides with controls) */}
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-4 pb-8 pt-3.5 transition-opacity duration-200 ${
              controlsVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-white">
                  {animeTitle}
                </p>
                <p className="truncate text-xs text-[#C4C9D4]">
                  Episode {episodeNumber}
                  {episodeTitle ? ` · ${episodeTitle}` : ''} · {audio.toUpperCase()}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-[#D1D5DB]">
                {PROVIDER_LABELS[provider]} · {activeStream.server}
              </span>
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div
            className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 pb-3 pt-10 transition-opacity duration-200 sm:px-4 ${
              controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Seek Scrubber */}
            <div
              className="group/seek relative mb-2.5 flex h-5 cursor-pointer items-center"
              onMouseMove={(e) => {
                if (!duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverSeek({ ratio, time: ratio * duration });
              }}
              onMouseLeave={() => setHoverSeek(null)}
              onClick={(e) => {
                if (!videoRef.current || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                videoRef.current.currentTime = ratio * duration;
                setCurrentTime(ratio * duration);
              }}
            >
              {hoverSeek && (
                <div
                  style={{ left: `${hoverSeek.ratio * 100}%` }}
                  className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-2 py-0.5 font-mono-tabular text-[11px] text-white"
                >
                  {formatTimecode(hoverSeek.time)}
                </div>
              )}

              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-all group-hover/seek:h-1.5">
                {/* Buffered */}
                <div
                  style={{
                    width: `${duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0}%`,
                  }}
                  className="absolute inset-y-0 left-0 bg-white/35"
                />
                {/* Played */}
                <div
                  style={{
                    width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                  }}
                  className="absolute inset-y-0 left-0 bg-[#E5383B]"
                />
              </div>
            </div>

            {/* Control Buttons Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onPrevEpisode}
                  disabled={!hasPrevEpisode}
                  aria-label="Previous Episode"
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35"
                >
                  <SkipBack className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onNextEpisode}
                  disabled={!hasNextEpisode}
                  aria-label="Next Episode"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35"
                >
                  <SkipForward className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(-prefs.seekSeconds)}
                  aria-label={`Seek backward ${prefs.seekSeconds} seconds`}
                  className="hidden md:flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-mono-tabular text-white/85 hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{prefs.seekSeconds}</span>
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(prefs.seekSeconds)}
                  aria-label={`Seek forward ${prefs.seekSeconds} seconds`}
                  className="hidden md:flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-mono-tabular text-white/85 hover:bg-white/10"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>{prefs.seekSeconds}</span>
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={prefs.muted || prefs.volume === 0 ? 'Unmute' : 'Mute'}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
                  >
                    {prefs.muted || prefs.volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={prefs.muted ? 0 : prefs.volume}
                    aria-label="Volume"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdatePrefs({ volume: val, muted: val === 0 });
                    }}
                    className="hidden sm:block h-1 w-16 cursor-pointer accent-[#E5383B]"
                  />
                </div>

                {/* Timecode */}
                <div className="ml-1 font-mono-tabular text-xs text-white/90">
                  <span>{formatTimecode(currentTime)}</span>
                  <span className="mx-1 text-white/45">/</span>
                  <span className="text-white/65">{formatTimecode(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Subtitles Menu */}
                {activeStream.subtitles.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMenu((prev) => (prev === 'subtitles' ? 'none' : 'subtitles'))
                    }
                    aria-label="Subtitles"
                    className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-white/10 ${
                      selectedSubId !== 'off' ? 'text-[#E5383B]' : 'text-white/85'
                    }`}
                  >
                    <Captions className="h-4 w-4" />
                    <span className="hidden md:inline">CC</span>
                  </button>
                )}

                {/* Keyboard Shortcuts Guide */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveMenu((prev) => (prev === 'shortcuts' ? 'none' : 'shortcuts'))
                  }
                  aria-label="Keyboard shortcuts"
                  className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-white/85 hover:bg-white/10"
                >
                  <Keyboard className="h-4 w-4" />
                </button>

                {/* Settings Menu (Quality, Speed, Audio, Seek interval) */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveMenu((prev) => (prev === 'settings' ? 'none' : 'settings'))
                  }
                  aria-label="Player settings"
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10 ${
                    activeMenu === 'settings' ? 'text-[#E5383B]' : 'text-white/90'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                </button>

                {/* Picture-in-Picture */}
                {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
                  <button
                    type="button"
                    onClick={togglePiP}
                    aria-label="Picture in Picture"
                    className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
                  >
                    <PictureInPicture2 className="h-4 w-4" />
                  </button>
                )}

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Popover: Subtitles */}
          {activeMenu === 'subtitles' && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-16 right-4 z-30 w-72 max-h-[70%] overflow-y-auto rounded-xl border border-white/15 bg-[#10131A]/95 p-3.5 text-xs shadow-2xl backdrop-blur-md"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-sm font-semibold text-white">Subtitles</span>
                {subtitleError && <span className="text-[#E5383B]">{subtitleError}</span>}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubId('off');
                    setActiveMenu('none');
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                    selectedSubId === 'off'
                      ? 'bg-white/10 text-white'
                      : 'text-[#9aa2b1] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>Off</span>
                  {selectedSubId === 'off' && <Check className="h-3.5 w-3.5 text-[#E5383B]" />}
                </button>

                {activeStream.subtitles.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubId(sub.id);
                      setActiveMenu('none');
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                      selectedSubId === sub.id
                        ? 'bg-white/10 text-white'
                        : 'text-[#9aa2b1] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-2">{sub.label}</span>
                    {selectedSubId === sub.id && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#E5383B]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Subtitle Size & Sync */}
              <div className="mt-3 border-t border-white/10 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#9aa2b1]">Size</span>
                  <div className="flex gap-1">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => onUpdatePrefs({ subtitleSize: sz })}
                        className={`rounded px-2 py-1 uppercase ${
                          prefs.subtitleSize === sz
                            ? 'bg-[#E5383B] text-white'
                            : 'bg-white/5 text-[#9aa2b1] hover:text-white'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#9aa2b1]">Timing Offset</span>
                  <div className="flex items-center gap-1.5 font-mono-tabular">
                    <button
                      type="button"
                      onClick={() =>
                        setSubtitleOffset((o) => Number((o - 0.5).toFixed(1)))
                      }
                      className="rounded bg-white/5 px-2 py-0.5 text-white hover:bg-white/15"
                    >
                      -0.5s
                    </button>
                    <span className="min-w-[44px] text-center text-white">
                      {subtitleOffset > 0 ? `+${subtitleOffset}` : subtitleOffset}s
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSubtitleOffset((o) => Number((o + 0.5).toFixed(1)))
                      }
                      className="rounded bg-white/5 px-2 py-0.5 text-white hover:bg-white/15"
                    >
                      +0.5s
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Popover: Settings */}
          {activeMenu === 'settings' && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-16 right-4 z-30 w-72 max-h-[70%] overflow-y-auto rounded-xl border border-white/15 bg-[#10131A]/95 p-3.5 text-xs shadow-2xl backdrop-blur-md space-y-3"
            >
              <div>
                <p className="mb-1.5 font-medium text-[#9aa2b1]">Playback Speed</p>
                <div className="grid grid-cols-3 gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => onUpdatePrefs({ playbackSpeed: spd })}
                      className={`rounded-md py-1.5 font-mono-tabular transition-colors ${
                        prefs.playbackSpeed === spd
                          ? 'bg-[#E5383B] text-white'
                          : 'bg-white/5 text-[#D1D5DB] hover:bg-white/10'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {qualityLevels.length > 0 && (
                <div className="border-t border-white/10 pt-3">
                  <p className="mb-1.5 font-medium text-[#9aa2b1]">Video Quality</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (hlsRef.current) hlsRef.current.currentLevel = -1;
                        setCurrentQuality(-1);
                      }}
                      className={`rounded-md px-2.5 py-1.5 ${
                        currentQuality === -1
                          ? 'bg-[#E5383B] text-white'
                          : 'bg-white/5 text-[#D1D5DB] hover:bg-white/10'
                      }`}
                    >
                      Auto
                    </button>
                    {qualityLevels.map((lvl) => (
                      <button
                        key={lvl.index}
                        type="button"
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.currentLevel = lvl.index;
                          setCurrentQuality(lvl.index);
                        }}
                        className={`rounded-md px-2.5 py-1.5 font-mono-tabular ${
                          currentQuality === lvl.index
                            ? 'bg-[#E5383B] text-white'
                            : 'bg-white/5 text-[#D1D5DB] hover:bg-white/10'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hlsAudioTracks.length > 1 && (
                <div className="border-t border-white/10 pt-3">
                  <p className="mb-1.5 font-medium text-[#9aa2b1]">Audio Track</p>
                  <div className="space-y-1">
                    {hlsAudioTracks.map((tr) => (
                      <button
                        key={tr.index}
                        type="button"
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.audioTrack = tr.index;
                          setCurrentHlsAudio(tr.index);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left ${
                          currentHlsAudio === tr.index
                            ? 'bg-white/10 text-white'
                            : 'text-[#9aa2b1] hover:bg-white/5'
                        }`}
                      >
                        <span>{tr.label}</span>
                        {currentHlsAudio === tr.index && (
                          <Check className="h-3.5 w-3.5 text-[#E5383B]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-white/10 pt-3">
                <p className="mb-1.5 font-medium text-[#9aa2b1]">Seek Interval</p>
                <div className="grid grid-cols-4 gap-1">
                  {[5, 10, 15, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onUpdatePrefs({ seekSeconds: sec })}
                      className={`rounded-md py-1.5 font-mono-tabular ${
                        prefs.seekSeconds === sec
                          ? 'bg-[#E5383B] text-white'
                          : 'bg-white/5 text-[#D1D5DB] hover:bg-white/10'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-[#D1D5DB]">Auto-Next Episode</span>
                <button
                  type="button"
                  onClick={() => onUpdatePrefs({ autoNext: !prefs.autoNext })}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    prefs.autoNext
                      ? 'bg-[#E5383B] text-white'
                      : 'bg-white/10 text-[#9aa2b1]'
                  }`}
                >
                  {prefs.autoNext ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          )}

          {/* Popover: Keyboard Shortcuts */}
          {activeMenu === 'shortcuts' && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-16 right-4 z-30 w-72 rounded-xl border border-white/15 bg-[#10131A]/95 p-4 text-xs shadow-2xl backdrop-blur-md"
            >
              <p className="mb-2.5 font-display text-sm font-semibold text-white">
                Keyboard Shortcuts
              </p>
              <div className="space-y-1.5 text-[#C4C9D4]">
                <div className="flex justify-between">
                  <span>Play / Pause</span>
                  <kbd className="font-mono-tabular text-white">Space / K</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Seek ±{prefs.seekSeconds}s</span>
                  <kbd className="font-mono-tabular text-white">← / →</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Seek ±10s</span>
                  <kbd className="font-mono-tabular text-white">J / L</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Hold on video</span>
                  <kbd className="font-mono-tabular text-white">2x Speed</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Volume / Mute</span>
                  <kbd className="font-mono-tabular text-white">↑ ↓ / M</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Subtitles / Fullscreen</span>
                  <kbd className="font-mono-tabular text-white">C / F</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Next / Prev Episode</span>
                  <kbd className="font-mono-tabular text-white">N / P</kbd>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
