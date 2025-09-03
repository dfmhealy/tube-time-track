import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Clock, Trash2, MoreVertical } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAppStore, useLibraryStore } from '@/store/appStore';
import { DatabaseService, type Video } from '@/lib/database';
import { formatDuration } from '@/lib/youtube';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  video: Video;
  className?: string;
}

export function VideoCard({ video, className }: VideoCardProps) {
  const [totalWatchTime, setTotalWatchTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentView, setCurrentVideo } = useAppStore();
  const { removeVideo } = useLibraryStore();
  const { toast } = useToast();

  useEffect(() => {
    // Load total watch time for this video
    const loadWatchTime = async () => {
      const watchTime = await DatabaseService.getTotalWatchTimeForVideo(video.id);
      setTotalWatchTime(watchTime);
    };
    loadWatchTime();
  }, [video.id]);

  const handlePlay = () => {
    setCurrentVideo(video);
    setCurrentView('player');
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await DatabaseService.deleteVideo(video.id);
      removeVideo(video.id);
      toast({
        title: "Video removed",
        description: `"${video.title}" has been removed from your library.`
      });
    } catch (error) {
      console.error('Error deleting video:', error);
      toast({
        title: "Error",
        description: "Failed to remove video. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const watchPercentage = video.durationSeconds > 0 
    ? Math.min((totalWatchTime / video.durationSeconds) * 100, 100)
    : 0;

  return (
    <Card className={cn(
      "group overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 bg-card/50 backdrop-blur-sm border-border/50",
      className
    )}>
      <div className="relative aspect-video overflow-hidden">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Button
            onClick={handlePlay}
            size="lg"
            className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-full h-16 w-16 p-0 shadow-lg backdrop-blur-sm"
          >
            <Play className="h-6 w-6 ml-1" />
          </Button>
        </div>

        {/* Duration badge */}
        {video.durationSeconds > 0 && (
          <Badge 
            variant="secondary" 
            className="absolute bottom-2 right-2 bg-black/80 text-white border-0"
          >
            {formatDuration(video.durationSeconds)}
          </Badge>
        )}

        {/* Watch progress bar */}
        {watchPercentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${watchPercentage}%` }}
            />
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <h3 
              className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors cursor-pointer"
              onClick={handlePlay}
              title={video.title}
            >
              {video.title}
            </h3>
            
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={video.channelTitle}>
              {video.channelTitle}
            </p>

            {/* Watch time info */}
            {totalWatchTime > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(totalWatchTime)} watched</span>
                {watchPercentage > 0 && (
                  <span>({Math.round(watchPercentage)}%)</span>
                )}
              </div>
            )}

            {/* Tags */}
            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {video.tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                    {tag}
                  </Badge>
                ))}
                {video.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    +{video.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isLoading}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePlay}>
                <Play className="h-4 w-4 mr-2" />
                Play Video
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}