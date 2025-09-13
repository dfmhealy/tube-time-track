import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from './database';
import { PodcastDatabaseService } from './podcastDatabase';
import { streakTracker } from './streakTracker';

export class DailyTimeTracker {
  private static instance: DailyTimeTracker;
  private dailyTime: number = 0;
  private listeners: ((time: number) => void)[] = [];
  private lastUpdate: number = 0;

  private constructor() {}

  static getInstance(): DailyTimeTracker {
    if (!DailyTimeTracker.instance) {
      DailyTimeTracker.instance = new DailyTimeTracker();
    }
    return DailyTimeTracker.instance;
  }

  async loadDailyTime(): Promise<number> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      const startOfDayIso = startOfDay.toISOString();
      const endOfDayIso = endOfDay.toISOString();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // 1) Sum video watch seconds from watch_sessions for today only
      const { data: videoAgg, error: videoErr } = await supabase
        .from('watch_sessions')
        .select('seconds_watched, started_at, ended_at')
        .eq('user_id', user.id)
        .gte('started_at', startOfDayIso)
        .lt('started_at', endOfDayIso)
        .not('ended_at', 'is', null); // Only count completed sessions
        
      if (videoErr) throw videoErr;
      const videoTime = (videoAgg || []).reduce((acc, s) => acc + (s.seconds_watched || 0), 0);

      // 2) Sum podcast listen seconds from podcast_sessions for today only
      const { data: podcastAgg, error: podcastErr } = await supabase
        .from('podcast_sessions')
        .select('seconds_listened, started_at, ended_at')
        .eq('user_id', user.id)
        .gte('started_at', startOfDayIso)
        .lt('started_at', endOfDayIso)
        .not('ended_at', 'is', null); // Only count completed sessions
        
      if (podcastErr) throw podcastErr;
      const podcastTime = (podcastAgg || []).reduce((acc, s) => acc + (s.seconds_listened || 0), 0);

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
    // Validate input and prevent negative time
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) {
      return;
    }
    
    // Coerce to integer seconds to avoid floating accumulation errors
    const inc = Math.floor(seconds);
    const prevTotal = this.dailyTime;
    this.dailyTime += inc;
    this.lastUpdate = Date.now();
    this.notifyListeners();
    
    // Update user stats in database
    try {
      const userStats = await DatabaseService.getUserStats();
      if (userStats) {
        // Only update if we actually added time
        if (inc > 0) {
          await DatabaseService.updateUserStats({
            totalSeconds: userStats.totalSeconds + inc,
            lastWatchedAt: new Date().toISOString()
          });

          // Update streak only when crossing the daily goal threshold
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
