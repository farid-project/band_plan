import React, { useState } from 'react';
import { Medley, MedleySong, Song } from '../types';
import { updateMedley, deleteMedley, removeSongFromMedley, addSongToMedley } from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';
import { FaMusic, FaEdit, FaTrash, FaPlus, FaTimes } from 'react-icons/fa';

interface MedleyItemProps {
  medley: Medley;
  availableSongs: Song[];
  canEdit?: boolean;
  onMedleyUpdated: () => void;
  onMedleyDeleted: () => void;
}

export default function MedleyItem({
  medley,
  availableSongs,
  canEdit = true,
  onMedleyUpdated,
  onMedleyDeleted
}: MedleyItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [medleyName, setMedleyName] = useState(medley.name);
  const [showAddSong, setShowAddSong] = useState(false);
  const [loading, setLoading] = useState(false);

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
        onMedleyUpdated();
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
    if (!confirm('¿Estás seguro de que quieres eliminar este medley?')) {
      return;
    }

    setLoading(true);
    try {
      const success = await deleteMedley(medley.id);
      if (success) {
        toast.success('Medley eliminado');
        onMedleyDeleted();
      }
    } catch (error) {
      console.error('Error al eliminar el medley:', error);
      toast.error('Error al eliminar el medley');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSong = async (songId: string) => {
    setLoading(true);
    try {
      const success = await removeSongFromMedley(medley.id, songId);
      if (success) {
        toast.success('Canción eliminada del medley');
        onMedleyUpdated();
      }
    } catch (error) {
      console.error('Error al eliminar la canción del medley:', error);
      toast.error('Error al eliminar la canción del medley');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSong = async (songId: string) => {
    const nextPosition = (medley.songs?.length || 0) + 1;
    setLoading(true);
    try {
      const added = await addSongToMedley(medley.id, songId, nextPosition);
      if (added) {
        toast.success('Canción añadida al medley');
        onMedleyUpdated();
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
    <div className="border-l-4 border-blue-400 bg-blue-50 rounded p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FaMusic className="text-blue-600" />
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={medleyName}
                onChange={(e) => setMedleyName(e.target.value)}
                className="w-48"
              />
              <Button
                variant="primary"
                size="xs"
                onClick={handleUpdateMedley}
                loading={loading}
              >
                Guardar
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  setIsEditing(false);
                  setMedleyName(medley.name);
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <span className="font-semibold text-blue-800">{medley.name}</span>
          )}
        </div>
        
        {canEdit && !isEditing && (
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setIsEditing(true)}
            >
              <FaEdit />
            </Button>
            <Button
              variant="danger"
              size="xs"
              onClick={handleDeleteMedley}
              loading={loading}
            >
              <FaTrash />
            </Button>
          </div>
        )}
      </div>

      <div className="ml-6">
        <div className="mb-2">
          <h4 className="text-sm font-medium text-gray-700 mb-1">Canciones:</h4>
          {sortedSongs.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No hay canciones en este medley</p>
          ) : (
            <ul className="space-y-1">
              {sortedSongs.map((medleySong) => (
                <li key={medleySong.id} className="flex items-center justify-between py-1">
                  <div className="flex-1">
                    <span className="font-medium text-sm">{medleySong.song?.title}</span>
                    {medleySong.song?.artist && (
                      <span className="text-xs text-gray-500 ml-2">{medleySong.song.artist}</span>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => handleRemoveSong(medleySong.song_id)}
                      loading={loading}
                    >
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
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => setShowAddSong(false)}
                  >
                    <FaTimes />
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {availableSongs.length === 0 ? (
                    <p className="text-xs text-gray-500">No hay canciones disponibles</p>
                  ) : (
                    availableSongs.map((song) => (
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
                    ))
                  )}
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                size="xs"
                onClick={() => setShowAddSong(true)}
              >
                <FaPlus className="mr-1" />
                Añadir Canción
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 