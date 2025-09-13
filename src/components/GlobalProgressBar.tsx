import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { dailyTimeTracker } from '@/lib/dailyTimeTracker';
import { useStatsStore } from '@/store/statsStore';
import { formatDuration } from '@/lib/utils';
import { Target, TrendingUp } from 'lucide-react';

interface GlobalProgressBarProps {
  className?: string;
  compact?: boolean;
}

export const GlobalProgressBar: React.FC<GlobalProgressBarProps> = ({ 
  className = '', 
  compact = false 
}) => {
  const [dailyTime, setDailyTime] = useState(0);
  const { userStats } = useStatsStore();
  
  const dailyGoalSeconds = userStats?.dailyGoalSeconds || (30 * 60); // Default 30 minutes
  const progressPercent = dailyGoalSeconds > 0 ? Math.min((dailyTime / dailyGoalSeconds) * 100, 100) : 0;
  const isGoalReached = progressPercent >= 100;

  useEffect(() => {
    // Load initial daily time
    dailyTimeTracker.loadDailyTime().then(setDailyTime);

    // Subscribe to daily time updates
    const unsubscribe = dailyTimeTracker.subscribe(setDailyTime);

    return unsubscribe;
  }, []);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Target className="h-3 w-3" />
          <span>{formatDuration(dailyTime)} / {formatDuration(dailyGoalSeconds)}</span>
        </div>
        <Progress 
          value={progressPercent} 
          className="h-1 w-16" 
        />
        {isGoalReached && (
          <TrendingUp className="h-3 w-3 text-green-500" />
        )}
      </div>
    );
  }

  return (
    <Card className={`p-3 bg-card/50 backdrop-blur-sm border-border/50 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Daily Goal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {formatDuration(dailyTime)} / {formatDuration(dailyGoalSeconds)}
          </span>
          {isGoalReached && (
            <div className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Goal Reached!</span>
            </div>
          )}
        </div>
      </div>
      <Progress 
        value={progressPercent} 
        className="h-2" 
      />
      <div className="text-xs text-muted-foreground mt-1">
        {isGoalReached 
          ? "🎉 Great job! You've reached your daily goal!" 
          : `${formatDuration(Math.max(0, dailyGoalSeconds - dailyTime))} remaining`
        }
      </div>
    </Card>
  );
};