import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, Minimize2, Maximize2, Volume2, VolumeX, Settings, X, SkipForward, SkipBack } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { DatabaseService } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { formatDuration } from '@/lib/utils';
import { toast } from 'sonner';

interface PlayerViewProps {
  youtubeIframeRef: React.RefObject<HTMLDivElement>;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ youtubeIframeRef }) => {
  const playerStore = usePlayerStore();
  const {
    current,
    isPlaying,
    playbackRate,
    volume,
    muted,
    positionSeconds,
    pause,
    resume,
    stop,
    next,
    prev,
    minimizeVideo,
    clearCurrent,
    setPosition: setGlobalPosition,
    setVolume: setGlobalVolume,
    setMuted: setGlobalMuted,
    setRate: setGlobalRate,
  } = playerStore;

  const [localDuration, setLocalDuration] = useState(0);
  const [localPosition, setLocalPosition] = useState(0);
  const ytPlayerInstance = useRef<any>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const video = current?.type === 'video' ? current : null;

  // Effect to manage the YouTube iframe DOM element
  useEffect(() => {
    if (!video || !youtubeIframeRef.current) return;

    const playerContainer = youtubeIframeRef.current;
    const existingIframe = playerContainer.querySelector('iframe');

    // If an iframe already exists, it means the MiniPlayer is passing it to us.
    // We just need to ensure it's visible and correctly sized.
    if (existingIframe) {
      // Ensure the iframe is a direct child of the container
      if (existingIframe.parentElement !== playerContainer) {
        playerContainer.appendChild(existingIframe);
      }
      // Update dimensions for full view
      existingIframe.style.width = '100%';
      existingIframe.style.height = '100%';
      ytPlayerInstance.current = (window as any).YT.get(existingIframe.id);
      
      // If player instance is already available, set initial state
      if (ytPlayerInstance.current) {
        ytPlayerInstance.current.seekTo(localPosition, true);
        if (isPlaying) {
          ytPlayerInstance.current.playVideo();
        } else {
          ytPlayerInstance.current.pauseVideo();
        }
        ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
        ytPlayerInstance.current.setPlaybackRate(playbackRate);
      }
      return;
    }

    // If no iframe exists, create a new YouTube player
    const createPlayer = () => {
      if (!(window as any).YT || !(window as any).YT.Player) {
        console.error("YouTube IFrame API not loaded.");
        return;
      }

      ytPlayerInstance.current = new (window as any).YT.Player(playerContainer, {
        videoId: video.id,
        playerVars: {
          autoplay: 1, // Autoplay when opened in PlayerView
          controls: 0, // Custom controls
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          fs: 1, // Allow fullscreen
        },
        events: {
          onReady: (event: any) => {
            ytPlayerInstance.current = event.target;
            ytPlayerInstance.current.seekTo(localPosition, true);
            ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
            ytPlayerInstance.current.setPlaybackRate(playbackRate);
            if (isPlaying) {
              ytPlayerInstance.current.playVideo();
            } else {
              ytPlayerInstance.current.pauseVideo();
            }
            setLocalDuration(ytPlayerInstance.current.getDuration());
          },
          onStateChange: (event: any) => {
            const YT = (window as any).YT;
            if (event.data === YT.PlayerState.ENDED) {
              handleEnded();
            } else if (event.data === YT.PlayerState.PAUSED) {
              pause();
            } else if (event.data === YT.PlayerState.PLAYING) {
              resume();
            }
          },
          onError: (error: any) => {
            console.error("YouTube Player Error:", error);
            toast.error("YouTube Player Error: Could not load video.");
            clearCurrent();
          }
        },
      });
    };

    // Load YouTube API if not already loaded
    if (!(window as any).YT || !(window as any).YT.Player) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      (window as any).onYouTubeIframeAPIReady = createPlayer;
      document.head.appendChild(script);
    } else {
      createPlayer();
    }

    return () => {
      if (ytPlayerInstance.current && typeof ytPlayerInstance.current.destroy === 'function') {
        // When PlayerView unmounts, we don't destroy the player if it's minimizing
        // Instead, we let MiniPlayer take over the iframe.
        // If it's a full stop/clear, then destroy.
        if (!playerStore.isMinimized) { // Only destroy if not minimizing
          try { ytPlayerInstance.current.destroy(); } catch (e) { console.warn("Error destroying YT player:", e); }
        }
      }
      ytPlayerInstance.current = null;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [video?.id, youtubeIframeRef]); // Only re-run if video ID or iframe ref changes

  // Sync local position/duration with global state and update DB
  useEffect(() => {
    if (!video || !ytPlayerInstance.current) return;

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = window.setInterval(async () => {
      const currentYTPlayer = ytPlayerInstance.current;
      if (!currentYTPlayer || typeof currentYTPlayer.getCurrentTime !== 'function') return;

      const currentPos = Math.floor(currentYTPlayer.getCurrentTime());
      const currentDur = Math.floor(currentYTPlayer.getDuration());
      
      setLocalPosition(currentPos);
      setLocalDuration(currentDur);
      setGlobalPosition(currentPos);

      const YT = (window as any).YT;
      if (currentYTPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
        await dailyTimeTracker.addTime(1);
        // Debounced database update for last position
        await DatabaseService.updateVideoProgress(video.id, currentPos);
      }
    }, 1000) as unknown as number;

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    };
  }, [video?.id, isPlaying, ytPlayerInstance.current]);

  // Sync global playback state to YouTube player
  useEffect(() => {
    if (!ytPlayerInstance.current) return;
    const YT = (window as any).YT;
    if (isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PLAYING) {
      try { ytPlayerInstance.current.playVideo(); } catch (e) { console.error("YT play failed:", e); }
    } else if (!isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PAUSED) {
      try { ytPlayerInstance.current.pauseVideo(); } catch (e) { console.error("YT pause failed:", e); }
    }
  }, [isPlaying, ytPlayerInstance.current]);

  // Sync global volume/mute to YouTube player
  useEffect(() => {
    if (!ytPlayerInstance.current) return;
    ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
  }, [volume, muted, ytPlayerInstance.current]);

  // Sync global playback rate to YouTube player
  useEffect(() => {
    if (!ytPlayerInstance.current) return;
    ytPlayerInstance.current.setPlaybackRate(playbackRate);
  }, [playbackRate, ytPlayerInstance.current]);

  const handleSeek = useCallback((vals: number[]) => {
    const newPos = vals[0];
    setLocalPosition(newPos);
    setGlobalPosition(newPos);
    if (ytPlayerInstance.current) {
      ytPlayerInstance.current.seekTo(newPos, true);
    }
  }, []);

  const handleVolumeChange = useCallback((vals: number[]) => {
    const newVol = vals[0];
    setGlobalVolume(newVol);
    if (ytPlayerInstance.current) {
      ytPlayerInstance.current.setVolume(newVol * 100);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setGlobalMuted(!muted);
    if (ytPlayerInstance.current) {
      if (muted) {
        ytPlayerInstance.current.unMute();
      } else {
        ytPlayerInstance.current.mute();
      }
    }
  }, [muted]);

  const handleEnded = async () => {
    if (!video) return;
    try {
      await DatabaseService.markVideoAsCompleted(video.id);
      await DatabaseService.updateVideoProgress(video.id, localDuration); // Ensure final position is saved
    } catch (e) {
      console.error("Failed to mark video as completed:", e);
    }
    next(); // Play next item in queue
  };

  const handleMinimize = useCallback(() => {
    minimizeVideo();
  }, [minimizeVideo]);

  const handleClose = useCallback(() => {
    if (ytPlayerInstance.current) {
      ytPlayerInstance.current.stopVideo();
      ytPlayerInstance.current.destroy(); // Destroy player when closing completely
    }
    clearCurrent();
  }, [clearCurrent]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video Player Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <div ref={youtubeIframeRef} className="w-full h-full aspect-video max-h-full max-w-full">
          {/* YouTube iframe will be appended here */}
        </div>
      </div>

      {/* Controls Overlay */}
      <Card className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md p-4 border-t border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleMinimize}>
              <Minimize2 className="h-5 w-5" />
            </Button>
          </div>
          <div className="text-lg font-semibold text-foreground line-clamp-1 flex-1 text-center mx-4">
            {video.title}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => ytPlayerInstance.current?.requestFullscreen()}>
              <Maximize2 className="h-5 w-5" />
            </Button>
            {/* Add more settings like captions here */}
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={prev}>
            <SkipBack className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={isPlaying ? pause : resume}>
            {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={next}>
            <SkipForward className="h-6 w-6" />
          </Button>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{formatDuration(localPosition)}</span>
            <Slider
              value={[localPosition]}
              max={Math.max(1, localDuration)}
              step={1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <span className="text-sm text-muted-foreground">{formatDuration(localDuration)}</span>
          </div>

          <div className="flex items-center gap-2 w-32">
            <Button variant="ghost" size="icon" onClick={handleToggleMute}>
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <Slider
              value={[volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="flex-1"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};