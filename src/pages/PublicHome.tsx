import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, BarChart3, Target, Shield } from 'lucide-react';

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-gradient-primary">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <Play className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">YouTube Tracker</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-white text-primary hover:bg-white/90">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            Track Your YouTube Learning Journey
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Monitor your watch time, set learning goals, and gain insights into your YouTube viewing habits 
            with our powerful tracking platform.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-4">
              Start Tracking Now
            </Button>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-border/50 bg-background/95 backdrop-blur-sm">
            <CardHeader>
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Detailed Analytics</CardTitle>
              <CardDescription>
                Get comprehensive insights into your viewing patterns, watch time, and learning progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Daily and weekly watch time reports</li>
                <li>• Video completion tracking</li>
                <li>• Learning streak monitoring</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-background/95 backdrop-blur-sm">
            <CardHeader>
              <div className="p-3 bg-accent/10 rounded-lg w-fit">
                <Target className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>Goal Setting</CardTitle>
              <CardDescription>
                Set daily and weekly learning goals to stay motivated and track your progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Customizable learning targets</li>
                <li>• Progress visualization</li>
                <li>• Achievement notifications</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-background/95 backdrop-blur-sm">
            <CardHeader>
              <div className="p-3 bg-success/10 rounded-lg w-fit">
                <Shield className="h-6 w-6 text-success" />
              </div>
              <CardTitle>Privacy First</CardTitle>
              <CardDescription>
                Your data is secure and private. We only track what you choose to share.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Secure data encryption</li>
                <li>• User-controlled tracking</li>
                <li>• No third-party sharing</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <Card className="border-border/50 bg-background/95 backdrop-blur-sm max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Start Your Learning Journey?</CardTitle>
              <CardDescription>
                Join thousands of learners who are tracking their progress and achieving their goals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/auth">
                <Button size="lg" className="w-full md:w-auto">
                  Create Your Free Account
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-4">
                No credit card required • Free forever
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t border-white/10">
        <div className="text-center text-white/60">
          <p>&copy; 2024 YouTube Tracker. Built with ❤️ for learners.</p>
        </div>
      </footer>
    </div>
  );
}