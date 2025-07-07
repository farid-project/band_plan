import React, { useState, useEffect } from 'react';
import { Setlist, Song, SetlistSong } from '../types';
import { 
  getSetlistsByGroup, 
  createSetlist, 
  updateSetlist, 
  deleteSetlist,
  getSongsByGroup,
  addSongToSetlist,
  removeSongFromSetlist,
  reorderSetlistSongs
} from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';
import { supabase } from '../lib/supabase';

interface SetlistManagementProps {
  groupId: string;
  canManageSetlists?: boolean;
}

interface SetlistFormData {
  name: string;
  description: string;
  estimated_duration_minutes: string;
}

const initialFormData: SetlistFormData = {
  name: '',
  description: '',
  estimated_duration_minutes: ''
};

export default function SetlistManagement({ groupId, canManageSetlists = true }: SetlistManagementProps) {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null);
  const [selectedSetlist, setSelectedSetlist] = useState<Setlist | null>(null);
  const [formData, setFormData] = useState<SetlistFormData>(initialFormData);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [setlistToDelete, setSetlistToDelete] = useState<Setlist | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    setLoading(true);
    const [setlistsData, songsData] = await Promise.all([
      getSetlistsByGroup(groupId),
      getSongsByGroup(groupId)
    ]);
    
    if (setlistsData) setSetlists(setlistsData);
    if (songsData) setSongs(songsData);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return;
    }

    const setlistData = {
      group_id: groupId,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      estimated_duration_minutes: formData.estimated_duration_minutes ? parseInt(formData.estimated_duration_minutes) : null,
      created_by: user.id
    };

    if (editingSetlist) {
      const updated = await updateSetlist(editingSetlist.id, setlistData);
      if (updated) {
        toast.success('Setlist actualizado correctamente');
        setSetlists(prevSetlists => 
          prevSetlists.map(s => s.id === editingSetlist.id ? updated : s)
        );
        
        // Si este setlist está seleccionado, actualizarlo también
        if (selectedSetlist?.id === editingSetlist.id) {
          setSelectedSetlist(updated);
        }
      }
    } else {
      const created = await createSetlist(setlistData);
      if (created) {
        toast.success('Setlist creado correctamente');
        setSetlists(prevSetlists => [...prevSetlists, { ...created, songs: [] }]);
      }
    }

    resetForm();
  };

  const handleEdit = (setlist: Setlist) => {
    setEditingSetlist(setlist);
    setFormData({
      name: setlist.name,
      description: setlist.description || '',
      estimated_duration_minutes: setlist.estimated_duration_minutes?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = (setlist: Setlist) => {
    setSetlistToDelete(setlist);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!setlistToDelete) return;

    console.log('Eliminando setlist:', setlistToDelete.id);
    const success = await deleteSetlist(setlistToDelete.id);
    console.log('Resultado de eliminación:', success);
    
    if (success) {
      toast.success('Setlist eliminado correctamente');
      setSetlists(prevSetlists => prevSetlists.filter(s => s.id !== setlistToDelete.id));
      if (selectedSetlist?.id === setlistToDelete.id) {
        setSelectedSetlist(null);
      }
    } else {
      toast.error('No se pudo eliminar el setlist');
    }
    
    setShowDeleteModal(false);
    setSetlistToDelete(null);
  };

  const handleAddSongToSetlist = async (setlistId: string, songId: string) => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return;

    const currentSongs = setlist.songs || [];
    const newPosition = currentSongs.length + 1;

    console.log('Añadiendo canción al setlist:', { setlistId, songId, newPosition });
    const result = await addSongToSetlist(setlistId, songId, newPosition);
    
    if (result) {
      toast.success('Canción añadida al setlist');
      
      // Obtener la información completa de la canción
      const songToAdd = songs.find(s => s.id === songId);
      if (songToAdd) {
        // Actualizar el estado local inmediatamente
        const updatedSetlist = {
          ...setlist,
          songs: [...(setlist.songs || []), {
            ...result,
            song: songToAdd
          }]
        };
        
        setSetlists(prevSetlists => 
          prevSetlists.map(s => s.id === setlistId ? updatedSetlist : s)
        );
        
        // Si este setlist está seleccionado, actualizarlo también
        if (selectedSetlist?.id === setlistId) {
          setSelectedSetlist(updatedSetlist);
        }
      }
    } else {
      console.error('No se pudo añadir la canción al setlist');
    }
  };

  const handleRemoveSongFromSetlist = async (setlistId: string, songId: string) => {
    const success = await removeSongFromSetlist(setlistId, songId);
    if (success) {
      toast.success('Canción eliminada del setlist');
      
      // Actualizar el estado local inmediatamente
      setSetlists(prevSetlists => 
        prevSetlists.map(setlist => {
          if (setlist.id === setlistId) {
            return {
              ...setlist,
              songs: (setlist.songs || []).filter(ss => ss.song_id !== songId)
            };
          }
          return setlist;
        })
      );
      
      // Si este setlist está seleccionado, actualizarlo también
      if (selectedSetlist?.id === setlistId) {
        setSelectedSetlist(prev => prev ? {
          ...prev,
          songs: (prev.songs || []).filter(ss => ss.song_id !== songId)
        } : null);
      }
    }
  };

  const handleReorderSongs = async (setlistId: string, songPositions: { songId: string; position: number }[]) => {
    const success = await reorderSetlistSongs(setlistId, songPositions);
    if (success) {
      toast.success('Orden actualizado');
      await loadData();
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingSetlist(null);
    setShowForm(false);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getAvailableSongs = (setlist: Setlist) => {
    const setlistSongIds = (setlist.songs || []).map(ss => ss.song_id);
    return songs.filter(song => !setlistSongIds.includes(song.id));
  };

  if (loading) {
    return <div className="text-center py-8">Cargando setlists...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Setlists</h2>
        {canManageSetlists && (
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? 'secondary' : 'primary'}
          >
            {showForm ? 'Cancelar' : 'Crear Setlist'}
          </Button>
        )}
      </div>

      {!canManageSetlists && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            Solo los miembros principales pueden gestionar canciones y setlists.
          </p>
        </div>
      )}

      {showForm && canManageSetlists && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <h3 className="text-lg font-semibold">
            {editingSetlist ? 'Editar Setlist' : 'Nuevo Setlist'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            
            <Input
              label="Duración estimada (minutos)"
              type="number"
              value={formData.estimated_duration_minutes}
              onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: e.target.value })}
              min="1"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Descripción del setlist..."
            />
          </div>
          
          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              {editingSetlist ? 'Actualizar' : 'Crear'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Setlists */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Setlists Disponibles</h3>
          </div>
          
          {setlists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay setlists creados. Crea el primero para empezar.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {setlists.map((setlist) => (
                <div 
                  key={setlist.id} 
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedSetlist?.id === setlist.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedSetlist(setlist)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{setlist.name}</h4>
                      {setlist.description && (
                        <p className="text-sm text-gray-500 mt-1">{setlist.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>{setlist.songs?.length || 0} canciones</span>
                        <span>{formatDuration(setlist.estimated_duration_minutes)}</span>
                      </div>
                    </div>
                                         {canManageSetlists && (
                       <div className="flex gap-2 ml-4">
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             handleEdit(setlist);
                           }}
                           className="text-blue-600 hover:text-blue-900 text-sm"
                         >
                           Editar
                         </button>
                                                <button
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDelete(setlist);
                         }}
                         className="text-red-600 hover:text-red-900 text-sm"
                       >
                         Eliminar
                       </button>
                       </div>
                     )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalle del Setlist Seleccionado */}
        {selectedSetlist && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">{selectedSetlist.name}</h3>
              {selectedSetlist.description && (
                <p className="text-sm text-gray-500 mt-1">{selectedSetlist.description}</p>
              )}
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Canciones del Setlist</h4>
                {selectedSetlist.songs && selectedSetlist.songs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSetlist.songs.map((setlistSong, index) => (
                      <div key={setlistSong.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500 w-8">{index + 1}.</span>
                          <div>
                            <div className="font-medium">{setlistSong.song?.title}</div>
                            {setlistSong.song?.artist && (
                              <div className="text-sm text-gray-500">{setlistSong.song.artist}</div>
                            )}
                          </div>
                        </div>
                                                 {canManageSetlists && (
                           <button
                             onClick={() => handleRemoveSongFromSetlist(selectedSetlist.id, setlistSong.song_id)}
                             className="text-red-600 hover:text-red-900 text-sm"
                           >
                             Quitar
                           </button>
                         )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No hay canciones en este setlist</p>
                )}
              </div>

              {/* Añadir canciones */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Añadir Canciones</h4>
                {songs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay canciones disponibles en el pool</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {getAvailableSongs(selectedSetlist).map((song) => (
                      <div key={song.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{song.title}</div>
                          {song.artist && (
                            <div className="text-sm text-gray-500">{song.artist}</div>
                          )}
                        </div>
                                                 {canManageSetlists && (
                           <button
                             onClick={() => handleAddSongToSetlist(selectedSetlist.id, song.id)}
                             className="text-blue-600 hover:text-blue-900 text-sm"
                           >
                             Añadir
                           </button>
                         )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && setlistToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Eliminación
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar el setlist "{setlistToDelete.name}"? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSetlistToDelete(null);
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