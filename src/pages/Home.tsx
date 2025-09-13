import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Clock, Play, TrendingUp, Trash2, Target } from 'lucide-react';
import { URLInput } from '@/components/URLInput';
import { VideoCard } from '@/components/VideoCard';
import { useAppStore, useLibraryStore, useStatsStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';
import { DatabaseService } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { formatDuration, getVideoInfoFromOEmbed } from '@/lib/youtube';
import { fetchPlaylistVideoIds, extractPlaylistId } from '@/lib/youtubePlaylist';

export function Home() {
  const { setCurrentView } = useAppStore();
  const { videos, setVideos } = useLibraryStore();
  const { userStats, setUserStats } = useStatsStore();
  const [recentVideos, setRecentVideos] = useState(videos.slice(0, 4));
  const { toast } = useToast();
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [enqueueAll, setEnqueueAll] = useState(true);

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      const [allVideos, stats] = await Promise.all([
        DatabaseService.getAllVideos(),
        DatabaseService.getUserStats()
      ]);
      
      setVideos(allVideos);
      setRecentVideos(allVideos.slice(0, 4));
      if (stats) setUserStats(stats);
    };
    
    loadData();
  }, [setVideos, setUserStats]);

  const { dailyGoal } = useAppStore();
  const totalHours = userStats ? Math.floor(userStats.totalSeconds / 3600) : 0;
  const totalMinutes = userStats ? Math.floor((userStats.totalSeconds % 3600) / 60) : 0;
  const dailyGoalMinutes = Math.floor(dailyGoal / 60);

  const isEmpty = videos.length === 0;

  if (isEmpty) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center py-16 px-4">
          <div className="relative">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent">
              Track Your YouTube Learning
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transform any YouTube video into a learning session. 
              Track your watch time, set goals, and stay motivated.
            </p>
          </div>

          {/* URL Input */}
          <div className="max-w-2xl mx-auto mb-12">
            <URLInput 
              placeholder="Paste any YouTube URL to get started..."
              className="text-lg"
            />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Watch & Track</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically track your watch time with precision
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="h-6 w-6 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Set Goals</h3>
                <p className="text-sm text-muted-foreground">
                  Create daily learning goals and track progress
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold mb-2">See Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Visualize your learning journey over time
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Back Section */}
      <div className="text-center py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
          Welcome Back!
        </h1>
        <p className="text-muted-foreground mb-6">
          Ready to continue your learning journey?
        </p>
        
        <URLInput placeholder="Add another video to your library..." />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {totalHours}h {totalMinutes}m
            </div>
            <div className="text-sm text-muted-foreground">Total Watched</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent">
              {videos.length}
            </div>
            <div className="text-sm text-muted-foreground">Videos</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-success">
              {dailyGoalMinutes}m
            </div>
            <div className="text-sm text-muted-foreground">Daily Goal</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-warning">
              {userStats?.streakDays || 0}
            </div>
            <div className="text-sm text-muted-foreground">Day Streak</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Videos */}
      <div>
        {/* Playlist Import */}
        <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <input
              type="text"
              placeholder="Paste a YouTube playlist URL or ID..."
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder:text-white/60"
            />
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" checked={enqueueAll} onChange={(e) => setEnqueueAll(e.target.checked)} />
              Enqueue all after import
            </label>
            <Button
              onClick={async () => {
                if (!playlistUrl.trim()) return;
                setImportingPlaylist(true);
                try {
                  const ids = await fetchPlaylistVideoIds(playlistUrl, 50);
                  if (!ids.length) {
                    toast({ title: 'No videos found', description: 'Could not extract videos from playlist' });
                    return;
                  }
                  const added: string[] = [];
                  for (const vid of ids) {
                    try {
                      const info = await getVideoInfoFromOEmbed(vid);
                      if (!info) continue;
                      const addedVideo = await DatabaseService.addVideo({
                        youtubeId: info.id,
                        title: info.title,
                        channelTitle: info.channelTitle,
                        durationSeconds: 0,
                        thumbnailUrl: info.thumbnailUrl,
                        tags: [],
                        addedAt: new Date().toISOString(),
                      });
                      added.push(addedVideo.id);
                    } catch (e) {
                      // skip individual failures
                      continue;
                    }
                  }
                  if (added.length) {
                    // refresh library
                    const allVideos = await DatabaseService.getAllVideos();
                    setVideos(allVideos);
                    setRecentVideos(allVideos.slice(0, 4));
                    toast({ title: 'Playlist Imported', description: `${added.length} videos added` });
                    if (enqueueAll) {
                      const player = usePlayerStore.getState();
                      // enqueue in order, play first if nothing playing
                      if (!player.current && added.length) {
                        player.play({ type: 'video', id: added[0] });
                        for (const id of added.slice(1)) player.enqueueLast({ type: 'video', id });
                      } else {
                        for (const id of added) player.enqueueLast({ type: 'video', id });
                      }
                    }
                  } else {
                    toast({ title: 'Nothing added', description: 'No playable items found in this playlist' });
                  }
                } catch (e) {
                  console.error('Playlist import failed', e);
                  toast({ title: 'Import failed', description: 'Unable to import playlist', variant: 'destructive' });
                } finally {
                  setImportingPlaylist(false);
                  setPlaylistUrl('');
                }
              }}
              disabled={!playlistUrl.trim() || importingPlaylist}
              className="bg-primary hover:bg-primary/90"
            >
              {importingPlaylist ? 'Importing...' : 'Import Playlist'}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Continue Watching</h2>
          <Button 
            variant="ghost" 
            onClick={() => setCurrentView('library')}
            className="hover:text-primary"
          >
            View All →
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentVideos.map((video) => (
            <div key={video.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white line-clamp-2 flex-1">
                      {video.title}
                    </h3>
                    {video.isCompleted && (
                      <div className="flex items-center gap-1 text-green-400 text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs">Completed</span>
                      </div>
                    )}
                  </div>
                  <p className="text-white/70 text-sm mb-1">{video.channelTitle}</p>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Clock className="w-3 h-3" />
                    {formatDuration(video.durationSeconds)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await DatabaseService.subscribeToChannel(video.channelTitle);
                      toast({ title: 'Subscribed', description: `Subscribed to ${video.channelTitle}` });
                    } catch (e) {
                      console.error(e);
                      toast({ title: 'Error', description: 'Failed to subscribe', variant: 'destructive' });
                    }
                  }}
                  className="border-white/30 text-white/80 hover:text-white hover:bg-white/10"
                >
                  Subscribe
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await DatabaseService.unsubscribeFromChannel(video.channelTitle);
                      toast({ title: 'Unsubscribed', description: `Unsubscribed from ${video.channelTitle}` });
                    } catch (e) {
                      console.error(e);
                      toast({ title: 'Error', description: 'Failed to unsubscribe', variant: 'destructive' });
                    }
                  }}
                  className="border-white/30 text-white/80 hover:text-white hover:bg-white/10"
                >
                  Unsubscribe
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // Play Now in mini-player queue
                    const player = usePlayerStore.getState();
                    // Clear current queue and play immediately
                    player.clearQueue();
                    player.play({ type: 'video', id: video.id });
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Play Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const player = usePlayerStore.getState();
                    // Check if already in queue to prevent duplicates
                    if (!player.isInQueue(video.id)) {
                      player.enqueueNext({ type: 'video', id: video.id });
                      toast({ title: 'Added to queue', description: 'Video will play next' });
                    } else {
                      toast({ title: 'Already in queue', description: 'This video is already queued' });
                    }
                  }}
                  className="border-white/30 text-white/80 hover:text-white hover:bg-white/10"
                >
                  Play Next
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const player = usePlayerStore.getState();
                    // Check if already in queue to prevent duplicates
                    if (!player.isInQueue(video.id)) {
                      player.enqueueLast({ type: 'video', id: video.id });
                      toast({ title: 'Added to queue', description: 'Video added to end of queue' });
                    } else {
                      toast({ title: 'Already in queue', description: 'This video is already queued' });
                    }
                  }}
                  className="border-white/30 text-white/80 hover:text-white hover:bg-white/10"
                >
                  Play Last
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await DatabaseService.deleteVideo(video.id);
                      const updatedVideos = videos.filter(v => v.id !== video.id);
                      setVideos(updatedVideos);
                      setRecentVideos(updatedVideos.slice(0, 4));
                    } catch (error) {
                      console.error('Failed to delete video:', error);
                    }
                  }}
                  className="text-white/70 hover:text-white hover:bg-white/20"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 justify-center pt-8">
        <Button 
          onClick={() => setCurrentView('library')}
          className="bg-gradient-primary hover:shadow-glow transition-smooth"
        >
          <Play className="h-4 w-4 mr-2" />
          Browse Library
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setCurrentView('stats')}
          className="border-border/50 hover:border-primary/50 transition-smooth"
        >
          <Clock className="h-4 w-4 mr-2" />
          View Stats
        </Button>
        <Button 
          variant="outline" 
          onClick={() => (window.location.href = '/subscriptions')}
          className="border-border/50 hover:border-primary/50 transition-smooth"
        >
          Subscriptions
        </Button>
      </div>
    </div>
  );
}