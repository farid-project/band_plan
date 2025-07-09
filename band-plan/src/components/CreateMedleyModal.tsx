import React, { useState } from 'react';
import { Song, Medley } from '../types';
import { createMedley } from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';

interface CreateMedleyModalProps {
  isOpen: boolean;
  onClose: () => void;
  setlistId: string;
  availableSongs: Song[];
  onMedleyCreated: (newMedley: Medley) => void;
}

export default function CreateMedleyModal({
  isOpen,
  onClose,
  setlistId,
  availableSongs,
  onMedleyCreated
}: CreateMedleyModalProps) {
  const [name, setName] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSongToggle = (songId: string) => {
    setSelectedSongIds(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleCreateMedley = async () => {
    if (selectedSongIds.length < 2) {
      toast.error('Selecciona al menos dos canciones para el medley');
      return;
    }

    let finalMedleyName = name.trim();

    if (!finalMedleyName) {
      const selectedSongs = selectedSongIds
        .map(id => availableSongs.find(song => song.id === id))
        .filter((s): s is Song => !!s);
      finalMedleyName = selectedSongs.map(song => song.title).join(' | ');
    }

    if (!finalMedleyName) {
      toast.error("No se pudo generar el nombre del medley.");
      return;
    }

    setLoading(true);
    try {
      const newMedley = await createMedley(setlistId, finalMedleyName, 0, selectedSongIds);
      if (newMedley) {
        toast.success('Medley creado con éxito');
        onMedleyCreated(newMedley);
        handleClose();
      }
    } catch (error) {
      console.error("Error creating medley:", error);
      toast.error('Error al crear el medley');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedSongIds([]);
    setSearchTerm('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Crear Nuevo Medley</h3>
        
        <div className="space-y-4">
          <Input
            label="Nombre del Medley"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Medley de Rock Clásico"
            autoFocus
          />
          <label className="block text-sm font-medium text-gray-700">
            Canciones (opcional)
          </label>
          <div className="border rounded-md p-2">
            <Input
              placeholder="Buscar canción para añadir..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-40 overflow-y-auto">
              {availableSongs
                .filter(song => 
                  song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  song.artist?.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((song) => (
                <div key={song.id} className="flex items-center justify-between p-2 hover:bg-gray-50">
                  <div>
                    <label className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded px-1">
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
                  </div>
                </div>
              ))}
            </div>
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
            disabled={selectedSongIds.length < 2}
          >
            Crear Medley
          </Button>
        </div>
      </div>
    </div>
  );
} 