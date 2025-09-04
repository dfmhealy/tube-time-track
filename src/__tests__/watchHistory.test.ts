import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '../lib/database';

// Mock the database
vi.mock('../lib/database', () => ({
  DatabaseService: {
    startWatchSession: vi.fn(),
    updateWatchSession: vi.fn(),
    endWatchSession: vi.fn(),
    getUserStats: vi.fn(),
  }
}));

describe('Watch History Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateWatchHistory', () => {
    const mockSession = { id: 'session-123' };
    const testSeconds = 120;
    const testRate = 1.0;

    it('should update watch session with correct parameters', async () => {
      const mockUpdateWatchSession = vi.mocked(DatabaseService.updateWatchSession);
      
      // Simulate the updateWatchHistory function from PlayerView
      const updateWatchHistory = async (session: any, seconds: number, rate: number) => {
        if (!session) return;
        try {
          await DatabaseService.updateWatchSession(session.id, {
            secondsWatched: seconds,
            avgPlaybackRate: rate
          });
        } catch (error) {
          console.error('Failed to update watch history:', error);
          throw error;
        }
      };

      await updateWatchHistory(mockSession, testSeconds, testRate);

      expect(mockUpdateWatchSession).toHaveBeenCalledWith('session-123', {
        secondsWatched: 120,
        avgPlaybackRate: 1.0
      });
    });

    it('should handle null session gracefully', async () => {
      const mockUpdateWatchSession = vi.mocked(DatabaseService.updateWatchSession);
      
      const updateWatchHistory = async (session: any, seconds: number, rate: number) => {
        if (!session) return;
        await DatabaseService.updateWatchSession(session.id, {
          secondsWatched: seconds,
          avgPlaybackRate: rate
        });
      };

      await updateWatchHistory(null, testSeconds, testRate);

      expect(mockUpdateWatchSession).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockUpdateWatchSession = vi.mocked(DatabaseService.updateWatchSession);
      mockUpdateWatchSession.mockRejectedValue(new Error('Database error'));
      
      const updateWatchHistory = async (session: any, seconds: number, rate: number) => {
        if (!session) return;
        try {
          await DatabaseService.updateWatchSession(session.id, {
            secondsWatched: seconds,
            avgPlaybackRate: rate
          });
        } catch (error) {
          console.error('Failed to update watch history:', error);
          throw error;
        }
      };

      await expect(updateWatchHistory(mockSession, testSeconds, testRate))
        .rejects.toThrow('Database error');
    });
  });

  describe('periodic history updates', () => {
    it('should update history every 5 seconds when conditions are met', () => {
      const mockUpdate = vi.fn();
      let totalSeconds = 0;
      let lastSavedTime = 0;

      // Simulate the periodic update logic
      const simulateWatchTracking = (seconds: number) => {
        totalSeconds += 1; // Simulate 1 second increment
        
        if (Math.floor(totalSeconds) % 5 === 0 && Math.floor(totalSeconds) !== lastSavedTime) {
          mockUpdate(Math.floor(totalSeconds));
          lastSavedTime = Math.floor(totalSeconds);
        }
      };

      // Simulate 10 seconds of watching
      for (let i = 0; i < 10; i++) {
        simulateWatchTracking(i);
      }

      // Should have updated at 5s and 10s
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenCalledWith(5);
      expect(mockUpdate).toHaveBeenCalledWith(10);
    });
  });
});