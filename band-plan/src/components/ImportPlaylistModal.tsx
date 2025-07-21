import React, { useState, useEffect } from 'react';
import { X, Music, ExternalLink, Clock, Loader2, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSpotify } from '../hooks/useSpotify';
import { SpotifyPlaylist, SpotifyTrack, spotifyService } from '../services/spotifyService';
import { supabase } from '../lib/supabase';
import { createSetlist, addSongToSetlist, createSong } from '../lib/setlistUtils';
import Button from './Button';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onSetlistCreated: () => void;
}

export default function ImportPlaylistModal({
  isOpen,
  onClose,
  groupId,
  onSetlistCreated
}: ImportPlaylistModalProps) {
  const { isAuthenticated } = useSpotify();
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadUserPlaylists();
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    if (selectedPlaylist) {
      setCustomName(selectedPlaylist.name);
      loadPlaylistTracks(selectedPlaylist.id);
    }
  }, [selectedPlaylist]);

  const loadUserPlaylists = async () => {
    setLoading(true);
    try {
      const userPlaylists = await spotifyService.getUserPlaylists(50);
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      toast.error('Error al cargar las playlists');
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylistTracks = async (playlistId: string) => {
    setLoading(true);
    try {
      const tracks = await spotifyService.getPlaylistTracks(playlistId, 100);
      setPlaylistTracks(tracks.filter(track => track && track.id)); // Filter out invalid tracks
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
      toast.error('Error al cargar las canciones de la playlist');
    } finally {
      setLoading(false);
    }
  };

  const importPlaylistAsSetlist = async () => {
    if (!selectedPlaylist || !playlistTracks.length) return;
    
    setImporting(true);
    setImportProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('No se pudo obtener la información del usuario');
        return;
      }

      // 1. Create the setlist
      const setlistData = {
        name: customName || selectedPlaylist.name,
        description: `Importado desde Spotify: ${selectedPlaylist.name}`,
        group_id: groupId,
        created_by: user.id
      };

      const newSetlist = await createSetlist(setlistData);
      if (!newSetlist) {
        toast.error('Error al crear el setlist');
        return;
      }

      // 2. Process each track
      const totalTracks = playlistTracks.length;
      let successfulImports = 0;

      for (let i = 0; i < totalTracks; i++) {
        const track = playlistTracks[i];
        setImportProgress(Math.round(((i + 1) / totalTracks) * 100));

        try {
          // Try to get audio features, but continue without them if it fails
          let audioFeatures = null;
          try {
            audioFeatures = await spotifyService.getAudioFeatures(track.id);
          } catch (audioError) {
            console.warn(`No se pudieron obtener audio features para "${track.name}":`, audioError);
            // Continue without audio features
          }
          
          const durationMinutes = Math.round(track.duration_ms / 60000);
          const key = audioFeatures?.key !== undefined ? 
            ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][audioFeatures.key] : '';
          
          // Create song in database
          const songData = {
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            duration_minutes: durationMinutes,
            key: key,
            notes: `Popularidad: ${track.popularity}% | Álbum: ${track.album.name}${audioFeatures?.tempo ? ` | Tempo: ${Math.round(audioFeatures.tempo)} BPM` : ''}`,
            group_id: groupId,
            created_by: user.id
          };
          
          const createdSong = await createSong(songData);
          if (createdSong) {
            // Add song to setlist
            await addSongToSetlist(newSetlist.id, createdSong.id, i + 1);
            successfulImports++;
          }
        } catch (error) {
          console.error(`Error importing track ${track.name}:`, error);
          // Continue with next track
        }
      }

      setImportProgress(100);
      toast.success(`Setlist "${customName}" creado con ${successfulImports}/${totalTracks} canciones`);
      
      onSetlistCreated();
      onClose();
    } catch (error) {
      console.error('Error importing playlist:', error);
      toast.error('Error al importar la playlist');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const formatDuration = (durationMs: number): string => {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = (): string => {
    const totalMs = playlistTracks.reduce((sum, track) => sum + track.duration_ms, 0);
    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Importar Playlist de Spotify</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center py-8">
            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Necesitas conectar con Spotify para importar playlists</p>
            <Button onClick={onClose} variant="primary">
              Entendido
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Importar Playlist de Spotify</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={importing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {!selectedPlaylist ? (
            <div>
              <p className="text-gray-600 mb-4">
                Selecciona una playlist de Spotify para importar como setlist:
              </p>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600">Cargando playlists...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => setSelectedPlaylist(playlist)}
                      className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {playlist.images && playlist.images.length > 0 ? (
                          <img
                            src={playlist.images[0].url}
                            alt={playlist.name}
                            className="w-16 h-16 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                            <Music className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{playlist.name}</h4>
                          {playlist.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{playlist.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => {
                    setSelectedPlaylist(null);
                    setPlaylistTracks([]);
                    setCustomName('');
                  }}
                  className="text-blue-600 hover:text-blue-800"
                  disabled={importing}
                >
                  ← Volver a playlists
                </button>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{selectedPlaylist.name}</h3>
                  {selectedPlaylist.description && (
                    <p className="text-sm text-gray-600">{selectedPlaylist.description}</p>
                  )}
                </div>
                <a
                  href={selectedPlaylist.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-800"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del setlist
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre para el nuevo setlist"
                  disabled={importing}
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600">Cargando canciones...</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                      {playlistTracks.length} canciones • Duración total: {getTotalDuration()}
                    </p>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    {playlistTracks.map((track, index) => (
                      <div key={track.id} className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0">
                        <span className="text-sm text-gray-500 w-8">{index + 1}</span>
                        <img
                          src={track.album.images[2]?.url || track.album.images[0]?.url}
                          alt={track.album.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{track.name}</h4>
                          <p className="text-sm text-gray-600 truncate">
                            {track.artists.map(artist => artist.name).join(', ')}
                          </p>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(track.duration_ms)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t p-6">
          {importing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Importando canciones... {importProgress}%
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round((importProgress / 100) * playlistTracks.length)}/{playlistTracks.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              {selectedPlaylist && playlistTracks.length > 0 && (
                <Button 
                  variant="primary" 
                  onClick={importPlaylistAsSetlist}
                  disabled={!customName.trim()}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Importar {playlistTracks.length} canciones
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}