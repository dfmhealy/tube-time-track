import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { PodcastDatabaseService, type PodcastSession } from '@/lib/podcastDatabase';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { getProxiedAudioUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface UsePodcastPlayerProps {
  currentPodcast: {
    id: string;
    audioUrl: string;
    durationSeconds: number;
  } | null;
  audioRef: React.RefObject<HTMLAudioElement>;
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

export const usePodcastPlayer = ({
  currentPodcast,
  audioRef,
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
}: UsePodcastPlayerProps) => {
  const [podcastSession, setPodcastSession] = useState<PodcastSession | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const isSeeking = useRef(false);
  const lastSeekTime = useRef(0);
  const initialPositionApplied = useRef(false);
  const { toast } = useToast();

  // Centralized seek handler
  const handleSeek = (seekTime: number) => {
    if (!audioRef.current || !currentPodcast) return;
    
    const validSeekTime = Math.max(0, Math.min(seekTime, audioRef.current.duration || currentPodcast.durationSeconds));
    
    isSeeking.current = true;
    lastSeekTime.current = Date.now();
    
    setLocalPosition(validSeekTime);
    usePlayerStore.getState().setPosition(validSeekTime);
    audioRef.current.currentTime = validSeekTime;
    
    // Clear seeking flag after a short delay
    setTimeout(() => {
      isSeeking.current = false;
    }, 500);
  };

  // --- Media Session API ---
  useEffect(() => {
    if (!currentPodcast || !('mediaSession' in navigator)) return;

    const playerStore = usePlayerStore.getState();
    const currentItem = playerStore.current;

    if (!currentItem || currentItem.type !== 'podcast') return;

    const mediaTitle = currentItem.title;
    const mediaArtist = currentItem.creator;
    const mediaArtwork = [{ src: currentItem.thumbnailUrl, sizes: '96x96', type: 'image/jpeg' }];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: mediaTitle,
      artist: mediaArtist,
      album: currentItem.creator,
      artwork: mediaArtwork,
    });

    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const seekTime = Math.max(0, playerStore.positionSeconds - (details.seekOffset || 10));
      handleSeek(seekTime);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const currentDuration = audioRef.current?.duration || currentPodcast.durationSeconds;
      const seekTime = Math.min(currentDuration, playerStore.positionSeconds + (details.seekOffset || 10));
      handleSeek(seekTime);
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
  }, [currentPodcast, isPlaying, resume, pause, next, clearCurrent, audioRef]);

  // Effect 1: Setup audio source and initial session
  useEffect(() => {
    if (!currentPodcast || !audioRef.current) return;

    // Reset the flag when a new podcast is loaded
    initialPositionApplied.current = false;

    const ep = currentPodcast;
    const audio = audioRef.current;

    const tryLoadAndAutoplayAudio = async (url: string, initialPosition: number) => {
      // Set duration first if available
      if (ep.durationSeconds > 0) {
        setLocalDuration(ep.durationSeconds);
      }

      // Apply initial position
      audio.currentTime = initialPosition;
      initialPositionApplied.current = true;
      
      audio.playbackRate = playbackRate;
      audio.volume = muted ? 0 : volume;

      const AUDIO_PROXY_COUNT = 3;
      const urlsToTry = [url];
      for (let i = 0; i < AUDIO_PROXY_COUNT; i++) {
        urlsToTry.push(getProxiedAudioUrl(url, i));
      }

      for (const currentUrl of urlsToTry) {
        audio.src = currentUrl;
        audio.load();

        try {
          await new Promise<void>((resolve, reject) => {
            const onCanPlay = () => {
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              resolve();
            };
            const onError = (e: Event) => {
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              reject(new Error(`Audio load error: ${e.type}`));
            };

            audio.addEventListener('canplay', onCanPlay);
            audio.addEventListener('error', onError);
            if (audio.readyState >= 3) onCanPlay();
          });

          // Re-apply position after load
          if (!initialPositionApplied.current) {
            audio.currentTime = initialPosition;
            initialPositionApplied.current = true;
          }

          if (usePlayerStore.getState().isPlaying) {
            await audio.play();
            console.log(`Podcast playback successful with URL: ${currentUrl}`);
          }
          return true;
        } catch (e: any) {
          console.warn(`Podcast load/playback failed with URL: ${currentUrl}`, e);
          if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
            toast({
              title: "Autoplay Blocked",
              description: "Autoplay blocked. Tap play to listen.",
              variant: "default"
            });
            pause();
          } else {
            toast({
              title: "Error",
              description: `Failed to load podcast: ${e.message}`,
              variant: "destructive"
            });
            clearCurrent();
          }
        }
      }
      throw new Error('All podcast playback attempts failed.');
    };

    const setupAndPlay = async () => {
      try {
        const s = await PodcastDatabaseService.startListenSession(ep.id);
        setPodcastSession(s);
      } catch (error) {
        console.error('Failed to start podcast session:', error);
        toast({
          title: "Error",
          description: "Failed to start podcast session.",
          variant: "destructive"
        });
        clearCurrent();
        return;
      }

      try {
        await tryLoadAndAutoplayAudio(ep.audioUrl, localPosition);
      } catch (e) {
        console.error("Initial podcast load/autoplay failed:", e);
      }
    };

    setupAndPlay();

    const handleAudioEnded = async () => {
      if (podcastSession) {
        try {
          await PodcastDatabaseService.endListenSession(podcastSession.id, Math.floor(audio.currentTime));
          await PodcastDatabaseService.markEpisodeAsCompleted(ep.id);
        } catch (e) { console.error("Error ending podcast session:", e); }
        setPodcastSession(null);
      }
      next();
    };

    const handleTimeUpdate = () => {
      if (!isSeeking.current) {
        setLocalPosition(Math.floor(audio.currentTime));
        usePlayerStore.getState().setPosition(Math.floor(audio.currentTime));
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setLocalDuration(audio.duration);
      } else if (ep.durationSeconds > 0) {
        setLocalDuration(ep.durationSeconds);
      }
      
      // Re-apply position after metadata is loaded
      if (!initialPositionApplied.current && localPosition > 0) {
        audio.currentTime = localPosition;
        initialPositionApplied.current = true;
      }
    };

    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('ended', handleAudioEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      setPodcastSession(null);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentPodcast?.id, currentPodcast?.audioUrl, localPosition, playbackRate, volume, muted, next, pause, clearCurrent, setLocalDuration, toast]);

  // Effect 2: Sync global isPlaying state to audio element
  useEffect(() => {
    if (!currentPodcast || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        console.error("Podcast playback failed on resume:", e);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentPodcast]);

  // Effect 3: Sync volume/mute to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // Effect 4: Sync playback rate to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // --- Progress Tracking and Persistence (1-second interval) ---
  useEffect(() => {
    if (!currentPodcast || !audioRef.current) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      return;
    }

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = window.setInterval(async () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      // Don't update position if we're currently seeking
      if (isSeeking.current && Date.now() - lastSeekTime.current < 1000) return;

      const currentPos = Math.floor(audio.currentTime);
      const currentDur = Math.floor(audio.duration);
      
      // Only update if we have valid values
      if (currentPos >= 0) {
        setLocalPosition(currentPos);
        usePlayerStore.getState().setPosition(currentPos);
      }
      
      if (currentDur > 0) {
        setLocalDuration(currentDur);
      } else if (currentPodcast.durationSeconds > 0) {
        setLocalDuration(currentPodcast.durationSeconds);
      }

      await dailyTimeTracker.addTime(1);
      try {
        if (podcastSession) {
          await PodcastDatabaseService.updateListenSession(podcastSession.id, { seconds_listened: currentPos });
          await PodcastDatabaseService.updateEpisodeProgress(currentPodcast.id, currentPos);
        }
      } catch (e) {
        console.error('Error updating podcast progress:', e);
      }

      const completionThreshold = Math.min(currentDur * 0.9, currentDur - 60);
      if (currentDur >= 120 && currentPos >= completionThreshold) {
        try {
          await PodcastDatabaseService.markEpisodeAsCompleted(currentPodcast.id);
        } catch (e) {
          console.error('Failed to mark podcast episode as completed:', e);
        }
      }
    }, 1000) as unknown as number;

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    };
  }, [currentPodcast?.id, isPlaying, podcastSession, setLocalPosition, setLocalDuration]);

  // --- Persist Progress on Unload/Visibility Change ---
  useEffect(() => {
    const persistProgress = async () => {
      if (!currentPodcast || !audioRef.current) return;
      const currentPos = Math.floor(audioRef.current.currentTime);

      if (currentPos > 0) {
        try {
          if (podcastSession) {
            await PodcastDatabaseService.endListenSession(podcastSession.id, currentPos);
          }
          await PodcastDatabaseService.updateEpisodeProgress(currentPodcast.id, currentPos);
        } catch (e) {
          console.error('Error persisting podcast progress on unload:', e);
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
  }, [currentPodcast?.id, podcastSession, audioRef]);

  return { audioRef, podcastSession, handleSeek };
};