import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipForward, X, Volume2, VolumeX, HeadphonesIcon, Youtube } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { PodcastDatabaseService, type PodcastEpisode, type PodcastSession } from '@/lib/podcastDatabase';
import { DatabaseService, type Video } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { useToast } from '@/hooks/use-toast';

export const MiniPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressTimer = useRef<number | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const videoSessionIdRef = useRef<string | null>(null);
  const [session, setSession] = useState<PodcastSession | null>(null);
  const [meta, setMeta] = useState<{ podcast?: PodcastEpisode; video?: Video } | null>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [dailyTotal, setDailyTotal] = useState(0);
  const { toast } = useToast();

  const {
    current,
    isPlaying,
    next,
    stop,
    setPosition: setGlobalPos,
    setVolume,
    setMuted,
    muted,
    volume,
    playbackRate,
    pause,
    resume,
  } = usePlayerStore();

  const type = current?.type;
  const isPodcast = type === 'podcast';
  const isVideo = type === 'video';

  // Load metadata for the current item and fetch latest position
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!current) { setMeta(null); return; }
      try {
        if (current.type === 'podcast') {
          const ep = await PodcastDatabaseService.getEpisode(current.id);
          if (!canceled) {
            setMeta({ podcast: ep });
            if (ep) {
              const lastPos = await PodcastDatabaseService.getLastPositionForEpisode(ep.id);
              const mediaDuration = ep.duration_seconds || 0;
              let resumePosition = Math.max(0, lastPos || 0);

              // If last position is within the last 10 seconds, treat as completed and start from 0
              if (mediaDuration > 0 && resumePosition >= mediaDuration - 10) {
                resumePosition = 0;
              }
              setPosition(resumePosition);
              setGlobalPos(resumePosition);
            }
          }
        } else { // current.type === 'video'
          const v = await DatabaseService.getVideo(current.id);
          if (!canceled) {
            setMeta({ video: v });
            if (v) {
              const lastPos = v.lastPositionSeconds || 0;
              const mediaDuration = v.durationSeconds || 0;
              let resumePosition = Math.max(0, lastPos || 0);

              // If last position is within the last 10 seconds, treat as completed and start from 0
              if (mediaDuration > 0 && resumePosition >= mediaDuration - 10) {
                resumePosition = 0;
              }
              setPosition(resumePosition);
              setGlobalPos(resumePosition);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load media meta or last position', e);
      }
    })();
    return () => { canceled = true; };
  }, [current]);

  // Initialize daily total and subscribe
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const total = await dailyTimeTracker.loadDailyTime();
      setDailyTotal(total);
      unsub = dailyTimeTracker.subscribe((t) => setDailyTotal(t));
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  // Setup audio for podcasts
  useEffect(() => {
    const setup = async () => {
      if (!isPodcast || !meta?.podcast || !audioRef.current) return;
      const ep = meta.podcast;

      try {
        // Use the position already set by the metadata effect
        audioRef.current.currentTime = position;
        audioRef.current.src = ep.audio_url;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = muted ? 0 : volume;

        const s = await PodcastDatabaseService.startListenSession(ep.id);
        setSession(s);
      } catch (error) {
        console.error('Failed to setup podcast audio:', error);
      }
    };
    setup();
    // cleanup on change/end
    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      progressTimer.current = null;
      setSession(null);
    };
  }, [isPodcast, meta?.podcast?.id, position]); // Depend on position to ensure it's set before audio.currentTime

  // Setup YouTube mini-player for videos
  useEffect(() => {
    let mounted = true;
    const setupYT = async () => {
      if (!isVideo || !meta?.video) return;
      // Load YT iframe API if needed
      if (!(window as any).YT) {
        await new Promise<void>((resolve) => {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          (window as any).onYouTubeIframeAPIReady = () => resolve();
          document.body.appendChild(tag);
        });
      }

      const VideoId = meta.video.youtubeId;
      try {
        const s = await DatabaseService.startWatchSession(meta.video.id);
        videoSessionIdRef.current = s.id;
        if (!mounted) return;
        // Create hidden/small player
        ytPlayerRef.current = new (window as any).YT.Player(ytContainerRef.current, {
          height: '0',
          width: '0',
          videoId: VideoId,
          playerVars: { autoplay: 0, controls: 0 },
          events: {
            onReady: () => {
              if (!mounted) return;
              
              // Use the position already set by the metadata effect
              try { 
                ytPlayerRef.current.seekTo(position, true); 
              } catch (error) {
                console.error('Failed to seek to last position:', error);
              }
              
              if (isPlaying) {
                try { 
                  ytPlayerRef.current.playVideo(); 
                } catch (error) {
                  console.error('Failed to start video playback:', error);
                }
              }
            },
            onStateChange: async (e: any) => {
              if (!mounted || !ytPlayerRef.current) return;
              
              if (!ytPlayerRef.current) return;
              const YT = (window as any).YT;
              if (e.data === YT.PlayerState.ENDED) {
                // End session and mark as completed
                const cur = Math.max(0, Math.floor(ytPlayerRef.current.getCurrentTime() || 0));
                try {
                  if (videoSessionIdRef.current) {
                    await DatabaseService.endWatchSession(videoSessionIdRef.current, cur);
                  }
                  await DatabaseService.updateVideoProgress(meta.video!.id, cur);
                  await DatabaseService.markVideoAsCompleted(meta.video!.id);
                } catch (error) {
                  console.error('Failed to end video session:', error);
                }
                next();
              } else if (e.data === YT.PlayerState.PAUSED) {
                // Persist progress on pause
                const cur = Math.max(0, Math.floor(ytPlayerRef.current.getCurrentTime() || 0));
                try {
                  if (videoSessionIdRef.current) {
                    await DatabaseService.updateWatchSession(videoSessionIdRef.current, { secondsWatched: cur });
                  }
                  await DatabaseService.updateVideoProgress(meta.video!.id, cur);
                } catch (error) {
                  console.error('Failed to update video progress:', error);
                }
              }
            }
          }
        });

        // Progress interval for video
        if (progressTimer.current) window.clearInterval(progressTimer.current);
        progressTimer.current = window.setInterval(async () => {
          if (!mounted || !ytPlayerRef.current) return;
          
          const cur = Math.max(0, Math.floor(ytPlayerRef.current.getCurrentTime() || 0));
          const dur = Math.max(0, Math.floor(ytPlayerRef.current.getDuration() || (meta.video?.durationSeconds || 0)));
          
          // Only update if we have valid values
          if (cur < 0 || dur <= 0) return;
          
          setDuration(dur);
          setPosition(cur);
          setGlobalPos(cur);
          
          // Only add time if video is actually playing
          const playerState = ytPlayerRef.current.getPlayerState();
          const YT = (window as any).YT;
          if (playerState === YT.PlayerState.PLAYING) {
            await dailyTimeTracker.addTime(1);
          }
          
          try {
            if (videoSessionIdRef.current) {
              await DatabaseService.updateWatchSession(videoSessionIdRef.current, { secondsWatched: cur });
            }
            await DatabaseService.updateVideoProgress(meta.video!.id, cur);
          } catch (error) {
            console.error('Failed to update video progress:', error);
          }
          
          // Mark as completed when near the end (90% watched or 1 minute remaining)
          const completionThreshold = Math.min(dur * 0.9, dur - 60);
          if (dur >= 120 && cur >= completionThreshold && !meta.video?.isCompleted) {
            try { 
              await DatabaseService.markVideoAsCompleted(meta.video!.id); 
            } catch (error) {
              console.error('Failed to mark video as completed:', error);
            }
          }
        }, 1000) as unknown as number;
      } catch (e) {
        console.error('Failed to initialize video mini-player', e);
      }
    };

    setupYT();
    return () => {
      mounted = false;
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      progressTimer.current = null;
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try { ytPlayerRef.current.destroy(); } catch {}
      }
      ytPlayerRef.current = null;
      videoSessionIdRef.current = null;
    };
  }, [isVideo, meta?.video?.id, isPlaying, position]); // Depend on position to ensure it's set before ytPlayer.seekTo

  // Persist video progress on tab hidden / unload
  useEffect(() => {
    const persistVideo = async () => {
      if (!ytPlayerRef.current || !meta?.video) return;
      const cur = Math.floor(ytPlayerRef.current.getCurrentTime() || 0);
      try {
        if (videoSessionIdRef.current) {
          await DatabaseService.updateWatchSession(videoSessionIdRef.current, { secondsWatched: cur });
        }
        await DatabaseService.updateVideoProgress(meta.video.id, cur);
      } catch {}
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void persistVideo();
      }
    };
    const onBeforeUnload = () => { void persistVideo(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [meta?.video?.id]);

  // Control playback state
  useEffect(() => {
    if (isPodcast && audioRef.current) {
      if (isPlaying) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    }
  }, [isPlaying, isPodcast]);

  // Track progress and persist
  useEffect(() => {
    if (!isPodcast || !session || !audioRef.current) return;
    if (progressTimer.current) window.clearInterval(progressTimer.current);

    progressTimer.current = window.setInterval(async () => {
      const a = audioRef.current!;
      const pos = Math.floor(a.currentTime);
      setPosition(pos);
      setGlobalPos(pos);
      // increment daily time in whole seconds
      await dailyTimeTracker.addTime(1);
      try {
        await PodcastDatabaseService.updateListenSession(session.id, {
          seconds_listened: pos,
        });
        await PodcastDatabaseService.updateEpisodeProgress(session.episode_id as unknown as string, pos);
      } catch (e) {
        // ignore transient errors
      }

      // completion check
      const dur = a.duration || meta?.podcast?.duration_seconds || 0;
      if (dur >= 120 && dur - pos <= 60 && !meta?.podcast?.is_completed) {
        try { await PodcastDatabaseService.markEpisodeAsCompleted(meta!.podcast!.id); } catch {}
      }
    }, 1000) as unknown as number;

    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    };
  }, [isPodcast, session, meta?.podcast?.id]);

  const onEnded = async () => {
    if (session) {
      try { await PodcastDatabaseService.endListenSession(session.id, Math.floor(audioRef.current?.currentTime || 0)); } catch {}
      setSession(null);
    }
    next();
  };

  const onSeek = (vals: number[]) => {
    const v = vals[0];
    setPosition(v);
    setGlobalPos(v);
    if (isPodcast && audioRef.current) {
      audioRef.current.currentTime = v;
    } else if (isVideo && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(v, true);
    }
  };

  const show = !!current;
  if (!show) return null;

  const title = isPodcast ? meta?.podcast?.title : meta?.video?.title;
  const thumb = isPodcast ? (meta?.podcast?.thumbnail_url || meta?.podcast?.podcast?.thumbnail_url) : meta?.video?.thumbnailUrl;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 pointer-events-none">
      <Card className="mx-auto max-w-3xl w-full p-3 shadow-xl bg-background/95 backdrop-blur pointer-events-auto">
        <div className="flex items-center gap-3">
          {thumb ? (
            <img src={thumb} alt={title || ''} className="w-12 h-12 rounded object-cover" />
          ) : (
            <div className="w-12 h-12 rounded bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{title || (isVideo ? 'Video' : 'Podcast')}</div>
            <div className="flex items-center gap-2">
              <Slider
                value={[position]}
                max={Math.max(1, duration || (isPodcast ? (meta?.podcast?.duration_seconds || 0) : (meta?.video?.durationSeconds || 0)))}
                step={1}
                onValueChange={onSeek}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPodcast ? (
              <>
                <Button size="icon" variant="ghost" onClick={() => (isPlaying ? pause() : resume())}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={next}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="icon" variant="ghost" onClick={() => (isPlaying ? pause() : resume())}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={next}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button size="icon" variant="ghost" onClick={() => stop()}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
      {/* Hidden audio element for podcast playback */}
      {isPodcast && (
        <audio
          ref={audioRef}
          onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || (meta?.podcast?.duration_seconds || 0))}
          onEnded={onEnded}
          preload="metadata"
        />
      )}
      {/* Hidden container for YouTube mini-player */}
      {isVideo && (
        <div ref={ytContainerRef} style={{ width: 0, height: 0, overflow: 'hidden' }} />
      )}
    </div>
  );
};