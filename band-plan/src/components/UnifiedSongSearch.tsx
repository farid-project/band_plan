import React, { useState, useEffect, useRef } from 'react';
import { SpotifyTrack } from '../services/spotifyService';
import { useSpotify } from '../hooks/useSpotify';
import { Search, Plus, Play, Pause, ExternalLink, Clock, TrendingUp, Loader2, Music } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UnifiedSongSearchProps {
  onSpotifyTrackSelect: (track: SpotifyTrack) => void;
  onManualAdd: () => void;
  placeholder?: string;
  className?: string;
}

const UnifiedSongSearch: React.FC<UnifiedSongSearchProps> = ({
  onSpotifyTrackSelect,
  onManualAdd,
  placeholder = 'Buscar en Spotify o añadir manualmente...',
  className = '',
}) => {
  const { isAuthenticated, searchTracks, playTrack, loading: spotifyLoading } = useSpotify();
  const [query, setQuery] = useState<string>('');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  
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
    if (!isAuthenticated || safeQuery.length < 2) {
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
  }, [safeQuery, isAuthenticated]);

  const handleSearch = async (searchQuery: string) => {
    if (!isAuthenticated) {
      setShowResults(true); // Show manual option
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
      setShowResults(true); // Still show manual option
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSelect = (track: SpotifyTrack) => {
    onSpotifyTrackSelect(track);
    setQuery('');
    setTracks([]);
    setShowResults(false);
    stopPreview();
  };

  const handleManualAdd = () => {
    onManualAdd();
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

  if (spotifyLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cargando..."
            disabled
            value=""
            readOnly
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed text-lg"
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={safeQuery}
          onChange={(e) => setQuery(e.target.value || '')}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg shadow-sm"
          onFocus={() => safeQuery.length >= 1 && setShowResults(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 animate-spin" />
        )}
      </div>

      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {/* Manual add option - always first */}
          <div
            onClick={handleManualAdd}
            className="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100 flex items-center gap-3 bg-blue-25"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">Añadir manualmente</h4>
              <p className="text-sm text-blue-600">
                {safeQuery ? `Crear "${safeQuery}" con formulario` : 'Usar formulario manual'}
              </p>
            </div>
          </div>

          {/* Spotify results */}
          {isAuthenticated && tracks.length > 0 && (
            <>
              <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Resultados de Spotify
                </p>
              </div>
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="p-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
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
            </>
          )}

          {/* No results message */}
          {isAuthenticated && tracks.length === 0 && !loading && safeQuery.length >= 2 && (
            <div className="p-4 text-center text-gray-500 border-b border-gray-100">
              <Music className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p>No se encontraron canciones en Spotify para "{safeQuery}"</p>
            </div>
          )}

          {/* Not authenticated message */}
          {!isAuthenticated && safeQuery.length >= 2 && (
            <div className="p-4 text-center text-gray-500 border-b border-gray-100">
              <Music className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p>Conecta con Spotify para buscar canciones</p>
            </div>
          )}
        </div>
      )}

      {/* Hidden audio element for previews */}
      <audio ref={previewAudioRef} />
    </div>
  );
};

export default UnifiedSongSearch;