import { create } from 'zustand';

export type QueueItemType = 'podcast' | 'video';

export interface QueueItem {
  type: QueueItemType;
  id: string; // episode id or video id
}

interface PlayerState {
  queue: QueueItem[];
  current: QueueItem | null;
  isPlaying: boolean;
  playbackRate: number;
  volume: number; // 0..1
  muted: boolean;
  positionSeconds: number;

  // actions
  play: (item: QueueItem) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  enqueueNext: (item: QueueItem) => void;
  enqueueLast: (item: QueueItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  setPosition: (seconds: number) => void;
  setRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  setMuted: (muted: boolean) => void;
  getQueueLength: () => number;
  isInQueue: (id: string) => boolean;
  getCurrentItem: () => QueueItem | null;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  current: null,
  isPlaying: false,
  playbackRate: 1,
  volume: 1,
  muted: false,
  positionSeconds: 0,

  play: (item) => set({ current: item, isPlaying: true, positionSeconds: 0 }),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  stop: () => set({ isPlaying: false, current: null, positionSeconds: 0 }),
  next: () => {
    const { queue } = get();
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    set({ current: next, queue: rest, isPlaying: true, positionSeconds: 0 });
  },
  prev: () => {
    // For now, just restart current item
    set({ positionSeconds: 0 });
  },
  enqueueNext: (item) => {
    const { queue } = get();
    // Remove duplicates and add to front
    const filteredQueue = queue.filter(q => !(q.type === item.type && q.id === item.id));
    set({ queue: [item, ...filteredQueue] });
  },
  enqueueLast: (item) => {
    const { queue } = get();
    // Remove duplicates and add to end
    const filteredQueue = queue.filter(q => !(q.type === item.type && q.id === item.id));
    set({ queue: [...filteredQueue, item] });
  },
  removeFromQueue: (id) => {
    const { queue } = get();
    set({ queue: queue.filter(q => q.id !== id) });
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
}));
