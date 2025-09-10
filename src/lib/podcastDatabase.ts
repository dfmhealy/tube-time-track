import { supabase } from '@/integrations/supabase/client';

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
  last_position_seconds?: number;
  is_completed?: boolean;
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
    return data || [];
  },

  async createPodcast(podcast: Omit<Podcast, 'id' | 'created_at' | 'updated_at'>): Promise<Podcast> {
    const { data, error } = await supabase
      .from('podcasts')
      .insert(podcast)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create podcast: ${error.message}`);
    return data;
  },

  async createEpisode(episode: Omit<PodcastEpisode, 'id' | 'created_at' | 'updated_at'>): Promise<PodcastEpisode> {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .insert(episode)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create episode: ${error.message}`);
    return data;
  },

  async importPodcastWithEpisodes(
    podcastData: Omit<Podcast, 'id' | 'created_at' | 'updated_at'>,
    episodesData: Omit<PodcastEpisode, 'id' | 'podcast_id' | 'created_at' | 'updated_at'>[]
  ): Promise<{ podcast: Podcast; episodes: PodcastEpisode[] }> {
    // Check if podcast already exists by RSS URL or title
    if (podcastData.rss_url) {
      const { data: existing } = await supabase
        .from('podcasts')
        .select('*')
        .eq('rss_url', podcastData.rss_url)
        .single();
      
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
      const episodesToInsert = batch.map(ep => ({
        ...ep,
        podcast_id: podcast.id
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
        episodes.push(...data);
      }
    }

    return { podcast, episodes };
  },

  async getPodcast(id: string): Promise<Podcast | undefined> {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return undefined;
      throw new Error(`Failed to fetch podcast: ${error.message}`);
    }
    return data;
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
    return data || [];
  },

  async getEpisode(id: string): Promise<PodcastEpisode | undefined> {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .select(`
        *,
        podcast:podcasts(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return undefined;
      throw new Error(`Failed to fetch episode: ${error.message}`);
    }
    return data;
  },

  // Subscription operations
  async getUserSubscriptions(): Promise<PodcastSubscription[]> {
    const { data, error } = await supabase
      .from('podcast_subscriptions')
      .select(`
        *,
        podcast:podcasts(*)
      `)
      .order('subscribed_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    return data || [];
  },

  async subscribeToPodcast(podcastId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('podcast_subscriptions')
      .insert({
        user_id: user.id,
        podcast_id: podcastId
      });
    
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
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check subscription: ${error.message}`);
    }
    
    return !!data;
  },

  // Listen session operations
  async startListenSession(episodeId: string): Promise<PodcastSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('podcast_sessions')
      .insert({
        user_id: user.id,
        episode_id: episodeId,
        seconds_listened: 0,
        avg_playback_rate: 1.0,
        source: 'web'
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to start session: ${error.message}`);
    return data;
  },

  async updateListenSession(sessionId: string, updates: Partial<PodcastSession>): Promise<void> {
    const { error } = await supabase
      .from('podcast_sessions')
      .update(updates)
      .eq('id', sessionId);
    
    if (error) throw new Error(`Failed to update session: ${error.message}`);
  },

  async endListenSession(sessionId: string, finalSecondsListened: number): Promise<void> {
    const { error } = await supabase
      .from('podcast_sessions')
      .update({
        seconds_listened: finalSecondsListened,
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (error) throw new Error(`Failed to end session: ${error.message}`);
  },

  async getListenSessionsForEpisode(episodeId: string): Promise<PodcastSession[]> {
    const { data, error } = await supabase
      .from('podcast_sessions')
      .select('*')
      .eq('episode_id', episodeId)
      .order('started_at', { ascending: false });
    
    if (error) throw new Error(`Failed to fetch sessions: ${error.message}`);
    return data || [];
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

    // Get the most recent completed session to find last position
    const { data, error } = await supabase
      .from('podcast_sessions')
      .select('seconds_listened')
      .eq('user_id', user.id)
      .eq('episode_id', episodeId)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1);
    
    if (error || !data || data.length === 0) return 0;
    return data[0].seconds_listened || 0;
  },

  async markEpisodeAsCompleted(episodeId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('podcast_episodes')
      .update({ is_completed: true })
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
  }
};