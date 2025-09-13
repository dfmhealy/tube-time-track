import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '../lib/database';

// Mock Dexie
vi.mock('dexie', () => {
  const mockDb = {
    watchSessions: {
      add: vi.fn(),
      update: vi.fn(),
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          toArray: vi.fn(),
        })),
      })),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(),
        })),
      })),
    },
  };

  return {
    Dexie: vi.fn(() => mockDb),
  };
});

describe('Watch History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start a watch session', async () => {
    const videoId = 'test-video-123';
    const mockSession = {
      id: 'session-123',
      videoId,
      startedAt: new Date().toISOString(),
      secondsWatched: 0,
      avgPlaybackRate: 1.0,
    };

    // Mock the database add method
    const mockAdd = vi.fn().mockResolvedValue('session-123');
    DatabaseService['db'].watchSessions.add = mockAdd;

    const result = await DatabaseService.startWatchSession(videoId);

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId,
        startedAt: expect.any(String),
        secondsWatched: 0,
        avgPlaybackRate: 1.0,
      })
    );
    expect(result.videoId).toBe(videoId);
  });

  it('should update watch session with elapsed time', async () => {
    const sessionId = 'session-123';
    const updates = {
      secondsWatched: 30,
      avgPlaybackRate: 1.25,
    };

    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    DatabaseService['db'].watchSessions.update = mockUpdate;

    await DatabaseService.updateWatchSession(sessionId, updates);

    expect(mockUpdate).toHaveBeenCalledWith(sessionId, updates);
  });

  it('should end watch session', async () => {
    const sessionId = 'session-123';
    const finalSeconds = 120;

    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    DatabaseService['db'].watchSessions.update = mockUpdate;

    await DatabaseService.endWatchSession(sessionId, finalSeconds);

    expect(mockUpdate).toHaveBeenCalledWith(sessionId, {
      endedAt: expect.any(String),
      secondsWatched: finalSeconds,
    });
  });

  it('should handle watch session updates every 5 seconds', async () => {
    const sessionId = 'session-123';
    
    // Simulate periodic updates
    const updates = [
      { secondsWatched: 5, avgPlaybackRate: 1.0 },
      { secondsWatched: 10, avgPlaybackRate: 1.0 },
      { secondsWatched: 15, avgPlaybackRate: 1.5 },
    ];

    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    DatabaseService['db'].watchSessions.update = mockUpdate;

    for (const update of updates) {
      await DatabaseService.updateWatchSession(sessionId, update);
    }

    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, sessionId, updates[0]);
    expect(mockUpdate).toHaveBeenNthCalledWith(2, sessionId, updates[1]);
    expect(mockUpdate).toHaveBeenNthCalledWith(3, sessionId, updates[2]);
  });
});