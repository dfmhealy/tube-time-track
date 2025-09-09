// Podcast API service for external podcast search and data fetching
export interface PodcastSearchResult {
  id: string;
  title: string;
  description?: string;
  creator: string;
  thumbnail_url: string;
  rss_url?: string;
  website_url?: string;
  language: string;
  category?: string;
  total_episodes: number;
  external_id?: string;
  source: 'itunes' | 'spotify' | 'rss';
}

export interface PodcastEpisodeResult {
  id: string;
  title: string;
  description?: string;
  audio_url: string;
  duration_seconds: number;
  episode_number?: number;
  season_number?: number;
  publish_date?: string;
  thumbnail_url?: string;
}

// iTunes Search API integration
class ITunesSearchAPI {
  private baseUrl = 'https://itunes.apple.com/search';

  async searchPodcasts(query: string, limit: number = 20): Promise<PodcastSearchResult[]> {
    try {
      const params = new URLSearchParams({
        term: query,
        media: 'podcast',
        entity: 'podcast',
        limit: limit.toString(),
        explicit: 'Yes'
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`iTunes API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.results.map((item: any): PodcastSearchResult => ({
        id: `itunes_${item.collectionId}`,
        title: item.collectionName || item.trackName || 'Unknown Title',
        description: item.description || '',
        creator: item.artistName || 'Unknown Creator',
        thumbnail_url: item.artworkUrl600 || item.artworkUrl100 || '',
        rss_url: item.feedUrl || '',
        website_url: item.collectionViewUrl || '',
        language: item.language || 'en',
        category: item.primaryGenreName || '',
        total_episodes: item.trackCount || 0,
        external_id: item.collectionId?.toString(),
        source: 'itunes'
      }));
    } catch (error) {
      console.error('iTunes search error:', error);
      throw new Error('Failed to search iTunes podcasts');
    }
  }
}

// RSS Feed parser for podcast episodes
class RSSParser {
  async parseRSSFeed(rssUrl: string): Promise<{
    podcast: Partial<PodcastSearchResult>;
    episodes: PodcastEpisodeResult[];
  }> {
    try {
      // Use a CORS proxy for RSS feed parsing
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`RSS fetch error: ${response.status}`);
      }

      const data = await response.json();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, 'text/xml');

      // Parse podcast info
      const channel = xmlDoc.querySelector('channel');
      if (!channel) {
        throw new Error('Invalid RSS feed format');
      }

      const podcast: Partial<PodcastSearchResult> = {
        title: this.getTextContent(channel, 'title') || 'Unknown Podcast',
        description: this.getTextContent(channel, 'description') || '',
        creator: this.getTextContent(channel, 'itunes\\:author') || 
                 this.getTextContent(channel, 'managingEditor') || 'Unknown Creator',
        thumbnail_url: this.getImageUrl(channel) || '',
        language: this.getTextContent(channel, 'language') || 'en',
        category: this.getTextContent(channel, 'itunes\\:category') || '',
        rss_url: rssUrl,
        source: 'rss' as const
      };

      // Parse episodes
      const items = Array.from(xmlDoc.querySelectorAll('item'));
      const episodes: PodcastEpisodeResult[] = items.map((item, index) => {
        const enclosure = item.querySelector('enclosure');
        const audioUrl = enclosure?.getAttribute('url') || '';
        
        return {
          id: `rss_${Date.now()}_${index}`,
          title: this.getTextContent(item, 'title') || `Episode ${index + 1}`,
          description: this.getTextContent(item, 'description') || 
                      this.getTextContent(item, 'itunes\\:summary') || '',
          audio_url: audioUrl,
          duration_seconds: this.parseDuration(this.getTextContent(item, 'itunes\\:duration') || '0'),
          episode_number: this.parseEpisodeNumber(this.getTextContent(item, 'itunes\\:episode')),
          season_number: this.parseSeasonNumber(this.getTextContent(item, 'itunes\\:season')),
          publish_date: this.parseDate(this.getTextContent(item, 'pubDate') || ''),
          thumbnail_url: this.getImageUrl(item) || podcast.thumbnail_url || ''
        };
      }).filter(episode => episode.audio_url); // Only include episodes with audio

      return { podcast, episodes };
    } catch (error) {
      console.error('RSS parsing error:', error);
      throw new Error('Failed to parse RSS feed');
    }
  }

  private getTextContent(element: Element, selector: string): string | null {
    const found = element.querySelector(selector);
    return found?.textContent?.trim() || null;
  }

  private getImageUrl(element: Element): string | null {
    // Try iTunes image first
    const itunesImage = element.querySelector('itunes\\:image');
    if (itunesImage) {
      return itunesImage.getAttribute('href');
    }

    // Try regular image
    const image = element.querySelector('image url');
    if (image) {
      return image.textContent?.trim() || null;
    }

    return null;
  }

  private parseDuration(duration: string): number {
    if (!duration) return 0;
    
    // Handle HH:MM:SS or MM:SS format
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      return parts[0];
    }
    
    return 0;
  }

  private parseEpisodeNumber(episodeStr: string | null): number | undefined {
    if (!episodeStr) return undefined;
    const num = parseInt(episodeStr, 10);
    return isNaN(num) ? undefined : num;
  }

  private parseSeasonNumber(seasonStr: string | null): number | undefined {
    if (!seasonStr) return undefined;
    const num = parseInt(seasonStr, 10);
    return isNaN(num) ? undefined : num;
  }

  private parseDate(dateStr: string): string | undefined {
    if (!dateStr) return undefined;
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return undefined;
    }
  }
}

// Main Podcast API service
export class PodcastApiService {
  private itunesApi = new ITunesSearchAPI();
  private rssParser = new RSSParser();

  async searchPodcasts(query: string, limit: number = 20): Promise<PodcastSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    try {
      // Search iTunes API
      const results = await this.itunesApi.searchPodcasts(query, limit);
      return results;
    } catch (error) {
      console.error('Podcast search failed:', error);
      throw error;
    }
  }

  async getPodcastFromRSS(rssUrl: string): Promise<{
    podcast: Partial<PodcastSearchResult>;
    episodes: PodcastEpisodeResult[];
  }> {
    return this.rssParser.parseRSSFeed(rssUrl);
  }

  async importPodcast(searchResult: PodcastSearchResult): Promise<{
    podcast: PodcastSearchResult;
    episodes: PodcastEpisodeResult[];
  }> {
    if (!searchResult.rss_url) {
      throw new Error('No RSS feed URL available for this podcast');
    }

    try {
      const { podcast: rssData, episodes } = await this.getPodcastFromRSS(searchResult.rss_url);
      
      // Merge search result with RSS data
      const podcast: PodcastSearchResult = {
        ...searchResult,
        ...rssData,
        id: searchResult.id, // Keep original ID
        total_episodes: episodes.length
      };

      return { podcast, episodes };
    } catch (error) {
      console.error('Failed to import podcast:', error);
      throw new Error('Failed to import podcast episodes');
    }
  }
}

// Export singleton instance
export const podcastApiService = new PodcastApiService();
