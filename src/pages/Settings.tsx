import { useState, useEffect } from 'react';
import { useStatsStore } from '@/store/statsStore'; // Updated import
import { DatabaseService } from '@/lib/database';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Settings() {
  const { userStats, setUserStats, updateDailyGoalSeconds } = useStatsStore();
  const [localDailyGoal, setLocalDailyGoal] = useState('0'); // Convert to minutes for input

  // Load initial daily goal from store/database
  useEffect(() => {
    if (userStats?.dailyGoalSeconds !== undefined) {
      setLocalDailyGoal(String(Math.round(userStats.dailyGoalSeconds / 60)));
    } else {
      // If userStats not loaded yet, try to fetch or use a default
      const fetchUserStats = async () => {
        const stats = await DatabaseService.getUserStats();
        if (stats) {
          setUserStats(stats);
          setLocalDailyGoal(String(Math.round(stats.dailyGoalSeconds / 60)));
        } else {
          setLocalDailyGoal(String(30)); // Default to 30 minutes if no stats
        }
      };
      fetchUserStats();
    }
  }, [userStats?.dailyGoalSeconds, setUserStats]);

  const handleSave = async () => {
    const minutes = parseFloat(localDailyGoal);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error('Please enter a valid number of minutes'); // Corrected toast call
      return;
    }
    const newGoalSeconds = Math.round(minutes * 60); // Convert minutes to seconds

    try {
      await DatabaseService.updateUserStats({ weekly_goal_seconds: newGoalSeconds });
      updateDailyGoalSeconds(newGoalSeconds); // Update Zustand store
      toast.success('Daily goal updated successfully');
    } catch (error) {
      console.error('Failed to update daily goal:', error);
      toast.error('Failed to save daily goal. Please try again.');
    }
  };

  // Convert seconds to minutes for display
  const dailyGoalInMinutes = Math.round((userStats?.dailyGoalSeconds || 0) / 60);

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your preferences and goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Daily Watch Goal</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set your daily goal for watch time.
              </p>
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={localDailyGoal}
                    onChange={(e) => setLocalDailyGoal(e.target.value)}
                    className="w-32"
                  />
                </div>
                <span>minutes per day</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Current goal: <span className="font-medium">{dailyGoalInMinutes} minutes per day</span>
              </p>
            </div>
            
            <Button onClick={handleSave} className="mt-4">
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};