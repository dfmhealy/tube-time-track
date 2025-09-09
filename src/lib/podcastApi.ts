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
      // Try multiple CORS proxies for better reliability
      const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${rssUrl}`,
        // Direct fetch as last resort (may fail due to CORS)
        rssUrl
      ];
      
      let response: Response | null = null;
      let lastError: Error | null = null;
      
      // Try each proxy with shorter timeout
      let successfulProxyUrl = '';
      for (let i = 0; i < proxies.length; i++) {
        const proxyUrl = proxies[i];
        const isDirect = i === proxies.length - 1; // Last one is direct URL
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per proxy
          
          const fetchOptions: RequestInit = { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
          };
          
          // Add mode for direct requests
          if (isDirect) {
            fetchOptions.mode = 'cors';
          }
          
          response = await fetch(proxyUrl, fetchOptions);
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            successfulProxyUrl = proxyUrl;
            console.log(`RSS feed loaded successfully via: ${isDirect ? 'direct' : 'proxy'}`);
            break;
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`${isDirect ? 'Direct fetch' : 'Proxy'} ${proxyUrl} failed:`, error);
          continue;
        }
      }
      
      if (!response || !response.ok) {
        throw lastError || new Error('All RSS proxies failed');
      }

      let xmlContent: string;
      
      // Handle different response formats based on proxy used
      const isAllOrigins = successfulProxyUrl.includes('allorigins.win');
      const contentType = response.headers.get('content-type') || '';
      
      if (isAllOrigins && contentType.includes('application/json')) {
        // AllOrigins returns JSON with contents field
        const data = await response.json();
        xmlContent = data.contents || data;
        
        if (typeof xmlContent !== 'string') {
          throw new Error('Proxy returned invalid XML content');
        }
      } else {
        // Direct XML response from other proxies or direct fetch
        xmlContent = await response.text();
      }
      
      // Validate we have XML content
      if (!xmlContent || !xmlContent.trim().startsWith('<')) {
        throw new Error('Response does not contain valid XML');
      }
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

      // Check for XML parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parsing error:', parseError.textContent);
        throw new Error('RSS feed contains invalid XML');
      }

      // Parse podcast info
      const channel = xmlDoc.querySelector('channel');
      if (!channel) {
        // Try alternative RSS formats
        const rss = xmlDoc.querySelector('rss channel') || 
                   xmlDoc.querySelector('feed') || // Atom feed
                   xmlDoc.querySelector('rdf\\:RDF channel'); // RDF format
        
        if (!rss) {
          console.error('RSS structure:', xmlDoc.documentElement?.tagName);
          throw new Error('Unsupported RSS/feed format - no channel found');
        }
        
        // Use the found element as channel
        const actualChannel = rss.tagName === 'channel' ? rss : rss.querySelector('channel');
        if (!actualChannel) {
          throw new Error('Invalid RSS feed structure');
        }
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

      // Parse episodes (limit to first 100 for performance)
      const items = Array.from(xmlDoc.querySelectorAll('item')).slice(0, 100);
      const episodes: PodcastEpisodeResult[] = items.map((item, index) => {
        const enclosure = item.querySelector('enclosure');
        const audioUrl = enclosure?.getAttribute('url') || '';
        
        // Skip episodes without audio URLs
        if (!audioUrl) return null;
        
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
      }).filter(episode => episode !== null) as PodcastEpisodeResult[];

      return { podcast, episodes };
    } catch (error) {
      console.error('RSS parsing error:', error);
      throw new Error('Failed to parse RSS feed');
    }
  }

  private getTextContent(element: Element, selector: string): string | null {
    try {
      // Handle namespaced elements by trying multiple approaches
      let selected: Element | null = null;
      
      // First try the selector as-is
      try {
        selected = element.querySelector(selector);
      } catch (e) {
        // If selector fails, try without namespace prefix
        const withoutNamespace = selector.includes(':') ? selector.split(':')[1] : selector;
        try {
          selected = element.querySelector(withoutNamespace);
        } catch (e2) {
          // Try getElementsByTagName for namespaced elements
          const tagName = selector.replace('\\:', ':');
          const elements = element.getElementsByTagName(tagName);
          selected = elements.length > 0 ? elements[0] : null;
        }
      }
      
      return selected?.textContent?.trim() || null;
    } catch (error) {
      console.warn(`Failed to get text content for selector: ${selector}`, error);
      return null;
    }
  }

  private getImageUrl(element: Element): string | null {
    // Try iTunes image with multiple approaches
    try {
      const itunesImage = element.querySelector('itunes\\:image');
      if (itunesImage) {
        return itunesImage.getAttribute('href');
      }
    } catch (e) {
      // Fallback for invalid selector
    }

    // Try getElementsByTagName for namespaced elements
    try {
      const itunesImages = element.getElementsByTagName('itunes:image');
      if (itunesImages.length > 0) {
        return itunesImages[0].getAttribute('href');
      }
    } catch (e) {
      // Continue to next approach
    }

    // Try regular image
    try {
      const image = element.querySelector('image url');
      if (image) {
        return image.textContent?.trim() || null;
      }
    } catch (e) {
      // Continue to next approach
    }

    // Try image element directly
    try {
      const image = element.querySelector('image');
      if (image) {
        const url = image.querySelector('url');
        return url?.textContent?.trim() || null;
      }
    } catch (e) {
      // No more fallbacks
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
      // Add timeout wrapper for the entire import process
      const importWithTimeout = async () => {
        const { podcast: rssData, episodes } = await this.getPodcastFromRSS(searchResult.rss_url!);
        
        // Merge search result with RSS data
        const podcast: PodcastSearchResult = {
          ...searchResult,
          ...rssData,
          id: searchResult.id, // Keep original ID
          total_episodes: episodes.length
        };

        return { podcast, episodes };
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      try {
        const result = await importWithTimeout();
        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      console.error('Failed to import podcast:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('RSS feed took too long to load - please try again');
        }
        if (error.message.includes('All RSS proxies failed')) {
          throw new Error('Unable to access RSS feed - it may be temporarily unavailable');
        }
        if (error.message.includes('Invalid RSS feed format')) {
          throw new Error('RSS feed format is not supported');
        }
      }
      
      throw new Error('Failed to import podcast - please check the RSS feed URL');
    }
  }
}

// Export singleton instance
export const podcastApiService = new PodcastApiService();
