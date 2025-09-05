-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Fix the update_user_total_seconds function
CREATE OR REPLACE FUNCTION public.update_user_total_seconds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update total seconds in user_stats
  UPDATE user_stats 
  SET 
    total_seconds = (
      SELECT COALESCE(SUM(seconds_watched), 0) 
      FROM watch_sessions 
      WHERE user_id = NEW.user_id AND ended_at IS NOT NULL
    ),
    last_watched_at = GREATEST(last_watched_at, NEW.ended_at),
    updated_at = now()
  WHERE user_id = NEW.user_id;
  
  -- Update video watch_seconds
  UPDATE videos 
  SET 
    watch_seconds = (
      SELECT COALESCE(SUM(seconds_watched), 0) 
      FROM watch_sessions 
      WHERE video_id = NEW.video_id AND ended_at IS NOT NULL
    ),
    last_watched_at = GREATEST(last_watched_at, NEW.ended_at)
  WHERE id = NEW.video_id;
  
  RETURN NEW;
END;
$$;