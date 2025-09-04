import { useState, useEffect } from 'react';
import { DatabaseService } from '@/lib/database';

export interface VideoStats {
  totalWatchTime: number;
  averagePlaybackRate: number;
  completionPercentage: number;
  sessionCount: number;
  lastWatchedAt: string;
}

export function useVideoStats(videoId: string | undefined) {
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      setStats(null);
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get all watch sessions for this video
        const allSessions = await DatabaseService.getAllWatchSessions();
        const sessions = allSessions.filter(session => session.videoId === videoId);
        
        if (sessions.length === 0) {
          setStats(null);
          return;
        }

        // Calculate stats from sessions
        const totalWatchTime = sessions.reduce((sum, session) => sum + (session.secondsWatched || 0), 0);
        const avgPlaybackRate = sessions.reduce((sum, session) => sum + (session.avgPlaybackRate || 1), 0) / sessions.length;
        const sessionCount = sessions.length;
        const lastWatchedAt = sessions[0]?.endedAt || sessions[0]?.startedAt || new Date().toISOString();
        
        // For completion percentage, use estimated duration (we don't have it stored)
        // Default to 100% if totalWatchTime > 300 seconds (5 minutes)
        const estimatedDuration = Math.max(totalWatchTime, 300);
        const completionPercentage = (totalWatchTime / estimatedDuration) * 100;

        setStats({
          totalWatchTime,
          averagePlaybackRate: avgPlaybackRate,
          completionPercentage: Math.min(completionPercentage, 100),
          sessionCount,
          lastWatchedAt
        });
      } catch (err) {
        console.error('Failed to fetch video stats:', err);
        setError('Failed to load stats');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [videoId]);

  return { stats, loading, error };
}