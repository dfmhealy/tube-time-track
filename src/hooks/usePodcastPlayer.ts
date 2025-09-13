import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { PodcastDatabaseService, type PodcastSession } from '@/lib/podcastDatabase';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { getProxiedAudioUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface UsePodcastPlayerProps {
  currentPodcast: {
    id: string;
    audio_url: string;
    durationSeconds: number;
  } | null;
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [podcastSession, setPodcastSession] = useState<PodcastSession | null>(null);
  const { toast } = useToast();

  // Effect 1: Setup audio source and initial session
  useEffect(() => {
    if (!currentPodcast || !audioRef.current) return;

    const ep = currentPodcast;
    const audio = audioRef.current;

    const tryLoadAndAutoplayAudio = async (url: string, initialPosition: number) => {
      audio.currentTime = initialPosition;
      audio.playbackRate = playbackRate; // Set initial rate
      audio.volume = muted ? 0 : volume; // Set initial volume/mute

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

          // Only attempt autoplay if `isPlaying` is true from the store
          // This is the *initial* autoplay attempt when a new item loads
          if (usePlayerStore.getState().isPlaying) { // Check current store state
            await audio.play();
            console.log(`Podcast playback successful with URL: ${currentUrl}`);
          }
          return true;
        } catch (e: any) {
          console.warn(`Podcast load/playback failed with URL: ${currentUrl}`, e);
          if (e.name === 'NotAllowedError' || e.name === 'AbortError') { // Autoplay blocked
            toast({
              title: "Autoplay Blocked",
              description: "Autoplay blocked. Tap play to listen.",
              variant: "info"
            });
            pause(); // Update store state to paused
          } else {
            toast({
              title: "Error",
              description: `Failed to load podcast: ${e.message}`,
              variant: "destructive"
            });
            clearCurrent(); // Clear if a critical error
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

      // Attempt to load and autoplay
      try {
        await tryLoadAndAutoplayAudio(ep.audio_url, localPosition);
      } catch (e) {
        console.error("Initial podcast load/autoplay failed:", e);
        // Error already handled by tryLoadAndAutoplayAudio
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

    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('loadedmetadata', () => setLocalDuration(audio.duration));

    return () => {
      audio.removeEventListener('ended', handleAudioEnded);
      audio.removeEventListener('loadedmetadata', () => setLocalDuration(audio.duration));
      setPodcastSession(null);
    };
  }, [currentPodcast?.id, localPosition, playbackRate, volume, muted, next, pause, clearCurrent, setLocalDuration, toast]); // Dependencies for initial setup

  // Effect 2: Sync global isPlaying state to audio element
  useEffect(() => {
    if (!currentPodcast || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        console.error("Podcast playback failed on resume:", e);
        // No toast here, as this is a user-initiated play
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentPodcast]); // Only re-run when isPlaying or currentPodcast changes

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

  return { audioRef, podcastSession };
};