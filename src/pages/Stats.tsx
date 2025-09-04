import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStatsStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import { formatDuration } from '@/lib/youtube';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Clock, Target, TrendingUp } from 'lucide-react';

export function Stats() {
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

  const weeklyGoalHours = 5; // Default 5 hours, could come from settings
  const weeklyGoalSeconds = weeklyGoalHours * 3600;
  const currentWeekSeconds = weeklyData?.[weeklyData.length - 1]?.seconds || 0;
  const weeklyProgress = (currentWeekSeconds / weeklyGoalSeconds) * 100;

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
              <p className="text-2xl font-bold">{formatDuration(userStats.totalSeconds)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Target className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Weekly Goal</p>
              <p className="text-2xl font-bold">{Math.round(weeklyProgress)}%</p>
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
              <p className="text-2xl font-bold">{userStats.streakDays} days</p>
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
              <p className="text-2xl font-bold">{formatDuration(currentWeekSeconds)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly Goal Progress */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Weekly Goal Progress</h3>
            <Badge variant={weeklyProgress >= 100 ? "default" : "secondary"}>
              {formatDuration(currentWeekSeconds)} / {formatDuration(weeklyGoalSeconds)}
            </Badge>
          </div>
          <Progress value={Math.min(weeklyProgress, 100)} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {weeklyProgress >= 100 
              ? "🎉 Congratulations! You've reached your weekly goal!" 
              : `${formatDuration(weeklyGoalSeconds - currentWeekSeconds)} remaining to reach your goal`
            }
          </p>
        </div>
      </Card>

      {/* Weekly Chart */}
      {weeklyData && weeklyData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                />
                <YAxis 
                  tickFormatter={(seconds) => `${Math.round(seconds / 3600 * 10) / 10}h`}
                />
                <Tooltip 
                  formatter={(seconds: number) => [formatDuration(seconds), 'Watch Time']}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
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