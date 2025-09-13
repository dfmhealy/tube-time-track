ALTER TABLE public.video_channel_subscriptions
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows to have a value for updated_at
UPDATE public.video_channel_subscriptions
SET updated_at = NOW()
WHERE updated_at IS NULL;