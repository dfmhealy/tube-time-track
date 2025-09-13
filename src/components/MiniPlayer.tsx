import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipForward, X, Volume2, VolumeX, HeadphonesIcon, Youtube, Maximize2, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore'; // Corrected import
import { PodcastDatabaseService } from '@/lib/podcastDatabase';
import { DatabaseService } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { formatDuration } from '@/lib/utils';
import { toast as sonnerToast } from 'sonner'; // Use sonner toast for general messages
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast'; // Use shadcn toast for specific UI toasts
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer'; // Import new hook
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'; // Import new hook

interface MiniPlayerProps {
  youtubeIframeRef: React.RefObject<HTMLDivElement>;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ youtubeIframeRef }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localDuration, setLocalDuration] = useState(0);
  const [localPosition, setLocalPosition] = useState(0);
  const { toast } = useToast(); // For shadcn toasts

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
    currentPodcast: isPodcast ? { id: current.id, audioUrl: current.audioUrl!, durationSeconds: current.durationSeconds } : null,
    audioRef, // Pass audioRef to the hook
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
    currentVideo: isVideo ? { id: current.id, youtubeId: current.youtubeId!, durationSeconds: current.durationSeconds } : null,
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
            usePlayerStore.getState().play({
              ...current,
              title: ep.title,
              thumbnailUrl: ep.thumbnail_url || '',
              creator: ep.podcast?.creator || ep.creator, // Corrected access to creator
              durationSeconds: ep.duration_seconds,
              lastPositionSeconds: ep.last_position_seconds,
              audioUrl: ep.audio_url, // Ensure audioUrl is updated in current
            }, ep.last_position_seconds || 0);
          }
        } else if (isVideo) {
          const v = await DatabaseService.getVideo(current.id);
          if (!canceled && v) {
            lastPos = v.lastPositionSeconds || 0;
            mediaDuration = v.durationSeconds || 0;
            // Update current item in store with full metadata
            usePlayerStore.getState().play({
              ...current,
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              channelTitle: v.channelTitle,
              durationSeconds: v.durationSeconds,
              lastPositionSeconds: v.lastPositionSeconds,
              youtubeId: v.youtubeId, // Ensure youtubeId is updated in current
            }, v.lastPositionSeconds || 0);
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
    } else if (isVideo && ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') {
      ytPlayerInstance.current.seekTo(newPos, true);
    }
  }, [isPodcast, isVideo, setLocalPosition, setGlobalPos, ytPlayerInstance.current, audioRef.current]);

  const handleToggleMute = useCallback(() => {
    setGlobalMuted(!muted);
  }, [muted, setGlobalMuted]);

  const showMiniPlayer = !!current && (!isPlayerViewOpen || isMinimized);

  if (!showMiniPlayer) {
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