import React, { useState, useEffect } from 'react';
import { X, Music, Search, Check, Loader2, AlertCircle } from 'lucide-react';
import { SpotifyPlaylist, SpotifyTrack, spotifyService } from '../services/spotifyService';
import { Song } from '../types';
import { getSongsByGroup, createSong } from '../lib/setlistUtils';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import Button from './Button';

interface SpotifyPlaylistSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  setlistId: string;
  onSongsAdded: () => void;
}

interface PlaylistTrack {
  track: SpotifyTrack;
  isSelected: boolean;
  existsInPool: boolean;
  existsInSetlist: boolean;
}

export default function SpotifyPlaylistSyncModal({
  isOpen,
  onClose,
  groupId,
  setlistId,
  onSongsAdded
}: SpotifyPlaylistSyncModalProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [existingSongs, setExistingSongs] = useState<Song[]>([]);
  const [existingSetlistSongs, setExistingSetlistSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
      loadExistingSongs();
    }
  }, [isOpen, groupId, setlistId]);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const userPlaylists = await spotifyService.getUserPlaylists();
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      toast.error('Error al cargar las playlist de Spotify');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingSongs = async () => {
    try {
      const songs = await getSongsByGroup(groupId);
      setExistingSongs(songs);

      // Load existing setlist songs
      const { data: setlistSongs } = await supabase
        .from('setlist_songs')
        .select(`
          song:songs (*)
        `)
        .eq('setlist_id', setlistId);

      if (setlistSongs) {
        setExistingSetlistSongs(setlistSongs.map(item => item.song).filter(Boolean));
      }
    } catch (error) {
      console.error('Error loading existing songs:', error);
    }
  };

  const loadPlaylistTracks = async (playlist: SpotifyPlaylist) => {
    setLoading(true);
    setSelectedPlaylist(playlist);
    try {
      const tracks = await spotifyService.getPlaylistTracks(playlist.id);
      
      const playlistTracksWithStatus = tracks.map(track => ({
        track,
        isSelected: true, // Por defecto todas seleccionadas
        existsInPool: existingSongs.some(song => 
          song.title.toLowerCase() === track.name.toLowerCase() &&
          song.artist?.toLowerCase() === track.artists[0]?.name.toLowerCase()
        ),
        existsInSetlist: existingSetlistSongs.some(song => 
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

  const syncSelectedTracks = async () => {
    const selectedTracks = playlistTracks.filter(pt => pt.isSelected && !pt.existsInSetlist);
    
    if (selectedTracks.length === 0) {
      toast.info('No hay canciones nuevas para añadir al setlist');
      return;
    }

    setSyncing(true);
    try {
      let addedToPool = 0;
      let addedToSetlist = 0;

      for (const playlistTrack of selectedTracks) {
        const { track } = playlistTrack;
        let songId: string;

        // Verificar si ya existe en el pool
        const existingSong = existingSongs.find(song => 
          song.title.toLowerCase() === track.name.toLowerCase() &&
          song.artist?.toLowerCase() === track.artists[0]?.name.toLowerCase()
        );

        if (existingSong) {
          songId = existingSong.id;
        } else {
          // Crear nueva canción en el pool
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) continue;
          
          const newSong = await createSong({
            title: track.name,
            artist: track.artists[0]?.name || '',
            duration_minutes: Math.round(track.duration_ms / 60000),
            key: '', // Spotify no siempre tiene esta info
            notes: `Importado desde Spotify: ${selectedPlaylist?.name}`,
            group_id: groupId,
            created_by: user.id
          });
          songId = newSong.id;
          addedToPool++;
        }

        // Añadir al setlist si no existe
        const { data: existingInSetlist } = await supabase
          .from('setlist_songs')
          .select('id')
          .eq('setlist_id', setlistId)
          .eq('song_id', songId)
          .single();

        if (!existingInSetlist) {
          // Obtener la siguiente posición
          const { data: lastPosition } = await supabase
            .from('setlist_songs')
            .select('position')
            .eq('setlist_id', setlistId)
            .order('position', { ascending: false })
            .limit(1)
            .single();

          const nextPosition = (lastPosition?.position || 0) + 1;

          await supabase
            .from('setlist_songs')
            .insert({
              setlist_id: setlistId,
              song_id: songId,
              position: nextPosition,
              created_by: (await supabase.auth.getUser()).data.user?.id
            });

          addedToSetlist++;
        }
      }

      toast.success(
        `¡Sincronización completada! ${addedToPool} canciones añadidas al pool, ${addedToSetlist} al setlist`
      );
      onSongsAdded();
      onClose();
    } catch (error) {
      console.error('Error syncing tracks:', error);
      toast.error('Error al sincronizar las canciones');
    } finally {
      setSyncing(false);
    }
  };

  const filteredTracks = playlistTracks.filter(pt =>
    pt.track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pt.track.artists[0]?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = playlistTracks.filter(pt => pt.isSelected && !pt.existsInSetlist).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Sincronizar desde Spotify</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {!selectedPlaylist ? (
            // Lista de playlists
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4">Selecciona una playlist</h3>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playlists.map(playlist => (
                    <button
                      key={playlist.id}
                      onClick={() => loadPlaylistTracks(playlist)}
                      className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      {playlist.images?.[0] && (
                        <img
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          className="w-16 h-16 rounded-lg mb-3 object-cover"
                        />
                      )}
                      <h4 className="font-medium truncate">{playlist.name}</h4>
                      <p className="text-sm text-gray-500 truncate">{playlist.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Lista de canciones de la playlist
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <button
                    onClick={() => {
                      setSelectedPlaylist(null);
                      setPlaylistTracks([]);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 text-sm mb-2"
                  >
                    ← Volver a playlists
                  </button>
                  <h3 className="text-lg font-medium">{selectedPlaylist.name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedCount} canciones seleccionadas para añadir
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredTracks.map((playlistTrack, index) => {
                    const originalIndex = playlistTracks.findIndex(pt => pt === playlistTrack);
                    return (
                      <div
                        key={`${playlistTrack.track.id}-${originalIndex}`}
                        className={`flex items-center p-3 rounded-lg border ${
                          playlistTrack.existsInSetlist
                            ? 'bg-gray-100 border-gray-200'
                            : playlistTrack.isSelected
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={playlistTrack.isSelected}
                          onChange={() => toggleTrackSelection(originalIndex)}
                          disabled={playlistTrack.existsInSetlist}
                          className="mr-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        
                        {playlistTrack.track.album.images?.[0] && (
                          <img
                            src={playlistTrack.track.album.images[0].url}
                            alt={playlistTrack.track.album.name}
                            className="w-12 h-12 rounded-lg mr-3 object-cover"
                          />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{playlistTrack.track.name}</h4>
                          <p className="text-sm text-gray-500 truncate">
                            {playlistTrack.track.artists.map(a => a.name).join(', ')}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-3">
                          {playlistTrack.existsInPool && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              En pool
                            </span>
                          )}
                          {playlistTrack.existsInSetlist && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              En setlist
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {Math.round(playlistTrack.track.duration_ms / 60000)}min
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedPlaylist && (
          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={syncSelectedTracks} 
              disabled={selectedCount === 0 || syncing}
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Sincronizando...
                </>
              ) : (
                `Sincronizar ${selectedCount} canciones`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}