-- Insert sample podcast data for testing
INSERT INTO public.podcasts (title, description, creator, thumbnail_url, rss_url, language, category, total_episodes) VALUES
('The AI Podcast', 'Exploring the latest developments in artificial intelligence and machine learning.', 'TechCorp', 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop', 'https://example.com/ai-podcast.rss', 'en', 'Technology', 25),
('Science Frontiers', 'Breaking down complex scientific discoveries for everyone to understand.', 'Science Media', 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=400&fit=crop', 'https://example.com/science-frontiers.rss', 'en', 'Science', 42),
('Startup Stories', 'Real stories from entrepreneurs who built successful companies.', 'Business Network', 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop', 'https://example.com/startup-stories.rss', 'en', 'Business', 18),
('History Unplugged', 'Diving deep into fascinating moments from human history.', 'History Channel', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&fit=crop', 'https://example.com/history-unplugged.rss', 'en', 'History', 67),
('Creative Minds', 'Conversations with artists, designers, and creative professionals.', 'Creative Studios', 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=400&fit=crop', 'https://example.com/creative-minds.rss', 'en', 'Arts', 31);

-- Insert sample episodes for The AI Podcast
INSERT INTO public.podcast_episodes (podcast_id, title, description, audio_url, duration_seconds, episode_number, publish_date, thumbnail_url) 
SELECT 
    p.id,
    'The Future of Machine Learning',
    'In this episode, we explore the cutting-edge developments in machine learning and what they mean for the future.',
    'https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/explosion_07.mp3',
    2847,
    25,
    '2024-01-15T10:00:00Z'::timestamptz,
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop'
FROM public.podcasts p WHERE p.title = 'The AI Podcast';

INSERT INTO public.podcast_episodes (podcast_id, title, description, audio_url, duration_seconds, episode_number, publish_date, thumbnail_url) 
SELECT 
    p.id,
    'Neural Networks Explained',
    'A deep dive into how neural networks work and their applications in modern AI systems.',
    'https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/explosion_07.mp3',
    3156,
    24,
    '2024-01-08T10:00:00Z'::timestamptz,
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop'
FROM public.podcasts p WHERE p.title = 'The AI Podcast';

-- Insert sample episodes for Science Frontiers
INSERT INTO public.podcast_episodes (podcast_id, title, description, audio_url, duration_seconds, episode_number, publish_date, thumbnail_url) 
SELECT 
    p.id,
    'Quantum Computing Breakthrough',
    'Scientists achieve a major breakthrough in quantum computing that could revolutionize technology.',
    'https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/explosion_07.mp3',
    2654,
    42,
    '2024-01-12T15:00:00Z'::timestamptz,
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=400&fit=crop'
FROM public.podcasts p WHERE p.title = 'Science Frontiers';

-- Insert sample episodes for Startup Stories
INSERT INTO public.podcast_episodes (podcast_id, title, description, audio_url, duration_seconds, episode_number, publish_date, thumbnail_url) 
SELECT 
    p.id,
    'From Garage to IPO',
    'The incredible journey of a tech startup from a garage to a billion-dollar public company.',
    'https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/explosion_07.mp3',
    2234,
    18,
    '2024-01-10T12:00:00Z'::timestamptz,
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop'
FROM public.podcasts p WHERE p.title = 'Startup Stories';