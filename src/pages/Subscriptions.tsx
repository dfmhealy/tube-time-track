import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DatabaseService, type Video } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { usePlayerStore } from '@/store/playerStore';

export default function Subscriptions() {
  const [channels, setChannels] = useState<string[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const player = usePlayerStore();

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
        {filtered.map(v => (
          <Card key={v.id} className="p-3 bg-card/60 border-border/60">
            <CardContent className="p-0">
              <div className="flex gap-3">
                <img src={v.thumbnailUrl} alt={v.title} className="w-28 h-16 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium line-clamp-2">{v.title}</div>
                  <div className="text-xs text-muted-foreground">{v.channelTitle}</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => player.play({ type: 'video', id: v.id })}>Play Now</Button>
                    <Button size="sm" variant="outline" onClick={() => player.enqueueNext({ type: 'video', id: v.id })}>Play Next</Button>
                    <Button size="sm" variant="outline" onClick={() => player.enqueueLast({ type: 'video', id: v.id })}>Play Last</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
