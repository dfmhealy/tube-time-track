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

  async updateVideoProgress(videoId: string, lastPositionSeconds: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Validate position value - ensure it's not negative or NaN
    const validPosition = Math.max(0, Math.floor(lastPositionSeconds || 0));
    
    // Don't update if position is 0 (avoid unnecessary database calls)
    if (validPosition === 0) return;

    const { error } = await supabase
      .from('videos')
      .update({ 
        last_position_seconds: validPosition,
        last_watched_at: new Date().toISOString()
      } as any)
      .eq('id', videoId)
      .eq('user_id', user.id);

    if (error) throw error;
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

    // Check if there's already an active session for this video
    const { data: existingSession } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If there's an active session, return it instead of creating a new one
    if (existingSession) {
      return {
        id: existingSession.id,
        videoId: existingSession.video_id,
        startedAt: existingSession.started_at,
        endedAt: existingSession.ended_at,
        secondsWatched: existingSession.seconds_watched,
        avgPlaybackRate: existingSession.avg_playback_rate,
        source: existingSession.source
      };
    }

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
    if (!sessionId) return;
    
    const updateData: any = {};
    
    if (updates.secondsWatched !== undefined) {
      const validSeconds = Math.max(0, Math.floor(updates.secondsWatched || 0));
      updateData.seconds_watched = validSeconds;
    }
    if (updates.avgPlaybackRate !== undefined) {
      const validRate = Math.max(0.25, Math.min(4, updates.avgPlaybackRate || 1));
      updateData.avg_playback_rate = validRate;
    }
    if (updates.endedAt !== undefined) updateData.ended_at = updates.endedAt;

    // Only update if we have valid data
    if (Object.keys(updateData).length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('watch_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', user.id); // Ensure user can only update their own sessions

    if (error) throw error;
  },

  async endWatchSession(sessionId: string, finalSecondsWatched: number): Promise<void> {
    if (!sessionId) return;
    
    // Validate final seconds - ensure it's not negative or NaN
    const validSeconds = Math.max(0, Math.floor(finalSecondsWatched || 0));
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { error } = await supabase
      .from('watch_sessions')
      .update({
        ended_at: new Date().toISOString(),
        seconds_watched: validSeconds
      })
      .eq('id', sessionId)
      .eq('user_id', user.id); // Ensure user can only end their own sessions

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

    // Check if already completed to avoid unnecessary updates
    const { data: currentVideo } = await supabase
      .from('videos')
      .select('is_completed')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single();
      
    if (currentVideo?.is_completed) return; // Already completed

    const { error } = await supabase
      .from('videos')
      .update({ is_completed: true } as any)
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
    if (updates.totalSeconds !== undefined) {
      const validSeconds = Math.max(0, Math.floor(updates.totalSeconds || 0));
      updateData.total_seconds = validSeconds;
    }
    if (updates.dailyGoalSeconds !== undefined) {
      const validGoal = Math.max(60, Math.floor(updates.dailyGoalSeconds || 60)); // Minimum 1 minute
      updateData.weekly_goal_seconds = validGoal;
    }
    if (updates.lastWatchedAt !== undefined) updateData.last_watched_at = updates.lastWatchedAt;
    if (updates.streakDays !== undefined) {
      const validStreak = Math.max(0, Math.floor(updates.streakDays || 0));
      updateData.streak_days = validStreak;
    }
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Only update if we have valid data
    if (Object.keys(updateData).length === 0) return;

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

    // Get last 7 days including today
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    // Get video sessions
    const { data: videoData, error: videoError } = await supabase
      .from('watch_sessions')
      .select('started_at, seconds_watched')
      .eq('user_id', user.id)
      .gte('started_at', startDate.toISOString())
      .lt('started_at', endDate.toISOString())
      .not('ended_at', 'is', null);

    // Get podcast sessions
    const { data: podcastData, error: podcastError } = await supabase
      .from('podcast_sessions')
      .select('started_at, seconds_listened')
      .eq('user_id', user.id)
      .gte('started_at', startDate.toISOString())
      .lt('started_at', endDate.toISOString())
      .not('ended_at', 'is', null);

    if (videoError || podcastError) {
      console.error('Error fetching weekly data:', videoError || podcastError);
      return [];
    }
    
    // Group by date
    const dailyTotals: { [date: string]: number } = {};
    
    // Process video sessions
    (videoData || []).forEach(session => {
      const date = new Date(session.started_at).toISOString().split('T')[0];
      const seconds = Math.max(0, session.seconds_watched || 0);
      dailyTotals[date] = (dailyTotals[date] || 0) + seconds;
    });
    
    // Process podcast sessions
    (podcastData || []).forEach(session => {
      const date = new Date(session.started_at).toISOString().split('T')[0];
      const seconds = Math.max(0, session.seconds_listened || 0);
      dailyTotals[date] = (dailyTotals[date] || 0) + seconds;
    });
    
    // Create array with all 7 days, filling in zeros
    const result: { date: string; seconds: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        seconds: Math.max(0, dailyTotals[dateStr] || 0)
      });
    }
    return result;
  },

  // Video channel subscriptions (using channel title as the key until channel IDs are available)
  async subscribeToChannel(channelTitle: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('video_channel_subscriptions')
      .insert({ user_id: user.id, channel_title: channelTitle } as any);
    if (error) throw error;
  },

  async unsubscribeFromChannel(channelTitle: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('video_channel_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('channel_title', channelTitle);
    if (error) throw error;
  },

  async isSubscribedToChannel(channelTitle: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from('video_channel_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel_title', channelTitle)
      .maybeSingle();
    if (error && (error as any).code !== 'PGRST116') return false;
    return !!data;
  },

  async getUserChannelSubscriptions(): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('video_channel_subscriptions')
      .select('channel_title')
      .eq('user_id', user.id)
      .order('channel_title');
    if (error || !data) return [];
    return data.map((r: any) => r.channel_title as string);
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