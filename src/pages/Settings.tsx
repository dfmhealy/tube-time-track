import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Settings() {
  const { dailyGoal, setDailyGoal } = useAppStore();
  const [localDailyGoal, setLocalDailyGoal] = useState(String(dailyGoal / 60)); // Convert to minutes for input

  const handleSave = () => {
    const minutes = parseFloat(localDailyGoal);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error('Please enter a valid number of minutes');
      return;
    }
    setDailyGoal(Math.round(minutes * 60)); // Convert minutes to seconds
    toast.success('Daily goal updated successfully');
  };

  // Convert seconds to minutes for display
  const dailyGoalInMinutes = Math.round(dailyGoal / 60);

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
