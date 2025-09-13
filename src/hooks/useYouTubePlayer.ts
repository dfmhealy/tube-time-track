import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore'; // Corrected import
import { DatabaseService } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { useToast } from '@/hooks/use-toast';

interface UseYouTubePlayerProps {
  currentVideo: {
    id: string;
    youtubeId: string;
    durationSeconds: number;
  } | null;
  youtubeIframeRef: React.RefObject<HTMLDivElement>;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  localPosition: number;
  setLocalPosition: (pos: number) => void;
  setLocalDuration: (dur: number) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  clearCurrent: () => void;
}

export const useYouTubePlayer = ({
  currentVideo,
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
}: UseYouTubePlayerProps) => {
  const ytPlayerInstance = useRef<any>(null); // Reference to the actual YouTube player object
  const videoSessionIdRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<number | null>(null); // Local progress interval
  const { toast } = useToast();

  // --- Media Session API ---
  useEffect(() => {
    if (!currentVideo || !('mediaSession' in navigator)) return;

    const playerStore = usePlayerStore.getState(); // Get current state for metadata
    const currentItem = playerStore.current;

    if (!currentItem || currentItem.type !== 'video') return;

    const mediaTitle = currentItem.title;
    const mediaArtist = currentItem.channelTitle;
    const mediaArtwork = [{ src: currentItem.thumbnailUrl, sizes: '96x96', type: 'image/jpeg' }];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: mediaTitle,
      artist: mediaArtist,
      album: 'YouTube Video',
      artwork: mediaArtwork,
    });

    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const seekTime = playerStore.positionSeconds - (details.seekOffset || 10);
      playerStore.setPosition(Math.max(0, seekTime));
      if (ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') ytPlayerInstance.current.seekTo(Math.max(0, seekTime), true);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const seekTime = playerStore.positionSeconds + (details.seekOffset || 10);
      playerStore.setPosition(Math.min(currentVideo.durationSeconds, seekTime));
      if (ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') ytPlayerInstance.current.seekTo(Math.min(currentVideo.durationSeconds, seekTime), true);
    });
    navigator.mediaSession.setActionHandler('stop', () => clearCurrent());

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('stop', null);
      }
    };
  }, [currentVideo, isPlaying, resume, pause, next, clearCurrent]);

  // Effect 1: Setup YouTube player and initial session
  useEffect(() => {
    if (!currentVideo || !youtubeIframeRef.current) return;

    const videoItem = currentVideo;
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
          videoId: videoItem.youtubeId,
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
              if (ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') {
                ytPlayerInstance.current.seekTo(localPosition, true);
                ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
                ytPlayerInstance.current.setPlaybackRate(playbackRate);
                
                // Only attempt autoplay if `isPlaying` is true from the store
                if (usePlayerStore.getState().isPlaying) { // Check current store state
                  try {
                    ytPlayerInstance.current.playVideo();
                  } catch (e: any) {
                    console.error("YT Autoplay failed:", e);
                    toast({
                      title: "Autoplay Blocked",
                      description: "Autoplay blocked. Tap play to watch.",
                      variant: "info"
                    });
                    pause(); // Update store state to paused
                  }
                }
                setLocalDuration(ytPlayerInstance.current.getDuration());
              }
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
      videoSessionIdRef.current = null;
      // Do NOT destroy the player here if it's just minimizing/expanding
      // The iframe element is moved, not destroyed.
      // Only destroy if clearCurrent is called and no longer needed.
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentVideo?.id, localPosition, youtubeIframeRef, playbackRate, volume, muted, next, pause, resume, clearCurrent, setLocalDuration, toast]); // Dependencies for initial setup

  // Effect 2: Sync global isPlaying state to YouTube player
  useEffect(() => {
    if (!currentVideo || !ytPlayerInstance.current || typeof ytPlayerInstance.current.getPlayerState !== 'function') return;
    const YT = (window as any).YT;
    if (isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PLAYING) {
      try { 
        if (typeof ytPlayerInstance.current.playVideo === 'function') {
          ytPlayerInstance.current.playVideo(); 
        }
      } catch (e) { console.error("YT play failed:", e); }
    } else if (!isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PAUSED) {
      try { 
        if (typeof ytPlayerInstance.current.pauseVideo === 'function') {
          ytPlayerInstance.current.pauseVideo(); 
        }
      } catch (e) { console.error("YT pause failed:", e); }
    }
  }, [isPlaying, currentVideo]); // Only re-run when isPlaying or currentVideo changes

  // Effect 3: Sync volume/mute to YouTube player
  useEffect(() => {
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setVolume === 'function') {
      ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
    }
  }, [volume, muted]);

  // Effect 4: Sync playback rate to YouTube player
  useEffect(() => {
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setPlaybackRate === 'function') {
      ytPlayerInstance.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  // --- Progress Tracking and Persistence (1-second interval) ---
  useEffect(() => {
    if (!currentVideo || !ytPlayerInstance.current || typeof ytPlayerInstance.current.getCurrentTime !== 'function' || typeof ytPlayerInstance.current.getDuration !== 'function' || typeof ytPlayerInstance.current.getPlayerState !== 'function') {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      return;
    }

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = window.setInterval(async () => {
      const currentYTPlayer = ytPlayerInstance.current;
      if (!currentYTPlayer || typeof currentYTPlayer.getCurrentTime !== 'function' || currentYTPlayer.getPlayerState() !== (window as any).YT.PlayerState.PLAYING) return;

      const currentPos = Math.floor(currentYTPlayer.getCurrentTime());
      const currentDur = Math.floor(currentYTPlayer.getDuration());
      
      setLocalPosition(currentPos);
      usePlayerStore.getState().setPosition(currentPos); // Update global position
      setLocalDuration(currentDur);

      await dailyTimeTracker.addTime(1); // Increment daily watch time
      try {
        if (videoSessionIdRef.current) {
          await DatabaseService.updateWatchSession(videoSessionIdRef.current, { secondsWatched: currentPos });
          await DatabaseService.updateVideoProgress(currentVideo.id, currentPos);
        }
      } catch (e) {
        console.error('Error updating video progress:', e);
      }

      // Mark as completed when near the end (90% watched or 1 minute remaining)
      const completionThreshold = Math.min(currentDur * 0.9, currentDur - 60);
      if (currentDur >= 120 && currentPos >= completionThreshold) {
        try {
          await DatabaseService.markVideoAsCompleted(currentVideo.id);
        } catch (e) {
          console.error('Failed to mark video as completed:', e);
        }
      }
    }, 1000) as unknown as number; // Update every 1 second

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    };
  }, [currentVideo?.id, isPlaying, videoSessionIdRef.current, setLocalPosition, setLocalDuration]);

  // --- Persist Progress on Unload/Visibility Change ---
  useEffect(() => {
    const persistProgress = async () => {
      if (!currentVideo || !ytPlayerInstance.current || typeof ytPlayerInstance.current.getCurrentTime !== 'function') return;
      const currentPos = Math.floor(ytPlayerInstance.current.getCurrentTime());

      if (currentPos > 0) {
        try {
          if (videoSessionIdRef.current) {
            await DatabaseService.endWatchSession(videoSessionIdRef.current, currentPos);
          }
          await DatabaseService.updateVideoProgress(currentVideo.id, currentPos);
        } catch (e) {
          console.error('Error persisting video progress on unload:', e);
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
  }, [currentVideo?.id, videoSessionIdRef.current, ytPlayerInstance.current]);

  const handleVideoEnded = async () => {
    if (!currentVideo) return;
    try {
      if (videoSessionIdRef.current) {
        await DatabaseService.endWatchSession(videoSessionIdRef.current, currentVideo.durationSeconds);
      }
      await DatabaseService.markVideoAsCompleted(currentVideo.id);
      await DatabaseService.updateVideoProgress(currentVideo.id, currentVideo.durationSeconds);
    } catch (e) {
      console.error("Error ending video session:", e);
    }
    next();
  };

  return { ytPlayerInstance, videoSessionIdRef };
};