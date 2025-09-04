import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, useLibraryStore, useStatsStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import type { Video, WatchSession } from '@/lib/database';
import { formatDuration, cn } from '@/lib/utils';

// Type definitions
declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: () => void; }
}
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  destroy(): void;
}
enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5
}

export function PlayerView() {
  const handleError = useCallback((error: Error) => {
    console.error('PlayerView error boundary caught:', error);
    toast.error('An error occurred in the video player.');
  }, []);

  return (
    <ErrorBoundary 
      onError={handleError}
      fallback={
        <div className="p-4 text-center">
          <h2 className="text-lg font-semibold mb-2">Video Player Error</h2>
          <p className="mb-4">Sorry, there was a problem loading the video player.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload Player
          </Button>
        </div>
      }
    >
      <PlayerViewContent />
    </ErrorBoundary>
  );
}


function PlayerViewContent() {
  const navigate = useNavigate();
  const { currentVideo, setCurrentView, activeWatchSession, setActiveWatchSession } = useAppStore();
  const { updateTotalSeconds } = useStatsStore();
  const { updateVideo } = useLibraryStore();

  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const [lastSavedTime, setLastSavedTime] = useState(0);
  const [totalWatchedSeconds, setTotalWatchedSeconds] = useState(0);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityRef = useRef(document.visibilityState === 'visible');
  const focusRef = useRef(document.hasFocus());
  const lastTickRef = useRef<number | null>(null);

  const stateRef = useRef({ totalWatchedSeconds, lastSavedTime, activeWatchSession, playbackRate });
  useEffect(() => {
    stateRef.current = { totalWatchedSeconds, lastSavedTime, activeWatchSession, playbackRate };
  }, [totalWatchedSeconds, lastSavedTime, activeWatchSession, playbackRate]);

  if (!currentVideo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No Video Selected</h2>
          <p className="text-gray-600 mb-4">Please select a video from your library to watch.</p>
          <Button onClick={() => navigate('/library')}>
            Go to Library
          </Button>
        </div>
      </div>
    );
  }

  const updateWatchHistory = useCallback(async (session: WatchSession, seconds: number, rate: number): Promise<void> => {
    if (!session?.id || seconds <= 0) return;
    try {
      await DatabaseService.updateWatchSession(session.id, { secondsWatched: seconds, avgPlaybackRate: rate });
    } catch (error) {
      console.error('Failed to update watch history:', error);
    }
  }, []);
  
  const endWatchSession = useCallback(async () => {
    const { activeWatchSession: session, totalWatchedSeconds: watchedSeconds } = stateRef.current;
    if (!session || !currentVideo) return;
    
    try {
      const finalSeconds = Math.floor(watchedSeconds);
      if (finalSeconds > 0) {
        await DatabaseService.endWatchSession(session.id, finalSeconds);
        const video = await DatabaseService.getVideo(currentVideo.id);
        if (video) {
          updateVideo(currentVideo.id, {
            watchSeconds: (video.watchSeconds || 0) + finalSeconds,
            lastWatchedAt: new Date().toISOString()
          });
        }
        updateTotalSeconds(finalSeconds);
      }
    } finally {
      setActiveWatchSession(null);
      setTotalWatchedSeconds(0);
      setLastSavedTime(0);
    }
  }, [currentVideo, updateVideo, updateTotalSeconds, setActiveWatchSession]);

  const handleBack = useCallback(async () => {
    try {
      if (activeWatchSession) {
        await endWatchSession();
      }
    } catch (error) {
      console.error('Error ending watch session on back navigation:', error);
      toast.error('Could not save watch progress.');
    } finally {
      setCurrentView('library');
      navigate('/');
    }
  }, [activeWatchSession, setCurrentView, endWatchSession, navigate]);

  const handlePlayerStateChange = useCallback(async (state: number) => {
    const { activeWatchSession: session, totalWatchedSeconds: watched, lastSavedTime: saved, playbackRate: rate } = stateRef.current;
    switch (state) {
      case PlayerState.PLAYING: setIsPlaying(true); break;
      case PlayerState.PAUSED:
      case PlayerState.BUFFERING:
        setIsPlaying(false);
        if (session && watched > saved) {
          const flooredSeconds = Math.floor(watched);
          await updateWatchHistory(session, flooredSeconds, rate);
          setLastSavedTime(flooredSeconds);
        }
        break;
      case PlayerState.ENDED:
        setIsPlaying(false);
        if (session) await endWatchSession();
        break;
      default: break;
    }
  }, [endWatchSession, updateWatchHistory]);
  
  useEffect(() => {
    let mounted = true;
    let ytPlayer: any = null;

    const initializePlayer = () => {
      if (!window.YT?.Player || !currentVideo || !mounted) return;
      ytPlayer = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: currentVideo.youtubeId,
        playerVars: {
          controls: 0, disablekb: 1, enablejsapi: 1, fs: 0,
          modestbranding: 1, playsinline: 1, rel: 0, showinfo: 0,
        },
        events: {
          onReady: (event: any) => {
            if (!mounted) return;
            setPlayer(event.target);
            setIsPlayerReady(true);
            setDuration(event.target.getDuration());
            setPlaybackRate(event.target.getPlaybackRate());
            event.target.playVideo();
          },
          onStateChange: (event: any) => { if (mounted) handlePlayerStateChange(event.data); },
          onError: (event: { data: number }) => {
             console.error(`Youtubeer Error (Code: ${event.data})`);
             toast.error('Video player error occurred.');
          },
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = () => { if (mounted) initializePlayer(); };
      document.body.appendChild(tag);
    } else {
      initializePlayer();
    }
    return () => {
      mounted = false;
      if (stateRef.current.activeWatchSession) {
        endWatchSession().catch(error => console.error('Error during cleanup:', error));
      }
      ytPlayer?.destroy();
    };
  }, [currentVideo.youtubeId, endWatchSession, handlePlayerStateChange]);

  const startWatchSession = useCallback(async () => {
    if (!currentVideo || activeWatchSession) return;
    try {
      const session = await DatabaseService.startWatchSession(currentVideo.id);
      if (!session?.id) throw new Error('Failed to start watch session');
      setActiveWatchSession(session);
      setTotalWatchedSeconds(0);
      setLastSavedTime(0);
    } catch (error) {
      console.error('Failed to start watch session:', error);
      toast.error("Could not start tracking watch time.");
    }
  }, [currentVideo, activeWatchSession, setActiveWatchSession]);
  
  useEffect(() => {
    if (!isPlayerReady) return;
    const intervalId = setInterval(() => {
      if (!player) return;
      const playerState = player.getPlayerState();
      setCurrentTime(player.getCurrentTime());
      const isTracking = playerState === PlayerState.PLAYING && visibilityRef.current && focusRef.current;
      if (playerState === PlayerState.PLAYING && !activeWatchSession) {
        startWatchSession();
      }
      if (isTracking) {
        const now = performance.now();
        const lastTick = lastTickRef.current || now;
        let deltaSec = (now - lastTick) / 1000;
        if (deltaSec > 2) deltaSec = 1;
        setTotalWatchedSeconds(prev => prev + deltaSec);
        lastTickRef.current = now;
      } else {
        lastTickRef.current = null;
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [player, isPlayerReady, activeWatchSession, startWatchSession]);
  
  useEffect(() => {
    if (!activeWatchSession || totalWatchedSeconds < lastSavedTime + 10) return;
    const newFlooredSeconds = Math.floor(totalWatchedSeconds);
    updateWatchHistory(activeWatchSession, newFlooredSeconds, playbackRate);
    setLastSavedTime(newFlooredSeconds);
  }, [activeWatchSession, totalWatchedSeconds, lastSavedTime, playbackRate, updateWatchHistory]);
  
  useEffect(() => {
    const handleVisibilityChange = () => { visibilityRef.current = document.visibilityState === 'visible'; };
    const handleFocus = () => { focusRef.current = true; };
    const handleBlur = () => { focusRef.current = false; };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
  
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    showControlsTemporarily();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying, showControlsTemporarily]);
  
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    const state = player.getPlayerState();
    if (state === PlayerState.PLAYING) player.pauseVideo(); else player.playVideo();
    showControlsTemporarily();
  }, [player, showControlsTemporarily]);

  const seekTo = useCallback((time: number) => {
    if (!player) return;
    player.seekTo(time, true);
    setCurrentTime(time);
    showControlsTemporarily();
  }, [player, showControlsTemporarily]);

  const skip = useCallback((seconds: number) => {
    if (!player) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    seekTo(newTime);
  }, [player, currentTime, duration, seekTo]);

  const toggleMute = useCallback(() => {
    if (!player) return;
    if (player.isMuted()) { player.unMute(); setIsMuted(false); } 
    else { player.mute(); setIsMuted(true); }
    showControlsTemporarily();
  }, [player, showControlsTemporarily]);

  const changePlaybackRate = useCallback((rate: number) => {
    if (!player) return;
    player.setPlaybackRate(rate);
    setPlaybackRate(rate);
    showControlsTemporarily();
  }, [player, showControlsTemporarily]);

  // Get the daily goal from the app store
  const { weeklyGoal } = useAppStore();
  // Use weeklyGoal as the daily goal (in seconds)
  const dailyGoalSeconds = weeklyGoal || 5 * 3600; // Default to 5 hours if not set

  // Track daily watch time
  const [dailyWatchTime, setDailyWatchTime] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(0);

  // Update watch time
  useEffect(() => {
    const updateWatchTime = async () => {
      try {
        // Get today's date in local timezone
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Get all watch sessions
        const sessions = await DatabaseService.getAllWatchSessions();
        
        // Calculate total watch time for today
        const todaySessions = sessions.filter(session => 
          session.endedAt && session.endedAt.startsWith(today)
        );
        
        let todayWatchTime = todaySessions.reduce(
          (total, session) => total + (session.secondsWatched || 0), 0
        );
        
        // Add current session time if active
        if (activeWatchSession) {
          const currentSessionTime = Math.floor((Date.now() - new Date(activeWatchSession.startedAt).getTime()) / 1000);
          todayWatchTime += currentSessionTime;
        }
        
        setDailyWatchTime(todayWatchTime);
        setLastUpdated(Date.now());
      } catch (error) {
        console.error('Error updating watch time:', error);
      }
    };

    updateWatchTime();
    
    // Refresh more frequently if there's an active session
    const interval = setInterval(updateWatchTime, activeWatchSession ? 10000 : 60000);
    return () => clearInterval(interval);
  }, [activeWatchSession, lastUpdated]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    return dailyGoalSeconds > 0 ? Math.min(100, (dailyWatchTime / dailyGoalSeconds) * 100) : 0;
  }, [dailyWatchTime, dailyGoalSeconds]);
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 
      ? `${hours}h ${minutes}m` 
      : `${minutes}m`;
  };
  
  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 min-w-0">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Button>
            <div className="truncate">
              <h2 className="font-semibold truncate">{currentVideo.title}</h2>
              <p className="text-sm text-muted-foreground truncate">{currentVideo.channelTitle}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-shrink-0">
            <span>{formatTime(dailyWatchTime)} / {formatTime(dailyGoalSeconds)}</span>
            <Badge variant="secondary">{Math.round(progressPercentage)}% of daily goal</Badge>
          </div>
        </div>
      </div>
      
      <div 
        ref={playerContainerRef}
        className="relative flex-1 bg-black"
        onMouseMove={showControlsTemporarily}
        onTouchStart={showControlsTemporarily}
        onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      >
        <div id="youtube-player" className="w-full h-full" />

        {!isPlayerReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-center text-white">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p>Loading video...</p>
            </div>
          </div>
        )}

        <div className={cn("absolute inset-0 transition-opacity duration-300", showControls || !isPlaying ? "opacity-100" : "opacity-0")}>
          <div className="absolute inset-0 flex items-center justify-center" onClick={togglePlayPause} />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4" onClick={(e) => e.stopPropagation()}>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer mb-2"
              style={{ background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${progressPercentage}%, rgba(255,255,255,0.3) ${progressPercentage}%, rgba(255,255,255,0.3) 100%)` }}
            />
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" onClick={() => skip(-10)} className="hover:bg-white/20"><SkipBack className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" onClick={togglePlayPause} className="hover:bg-white/20">{isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}</Button>
                <Button variant="ghost" size="icon" onClick={() => skip(10)} className="hover:bg-white/20"><SkipForward className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" onClick={toggleMute} className="hover:bg-white/20">{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</Button>
                <span className="text-xs">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
              </div>
              <select value={playbackRate} onChange={(e) => changePlaybackRate(Number(e.target.value))} className="bg-transparent text-white text-xs rounded border border-white/30 px-2 py-1">
                <option value={0.5} style={{color: 'black'}}>0.5x</option>
                <option value={0.75} style={{color: 'black'}}>0.75x</option>
                <option value={1} style={{color: 'black'}}>1x</option>
                <option value={1.25} style={{color: 'black'}}>1.25x</option>
                <option value={1.5} style={{color: 'black'}}>1.5x</option>
                <option value={2} style={{color: 'black'}}>2x</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerView;