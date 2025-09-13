import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PodcastEpisodeRow = Database['public']['Tables']['podcast_episodes']['Row'];
type PodcastEpisodeInsert = Database['public']['Tables']['podcast_episodes']['Insert'];
type PodcastEpisodeUpdate = Database['public']['Tables']['podcast_episodes']['Update'];

type PodcastRow = Database['public']['Tables']['podcasts']['Row'];
type PodcastInsert = Database['public']['Tables']['podcasts']['Insert'];
type PodcastUpdate = Database['public']['Tables']['podcasts']['Update'];

type PodcastSubscriptionRow = Database['public']['Tables']['podcast_subscriptions']['Row'];
type PodcastSubscriptionInsert = Database['public']['Tables']['podcast_subscriptions']['Insert'];
type PodcastSubscriptionUpdate = Database['public']['Tables']['podcast_subscriptions']['Update'];

type PodcastSessionRow = Database['public']['Tables']['podcast_sessions']['Row'];
type PodcastSessionInsert = Database['public']['Tables']['podcast_sessions']['Insert'];
type PodcastSessionUpdate = Database['public']['Tables']['podcast_sessions']['Update'];


// Data models for podcasts
export interface Podcast {
  id: string;
  title: string;
  description?: string;
  creator: string;
  thumbnail_url: string;
  rss_url?: string;
  website_url?: string;
  language: string;
  category?: string;
  total_episodes: number;
  created_at: string;
  updated_at: string;
}

export interface PodcastEpisode {
  id: string;
  podcast_id: string;
  title: string;
  description?: string;
  audio_url: string;
  duration_seconds: number;
  episode_number?: number;
  season_number?: number;
  publish_date?: string;
  thumbnail_url?: string;
  last_position_seconds: number; // Added for resume functionality
  is_completed: boolean; // Added for completion tracking
  created_at: string;
  updated_at: string;
  podcast?: Podcast;
}

export interface PodcastSubscription {
  id: string;
  user_id: string;
  podcast_id: string;
  subscribed_at: string;
  podcast?: Podcast;
}

export interface PodcastSession {
  id: string;
  user_id: string;
  episode_id: string;
  seconds_listened: number;
  avg_playback_rate: number;
  started_at?: string;
  ended_at?: string;
  source: string;
  created_at: string;
}

