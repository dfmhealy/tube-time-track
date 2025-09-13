import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from './database';
import { useStatsStore } from '@/store/statsStore';

export class StreakTracker {
  private static instance: StreakTracker;

  static getInstance(): StreakTracker {
    if (!StreakTracker.instance) {
      StreakTracker.instance = new StreakTracker();
    }
    return StreakTracker.instance;
  }

  /**
   * Only increment streak when the daily total crosses the goal threshold.
   * This should be called with the previous total, new total, and goal.
   */
  async achieveTodayIfCrossed(prevTotal: number, newTotal: number, goal: number): Promise<void> {
    // Validate inputs
    if (goal <= 0 || newTotal < 0 || prevTotal < 0) return;
    
    // Only update streak when crossing the threshold for the first time today
    if (prevTotal < goal && newTotal >= goal) {
      await this.updateStreak();
    }
  }

  /**
   * Calculate and update user streak based on daily goal achievement
   */
  async updateStreak(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const userStats = await DatabaseService.getUserStats();
      if (!userStats) return 0;

      const dailyGoalSeconds = userStats.dailyGoalSeconds;
      if (dailyGoalSeconds <= 0) return userStats.streakDays || 0;
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get daily progress for today and yesterday
      const todayProgress = await this.getDailyProgress(today);
      const yesterdayProgress = await this.getDailyProgress(yesterday);

      let newStreakDays = userStats.streakDays || 0;

      // Check if user achieved daily goal today
      const achievedGoalToday = todayProgress >= dailyGoalSeconds;

      // Only update streak if goal was actually achieved today
      if (achievedGoalToday) {
        // Check if this is a continuation of an existing streak
        if (newStreakDays === 0) {
          // Starting a new streak
          newStreakDays = 1;
        } else {
          // Check if yesterday's goal was achieved to continue streak
          const achievedGoalYesterday = yesterdayProgress >= dailyGoalSeconds;
          if (achievedGoalYesterday) {
            newStreakDays += 1;
          } else {
            // Streak broken, start new one
            newStreakDays = 1;
          }
        }

        // Check if we already updated the streak today to avoid double counting
        const lastWatchedAt = userStats.lastWatchedAt ? new Date(userStats.lastWatchedAt) : null;
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        
        const shouldUpdateStreak = !lastWatchedAt || lastWatchedAt < todayStart;
        
        if (shouldUpdateStreak) {
          await DatabaseService.updateUserStats({
            streak_days: newStreakDays,
            last_watched_at: today.toISOString()
          });
          // Update Zustand store
          useStatsStore.getState().updateStreakDays(newStreakDays);
        } else {
          // Already updated today, just return current streak
          return newStreakDays;
        }
      }

      return newStreakDays;
    } catch (error) {
      console.error('Error updating streak:', error);
      return 0;
    }
  }

  /**
   * Get total watch/listen time for a specific date
   */
  private async getDailyProgress(date: Date): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get video watch sessions for the day
      const { data: videoSessions, error: videoError } = await supabase
        .from('watch_sessions')
        .select('seconds_watched')
        .eq('user_id', user.id)
        .gte('started_at', startOfDay.toISOString())
        .lt('started_at', endOfDay.toISOString())
        .not('ended_at', 'is', null);

      if (videoError) {
        console.error('Error fetching video sessions:', videoError);
      }

      // Get podcast listen sessions for the day
      const { data: podcastSessions, error: podcastError } = await supabase
        .from('podcast_sessions')
        .select('seconds_listened')
        .eq('user_id', user.id)
        .gte('started_at', startOfDay.toISOString())
        .lt('started_at', endOfDay.toISOString())
        .not('ended_at', 'is', null);

      if (podcastError) {
        console.error('Error fetching podcast sessions:', podcastError);
      }

      // Calculate total seconds for the day
      const videoSeconds = (videoSessions || []).reduce((total, session) => {
        const seconds = Math.max(0, session.seconds_watched || 0);
        return total + seconds;
      }, 0);

      const podcastSeconds = (podcastSessions || []).reduce((total, session) => {
        const seconds = Math.max(0, session.seconds_listened || 0);
        return total + seconds;
      }, 0);

      return Math.max(0, Math.floor(videoSeconds + podcastSeconds));
    } catch (error) {
      console.error('Error getting daily progress:', error);
      return 0;
    }
  }

  /**
   * Check if user has achieved daily goal today
   */
  async hasAchievedDailyGoal(): Promise<boolean> {
    try {
      const userStats = await DatabaseService.getUserStats();
      if (!userStats) return false;

      const today = new Date();
      const todayProgress = await this.getDailyProgress(today);

      return todayProgress >= userStats.dailyGoalSeconds;
    } catch (error) {
      console.error('Error checking daily goal:', error);
      return false;
    }
  }

  /**
   * Get current streak count
   */
  async getCurrentStreak(): Promise<number> {
    try {
      const userStats = await DatabaseService.getUserStats();
      return userStats?.streakDays || 0;
    } catch (error) {
      console.error('Error getting current streak:', error);
      return 0;
    }
  }
}

export const streakTracker = StreakTracker.getInstance();