import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipForward, X, Volume2, VolumeX, HeadphonesIcon, Youtube, Maximize2, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { PodcastDatabaseService } from '@/lib/podcastDatabase';
import { DatabaseService } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { formatDuration } from '@/lib/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer'; // Import new hook
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'; // Import new hook

interface MiniPlayerProps {
  youtubeIframeRef: React.RefObject<HTMLDivElement>;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ youtubeIframeRef }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressTimer = useRef<number | null>(null);
  const [localDuration, setLocalDuration] = useState(0);
  const [localPosition, setLocalPosition] = useState(0);
  const { toast } = useToast();

  const {
    current,
    isPlaying,
    next,
    clearCurrent,
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

  // Use custom hooks for media-specific logic
  const { podcastSession } = usePodcastPlayer({
    currentPodcast: isPodcast ? { id: current.id, audio_url: (current as any).audio_url, durationSeconds: current.durationSeconds } : null,
    isPlaying,
    volume,
    muted,
    playbackRate,
    localPosition,
    setLocalPosition,
    setLocalDuration,
    pause,
    resume,
    next,
    clearCurrent,
  });

  const { ytPlayerInstance, videoSessionIdRef } = useYouTubePlayer({
    currentVideo: isVideo ? { id: current.id, youtubeId: current.id, durationSeconds: current.durationSeconds } : null,
    youtubeIframeRef,
    isPlaying,
    volume,
    muted,
    playbackRate,
    localPosition,
    setLocalPosition,
    setLocalDuration,
    pause,
    resume,
    next,
    clearCurrent,
  });

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
  }, [current?.id, isPodcast, isVideo, isPlaying, podcastSession, videoSessionIdRef.current, setLocalPosition, setGlobalPos, setLocalDuration]);

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
    // Validate newPos before using it
    if (!Number.isFinite(newPos)) {
      console.warn('Attempted to seek to a non-finite value:', newPos);
      return;
    }

    setLocalPosition(newPos);
    setGlobalPos(newPos);
    if (isPodcast && audioRef.current) {
      audioRef.current.currentTime = newPos;
    } else if (isVideo && ytPlayerInstance.current) {
      ytPlayerInstance.current.seekTo(newPos, true);
    }
  }, [isPodcast, isVideo, setLocalPosition, setGlobalPos, ytPlayerInstance.current, audioRef.current]);

  const handleToggleMute = useCallback(() => {
    setGlobalMuted(!muted);
  }, [muted, setGlobalMuted]);

  const showMiniPlayer = !!current && (!isPlayerViewOpen || isMinimized);

  if (!showMiniPlayer) {
    // If a video is playing in PlayerView, ensure the iframe is moved there
    if (isVideo && current && isPlayerViewOpen && youtubeIframeRef.current && youtubeIframeRef.current.firstChild) {
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
          onEnded={() => { /* Handled by useEffect in usePodcastPlayer */ }}
          preload="metadata"
        />
      )}
    </div>
  );
};