export const PodcastDatabaseService = {
  // Podcast operations
  async getAllPodcasts(): Promise<Podcast[]> {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .order('title');
    
    if (error) throw new Error(`Failed to fetch podcasts: ${error.message}`);
    return (data || []).map(p => ({
      id: p.id,
      title: p.title,
      description: p.description || undefined,
      creator: p.creator,
      thumbnail_url: p.thumbnail_url,
      rss_url: p.rss_url || undefined,
      website_url: p.website_url || undefined,
      language: p.language || 'en',
      category: p.category || undefined,
      total_episodes: p.total_episodes || 0,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));
  },

  async updateEpisodeProgress(episodeId: string, lastPositionSeconds: number): Promise<void> {
    // Validate position value
    const validPosition = Math.max(0, Math.floor(lastPositionSeconds));
    
    const { error } = await supabase
      .from('podcast_episodes')
      .update({ 
        last_position_seconds: validPosition,
        updated_at: new Date().toISOString()
      } as PodcastEpisodeUpdate)
      .eq('id', episodeId);
    if (error) throw new Error(`Failed to update episode progress: ${error.message}`);
  },

  async createPodcast(podcast: Omit<Podcast, 'id' | 'created_at' | 'updated_at'>): Promise<Podcast> {
    const { data, error } = await supabase
      .from('podcasts')
      .insert(podcast as PodcastInsert)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create podcast: ${error.message}`);
    return {
      id: data.id,
      title: data.title,
      description: data.description || undefined,
      creator: data.creator,
      thumbnail_url: data.thumbnail_url,
      rss_url: data.rss_url || undefined,
      website_url: data.website_url || undefined,
      language: data.language || 'en',
      category: data.category || undefined,
      total_episodes: data.total_episodes || 0,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  },

  async createEpisode(episode: Omit<PodcastEpisode, 'id' | 'created_at' | 'updated_at' | 'last_position_seconds' | 'is_completed'>): Promise<PodcastEpisode> {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .insert({
        ...episode,
        last_position_seconds: 0, // Initialize new field
        is_completed: false // Initialize new field
      } as PodcastEpisodeInsert)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create episode: ${error.message}`);
    return {
      id: data.id,
      podcast_id: data.podcast_id,
      title: data.title,
      description: data.description || undefined,
      audio_url: data.audio_url,
      duration_seconds: data.duration_seconds || 0,
      episode_number: data.episode_number || undefined,
      season_number: data.season_number || undefined,
      publish_date: data.publish_date || undefined,
      thumbnail_url: data.thumbnail_url || undefined,
      last_position_seconds: data.last_position_seconds || 0,
      is_completed: data.is_completed || false,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  },

  async importPodcastWithEpisodes(
    podcastData: Omit<Podcast, 'id' | 'created_at' | 'updated_at'>,
    episodesData: Omit<PodcastEpisode, 'id' | 'podcast_id' | 'created_at' | 'updated_at' | 'last_position_seconds' | 'is_completed'>[]
  ): Promise<{ podcast: Podcast; episodes: PodcastEpisode[] }> {
    // Check if podcast already exists by RSS URL or title
    if (podcastData.rss_url) {
      const { data: existing } = await supabase
        .from('podcasts')
        .select('*')
        .eq('rss_url', podcastData.rss_url)
        .maybeSingle(); // Use maybeSingle to handle no results gracefully
      
      if (existing) {
        throw new Error('Podcast already exists in your library');
      }
    }

    // Create podcast
    const podcast = await this.createPodcast(podcastData);

    // Create episodes in batches to avoid timeout
    const episodes: PodcastEpisode[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < episodesData.length; i += batchSize) {
      const batch = episodesData.slice(i, i + batchSize);
      const episodesToInsert: PodcastEpisodeInsert[] = batch.map(ep => ({
        ...ep,
        podcast_id: podcast.id,
        last_position_seconds: 0, // Initialize new field
        is_completed: false // Initialize new field
      }));

      const { data, error } = await supabase
        .from('podcast_episodes')
        .insert(episodesToInsert)
        .select();

      if (error) {
        console.error(`Failed to insert episode batch ${i}-${i + batchSize}:`, error);
        continue;
      }

      if (data) {
        episodes.push(...data.map(ep => ({
          id: ep.id,
          podcast_id: ep.podcast_id,
          title: ep.title,
          description: ep.description || undefined,
          audio_url: ep.audio_url,
          duration_seconds: ep.duration_seconds || 0,
          episode_number: ep.episode_number || undefined,
          season_number: ep.season_number || undefined,
          publish_date: ep.publish_date || undefined,
          thumbnail_url: ep.thumbnail_url || undefined,
          last_position_seconds: ep.last_position_seconds || 0,
          is_completed: ep.is_completed || false,
          created_at: ep.created_at,
          updated_at: ep.updated_at
        })));
      }
    }

    return { podcast, episodes };
  },

  async getPodcast(id: string): Promise<Podcast | undefined> {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .eq('id', id)
      .maybeSingle(); // Use maybeSingle to handle no results gracefully
    
    if (error) {
      if (error.code === 'PGRST116') return undefined;
      throw new Error(`Failed to fetch podcast: ${error.message}`);
    }
    return data ? {
      id: data.id,
      title: data.title,
      description: data.description || undefined,
      creator: data.creator,
      thumbnail_url: data.thumbnail_url,
      rss_url: data.rss_url || undefined,
      website_url: data.website_url || undefined,
      language: data.language || 'en',
      category: data.category || undefined,
      total_episodes: data.total_episodes || 0,
      created_at: data.created_at,
      updated_at: data.updated_at
    } : undefined;
  },

  // Episode operations
  async getEpisodesForPodcast(podcastId: string): Promise<PodcastEpisode[]> {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .select(`
        *,
        podcast:podcasts(*)
      `)
      .eq('podcast_id', podcastId)
      .order('episode_number', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch episodes: ${error.message}`);
    return (data || []).map(ep => ({
      id: ep.id,
      podcast_id: ep.podcast_id,
      title: ep.title,
      description: ep.description || undefined,
      audio_url: ep.audio_url,
      duration_seconds: ep.duration_seconds || 0,
      episode_number: ep.episode_number || undefined,
      season_number: ep.season_number || undefined,
      publish_date: ep.publish_date || undefined,
      thumbnail_url: ep.thumbnail_url || undefined,
      last_position_seconds: ep.last_position_seconds || 0,
      is_completed: ep.is_completed || false,
      created_at: ep.created_at,
      updated_at: ep.updated_at,
      podcast: ep.podcast ? {
        id: ep.podcast.id,
        title: ep.podcast.title,
        description: ep.podcast.description || undefined,
        creator: ep.podcast.creator,
        thumbnail_url: ep.podcast.thumbnail_url,
        rss_url: ep.podcast.rss_url || undefined,
        website_url: ep.podcast.website_url || undefined,
        language: ep.podcast.language || 'en',
        category: ep.podcast.category || undefined,
        total_episodes: ep.podcast.total_episodes || 0,
        created_at: ep.podcast.created_at,
        updated_at: ep.podcast.updated_at
      } : undefined
    }));
  },

  async getEpisode(id: string): Promise<PodcastEpisode | undefined> {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .select(`
        *,
        podcast:podcasts(*)
      `)
      .eq('id', id)
      .maybeSingle(); // Use maybeSingle to handle no results gracefully
    
    if (error) {
      if (error.code === 'PGRST116') return undefined;
      throw new Error(`Failed to fetch episode: ${error.message}`);
    }
    return data ? {
      id: data.id,
      podcast_id: data.podcast_id,
      title: data.title,
      description: data.description || undefined,
      audio_url: data.audio_url,
      duration_seconds: data.duration_seconds || 0,
      episode_number: data.episode_number || undefined,
      season_number: data.season_number || undefined,
      publish_date: data.publish_date || undefined,
      thumbnail_url: data.thumbnail_url || undefined,
      last_position_seconds: data.last_position_seconds || 0,
      is_completed: data.is_completed || false,
      created_at: data.created_at,
      updated_at: data.updated_at,
      podcast: data.podcast ? {
        id: data.podcast.id,
        title: data.podcast.title,
        description: data.podcast.description || undefined,
        creator: data.podcast.creator,
        thumbnail_url: data.podcast.thumbnail_url,
        rss_url: data.podcast.rss_url || undefined,
        website_url: data.podcast.website_url || undefined,
        language: data.podcast.language || 'en',
        category: data.podcast.category || undefined,
        total_episodes: data.podcast.total_episodes || 0,
        created_at: data.podcast.created_at,
        updated_at: data.podcast.updated_at
      } : undefined
    } : undefined;
  },

  // Subscription operations
  async getUserSubscriptions(): Promise<PodcastSubscription[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('podcast_subscriptions')
      .select(`
        *,
        podcast:podcasts(*)
      `)
      .eq('user_id', user.id)
      .order('subscribed_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    return (data || []).map(sub => ({
      id: sub.id,
      user_id: sub.user_id,
      podcast_id: sub.podcast_id,
      subscribed_at: sub.subscribed_at,
      podcast: sub.podcast ? {
        id: sub.podcast.id,
        title: sub.podcast.title,
        description: sub.podcast.description || undefined,
        creator: sub.podcast.creator,
        thumbnail_url: sub.podcast.thumbnail_url,
        rss_url: sub.podcast.rss_url || undefined,
        website_url: sub.podcast.website_url || undefined,
        language: sub.podcast.language || 'en',
        category: sub.podcast.category || undefined,
        total_episodes: sub.podcast.total_episodes || 0,
        created_at: sub.podcast.created_at,
        updated_at: sub.podcast.updated_at
      } : undefined
    }));
  },

  async subscribeToPodcast(podcastId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('podcast_subscriptions')
      .insert({
        user_id: user.id,
        podcast_id: podcastId
      } as PodcastSubscriptionInsert);
    
    if (error) throw new Error(`Failed to subscribe: ${error.message}`);
  },

  async unsubscribeFromPodcast(podcastId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('podcast_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('podcast_id', podcastId);
    
    if (error) throw new Error(`Failed to unsubscribe: ${error.message}`);
  },

  async isSubscribedToPodcast(podcastId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('podcast_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('podcast_id', podcastId)
      .maybeSingle(); // Use maybeSingle to handle no results gracefully
    
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check subscription: ${error.message}`);
    }
    
    return !!data;
  },

  // Listen session operations
  async startListenSession(episodeId: string): Promise<PodcastSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if there's already an active session for this episode
    const { data: existingSession } = await supabase
      .from('podcast_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('episode_id', episodeId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If there's an active session, return it instead of creating a new one
    if (existingSession) {
      return {
        id: existingSession.id,
        user_id: existingSession.user_id,
        episode_id: existingSession.episode_id,
        seconds_listened: existingSession.seconds_listened || 0,
        avg_playback_rate: existingSession.avg_playback_rate || 1.0,
        started_at: existingSession.started_at || undefined,
        ended_at: existingSession.ended_at || undefined,
        source: existingSession.source || 'web',
        created_at: existingSession.created_at
      };
    }

    const { data, error } = await supabase
      .from('podcast_sessions')
      .insert({
        user_id: user.id,
        episode_id: episodeId,
        seconds_listened: 0,
        avg_playback_rate: 1.0,
        source: 'web'
      } as PodcastSessionInsert)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to start session: ${error.message}`);
    return {
      id: data.id,
      user_id: data.user_id,
      episode_id: data.episode_id,
      seconds_listened: data.seconds_listened || 0,
      avg_playback_rate: data.avg_playback_rate || 1.0,
      started_at: data.started_at || undefined,
      ended_at: data.ended_at || undefined,
      source: data.source || 'web',
      created_at: data.created_at
    };
  },

  async updateListenSession(sessionId: string, updates: Partial<PodcastSession>): Promise<void> {
    if (!sessionId) return;
    
    // Validate updates
    const validUpdates: PodcastSessionUpdate = {};
    
    if (updates.seconds_listened !== undefined) {
      const validSeconds = Math.max(0, Math.floor(updates.seconds_listened || 0));
      validUpdates.seconds_listened = validSeconds;
    }
    if (updates.avg_playback_rate !== undefined) {
      const validRate = Math.max(0.25, Math.min(4, updates.avg_playback_rate || 1));
      validUpdates.avg_playback_rate = validRate;
    }
    if (updates.ended_at !== undefined) {
      validUpdates.ended_at = updates.ended_at;
    }
    if (updates.started_at !== undefined) {
      validUpdates.started_at = updates.started_at;
    }
    if (updates.source !== undefined) {
      validUpdates.source = updates.source;
    }
    
    // Only update if we have valid data
    if (Object.keys(validUpdates).length === 0) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { error } = await supabase
      .from('podcast_sessions')
      .update(validUpdates)
      .eq('id', sessionId)
      .eq('user_id', user.id); // Ensure user can only update their own sessions
    
    if (error) throw new Error(`Failed to update session: ${error.message}`);
  },

  async endListenSession(sessionId: string, finalSecondsListened: number): Promise<void> {
    if (!sessionId) return;
    
    // Validate final seconds - ensure it's not negative or NaN
    const validSeconds = Math.max(0, Math.floor(finalSecondsListened || 0));
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('podcast_sessions')
      .update({
        seconds_listened: validSeconds,
        ended_at: new Date().toISOString()
      } as PodcastSessionUpdate)
      .eq('id', sessionId)
      .eq('user_id', user.id) // Ensure user can only end their own sessions
      .select('*');
    
    if (error) throw new Error(`Failed to end session: ${error.message}`);
    
    // Update episode progress when session ends
    if (data && data.length > 0) {
      const episodeId = data[0].episode_id as string | undefined;
      if (episodeId) {
        try {
          await this.updateEpisodeProgress(episodeId, validSeconds);
        } catch (e) {
          console.error('Failed to update episode progress on end:', e);
        }
      }
    }
  },

  async getListenSessionsForEpisode(episodeId: string): Promise<PodcastSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('podcast_sessions')
      .select('*')
      .eq('episode_id', episodeId)
      .eq('user_id', user.id) // Ensure user can only see their own sessions
      .order('started_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch sessions: ${error.message}`);
    return (data || []).map(session => ({
      id: session.id,
      user_id: session.user_id,
      episode_id: session.episode_id,
      seconds_listened: session.seconds_listened || 0,
      avg_playback_rate: session.avg_playback_rate || 1.0,
      started_at: session.started_at || undefined,
      ended_at: session.ended_at || undefined,
      source: session.source || 'web',
      created_at: session.created_at
    }));
  },

  async getTotalListenTimeForEpisode(episodeId: string): Promise<number> {
    const sessions = await this.getListenSessionsForEpisode(episodeId);
    return sessions
      .filter(session => session.ended_at)
      .reduce((total, session) => total + session.seconds_listened, 0);
  },

  async getLastPositionForEpisode(episodeId: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    // First try to get position from episode record
    const { data: episodeData, error: episodeError } = await supabase
      .from('podcast_episodes')
      .select('last_position_seconds')
      .eq('id', episodeId)
      .single();
    
    if (episodeError) {
      console.error('Error fetching episode last position:', episodeError);
      // Fallback to 0 if there's an error fetching episode data
      return 0;
    }
    
    if (episodeData?.last_position_seconds && episodeData.last_position_seconds > 0) {
      return Math.max(0, Math.floor(episodeData.last_position_seconds));
    }
    
    // Fallback: Get position from most recent session
    const { data, error } = await supabase
      .from('podcast_sessions')
      .select('seconds_listened, started_at, ended_at')
      .eq('user_id', user.id)
      .eq('episode_id', episodeId)
      .order('started_at', { ascending: false })
      .limit(1);
    
    if (error || !data || data.length === 0) return 0;
    return Math.max(0, Math.floor(data[0].seconds_listened || 0));
  },

  async markEpisodeAsCompleted(episodeId: string, isCompleted: boolean = true): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if already completed to avoid unnecessary updates
    const { data: currentEpisode, error: fetchError } = await supabase
      .from('podcast_episodes')
      .select('is_completed')
      .eq('id', episodeId)
      .single();
      
    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // Handle actual errors
    if (currentEpisode?.is_completed === isCompleted) return; // Already in desired state

    const { error } = await supabase
      .from('podcast_episodes')
      .update({ is_completed: isCompleted } as PodcastEpisodeUpdate)
      .eq('id', episodeId);
    
    if (error) throw new Error(`Failed to mark episode as completed: ${error.message}`);
  },

  async getEpisodeCompletionStatus(episodeId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .select('is_completed')
      .eq('id', episodeId)
      .single();
    
    if (error) return false;
    return data?.is_completed || false;
  },

  async createEpisodes(episodes: Omit<PodcastEpisode, 'id' | 'created_at' | 'updated_at' | 'last_position_seconds' | 'is_completed'>[]): Promise<PodcastEpisode[]> {
    const episodesToInsert: PodcastEpisodeInsert[] = episodes.map(ep => ({
      ...ep,
      last_position_seconds: 0,
      is_completed: false
    }));

    const { data, error } = await supabase
      .from('podcast_episodes')
      .insert(episodesToInsert)
      .select();
    
    if (error) throw new Error(`Failed to create episodes: ${error.message}`);
    return (data || []).map(ep => ({
      id: ep.id,
      podcast_id: ep.podcast_id,
      title: ep.title,
      description: ep.description || undefined,
      audio_url: ep.audio_url,
      duration_seconds: ep.duration_seconds || 0,
      episode_number: ep.episode_number || undefined,
      season_number: ep.season_number || undefined,
      publish_date: ep.publish_date || undefined,
      thumbnail_url: ep.thumbnail_url || undefined,
      last_position_seconds: ep.last_position_seconds || 0,
      is_completed: ep.is_completed || false,
      created_at: ep.created_at,
      updated_at: ep.updated_at
    }));
  }
};