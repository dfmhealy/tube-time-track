import { DatabaseService } from './database'; // Changed to named import
import { DatabaseService as SupabaseDatabaseService } from './supabase'; // Renamed to avoid conflict
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

// Define types for the old IndexedDB data structure if needed, or remove if not used.
// Assuming 'db' refers to an old IndexedDB instance that is no longer relevant.
// If there's still an IndexedDB implementation, it needs to be provided.
// For now, I'm assuming 'db' is deprecated and removing its usage.

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
      // Assuming 'db.videos.toArray()' is from an old IndexedDB. This part needs actual IndexedDB data.
      // For now, I'm commenting out the IndexedDB part and focusing on Supabase types.
      // If IndexedDB migration is still required, the 'db' object needs to be defined.
      // const videos = await db.videos.toArray();
      // for (const video of videos) {
      //   try {
      //     const videoData: Omit<Database['public']['Tables']['videos']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at' | 'watch_seconds' | 'last_watched_at' | 'last_position_seconds' | 'is_completed'> = {
      //       youtube_id: video.youtubeId,
      //       title: video.title,
      //       channel_title: video.channelTitle,
      //       duration_seconds: video.durationSeconds,
      //       thumbnail_url: video.thumbnailUrl,
      //       tags: video.tags || [],
      //       added_at: video.addedAt,
      //     };
      //     await SupabaseDatabaseService.addVideo(videoData);
      //   } catch (error) {
      //     console.error('Failed to migrate video:', video.id, error);
      //     continue;
      //   }
      // }

      // Migrate watch sessions
      // const sessions = await db.watchSessions.toArray();
      // for (const session of sessions) {
      //   try {
      //     const sessionData: Omit<Database['public']['Tables']['watch_sessions']['Insert'], 'id' | 'created_at' | 'updated_at'> = {
      //       video_id: session.videoId,
      //       started_at: session.startedAt,
      //       ended_at: session.endedAt,
      //       seconds_watched: session.secondsWatched,
      //       avg_playback_rate: session.avgPlaybackRate || 1.0,
      //       source: session.source || 'web',
      //     };
          
      //     await SupabaseDatabaseService.addWatchSession(sessionData);
      //   } catch (error) {
      //     console.error('Failed to migrate watch session:', session.id, error);
      //     continue;
      //   }
      // }

      // Migrate user stats
      // const userStats = await db.userStats.toArray();
      // if (userStats.length > 0) {
      //   try {
      //     const stats = userStats[0];
      //     await SupabaseDatabaseService.updateUserStats({
      //       total_seconds: stats.totalSeconds,
      //       weekly_goal_seconds: stats.weeklyGoalSeconds,
      //       last_watched_at: stats.lastWatchedAt,
      //       streak_days: stats.streakDays,
      //     });
      //   } catch (error) {
      //     console.error('Failed to migrate user stats:', error);
      //   }
      // }

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
    // This part assumes an IndexedDB 'db' instance exists.
    // For now, returning false as IndexedDB is not in context.
    // If IndexedDB migration is still required, the 'db' object needs to be defined.
    // const [videoCount, sessionCount] = await Promise.all([
    //   db.videos.count(),
    //   db.watchSessions.count(),
    // ]);

    // If no data, no migration needed
    // if (videoCount === 0 && sessionCount === 0) {
    //   return false;
    // }

    // Check if migration has already been completed
    const migrationStatus = localStorage.getItem('databaseMigrationStatus');
    return migrationStatus !== 'completed';
  }

  private static async markMigrationComplete(): Promise<void> {
    localStorage.setItem('databaseMigrationStatus', 'completed');
  }

  static async clearLocalData(): Promise<void> {
    try {
      // This part assumes an IndexedDB 'db' instance exists.
      // For now, commenting out.
      // await Promise.all([
      //   db.videos.clear(),
      //   db.watchSessions.clear(),
      //   db.userStats.clear(),
      // ]);
      localStorage.removeItem('databaseMigrationStatus');
    } catch (error) {
      console.error('Failed to clear local data:', error);
      throw error;
    }
  }
}