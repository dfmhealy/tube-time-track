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
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';

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
  const { ytPlayerInstance, videoSessionIdRef, handleSeek } = useYouTubePlayer({
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

  // Sync with global position from player store
  useEffect(() => {
    setLocalPosition(positionSeconds);
  }, [positionSeconds]);

  // Get duration from YouTube player when available
  useEffect(() => {
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.getDuration === 'function') {
      const duration = ytPlayerInstance.current.getDuration();
      if (duration && duration > 0) {
        setLocalDuration(duration);
      }
    }
  }, [ytPlayerInstance.current, video?.id]);

  // Periodically update duration and position from YouTube player
  useEffect(() => {
    if (!video || !ytPlayerInstance.current) return;

    const updateInterval = setInterval(() => {
      if (ytPlayerInstance.current && typeof ytPlayerInstance.current.getCurrentTime === 'function' && typeof ytPlayerInstance.current.getDuration === 'function') {
        const currentTime = ytPlayerInstance.current.getCurrentTime();
        const duration = ytPlayerInstance.current.getDuration();
        
        if (duration && duration > 0) {
          setLocalDuration(duration);
        }
        
        if (currentTime >= 0) {
          setLocalPosition(currentTime);
          setGlobalPosition(currentTime);
        }
      }
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [video?.id, ytPlayerInstance.current, setGlobalPosition]);

  const handleSeekSlider = useCallback((vals: number[]) => {
    const newPos = vals[0];
    if (!Number.isFinite(newPos)) {
      console.warn('Attempted to seek to a non-finite value:', newPos);
      return;
    }
    handleSeek(newPos);
  }, [handleSeek]);

  const handleVolumeChange = useCallback((vals: number[]) => {
    const newVol = vals[0];
    setGlobalVolume(newVol);
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setVolume === 'function') {
      ytPlayerInstance.current.setVolume(newVol * 100);
    }
  }, [setGlobalVolume, ytPlayerInstance]);

  const handleToggleMute = useCallback(() => {
    setGlobalMuted(!muted);
    if (ytPlayerInstance.current) {
      if (muted) {
        if (typeof ytPlayerInstance.current.unMute === 'function') ytPlayerInstance.current.unMute();
      } else {
        if (typeof ytPlayerInstance.current.mute === 'function') ytPlayerInstance.current.mute();
      }
    }
  }, [muted, setGlobalMuted, ytPlayerInstance]);

  const handleMinimize = useCallback(() => {
    minimizeVideo();
  }, [minimizeVideo]);

  const handleClose = useCallback(() => {
    if (ytPlayerInstance.current) {
      if (typeof ytPlayerInstance.current.stopVideo === 'function') ytPlayerInstance.current.stopVideo();
    }
    clearCurrent();
  }, [clearCurrent, ytPlayerInstance]);

  const handleSkipBack = useCallback(() => {
    const newTime = Math.max(0, localPosition - 10);
    handleSeek(newTime);
  }, [localPosition, handleSeek]);

  const handleSkipForward = useCallback(() => {
    const newTime = Math.min(localDuration, localPosition + 10);
    handleSeek(newTime);
  }, [localPosition, localDuration, handleSeek]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setGlobalRate(rate);
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setPlaybackRate === 'function') {
      ytPlayerInstance.current.setPlaybackRate(rate);
    }
  }, [setGlobalRate, ytPlayerInstance]);

  if (!video) return null;

  // Use the larger of local duration or video duration from props
  const displayDuration = Math.max(localDuration, video.durationSeconds || 0);
  const displayPosition = localPosition;

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
            <div className="flex items-center gap-1">
              <Button 
                variant={playbackRate === 0.5 ? "default" : "ghost"} 
                size="sm" 
                onClick={() => handlePlaybackRateChange(0.5)}
                className="text-xs px-2"
              >
                0.5x
              </Button>
              <Button 
                variant={playbackRate === 1 ? "default" : "ghost"} 
                size="sm" 
                onClick={() => handlePlaybackRateChange(1)}
                className="text-xs px-2"
              >
                1x
              </Button>
              <Button 
                variant={playbackRate === 1.25 ? "default" : "ghost"} 
                size="sm" 
                onClick={() => handlePlaybackRateChange(1.25)}
                className="text-xs px-2"
              >
                1.25x
              </Button>
              <Button 
                variant={playbackRate === 1.5 ? "default" : "ghost"} 
                size="sm" 
                onClick={() => handlePlaybackRateChange(1.5)}
                className="text-xs px-2"
              >
                1.5x
              </Button>
              <Button 
                variant={playbackRate === 2 ? "default" : "ghost"} 
                size="sm" 
                onClick={() => handlePlaybackRateChange(2)}
                className="text-xs px-2"
              >
                2x
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => {
              if (ytPlayerInstance.current && typeof ytPlayerInstance.current.getIframe === 'function') {
                const iframe = ytPlayerInstance.current.getIframe();
                if (iframe && iframe.requestFullscreen) {
                  iframe.requestFullscreen();
                }
              }
            }}>
              <Maximize2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground min-w-0 font-mono">
            {formatDuration(displayPosition)}
          </span>
          <Slider
            value={[displayPosition]}
            max={Math.max(1, displayDuration)}
            step={1}
            onValueChange={handleSeekSlider}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground min-w-0 font-mono">
            {formatDuration(displayDuration)}
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleSkipBack}>
            <SkipBack className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={isPlaying ? pause : resume} className="h-12 w-12">
            {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSkipForward}>
            <SkipForward className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={next} className="ml-4">
            <SkipForward className="h-6 w-6" />
          </Button>

          <div className="flex items-center gap-2 ml-8 w-32">
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