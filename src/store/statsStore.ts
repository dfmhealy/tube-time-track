import { create } from 'zustand';
import type { UserStats } from '@/lib/database';

interface StatsState {
  userStats: UserStats | null;
  weeklyData: { date: string; seconds: number }[] | null;
  isStatsLoading: boolean;
  
  setUserStats: (stats: UserStats) => void;
  setWeeklyData: (data: { date: string; seconds: number }[]) => void;
  setStatsLoading: (loading: boolean) => void;
  updateTotalSeconds: (additionalSeconds: number) => void;
  updateDailyGoalSeconds: (newGoal: number) => void;
  updateStreakDays: (newStreak: number) => void;
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
      const validSeconds = Math.max(0, Math.floor(additionalSeconds));
      set({
        userStats: {
          ...currentStats,
          totalSeconds: currentStats.totalSeconds + validSeconds,
          lastWatchedAt: new Date().toISOString()
        }
      });
    }
  },
  updateDailyGoalSeconds: (newGoal) => {
    const currentStats = get().userStats;
    if (currentStats) {
      set({
        userStats: {
          ...currentStats,
          dailyGoalSeconds: newGoal,
          updated_at: new Date().toISOString() // Assuming updated_at exists in UserStats
        }
      });
    }
  },
  updateStreakDays: (newStreak) => {
    const currentStats = get().userStats;
    if (currentStats) {
      set({
        userStats: {
          ...currentStats,
          streakDays: newStreak,
          updated_at: new Date().toISOString()
        }
      });
    }
  }
}));