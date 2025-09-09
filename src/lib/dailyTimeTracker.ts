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
      const today = now.toISOString().split('T')[0];
      
      // Get video watch sessions for today
      const videoSessions = await DatabaseService.getAllWatchSessions();
      const todayVideoSessions = videoSessions.filter(session => {
        const sessionDate = new Date(session.startedAt).toISOString().split('T')[0];
        return sessionDate === today && session.endedAt;
      });
      
      // Get podcast listen sessions for today - using a simpler approach since getAllListenSessions doesn't exist
      // We'll calculate from user stats which already combines both
      const userStats = await DatabaseService.getUserStats();
      
      // Calculate total time from video sessions
      const videoTime = todayVideoSessions.reduce((sum, session) => sum + (session.secondsWatched || 0), 0);
      
      // For now, use video time as the daily time (podcast tracking will be added via real-time updates)
      const podcastTime = 0; // Will be tracked via addTime() method during playback
      
      this.dailyTime = videoTime + podcastTime;
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
    this.dailyTime += seconds;
    this.lastUpdate = Date.now();
    this.notifyListeners();
    
    // Update user stats in database
    try {
      const userStats = await DatabaseService.getUserStats();
      if (userStats) {
        await DatabaseService.updateUserStats({
          totalSeconds: userStats.totalSeconds + seconds
        });
      }
      
      // Update streak when time is added
      await streakTracker.updateStreak();
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
