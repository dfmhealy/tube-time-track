import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Clock, Trash2, RotateCcw, CheckCircle, ListPlus } from 'lucide-react'; // Added ListPlus icon
import { formatDuration, cn } from '@/lib/utils';
import type { Video } from '@/lib/database';
import { usePlayerStore } from '@/store/playerStore'; // Corrected import
import { toast } from 'sonner'; // Import toast for notifications

interface VideoCardProps {
  video: Video;
  onDelete: (videoId: string) => void;
  className?: string;
}

export function VideoCard({ video, onDelete, className }: VideoCardProps) {
  const player = usePlayerStore();

  // Validate all numeric values
  const duration = Math.max(0, video.durationSeconds || 0);
  const watchSeconds = Math.max(0, video.watchSeconds || 0);
  const lastPosition = Math.max(0, video.lastPositionSeconds || 0);
  
  // Calculate progress percentages with validation
  const progressPercent = duration > 0 
    ? Math.min(Math.round((watchSeconds / duration) * 100), 100)
    : 0;
  
  const watchProgressPercent = duration > 0 && lastPosition > 0
    ? Math.min(Math.round((lastPosition / duration) * 100), 100)
    : 0;

  // Use the greater of last position or total watch time for actual progress
  const actualProgress = Math.max(lastPosition, watchSeconds);
  const actualProgressPercent = duration > 0 
    ? Math.min(Math.round((actualProgress / duration) * 100), 100)
    : 0;
    
  const hasProgress = actualProgress > 30;
  const isCompleted = video.isCompleted || actualProgressPercent >= 90;

  const handlePlay = () => {
    // Clear current player first to avoid conflicts
    if (player.current) {
      player.clearCurrent();
    }
    
    // Then play the new video
    player.play({
      type: 'video',
      id: video.id,
      youtubeId: video.youtubeId, // Pass youtubeId
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      channelTitle: video.channelTitle,
      durationSeconds: video.durationSeconds,
      lastPositionSeconds: video.lastPositionSeconds,
    }, video.lastPositionSeconds || 0);
  };

  const handleEnqueueNext = () => {
    player.enqueueNext({
      type: 'video',
      id: video.id,
      youtubeId: video.youtubeId, // Pass youtubeId
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      channelTitle: video.channelTitle,
      durationSeconds: video.durationSeconds,
      lastPositionSeconds: video.lastPositionSeconds,
    });
    toast.success(`"${video.title}" added to play next.`);
  };

  const handleEnqueueLast = () => {
    player.enqueueLast({
      type: 'video',
      id: video.id,
      youtubeId: video.youtubeId, // Pass youtubeId
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      channelTitle: video.channelTitle,
      durationSeconds: video.durationSeconds,
      lastPositionSeconds: video.lastPositionSeconds,
    });
    toast.success(`"${video.title}" added to end of queue.`);
  };

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
            {hasProgress ? <RotateCcw className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
          </Button>
        </div>

        {/* Duration badge */}
        {duration > 0 && (
          <Badge 
            variant="secondary" 
            className="absolute bottom-2 right-2 bg-black/80 text-white border-0"
          >
            {formatDuration(duration)}
          </Badge>
        )}

        {/* Completion indicator */}
        {isCompleted && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="h-5 w-5 text-green-500 bg-black/50 rounded-full" />
          </div>
        )}

        {/* Watch progress bar */}
        {watchProgressPercent > 0 && !isCompleted && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${watchProgressPercent}%` }}
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

            {/* Progress info */}
            {hasProgress && (
              <div className="flex items-center gap-2 mt-2">
                <Progress value={watchProgressPercent} className="h-1 flex-1" />
                <span className="text-xs text-muted-foreground">
                  {formatDuration(lastPosition)} / {formatDuration(duration)}
                </span>
              </div>
            )}

            {/* Watch time info */}
            {watchSeconds > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(watchSeconds)} watched</span>
                {progressPercent > 0 && (
                  <span>({progressPercent}%)</span>
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

          {/* Action buttons */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
              onClick={handleEnqueueNext}
              title="Play Next"
            >
              <ListPlus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
              onClick={handleEnqueueLast}
              title="Add to Queue"
            >
              <ListPlus className="h-4 w-4 rotate-180" /> {/* Flipped icon for 'add to end' */}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(video.id)}
              title="Delete Video"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};