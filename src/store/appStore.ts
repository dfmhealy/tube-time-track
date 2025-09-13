import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // UI State
  currentView: 'home' | 'library' | 'podcasts' | 'stats' | 'settings';
  isLoading: boolean;
  error: string | null;
  
  // Search and Filter
  searchQuery: string;
  selectedTags: string[];
  
  // User preferences (only timeZone remains here)
  timeZone: string;
  
  // Actions
  setCurrentView: (view: AppState['currentView']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentView: 'home',
      isLoading: false,
      error: null,
      searchQuery: '',
      selectedTags: [],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,

      // Actions
      setCurrentView: (view) => set({ currentView: view }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedTags: (tags) => set({ selectedTags: tags }),
      clearError: () => set({ error: null })
    }),
    {
      name: 'youtube-tracker-store',
      // Only persist user preferences, not temporary state
      partialize: (state) => ({
        timeZone: state.timeZone
      })
    }
  )
);