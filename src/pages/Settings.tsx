import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Settings() {
  const { weeklyGoal, setWeeklyGoal } = useAppStore();
  const [localDailyGoal, setLocalDailyGoal] = useState(String(weeklyGoal / 3600)); // Convert to string for input

  const handleSave = () => {
    const hours = parseFloat(localDailyGoal);
    if (isNaN(hours) || hours <= 0) {
      toast.error('Please enter a valid number of hours');
      return;
    }
    setWeeklyGoal(Math.round(hours * 3600)); // Convert hours to seconds
    toast.success('Daily goal updated successfully');
  };

  // Convert seconds to hours for display
  const dailyGoalInHours = (weeklyGoal / 3600).toFixed(1);

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
                    min="0.1"
                    step="0.1"
                    value={localDailyGoal}
                    onChange={(e) => setLocalDailyGoal(e.target.value)}
                    className="w-32"
                  />
                </div>
                <span>hours per day</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Current goal: <span className="font-medium">{dailyGoalInHours} hours per day</span>
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
