import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Clock, 
  Search, 
  Plus, 
  Minus,
  HeadphonesIcon,
  TrendingUp
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { PodcastDatabaseService, type Podcast, type PodcastEpisode, type PodcastSubscription } from '@/lib/podcastDatabase';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { useToast } from '@/hooks/use-toast';

export function Podcasts() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [subscriptions, setSubscriptions] = useState<PodcastSubscription[]>([]);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [podcastsData, subscriptionsData] = await Promise.all([
          PodcastDatabaseService.getAllPodcasts(),
          PodcastDatabaseService.getUserSubscriptions()
        ]);
        
        setPodcasts(podcastsData);
        setSubscriptions(subscriptionsData);
      } catch (error) {
        console.error('Failed to load podcasts:', error);
        toast({
          title: "Error",
          description: "Failed to load podcasts",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  // Load episodes when podcast is selected
  useEffect(() => {
    if (selectedPodcast) {
      const loadEpisodes = async () => {
        setEpisodesLoading(true);
        try {
          const episodesData = await PodcastDatabaseService.getEpisodesForPodcast(selectedPodcast.id);
          setEpisodes(episodesData);
        } catch (error) {
          console.error('Failed to load episodes:', error);
          toast({
            title: "Error",
            description: "Failed to load episodes",
            variant: "destructive"
          });
        } finally {
          setEpisodesLoading(false);
        }
      };

      loadEpisodes();
    }
  }, [selectedPodcast, toast]);

  const handleSubscribe = async (podcast: Podcast) => {
    try {
      await PodcastDatabaseService.subscribeToPodcast(podcast.id);
      
      // Update subscriptions list
      const updatedSubscriptions = await PodcastDatabaseService.getUserSubscriptions();
      setSubscriptions(updatedSubscriptions);
      
      toast({
        title: "Subscribed!",
        description: `You're now subscribed to ${podcast.title}`,
      });
    } catch (error) {
      console.error('Failed to subscribe:', error);
      toast({
        title: "Error",
        description: "Failed to subscribe to podcast",
        variant: "destructive"
      });
    }
  };

  const handleUnsubscribe = async (podcast: Podcast) => {
    try {
      await PodcastDatabaseService.unsubscribeFromPodcast(podcast.id);
      
      // Update subscriptions list
      const updatedSubscriptions = await PodcastDatabaseService.getUserSubscriptions();
      setSubscriptions(updatedSubscriptions);
      
      toast({
        title: "Unsubscribed",
        description: `You've unsubscribed from ${podcast.title}`,
      });
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      toast({
        title: "Error",
        description: "Failed to unsubscribe from podcast",
        variant: "destructive"
      });
    }
  };

  const isSubscribed = (podcastId: string) => {
    return subscriptions.some(sub => sub.podcast_id === podcastId);
  };

  const filteredPodcasts = podcasts.filter(podcast =>
    podcast.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    podcast.creator.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const subscribedPodcasts = subscriptions.map(sub => sub.podcast).filter(Boolean) as Podcast[];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Podcasts
            </h1>
            <p className="text-white/80 text-lg">
              Discover and listen to your favorite podcasts
            </p>
          </div>

          <Tabs defaultValue="discover" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
              <TabsTrigger value="discover">Discover</TabsTrigger>
              <TabsTrigger value="subscriptions">
                My Subscriptions ({subscriptions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="space-y-6">
              {/* Search */}
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search podcasts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              {/* Podcast Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPodcasts.map((podcast) => (
                  <Card key={podcast.id} className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/15 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <img
                          src={podcast.thumbnail_url}
                          alt={podcast.title}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold mb-1 line-clamp-2">
                            {podcast.title}
                          </h3>
                          <p className="text-white/70 text-sm mb-2">{podcast.creator}</p>
                          <div className="flex items-center gap-2 text-xs text-white/60 mb-3">
                            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                              {podcast.total_episodes} episodes
                            </Badge>
                            {podcast.category && (
                              <span>{podcast.category}</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedPodcast(podcast)}
                              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Episodes
                            </Button>
                            <Button
                              size="sm"
                              variant={isSubscribed(podcast.id) ? "destructive" : "default"}
                              onClick={() => isSubscribed(podcast.id) ? handleUnsubscribe(podcast) : handleSubscribe(podcast)}
                              className={isSubscribed(podcast.id) ? 
                                "bg-red-600/80 hover:bg-red-600 text-white" :
                                "bg-primary hover:bg-primary/90"
                              }
                            >
                              {isSubscribed(podcast.id) ? (
                                <Minus className="w-3 h-3 mr-1" />
                              ) : (
                                <Plus className="w-3 h-3 mr-1" />
                              )}
                              {isSubscribed(podcast.id) ? 'Unsubscribe' : 'Subscribe'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredPodcasts.length === 0 && (
                <div className="text-center py-12">
                  <HeadphonesIcon className="w-12 h-12 text-white/50 mx-auto mb-4" />
                  <p className="text-white/70">No podcasts found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscriptions" className="space-y-6">
              {subscribedPodcasts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subscribedPodcasts.map((podcast) => (
                    <Card key={podcast.id} className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/15 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <img
                            src={podcast.thumbnail_url}
                            alt={podcast.title}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold mb-1 line-clamp-2">
                              {podcast.title}
                            </h3>
                            <p className="text-white/70 text-sm mb-2">{podcast.creator}</p>
                            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 mb-3">
                              {podcast.total_episodes} episodes
                            </Badge>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedPodcast(podcast)}
                                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Listen
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleUnsubscribe(podcast)}
                                className="bg-red-600/80 hover:bg-red-600 text-white"
                              >
                                <Minus className="w-3 h-3 mr-1" />
                                Unsubscribe
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <HeadphonesIcon className="w-12 h-12 text-white/50 mx-auto mb-4" />
                  <p className="text-white/70 mb-4">You haven't subscribed to any podcasts yet</p>
                  <Button
                    onClick={() => {
                      const discoverTab = document.querySelector('[value="discover"]') as HTMLButtonElement;
                      discoverTab?.click();
                    }}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Discover Podcasts
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Episode List Modal */}
          {selectedPodcast && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
              <Card className="w-full max-w-4xl bg-background/95 backdrop-blur max-h-[80vh] overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={selectedPodcast.thumbnail_url}
                      alt={selectedPodcast.title}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{selectedPodcast.title}</CardTitle>
                      <p className="text-muted-foreground mb-2">{selectedPodcast.creator}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {selectedPodcast.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPodcast(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-y-auto max-h-96">
                  {episodesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {episodes.map((episode) => (
                        <Card key={episode.id} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-4">
                            <Button
                              onClick={() => setCurrentEpisode(episode)}
                              size="sm"
                              className="mt-1 bg-primary hover:bg-primary/90"
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium mb-1 line-clamp-2">{episode.title}</h4>
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {episode.description}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {episode.episode_number && (
                                  <span>Episode {episode.episode_number}</span>
                                )}
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(episode.duration_seconds)}
                                </div>
                                {episode.publish_date && (
                                  <span>{new Date(episode.publish_date).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Podcast Player */}
          {currentEpisode && (
            <PodcastPlayer
              episode={currentEpisode}
              onClose={() => setCurrentEpisode(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}