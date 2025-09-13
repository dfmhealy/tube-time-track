import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStatsStore, useAppStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import { formatDuration } from '@/lib/youtube';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Clock, Target, TrendingUp } from 'lucide-react';

export function Stats() {
  const appStore = useAppStore();
  const { userStats, weeklyData, setUserStats, setWeeklyData, setStatsLoading, isStatsLoading } = useStatsStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      setError(null);
      
      try {
        // Load user stats from database
        const stats = await DatabaseService.getUserStats();
        const weekly = await DatabaseService.getWeeklyData();
        
        if (stats) {
          setUserStats(stats);
        }
        
        if (weekly && weekly.length > 0) {
          setWeeklyData(weekly);
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
        setError('Failed to load statistics');
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [setUserStats, setWeeklyData, setStatsLoading]);

  if (isStatsLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-16">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!userStats || userStats.totalSeconds === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-16">
          <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No stats yet</h2>
          <p className="text-muted-foreground">Start watching videos to see your statistics!</p>
        </div>
      </div>
    );
  }

  const dailyGoalSeconds = appStore.dailyGoal; // Using dailyGoal from appStore
  
  // Calculate today's watch time
  const today = new Date().toISOString().split('T')[0];
  
  // Find today's data in weekly data with proper date comparison
  const todayData = weeklyData?.find(day => {
    const dayDate = new Date(day.date).toISOString().split('T')[0];
    return dayDate === today;
  });
  const todaySeconds = todayData?.seconds || 0;
  
  const dailyProgress = dailyGoalSeconds > 0 ? Math.min((todaySeconds / dailyGoalSeconds) * 100, 100) : 0;
  
  // Calculate weekly total for the weekly stats card
  const currentWeekSeconds = weeklyData?.reduce((total, day) => {
    const seconds = Math.max(0, day.seconds || 0);
    return total + seconds;
  }, 0) || 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Your Stats</h1>
        <p className="text-muted-foreground">Track your learning progress over time</p>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Time</p>
              <p className="text-2xl font-bold">{formatDuration(userStats.totalSeconds || 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Target className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Progress</p>
              <p className="text-2xl font-bold">{Math.max(0, Math.round(dailyProgress))}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Streak</p>
              <p className="text-2xl font-bold">{Math.max(0, userStats.streakDays || 0)} days</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Calendar className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold">{formatDuration(Math.max(0, currentWeekSeconds))}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Daily Progress */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Today's Progress</h3>
            <Badge variant={dailyProgress >= 100 ? "default" : "secondary"}>
              {formatDuration(Math.max(0, todaySeconds))} / {formatDuration(Math.max(0, dailyGoalSeconds))}
            </Badge>
          </div>
          <Progress value={Math.max(0, Math.min(dailyProgress, 100))} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {dailyProgress >= 100 
              ? "🎉 Great job! You've reached your daily goal!" 
              : `${formatDuration(Math.max(0, dailyGoalSeconds - todaySeconds))} remaining to reach your daily goal`
            }
          </p>
        </div>
      </Card>

      {/* Daily Activity Chart */}
      {weeklyData && weeklyData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => {
                    try {
                      return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                    } catch {
                      return 'Invalid';
                    }
                  }}
                />
                <YAxis 
                  tickFormatter={(seconds) => {
                    const hours = Math.max(0, seconds) / 3600;
                    return `${Math.round(hours * 10) / 10}h`;
                  }}
                />
                <Tooltip 
                  formatter={(seconds: number) => [formatDuration(Math.max(0, seconds || 0)), 'Watch Time']}
                  labelFormatter={(date) => {
                    try {
                      return new Date(date).toLocaleDateString();
                    } catch {
                      return 'Invalid Date';
                    }
                  }}
                />
                <Bar dataKey="seconds" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}