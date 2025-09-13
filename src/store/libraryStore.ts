import { create } from 'zustand';
import type { Video } from '@/lib/database';

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