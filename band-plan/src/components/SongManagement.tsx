import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { getSongsByGroup, createSong, updateSong, deleteSong } from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';
import { supabase } from '../lib/supabase';
import { Search, Filter, X, Plus } from 'lucide-react';
import SpotifyConnect from './SpotifyConnect';
import UnifiedSongSearch from './UnifiedSongSearch';
import { SpotifyTrack } from '../services/spotifyService';
import { useSpotify } from '../hooks/useSpotify';

interface DeezerTrack {
  id: number;
  title: string;
  artist: {
    name: string;
  };
  album: {
    title: string;
    cover: string;
    cover_small: string;
    cover_medium: string;
  };
  duration: number;
  preview: string;
  link: string;
}

interface SongManagementProps {
  groupId: string;
  canManageSongs?: boolean;
}

interface SongFormData {
  title: string;
  artist: string;
  duration_minutes: string;
  key: string;
  notes: string;
}

const initialFormData: SongFormData = {
  title: '',
  artist: '',
  duration_minutes: '',
  key: '',
  notes: ''
};

const KEYS = [
  '', // Para opción vacía
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb',
  'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
];


export default function SongManagement({ groupId, canManageSongs = true }: SongManagementProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [formData, setFormData] = useState<SongFormData>(initialFormData);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [editingCell, setEditingCell] = useState<{ songId: string; field: string } | null>(null);
  const [inlineValue, setInlineValue] = useState<string>('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  
  // Search and filter state
  const [searchText, setSearchText] = useState('');
  const [filterKey, setFilterKey] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // Spotify integration
  const { isAuthenticated } = useSpotify();


  // Filter songs based on search criteria
  const filteredSongs = songs.filter(song => {
    // Text search (title and artist)
    const searchMatch = !searchText || 
      song.title.toLowerCase().includes(searchText.toLowerCase()) ||
      song.artist?.toLowerCase().includes(searchText.toLowerCase());
    
    // Key filter
    const keyMatch = !filterKey || song.key === filterKey;
    
    // Type filter
    const typeMatch = !filterType || song.type === filterType;
    
    return searchMatch && keyMatch && typeMatch;
  });

  // Get unique keys for filter dropdown
  const uniqueKeys = [...new Set(songs.map(song => song.key).filter(Boolean))].sort();

  useEffect(() => {
    loadSongs();
  }, [groupId]);


  const loadSongs = async () => {
    setLoading(true);
    const songsData = await getSongsByGroup(groupId);
    if (songsData) {
      setSongs(songsData);
    }
    setLoading(false);
  };

  const handleSpotifyTrackSelect = async (track: SpotifyTrack) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return;
    }

    const durationMinutes = Math.round(track.duration_ms / 60000);
    const key = track.audio_features?.key !== undefined ? 
      ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][track.audio_features.key] : '';
    
    const songData = {
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      duration_minutes: durationMinutes.toString(),
      key: key,
      notes: `Popularidad: ${track.popularity}% | Álbum: ${track.album.name} (${track.album.release_date.split('-')[0]})`,
      group_id: groupId,
      created_by: user.id
    };
    
    try {
      await createSong(songData);
      await loadSongs();
      toast.success(`"${track.name}" añadida desde Spotify`);
    } catch (error) {
      console.error('Error creating song from Spotify:', error);
      toast.error('Error al añadir la canción');
    }
  };

  const handleDeezerTrackSelect = async (track: DeezerTrack) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return;
    }

    const durationMinutes = Math.round(track.duration / 60);
    
    const songData = {
      title: track.title,
      artist: track.artist.name,
      duration_minutes: durationMinutes.toString(),
      key: '',
      notes: `Álbum: ${track.album.title} | Fuente: Deezer`,
      group_id: groupId,
      created_by: user.id
    };
    
    try {
      await createSong(songData);
      await loadSongs();
      toast.success(`"${track.title}" añadida desde Deezer`);
    } catch (error) {
      console.error('Error creating song from Deezer:', error);
      toast.error('Error al añadir la canción');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return;
    }

    const songData = {
      group_id: groupId,
      title: formData.title.trim(),
      artist: formData.artist.trim() || undefined,
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : undefined,
      key: formData.key.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      created_by: user.id
    };

    if (editingSong) {
      const updated = await updateSong(editingSong.id, songData);
      if (updated) {
        toast.success('Canción actualizada correctamente');
        setSongs(prevSongs => 
          prevSongs.map(s => s.id === editingSong.id ? updated : s)
        );
      }
    } else {
      const created = await createSong(songData);
      if (created) {
        toast.success('Canción creada correctamente');
        setSongs(prevSongs => [...prevSongs, created]);
      }
    }

    resetForm();
  };

  const handleEdit = (song: Song) => {
    setEditingSong(song);
    setFormData({
      title: song.title,
      artist: song.artist || '',
      duration_minutes: song.duration_minutes?.toString() || '',
      key: song.key || '',
      notes: song.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = (song: Song) => {
    setSongToDelete(song);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!songToDelete) return;

    console.log('Eliminando canción:', songToDelete.id);
    const success = await deleteSong(songToDelete.id);
    console.log('Resultado de eliminación:', success);
    
    if (success) {
      toast.success('Canción eliminada correctamente');
      setSongs(prevSongs => prevSongs.filter(s => s.id !== songToDelete.id));
    } else {
      toast.error('No se pudo eliminar la canción');
    }
    
    setShowDeleteModal(false);
    setSongToDelete(null);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingSong(null);
    setShowForm(false);
  };

  const formatDuration = (minutes: number | null | undefined) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };


  const handleCellEdit = (songId: string, field: string, value: string) => {
    setEditingCell({ songId, field });
    setInlineValue(String(value || ''));
    setInlineError(null);
  };

  const handleCellSave = async (song: Song, field: string) => {
    if (inlineValue === (song[field as keyof Song] || '')) {
      setEditingCell(null);
      return;
    }
    setInlineLoading(true);
    setInlineError(null);
    const updated = await updateSong(song.id, { [field]: field === 'duration_minutes' ? parseInt(inlineValue) || null : inlineValue || null });
    setInlineLoading(false);
    if (updated) {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, ...updated } : s));
      setEditingCell(null);
    } else {
      setInlineError('Error al guardar');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, song: Song, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSave(song, field);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando canciones...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Spotify Connection and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Pool de Canciones</h2>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <SpotifyConnect compact />
          </div>
        </div>
        
      </div>

      {/* Unified Song Search */}
      {canManageSongs && (
        <div className="mb-6">
          <UnifiedSongSearch
            onSpotifyTrackSelect={handleSpotifyTrackSelect}
            onDeezerTrackSelect={handleDeezerTrackSelect}
            onManualAdd={(title) => {
              if (title) {
                setFormData(prev => ({ ...prev, title }));
              }
              setShowForm(true);
            }}
            className="w-full"
          />
        </div>
      )}

      {!canManageSongs && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            Solo los miembros principales pueden gestionar canciones y setlists.
          </p>
        </div>
      )}

      {showForm && canManageSongs && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <h3 className="text-lg font-semibold">
            {editingSong ? 'Editar Canción' : 'Nueva Canción'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Título *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            
            <Input
              label="Artista"
              value={formData.artist}
              onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
            />
            
            <Input
              label="Duración (minutos)"
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
              min="1"
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tonalidad</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.key}
                onChange={e => setFormData({ ...formData, key: e.target.value })}
              >
                {KEYS.map((k) => (
                  <option key={k} value={k}>{k || 'Sin especificar'}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Notas adicionales sobre la canción..."
            />
          </div>
          
          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              {editingSong ? 'Actualizar' : 'Crear'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </form>
      )}


      <div className="bg-white rounded-lg shadow overflow-hidden">
        {songs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay canciones en el pool. Añade la primera canción para empezar.
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No se encontraron canciones que coincidan con los filtros aplicados.
            <button
              onClick={() => {
                setSearchText('');
                setFilterKey('');
                setFilterType('');
              }}
              className="block mx-auto mt-2 text-blue-600 hover:text-blue-800 underline"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-sm text-gray-600">
                  Mostrando {filteredSongs.length} de {songs.length} canciones
                </span>
                
                {/* Mini Filters */}
                <div className="flex items-center gap-2 text-xs">
                  <Search className="w-3 h-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400 focus:w-32 transition-all"
                  />
                  <select
                    value={filterKey}
                    onChange={(e) => setFilterKey(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400"
                  >
                    <option value="">Clave</option>
                    {uniqueKeys.map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-400"
                  >
                    <option value="">Tipo</option>
                    <option value="song">Canciones</option>
                    <option value="medley">Medleys</option>
                  </select>
                </div>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Título
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Artista
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duración
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tonalidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSongs.map((song) => (
                  <tr key={song.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                      {editingCell?.songId === song.id && editingCell.field === 'title' ? (
                        <input
                          className="w-full border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={inlineValue}
                          autoFocus
                          onChange={e => setInlineValue(e.target.value)}
                          onBlur={() => handleCellSave(song, 'title')}
                          onKeyDown={e => handleCellKeyDown(e, song, 'title')}
                          disabled={inlineLoading}
                        />
                      ) : (
                        <div
                          className="text-sm font-medium text-gray-900 cursor-pointer hover:underline"
                          onClick={() => canManageSongs && handleCellEdit(song.id, 'title', song.title)}
                          title="Haz clic para editar"
                        >
                          {song.title}
                        </div>
                      )}
                      {editingCell?.songId === song.id && inlineError && (
                        <div className="text-xs text-red-500 mt-1">{inlineError}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top text-sm text-gray-900">
                      {editingCell?.songId === song.id && editingCell.field === 'artist' ? (
                        <input
                          className="w-full border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={inlineValue}
                          autoFocus
                          onChange={e => setInlineValue(e.target.value)}
                          onBlur={() => handleCellSave(song, 'artist')}
                          onKeyDown={e => handleCellKeyDown(e, song, 'artist')}
                          disabled={inlineLoading}
                        />
                      ) : (
                        <div
                          className="cursor-pointer hover:underline"
                          onClick={() => canManageSongs && handleCellEdit(song.id, 'artist', song.artist || '')}
                          title="Haz clic para editar"
                        >
                          {song.artist || <span className="text-gray-400">Sin artista</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top text-sm text-gray-900">
                      {editingCell?.songId === song.id && editingCell.field === 'duration_minutes' ? (
                        <input
                          className="w-20 border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          type="number"
                          min="1"
                          value={inlineValue}
                          autoFocus
                          onChange={e => setInlineValue(e.target.value)}
                          onBlur={() => handleCellSave(song, 'duration_minutes')}
                          onKeyDown={e => handleCellKeyDown(e, song, 'duration_minutes')}
                          disabled={inlineLoading}
                        />
                      ) : (
                        <div
                          className="cursor-pointer hover:underline"
                          onClick={() => canManageSongs && handleCellEdit(song.id, 'duration_minutes', song.duration_minutes?.toString() || '')}
                          title="Haz clic para editar"
                        >
                          {formatDuration(song.duration_minutes)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top text-sm text-gray-900">
                      {editingCell?.songId === song.id && editingCell.field === 'key' ? (
                        <select
                          className="w-28 border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={inlineValue}
                          autoFocus
                          onChange={e => setInlineValue(e.target.value)}
                          onBlur={() => handleCellSave(song, 'key')}
                          onKeyDown={e => handleCellKeyDown(e, song, 'key')}
                          disabled={inlineLoading}
                        >
                          {KEYS.map((k) => (
                            <option key={k} value={k}>{k || 'Sin especificar'}</option>
                          ))}
                        </select>
                      ) : (
                        <div
                          className="cursor-pointer hover:underline"
                          onClick={() => canManageSongs && handleCellEdit(song.id, 'key', song.key || '')}
                          title="Haz clic para editar"
                        >
                          {song.key || <span className="text-gray-400">Sin especificar</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canManageSongs && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(song)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(song)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && songToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Eliminación
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar la canción "{songToDelete.title}"? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSongToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 