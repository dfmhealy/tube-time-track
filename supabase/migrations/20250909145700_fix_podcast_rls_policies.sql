-- Fix RLS policies for podcasts and podcast_episodes tables to allow authenticated users to insert
-- This migration safely adds policies only if they don't already exist

-- Add INSERT policy for podcasts table (allow authenticated users to add podcasts)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'podcasts' 
        AND policyname = 'Authenticated users can insert podcasts'
    ) THEN
        CREATE POLICY "Authenticated users can insert podcasts" 
        ON public.podcasts FOR INSERT 
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Add INSERT policy for podcast episodes table (allow authenticated users to add episodes)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'podcast_episodes' 
        AND policyname = 'Authenticated users can insert podcast episodes'
    ) THEN
        CREATE POLICY "Authenticated users can insert podcast episodes" 
        ON public.podcast_episodes FOR INSERT 
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Add UPDATE policy for podcasts table (for future functionality)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'podcasts' 
        AND policyname = 'Authenticated users can update podcasts'
    ) THEN
        CREATE POLICY "Authenticated users can update podcasts" 
        ON public.podcasts FOR UPDATE 
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Add UPDATE policy for podcast episodes table (for future functionality)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'podcast_episodes' 
        AND policyname = 'Authenticated users can update podcast episodes'
    ) THEN
        CREATE POLICY "Authenticated users can update podcast episodes" 
        ON public.podcast_episodes FOR UPDATE 
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;
