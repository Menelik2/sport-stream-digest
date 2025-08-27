import { APIMatch } from '@/types/events';

export interface PrioritizedSource {
  id: string;
  name: string;
  embed: string;
  quality?: string;
  priority: number;
  streamParams?: {
    t: string;
    c: string;
    lang: string;
    eid: string;
    lid: string;
    ci: string;
    si: string;
  };
}

export function prioritizeStreams(sources: APIMatch['sources']): PrioritizedSource[] {
  return sources.map(source => {
    const sourceName = source.name.toLowerCase();
    let priority = 5; // default priority
    let quality = '';

    // Prioritize "ex" channels (highest priority)
    if (sourceName.includes('ex')) {
      priority = 1;
      quality = 'SD 600kbps';
    }
    // Deprioritize TSN channels (lowest priority)
    else if (sourceName.includes('tsn')) {
      priority = 10;
    }
    // Other channels get medium priority
    else {
      priority = 5;
    }

    return {
      ...source,
      quality,
      priority
    };
  }).sort((a, b) => a.priority - b.priority);
}

export function filterStreams(prioritizedSources: PrioritizedSource[]): PrioritizedSource[] {
  // If there are multiple streams and TSN channels exist alongside others, filter out TSN
  const nonTsnSources = prioritizedSources.filter(source => 
    !source.name.toLowerCase().includes('tsn')
  );
  
  // Only filter out TSN if there are other options available
  if (nonTsnSources.length > 0 && nonTsnSources.length < prioritizedSources.length) {
    return nonTsnSources;
  }
  
  return prioritizedSources;
}

export function getBestStreams(sources: APIMatch['sources']): PrioritizedSource[] {
  const prioritized = prioritizeStreams(sources);
  return filterStreams(prioritized);
}
