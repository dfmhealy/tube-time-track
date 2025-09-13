import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from './database';
import { PodcastDatabaseService } from './podcastDatabase';
import { streakTracker } from './streakTracker';
import { useStatsStore } from '@/store/statsStore';

export class DailyTimeTracker {
  private static instance: DailyTimeTracker;
  private dailyTime: number = 0;
  private listeners: ((time: number) => void)[] = [];
  private lastUpdate: number = Date.now();
  private currentDate: string = new Date().toISOString().split('T')[0];
  private updateTimeout: number | null = null;

  private constructor() {
    // Auto-refresh daily time every minute to catch date changes
    setInterval(() => {
      this.checkDateChange();
    }, 60000);
  }

  static getInstance(): DailyTimeTracker {
    if (!DailyTimeTracker.instance) {
      DailyTimeTracker.instance = new DailyTimeTracker();
    }
    return DailyTimeTracker.instance;
  }

  private checkDateChange(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.currentDate !== today) {
      console.log('Date changed, resetting daily time tracker');
      this.currentDate = today;
      this.dailyTime = 0;
      this.loadDailyTime(); // Reload for new day
    }
  }

  async loadDailyTime(): Promise<number> {
    try {
      // Check if date has changed and reset if needed
      this.checkDateChange();

      const now = new Date();
      const startOfDayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        this.dailyTime = 0;
        this.notifyListeners();
        return 0;
      }

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
      return this.dailyTime; // Return current value on error
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
    this.checkDateChange();
    
    const prevTotal = this.dailyTime;
    this.dailyTime += inc;
    this.lastUpdate = Date.now();
    this.notifyListeners();
    
    // Debounce database updates to reduce load
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    this.updateTimeout = window.setTimeout(async () => {
      try {
        // Update user stats in database
        const userStats = await DatabaseService.getUserStats();
        if (userStats) {
          await DatabaseService.updateUserStats({
            total_seconds: userStats.totalSeconds + inc,
            last_watched_at: new Date().toISOString()
          });
          
          // Update Zustand store
          useStatsStore.getState().updateTotalSeconds(inc);

          // Check streak when crossing daily goal threshold
          if (userStats.dailyGoalSeconds > 0) {
            await streakTracker.achieveTodayIfCrossed(prevTotal, this.dailyTime, userStats.dailyGoalSeconds);
          }
        }
      } catch (error) {
        console.error('Failed to update user stats:', error);
      }
    }, 5000); // 5-second debounce
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