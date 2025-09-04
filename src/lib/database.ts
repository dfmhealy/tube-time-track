import Dexie, { type EntityTable } from 'dexie';

// Data Models
export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  thumbnailUrl: string;
  tags: string[];
  addedAt: string; // ISO string
  watchSeconds: number;
  lastWatchedAt: string | null;
}

export interface WatchSession {
  id: string;
  videoId: string;
  startedAt: string; // ISO string
  endedAt: string | null;
  secondsWatched: number;
  avgPlaybackRate: number;
  source: 'web';
}

export interface UserStats {
  id: string;
  totalSeconds: number;
  weeklyGoalSeconds: number;
  lastWatchedAt: string | null;
  streakDays: number;
}

export interface AppMeta {
  id: string;
  schemaVersion: number;
  userId?: string;
  createdAt: string;
}

// Database Schema
const db = new Dexie('YouTubeTracker') as Dexie & {
  videos: EntityTable<Video, 'id'>;
  watchSessions: EntityTable<WatchSession, 'id'>;
  userStats: EntityTable<UserStats, 'id'>;
  appMeta: EntityTable<AppMeta, 'id'>;
};

// Database version and schema
db.version(1).stores({
  videos: 'id, youtubeId, title, channelTitle, addedAt, *tags',
  watchSessions: 'id, videoId, startedAt, endedAt, secondsWatched',
  userStats: 'id',
  appMeta: 'id'
});

// Initialize default data
db.on('ready', async () => {
  // Check if this is first time setup
  const meta = await db.appMeta.get('default');
  if (!meta) {
    // Initialize with default values
    await db.appMeta.add({
      id: 'default',
      schemaVersion: 1,
      createdAt: new Date().toISOString()
    });

    await db.userStats.add({
      id: 'default',
      totalSeconds: 0,
      weeklyGoalSeconds: 5 * 60 * 60, // 5 hours default
      lastWatchedAt: null,
      streakDays: 0
    });
  }
});

// Database utility functions
export const DatabaseService = {
  // Video operations
  async addVideo(video: Omit<Video, 'id'>): Promise<Video> {
    const videoWithId: Video = {
      ...video,
      id: crypto.randomUUID(),
      watchSeconds: 0,
      lastWatchedAt: null
    };
    await db.videos.add(videoWithId);
    return videoWithId;
  },

  async getVideo(id: string): Promise<Video | undefined> {
    return await db.videos.get(id);
  },

  async getVideoByYouTubeId(youtubeId: string): Promise<Video | undefined> {
    return await db.videos.where('youtubeId').equals(youtubeId).first();
  },

  async getAllVideos(): Promise<Video[]> {
    return await db.videos.orderBy('addedAt').reverse().toArray();
  },

  async searchVideos(query: string): Promise<Video[]> {
    const lowerQuery = query.toLowerCase();
    return await db.videos
      .filter(video => 
        video.title.toLowerCase().includes(lowerQuery) ||
        video.channelTitle.toLowerCase().includes(lowerQuery) ||
        video.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      )
      .toArray();
  },

  async deleteVideo(id: string): Promise<void> {
    await db.transaction('rw', [db.videos, db.watchSessions], async () => {
      await db.videos.delete(id);
      await db.watchSessions.where('videoId').equals(id).delete();
    });
  },

  // Watch session operations
  async startWatchSession(videoId: string): Promise<WatchSession> {
    const session: WatchSession = {
      id: crypto.randomUUID(),
      videoId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      secondsWatched: 0,
      avgPlaybackRate: 1.0,
      source: 'web'
    };
    await db.watchSessions.add(session);
    return session;
  },

  async updateWatchSession(sessionId: string, updates: Partial<WatchSession>): Promise<void> {
    await db.watchSessions.update(sessionId, updates);
  },

  async endWatchSession(sessionId: string, finalSecondsWatched: number): Promise<void> {
    await db.transaction('rw', [db.watchSessions, db.userStats], async () => {
      await db.watchSessions.update(sessionId, {
        endedAt: new Date().toISOString(),
        secondsWatched: finalSecondsWatched
      });

      // Update user stats
      const stats = await db.userStats.get('default');
      if (stats) {
        await db.userStats.update('default', {
          totalSeconds: stats.totalSeconds + finalSecondsWatched,
          lastWatchedAt: new Date().toISOString()
        });
      }
    });
  },

  async getWatchSessionsForVideo(videoId: string): Promise<WatchSession[]> {
    return await db.watchSessions
      .where('videoId')
      .equals(videoId)
      .toArray();
  },

  async getTotalWatchTimeForVideo(videoId: string): Promise<number> {
    const sessions = await this.getWatchSessionsForVideo(videoId);
    return sessions.reduce((total, session) => total + session.secondsWatched, 0);
  },

  // User stats operations
  async getUserStats(): Promise<UserStats | undefined> {
    return await db.userStats.get('default');
  },

  async updateUserStats(updates: Partial<UserStats>): Promise<void> {
    await db.userStats.update('default', updates);
  },

  // Get weekly data for stats
  async getWeeklyData(): Promise<{ date: string; seconds: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6); // Last 7 days
    
    const sessions = await db.watchSessions
      .where('startedAt')
      .between(startDate.toISOString(), endDate.toISOString())
      .toArray();
    
    // Group by date
    const dailyTotals: { [date: string]: number } = {};
    
    sessions.forEach(session => {
      const date = new Date(session.startedAt).toISOString().split('T')[0];
      dailyTotals[date] = (dailyTotals[date] || 0) + session.secondsWatched;
    });
    
    // Create array with all 7 days, filling in zeros
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        seconds: dailyTotals[dateStr] || 0
      });
    }
    
    return result;
  },

  // Analytics  
  async getWeeklyWatchTime(): Promise<{ date: string; seconds: number }[]> {
    return this.getWeeklyData();
  },

  async exportData(): Promise<string> {
    const videos = await db.videos.toArray();
    const sessions = await db.watchSessions.toArray();
    const stats = await db.userStats.get('default');
    const meta = await db.appMeta.get('default');

    return JSON.stringify({
      videos,
      watchSessions: sessions,
      userStats: stats,
      appMeta: meta,
      exportedAt: new Date().toISOString()
    }, null, 2);
  },

  async importData(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData);
    
    await db.transaction('rw', [db.videos, db.watchSessions, db.userStats, db.appMeta], async () => {
      // Clear existing data
      await db.videos.clear();
      await db.watchSessions.clear();
      await db.userStats.clear();
      await db.appMeta.clear();

      // Import new data
      if (data.videos) await db.videos.bulkAdd(data.videos);
      if (data.watchSessions) await db.watchSessions.bulkAdd(data.watchSessions);
      if (data.userStats) await db.userStats.add(data.userStats);
      if (data.appMeta) await db.appMeta.add(data.appMeta);
    });
  },

  async getAllWatchSessions(): Promise<WatchSession[]> {
    return await db.watchSessions.orderBy('startedAt').reverse().toArray();
  }
};

export default db;