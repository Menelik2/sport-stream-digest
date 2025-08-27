import { APIMatch, RSSItem, SportType } from '@/types/events';

const API_BASE_URL = 'https://cdn.livetv860.me/rss/upcoming_en.xml';

// CORS proxy for handling potential CORS issues
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

class ApiService {
  private cache: Map<string, { data: APIMatch[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async fetchMatches(sport?: SportType, type: 'all' | 'live' | 'today' | 'top-today' = 'all'): Promise<APIMatch[]> {
    const cacheKey = `matches-${sport || 'all'}-${type}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // First try the mobile site which has direct streaming links
      const mobileResponse = await fetch('https://m.livetv.sx/en/', {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        },
      });

      let matches: APIMatch[] = [];

      if (mobileResponse.ok) {
        const mobileHtml = await mobileResponse.text();
        matches = this.parseMobileHTML(mobileHtml, sport, type);
      }

      // If no matches from mobile site, fallback to RSS
      if (matches.length === 0) {
        const rssResponse = await fetch(API_BASE_URL, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
          },
        });

        if (rssResponse.ok) {
          const xmlText = await rssResponse.text();
          matches = this.parseXMLAndTransform(xmlText, sport, type);
        }
      }
      
      // Cache the successful response
      this.cache.set(cacheKey, { data: matches, timestamp: Date.now() });
      return matches;
      
    } catch (error) {
      console.warn('Primary API calls failed, trying with CORS proxy...', error);
      
      try {
        const response = await fetch(`${PROXY_URL}${encodeURIComponent('https://m.livetv.sx/en/')}`);
        const html = await response.text();
        const matches = this.parseMobileHTML(html, sport, type);
        
        if (matches.length > 0) {
          this.cache.set(cacheKey, { data: matches, timestamp: Date.now() });
          return matches;
        }

        // Fallback to RSS via proxy
        const rssResponse = await fetch(`${PROXY_URL}${encodeURIComponent(API_BASE_URL)}`);
        const xmlText = await rssResponse.text();
        const rssMatches = this.parseXMLAndTransform(xmlText, sport, type);
        
        this.cache.set(cacheKey, { data: rssMatches, timestamp: Date.now() });
        return rssMatches;
      } catch (proxyError) {
        console.warn('Proxy calls also failed, using mock data...', proxyError);
        return this.getMockData();
      }
    }
  }

  private parseMobileHTML(html: string, sport?: SportType, type?: string): APIMatch[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const eventItems = doc.querySelectorAll('ul.broadcasts li');
    
    const allMatches: APIMatch[] = [];
    const now = Date.now();

    eventItems.forEach((item, index) => {
      const titleLink = item.querySelector('.title a');
      const noteElement = item.querySelector('.note');
      const logoElement = item.querySelector('.logo img');
      
      if (!titleLink || !noteElement) return;

      const title = titleLink.textContent?.trim() || '';
      const streamUrl = titleLink.getAttribute('href') || '';
      const noteText = noteElement.textContent?.trim() || '';
      const logoSrc = logoElement?.getAttribute('src') || '';
      
      // Extract event info from note text
      const dateMatch = noteText.match(/(\d{1,2})\s+(\w+)\s+at\s+(\d{1,2}:\d{2})/);
      const categoryMatch = noteText.match(/\(([^)]+)\)/);
      const isLive = noteText.includes('Live');
      
      // Parse date
      let eventTime = now;
      if (dateMatch) {
        const [, day, month, time] = dateMatch;
        const currentYear = new Date().getFullYear();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase().startsWith(month.toLowerCase()));
        
        if (monthIndex !== -1) {
          const [hours, minutes] = time.split(':').map(Number);
          const eventDate = new Date(currentYear, monthIndex, parseInt(day), hours, minutes);
          eventTime = eventDate.getTime();
        }
      }
      
      // Extract sport from category or logo
      const category = this.extractSportFromMobileContent(categoryMatch?.[1] || '', logoSrc);
      
      // Extract teams from title
      const teams = this.extractTeamsFromTitle(title);
      
      // Extract stream parameters from URL
      const streamParams = this.extractStreamParamsFromURL(streamUrl);
      
      const match: APIMatch = {
        id: `mobile-${index}`,
        slug: this.createSlug(title),
        title: title,
        live: isLive,
        category: category,
        date: eventTime,
        popular: ['Football', 'Basketball', 'Baseball', 'Soccer', 'Tennis'].includes(category),
        league: categoryMatch?.[1]?.replace(/\./g, '') || 'Live Event',
        teams: teams,
        sources: [{
          id: `mobile-stream-${index}`,
          name: 'Live Stream',
          embed: streamUrl,
          streamParams: streamParams
        }],
      };

      allMatches.push(match);
    });

    // Apply filters and return
    return this.applyFilters(allMatches, sport, type);
  }

  private extractSportFromMobileContent(category: string, logoSrc: string): string {
    const lowerCategory = category.toLowerCase();
    const logoName = logoSrc.split('/').pop()?.toLowerCase() || '';
    
    if (lowerCategory.includes('football') || logoName.includes('football')) return 'Football';
    if (lowerCategory.includes('basketball') || logoName.includes('basket')) return 'Basketball';
    if (lowerCategory.includes('baseball') || logoName.includes('baseball')) return 'Baseball';
    if (lowerCategory.includes('soccer') || logoName.includes('soccer')) return 'Soccer';
    if (lowerCategory.includes('tennis') || logoName.includes('tennis') || logoName.includes('usopen')) return 'Tennis';
    if (lowerCategory.includes('hockey') || logoName.includes('hockey')) return 'Hockey';
    if (lowerCategory.includes('snooker') || logoName.includes('snooker')) return 'Snooker';
    if (lowerCategory.includes('badminton') || logoName.includes('badmin')) return 'Badminton';
    if (lowerCategory.includes('volleyball') || logoName.includes('volley')) return 'Volleyball';
    if (lowerCategory.includes('boxing') || logoName.includes('boxing')) return 'Boxing';
    
    return 'Other';
  }

  private extractStreamParamsFromURL(url: string): any {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      return {
        t: params.get('t') || '',
        c: params.get('c') || '',
        eid: params.get('eid') || '',
        lid: params.get('lid') || '',
        lang: params.get('lang') || 'en',
        ci: params.get('ci') || '',
        si: params.get('si') || ''
      };
    } catch {
      return {};
    }
  }

  private applyFilters(matches: APIMatch[], sport?: SportType, type?: string): APIMatch[] {
    let filteredMatches = matches;

    if (sport && sport !== 'All') {
      filteredMatches = filteredMatches.filter(match => match.category === sport);
    }

    if (type === 'live') {
      filteredMatches = filteredMatches.filter(match => match.live);
    } else if (type === 'today') {
      const today = new Date().toDateString();
      filteredMatches = filteredMatches.filter(match => 
        new Date(match.date).toDateString() === today
      );
    } else if (type === 'top-today') {
      const today = new Date().toDateString();
      filteredMatches = filteredMatches.filter(match => 
        new Date(match.date).toDateString() === today && match.popular
      );
    }

    return filteredMatches.sort((a, b) => a.date - b.date);
  }

  private parseXMLAndTransform(xmlText: string, sport?: SportType, type?: string): APIMatch[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');
    
    const allMatches: APIMatch[] = [];
    const now = Date.now();

    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      
      // Parse the date
      const eventTime = pubDate ? new Date(pubDate).getTime() : now;
      const isLive = Math.abs(now - eventTime) < 3 * 60 * 60 * 1000; // Within 3 hours
      
      // Extract sport/category from description or title
      const category = this.extractSportFromContent(title + ' ' + description);
      
      // Extract teams from title
      const teams = this.extractTeamsFromTitle(title);
      
      // Extract streaming parameters from description
      const sources = this.extractStreamingSources(description, index);
      
      const match: APIMatch = {
        id: `rss-${index}`,
        slug: this.createSlug(title),
        title: title,
        live: isLive,
        category: category,
        date: eventTime,
        popular: ['Football', 'Basketball', 'Baseball', 'Soccer'].includes(category),
        league: this.extractLeagueFromContent(description),
        teams: teams,
        sources: sources.length > 0 ? sources : [{
          id: `${title}-${index}`,
          name: 'Live Stream',
          embed: link,
        }],
      };

      allMatches.push(match);
    });

    // Apply filters
    let filteredMatches = allMatches;

    if (sport && sport !== 'All') {
      filteredMatches = filteredMatches.filter(match => match.category === sport);
    }

    if (type === 'live') {
      filteredMatches = filteredMatches.filter(match => match.live);
    } else if (type === 'today') {
      const today = new Date().toDateString();
      filteredMatches = filteredMatches.filter(match => 
        new Date(match.date).toDateString() === today
      );
    } else if (type === 'top-today') {
      const today = new Date().toDateString();
      filteredMatches = filteredMatches.filter(match => 
        new Date(match.date).toDateString() === today && match.popular
      );
    }

    return filteredMatches.sort((a, b) => a.date - b.date);
  }

  private createSlug(match: string): string {
    return match.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  private extractSportFromContent(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('football') || lowerContent.includes('nfl')) return 'Football';
    if (lowerContent.includes('basketball') || lowerContent.includes('nba')) return 'Basketball';
    if (lowerContent.includes('baseball') || lowerContent.includes('mlb')) return 'Baseball';
    if (lowerContent.includes('soccer') || lowerContent.includes('fifa')) return 'Soccer';
    if (lowerContent.includes('tennis')) return 'Tennis';
    if (lowerContent.includes('hockey') || lowerContent.includes('nhl')) return 'Hockey';
    if (lowerContent.includes('softball')) return 'Softball';
    
    return 'Other';
  }

  private extractLeagueFromContent(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('nfl')) return 'NFL';
    if (lowerContent.includes('nba')) return 'NBA';
    if (lowerContent.includes('mlb')) return 'MLB';
    if (lowerContent.includes('nhl')) return 'NHL';
    if (lowerContent.includes('fifa')) return 'FIFA';
    if (lowerContent.includes('atp')) return 'ATP';
    
    // Try to extract league from parentheses or brackets
    const leagueMatch = content.match(/\(([^)]+)\)|\[([^\]]+)\]/);
    if (leagueMatch) {
      return leagueMatch[1] || leagueMatch[2] || 'Live Event';
    }
    
    return 'Live Event';
  }

  private extractTeamsFromTitle(title: string): { home?: { name: string; badge: string }; away?: { name: string; badge: string } } | undefined {
    // Common separators for team names
    const separators = [' vs ', ' v ', ' @ ', ' - '];
    
    for (const separator of separators) {
      if (title.includes(separator)) {
        const [away, home] = title.split(separator).map(team => team.trim());
        return {
          home: { name: home, badge: '/logos/default.png' },
          away: { name: away, badge: '/logos/default.png' }
        };
      }
    }
    
    return undefined;
  }

  private extractStreamingSources(description: string, index: number): Array<{id: string; name: string; embed: string; streamParams?: any}> {
    const sources: Array<{id: string; name: string; embed: string; streamParams?: any}> = [];
    
    // Parse streaming links from description HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(description, 'text/html');
    const links = doc.querySelectorAll('a[onclick*="show_webplayer"]');
    
    links.forEach((link, linkIndex) => {
      const onclick = link.getAttribute('onclick') || '';
      const href = link.getAttribute('href') || '';
      
      // Extract parameters from onclick function call
      const showWebplayerMatch = onclick.match(/show_webplayer\('([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']+)'\)/);
      
      if (showWebplayerMatch) {
        const [, streamType, channelId, eventId, linkId, categoryId, sourceIndex, lang] = showWebplayerMatch;
        
        const streamParams = {
          t: streamType,
          c: channelId,
          lang: lang,
          eid: eventId,
          lid: linkId,
          ci: categoryId,
          si: sourceIndex
        };
        
        // Construct webplayer URL
        const webplayerUrl = `https://cdn.livetv860.me/webplayer2.php?${new URLSearchParams(streamParams).toString()}`;
        
        sources.push({
          id: `stream-${index}-${linkIndex}`,
          name: link.textContent?.trim() || `Stream ${linkIndex + 1}`,
          embed: webplayerUrl,
          streamParams: streamParams
        });
      }
    });
    
