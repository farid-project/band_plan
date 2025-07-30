import React, { useState, useEffect } from 'react';
import { X, Music, ExternalLink, Clock, Loader2, Download, Search, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSpotify } from '../hooks/useSpotify';
import { SpotifyPlaylist, SpotifyTrack, spotifyService } from '../services/spotifyService';
import { supabase } from '../lib/supabase';
import { createSetlist, createSong, addSongToSetlist, getSongsByGroup } from '../lib/setlistUtils';
import { Song } from '../types';
import Button from './Button';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onSetlistCreated: () => void;
}

interface PlaylistTrack {
  track: SpotifyTrack;
  isSelected: boolean;
  existsInPool: boolean;
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
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [existingSongs, setExistingSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [customName, setCustomName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadUserPlaylists();
      loadExistingSongs();
    }
  }, [isOpen, isAuthenticated, groupId]);

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

  const loadExistingSongs = async () => {
    try {
      const songs = await getSongsByGroup(groupId);
      setExistingSongs(songs);
    } catch (error) {
      console.error('Error loading existing songs:', error);
    }
  };

  const loadPlaylistTracks = async (playlistId: string) => {
    setLoading(true);
    try {
      const tracks = await spotifyService.getPlaylistTracks(playlistId, 100);
      
      const playlistTracksWithStatus = tracks
        .filter(track => track && track.id)
        .map(track => ({
          track,
          isSelected: true, // Por defecto todas seleccionadas
          existsInPool: existingSongs.some(song => 
            song.title.toLowerCase() === track.name.toLowerCase() &&
            song.artist?.toLowerCase() === track.artists[0]?.name.toLowerCase()
          )
        }));

      setPlaylistTracks(playlistTracksWithStatus);
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
      toast.error('Error al cargar las canciones de la playlist');
    } finally {
      setLoading(false);
    }
  };

  const toggleTrackSelection = (index: number) => {
    setPlaylistTracks(prev => prev.map((track, i) => 
      i === index ? { ...track, isSelected: !track.isSelected } : track
    ));
  };

  const selectAll = () => {
    setPlaylistTracks(prev => prev.map(track => ({ ...track, isSelected: true })));
  };

  const deselectAll = () => {
    setPlaylistTracks(prev => prev.map(track => ({ ...track, isSelected: false })));
  };

  const importPlaylistAsSetlist = async () => {
    if (!selectedPlaylist || !playlistTracks.length) return;
    
    const selectedTracks = playlistTracks.filter(pt => pt.isSelected);
    if (selectedTracks.length === 0) {
      toast.error('Selecciona al menos una canción para importar');
      return;
    }
    
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

      // 2. Process each selected track
      const totalTracks = selectedTracks.length;
      let successfulImports = 0;
      let addedToPool = 0;

      for (let i = 0; i < totalTracks; i++) {
        const playlistTrack = selectedTracks[i];
        const { track } = playlistTrack;
        setImportProgress(Math.round(((i + 1) / totalTracks) * 100));

        try {
          let songId: string;

          // Check if song already exists in pool
          const existingSong = existingSongs.find(song => 
            song.title.toLowerCase() === track.name.toLowerCase() &&
            song.artist?.toLowerCase() === track.artists[0]?.name.toLowerCase()
          );

          if (existingSong) {
            songId = existingSong.id;
          } else {
            // Create new song in pool
            const durationMinutes = Math.round(track.duration_ms / 60000);
            const notes = `Popularidad: ${track.popularity}% | Álbum: ${track.album.name}`;
            
            const songData = {
              title: track.name,
              artist: track.artists.map(a => a.name).join(', '),
              duration_minutes: durationMinutes,
              key: '',
              notes: notes,
              group_id: groupId,
              created_by: user.id
            };
            
            const createdSong = await createSong(songData);
            if (!createdSong) continue;
            
            songId = createdSong.id;
            addedToPool++;
          }

          // Add song to setlist
          await addSongToSetlist(newSetlist.id, songId, i + 1);
          successfulImports++;
        } catch (error) {
          console.error(`Error importing track ${track.name}:`, error);
          // Continue with next track
        }
      }

      setImportProgress(100);
      toast.success(
        `Setlist "${customName}" creado con ${successfulImports}/${totalTracks} canciones. ${addedToPool} nuevas canciones añadidas al pool.`
      );
      
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
    const selectedTracks = playlistTracks.filter(pt => pt.isSelected);
    const totalMs = selectedTracks.reduce((sum, pt) => sum + pt.track.duration_ms, 0);
    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const filteredTracks = playlistTracks.filter(pt =>
    pt.track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pt.track.artists[0]?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = playlistTracks.filter(pt => pt.isSelected).length;

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Importar Playlist de Spotify</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center py-6 sm:py-8">
            <Music className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-sm sm:text-base text-gray-600 mb-4">Necesitas conectar con Spotify para importar playlists</p>
            <Button onClick={onClose} variant="primary" size="sm" className="w-full sm:w-auto">
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
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h2 className="text-lg sm:text-xl font-semibold">Importar Playlist de Spotify</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
            disabled={importing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {!selectedPlaylist ? (
            <div>
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                Selecciona una playlist de Spotify para importar como setlist:
              </p>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-green-500" />
                  <span className="ml-2 text-sm sm:text-base text-gray-600">Cargando playlists...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => setSelectedPlaylist(playlist)}
                      className="border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:border-green-400 hover:bg-green-50 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        {playlist.images && playlist.images.length > 0 ? (
                          <img
                            src={playlist.images[0].url}
                            alt={playlist.name}
                            className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                            <Music className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm sm:text-base text-gray-900 truncate">{playlist.name}</h4>
                          {playlist.description && (
                            <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{playlist.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {playlist.tracks?.total || 0} canciones
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4 sm:mb-6">
                <button
                  onClick={() => {
                    setSelectedPlaylist(null);
                    setPlaylistTracks([]);
                    setCustomName('');
                    setSearchTerm('');
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm sm:text-base self-start"
                  disabled={importing}
                >
                  ← Volver a playlists
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold truncate">{selectedPlaylist.name}</h3>
                  {selectedPlaylist.description && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">{selectedPlaylist.description}</p>
                  )}
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {selectedCount} de {playlistTracks.length} canciones seleccionadas
                  </p>
                </div>
                <a
                  href={selectedPlaylist.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-800 p-1"
                  title="Abrir en Spotify"
                >
                  <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                </a>
              </div>

              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del setlist
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Nombre para el nuevo setlist"
                  disabled={importing}
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-green-500" />
                  <span className="ml-2 text-sm sm:text-base text-gray-600">Cargando canciones...</span>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs sm:text-sm text-gray-600 font-medium">
                        {selectedCount} canciones seleccionadas • {getTotalDuration()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={selectAll}>
                        Seleccionar todo
                      </Button>
                      <Button variant="secondary" size="sm" onClick={deselectAll}>
                        Deseleccionar todo
                      </Button>
                    </div>
                  </div>

                  {/* Buscador */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Buscar canciones..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  
                  <div className="max-h-64 sm:max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50">
                    {filteredTracks.map((playlistTrack, index) => {
                      const originalIndex = playlistTracks.findIndex(pt => pt === playlistTrack);
                      return (
                        <div key={`${playlistTrack.track.id}-${originalIndex}`} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white border-b border-gray-100 last:border-b-0 transition-colors ${
                          playlistTrack.isSelected ? 'bg-green-50 border-green-100' : 'hover:bg-gray-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={playlistTrack.isSelected}
                            onChange={() => toggleTrackSelection(originalIndex)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-xs sm:text-sm text-gray-500 w-6 sm:w-8 text-center">{originalIndex + 1}</span>
                          <img
                            src={playlistTrack.track.album.images[2]?.url || playlistTrack.track.album.images[0]?.url}
                            alt={playlistTrack.track.album.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-xs sm:text-sm text-gray-900 truncate">{playlistTrack.track.name}</h4>
                            <p className="text-xs text-gray-600 truncate">
                              {playlistTrack.track.artists.map(artist => artist.name).join(', ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {playlistTrack.existsInPool && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                En pool
                              </span>
                            )}
                            <div className="flex items-center text-xs sm:text-sm text-gray-500 flex-shrink-0">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDuration(playlistTrack.track.duration_ms)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t p-3 sm:p-6">
          {importing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-600">
                  Importando canciones... {importProgress}%
                </span>
                <span className="text-xs sm:text-sm text-gray-500">
                  {Math.round((importProgress / 100) * selectedCount)}/{selectedCount}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="secondary" onClick={onClose} size="sm" className="w-full sm:w-auto">
                Cancelar
              </Button>
              {selectedPlaylist && selectedCount > 0 && (
                <Button 
                  variant="primary" 
                  onClick={importPlaylistAsSetlist}
                  disabled={!customName.trim()}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Importar {selectedCount} canciones</span>
                  <span className="sm:hidden">Importar ({selectedCount})</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}