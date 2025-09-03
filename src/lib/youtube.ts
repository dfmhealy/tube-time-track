// YouTube utilities and types

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration?: number; // in seconds
}

// Extract YouTube video ID from various URL formats
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// Validate YouTube URL
export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

// Get video info from oEmbed (no API key required, but limited info)
export async function getVideoInfoFromOEmbed(videoId: string): Promise<YouTubeVideoInfo | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error('Video not found or private');
    }

    const data = await response.json();
    
    return {
      id: videoId,
      title: data.title || 'Unknown Title',
      channelTitle: data.author_name || 'Unknown Channel',
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    };
  } catch (error) {
    console.error('Error fetching video info:', error);
    return null;
  }
}

// Generate thumbnail URL for a video ID
export function getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'maxres'): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}default.jpg`;
}

// Format duration in seconds to human readable format
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Convert formatted duration (HH:MM:SS or MM:SS) to seconds
export function parseDuration(duration: string): number {
  const parts = duration.split(':').map(Number);
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  
  return 0;
}

// YouTube Player States (from YouTube IFrame API)
export enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5
}

// YouTube Player Events
export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): PlayerState;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getVideoData(): {
    video_id: string;
    title: string;
    author: string;
  };
  destroy(): void;
}

// YouTube IFrame API setup
export function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    // Create script tag for YouTube API
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    
    // Set up callback
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };

    document.head.appendChild(script);
  });
}

// Global YouTube API types
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: any) => YouTubePlayer;
      ready: (callback: () => void) => void;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export default {
  extractYouTubeId,
  isValidYouTubeUrl,
  getVideoInfoFromOEmbed,
  getThumbnailUrl,
  formatDuration,
  parseDuration,
  loadYouTubeAPI,
  PlayerState
};