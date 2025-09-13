import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from './database';

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
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get daily progress for today and yesterday
      const todayProgress = await this.getDailyProgress(today);
      const yesterdayProgress = await this.getDailyProgress(yesterday);

      let newStreakDays = userStats.streakDays || 0;
      const lastWatchedAt = userStats.lastWatchedAt ? new Date(userStats.lastWatchedAt) : null;

      // Check if user achieved daily goal today
      const achievedGoalToday = todayProgress >= dailyGoalSeconds;

      // If goal achieved, update streak based on whether yesterday's goal was achieved
      if (achievedGoalToday) {
        const achievedGoalYesterday = yesterdayProgress >= dailyGoalSeconds;
        if (newStreakDays === 0 || achievedGoalYesterday) {
          newStreakDays += 1;
        } else {
          newStreakDays = 1;
        }

        // Persist that today's goal was achieved
        await DatabaseService.updateUserStats({
          streakDays: newStreakDays,
          lastWatchedAt: today.toISOString()
        });
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
        .lte('started_at', endOfDay.toISOString())
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
        .lte('started_at', endOfDay.toISOString())
        .not('ended_at', 'is', null);

      if (podcastError) {
        console.error('Error fetching podcast sessions:', podcastError);
      }

      // Calculate total seconds for the day
      const videoSeconds = (videoSessions || []).reduce((total, session) =>
        total + (session.seconds_watched || 0), 0);

      const podcastSeconds = (podcastSessions || []).reduce((total, session) =>
        total + (session.seconds_listened || 0), 0);

      return videoSeconds + podcastSeconds;
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
