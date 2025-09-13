import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { DatabaseService } from '@/lib/database';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { useToast } from '@/hooks/use-toast';

interface UseYouTubePlayerProps {
  currentVideo: {
    id: string;
    youtubeId: string;
    durationSeconds: number;
  } | null;
  youtubeIframeRef: React.RefObject<HTMLDivElement>; // This is the container div
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
  const progressIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  // --- Media Session API ---
  useEffect(() => {
    if (!currentVideo || !('mediaSession' in navigator)) return;

    const playerStore = usePlayerStore.getState();
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

  // Effect: Load YouTube API script
  useEffect(() => {
    if (!(window as any).YT && !document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Effect: Setup YouTube player and manage its lifecycle
  useEffect(() => {
    if (!currentVideo || !youtubeIframeRef.current) {
      // If no current video or ref is gone, ensure player is stopped/destroyed
      if (ytPlayerInstance.current && typeof ytPlayerInstance.current.destroy === 'function') {
        try { ytPlayerInstance.current.destroy(); } catch (e) { console.warn("Error destroying YT player:", e); }
        ytPlayerInstance.current = null;
      }
      return;
    }

    const videoItem = currentVideo;
    const playerContainer = youtubeIframeRef.current;
    let playerElementId = `youtube-player-${videoItem.id}`; // Unique ID for the iframe

    const onYouTubeIframeAPIReady = () => {
      // Check if an iframe with this ID already exists
      let existingIframe = document.getElementById(playerElementId) as HTMLIFrameElement;

      if (existingIframe && existingIframe.parentElement !== playerContainer) {
        // If iframe exists but is in the wrong parent, move it
        playerContainer.appendChild(existingIframe);
        ytPlayerInstance.current = (window as any).YT.get(playerElementId);
        console.log(`Moved existing YouTube player for ${videoItem.youtubeId}`);
        // Re-sync player state
        if (ytPlayerInstance.current) {
          ytPlayerInstance.current.seekTo(localPosition, true);
          ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
          ytPlayerInstance.current.setPlaybackRate(playbackRate);
          if (isPlaying) {
            try { ytPlayerInstance.current.playVideo(); } catch (e) { console.error("YT play failed after move:", e); }
          } else {
            ytPlayerInstance.current.pauseVideo();
          }
          setLocalDuration(ytPlayerInstance.current.getDuration());
        }
      } else if (!existingIframe) {
        // Create a new div to hold the player, then create the player
        const playerDiv = document.createElement('div');
        playerDiv.id = playerElementId;
        playerDiv.className = 'w-full h-full'; // Ensure it fills the container
        playerContainer.appendChild(playerDiv);

        ytPlayerInstance.current = new (window as any).YT.Player(playerElementId, {
          videoId: videoItem.youtubeId,
          playerVars: {
            autoplay: 0, // We control autoplay via playVideo()
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            fs: 0, // No fullscreen in mini-player by default, PlayerView will override
          },
          events: {
            onReady: (event: any) => {
              ytPlayerInstance.current = event.target;
              if (ytPlayerInstance.current && typeof ytPlayerInstance.current.seekTo === 'function') {
                ytPlayerInstance.current.seekTo(localPosition, true);
                ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
                ytPlayerInstance.current.setPlaybackRate(playbackRate);
                
                if (usePlayerStore.getState().isPlaying) {
                  try {
                    ytPlayerInstance.current.playVideo();
                  } catch (e: any) {
                    console.error("YT Autoplay failed:", e);
                    toast({ title: "Autoplay Blocked", description: "Autoplay blocked. Tap play to watch.", variant: "info" });
                    pause();
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
              toast({ title: "Error", description: "YouTube Player Error: Could not load video.", variant: "destructive" });
              clearCurrent();
            }
          },
        });
        console.log(`Created new YouTube player for ${videoItem.youtubeId}`);
      } else {
        // Player already exists and is in the correct container, just update video if needed
        if (ytPlayerInstance.current && ytPlayerInstance.current.getVideoData().video_id !== videoItem.youtubeId) {
          ytPlayerInstance.current.loadVideoById(videoItem.youtubeId, localPosition);
          console.log(`Loaded new video ${videoItem.youtubeId} into existing player`);
        }
        // Ensure state is synced
        if (ytPlayerInstance.current) {
          ytPlayerInstance.current.seekTo(localPosition, true);
          ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
          ytPlayerInstance.current.setPlaybackRate(playbackRate);
          if (isPlaying) {
            try { ytPlayerInstance.current.playVideo(); } catch (e) { console.error("YT play failed on sync:", e); }
          } else {
            ytPlayerInstance.current.pauseVideo();
          }
          setLocalDuration(ytPlayerInstance.current.getDuration());
        }
      }

      // Start watch session if not already active for this video
      if (!videoSessionIdRef.current || videoSessionIdRef.current.split('-')[0] !== videoItem.id) { // Simple check for video ID in session ID
        (async () => {
          try {
            const s = await DatabaseService.startWatchSession(videoItem.id);
            videoSessionIdRef.current = s.id;
          } catch (error) {
            console.error('Failed to start video watch session:', error);
            toast({ title: "Error", description: "Failed to start video session.", variant: "destructive" });
            clearCurrent();
          }
        })();
      }
    };

    // Wait for YouTube API to be ready
    if ((window as any).YT && (window as any).YT.Player) {
      onYouTubeIframeAPIReady();
    } else {
      // If API not ready, set the global callback
      (window as any).onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    }

    return () => {
      // Cleanup: When component unmounts or currentVideo changes
      // If the iframe is moved, we don't destroy the player.
      // Only destroy if the current video is cleared completely.
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    };
  }, [currentVideo?.id, currentVideo?.youtubeId, youtubeIframeRef, localPosition, playbackRate, volume, muted, isPlaying, pause, resume, next, clearCurrent, setLocalDuration, toast]);

  // Effect: Sync global isPlaying state to YouTube player
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
  }, [isPlaying, currentVideo, ytPlayerInstance.current]);

  // Effect: Sync volume/mute to YouTube player
  useEffect(() => {
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setVolume === 'function') {
      ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
    }
  }, [volume, muted, ytPlayerInstance.current]);

  // Effect: Sync playback rate to YouTube player
  useEffect(() => {
    if (ytPlayerInstance.current && typeof ytPlayerInstance.current.setPlaybackRate === 'function') {
      ytPlayerInstance.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate, ytPlayerInstance.current]);

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
      usePlayerStore.getState().setPosition(currentPos);
      setLocalDuration(currentDur);

      await dailyTimeTracker.addTime(1);
      try {
        if (videoSessionIdRef.current) {
          await DatabaseService.updateWatchSession(videoSessionIdRef.current, { secondsWatched: currentPos });
          await DatabaseService.updateVideoProgress(currentVideo.id, currentPos);
        }
      } catch (e) {
        console.error('Error updating video progress:', e);
      }

      const completionThreshold = Math.min(currentDur * 0.9, currentDur - 60);
      if (currentDur >= 120 && currentPos >= completionThreshold) {
        try {
          await DatabaseService.markVideoAsCompleted(currentVideo.id);
        } catch (e) {
          console.error('Failed to mark video as completed:', e);
        }
      }
    }, 1000) as unknown as number;

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