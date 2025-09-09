-- Remove only seed/filler podcasts added before API import feature
-- Deleting from podcasts will cascade to episodes, subscriptions, and sessions via FK constraints

DELETE FROM public.podcasts
WHERE title IN (
  'The AI Podcast',
  'Science Frontiers',
  'Startup Stories',
  'Creative Minds',
  'Startup Series'
);
