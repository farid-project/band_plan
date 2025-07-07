import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { getSongsByGroup, createSong, updateSong, deleteSong } from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';
import { supabase } from '../lib/supabase';

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

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SongManagement({ groupId, canManageSongs = true }: SongManagementProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [formData, setFormData] = useState<SongFormData>(initialFormData);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{ songId: string; field: string } | null>(null);
  const [inlineValue, setInlineValue] = useState<string>('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const debouncedTitle = useDebounce(formData.title, 400);

  useEffect(() => {
    loadSongs();
  }, [groupId]);

  useEffect(() => {
    console.log('Debounced title changed:', debouncedTitle);
    if (debouncedTitle.length < 2) {
      console.log('Title too short, clearing suggestions');
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    console.log('Fetching suggestions for:', debouncedTitle);
    setLoadingSuggestions(true);
    fetch(`https://corsproxy.io/?https://api.deezer.com/search?q=${encodeURIComponent(debouncedTitle)}`)
      .then(res => res.json())
      .then(data => {
        console.log('Deezer API response:', data);
        setSuggestions(data.data || []);
        setShowSuggestions(true);
      })
      .catch((error) => {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      })
      .finally(() => setLoadingSuggestions(false));
  }, [debouncedTitle]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSongs = async () => {
    setLoading(true);
    const songsData = await getSongsByGroup(groupId);
    if (songsData) {
      setSongs(songsData);
    }
    setLoading(false);
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

  const handleSuggestionClick = (track: any) => {
    setFormData({
      ...formData,
      title: track.title,
      artist: track.artist.name,
      duration_minutes: Math.round(track.duration / 60).toString()
    });
    setShowSuggestions(false);
  };

  const handleCellEdit = (songId: string, field: string, value: string) => {
    setEditingCell({ songId, field });
    setInlineValue(value || '');
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Pool de Canciones</h2>
        {canManageSongs && (
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? 'secondary' : 'primary'}
          >
            {showForm ? 'Cancelar' : 'Añadir Canción'}
          </Button>
        )}
      </div>

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
            <div className="relative">
              <Input
                label="Título *"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  setShowSuggestions(true);
                }}
                required
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto mt-1">
                  {loadingSuggestions && (
                    <div className="p-2 text-gray-500 text-sm">Buscando...</div>
                  )}
                  {suggestions.map((track) => (
                    <div
                      key={track.id}
                      className="p-2 hover:bg-blue-100 cursor-pointer flex flex-col"
                      onClick={() => handleSuggestionClick(track)}
                    >
                      <span className="font-medium">{track.title}</span>
                      <span className="text-xs text-gray-500">{track.artist.name} &middot; {Math.round(track.duration / 60)} min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
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
        ) : (
          <div className="overflow-x-auto">
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
                {songs.map((song) => (
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