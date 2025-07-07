import React, { useState } from 'react';
import { Song } from '../types';
import { createMedley } from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';

interface CreateMedleyModalProps {
  isOpen: boolean;
  onClose: () => void;
  setlistId: string;
  availableSongs: Song[];
  onMedleyCreated: () => void;
}

export default function CreateMedleyModal({
  isOpen,
  onClose,
  setlistId,
  availableSongs,
  onMedleyCreated
}: CreateMedleyModalProps) {
  const [medleyName, setMedleyName] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSongToggle = (songId: string) => {
    setSelectedSongIds(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleCreateMedley = async () => {
    if (!medleyName.trim()) {
      toast.error('El nombre del medley es obligatorio');
      return;
    }

    if (selectedSongIds.length < 2) {
      toast.error('Selecciona al menos dos canciones para el medley');
      return;
    }

    setLoading(true);
    try {
      const medley = await createMedley(setlistId, medleyName, 0, selectedSongIds);
      if (medley) {
        toast.success('Medley creado exitosamente');
        onMedleyCreated();
        handleClose();
      }
    } catch (error) {
      console.error('Error al crear el medley:', error);
      toast.error('Error al crear el medley');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMedleyName('');
    setSelectedSongIds([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Crear Nuevo Medley</h3>
        
        <div className="mb-4">
          <Input
            label="Nombre del Medley"
            value={medleyName}
            onChange={(e) => setMedleyName(e.target.value)}
            placeholder="Ej: Medley de Rock Clásico"
            autoFocus
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Canciones ({selectedSongIds.length} seleccionadas)
          </label>
          <div className="max-h-60 overflow-y-auto border rounded p-2">
            {availableSongs.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay canciones disponibles</p>
            ) : (
              availableSongs.map((song) => (
                <label key={song.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded px-1">
                  <input
                    type="checkbox"
                    checked={selectedSongIds.includes(song.id)}
                    onChange={() => handleSongToggle(song.id)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{song.title}</div>
                    {song.artist && (
                      <div className="text-xs text-gray-500 truncate">{song.artist}</div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateMedley}
            loading={loading}
            disabled={selectedSongIds.length < 2 || !medleyName.trim()}
          >
            Crear Medley
          </Button>
        </div>
      </div>
    </div>
  );
} 