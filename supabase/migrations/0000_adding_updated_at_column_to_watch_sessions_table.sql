ALTER TABLE public.watch_sessions
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows to have a value for updated_at
UPDATE public.watch_sessions
SET updated_at = NOW()
WHERE updated_at IS NULL;