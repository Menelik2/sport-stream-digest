import { useState } from 'react';
import { format } from 'date-fns';
import { Clock, Play, Users, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StreamModal } from './StreamModal';
import { APIMatch } from '@/types/events';
import { getBestStreams } from '@/utils/streamUtils';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  match: APIMatch;
  className?: string;
}

export function MatchCard({ match, className }: MatchCardProps) {
  const [streamModal, setStreamModal] = useState<{
    isOpen: boolean;
    streamUrl: string;
    sourceName?: string;
    quality?: string;
    streamParams?: any;
  }>({
    isOpen: false,
    streamUrl: '',
  });

  const matchDate = new Date(match.date);
  const now = new Date();
  const isLive = match.live;
  const isUpcoming = matchDate > now && matchDate.getTime() - now.getTime() < 60 * 60 * 1000; // Upcoming if within 1 hour
  
  const bestStreams = getBestStreams(match.sources);

  const getSportColor = (sport: string) => {
    const colors = {
      'football': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'basketball': 'bg-red-500/20 text-red-400 border-red-500/30',
      'baseball': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'tennis': 'bg-green-500/20 text-green-400 border-green-500/30',
      'hockey': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'soccer': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return colors[sport as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const handleStreamClick = (embedUrl: string, sourceName?: string, quality?: string, streamParams?: any) => {
    setStreamModal({
      isOpen: true,
      streamUrl: embedUrl,
      sourceName,
      quality,
      streamParams,
    });
  };

  const closeStreamModal = () => {
    setStreamModal({
      isOpen: false,
      streamUrl: '',
      sourceName: undefined,
      quality: undefined,
      streamParams: undefined,
    });
  };

  return (
    <>
      <Card className={cn(
        'bg-gray-900/90 border-2 border-gray-800 rounded-xl overflow-hidden transition-all duration-300 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/20',
        isLive && 'border-red-500/80 shadow-lg shadow-red-500/30',
        isUpcoming && 'border-orange-500/60 shadow-lg shadow-orange-500/20',
        className
      )}>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Match Title */}
            <div>
              <h3 className="text-white text-xl font-bold leading-tight mb-2">
                {match.title}
              </h3>
              {match.teams && (
                <div className="flex items-center justify-center gap-3 text-gray-300 text-sm">
                  {match.teams.home && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={match.teams.home.badge} 
                        alt="" 
                        className="w-4 h-4" 
                        onError={(e) => e.currentTarget.style.display = 'none'} 
                      />
                      <span className="text-blue-400">{match.teams.home.name}</span>
                    </div>
                  )}
                  <span className="text-gray-500 font-medium">vs</span>
                  {match.teams.away && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={match.teams.away.badge} 
                        alt="" 
                        className="w-4 h-4" 
                        onError={(e) => e.currentTarget.style.display = 'none'} 
                      />
                      <span className="text-blue-400">{match.teams.away.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn(
                'text-xs font-medium px-3 py-1 rounded-full',
                getSportColor(match.category)
              )}>
                {match.category.charAt(0).toUpperCase() + match.category.slice(1)}
              </Badge>
              
              {isLive && (
                <Badge className="bg-red-600 text-white border-0 px-3 py-1 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full mr-1" />
                  LIVE
                </Badge>
              )}
              
              {isUpcoming && (
                <Badge className="bg-green-600 text-white border-0 px-3 py-1 rounded-full">
                  Starting Soon
                </Badge>
              )}
              
              {match.popular && (
                <Badge className="bg-yellow-600 text-white border-0 px-3 py-1 rounded-full">
                  Popular
                </Badge>
              )}
            </div>

            {/* League and Time Info */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                <span>{match.league}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{format(matchDate, 'MMM d, h:mm a')}</span>
              </div>
            </div>

            {/* Stream Count */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              <span>{bestStreams.length} stream{bestStreams.length !== 1 ? 's' : ''} available</span>
            </div>

            {/* Stream Buttons */}
            <div className="flex gap-3 mt-6">
              {bestStreams.slice(0, 2).map((source, index) => (
                <Button
                  key={source.id}
                  onClick={() => handleStreamClick(source.embed, source.name, source.quality, source.streamParams)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0 py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <div className="flex flex-col items-start">
                    <span>{source.name || `Stream ${index + 1}`}</span>
                    {source.quality && (
                      <span className="text-xs text-red-200">{source.quality}</span>
                    )}
                  </div>
                </Button>
              ))}
              {bestStreams.length > 2 && (
                <Button
                  onClick={() => handleStreamClick(bestStreams[2].embed, bestStreams[2].name, bestStreams[2].quality, bestStreams[2].streamParams)}
                  variant="outline"
                  className="px-4 py-3 border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 rounded-lg"
                >
                  +{bestStreams.length - 2}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <StreamModal
        isOpen={streamModal.isOpen}
        onClose={closeStreamModal}
        streamUrl={streamModal.streamUrl}
        matchTitle={match.title}
        tournament={match.league}
        sport={match.category}
        sourceName={streamModal.sourceName}
        quality={streamModal.quality}
        streamParams={streamModal.streamParams}
      />
    </>
  );
}