    return sources;
  }

  async fetchStreamData(streamParams: any): Promise<{streamUrl?: string; error?: string}> {
    try {
      // Use the iframe-optimized URL format for better embedding
      const iframeUrl = `https://cdn.livetv860.me/export/webplayer.iframe.php?t=${streamParams.t}&c=${streamParams.c}&eid=${streamParams.eid}&lid=${streamParams.lid}&lang=${streamParams.lang}&m&dmn=`;
      
      return { streamUrl: iframeUrl };
      
    } catch (error) {
      console.error('Failed to generate stream URL:', error);
      return { error: 'Failed to generate stream URL' };
    }
  }

  async fetchSports(): Promise<SportType[]> {
    // Extract sports from cached events data or use defaults
    const allMatches = await this.fetchMatches();
    const uniqueSports = [...new Set(allMatches.map(match => match.category as SportType))];
    
    if (uniqueSports.length > 0) {
      return uniqueSports.sort();
    }
    
    return ['Football', 'Basketball', 'Tennis', 'Baseball', 'Hockey', 'Soccer', 'Softball'];
  }

  private getMockData(): APIMatch[] {
    const now = Date.now();
    
    return [
      {
        id: '1',
        slug: 'chiefs-vs-bills',
        title: 'Kansas City Chiefs vs Buffalo Bills',
        live: true,
        category: 'football',
        date: now + 3600000, // 1 hour from now
        popular: true,
        teams: {
          home: { name: 'Kansas City Chiefs', badge: '/logos/chiefs.png' },
          away: { name: 'Buffalo Bills', badge: '/logos/bills.png' }
        },
        league: 'NFL',
        sources: [
          { id: '1', name: 'Stream 1', embed: 'https://example.com/stream1' },
          { id: '2', name: 'Stream 2', embed: 'https://example.com/stream2' }
        ]
      },
      {
        id: '2',
        slug: 'lakers-vs-celtics',
        title: 'Los Angeles Lakers vs Boston Celtics',
        live: false,
        category: 'basketball',
        date: now + 7200000, // 2 hours from now
        popular: true,
        teams: {
          home: { name: 'Los Angeles Lakers', badge: '/logos/lakers.png' },
          away: { name: 'Boston Celtics', badge: '/logos/celtics.png' }
        },
        league: 'NBA',
        sources: [
          { id: '3', name: 'Stream 3', embed: 'https://example.com/stream3' }
        ]
      },
      {
        id: '3',
        slug: 'djokovic-vs-alcaraz',
        title: 'Novak Djokovic vs Carlos Alcaraz',
        live: false,
        category: 'tennis',
        date: now + 86400000 + 3600000, // Tomorrow + 1 hour
        popular: false,
        league: 'ATP US Open',
        sources: [
          { id: '4', name: 'Stream 4', embed: 'https://example.com/stream4' }
        ]
      }
    ];
  }

  // Clear cache manually if needed
  clearCache(): void {
    this.cache.clear();
  }
}

export const apiService = new ApiService();