import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DatabaseService, type Video } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { usePlayerStore } from '@/store/playerStore';
import { Play, ListPlus } from 'lucide-react'; // Import ListPlus icon
import { formatDuration } from '@/lib/utils'; // Import formatDuration
import { toast as sonnerToast } from 'sonner'; // Import sonner toast

export default function Subscriptions() {
  const [channels, setChannels] = useState<string[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const player = usePlayerStore();

  useEffect(() => {
    (async () => {
      try {
        const [subs, vids] = await Promise.all([
          DatabaseService.getUserChannelSubscriptions(),
          DatabaseService.getAllVideos(),
        ]);
        setChannels(subs);
        setVideos(vids);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return selectedChannel ? videos.filter(v => v.channelTitle === selectedChannel) : videos;
  }, [videos, selectedChannel]);

  const handlePlayVideo = (video: Video) => {
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

  const handleEnqueueNext = (video: Video) => {
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
    sonnerToast.success(`"${video.title}" added to play next.`);
  };

  const handleEnqueueLast = (video: Video) => {
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
    sonnerToast.success(`"${video.title}" added to end of queue.`);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
        <Button variant="outline" onClick={() => navigate('/')}>Home</Button>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedChannel ? 'outline' : 'default'}
              onClick={() => setSelectedChannel(null)}
            >
              All Channels
            </Button>
            {channels.map((ch) => (
              <div key={ch} className="flex items-center gap-2">
                <Button
                  variant={selectedChannel === ch ? 'default' : 'outline'}
                  onClick={() => setSelectedChannel(ch)}
                >
                  {ch}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await DatabaseService.unsubscribeFromChannel(ch);
                      setChannels(prev => prev.filter(c => c !== ch));
                      toast({ title: 'Unsubscribed', description: `Unsubscribed from ${ch}` });
                    } catch (e) {
                      toast({ title: 'Error', description: 'Failed to unsubscribe', variant: 'destructive' });
                    }
                  }}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No videos found for this channel.
          </div>
        ) : (
          filtered.map(v => (
            <Card key={v.id} className="p-3 bg-card/60 border-border/60">
              <CardContent className="p-0">
                <div className="flex gap-3">
                  <img src={v.thumbnailUrl} alt={v.title} className="w-28 h-16 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium line-clamp-2">{v.title}</div>
                    <div className="text-xs text-muted-foreground">{v.channelTitle}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDuration(v.durationSeconds)}
                      {v.lastPositionSeconds && v.lastPositionSeconds > 0 && (
                        <span className="ml-2 text-primary">Resumes at {formatDuration(v.lastPositionSeconds)}</span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handlePlayVideo(v)}>
                        <Play className="h-4 w-4 mr-1" /> Play Now
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEnqueueNext(v)}>
                        <ListPlus className="h-4 w-4 mr-1" /> Next
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEnqueueLast(v)}>
                        <ListPlus className="h-4 w-4 mr-1 rotate-180" /> Last
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}