import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { DatabaseService } from '@/lib/database';
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
  const { toast } = useToast();

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
              ytPlayerInstance.current.seekTo(localPosition, true);
              ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
              ytPlayerInstance.current.setPlaybackRate(playbackRate);
              
              // Only attempt autoplay if `isPlaying` is true from the store
              if (usePlayerStore.getState().isPlaying) { // Check current store state
                ytPlayerInstance.current.playVideo().catch((e: any) => {
                  console.error("YT Autoplay failed:", e);
                  toast({
                    title: "Autoplay Blocked",
                    description: "Autoplay blocked. Tap play to watch.",
                    variant: "info"
                  });
                  pause(); // Update store state to paused
                });
              }
              setLocalDuration(ytPlayerInstance.current.getDuration());
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
    };
  }, [currentVideo?.id, localPosition, youtubeIframeRef, playbackRate, volume, muted, next, pause, resume, clearCurrent, setLocalDuration, toast]); // Dependencies for initial setup

  // Effect 2: Sync global isPlaying state to YouTube player
  useEffect(() => {
    if (!currentVideo || !ytPlayerInstance.current) return;
    const YT = (window as any).YT;
    if (isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PLAYING) {
      try { ytPlayerInstance.current.playVideo(); } catch (e) { console.error("YT play failed:", e); }
    } else if (!isPlaying && ytPlayerInstance.current.getPlayerState() !== YT.PlayerState.PAUSED) {
      try { ytPlayerInstance.current.pauseVideo(); } catch (e) { console.error("YT pause failed:", e); }
    }
  }, [isPlaying, currentVideo]); // Only re-run when isPlaying or currentVideo changes

  // Effect 3: Sync volume/mute to YouTube player
  useEffect(() => {
    if (ytPlayerInstance.current) {
      ytPlayerInstance.current.setVolume(muted ? 0 : volume * 100);
    }
  }, [volume, muted]);

  // Effect 4: Sync playback rate to YouTube player
  useEffect(() => {
    if (ytPlayerInstance.current) {
      ytPlayerInstance.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

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