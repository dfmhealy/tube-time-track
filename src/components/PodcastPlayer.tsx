import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX,
  Clock,
  HeadphonesIcon,
  Target
} from 'lucide-react';
import { cn, formatDuration, formatTimeHMS } from '@/lib/utils';
import { PodcastDatabaseService, type PodcastEpisode, type PodcastSession } from '@/lib/podcastDatabase';
import { useToast } from '@/hooks/use-toast';
import { useAppStore, useStatsStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';

interface PodcastPlayerProps {
  episode: PodcastEpisode;
  onClose?: () => void;
}

export function PodcastPlayer({ episode, onClose }: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<PodcastSession | null>(null);
  const [totalListenTime, setTotalListenTime] = useState(0);
  
  // Daily goal tracking
  const { dailyGoal } = useAppStore();
  const { updateTotalSeconds } = useStatsStore();
  const [dailyListenTime, setDailyListenTime] = useState(0);
  const [sessionListenTime, setSessionListenTime] = useState(0);
  
  const { toast } = useToast();

  // Get daily goal (use dailyGoal in seconds)
  const dailyGoalSeconds = dailyGoal || 30 * 60; // Default to 30 minutes if not set

  // Load daily listen time using unified tracker
  useEffect(() => {
    const loadDailyTime = async () => {
      const totalTime = await dailyTimeTracker.loadDailyTime();
      setDailyListenTime(totalTime);
    };

    loadDailyTime();

    // Subscribe to real-time updates
    const unsubscribe = dailyTimeTracker.subscribe((newTime) => {
      setDailyListenTime(newTime);
    });

    return unsubscribe;
  }, []);

  // Initialize session and previous listen time
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const listenTime = await PodcastDatabaseService.getTotalListenTimeForEpisode(episode.id);
        setTotalListenTime(listenTime);

        const newSession = await PodcastDatabaseService.startListenSession(episode.id);
        setSession(newSession);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        toast({
          title: "Session Error",
          description: "Failed to track listening progress",
          variant: "destructive"
        });
      }
    };

    initializeSession();

    return () => {
      if (session && sessionListenTime > 0) {
        PodcastDatabaseService.endListenSession(session.id, currentTime)
          .then(() => {
            updateTotalSeconds(sessionListenTime);
          })
          .catch(console.error);
      }
    };
  }, [episode.id, sessionListenTime, updateTotalSeconds]);

  // Audio event handlers
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setLoading(false);
      
      // Resume from previous listen position if available (only if listened for more than 30 seconds)
      if (episode.last_position_seconds && episode.last_position_seconds > 30 && episode.last_position_seconds < audioRef.current.duration - 30) {
        audioRef.current.currentTime = episode.last_position_seconds;
        setCurrentTime(episode.last_position_seconds);
      }
    }
  }, [episode.last_position_seconds]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && !audioRef.current.seeking) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleEnded = useCallback(async () => {
    setIsPlaying(false);
    if (session) {
      try {
        await PodcastDatabaseService.endListenSession(session.id, duration);
        toast({
          title: "Episode Complete",
          description: "Your listening progress has been saved",
        });
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
  }, [session, duration]);

  // Progress tracking with session listen time
  useEffect(() => {
    if (isPlaying && session) {
      const startTime = Date.now();
      let lastUpdate = startTime;
      
      progressIntervalRef.current = setInterval(async () => {
        if (audioRef.current) {
          const now = Date.now();
          const deltaSeconds = (now - lastUpdate) / 1000;
          
          setSessionListenTime(prev => prev + deltaSeconds);
          dailyTimeTracker.addTime(deltaSeconds);
          
          const currentSeconds = Math.floor(audioRef.current.currentTime);
          try {
            await PodcastDatabaseService.updateListenSession(session.id, {
              seconds_listened: currentSeconds,
              avg_playback_rate: playbackRate
            });
          } catch (error) {
            console.error('Failed to update session:', error);
          }
          
          lastUpdate = now;
        }
      }, 1000);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, session, playbackRate]);

  // Playback controls
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const skipForward = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 30, duration);
    }
  }, [duration]);

  const skipBackward = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 15, 0);
    }
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    if (audioRef.current) {
      const newTime = value[0];
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    if (audioRef.current) {
      const newVolume = value[0];
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  const completionPercentage = duration > 0 ? Math.min((totalListenTime / duration) * 100, 100) : 0;
  const remainingTime = Math.max(duration - totalListenTime, 0);
  const dailyProgressPercent = Math.min((dailyListenTime / dailyGoalSeconds) * 100, 100);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-background/95 backdrop-blur">
        <CardContent className="p-6">
          {/* Daily Goal Progress */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Daily Goal Progress</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatTimeHMS(dailyListenTime)} / {formatTimeHMS(dailyGoalSeconds)}
              </span>
            </div>
            <Progress value={dailyProgressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {dailyProgressPercent >= 100 ? '🎉 Goal achieved!' : `${Math.round(dailyProgressPercent)}% complete`}
            </p>
          </div>

          {/* Episode Info */}
          <div className="flex items-start gap-4 mb-6">
            <div className="relative">
              <img
                src={episode.thumbnail_url || episode.podcast?.thumbnail_url}
                alt={episode.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="absolute inset-0 bg-gradient-primary/20 rounded-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-foreground mb-1 line-clamp-2">
                {episode.title}
              </h2>
              <p className="text-muted-foreground mb-2">{episode.podcast?.title}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(episode.duration_seconds)}
                </div>
                {completionPercentage > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <HeadphonesIcon className="w-3 h-3" />
                    {Math.round(completionPercentage)}% complete
                  </Badge>
                )}
              </div>
              {remainingTime > 0 && remainingTime < episode.duration_seconds && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDuration(remainingTime)} remaining
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </Button>
          </div>

          {/* Audio Element */}
          <audio
            ref={audioRef}
            src={episode.audio_url}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            preload="metadata"
          />

          {/* Progress Bar */}
          <div className="space-y-2 mb-6">
            <Slider
              value={[currentTime]}
              max={duration}
              step={1}
              onValueChange={handleSeek}
              className="w-full"
              disabled={loading}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={skipBackward}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipBack className="w-5 h-5" />
              <span className="sr-only">Skip back 15 seconds</span>
            </Button>

            <Button
              onClick={togglePlayPause}
              disabled={loading}
              size="lg"
              className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={skipForward}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="w-5 h-5" />
              <span className="sr-only">Skip forward 30 seconds</span>
            </Button>
          </div>

          {/* Additional Controls */}
          <div className="flex items-center justify-between">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="text-muted-foreground hover:text-foreground"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Speed:</span>
              <div className="flex gap-1">
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <Button
                    key={rate}
                    variant={playbackRate === rate ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handlePlaybackRateChange(rate)}
                    className="text-xs px-2 py-1 h-auto"
                  >
                    {rate}×
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}