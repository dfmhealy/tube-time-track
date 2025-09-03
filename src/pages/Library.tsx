import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { URLInput } from '@/components/URLInput';
import { VideoCard } from '@/components/VideoCard';
import { useLibraryStore, useAppStore } from '@/store/appStore';
import { DatabaseService } from '@/lib/database';
import { Search, Filter, SortAsc, SortDesc, Grid, List } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export function Library() {
  const { searchQuery, setSearchQuery } = useAppStore();
  const { 
    videos, 
    setVideos, 
    isLibraryLoading, 
    setLibraryLoading,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder
  } = useLibraryStore();
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filteredVideos, setFilteredVideos] = useState(videos);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Load videos on mount
  useEffect(() => {
    const loadVideos = async () => {
      setLibraryLoading(true);
      try {
        const allVideos = await DatabaseService.getAllVideos();
        setVideos(allVideos);
        
        // Extract all unique tags
        const tags = Array.from(new Set(allVideos.flatMap(v => v.tags)));
        setAvailableTags(tags);
      } catch (error) {
        console.error('Error loading videos:', error);
      } finally {
        setLibraryLoading(false);
      }
    };
    
    loadVideos();
  }, [setVideos, setLibraryLoading]);

  // Filter and sort videos
  useEffect(() => {
    let filtered = videos;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(video => 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.channelTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(video =>
        selectedTags.some(tag => video.tags.includes(tag))
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'addedAt':
          comparison = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
          break;
        case 'watchTime':
          // This would need to be implemented with actual watch time data
          comparison = 0;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredVideos(filtered);
  }, [videos, searchQuery, selectedTags, sortBy, sortOrder]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  if (isLibraryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your library...</p>
        </div>
      </div>
    );
  }

  const isEmpty = videos.length === 0;

  if (isEmpty) {
    return (
      <div className="text-center py-16 px-4">
        <h1 className="text-3xl font-bold mb-4">Your Video Library</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Start building your personal learning library by adding YouTube videos.
        </p>
        
        <div className="max-w-2xl mx-auto">
          <URLInput placeholder="Paste your first YouTube URL here..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Video Library</h1>
          <p className="text-muted-foreground mt-1">
            {filteredVideos.length} of {videos.length} videos
          </p>
        </div>
        
        <URLInput className="w-full sm:w-auto sm:min-w-80" />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 backdrop-blur-sm border-border/50"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex gap-2 flex-wrap">
          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableTags.map(tag => (
                  <DropdownMenuItem
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={selectedTags.includes(tag) ? 'bg-accent' : ''}
                  >
                    {tag}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy('addedAt')}>
                Date Added
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('title')}>
                Title
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('watchTime')}>
                Watch Time
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? 'Descending' : 'Ascending'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode */}
          <div className="flex border border-border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Filtered by:</span>
          {selectedTags.map(tag => (
            <Badge 
              key={tag} 
              variant="secondary" 
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
              onClick={() => toggleTag(tag)}
            >
              {tag} ×
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTags([])}
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Video Grid */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">
            No videos match your search criteria.
          </p>
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchQuery('');
              setSelectedTags([]);
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
        }>
          {filteredVideos.map((video) => (
            <VideoCard 
              key={video.id} 
              video={video}
              className={viewMode === 'list' ? 'flex-row' : ''}
            />
          ))}
        </div>
      )}

      {/* Bottom spacing for mobile navigation */}
      <div className="h-20 md:h-0" />
    </div>
  );
}