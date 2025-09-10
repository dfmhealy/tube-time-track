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
import { podcastApiService, type PodcastSearchResult } from '@/lib/podcastApi';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { useToast } from '@/hooks/use-toast';

export function Podcasts() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [subscriptions, setSubscriptions] = useState<PodcastSubscription[]>([]);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [importingPodcast, setImportingPodcast] = useState<string | null>(null);
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

  const handleExternalSearch = async () => {
    if (!externalSearchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      const results = await podcastApiService.searchPodcasts(externalSearchQuery, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for podcasts. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleImportPodcast = async (searchResult: PodcastSearchResult) => {
    setImportingPodcast(searchResult.id);
    try {
      // Import podcast metadata first (quick operation)
      const importPromise = podcastApiService.importPodcast(searchResult);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Import timeout - RSS feed may be slow or unavailable')), 25000)
      );
      
      const { podcast: importedPodcast, episodes: importedEpisodes } = await Promise.race([
        importPromise,
        timeoutPromise
      ]) as { podcast: any; episodes: any[] };
      
      if (!importedEpisodes || importedEpisodes.length === 0) {
        throw new Error('No episodes found in this podcast feed');
      }
      
      // Create podcast entry immediately with minimal episodes (first 10)
      const initialEpisodes = importedEpisodes.slice(0, 10);
      const { podcast } = await PodcastDatabaseService.importPodcastWithEpisodes(
        {
          title: importedPodcast.title,
          description: importedPodcast.description || '',
          creator: importedPodcast.creator,
          thumbnail_url: importedPodcast.thumbnail_url,
          rss_url: importedPodcast.rss_url || '',
          website_url: importedPodcast.website_url || '',
          language: importedPodcast.language,
          category: importedPodcast.category || '',
          total_episodes: importedEpisodes.length
        },
        initialEpisodes.map(ep => ({
          title: ep.title,
          description: ep.description || '',
          audio_url: ep.audio_url,
          duration_seconds: ep.duration_seconds,
          episode_number: ep.episode_number,
          season_number: ep.season_number,
          publish_date: ep.publish_date,
          thumbnail_url: ep.thumbnail_url
        }))
      );
      
      // Import remaining episodes in background (lazy loading)
      if (importedEpisodes.length > 10) {
        const remainingEpisodes = importedEpisodes.slice(10);
        const batchSize = 25;
        
        // Process in smaller batches with delays to avoid overwhelming the database
        const processBatch = async (batch: any[], delay: number) => {
          await new Promise(resolve => setTimeout(resolve, delay));
          try {
            await PodcastDatabaseService.importPodcastWithEpisodes(
              {
                title: importedPodcast.title,
                description: importedPodcast.description || '',
                creator: importedPodcast.creator,
                thumbnail_url: importedPodcast.thumbnail_url,
                rss_url: importedPodcast.rss_url || '',
                website_url: importedPodcast.website_url || '',
                language: importedPodcast.language,
                category: importedPodcast.category || '',
                total_episodes: importedEpisodes.length
              },
              batch.map(ep => ({
                title: ep.title,
                description: ep.description || '',
                audio_url: ep.audio_url,
                duration_seconds: ep.duration_seconds,
                episode_number: ep.episode_number,
                season_number: ep.season_number,
                publish_date: ep.publish_date,
                thumbnail_url: ep.thumbnail_url
              }))
            );
          } catch (error) {
            console.error('Background episode import failed:', error);
          }
        };
        
        // Schedule background imports with staggered delays
        for (let i = 0; i < remainingEpisodes.length; i += batchSize) {
          const batch = remainingEpisodes.slice(i, i + batchSize);
          const delay = Math.floor(i / batchSize) * 2000; // 2 second delays between batches
          processBatch(batch, delay);
        }
      }

      // Refresh local data
      const [updatedPodcasts, updatedSubscriptions] = await Promise.all([
        PodcastDatabaseService.getAllPodcasts(),
        PodcastDatabaseService.getUserSubscriptions()
      ]);
      
      setPodcasts(updatedPodcasts);
      setSubscriptions(updatedSubscriptions);
      
      toast({
        title: "Podcast Added!",
        description: `${podcast.title} has been added to your library with ${episodes.length} episodes.`,
      });
      
      // Clear search results
      setSearchResults([]);
      setExternalSearchQuery('');
    } catch (error) {
      console.error('Failed to import podcast:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import podcast";
      console.error('Podcast import error details:', error);
      
      toast({
        title: "Import Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setImportingPodcast(null);
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
            <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto">
              <TabsTrigger value="discover">My Library</TabsTrigger>
              <TabsTrigger value="search">Search & Add</TabsTrigger>
              <TabsTrigger value="subscriptions">
                Subscriptions ({subscriptions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="space-y-6">
              {/* Local Search */}
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search your library..."
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

            <TabsContent value="search" className="space-y-6">
              {/* External Search */}
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search for new podcasts to add..."
                      value={externalSearchQuery}
                      onChange={(e) => setExternalSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleExternalSearch()}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>
                  <Button
                    onClick={handleExternalSearch}
                    disabled={searchLoading || !externalSearchQuery.trim()}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {searchLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {searchResults.length > 0 && (
                  <p className="text-white/70 text-sm text-center">
                    Found {searchResults.length} podcasts
                  </p>
                )}
              </div>

              {/* Search Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((result) => {
                  const isImporting = importingPodcast === result.id;
                  const isAlreadyAdded = podcasts.some(p => p.rss_url === result.rss_url);
                  
                  return (
                    <Card key={result.id} className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/15 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <img
                            src={result.thumbnail_url}
                            alt={result.title}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold mb-1 line-clamp-2">
                              {result.title}
                            </h3>
                            <p className="text-white/70 text-sm mb-2">{result.creator}</p>
                            <div className="flex items-center gap-2 text-xs text-white/60 mb-3">
                              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                                {result.total_episodes} episodes
                              </Badge>
                              {result.category && (
                                <span>{result.category}</span>
                              )}
                              <Badge variant="outline" className="bg-blue-600/20 text-blue-200 border-blue-400/30">
                                {result.source}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleImportPodcast(result)}
                              disabled={isImporting || isAlreadyAdded}
                              className={isAlreadyAdded ? 
                                "bg-gray-600/80 text-white cursor-not-allowed" :
                                "bg-primary hover:bg-primary/90"
                              }
                            >
                              {isImporting ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                  Adding...
                                </>
                              ) : isAlreadyAdded ? (
                                <>Already Added</>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add to Library
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {searchResults.length === 0 && externalSearchQuery && !searchLoading && (
                <div className="text-center py-12">
                  <HeadphonesIcon className="w-12 h-12 text-white/50 mx-auto mb-4" />
                  <p className="text-white/70">No podcasts found for "{externalSearchQuery}"</p>
                  <p className="text-white/50 text-sm mt-2">Try different search terms</p>
                </div>
              )}

              {!externalSearchQuery && searchResults.length === 0 && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-white/50 mx-auto mb-4" />
                  <p className="text-white/70 mb-2">Search for podcasts to add to your library</p>
                  <p className="text-white/50 text-sm">Enter a podcast name, creator, or topic above</p>
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
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium line-clamp-2 flex-1">{episode.title}</h4>
                                {episode.is_completed && (
                                  <div className="flex items-center gap-1 text-green-600 text-sm">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs">Completed</span>
                                  </div>
                                )}
                              </div>
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