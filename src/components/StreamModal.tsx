import { useState, useEffect } from 'react';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api';

interface StreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamUrl: string;
  matchTitle: string;
  tournament: string;
  sport: string;
  sourceName?: string;
  quality?: string;
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

export function StreamModal({
  isOpen,
  onClose,
  streamUrl,
  matchTitle,
  tournament,
  sport,
  sourceName,
  quality,
  streamParams,
}: StreamModalProps) {
  const [iframeError, setIframeError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actualStreamUrl, setActualStreamUrl] = useState(streamUrl);
  const [fetchingStream, setFetchingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Fetch actual stream URL when streamParams are present
  useEffect(() => {
    const fetchStreamUrl = async () => {
      if (!streamParams || !isOpen) return;
      
      setFetchingStream(true);
      setStreamError(null);
      
      try {
        const result = await apiService.fetchStreamData(streamParams);
        
        if (result.streamUrl) {
          setActualStreamUrl(result.streamUrl);
        } else if (result.error) {
          setStreamError(result.error);
          setActualStreamUrl(streamUrl); // Fallback to original URL
        }
      } catch (error) {
        setStreamError('Failed to load stream');
        setActualStreamUrl(streamUrl); // Fallback to original URL
      } finally {
        setFetchingStream(false);
      }
    };

    if (isOpen) {
      fetchStreamUrl();
    }
  }, [streamParams, isOpen, streamUrl]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setIframeError(true);
  };

  const handleExternalOpen = () => {
    window.open(actualStreamUrl, '_blank', 'noopener,noreferrer');
  };

  const getSportColor = (sport: string) => {
    const colors = {
      'Football': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Basketball': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Baseball': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Tennis': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Hockey': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'Soccer': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Equestrian': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    return colors[sport as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col gradient-card border-border/50">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold text-foreground truncate mb-2">
                {matchTitle}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('text-xs font-medium border', getSportColor(sport))}>
                  {sport}
                </Badge>
                {sourceName && (
                  <Badge variant="secondary" className="text-xs">
                    {sourceName}
                  </Badge>
                )}
                {quality && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {quality}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground truncate">{tournament}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExternalOpen}
                className="border-border/50 hover:bg-muted/50"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open External
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="hover:bg-muted/50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden rounded-lg bg-muted/30">
          {fetchingStream ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="p-4 gradient-primary rounded-full mb-4 shadow-primary mx-auto w-fit">
                  <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-muted-foreground">Fetching stream data...</p>
              </div>
            </div>
          ) : streamError ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <Alert className="max-w-md border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {streamError}
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <p className="text-muted-foreground">
                  Try using the original stream link:
                </p>
                <Button
                  onClick={handleExternalOpen}
                  className="gradient-primary shadow-primary text-primary-foreground border-0"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Original Link
                </Button>
              </div>
            </div>
          ) : iframeError ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <Alert className="max-w-md border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Unable to load the stream in embedded mode. This may be due to content restrictions.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <p className="text-muted-foreground">
                  Try one of these alternatives:
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleExternalOpen}
                    className="gradient-primary shadow-primary text-primary-foreground border-0"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in New Tab
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIframeError(false);
                      setIsLoading(true);
                    }}
                    className="border-border/50 hover:bg-muted/50"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                  <div className="text-center">
                    <div className="p-4 gradient-primary rounded-full mb-4 shadow-primary mx-auto w-fit">
                      <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-muted-foreground">Loading stream...</p>
                  </div>
                </div>
              )}
              
              <iframe
                src={actualStreamUrl}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title={`${matchTitle} - ${tournament}`}
              />
            </>
          )}
        </div>

        <div className="flex-shrink-0 pt-4 border-t border-border/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Stream provided by TopEmbed</span>
            <span>Watch responsibly and respect broadcasting rights</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}