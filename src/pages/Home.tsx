import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { URLInput } from '@/components/URLInput';
import { VideoCard } from '@/components/VideoCard';
import { useAppStore, useLibraryStore, useStatsStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import { formatDuration } from '@/lib/youtube';
import { Play, Target, Clock, TrendingUp } from 'lucide-react';

export function Home() {
  const { setCurrentView } = useAppStore();
  const { videos, setVideos } = useLibraryStore();
  const { userStats, setUserStats } = useStatsStore();
  const [recentVideos, setRecentVideos] = useState(videos.slice(0, 4));

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

  const totalHours = userStats ? Math.floor(userStats.totalSeconds / 3600) : 0;
  const totalMinutes = userStats ? Math.floor((userStats.totalSeconds % 3600) / 60) : 0;
  const weeklyGoalHours = userStats ? Math.floor(userStats.weeklyGoalSeconds / 3600) : 5;

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
                  Create weekly learning goals and track progress
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
              {weeklyGoalHours}h
            </div>
            <div className="text-sm text-muted-foreground">Weekly Goal</div>
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
            <VideoCard key={video.id} video={video} />
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
      </div>
    </div>
  );
}