-- Fix watch time tracking to properly combine video and podcast time
-- Add progress saving for resume functionality

-- First, update the video watch session function to include podcast time
CREATE OR REPLACE FUNCTION public.update_user_total_seconds()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total seconds in user_stats (include both video and podcast listening time)
  UPDATE public.user_stats 
  SET 
    total_seconds = (
      SELECT COALESCE(
        (SELECT SUM(seconds_watched) FROM public.watch_sessions WHERE user_id = NEW.user_id AND ended_at IS NOT NULL), 0
      ) + COALESCE(
        (SELECT SUM(seconds_listened) FROM public.podcast_sessions WHERE user_id = NEW.user_id AND ended_at IS NOT NULL), 0
      )
    ),
    last_watched_at = GREATEST(last_watched_at, NEW.ended_at),
    updated_at = now()
  WHERE user_id = NEW.user_id;
  
  -- Update video watch_seconds and progress
  UPDATE public.videos 
  SET 
    watch_seconds = (
      SELECT COALESCE(SUM(seconds_watched), 0) 
      FROM public.watch_sessions 
      WHERE video_id = NEW.video_id AND ended_at IS NOT NULL
    ),
    last_watched_at = GREATEST(last_watched_at, NEW.ended_at)
  WHERE id = NEW.video_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add progress columns to videos table for resume functionality
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'last_position_seconds') THEN
        ALTER TABLE public.videos ADD COLUMN last_position_seconds INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'is_completed') THEN
        ALTER TABLE public.videos ADD COLUMN is_completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add progress columns to podcast_episodes table for resume functionality
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'podcast_episodes' AND column_name = 'last_position_seconds') THEN
        ALTER TABLE public.podcast_episodes ADD COLUMN last_position_seconds INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'podcast_episodes' AND column_name = 'is_completed') THEN
        ALTER TABLE public.podcast_episodes ADD COLUMN is_completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create function to update video progress
CREATE OR REPLACE FUNCTION public.update_video_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update video progress when watch session is updated
  UPDATE public.videos 
  SET 
    last_position_seconds = GREATEST(last_position_seconds, NEW.seconds_watched),
    is_completed = CASE 
      WHEN NEW.seconds_watched >= (duration_seconds * 0.9) THEN true 
      ELSE is_completed 
    END
  WHERE id = NEW.video_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update podcast episode progress  
CREATE OR REPLACE FUNCTION public.update_podcast_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update podcast episode progress when session is updated
  UPDATE public.podcast_episodes 
  SET 
    last_position_seconds = GREATEST(last_position_seconds, NEW.seconds_listened),
    is_completed = CASE 
      WHEN NEW.seconds_listened >= (duration_seconds * 0.9) THEN true 
      ELSE is_completed 
    END
  WHERE id = NEW.episode_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for progress tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_video_progress_trigger') THEN
    CREATE TRIGGER update_video_progress_trigger
      AFTER UPDATE ON public.watch_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_video_progress();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_podcast_progress_trigger') THEN
    CREATE TRIGGER update_podcast_progress_trigger
      AFTER UPDATE ON public.podcast_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_podcast_progress();
  END IF;
END $$;

-- Create indexes for progress queries
CREATE INDEX IF NOT EXISTS idx_videos_last_position ON public.videos(last_position_seconds);
CREATE INDEX IF NOT EXISTS idx_videos_is_completed ON public.videos(is_completed);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_last_position ON public.podcast_episodes(last_position_seconds);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_is_completed ON public.podcast_episodes(is_completed);
