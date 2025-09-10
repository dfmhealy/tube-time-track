-- Add is_completed column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Add is_completed column to podcast_episodes table  
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_is_completed ON videos(is_completed);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_is_completed ON podcast_episodes(is_completed);
