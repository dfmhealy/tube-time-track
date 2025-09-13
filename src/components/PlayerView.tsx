import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, Minimize2, Maximize2, Volume2, VolumeX, Settings, X, SkipForward, SkipBack } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore'; // Corrected import
import { DatabaseService } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { formatDuration } from '@/lib/utils';
import { toast } from 'sonner';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'; // Import useYouTubePlayer

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

  const video = current?.type === 'video' ? current : null;

  // Use the YouTube player hook
  const { ytPlayerInstance, videoSessionIdRef } = useYouTubePlayer({
    currentVideo: video ? { id: video.id, youtubeId: video.youtubeId!, durationSeconds: video.durationSeconds } : null,
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

  // Effect: Update playerVars for fullscreen when PlayerView is active
  useEffect(() => {
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setPlaybackQuality === 'function') {
      // Ensure fullscreen is enabled when in PlayerView
      // Note: playerVars can't be changed after player creation, but we can ensure the iframe is correctly configured
      // The `useYouTubePlayer` hook now handles moving the iframe and re-syncing state.
      // For fullscreen, the iframe itself needs `allowfullscreen` attribute, which is handled by the API.
      // The `fs: 1` playerVar is set during player creation in useYouTubePlayer.
    }
  }, [ytPlayerInstance.current]);

  const handleSeek = useCallback((vals: number[]) => {
    const newPos = vals[0];
    if (!Number.isFinite(newPos)) {
      console.warn('Attempted to seek to a non-finite value:', newPos);
      return;
    }
    setLocalPosition(newPos);
    setGlobalPosition(newPos);
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') {
      ytPlayerInstance.current.seekTo(newPos, true);
    }
  }, [setLocalPosition, setGlobalPosition, ytPlayerInstance.current]);

  const handleVolumeChange = useCallback((vals: number[]) => {
    const newVol = vals[0];
    setGlobalVolume(newVol);
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setVolume === 'function') {
      ytPlayerInstance.current.setVolume(newVol * 100);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setGlobalMuted(!muted);
    if (ytPlayerInstance.current) {
      if (muted) {
        if (typeof ytPlayerInstance.current.unMute === 'function') ytPlayerInstance.current.unMute();
      } else {
        if (typeof ytPlayerInstance.current.mute === 'function') ytPlayerInstance.current.mute();
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
      if (typeof ytPlayerInstance.current.stopVideo === 'function') ytPlayerInstance.current.stopVideo();
      if (typeof ytPlayerInstance.current.destroy === 'function') ytPlayerInstance.current.destroy(); // Destroy player when closing completely
    }
    clearCurrent();
  }, [clearCurrent]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video Player Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <div ref={youtubeIframeRef} className="w-full h-full aspect-video max-h-full max-w-full">
          {/* YouTube iframe will be appended here by useYouTubePlayer */}
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
            <Button variant="ghost" size="icon" onClick={() => ytPlayerInstance.current && typeof ytPlayerInstance.current.requestFullscreen === 'function' && ytPlayerInstance.current.requestFullscreen()}>
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