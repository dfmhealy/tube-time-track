import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { URLInput } from '@/components/URLInput';
import { VideoCard } from '@/components/VideoCard';
import { useAppStore, useStatsStore, useLibraryStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import type { Video } from '@/lib/database';
import { formatDuration } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Target, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export function Home() {
  const { user } = useAuth();
  const { setCurrentView, setCurrentVideo, dailyGoal } = useAppStore();
  const { userStats } = useStatsStore();
  const { videos, setVideos, removeVideo } = useLibraryStore();
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [dailyProgress, setDailyProgress] = useState({ seconds: 0, percentage: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch recent videos
        const recent = await DatabaseService.getRecentVideos(4);
        setRecentVideos(recent);

        // If library is empty, fetch all videos for other potential uses
        if (videos.length === 0) {
          const allVideos = await DatabaseService.getAllVideos();
          setVideos(allVideos);
        }

        // Calculate today's progress
        const weeklyData = await DatabaseService.getWeeklyData();
        const todayStr = new Date().toISOString().split('T')[0];
        const todayData = weeklyData.find(d => new Date(d.date).toISOString().split('T')[0] === todayStr);
        const todaySeconds = todayData?.seconds || 0;
        const percentage = dailyGoal > 0 ? Math.min((todaySeconds / dailyGoal) * 100, 100) : 0;
        setDailyProgress({ seconds: todaySeconds, percentage });

      } catch (error) {
        console.error("Failed to fetch home page data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dailyGoal, videos.length, setVideos]);

  const handlePlayVideo = (video: Video) => {
    setCurrentVideo(video);
    setCurrentView('player');
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await DatabaseService.deleteVideo(videoId);
      removeVideo(videoId);
      setRecentVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video removed from library');
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to remove video');
    }
  };

  const greeting = `Welcome back${user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ''}!`;

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
            <div className="h-8 bg-muted rounded-md w-1/2"></div>
            <div className="h-5 bg-muted rounded-md w-3/4"></div>
        </div>
        <div className="h-12 bg-muted rounded-lg"></div>
        <div className="grid gap-6 md:grid-cols-3">
            <div className="h-28 bg-muted rounded-lg"></div>
            <div className="h-28 bg-muted rounded-lg"></div>
            <div className="h-28 bg-muted rounded-lg"></div>
        </div>
        <div className="flex items-center justify-between">
            <div className="h-8 bg-muted rounded-md w-1/4"></div>
            <div className="h-8 bg-muted rounded-md w-24"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="h-56 bg-muted rounded-lg"></div>
            <div className="h-56 bg-muted rounded-lg"></div>
            <div className="h-56 bg-muted rounded-lg"></div>
            <div className="h-56 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{greeting}</h1>
        <p className="text-muted-foreground">Here's a snapshot of your learning journey.</p>
      </div>

      {/* Quick Add */}
      <URLInput placeholder="Add a new video to your library..." />

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Goal</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(dailyProgress.seconds)} / {formatDuration(dailyGoal)}</div>
            <Progress value={dailyProgress.percentage} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Watch Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(userStats?.totalSeconds || 0)}</div>
            <p className="text-xs text-muted-foreground">Across {videos.length} videos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Streak</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats?.streakDays || 0} days</div>
            <p className="text-xs text-muted-foreground">Keep it going!</p>
          </CardContent>
        </Card>
      </div>

      {/* Recently Watched */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Continue Watching</h2>
          <Button variant="ghost" onClick={() => setCurrentView('library')}>
            View All
          </Button>
        </div>
        {recentVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentVideos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                onPlay={handlePlayVideo}
                onDelete={handleDeleteVideo}
              />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">You haven't watched any videos recently.</p>
              <p className="text-sm text-muted-foreground">Add and watch a video to see it here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}