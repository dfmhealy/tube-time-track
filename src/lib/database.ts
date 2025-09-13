import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Re-export types for convenience
type VideoRow = Database['public']['Tables']['videos']['Row'];
type VideoInsert = Database['public']['Tables']['videos']['Insert'];
type VideoUpdate = Database['public']['Tables']['videos']['Update'];

type WatchSessionRow = Database['public']['Tables']['watch_sessions']['Row'];
type WatchSessionInsert = Database['public']['Tables']['watch_sessions']['Insert'];
type WatchSessionUpdate = Database['public']['Tables']['watch_sessions']['Update'];

type UserStatsRow = Database['public']['Tables']['user_stats']['Row'];
type UserStatsInsert = Database['public']['Tables']['user_stats']['Insert'];
type UserStatsUpdate = Database['public']['Tables']['user_stats']['Update'];

type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];
type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert'];
type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];

type VideoChannelSubscriptionInsert = Database['public']['Tables']['video_channel_subscriptions']['Insert'];

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
  lastPositionSeconds: number; // Added for resume functionality
  isCompleted: boolean; // Added for completion tracking
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
  updatedAt?: string; // Added updated_at to UserStats interface
}

export interface UserPreferences {
  id: string;
  autoPlay: boolean;
  defaultPlaybackRate: number;
  volumePreference: number;
  theme: string;
  notificationsEnabled: boolean;
}

// Helper types for database operations
type VideoInput = Omit<VideoInsert, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'watch_seconds' | 'last_watched_at' | 'last_position_seconds' | 'is_completed'>;
type WatchSessionInput = Omit<WatchSessionInsert, 'id' | 'created_at' | 'updated_at'>;
type UserStatsInput = Omit<UserStatsInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
type UserPreferencesInput = Omit<UserPreferencesInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>;


// Helper function to get current user ID
const getUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('User not authenticated');
  return user.id;
};

