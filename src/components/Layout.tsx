import { ReactNode } from 'react';
import { useAppStore } from '@/store/appStore';
import { Navigation } from './Navigation';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  const { currentView } = useAppStore();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-primary rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-accent rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header - only show on non-player views */}
        {currentView !== 'player' && (
          <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
            <div className="container flex h-16 items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  YTTracker
                </h1>
              </div>
              
              <Navigation />
            </div>
          </header>
        )}

        {/* Main content area */}
        <main className={cn(
          "container mx-auto px-4 py-6",
          currentView === 'player' && "p-0 max-w-none",
          className
        )}>
          {children}
        </main>

        {/* Mobile bottom navigation - only show on non-player views */}
        {currentView !== 'player' && (
          <div className="md:hidden">
            <Navigation mobile />
          </div>
        )}
      </div>
    </div>
  );
}