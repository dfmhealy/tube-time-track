import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseService } from '@/lib/database';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          order: vi.fn(() => ({}))
        })),
        or: vi.fn(() => ({}))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }
}));

describe('DatabaseService', () => {
  const mockUser = { id: 'user-123' };
  
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser } });
  });

  describe('addVideo', () => {
    it('should add a video to the database', async () => {
      const mockVideoData = {
        id: 'video-123',
        youtube_id: 'abc123',
        title: 'Test Video',
        channel_title: 'Test Channel',
        duration_seconds: 300,
        thumbnail_url: 'https://example.com/thumb.jpg',
        tags: [],
        added_at: '2024-01-01T00:00:00Z',
        watch_seconds: 0,
        last_watched_at: null
      };

      const mockChain = {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockVideoData, error: null })
        }))
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue(mockChain)
      });

      const result = await DatabaseService.addVideo({
        youtubeId: 'abc123',
        title: 'Test Video',
        channelTitle: 'Test Channel',
        durationSeconds: 300,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        tags: [],
        addedAt: '2024-01-01T00:00:00Z'
      });

      expect(result.id).toBe('video-123');
      expect(result.youtubeId).toBe('abc123');
      expect(result.title).toBe('Test Video');
    });
  });

  describe('startWatchSession', () => {
    it('should start a new watch session', async () => {
      const mockSessionData = {
        id: 'session-123',
        video_id: 'video-123',
        started_at: '2024-01-01T00:00:00Z',
        ended_at: null,
        seconds_watched: 0,
        avg_playback_rate: 1.0,
        source: 'web'
      };

      const mockChain = {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockSessionData, error: null })
        }))
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue(mockChain)
      });

      const result = await DatabaseService.startWatchSession('video-123');

      expect(result.id).toBe('session-123');
      expect(result.videoId).toBe('video-123');
      expect(result.secondsWatched).toBe(0);
    });
  });

  describe('updateWatchSession', () => {
    it('should update watch session progress', async () => {
      (supabase.from as any).mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null })
        }))
      });

      await DatabaseService.updateWatchSession('session-123', {
        secondsWatched: 150,
        avgPlaybackRate: 1.5
      });

      expect(supabase.from).toHaveBeenCalledWith('watch_sessions');
    });
  });

  describe('endWatchSession', () => {
    it('should end a watch session', async () => {
      (supabase.from as any).mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null })
        }))
      });

      await DatabaseService.endWatchSession('session-123', 300);

      expect(supabase.from).toHaveBeenCalledWith('watch_sessions');
    });
  });

  describe('getUserStats', () => {
    it('should retrieve user stats', async () => {
      const mockStats = {
        id: 'stats-123',
        total_seconds: 3600,
        weekly_goal_seconds: 18000,
        last_watched_at: '2024-01-01T00:00:00Z',
        streak_days: 5
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockStats, error: null })
          }))
        }))
      });

      const result = await DatabaseService.getUserStats();

      expect(result?.totalSeconds).toBe(3600);
      expect(result?.streakDays).toBe(5);
    });
  });
});