export const DatabaseService = {
  // Video operations
  async addVideo(video: VideoInput): Promise<Video> {
    const userId = await getUserId();
    
    const videoData: VideoInsert = {
      user_id: userId,
      youtube_id: video.youtubeId,
      title: video.title,
      channel_title: video.channelTitle,
      duration_seconds: video.durationSeconds,
      thumbnail_url: video.thumbnailUrl,
      tags: video.tags,
      added_at: video.addedAt,
      watch_seconds: 0,
      last_watched_at: null,
      last_position_seconds: 0,
      is_completed: false
    };
    
    const { data, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      youtubeId: data.youtube_id,
      title: data.title,
      channelTitle: data.channel_title,
      durationSeconds: data.duration_seconds || 0,
      thumbnailUrl: data.thumbnail_url,
      tags: data.tags || [],
      addedAt: data.added_at || '',
      watchSeconds: data.watch_seconds || 0,
      lastWatchedAt: data.last_watched_at,
      lastPositionSeconds: data.last_position_seconds || 0,
      isCompleted: data.is_completed || false
    };
  },

  async updateVideoProgress(videoId: string, lastPositionSeconds: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Validate position value - ensure it's not negative or NaN
    const validPosition = Math.max(0, Math.floor(lastPositionSeconds || 0));
    
    const { error } = await supabase
      .from('videos')
      .update({ 
        last_position_seconds: validPosition,
        last_watched_at: new Date().toISOString()
      } as VideoUpdate)
      .eq('id', videoId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  async getVideo(id: string): Promise<Video | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      youtubeId: data.youtube_id,
      title: data.title,
      channelTitle: data.channel_title,
      durationSeconds: data.duration_seconds || 0,
      thumbnailUrl: data.thumbnail_url,
      tags: data.tags || [],
      addedAt: data.added_at || '',
      watchSeconds: data.watch_seconds || 0,
      lastWatchedAt: data.last_watched_at,
      lastPositionSeconds: data.last_position_seconds || 0,
      isCompleted: data.is_completed || false
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
      durationSeconds: data.duration_seconds || 0,
      thumbnailUrl: data.thumbnail_url,
      tags: data.tags || [],
      addedAt: data.added_at || '',
      watchSeconds: data.watch_seconds || 0,
      lastWatchedAt: data.last_watched_at,
      lastPositionSeconds: data.last_position_seconds || 0,
      isCompleted: data.is_completed || false
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
      durationSeconds: video.duration_seconds || 0,
      thumbnailUrl: video.thumbnail_url,
      tags: video.tags || [],
      addedAt: video.added_at || '',
      watchSeconds: video.watch_seconds || 0,
      lastWatchedAt: video.last_watched_at,
      lastPositionSeconds: video.last_position_seconds || 0,
      isCompleted: video.is_completed || false
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
      durationSeconds: video.duration_seconds || 0,
      thumbnailUrl: video.thumbnail_url,
      tags: video.tags || [],
      addedAt: video.added_at || '',
      watchSeconds: video.watch_seconds || 0,
      lastWatchedAt: video.last_watched_at,
      lastPositionSeconds: video.last_position_seconds || 0,
      isCompleted: video.is_completed || false
    }));
  },

  async getRecentVideos(limit = 4): Promise<Video[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', user.id)
      .not('last_watched_at', 'is', null)
      .order('last_watched_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent videos:", error);
      return [];
    }

    return (data || []).map(video => ({
      id: video.id,
      youtubeId: video.youtube_id,
      title: video.title,
      channelTitle: video.channel_title,
      durationSeconds: video.duration_seconds || 0,
      thumbnailUrl: video.thumbnail_url,
      tags: video.tags || [],
      addedAt: video.added_at || '',
      watchSeconds: video.watch_seconds || 0,
      lastWatchedAt: video.last_watched_at,
      lastPositionSeconds: video.last_position_seconds || 0,
      isCompleted: video.is_completed || false
    }));
  },

  async deleteVideo(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user can only delete their own videos

    if (error) throw error;
  },

  // Watch session operations
  async addWatchSession(sessionData: WatchSessionInput): Promise<{ data: WatchSession | null; error: any; }> {
    const userId = await getUserId();
    const now = new Date().toISOString();

    const sessionWithUser: WatchSessionInsert = {
      ...sessionData,
      user_id: userId,
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('watch_sessions')
      .insert(sessionWithUser)
      .select()
      .single();
    
    return { 
      data: data ? {
        id: data.id,
        videoId: data.video_id,
        startedAt: data.started_at || '',
        endedAt: data.ended_at,
        secondsWatched: data.seconds_watched || 0,
        avgPlaybackRate: data.avg_playback_rate || 1.0,
        source: data.source || 'web'
      } : null, 
      error 
    };
  },

  async startWatchSession(videoId: string): Promise<WatchSession> {
    const userId = await getUserId();
    const now = new Date().toISOString();
    const sessionData: WatchSessionInput = {
      user_id: userId, // user_id is required in WatchSessionInsert
      video_id: videoId,
      started_at: now,
      seconds_watched: 0,
      avg_playback_rate: 1,
      source: 'web',
      ended_at: null
    };
    
    const { data, error } = await this.addWatchSession(sessionData);
    if (error || !data) throw error || new Error('Failed to start watch session');
    return data;

  },

  async updateWatchSession(
    sessionId: string,
    updates: Omit<Partial<WatchSession>, 'updatedAt'>
  ): Promise<void> {
    if (!sessionId) return;
    
    const updateData: WatchSessionUpdate = {};
    
    if (updates.secondsWatched !== undefined) {
      const validSeconds = Math.max(0, Math.floor(updates.secondsWatched || 0));
      updateData.seconds_watched = validSeconds;
    }
    if (updates.avgPlaybackRate !== undefined) {
      const validRate = Math.max(0.25, Math.min(4, updates.avgPlaybackRate || 1));
      updateData.avg_playback_rate = validRate;
    }
    if (updates.endedAt !== undefined) updateData.ended_at = updates.endedAt;

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Only update if we have valid data
    if (Object.keys(updateData).length === 1 && updateData.updated_at) return; // Only updated_at, no other changes

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
    
    const updateData: WatchSessionUpdate = {
      ended_at: new Date().toISOString(),
      seconds_watched: validSeconds,
      updated_at: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('watch_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', user.id); // Ensure user can only end their own sessions

    if (updateError) throw updateError;
  },

  async getWatchSessionsForVideo(videoId: string): Promise<WatchSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', user.id);

    if (error) return [];

    return data.map(session => ({
      id: session.id,
      videoId: session.video_id,
      startedAt: session.started_at || '',
      endedAt: session.ended_at,
      secondsWatched: session.seconds_watched || 0,
      avgPlaybackRate: session.avg_playback_rate || 1.0,
      source: session.source || 'web'
    }));
  },

  async getTotalWatchTimeForVideo(videoId: string): Promise<number> {
    const sessions = await this.getWatchSessionsForVideo(videoId);
    return sessions.reduce((total, session) => total + session.secondsWatched, 0);
  },

  async markVideoAsCompleted(videoId: string, isCompleted: boolean = true): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if already completed to avoid unnecessary updates
    const { data: currentVideo, error: fetchError } = await supabase
      .from('videos')
      .select('is_completed')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single();
      
    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // Handle actual errors
    if (currentVideo?.is_completed === isCompleted) return; // Already in desired state

    const { error } = await supabase
      .from('videos')
      .update({ is_completed: isCompleted } as VideoUpdate)
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
      totalSeconds: data.total_seconds || 0,
      dailyGoalSeconds: data.weekly_goal_seconds || 30 * 60, // Default 30 minutes (using existing column)
      lastWatchedAt: data.last_watched_at,
      streakDays: data.streak_days || 0,
      updatedAt: data.updated_at || undefined // Map updated_at
    };
  },

  async updateUserStats(updates: Partial<UserStatsInput>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: UserStatsUpdate = {};
    if (updates.total_seconds !== undefined) {
      const validSeconds = Math.max(0, Math.floor(updates.total_seconds || 0));
      updateData.total_seconds = validSeconds;
    }
    if (updates.weekly_goal_seconds !== undefined) {
      const validGoal = Math.max(60, Math.floor(updates.weekly_goal_seconds || 60)); // Minimum 1 minute
      updateData.weekly_goal_seconds = validGoal;
    }
    if (updates.last_watched_at !== undefined) updateData.last_watched_at = updates.last_watched_at;
    if (updates.streak_days !== undefined) {
      const validStreak = Math.max(0, Math.floor(updates.streak_days || 0));
      updateData.streak_days = validStreak;
    }
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Only update if we have valid data
    if (Object.keys(updateData).length === 1 && updateData.updated_at) return; // Only updated_at, no other changes

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
      const date = new Date(session.started_at || '').toISOString().split('T')[0];
      const seconds = Math.max(0, session.seconds_watched || 0);
      dailyTotals[date] = (dailyTotals[date] || 0) + seconds;
    });
    
    // Process podcast sessions
    (podcastData || []).forEach(session => {
      const date = new Date(session.started_at || '').toISOString().split('T')[0];
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
      .insert({ user_id: user.id, channel_title: channelTitle } as VideoChannelSubscriptionInsert);
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
      startedAt: session.started_at || '',
      endedAt: session.ended_at,
      secondsWatched: session.seconds_watched || 0,
      avgPlaybackRate: session.avg_playback_rate || 1.0,
      source: session.source || 'web'
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
      autoPlay: data.auto_play || false,
      defaultPlaybackRate: data.default_playback_rate || 1.0,
      volumePreference: data.volume_preference || 1.0,
      theme: data.theme || 'system',
      notificationsEnabled: data.notifications_enabled || false
    };
  },

  async updateUserPreferences(updates: Partial<UserPreferencesInput>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: UserPreferencesUpdate = {};
    if (updates.auto_play !== undefined) updateData.auto_play = updates.auto_play;
    if (updates.default_playback_rate !== undefined) updateData.default_playback_rate = updates.default_playback_rate;
    if (updates.volume_preference !== undefined) updateData.volume_preference = updates.volume_preference;
    if (updates.theme !== undefined) updateData.theme = updates.theme;
    if (updates.notifications_enabled !== undefined) updateData.notifications_enabled = updates.notifications_enabled;

    const { error } = await supabase
      .from('user_preferences')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) throw error;
  }
};