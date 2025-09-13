import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from './database';
import { PodcastDatabaseService } from './podcastDatabase';
import { streakTracker } from './streakTracker';
import { useStatsStore } from '@/store/statsStore'; // Updated import

export class DailyTimeTracker {
  private static instance: DailyTimeTracker;
  private dailyTime: number = 0;
  private listeners: ((time: number) => void)[] = [];
  private lastUpdate: number = Date.now();
  private currentDate: string = new Date().toISOString().split('T')[0];

  private constructor() {}

  static getInstance(): DailyTimeTracker {
    if (!DailyTimeTracker.instance) {
      DailyTimeTracker.instance = new DailyTimeTracker();
    }
    return DailyTimeTracker.instance;
  }

  async loadDailyTime(): Promise<number> {
    try {
      // Check if date has changed and reset if needed
      const today = new Date().toISOString().split('T')[0];
      if (this.currentDate !== today) {
        this.currentDate = today;
        this.dailyTime = 0;
      }

      const now = new Date();
      const startOfDayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // Get video watch sessions for today (only completed sessions)
      const { data: videoAgg, error: videoErr } = await supabase
        .from('watch_sessions')
        .select('seconds_watched, started_at, ended_at')
        .eq('user_id', user.id)
        .gte('started_at', startOfDayIso)
        .lte('started_at', endOfDayIso)
        .not('ended_at', 'is', null);
        
      if (videoErr) throw videoErr;
      const videoTime = (videoAgg || []).reduce((acc, s) => acc + Math.max(0, s.seconds_watched || 0), 0);

      // Get podcast listen sessions for today (only completed sessions)
      const { data: podcastAgg, error: podcastErr } = await supabase
        .from('podcast_sessions')
        .select('seconds_listened, started_at, ended_at')
        .eq('user_id', user.id)
        .gte('started_at', startOfDayIso)
        .lte('started_at', endOfDayIso)
        .not('ended_at', 'is', null);
        
      if (podcastErr) throw podcastErr;
      const podcastTime = (podcastAgg || []).reduce((acc, s) => acc + Math.max(0, s.seconds_listened || 0), 0);

      this.dailyTime = Math.max(0, Math.floor(videoTime + podcastTime));
      this.lastUpdate = Date.now();
      this.notifyListeners();
      
      return this.dailyTime;
    } catch (error) {
      console.error('Failed to load daily time:', error);
      return 0;
    }
  }

  getDailyTime(): number {
    return this.dailyTime;
  }

  async addTime(seconds: number): Promise<void> {
    // Coerce to integer seconds to avoid floating accumulation errors
    const inc = Math.max(0, Math.floor(seconds));
    if (inc === 0) return; // Don't process zero increments
    
    // Check if date has changed and reset if needed
    const today = new Date().toISOString().split('T')[0];
    if (this.currentDate !== today) {
      this.currentDate = today;
      this.dailyTime = 0;
    }
    
    const prevTotal = this.dailyTime;
    this.dailyTime += inc;
    this.lastUpdate = Date.now();
    this.notifyListeners();
    
    // Update user stats in database (throttled to avoid excessive calls)
    try {
      const userStats = await DatabaseService.getUserStats();
      if (userStats) {
        // Only update stats every 10 seconds to reduce database load
        const timeSinceLastUpdate = Date.now() - this.lastUpdate;
        if (timeSinceLastUpdate > 10000 || this.dailyTime % 10 === 0) {
          await DatabaseService.updateUserStats({
            total_seconds: userStats.totalSeconds + inc, // Changed to snake_case
            last_watched_at: new Date().toISOString() // Changed to snake_case
          });
          // Update Zustand store
          useStatsStore.getState().updateTotalSeconds(inc);
        }

        // Check streak when crossing daily goal threshold
        if (userStats.dailyGoalSeconds > 0) {
          await streakTracker.achieveTodayIfCrossed(prevTotal, this.dailyTime, userStats.dailyGoalSeconds);
        }
      }
    } catch (error) {
      console.error('Failed to update user stats:', error);
    }
  }

  subscribe(listener: (time: number) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.dailyTime));
  }

  // Force refresh from database
  async refresh(): Promise<number> {
    return this.loadDailyTime();
  }
}

export const dailyTimeTracker = DailyTimeTracker.getInstance();