-- Clear all podcast-related data
-- This will remove all rows from podcast tables in the correct dependency order

-- Option 1: Use TRUNCATE with CASCADE to handle dependencies automatically
TRUNCATE TABLE
  public.podcast_sessions,
  public.podcast_subscriptions,
  public.podcast_episodes,
  public.podcasts
RESTART IDENTITY CASCADE;

-- Option 2 (commented): Explicit deletes in dependency order if preferred
-- DELETE FROM public.podcast_sessions;
-- DELETE FROM public.podcast_subscriptions;
-- DELETE FROM public.podcast_episodes;
-- DELETE FROM public.podcasts;
