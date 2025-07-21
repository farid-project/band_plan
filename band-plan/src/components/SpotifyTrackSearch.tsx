import React, { useState, useEffect, useRef } from 'react';
import { SpotifyTrack } from '../services/spotifyService';
import { useSpotify } from '../hooks/useSpotify';
import { Search, Play, Pause, ExternalLink, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SpotifyTrackSearchProps {
  onTrackSelect: (track: SpotifyTrack) => void;
  placeholder?: string;
  className?: string;
}

const SpotifyTrackSearch: React.FC<SpotifyTrackSearchProps> = ({
  onTrackSelect,
  placeholder = 'Buscar canciones en Spotify...',
  className = '',
}) => {
  const { isAuthenticated, searchTracks, playTrack, pausePlayback, loading: spotifyLoading } = useSpotify();
  const [query, setQuery] = useState<string>('');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  
  // Ensure query is always a string
  const safeQuery = query || '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (safeQuery.length < 2) {
      setTracks([]);
      setShowResults(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(safeQuery);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [safeQuery]);

  const handleSearch = async (searchQuery: string) => {
    if (!isAuthenticated) {
      toast.error('Conecta con Spotify para buscar canciones');
      return;
    }

    setLoading(true);
    try {
      const results = await searchTracks(searchQuery);
      setTracks(results);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching tracks:', error);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSelect = (track: SpotifyTrack) => {
    onTrackSelect(track);
    setQuery('');
    setTracks([]);
    setShowResults(false);
    stopPreview();
  };

  const playPreview = (track: SpotifyTrack) => {
    if (playingPreview === track.id) {
      stopPreview();
      return;
    }

    if (!track.preview_url) {
      toast.error('Preview no disponible para esta canción');
      return;
    }

    stopPreview();
    
    if (previewAudioRef.current) {
      previewAudioRef.current.src = track.preview_url;
      previewAudioRef.current.play();
      setPlayingPreview(track.id);

      previewAudioRef.current.onended = () => {
        setPlayingPreview(null);
      };
    }
  };

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setPlayingPreview(null);
  };

  const playOnSpotify = async (track: SpotifyTrack) => {
    try {
      await playTrack(`spotify:track:${track.id}`);
      setPlayingTrack(track.id);
      toast.success('Reproduciendo en Spotify');
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const formatDuration = (durationMs: number): string => {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getKeyName = (key: number): string => {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return keys[key] || 'Unknown';
  };

  // Loading state
  if (spotifyLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Cargando..."
            disabled
            value=""
            readOnly
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
          />
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Conecta Spotify para buscar canciones..."
            disabled
            value=""
            readOnly
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={safeQuery}
          onChange={(e) => setQuery(e.target.value || '')}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onFocus={() => safeQuery.length >= 2 && setShowResults(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
        )}
      </div>

      {showResults && tracks.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                {/* Album cover */}
                <img
                  src={track.album.images[2]?.url || track.album.images[0]?.url}
                  alt={track.album.name}
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />

                {/* Track info */}
                <div className="flex-1 min-w-0" onClick={() => handleTrackSelect(track)}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{track.name}</h4>
                      <p className="text-sm text-gray-600 truncate">
                        {track.artists.map(artist => artist.name).join(', ')}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{track.album.name}</p>
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 ml-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(track.duration_ms)}
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {track.popularity}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Preview button */}
                  {track.preview_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playPreview(track);
                      }}
                      className="p-1.5 text-gray-400 hover:text-green-500 transition-colors"
                      title="Preview (30s)"
                    >
                      {playingPreview === track.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Play on Spotify button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playOnSpotify(track);
                    }}
                    className="p-1.5 text-gray-400 hover:text-green-500 transition-colors"
                    title="Reproducir en Spotify"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && tracks.length === 0 && !loading && safeQuery.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
          No se encontraron canciones para "{safeQuery}"
        </div>
      )}

      {/* Hidden audio element for previews */}
      <audio ref={previewAudioRef} />
    </div>
  );
};

export default SpotifyTrackSearch;