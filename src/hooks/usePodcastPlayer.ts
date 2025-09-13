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

  // --- Podcast (Audio) Playback Logic ---
  useEffect(() => {
    if (!currentPodcast || !audioRef.current) return;

    const ep = currentPodcast;
    const audio = audioRef.current;

    const tryPlayAudioWithProxies = async (url: string, initialPosition: number) => {
      audio.currentTime = initialPosition;
      audio.playbackRate = playbackRate;
      audio.volume = muted ? 0 : volume;

      const AUDIO_PROXY_COUNT = 3;
      const urlsToTry = [url]; // Start with direct URL
      for (let i = 0; i < AUDIO_PROXY_COUNT; i++) {
        urlsToTry.push(getProxiedAudioUrl(url, i));
      }

      for (const currentUrl of urlsToTry) {
        audio.src = currentUrl;
        audio.load(); // Load the new source

        try {
          // Wait for the audio to be ready to play
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

            // If already ready, resolve immediately
            if (audio.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
              onCanPlay();
            }
          });

          // Attempt to play
          await audio.play();
          console.log(`Podcast playback successful with URL: ${currentUrl}`);
          return true; // Successfully played
        } catch (e: any) {
          console.warn(`Podcast playback failed with URL: ${currentUrl}`, e);
          // Continue to next URL if this one failed
        }
      }
      throw new Error('All podcast playback attempts failed.'); // If all URLs failed
    };

    const setupAudio = async () => {
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

      if (isPlaying) {
        try {
          await tryPlayAudioWithProxies(ep.audio_url, localPosition);
        } catch (e: any) {
          console.error("Podcast autoplay failed:", e);
          toast({
            title: "Autoplay Blocked",
            description: "Autoplay blocked or media not supported. Tap play to listen.",
            variant: "info"
          });
          pause(); // Set global state to paused if autoplay fails
        }
      }
    };

    setupAudio();

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
  }, [currentPodcast?.id, localPosition, isPlaying, volume, muted, playbackRate, next, pause, clearCurrent, setLocalDuration, toast]);

  // Sync podcast audio playback
  useEffect(() => {
    if (currentPodcast && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Podcast playback failed:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentPodcast]);

  // Sync volume/mute to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // Sync playback rate to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return { audioRef, podcastSession };
};