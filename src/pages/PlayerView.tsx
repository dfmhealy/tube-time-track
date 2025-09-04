import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAppStore, useStatsStore, useLibraryStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import { loadYouTubeAPI, PlayerState, formatDuration, type YouTubePlayer } from '@/lib/youtube';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVideoStats } from '@/hooks/useVideoStats';

export function PlayerView() {
  const navigate = useNavigate();
  const { currentVideo, setCurrentView, activeWatchSession, setActiveWatchSession } = useAppStore();
  const { updateTotalSeconds } = useStatsStore();
  const { updateVideo } = useLibraryStore();
  const { stats, loading: statsLoading, error: statsError } = useVideoStats(currentVideo?.id);
  
  // Player state
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Tracking state
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [totalWatchedSeconds, setTotalWatchedSeconds] = useState(0);
  const [lastSavedTime, setLastSavedTime] = useState(0);
  
  // Refs
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const trackingIntervalRef = useRef<NodeJS.Timeout>();
  const visibilityRef = useRef(true);
  const focusRef = useRef(true);
  
  // Forward declare endWatchSession
  const endWatchSession = useCallback(async () => {
    if (!activeWatchSession) return;

    try {
      const finalSeconds = totalWatchedSeconds;
      await DatabaseService.endWatchSession(activeWatchSession.id, finalSeconds);
      
      // Update video's last watched
      if (currentVideo) {
        await updateVideo(currentVideo.id, {
          ...currentVideo,
          addedAt: currentVideo.addedAt // Keep original addedAt
        });
      }

      // Update global stats
      updateTotalSeconds(finalSeconds);
      
      setActiveWatchSession(null);
      setTotalWatchedSeconds(0);
      setWatchStartTime(null);
    } catch (error) {
      console.error('Failed to end watch session:', error);
    }
  }, [activeWatchSession, totalWatchedSeconds, currentVideo, updateVideo, updateTotalSeconds, setActiveWatchSession]);

  // Return to library
  const handleBack = useCallback(async () => {
    try {
      if (activeWatchSession) {
        await endWatchSession();
      }
      navigate(-1);
    } catch (error) {
      console.error('Error during back navigation:', error);
      navigate(-1); // Navigate anyway
    }
  }, [activeWatchSession, navigate, endWatchSession]);

  // Load YouTube API and initialize player
  useEffect(() => {
    if (!currentVideo) {
      setCurrentView('library');
      return;
    }

    let mounted = true;

    const initializePlayer = async () => {
      try {
        await loadYouTubeAPI();
        
        if (!mounted) return;

        const ytPlayer = new window.YT.Player('youtube-player', {
          videoId: currentVideo.youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            showinfo: 0,
          },
          events: {
            onReady: (event) => {
              if (!mounted) return;
              setPlayer(event.target);
              setIsPlayerReady(true);
              setDuration(event.target.getDuration());
              setPlaybackRate(event.target.getPlaybackRate());
            },
            onStateChange: (event) => {
              if (!mounted) return;
              handlePlayerStateChange(event.data);
            },
            onError: (event) => {
              console.error('YouTube player error:', event.data);
              toast.error('Error loading video. Video may be unavailable or restricted.');
            },
          },
        });

      } catch (error) {
        console.error('Failed to initialize YouTube player:', error);
        toast.error('Failed to load video player.');
      }
    };

    initializePlayer();

    return () => {
      mounted = false;
      if (player) {
        player.destroy();
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, [currentVideo]);

  // Handle player state changes
  const handlePlayerStateChange = useCallback((state: PlayerState) => {
    switch (state) {
      case PlayerState.PLAYING:
        setIsPlaying(true);
        startWatchTracking();
        break;
      case PlayerState.PAUSED:
      case PlayerState.BUFFERING:
      case PlayerState.ENDED:
        setIsPlaying(false);
        stopWatchTracking();
        if (state === PlayerState.ENDED) {
          // Update watch history one final time before ending
          if (activeWatchSession && totalWatchedSeconds > 0) {
            updateWatchHistory(activeWatchSession, Math.floor(totalWatchedSeconds), playbackRate);
          }
          endWatchSession();
        }
        break;
    }
  }, []);

  // Start watch session
  const startWatchSession = useCallback(async () => {
    if (!currentVideo || activeWatchSession) return;

    try {
      const session = await DatabaseService.startWatchSession(currentVideo.id);
      setActiveWatchSession(session);
      setTotalWatchedSeconds(0);
    } catch (error) {
      console.error('Failed to start watch session:', error);
    }
  }, [currentVideo, activeWatchSession, setActiveWatchSession]);


  // Start tracking watch time
  const startWatchTracking = useCallback(() => {
    if (!activeWatchSession) {
      startWatchSession();
    }
    
    setWatchStartTime(Date.now());
    
    // Clear any existing interval
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }

    // Track every second
    trackingIntervalRef.current = setInterval(() => {
      if (!player || !isPlayerReady) return;

      const isVisible = visibilityRef.current;
      const hasFocus = focusRef.current;
      const playerState = player.getPlayerState();
      const currentPlaybackRate = player.getPlaybackRate();
      
      // Always update current time and playback rate
      setCurrentTime(player.getCurrentTime());
      setPlaybackRate(currentPlaybackRate);
      
      // Only count watch time if all conditions are met
      const shouldCount = 
        playerState === PlayerState.PLAYING &&
        isVisible &&
        hasFocus &&
        currentPlaybackRate >= 0.5 &&
        currentPlaybackRate <= 1.25;

      if (shouldCount) {
        setTotalWatchedSeconds(prev => {
          const newTotal = prev + currentPlaybackRate;
          
          // Save to database every 5 seconds
          if (Math.floor(newTotal) % 5 === 0 && Math.floor(newTotal) !== lastSavedTime) {
            updateWatchHistory(activeWatchSession, Math.floor(newTotal), currentPlaybackRate);
            setLastSavedTime(Math.floor(newTotal));
          }
          
          return newTotal;
        });
      }
    }, 1000);
  }, [player, isPlayerReady, activeWatchSession, lastSavedTime, startWatchSession]);

  // Update watch history helper
  const updateWatchHistory = useCallback(async (session: any, seconds: number, rate: number) => {
    if (!session) return;
    try {
      await DatabaseService.updateWatchSession(session.id, {
        secondsWatched: seconds,
        avgPlaybackRate: rate
      });
    } catch (error) {
      console.error('Failed to update watch history:', error);
    }
  }, []);

  // Stop tracking watch time
  const stopWatchTracking = useCallback(() => {
    setWatchStartTime(null);
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
  }, []);

  // Visibility and focus tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      visibilityRef.current = !document.hidden;
    };

    const handleFocus = () => {
      focusRef.current = true;
    };

    const handleBlur = () => {
      focusRef.current = false;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Player controls
  const togglePlayPause = () => {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const seekTo = (seconds: number) => {
    if (!player) return;
    player.seekTo(seconds, true);
    setCurrentTime(seconds);
  };

  const skip = (seconds: number) => {
    if (!player) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    seekTo(newTime);
  };

  const toggleMute = () => {
    if (!player) return;
    if (isMuted) {
      player.unMute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (!player) return;
    player.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  // Control visibility
  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Calculate progress
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const watchedPercentage = duration > 0 ? (totalWatchedSeconds / duration) * 100 : 0;

  if (!currentVideo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>No video selected</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Video Player Container */}
      <div 
        ref={playerContainerRef}
        className="relative flex-1 bg-black"
        onMouseMove={showControlsTemporarily}
        onTouchStart={showControlsTemporarily}
      >
        {/* YouTube Player */}
        <div className="w-full h-full">
          <div id="youtube-player" className="w-full h-full" />
        </div>

        {/* Loading overlay */}
        {!isPlayerReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center text-white">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p>Loading video...</p>
            </div>
          </div>
        )}

        {/* Custom Controls Overlay */}
        <div 
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Top bar with back button and video info */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-start justify-between">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleBack}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              
              <div className="flex-1 mx-4">
                <h2 className="text-white text-lg font-semibold line-clamp-1">
                  {currentVideo.title}
                </h2>
                <p className="text-white/80 text-sm">
                  {currentVideo.channelTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Center play/pause button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="lg"
              onClick={togglePlayPause}
              className="text-white hover:bg-white/20 p-6"
            >
              {isPlaying ? (
                <Pause className="h-12 w-12" />
              ) : (
                <Play className="h-12 w-12" />
              )}
            </Button>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="relative group">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={currentTime}
                  onChange={(e) => {
                    const newTime = Number(e.target.value);
                    seekTo(newTime);
                  }}
                  className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${progressPercentage}%, rgba(255,255,255,0.3) ${progressPercentage}%, rgba(255,255,255,0.3) 100%)`
                  }}
                />
                {/* Watched progress indicator */}
                <div 
                  className="absolute top-0 left-0 h-1 bg-primary/60 rounded-full pointer-events-none"
                  style={{ width: `${Math.min(watchedPercentage, progressPercentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-white/80 text-xs mt-1">
                <span>{formatDuration(Math.floor(currentTime))}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => skip(-10)}
                  className="text-white hover:bg-white/20"
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => skip(10)}
                  className="text-white hover:bg-white/20"
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                {/* Playback rate */}
                <select
                  value={playbackRate}
                  onChange={(e) => changePlaybackRate(Number(e.target.value))}
                  className="bg-white/20 text-white text-xs rounded px-2 py-1 border-none"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile watch stats overlay */}
      <div className="md:hidden bg-background border-t p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">
              {formatDuration(Math.floor(totalWatchedSeconds))} watched
            </Badge>
            <span className="text-muted-foreground">
              {Math.round(watchedPercentage)}% complete
            </span>
          </div>
          {activeWatchSession && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
      </div>

      {/* Desktop sidebar with stats */}
      <div className="hidden md:block absolute top-0 right-0 w-80 h-full bg-background/95 backdrop-blur-sm border-l p-6 overflow-y-auto">
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Watch Stats</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Time watched:</span>
              <span className="text-sm font-medium">
                {formatDuration(Math.floor(totalWatchedSeconds))}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Progress:</span>
              <span className="text-sm font-medium">
                {Math.round(watchedPercentage)}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Playback rate:</span>
              <span className="text-sm font-medium">{playbackRate}x</span>
            </div>
            
            {activeWatchSession && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Recording:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs text-red-500">Active</span>
                </div>
              </div>
            )}
          </div>
          
          <Progress value={watchedPercentage} className="mt-4" />
        </Card>

        {/* Video Stats */}
        <Card className="p-4 mt-4">
          <h3 className="font-semibold mb-4">Video Stats</h3>
          
          {statsLoading ? (
            <div className="text-sm text-muted-foreground">Loading stats...</div>
          ) : statsError ? (
            <div className="text-sm text-red-500">Failed to load stats</div>
          ) : stats ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total watch time:</span>
                <span className="text-sm font-medium">
                  {formatDuration(Math.floor(stats.totalWatchTime))}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Completion:</span>
                <span className="text-sm font-medium">
                  {Math.round(stats.completionPercentage)}%
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg speed:</span>
                <span className="text-sm font-medium">
                  {stats.averagePlaybackRate.toFixed(2)}x
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sessions:</span>
                <span className="text-sm font-medium">{stats.sessionCount}</span>
              </div>
              
              <Progress value={stats.completionPercentage} className="mt-2" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No stats yet</div>
          )}
        </Card>
        
        {/* Video metadata */}
        <Card className="p-4 mt-4">
          <h3 className="font-semibold mb-4">Video Info</h3>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Duration</span>
              <p className="text-sm font-medium">{formatDuration(duration)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Channel</span>
              <p className="text-sm font-medium">{currentVideo.channelTitle}</p>
            </div>
            {currentVideo.tags.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Tags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentVideo.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}