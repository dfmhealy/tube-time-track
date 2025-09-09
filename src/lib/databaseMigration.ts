import db from './database';
import { DatabaseService } from './supabase';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

export class DatabaseMigrationService {
  static async migrateToSupabase() {
    try {
      // Check if migration is needed
      const needsMigration = await this.needsMigration();
      if (!needsMigration) {
        console.log('No migration needed');
        return;
      }

      toast.info('Migrating your data to the cloud...');
      
      // Migrate videos
      const videos = await db.videos.toArray();
      for (const video of videos) {
        try {
          const videoData: Omit<Database['public']['Tables']['videos']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
            youtube_id: video.youtubeId,
            title: video.title,
            channel_title: video.channelTitle,
            duration_seconds: video.durationSeconds,
            thumbnail_url: video.thumbnailUrl,
            tags: video.tags || [],
            watch_seconds: video.watchSeconds || 0,
            last_watched_at: video.lastWatchedAt || null,
            added_at: video.addedAt,
            updated_at: new Date().toISOString()
          };
          await DatabaseService.addVideo(videoData);
        } catch (error) {
          console.error('Failed to migrate video:', video.id, error);
          continue;
        }
      }

      // Migrate watch sessions
      const sessions = await db.watchSessions.toArray();
      for (const session of sessions) {
        try {
          const sessionData: Omit<Database['public']['Tables']['watch_sessions']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
            video_id: session.videoId,
            started_at: session.startedAt,
            ended_at: session.endedAt,
            seconds_watched: session.secondsWatched,
            avg_playback_rate: session.avgPlaybackRate || 1.0,
            source: session.source || 'web',
            updated_at: new Date().toISOString()
          };
          
          await DatabaseService.addWatchSession(sessionData);
        } catch (error) {
          console.error('Failed to migrate watch session:', session.id, error);
          continue;
        }
      }

      // Migrate user stats
      const userStats = await db.userStats.toArray();
      if (userStats.length > 0) {
        try {
          const stats = userStats[0];
          await DatabaseService.updateUserStats({
            total_seconds: stats.totalSeconds,
            weekly_goal_seconds: stats.weeklyGoalSeconds,
            last_watched_at: stats.lastWatchedAt,
            streak_days: stats.streakDays,
            updated_at: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to migrate user stats:', error);
        }
      }

      // Mark migration as complete
      await this.markMigrationComplete();
      toast.success('Data migration completed successfully!');
      
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Failed to migrate data. Please refresh and try again.');
      throw error;
    }
  }

  private static async needsMigration(): Promise<boolean> {
    // Check if there's any data in IndexedDB
    const [videoCount, sessionCount] = await Promise.all([
      db.videos.count(),
      db.watchSessions.count(),
    ]);

    // If no data, no migration needed
    if (videoCount === 0 && sessionCount === 0) {
      return false;
    }

    // Check if migration has already been completed
    const migrationStatus = localStorage.getItem('databaseMigrationStatus');
    return migrationStatus !== 'completed';
  }

  private static async markMigrationComplete(): Promise<void> {
    localStorage.setItem('databaseMigrationStatus', 'completed');
  }

  static async clearLocalData(): Promise<void> {
    try {
      await Promise.all([
        db.videos.clear(),
        db.watchSessions.clear(),
        db.userStats.clear(),
      ]);
      localStorage.removeItem('databaseMigrationStatus');
    } catch (error) {
      console.error('Failed to clear local data:', error);
      throw error;
    }
  }
}
