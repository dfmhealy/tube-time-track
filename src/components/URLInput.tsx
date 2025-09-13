import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractYouTubeId, getVideoInfoFromOEmbed, getThumbnailUrl } from '@/lib/youtube';
import { DatabaseService } from '@/lib/database';
import { useLibraryStore } from '@/store/libraryStore'; // Corrected import path
import { cn } from '@/lib/utils';

interface URLInputProps {
  className?: string;
  placeholder?: string;
  onVideoAdded?: () => void;
}

export function URLInput({ className, placeholder = "Paste YouTube URL here...", onVideoAdded }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { addVideo } = useLibraryStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Extract YouTube ID
      const videoId = extractYouTubeId(url.trim());
      if (!videoId) {
        throw new Error('Invalid YouTube URL. Please check the URL and try again.');
      }

      // Check if video already exists
      const existingVideo = await DatabaseService.getVideoByYouTubeId(videoId);
      if (existingVideo) {
        toast({
          title: "Video already exists",
          description: "This video is already in your library.",
          variant: "destructive"
        });
        setUrl('');
        setIsLoading(false);
        return;
      }

      // Get video info
      const videoInfo = await getVideoInfoFromOEmbed(videoId);
      if (!videoInfo) {
        throw new Error('Could not fetch video information. The video might be private or unavailable.');
      }

      // Add to database
      const newVideo = await DatabaseService.addVideo({
        youtubeId: videoId,
        title: videoInfo.title,
        channelTitle: videoInfo.channelTitle,
        durationSeconds: 0, // Will be updated when player loads
        thumbnailUrl: getThumbnailUrl(videoId),
        tags: [],
        addedAt: new Date().toISOString()
      });

      // Update store
      addVideo(newVideo);

      toast({
        title: "Video added!",
        description: `"${newVideo.title}" has been added to your library.`
      });

      setUrl('');
      onVideoAdded?.();
      
    } catch (error) {
      console.error('Error adding video:', error);
      toast({
        title: "Error adding video",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
      <div className="flex-1">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary transition-smooth"
        />
      </div>
      
      <Button
        type="submit"
        disabled={isLoading || !url.trim()}
        className="bg-gradient-primary hover:shadow-glow transition-smooth shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        <span className="ml-2 hidden sm:inline">Add Video</span>
      </Button>
    </form>
  );
}