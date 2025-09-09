import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Re-export types for convenience
type Video = Database['public']['Tables']['videos']['Row'];
type VideoInput = Omit<Database['public']['Tables']['videos']['Insert'], 'id' | 'created_at' | 'updated_at'>;
type WatchSession = Database['public']['Tables']['watch_sessions']['Row'];
type WatchSessionInput = Omit<Database['public']['Tables']['watch_sessions']['Insert'], 'id' | 'created_at' | 'updated_at'>;
type UserStats = Database['public']['Tables']['user_stats']['Row'];
type UserStatsInput = Omit<Database['public']['Tables']['user_stats']['Insert'], 'id' | 'created_at' | 'updated_at'>;

// Helper types for database operations
type QueryResult<T> = {
  data: T | null;
  error: any;
};

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
    const now = new Date().toISOString();
    
    const videoData: Omit<Database['public']['Tables']['videos']['Insert'], 'id'> = {
      ...video,
      user_id: userId,
      created_at: now,
      updated_at: now,
      watch_seconds: 0,
      last_watched_at: null
    };
    
    const { data, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .single();
    
    if (error) throw error;
    return data as Video;
  },

  async getVideo(id: string) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error) return null;
    return data;
  },

  async getVideoByYouTubeId(youtubeId: string) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('youtube_id', youtubeId)
      .eq('user_id', userId)
      .single();
    
    if (error) return null;
    return data;
  },

  async getAllVideos() {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data || [];
  },

  async searchVideos(query: string) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,channel_title.ilike.%${query}%`);
    
    if (error) throw error;
    return data || [];
  },

  async getRecentVideos(limit = 10) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('last_watched_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return (data || []) as Video[];
  },

  async deleteVideo(id: string) {
    const userId = await getUserId();
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  async updateVideo(id: string, updates: Partial<VideoInput>) {
    const userId = await getUserId();
    const { error } = await supabase
      .from('videos')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      } as Partial<Database['public']['Tables']['videos']['Update']>)
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  // Watch session operations
  async addWatchSession(sessionData: WatchSessionInput): Promise<QueryResult<WatchSession>> {
    const userId = await getUserId();
    const now = new Date().toISOString();

    const sessionWithUser: Database['public']['Tables']['watch_sessions']['Insert'] = {
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
      data: data as WatchSession | null, 
      error 
    };
  },

  async startWatchSession(videoId: string): Promise<WatchSession> {
    const now = new Date().toISOString();
    const sessionData: WatchSessionInput = {
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
    updates: Omit<Partial<WatchSession>, 'updated_at'>
  ): Promise<void> {
    const userId = await getUserId();
    const updateData: Partial<WatchSession> = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('watch_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  async endWatchSession(sessionId: string, finalSecondsWatched: number): Promise<void> {
    const userId = await getUserId();
    const now = new Date().toISOString();
    
    // First get the session to verify it exists and get video_id
    const { data: session, error: sessionError } = await supabase
      .from('watch_sessions')
      .select('video_id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Session not found');
    
    // Update the session
    const updateData: Partial<WatchSession> = {
      ended_at: now,
      seconds_watched: finalSecondsWatched,
      updated_at: now
    };
    
    const { error: updateError } = await supabase
      .from('watch_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', userId);
    
    if (updateError) throw updateError;

    // Update video's last watched time and total watch time
    await this.updateVideoWatchStats(session.video_id, finalSecondsWatched);
  },

  async getWatchSessionsForVideo(videoId: string) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getActiveWatchSession(videoId: string) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    return data || [];
  },

  async getTotalWatchTimeForVideo(videoId: string) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .rpc('get_video_watch_time', { video_id: videoId, user_id: userId });
    
    if (error) throw error;
    return data || 0;
  },

  // User stats operations
  async getUserStats() {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // Create default stats if not exists
    if (error?.code === 'PGRST116') {
      return this.createDefaultUserStats(userId);
    }
    
    if (error) throw error;
    return data;
  },

  async updateUserStats(updates: UserStatsInput): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase
      .from('user_stats')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      } as Partial<Database['public']['Tables']['user_stats']['Update']>)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  async createDefaultUserStats(userId: string): Promise<UserStats> {
    const now = new Date().toISOString();
    const defaultStats: Database['public']['Tables']['user_stats']['Insert'] = {
      user_id: userId,
      total_seconds: 0,
      weekly_goal_seconds: 3600, // 1 hour default goal
      last_watched_at: null,
      streak_days: 0,
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('user_stats')
      .insert(defaultStats)
      .select()
      .single();
    
    if (error) throw error;
    return data as UserStats;
  },

  async updateVideoWatchStats(videoId: string, secondsWatched: number): Promise<void> {
    const userId = await getUserId();
    const now = new Date().toISOString();
    
    try {
      // First get current watch time
      const { data: videoData, error: videoFetchError } = await supabase
        .from('videos')
        .select('watch_seconds')
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();
      
      if (videoFetchError) throw videoFetchError;
      
      const currentWatchTime = videoData?.watch_seconds || 0;
      const newWatchTime = currentWatchTime + secondsWatched;
      
      // Update video watch time
      const { error: videoUpdateError } = await supabase
        .from('videos')
        .update({
          watch_seconds: newWatchTime,
          last_watched_at: now,
          updated_at: now
        })
        .eq('id', videoId)
        .eq('user_id', userId);
      
      if (videoUpdateError) throw videoUpdateError;

      // Update user stats
      const { data: statsData, error: statsFetchError } = await supabase
        .from('user_stats')
        .select('total_seconds')
        .eq('user_id', userId)
        .single();
      
      if (statsFetchError && statsFetchError.code !== 'PGRST116') {
        throw statsFetchError;
      }
      
      const currentTotalSeconds = statsData?.total_seconds || 0;
      const newTotalSeconds = currentTotalSeconds + secondsWatched;
      
      const { error: statsUpdateError } = await supabase
        .from('user_stats')
        .upsert({
          user_id: userId,
          total_seconds: newTotalSeconds,
          last_watched_at: now,
          updated_at: now,
          // Set default values for required fields
          weekly_goal_seconds: 3600,
          streak_days: statsData?.streak_days || 0,
          created_at: statsData?.created_at || now
        })
        .eq('user_id', userId);
      
      if (statsUpdateError) throw statsUpdateError;
      
    } catch (error) {
      console.error('Error updating watch stats:', error);
      throw error;
    }
  },

  // Analytics
  async getWeeklyData() {
    const userId = await getUserId();
    const { data, error } = await supabase
      .rpc('get_weekly_watch_time', { user_id: userId });
    
    if (error) throw error;
    return data || [];
  },

  // Data export/import
  async exportData() {
    const userId = getUserId();
    const [videos, sessions] = await Promise.all([
      this.getAllVideos(),
      this.getAllWatchSessions()
    ]);
    
    return JSON.stringify({
      videos,
      sessions,
      exportedAt: new Date().toISOString()
    });
  },

  async importData(jsonData: string) {
    const userId = getUserId();
    const { videos, sessions } = JSON.parse(jsonData);
    
    // Import videos
    for (const video of videos) {
      // Remove ID to avoid conflicts
      const { id, ...videoData } = video;
      await this.addVideo(videoData);
    }
    
    // Import sessions
    for (const session of sessions) {
      const { id, ...sessionData } = session;
      await supabase
        .from('watch_sessions')
        .insert([{ ...sessionData, user_id: userId }]);
    }
  },

  async getAllWatchSessions() {
    const userId = getUserId();
    const { data, error } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data || [];
  }
};
