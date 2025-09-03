import { Home, Library, BarChart3, Settings, Play } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavigationProps {
  mobile?: boolean;
}

export function Navigation({ mobile = false }: NavigationProps) {
  const { currentView, setCurrentView } = useAppStore();

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'library' as const, label: 'Library', icon: Library },
    { id: 'stats' as const, label: 'Stats', icon: BarChart3 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  if (mobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={currentView === id ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView(id)}
              className={cn(
                "flex flex-col items-center space-y-1 h-auto py-2 px-3",
                currentView === id && "bg-gradient-primary text-primary-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="hidden md:flex items-center space-x-2">
      {navItems.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant={currentView === id ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentView(id)}
          className={cn(
            "flex items-center space-x-2",
            currentView === id && "bg-gradient-primary text-primary-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Button>
      ))}
    </nav>
  );
}