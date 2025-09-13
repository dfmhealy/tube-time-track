import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipForward, X, Volume2, VolumeX, HeadphonesIcon, Youtube, Maximize2, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { PodcastDatabaseService, type PodcastEpisode, type PodcastSession } from '@/lib/podcastDatabase';
import { DatabaseService, type Video } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { formatDuration } from '@/lib/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast'; // Added import for useToast

interface MiniPlayerProps {
  youtubeIframeRef: React.RefObject<HTMLDivElement>;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ youtubeIframeRef }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressTimer = useRef<number | null>(null);
  const ytPlayerInstance = useRef<any>(null); // Reference to the actual YouTube player object
  const videoSessionIdRef = useRef<string | null>(null);
  const [podcastSession, setPodcastSession] = useState<PodcastSession | null>(null);
  const [localDuration, setLocalDuration] = useState(0);
  const [localPosition, setLocalPosition] = useState(0);
  const { toast } = useToast();

  const {
    current,
    isPlaying,
    next,
    stop, // This stops playback but keeps current item
    clearCurrent, // This stops playback and clears current item
    setPosition: setGlobalPos,
    setVolume: setGlobalVolume,
    setMuted: setGlobalMuted,
    setRate: setGlobalRate,
    muted,
    volume,
    playbackRate,
    pause,
    resume,
    isPlayerViewOpen,
    isMinimized,
    expandVideo,
    toggleQueueVisibility,
  } = usePlayerStore();

  const isPodcast = current?.type === 'podcast';
  const isVideo = current?.type === 'video';

  // --- Media Session API ---
  useEffect(() => {
    if (!current || !('mediaSession' in navigator)) return;

    const mediaTitle = current.title;
    const mediaArtist = isPodcast ? current.creator : current.channelTitle;
    const mediaAlbum = isPodcast ? current.channelTitle : 'YouTube Video'; // Adjust as needed
    const mediaArtwork = [{ src: current.thumbnailUrl, sizes: '96x96', type: 'image/jpeg' }];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: mediaTitle,
      artist: mediaArtist,
      album: mediaAlbum,
      artwork: mediaArtwork,
    });

    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    // navigator.mediaSession.setActionHandler('previoustrack', () => prev()); // If prev is implemented
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const seekTime = localPosition - (details.seekOffset || 10);
      onSeek([Math.max(0, seekTime)]);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const seekTime = localPosition + (details.seekOffset || 10);
      onSeek([Math.min(localDuration, seekTime)]);
    });
    // navigator.mediaSession.setActionHandler('stop', () => clearCurrent()); // Use clearCurrent for stop

    return () => {
      // Clear handlers when component unmounts or current item changes
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        // navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        // navigator.mediaSession.setActionHandler('stop', null);
      }
    };
  }, [current, localPosition, localDuration, isPlaying, resume, pause, next, clearCurrent]);

  // --- Load Metadata and Initial Position ---
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!current) {
        setLocalDuration(0);
        setLocalPosition(0);
        return;
      }

      try {
        let lastPos = 0;
        let mediaDuration = 0;

        if (isPodcast) {
          const ep = await PodcastDatabaseService.getEpisode(current.id);
          if (!canceled && ep) {
            lastPos = ep.last_position_seconds || 0;
            mediaDuration = ep.duration_seconds || 0;
            // Update current item in store with full metadata
            usePlayerStore.setState(state => ({
              current: {
                ...state.current!,
                title: ep.title,
                thumbnailUrl: ep.thumbnail_url || '',
                creator: ep.podcast?.creator || ep.creator,
                durationSeconds: ep.duration_seconds,
                lastPositionSeconds: ep.last_position_seconds,
              }
            }));
          }
        } else if (isVideo) {
          const v = await DatabaseService.getVideo(current.id);
          if (!canceled && v) {
            lastPos = v.lastPositionSeconds || 0;
            mediaDuration = v.durationSeconds || 0;
            // Update current item in store with full metadata
            usePlayerStore.setState(state => ({
              current: {
                ...state.current!,
                title: v.title,
                thumbnailUrl: v.thumbnailUrl,
                channelTitle: v.channelTitle,
                durationSeconds: v.durationSeconds,
                lastPositionSeconds: v.lastPositionSeconds,
              }
            }));
          }
        }

        // If last position is near the end, reset to 0
        if (mediaDuration > 0 && lastPos >= mediaDuration - 10) {
          lastPos = 0;
        }

        setLocalPosition(lastPos);
        setGlobalPos(lastPos);
        setLocalDuration(mediaDuration);

      } catch (e) {
        console.error('Failed to load media meta or last position', e);
        toast({
          title: "Error",
          description: "Failed to load media. Please try again.",
          variant: "destructive"
        });
        clearCurrent();
      }
    })();
    return () => { canceled = true; };
  }, [current?.id, current?.type]); // Re-run when current item changes

  // --- Podcast (Audio) Playback Logic ---
  useEffect(() => {
    if (!isPodcast || !current || !audioRef.current) return;

    const ep = current;
    const audio = audioRef.current;

    const setupAudio = async () => {
      audio.src = ep.audio_url;
      audio.currentTime = localPosition;
      audio.playbackRate = playbackRate;
      audio.volume = muted ? 0 : volume;

      try {
        const s = await PodcastDatabaseService.startListenSession(ep.id);
        setPodcastSession(s);
      } catch (error) {
        console.error('Failed to start podcast session:', error);
        toast({
          title: "Error",
          description: "Failed to start podcast session.",
          variant: "destructive"
        });
        clearCurrent();
        return;
      }

      if (isPlaying) {
        audio.play().catch(e => {
          console.error("Podcast autoplay failed:", e);
          toast({
            title: "Autoplay Blocked",
            description: "Autoplay blocked. Tap play to listen.",
            variant: "info"
          });
          pause(); // Set global state to paused if autoplay fails
        });
      }
    };

    setupAudio();

    const handleAudioEnded = async () => {
      if (podcastSession) {
        try {
          await PodcastDatabaseService.endListenSession(podcastSession.id, Math.floor(audio.currentTime));
          await PodcastDatabaseService.markEpisodeAsCompleted(ep.id);
        } catch (e) { console.error("Error ending podcast session:", e); }
        setPodcastSession(null);
      }
      next();
    };

    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('loadedmetadata', () => setLocalDuration(audio.duration));

    return () => {
      audio.removeEventListener('ended', handleAudioEnded);
      audio.removeEventListener('loadedmetadata', () => setLocalDuration(audio.duration));
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      setPodcastSession(null);
    };
  }, [isPodcast, current?.id, localPosition]); // Re-run when podcast item or initial position changes

  // --- Video (YouTube) Playback Logic ---
  useEffect(() => {
    if (!isVideo || !current || !youtubeIframeRef.current) return;

    const videoItem = current;
    const playerContainer = youtubeIframeRef.current;

    const setupYouTubePlayer = async () => {
      // Load YouTube API if needed
      if (!(window as any).YT) {
        await new Promise<void>((resolve) => {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          (window as any).onYouTubeIframeAPIReady = () => resolve();
          document.body.appendChild(tag);
        });
      }

      // Check if player already exists (e.g., moved from PlayerView)
      let existingIframe = playerContainer.querySelector('iframe');
      if (existingIframe) {
        ytPlayerInstance.current = (window as any).YT.get(existingIframe.id);
        // Ensure it's a child of the current container
        if (existingIframe.parentElement !== playerContainer) {
          playerContainer.appendChild(existingIframe);
        }
        // Update dimensions for mini-player
        existingIframe.style.width = '100%';
        existingIframe.style.height = '100%';
      } else {
        // Create new player if none exists
        ytPlayerInstance.current = new (window as any).YT.Player(playerContainer, {
          videoId: videoItem.id,
          playerVars: {
            autoplay: 0, // We control autoplay via playVideo()
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            fs: 0, // No fullscreen in mini-player
          },
          events: {
            onReady: (event: any) => {
              ytPlayerInstance.current = event.target;
              ytPlayerInstance.current.seekTo(localPosition, true);
              ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
              ytPlayerInstance.current.setPlaybackRate(playbackRate);
              if (isPlaying) {
                ytPlayerInstance.current.playVideo().catch((e: any) => {
                  console.error("YT Autoplay failed:", e);
                  toast({
                    title: "Autoplay Blocked",
                    description: "Autoplay blocked. Tap play to watch.",
                    variant: "info"
                  });
                  pause();
                });
              }
              setLocalDuration(ytPlayerInstance.current.getDuration());
            },
            onStateChange: (event: any) => {
              const YT = (window as any).YT;
              if (event.data === YT.PlayerState.ENDED) {
                handleVideoEnded();
              } else if (event.data === YT.PlayerState.PAUSED) {
                pause();
              } else if (event.data === YT.PlayerState.PLAYING) {
                resume();
              }
            },
            onError: (error: any) => {
              console.error("YouTube Player Error:", error);
              toast({
                title: "Error",
                description: "YouTube Player Error: Could not load video.",
                variant: "destructive"
              });
              clearCurrent();
            }
          },
        });
      }

      // Start watch session
      try {
        const s = await DatabaseService.startWatchSession(videoItem.id);
        videoSessionIdRef.current = s.id;
      } catch (error) {
        console.error('Failed to start video watch session:', error);
        toast({
          title: "Error",
          description: "Failed to start video session.",
          variant: "destructive"
        });
        clearCurrent();
      }
    };

    setupYouTubePlayer();

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      videoSessionIdRef.current = null;
      // Do NOT destroy the player here if it's just minimizing/expanding
      // The iframe element is moved, not destroyed.
      // Only destroy if clearCurrent is called and no longer needed.
    };
  }, [isVideo, current?.id, localPosition]); // Re-run when video item or initial position changes

  // --- Global Playback State Sync (Audio & Video) ---
  useEffect(() => {
    // Sync podcast audio playback
    if (isPodcast && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Podcast playback failed:", e));
      } else {
        audioRef.current.pause();
      }
    }
    // Sync YouTube video playback
    if (isVideo && ytPlayerInstance.current) {
      const YT = (window as any).YT;
      if (isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PLAYING) {
        try { ytPlayerInstance.current.playVideo(); } catch (e) { console.error("YT play failed:", e); }
      } else if (!isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PAUSED) {
        try { ytPlayerInstance.current.pauseVideo(); } catch (e) { console.error("YT pause failed:", e); }
      }
    }
  }, [isPlaying, isPodcast, isVideo]);

  // --- Volume/Mute Sync (Audio & Video) ---
  useEffect(() => {
    if (isPodcast && audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
    if (isVideo && ytPlayerInstance.current) {
      ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
    }
  }, [volume, muted, isPodcast, isVideo]);

  // --- Playback Rate Sync (Audio & Video) ---
  useEffect(() => {
    if (isPodcast && audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
    if (isVideo && ytPlayerInstance.current) {
      ytPlayerInstance.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate, isPodcast, isVideo]);

  // --- Progress Tracking and Persistence (1-second interval) ---
  useEffect(() => {
    if (!current || (!isPodcast && !isVideo)) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      return;
    }

    if (progressTimer.current) clearInterval(progressTimer.current);

    progressTimer.current = window.setInterval(async () => {
      let currentPos = 0;
      let currentDur = 0;
      let isMediaPlaying = false;

      if (isPodcast && audioRef.current) {
        currentPos = Math.floor(audioRef.current.currentTime);
        currentDur = Math.floor(audioRef.current.duration);
        isMediaPlaying = !audioRef.current.paused;
      } else if (isVideo && ytPlayerInstance.current) {
        const YT = (window as any).YT;
        currentPos = Math.floor(ytPlayerInstance.current.getCurrentTime());
        currentDur = Math.floor(ytPlayerInstance.current.getDuration());
        isMediaPlaying = ytPlayerInstance.current.getPlayerState() === YT.PlayerState.PLAYING;
      }

      if (currentPos < 0 || currentDur <= 0) return; // Invalid state

      setLocalPosition(currentPos);
      setGlobalPos(currentPos);
      setLocalDuration(currentDur);

      if (isMediaPlaying) {
        await dailyTimeTracker.addTime(1); // Increment daily watch time
        try {
          if (isPodcast && podcastSession) {
            await PodcastDatabaseService.updateListenSession(podcastSession.id, { seconds_listened: currentPos });
            await PodcastDatabaseService.updateEpisodeProgress(current.id, currentPos);
          } else if (isVideo && videoSessionIdRef.current) {
            await DatabaseService.updateWatchSession(videoSessionIdRef.current, { secondsWatched: currentPos });
            await DatabaseService.updateVideoProgress(current.id, currentPos);
          }
        } catch (e) {
          console.error('Error updating media progress:', e);
        }

        // Mark as completed when near the end (90% watched or 1 minute remaining)
        const completionThreshold = Math.min(currentDur * 0.9, currentDur - 60);
        if (currentDur >= 120 && currentPos >= completionThreshold) {
          try {
            if (isPodcast) {
              await PodcastDatabaseService.markEpisodeAsCompleted(current.id);
            } else if (isVideo) {
              await DatabaseService.markVideoAsCompleted(current.id);
            }
          } catch (e) {
            console.error('Failed to mark media as completed:', e);
          }
        }
      }
    }, 1000) as unknown as number; // Update every 1 second

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
    };
  }, [current?.id, isPodcast, isVideo, isPlaying, podcastSession, videoSessionIdRef.current]);

  // --- Persist Progress on Unload/Visibility Change ---
  useEffect(() => {
    const persistProgress = async () => {
      if (!current) return;
      let currentPos = 0;
      if (isPodcast && audioRef.current) {
        currentPos = Math.floor(audioRef.current.currentTime);
      } else if (isVideo && ytPlayerInstance.current) {
        currentPos = Math.floor(ytPlayerInstance.current.getCurrentTime());
      }

      if (currentPos > 0) {
        try {
          if (isPodcast) {
            if (podcastSession) {
              await PodcastDatabaseService.endListenSession(podcastSession.id, currentPos);
            }
            await PodcastDatabaseService.updateEpisodeProgress(current.id, currentPos);
          } else if (isVideo) {
            if (videoSessionIdRef.current) {
              await DatabaseService.endWatchSession(videoSessionIdRef.current, currentPos);
            }
            await DatabaseService.updateVideoProgress(current.id, currentPos);
          }
        } catch (e) {
          console.error('Error persisting media progress on unload:', e);
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void persistProgress();
      }
    };
    const onBeforeUnload = () => {
      void persistProgress();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [current?.id, isPodcast, isVideo, podcastSession, videoSessionIdRef.current]);

  const onSeek = useCallback((vals: number[]) => {
    const newPos = vals[0];
    setLocalPosition(newPos);
    setGlobalPos(newPos);
    if (isPodcast && audioRef.current) {
      audioRef.current.currentTime = newPos;
    } else if (isVideo && ytPlayerInstance.current) {
      ytPlayerInstance.current.seekTo(newPos, true);
    }
  }, [isPodcast, isVideo]);

  const handleToggleMute = useCallback(() => {
    setGlobalMuted(!muted);
  }, [muted]);

  const handleVideoEnded = async () => {
    if (!current) return;
    try {
      if (videoSessionIdRef.current) {
        await DatabaseService.endWatchSession(videoSessionIdRef.current, localDuration);
      }
      await DatabaseService.markVideoAsCompleted(current.id);
      await DatabaseService.updateVideoProgress(current.id, localDuration);
    } catch (e) {
      console.error("Error ending video session:", e);
    }
    next();
  };

  const showMiniPlayer = !!current && (!isPlayerViewOpen || isMinimized);

  if (!showMiniPlayer) {
    // If a video is playing in PlayerView, ensure the iframe is moved there
    if (isVideo && current && isPlayerViewOpen && youtubeIframeRef.current.firstChild) {
      const iframe = youtubeIframeRef.current.firstChild as HTMLIFrameElement;
      if (iframe.parentElement === youtubeIframeRef.current) {
        // Remove from mini-player's container, PlayerView will pick it up
        youtubeIframeRef.current.removeChild(iframe);
      }
    }
    return null;
  }

  const title = current?.title || (isPodcast ? 'Podcast' : 'Video');
  const thumb = current?.thumbnailUrl;

  // Conditional rendering for YouTube iframe container
  const youtubePlayerContainer = isVideo ? (
    <div
      ref={youtubeIframeRef}
      className={cn(
        "absolute inset-0 w-full h-full",
        isMinimized ? "block" : "hidden" // Only visible when minimized
      )}
    />
  ) : null;

  return (
    <div className={cn(
      "fixed bottom-0 inset-x-0 z-50 p-3 pointer-events-none transition-all duration-300",
      isMinimized ? "md:bottom-4 md:right-4 md:left-auto md:w-80" : "w-full",
      isPlayerViewOpen && "hidden" // Hide mini-player if PlayerView is open
    )}>
      <Card className={cn(
        "mx-auto w-full p-3 shadow-xl bg-background/95 backdrop-blur pointer-events-auto flex items-center gap-3",
        isMinimized ? "max-w-xs" : "max-w-3xl"
      )}>
        {/* Thumbnail / Icon */}
        <div className="relative w-12 h-12 flex-shrink-0">
          {thumb ? (
            <img src={thumb} alt={title} className="w-full h-full rounded object-cover" />
          ) : (
            <div className="w-full h-full rounded bg-muted flex items-center justify-center">
              {isPodcast ? <HeadphonesIcon className="w-6 h-6 text-muted-foreground" /> : <Youtube className="w-6 h-6 text-muted-foreground" />}
            </div>
          )}
          {/* YouTube iframe for minimized video */}
          {youtubePlayerContainer}
        </div>

        {/* Title and Progress */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="flex items-center gap-2 mt-1">
            <Slider
              value={[localPosition]}
              max={Math.max(1, localDuration)}
              step={1}
              onValueChange={onSeek}
              className="w-full"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isVideo && isMinimized && (
            <Button size="icon" variant="ghost" onClick={expandVideo} title="Expand Video">
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={isPlaying ? pause : resume} title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={next} title="Next">
            <SkipForward className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={toggleQueueVisibility} title="Queue">
            <ListMusic className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={clearCurrent} title="Dismiss">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
      {/* Hidden audio element for podcast playback */}
      {isPodcast && (
        <audio
          ref={audioRef}
          onLoadedMetadata={() => setLocalDuration(audioRef.current?.duration || 0)}
          onEnded={() => { /* Handled by useEffect */ }}
          preload="metadata"
        />
      )}
    </div>
  );
};