import React, { useState } from 'react';
import { Medley, Song } from '../types';
import { updateMedley, deleteMedley, removeSongFromMedley, addSongToMedley } from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';
import { FaMusic, FaEdit, FaTrash, FaPlus, FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa';

interface MedleyItemProps {
  medley: Medley;
  availableSongs: Song[];
  canEdit?: boolean;
  onSongAdded: (medleyId: string, song: Song, newMedleySong: MedleySong) => void;
  onSongRemoved: (medleyId: string, songId: string) => void;
  onMedleyRenamed: (medleyId: string, newName: string) => void;
  onMedleyDeleted: (medleyId: string) => void;
}

export default function MedleyItem({
  medley,
  availableSongs,
  canEdit = true,
  onSongAdded,
  onSongRemoved,
  onMedleyRenamed,
  onMedleyDeleted
}: MedleyItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [medleyName, setMedleyName] = useState(medley.name);
  const [showAddSong, setShowAddSong] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addSongSearch, setAddSongSearch] = useState('');

  const handleUpdateMedley = async () => {
    if (!medleyName.trim()) {
      toast.error('El nombre del medley es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateMedley(medley.id, { name: medleyName });
      if (updated) {
        toast.success('Medley actualizado');
        onMedleyRenamed(medley.id, medleyName);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error al actualizar el medley:', error);
      toast.error('Error al actualizar el medley');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedley = async () => {
    setLoading(true);
    try {
      const success = await deleteMedley(medley.id);
      if (success) {
        toast.success('Medley eliminado');
        onMedleyDeleted(medley.id);
      }
    } catch (error) {
      console.error('Error al eliminar el medley:', error);
      toast.error('Error al eliminar el medley');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRemoveSong = async (songId: string) => {
    setLoading(true);
    try {
      const success = await removeSongFromMedley(medley.id, songId);
      if (success) {
        toast.success('Canción eliminada del medley');
        onSongRemoved(medley.id, songId);
      }
    } catch (error) {
      console.error('Error al eliminar la canción del medley:', error);
      toast.error('Error al eliminar la canción del medley');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSong = async (songId: string) => {
    const songToAdd = availableSongs.find(s => s.id === songId);
    if (!songToAdd) {
        toast.error('No se pudo encontrar la canción seleccionada');
        return;
    }

    const nextPosition = (medley.songs?.length || 0) + 1;
    setLoading(true);
    try {
      const addedMedleySong = await addSongToMedley(medley.id, songId, nextPosition);
      if (addedMedleySong) {
        toast.success('Canción añadida al medley');
        onSongAdded(medley.id, songToAdd, addedMedleySong);
        setShowAddSong(false);
      }
    } catch (error) {
      console.error('Error al añadir la canción al medley:', error);
      toast.error('Error al añadir la canción al medley');
    } finally {
      setLoading(false);
    }
  };

  const sortedSongs = medley.songs?.sort((a, b) => a.position - b.position) || [];

  return (
    <div className="border-l-4 border-blue-400 bg-blue-50 rounded p-3 mb-2">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          <FaMusic className="text-blue-600" />
          <span className="font-semibold text-blue-800">{medley.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{sortedSongs.length} canciones</span>
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-blue-200" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <div className="flex items-center justify-end gap-2 mb-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditing(!isEditing);
                  if (isEditing) setMedleyName(medley.name);
                }}
              >
                <FaEdit className="mr-1" />
                {isEditing ? 'Cancelar' : 'Renombrar'}
              </Button>
              {!isEditing && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  loading={loading}
                >
                  <FaTrash className="mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
          )}

          {isEditing && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-white rounded-md">
              <Input
                value={medleyName}
                onChange={(e) => setMedleyName(e.target.value)}
                placeholder="Nuevo nombre del medley"
              />
              <Button onClick={handleUpdateMedley} loading={loading}>
                Guardar
              </Button>
            </div>
          )}

          {!isEditing && (
            <>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Canciones:</h4>
                {sortedSongs.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No hay canciones en este medley</p>
                ) : (
                  <ul className="space-y-1">
                    {sortedSongs.map((medleySong) => (
                      <li key={medleySong.id} className="flex items-center justify-between py-1 pl-2 hover:bg-blue-100 rounded">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{medleySong.song?.title}</span>
                          {medleySong.song?.artist && (
                            <span className="text-xs text-gray-500 ml-2">{medleySong.song.artist}</span>
                          )}
                        </div>
                        {canEdit && (
                          <Button variant="danger" onClick={() => handleRemoveSong(medleySong.song_id)} loading={loading}>
                            <FaTimes />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canEdit && (
                <div className="mt-3">
                  {showAddSong ? (
                    <div className="border rounded p-2 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Añadir canción:</span>
                        <Button variant="secondary" onClick={() => {
                          setShowAddSong(false);
                          setAddSongSearch('');
                        }}>
                          <FaTimes />
                        </Button>
                      </div>
                      <Input
                        placeholder="Buscar canción..."
                        value={addSongSearch}
                        onChange={(e) => setAddSongSearch(e.target.value)}
                        className="mb-2"
                      />
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {availableSongs
                          .filter(s => !sortedSongs.some(ms => ms.song_id === s.id))
                          .filter(song =>
                            song.title.toLowerCase().includes(addSongSearch.toLowerCase()) ||
                            song.artist?.toLowerCase().includes(addSongSearch.toLowerCase())
                          )
                          .map((song) => (
                          <button
                            key={song.id}
                            onClick={() => handleAddSong(song.id)}
                            className="w-full text-left p-1 hover:bg-gray-100 rounded text-sm"
                            disabled={loading}
                          >
                            <div className="font-medium">{song.title}</div>
                            {song.artist && (
                              <div className="text-xs text-gray-500">{song.artist}</div>
                            )}
                          </button>
                        ))}
                         {availableSongs.filter(s => !sortedSongs.some(ms => ms.song_id === s.id)).length === 0 && (
                            <p className="text-xs text-gray-500 p-1">No hay más canciones para añadir.</p>
                         )}
                      </div>
                    </div>
                  ) : (
                    <Button variant="primary" onClick={() => setShowAddSong(true)}>
                      <FaPlus className="mr-1" />
                      Añadir Canción
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Eliminación
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar el medley "{medley.name}"? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteMedley}
                loading={loading}
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 