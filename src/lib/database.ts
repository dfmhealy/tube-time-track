import { supabase } from '@/integrations/supabase/client';

// Data Models
export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  thumbnailUrl: string;
  tags: string[];
  addedAt: string; // ISO string
  watchSeconds: number;
  lastWatchedAt: string | null;
  lastPositionSeconds?: number;
  isCompleted?: boolean;
}

export interface WatchSession {
  id: string;
  videoId: string;
  startedAt: string; // ISO string
  endedAt: string | null;
  secondsWatched: number;
  avgPlaybackRate: number;
  source: string;
}

export interface UserStats {
  id: string;
  totalSeconds: number;
  dailyGoalSeconds: number;
  lastWatchedAt: string | null;
  streakDays: number;
}

export interface UserPreferences {
  id: string;
  autoPlay: boolean;
  defaultPlaybackRate: number;
  volumePreference: number;
  theme: string;
  notificationsEnabled: boolean;
}

// Database utility functions
export const DatabaseService = {
  // Video operations
  async addVideo(video: Omit<Video, 'id' | 'watchSeconds' | 'lastWatchedAt'>): Promise<Video> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        youtube_id: video.youtubeId,
        title: video.title,
        channel_title: video.channelTitle,
        duration_seconds: video.durationSeconds,
        thumbnail_url: video.thumbnailUrl,
        tags: video.tags,
        added_at: video.addedAt,
        watch_seconds: 0,
        last_watched_at: null
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      youtubeId: data.youtube_id,
      title: data.title,
      channelTitle: data.channel_title,
      durationSeconds: data.duration_seconds,
      thumbnailUrl: data.thumbnail_url,
      tags: data.tags,
      addedAt: data.added_at,
      watchSeconds: data.watch_seconds,
      lastWatchedAt: data.last_watched_at
    };
  },

  async getVideo(id: string): Promise<Video | undefined> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      youtubeId: data.youtube_id,
      title: data.title,
      channelTitle: data.channel_title,
      durationSeconds: data.duration_seconds,
      thumbnailUrl: data.thumbnail_url,
      tags: data.tags,
      addedAt: data.added_at,
      watchSeconds: data.watch_seconds,
      lastWatchedAt: data.last_watched_at,
      lastPositionSeconds: (data as any).last_position_seconds || 0,
      isCompleted: (data as any).is_completed || false
    };
  },

  async getVideoByYouTubeId(youtubeId: string): Promise<Video | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', user.id)
      .eq('youtube_id', youtubeId)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      youtubeId: data.youtube_id,
      title: data.title,
      channelTitle: data.channel_title,
      durationSeconds: data.duration_seconds,
      thumbnailUrl: data.thumbnail_url,
      tags: data.tags,
      addedAt: data.added_at,
      watchSeconds: data.watch_seconds,
      lastWatchedAt: data.last_watched_at,
      lastPositionSeconds: (data as any).last_position_seconds || 0,
      isCompleted: (data as any).is_completed || false
    };
  },

  async getAllVideos(): Promise<Video[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) return [];

    return data.map(video => ({
      id: video.id,
      youtubeId: video.youtube_id,
      title: video.title,
      channelTitle: video.channel_title,
      durationSeconds: video.duration_seconds,
      thumbnailUrl: video.thumbnail_url,
      tags: video.tags,
      addedAt: video.added_at,
      watchSeconds: video.watch_seconds,
      lastWatchedAt: video.last_watched_at,
      lastPositionSeconds: (video as any).last_position_seconds || 0,
      isCompleted: (video as any).is_completed || false
    }));
  },

  async searchVideos(query: string): Promise<Video[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', user.id)
      .or(`title.ilike.%${query}%, channel_title.ilike.%${query}%`);

    if (error) return [];

    return data.map(video => ({
      id: video.id,
      youtubeId: video.youtube_id,
      title: video.title,
      channelTitle: video.channel_title,
      durationSeconds: video.duration_seconds,
      thumbnailUrl: video.thumbnail_url,
      tags: video.tags,
      addedAt: video.added_at,
      watchSeconds: video.watch_seconds,
      lastWatchedAt: video.last_watched_at,
      lastPositionSeconds: (video as any).last_position_seconds || 0,
      isCompleted: (video as any).is_completed || false
    }));
  },

  async deleteVideo(id: string): Promise<void> {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Watch session operations
  async startWatchSession(videoId: string): Promise<WatchSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('watch_sessions')
      .insert({
        user_id: user.id,
        video_id: videoId,
        started_at: new Date().toISOString(),
        seconds_watched: 0,
        avg_playback_rate: 1.0,
        source: 'web'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      videoId: data.video_id,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      secondsWatched: data.seconds_watched,
      avgPlaybackRate: data.avg_playback_rate,
      source: data.source
    };
  },

  async updateWatchSession(sessionId: string, updates: Partial<WatchSession>): Promise<void> {
    const updateData: any = {};
    
    if (updates.secondsWatched !== undefined) updateData.seconds_watched = updates.secondsWatched;
    if (updates.avgPlaybackRate !== undefined) updateData.avg_playback_rate = updates.avgPlaybackRate;
    if (updates.endedAt !== undefined) updateData.ended_at = updates.endedAt;

    const { error } = await supabase
      .from('watch_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) throw error;
  },

  async endWatchSession(sessionId: string, finalSecondsWatched: number): Promise<void> {
    const { error } = await supabase
      .from('watch_sessions')
      .update({
        ended_at: new Date().toISOString(),
        seconds_watched: finalSecondsWatched
      })
      .eq('id', sessionId);

    if (error) throw error;
  },

  async getWatchSessionsForVideo(videoId: string): Promise<WatchSession[]> {
    const { data, error } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('video_id', videoId);

    if (error) return [];

    return data.map(session => ({
      id: session.id,
      videoId: session.video_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      secondsWatched: session.seconds_watched,
      avgPlaybackRate: session.avg_playback_rate,
      source: session.source
    }));
  },

  async getTotalWatchTimeForVideo(videoId: string): Promise<number> {
    const sessions = await this.getWatchSessionsForVideo(videoId);
    return sessions.reduce((total, session) => total + session.secondsWatched, 0);
  },

  async markVideoAsCompleted(videoId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('videos')
      .update({ is_completed: true })
      .eq('id', videoId)
      .eq('user_id', user.id);
    
    if (error) throw new Error(`Failed to mark video as completed: ${error.message}`);
  },

  // User stats operations
  async getUserStats(): Promise<UserStats | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;

    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      totalSeconds: data.total_seconds,
      dailyGoalSeconds: data.weekly_goal_seconds || 30 * 60, // Default 30 minutes (using existing column)
      lastWatchedAt: data.last_watched_at,
      streakDays: data.streak_days
    };
  },

  async updateUserStats(updates: Partial<UserStats>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (updates.totalSeconds !== undefined) updateData.total_seconds = updates.totalSeconds;
    if (updates.dailyGoalSeconds !== undefined) updateData.weekly_goal_seconds = updates.dailyGoalSeconds;
    if (updates.lastWatchedAt !== undefined) updateData.last_watched_at = updates.lastWatchedAt;
    if (updates.streakDays !== undefined) updateData.streak_days = updates.streakDays;

    const { error } = await supabase
      .from('user_stats')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  // Get weekly data for stats
  async getWeeklyData(): Promise<{ date: string; seconds: number }[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6); // Last 7 days
    
    const { data, error } = await supabase
      .from('watch_sessions')
      .select('started_at, seconds_watched')
      .eq('user_id', user.id)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .not('ended_at', 'is', null);

    if (error) return [];
    
    // Group by date
    const dailyTotals: { [date: string]: number } = {};
    
    data.forEach(session => {
      const date = new Date(session.started_at).toISOString().split('T')[0];
      dailyTotals[date] = (dailyTotals[date] || 0) + (session.seconds_watched || 0);
    });
    
    // Create array with all 7 days, filling in zeros
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        seconds: dailyTotals[dateStr] || 0
      });
    }
    
    return result;
  },

  // Analytics  
  async getWeeklyWatchTime(): Promise<{ date: string; seconds: number }[]> {
    return this.getWeeklyData();
  },

  async getAllWatchSessions(): Promise<WatchSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });

    if (error) return [];

    return data.map(session => ({
      id: session.id,
      videoId: session.video_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      secondsWatched: session.seconds_watched,
      avgPlaybackRate: session.avg_playback_rate,
      source: session.source
    }));
  },

  // User preferences operations
  async getUserPreferences(): Promise<UserPreferences | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      autoPlay: data.auto_play,
      defaultPlaybackRate: data.default_playback_rate,
      volumePreference: data.volume_preference,
      theme: data.theme,
      notificationsEnabled: data.notifications_enabled
    };
  },

  async updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (updates.autoPlay !== undefined) updateData.auto_play = updates.autoPlay;
    if (updates.defaultPlaybackRate !== undefined) updateData.default_playback_rate = updates.defaultPlaybackRate;
    if (updates.volumePreference !== undefined) updateData.volume_preference = updates.volumePreference;
    if (updates.theme !== undefined) updateData.theme = updates.theme;
    if (updates.notificationsEnabled !== undefined) updateData.notifications_enabled = updates.notificationsEnabled;

    const { error } = await supabase
      .from('user_preferences')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) throw error;
  }
};