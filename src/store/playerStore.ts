import { create } from 'zustand';

export type QueueItemType = 'podcast' | 'video';

export interface QueueItem {
  type: QueueItemType;
  id: string; // episode id or video id (database ID)
  title: string;
  thumbnailUrl: string;
  channelTitle?: string; // For videos
  creator?: string; // For podcasts
  durationSeconds: number;
  lastPositionSeconds?: number; // For resuming
  youtubeId?: string; // For videos
  audioUrl?: string; // For podcasts
}

interface PlayerState {
  queue: QueueItem[];
  current: QueueItem | null;
  isPlaying: boolean;
  playbackRate: number;
  volume: number; // 0..1
  muted: boolean;
  positionSeconds: number;
  isPlayerViewOpen: boolean; // True if full video player is open
  isMinimized: boolean; // True if video is playing in mini-player
  queueVisible: boolean; // True if queue drawer is open

  // actions
  play: (item: QueueItem, initialPosition?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void; // Stops current, clears current, but keeps queue
  next: () => void;
  prev: () => void; // For now, just restart current item
  enqueueNext: (item: QueueItem) => void;
  enqueueLast: (item: QueueItem) => void;
  removeFromQueue: (id: string) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;
  setPosition: (seconds: number) => void;
  setRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  setMuted: (muted: boolean) => void;
  getQueueLength: () => number;
  isInQueue: (id: string) => boolean;
  getCurrentItem: () => QueueItem | null;
  
  // PlayerView/MiniPlayer specific actions
  openPlayerView: () => void;
  closePlayerView: () => void;
  minimizeVideo: () => void;
  expandVideo: () => void;
  clearCurrent: () => void; // Stops current and clears it completely
  toggleQueueVisibility: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  current: null,
  isPlaying: false,
  playbackRate: 1,
  volume: 1,
  muted: false,
  positionSeconds: 0,
  isPlayerViewOpen: false,
  isMinimized: false,
  queueVisible: false,

  play: (item, initialPosition = 0) => {
    const { current, isPlaying } = get();
    // If playing the same item, just resume
    if (current?.id === item.id && isPlaying) {
      set({ isPlaying: true });
      return;
    }

    set({
      current: item,
      isPlaying: true,
      positionSeconds: initialPosition,
      isPlayerViewOpen: item.type === 'video', // Videos open in PlayerView by default
      isMinimized: item.type === 'podcast', // Podcasts always start in MiniPlayer
    });
  },
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  stop: () => set({ isPlaying: false, positionSeconds: 0 }), // Keeps current item, just stops playback
  next: () => {
    const { queue, current } = get();
    const currentIndex = current ? queue.findIndex(q => q.id === current.id && q.type === current.type) : -1;
    const nextItem = queue[currentIndex + 1];

    if (nextItem) {
      get().play(nextItem, nextItem.lastPositionSeconds || 0);
      // Remove played item from queue
      set(state => ({
        queue: state.queue.filter((_, index) => index !== currentIndex)
      }));
    } else {
      get().clearCurrent(); // No more items, clear player
    }
  },
  prev: () => {
    // For now, just restart current item
    set({ positionSeconds: 0 });
  },
  enqueueNext: (item) => {
    const { queue, current } = get();
    const filteredQueue = queue.filter(q => !(q.type === item.type && q.id === item.id));
    if (current) {
      const currentIndex = filteredQueue.findIndex(q => q.id === current.id && q.type === current.type);
      if (currentIndex !== -1) {
        filteredQueue.splice(currentIndex + 1, 0, item);
      } else {
        set({ queue: [item, ...filteredQueue] }); // If current not in queue, add to front
      }
    } else {
      set({ queue: [item, ...filteredQueue] });
    }
  },
  enqueueLast: (item) => {
    const { queue } = get();
    const filteredQueue = queue.filter(q => !(q.type === item.type && q.id === item.id));
    set({ queue: [...filteredQueue, item] });
  },
  removeFromQueue: (id) => {
    set({ queue: get().queue.filter(q => q.id !== id) });
  },
  reorderQueue: (startIndex, endIndex) => {
    const queue = Array.from(get().queue);
    const [removed] = queue.splice(startIndex, 1);
    queue.splice(endIndex, 0, removed);
    set({ queue });
  },
  clearQueue: () => set({ queue: [] }),
  setPosition: (seconds) => {
    const validSeconds = Math.max(0, Math.floor(seconds || 0));
    set({ positionSeconds: validSeconds });
  },
  setRate: (rate) => set({ playbackRate: Math.max(0.25, Math.min(3, rate)) }),
  setVolume: (vol) => set({ volume: Math.max(0, Math.min(1, vol)) }),
  setMuted: (muted) => set({ muted }),
  getQueueLength: () => get().queue.length,
  isInQueue: (id) => get().queue.some(item => item.id === id),
  getCurrentItem: () => get().current,

  openPlayerView: () => set(state => {
    if (state.current?.type === 'video') {
      return { isPlayerViewOpen: true, isMinimized: false };
    }
    return {};
  }),
  closePlayerView: () => set(state => {
    if (state.current?.type === 'video') {
      return { isPlayerViewOpen: false, isMinimized: true };
    }
    return {};
  }),
  minimizeVideo: () => set(state => {
    if (state.current?.type === 'video') {
      return { isPlayerViewOpen: false, isMinimized: true };
    }
    return {};
  }),
  expandVideo: () => set(state => {
    if (state.current?.type === 'video') {
      return { isPlayerViewOpen: true, isMinimized: false };
    }
    return {};
  }),
  clearCurrent: () => set({ 
    current: null, 
    isPlaying: false, 
    positionSeconds: 0, 
    isPlayerViewOpen: false, 
    isMinimized: false 
  }),
  toggleQueueVisibility: () => set(state => ({ queueVisible: !state.queueVisible })),
}));