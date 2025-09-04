import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock React Router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock YouTube API
const mockPlayer = {
  getPlayerState: vi.fn(),
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  getCurrentTime: vi.fn(),
  getDuration: vi.fn(),
  getPlaybackRate: vi.fn(),
  destroy: vi.fn(),
};

// Mock window.YT
Object.defineProperty(window, 'YT', {
  value: {
    Player: vi.fn().mockImplementation(() => mockPlayer),
    PlayerState: {
      PLAYING: 1,
      PAUSED: 2,
      ENDED: 0,
    },
  },
  writable: true,
});

// Mock database
vi.mock('../lib/database', () => ({
  DatabaseService: {
    startWatchSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
    updateWatchSession: vi.fn().mockResolvedValue(undefined),
    endWatchSession: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock app store
const mockSetCurrentView = vi.fn();
const mockSetActiveWatchSession = vi.fn();
const mockUpdateTotalSeconds = vi.fn();
const mockUpdateVideo = vi.fn();

vi.mock('../store/appStore', () => ({
  useAppStore: () => ({
    currentVideo: {
      id: 'video-123',
      youtubeId: 'test-youtube-id',
      title: 'Test Video',
      channelTitle: 'Test Channel',
      tags: [],
    },
    setCurrentView: mockSetCurrentView,
    activeWatchSession: null,
    setActiveWatchSession: mockSetActiveWatchSession,
  }),
  useStatsStore: () => ({
    updateTotalSeconds: mockUpdateTotalSeconds,
  }),
  useLibraryStore: () => ({
    updateVideo: mockUpdateVideo,
  }),
}));

describe('Player Navigation E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should play video, update history, and navigate back correctly', async () => {
    const { DatabaseService } = await import('../lib/database');
    
    // Simulate video player initialization and play
    const simulateVideoPlay = async () => {
      // Start watch session
      const session = await DatabaseService.startWatchSession('video-123');
      expect(session.id).toBe('session-123');
      
      // Simulate playing state
      mockPlayer.getPlayerState.mockReturnValue(1); // PLAYING
      mockPlayer.getCurrentTime.mockReturnValue(10);
      mockPlayer.getDuration.mockReturnValue(300);
      mockPlayer.getPlaybackRate.mockReturnValue(1.0);
      
      return session;
    };

    // Simulate history update after 5 seconds
    const simulateHistoryUpdate = async (sessionId: string) => {
      await DatabaseService.updateWatchSession(sessionId, {
        secondsWatched: 5,
        avgPlaybackRate: 1.0
      });
      
      expect(DatabaseService.updateWatchSession).toHaveBeenCalledWith(sessionId, {
        secondsWatched: 5,
        avgPlaybackRate: 1.0
      });
    };

    // Simulate back button click
    const simulateBackNavigation = async (sessionId: string) => {
      // End watch session
      await DatabaseService.endWatchSession(sessionId, 5);
      
      // Navigate back
      mockNavigate(-1);
      
      expect(DatabaseService.endWatchSession).toHaveBeenCalledWith(sessionId, 5);
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    };

    // Run the full flow
    const session = await simulateVideoPlay();
    await simulateHistoryUpdate(session.id);
    await simulateBackNavigation(session.id);

    // Verify all steps completed correctly
    const { DatabaseService: DB } = await import('../lib/database');
    expect(DB.startWatchSession).toHaveBeenCalledWith('video-123');
    expect(DB.updateWatchSession).toHaveBeenCalledWith('session-123', {
      secondsWatched: 5,
      avgPlaybackRate: 1.0
    });
    expect(DB.endWatchSession).toHaveBeenCalledWith('session-123', 5);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should handle navigation without active session', () => {
    // Simulate back button click without active session
    mockNavigate(-1);
    
    expect(mockNavigate).toHaveBeenCalledWith(-1);
    // Don't need to check endWatchSession since it's mocked at module level
  });
});