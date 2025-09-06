-- Create podcasts table
CREATE TABLE public.podcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  creator TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  rss_url TEXT,
  website_url TEXT,
  language TEXT DEFAULT 'en',
  category TEXT,
  total_episodes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create podcast episodes table
CREATE TABLE public.podcast_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  podcast_id UUID NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  episode_number INTEGER,
  season_number INTEGER,
  publish_date TIMESTAMP WITH TIME ZONE,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create podcast subscriptions table
CREATE TABLE public.podcast_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  podcast_id UUID NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, podcast_id)
);

-- Create podcast listen sessions table (similar to watch_sessions but for audio)
CREATE TABLE public.podcast_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  episode_id UUID NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  seconds_listened INTEGER DEFAULT 0,
  avg_playback_rate REAL DEFAULT 1.0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'web',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for podcasts (publicly readable)
CREATE POLICY "Anyone can read podcasts" 
ON public.podcasts FOR SELECT USING (true);

-- RLS policies for podcast episodes (publicly readable)
CREATE POLICY "Anyone can read podcast episodes" 
ON public.podcast_episodes FOR SELECT USING (true);

-- RLS policies for podcast subscriptions
CREATE POLICY "Users can view own subscriptions" 
ON public.podcast_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions" 
ON public.podcast_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" 
ON public.podcast_subscriptions FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for podcast sessions
CREATE POLICY "Users can view own podcast sessions" 
ON public.podcast_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own podcast sessions" 
ON public.podcast_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own podcast sessions" 
ON public.podcast_sessions FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to update podcast statistics
CREATE OR REPLACE FUNCTION public.update_podcast_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update total seconds in user_stats (include podcast listening time)
  UPDATE user_stats 
  SET 
    total_seconds = (
      SELECT COALESCE(
        (SELECT SUM(seconds_watched) FROM watch_sessions WHERE user_id = NEW.user_id AND ended_at IS NOT NULL), 0
      ) + COALESCE(
        (SELECT SUM(seconds_listened) FROM podcast_sessions WHERE user_id = NEW.user_id AND ended_at IS NOT NULL), 0
      )
    ),
    last_watched_at = GREATEST(last_watched_at, NEW.ended_at),
    updated_at = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for podcast session updates
CREATE TRIGGER update_podcast_stats_trigger
  AFTER UPDATE ON public.podcast_sessions
  FOR EACH ROW
  WHEN (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL)
  EXECUTE FUNCTION public.update_podcast_stats();

-- Create indexes for better performance
CREATE INDEX idx_podcast_episodes_podcast_id ON public.podcast_episodes(podcast_id);
CREATE INDEX idx_podcast_subscriptions_user_id ON public.podcast_subscriptions(user_id);
CREATE INDEX idx_podcast_sessions_user_id ON public.podcast_sessions(user_id);
CREATE INDEX idx_podcast_sessions_episode_id ON public.podcast_sessions(episode_id);