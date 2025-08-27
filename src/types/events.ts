// RSS XML response structure
export interface RSSItem {
  title: string;
  description: string;
  pubDate: string;
  link: string;
}

// Transformed interface for internal use
export interface APIMatch {
  id: string;
  slug: string;
  title: string;
  live: boolean;
  category: string;
  date: number; // unix timestamp in milliseconds
  popular: boolean;
  teams?: {
    home?: {
      name: string;
      badge: string;
    };
    away?: {
      name: string;
      badge: string;
    };
  };
  league: string;
  sources: {
    id: string;
    name: string;
    embed: string;
  }[];
}

export interface MatchesResponse {
  matches: APIMatch[];
}

export interface GroupedMatches {
  [date: string]: APIMatch[];
}

export type SportType = 'Football' | 'Basketball' | 'Tennis' | 'Baseball' | 'Hockey' | 'Soccer' | 'Softball' | 'All';

export interface MatchFilters {
  sport: SportType;
  searchQuery: string;
  selectedDate?: string;
  liveOnly?: boolean;
}