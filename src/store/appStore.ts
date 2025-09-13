import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Video, WatchSession, UserStats } from '@/lib/database';

interface AppState {
  // UI State
  currentView: 'home' | 'library' | 'podcasts' | 'player' | 'stats' | 'settings';
  isLoading: boolean;
  error: string | null;
  
  // Video State
  currentVideo: Video | null;
  activeWatchSession: WatchSession | null;
  
  // Search and Filter
  searchQuery: string;
  selectedTags: string[];
  
  // User preferences
  dailyGoal: number; // seconds
  timeZone: string;
  
  // Actions
  setCurrentView: (view: AppState['currentView']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentVideo: (video: Video | null) => void;
  setActiveWatchSession: (session: WatchSession | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setDailyGoal: (seconds: number) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentView: 'home',
      isLoading: false,
      error: null,
      currentVideo: null,
      activeWatchSession: null,
      searchQuery: '',
      selectedTags: [],
      dailyGoal: 30 * 60, // 30 minutes default
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,

      // Actions
      setCurrentView: (view) => set({ currentView: view }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setCurrentVideo: (video) => set({ currentVideo: video }),
      setActiveWatchSession: (session) => set({ activeWatchSession: session }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedTags: (tags) => set({ selectedTags: tags }),
      setDailyGoal: (seconds) => set({ dailyGoal: seconds }),
      clearError: () => set({ error: null })
    }),
    {
      name: 'youtube-tracker-store',
      // Only persist user preferences, not temporary state
      partialize: (state) => ({
        dailyGoal: state.dailyGoal,
        timeZone: state.timeZone
      })
    }
  )
);

// Stats Store - separate for frequent updates
interface StatsState {
  userStats: UserStats | null;
  weeklyData: { date: string; seconds: number }[] | null;
  isStatsLoading: boolean;
  
  setUserStats: (stats: UserStats) => void;
  setWeeklyData: (data: { date: string; seconds: number }[]) => void;
  setStatsLoading: (loading: boolean) => void;
  updateTotalSeconds: (additionalSeconds: number) => void;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  userStats: null,
  weeklyData: null,
  isStatsLoading: false,

  setUserStats: (stats) => set({ userStats: stats }),
  setWeeklyData: (data) => set({ weeklyData: data }),
  setStatsLoading: (loading) => set({ isStatsLoading: loading }),
  updateTotalSeconds: (additionalSeconds) => {
    const currentStats = get().userStats;
    if (currentStats) {
      // Validate additional seconds
      const validSeconds = Math.max(0, Math.floor(additionalSeconds));
      
      set({
        userStats: {
          ...currentStats,
          totalSeconds: currentStats.totalSeconds + validSeconds,
          lastWatchedAt: new Date().toISOString()
        }
      });
    }
  }
}));

// Video Library Store
interface LibraryState {
  videos: Video[];
  isLibraryLoading: boolean;
  sortBy: 'addedAt' | 'title' | 'watchTime';
  sortOrder: 'asc' | 'desc';
  
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;
  removeVideo: (videoId: string) => void;
  updateVideo: (videoId: string, updates: Partial<Video>) => void;
  setLibraryLoading: (loading: boolean) => void;
  setSortBy: (sortBy: LibraryState['sortBy']) => void;
  setSortOrder: (order: LibraryState['sortOrder']) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  videos: [],
  isLibraryLoading: false,
  sortBy: 'addedAt',
  sortOrder: 'desc',

  setVideos: (videos) => set({ videos }),
  addVideo: (video) => set({ videos: [video, ...get().videos] }),
  removeVideo: (videoId) => set({ 
    videos: get().videos.filter(v => v.id !== videoId) 
  }),
  updateVideo: (videoId, updates) => set({
    videos: get().videos.map(v => 
      v.id === videoId ? { 
        ...v, 
        ...updates,
        // Validate numeric fields
        watchSeconds: updates.watchSeconds !== undefined ? Math.max(0, Math.floor(updates.watchSeconds)) : v.watchSeconds,
        durationSeconds: updates.durationSeconds !== undefined ? Math.max(0, Math.floor(updates.durationSeconds)) : v.durationSeconds,
        lastPositionSeconds: updates.lastPositionSeconds !== undefined ? Math.max(0, Math.floor(updates.lastPositionSeconds)) : v.lastPositionSeconds
      } : v
    )
  }),
  setLibraryLoading: (loading) => set({ isLibraryLoading: loading }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (order) => set({ sortOrder: order })
}));