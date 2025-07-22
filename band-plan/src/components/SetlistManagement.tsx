import React, { useState, useEffect } from 'react';
import { Setlist, Song, SetlistSong, Medley, SetlistItem, MedleySong } from '../types';
import { 
  getSetlistsByGroup, 
  createSetlist, 
  updateSetlist, 
  deleteSetlist,
  getSongsByGroup,
  addSongToSetlist,
  removeSongFromSetlist,
  reorderSetlistSongs,
  reorderSetlistItems,
  updateMedley,
  duplicateSetlist
} from '../lib/setlistUtils';
import { toast } from 'react-hot-toast';
import Button from './Button';
import Input from './Input';
import { supabase } from '../lib/supabase';
import { FaMusic, FaPlus, FaEdit, FaGripVertical, FaCopy, FaSpotify } from 'react-icons/fa';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { CardSkeleton, ListSkeleton } from './Skeleton';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CreateMedleyModal from './CreateMedleyModal';
import MedleyItem from './MedleyItem';
import ImportPlaylistModal from './ImportPlaylistModal';
import { useSpotify } from '../hooks/useSpotify';
import { SpotifyTrack } from '../services/spotifyService';

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

function SortableSetlistItem({ 
  item, 
  canManageSetlists, 
  songs, 
  onRemoveSong,
  onSongAddedToMedley,
  onSongRemovedFromMedley,
  onMedleyRenamed,
  onMedleyDeleted,
}: { 
  item: SetlistItem, 
  canManageSetlists: boolean, 
  songs: Song[], 
  onRemoveSong: (setlistId: string, songId: string) => void,
  onSongAddedToMedley: (medleyId: string, song: Song, newMedleySong: MedleySong) => void,
  onSongRemovedFromMedley: (medleyId: string, songId: string) => void,
  onMedleyRenamed: (medleyId: string, newName: string) => void,
  onMedleyDeleted: (medleyId: string) => void,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-2 mb-2">
      {canManageSetlists && (
        <div 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 py-3 px-3 touch-none select-none min-w-[48px] min-h-[48px] flex items-center justify-center rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors"
          role="button"
          aria-label="Arrastrar para reordenar"
          tabIndex={0}
        >
          <FaGripVertical className="text-lg" />
        </div>
      )}
      <div className="flex-grow">
        {item.type === 'song' ? (
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 flex justify-between items-center">
            <div>
              <p className="font-medium">{(item.data as SetlistSong).song?.title}</p>
              <p className="text-sm text-gray-500">{(item.data as SetlistSong).song?.artist} - {(item.data as SetlistSong).song?.duration_minutes}m - Tono: {(item.data as SetlistSong).song?.key}</p>
            </div>
            {canManageSetlists && (
              <Button 
                variant="danger"
                onClick={() => onRemoveSong((item.data as SetlistSong).setlist_id, (item.data as SetlistSong).song_id)}
              >
                Eliminar
              </Button>
            )}
          </div>
        ) : (
          <MedleyItem
            medley={item.data as Song}
            availableSongs={songs.filter(song => 
                song.type === 'song' // Only show regular songs, not other medleys
            )}
            canEdit={canManageSetlists}
            onSongAdded={onSongAddedToMedley}
            onSongRemoved={onSongRemovedFromMedley}
            onMedleyRenamed={onMedleyRenamed}
            onMedleyDeleted={onMedleyDeleted}
          />
        )}
      </div>
    </div>
  );
}

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
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [setlistToDuplicate, setSetlistToDuplicate] = useState<Setlist | null>(null);
  const [duplicateSetlistName, setDuplicateSetlistName] = useState('');
  const [addSongSearch, setAddSongSearch] = useState('');

  const [showCreateMedleyModal, setShowCreateMedleyModal] = useState(false);
  const [showImportPlaylistModal, setShowImportPlaylistModal] = useState(false);

  // Spotify integration
  const { isAuthenticated, createPlaylistFromSetlist, searchTracks } = useSpotify();

  const [editingMedleyId, setEditingMedleyId] = useState<string | null>(null);
  const [editingMedleyName, setEditingMedleyName] = useState('');

  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, { context: { active, droppableRects, droppableContainers, collisionRect } }) => {
        // Add keyboard navigation support for accessibility
        return null;
      },
    })
  );

  useEffect(() => {
    loadData();
  }, [groupId]);

  // Real-time subscription for setlists
  useRealtimeSubscription({
    table: 'setlists',
    filter: `group_id=eq.${groupId}`,
    onInsert: (payload) => {
      setSetlists(prev => [...prev, { ...payload.new as Setlist, songs: [] }]);
      toast.success('Nuevo setlist añadido en tiempo real');
    },
    onUpdate: (payload) => {
      const updatedSetlist = payload.new as Setlist;
      setSetlists(prev => prev.map(setlist => 
        setlist.id === updatedSetlist.id ? { ...setlist, ...updatedSetlist } : setlist
      ));
      
      if (selectedSetlist?.id === updatedSetlist.id) {
        setSelectedSetlist(prev => prev ? { ...prev, ...updatedSetlist } : null);
      }
    },
    onDelete: (payload) => {
      setSetlists(prev => prev.filter(setlist => setlist.id !== payload.old.id));
      if (selectedSetlist?.id === payload.old.id) {
        setSelectedSetlist(null);
      }
      toast.success('Setlist eliminado en tiempo real');
    },
    enabled: !!groupId
  });

  // Real-time subscription for setlist_songs
  useRealtimeSubscription({
    table: 'setlist_songs',
    onInsert: (payload) => {
      const newSetlistSong = payload.new as SetlistSong;
      if (selectedSetlist?.id === newSetlistSong.setlist_id) {
        refreshSelectedSetlist();
      }
    },
    onUpdate: (payload) => {
      const updatedSetlistSong = payload.new as SetlistSong;
      if (selectedSetlist?.id === updatedSetlistSong.setlist_id) {
        refreshSelectedSetlist();
      }
    },
    onDelete: (payload) => {
      const deletedSetlistSong = payload.old as SetlistSong;
      if (selectedSetlist?.id === deletedSetlistSong.setlist_id) {
        refreshSelectedSetlist();
      }
    },
    enabled: !!selectedSetlist
  });

  useEffect(() => {
    if (selectedSetlist) {
      const items: SetlistItem[] = [];
      
      if (selectedSetlist.songs) {
        selectedSetlist.songs.forEach(song => {
          // Check if this song is actually a medley
          const isMedialey = song.song?.type === 'medley';
          
          // Debug logging for medleys
          if (isMedialey) {
            console.log('Processing medley item:', {
              songId: song.id,
              songSongId: song.song?.id,
              songTitle: song.song?.title,
              songType: song.song?.type,
              position: song.position
            });
          }
          
          // Only add items with valid IDs
          if (song.id) {
            items.push({
              id: song.id, // Always use setlist_songs ID for consistency
              type: isMedialey ? 'medley' : 'song',
              position: song.position,
              data: isMedialey ? song.song! : song
            });
          } else {
            console.error('Song with undefined ID found:', song);
          }
        });
      }

      // Legacy medleys should not exist in the new system
      // All medleys should be in songs table with type='medley'
      if (selectedSetlist.medleys && selectedSetlist.medleys.length > 0) {
        console.warn('Legacy medleys found in setlist - these will be ignored in the new system:', selectedSetlist.medleys);
        console.warn('All medleys should be in the songs table with type="medley"');
      }

      items.sort((a, b) => a.position - b.position);
      
      // Debug: Check for duplicate IDs
      const ids = items.map(item => item.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        console.error('Duplicate IDs found in setlistItems:', duplicateIds);
        console.error('All items:', items);
        console.error('selectedSetlist.songs:', selectedSetlist.songs);
        console.error('selectedSetlist.medleys:', selectedSetlist.medleys);
      }
      
      // Additional debug: Log all items
      console.log('All setlistItems:', items.map(item => ({ id: item.id, type: item.type, position: item.position })));
      
      setSetlistItems(items);
    } else {
      setSetlistItems([]);
    }
  }, [selectedSetlist]);

  const loadData = async () => {
    setLoading(true);
    const [setlistsData, songsData] = await Promise.all([
      getSetlistsByGroup(groupId),
      getSongsByGroup(groupId)
    ]);
    
    if (setlistsData) {
        setSetlists(setlistsData);
    }

    if (songsData) setSongs(songsData);
    setLoading(false);
    return setlistsData;
  };

  const refreshSelectedSetlist = async () => {
    const setlistsData = await loadData();
    if (setlistsData && selectedSetlist) {
      const updatedSetlist = setlistsData.find(s => s.id === selectedSetlist.id);
      if (updatedSetlist) {
        const sortedSetlist = {
            ...updatedSetlist,
            songs: (updatedSetlist.songs || []).sort((a, b) => a.position - b.position),
            medleys: (updatedSetlist.medleys || []).sort((a, b) => a.position - b.position),
        };
        setSelectedSetlist(sortedSetlist);
      } else {
        setSelectedSetlist(null);
      }
    }
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
      description: formData.description.trim() || undefined,
      estimated_duration_minutes: formData.estimated_duration_minutes ? parseInt(formData.estimated_duration_minutes) : undefined,
      created_by: user.id
    };

    if (editingSetlist) {
      const updated = await updateSetlist(editingSetlist.id, setlistData);
      if (updated) {
        toast.success('Setlist actualizado correctamente');
        setSetlists(prevSetlists => 
          prevSetlists.map(s => s.id === editingSetlist.id ? {...s, ...updated} : s)
        );
        
        if (selectedSetlist?.id === editingSetlist.id) {
            setSelectedSetlist(prev => prev ? {...prev, ...updated} : null);
        }
      }
    } else {
      const created = await createSetlist({
        ...setlistData,
        name: setlistData.name,
      });
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

    const success = await deleteSetlist(setlistToDelete.id);
    
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
    if (!selectedSetlist) return;

    // Calculate position based on maximum existing position + 1
    const maxPosition = selectedSetlist.songs && selectedSetlist.songs.length > 0 
      ? Math.max(...selectedSetlist.songs.map(s => s.position)) 
      : 0;
    const newPosition = maxPosition + 1;

    const result = await addSongToSetlist(setlistId, songId, newPosition);
    
    if (result) {
      toast.success('Canción añadida al setlist');
      const songToAdd = songs.find(s => s.id === songId);
      
      if (songToAdd) {
        const newSetlistSong: SetlistSong = {
          ...result,
          position: newPosition,
          song: songToAdd
        };
        
        const updatedSetlist = {
          ...selectedSetlist,
          songs: [...(selectedSetlist.songs || []), newSetlistSong]
        };
        
        setSelectedSetlist(updatedSetlist);
        setSetlists(prev => prev.map(s => s.id === setlistId ? updatedSetlist : s));
      }
    } else {
      console.error('No se pudo añadir la canción al setlist');
    }
  };

  const handleRemoveSongFromSetlist = async (setlistId: string, songIdToRemove: string) => {
    const success = await removeSongFromSetlist(setlistId, songIdToRemove);
    if (success) {
      toast.success('Canción eliminada del setlist');
      
      const updatedSetlist = selectedSetlist ? {
        ...selectedSetlist,
        songs: selectedSetlist.songs?.filter(s => s.song_id !== songIdToRemove)
      } : null;

      if (updatedSetlist) {
          setSelectedSetlist(updatedSetlist);
      
          setSetlists(prevSetlists =>
              prevSetlists.map(s => s.id === updatedSetlist!.id ? updatedSetlist : s)
          );
      }
    } else {
      toast.error('No se pudo eliminar la canción del setlist');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !selectedSetlist) {
      return;
    }

    const oldIndex = setlistItems.findIndex(item => item.id === active.id);
    const newIndex = setlistItems.findIndex(item => item.id === over.id);

    const reorderedItems = arrayMove(setlistItems, oldIndex, newIndex);

    const itemsToUpdate = reorderedItems.map((item, index) => ({
      id: item.id,
      type: item.type,
      position: index + 1,
    }));

    // Update all items (both songs and medleys) as they're all in the songs array
    const newSongs = itemsToUpdate
      .map(updatedItem => {
        const originalSong = selectedSetlist.songs?.find(s => s.id === updatedItem.id);
        return { ...originalSong!, position: updatedItem.position };
      });

    const updatedSetlist = {
      ...selectedSetlist,
      songs: newSongs,
    };

    setSelectedSetlist(updatedSetlist);
    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));

    console.log('Reordering items:', itemsToUpdate);
    
    // Convert items to the format expected by reorderSetlistSongs
    const songPositions = itemsToUpdate.map(item => ({
      songId: item.id,
      position: item.position
    }));
    
    reorderSetlistSongs(selectedSetlist.id, songPositions).then(success => {
      if (!success) {
        toast.error("No se pudo guardar el orden. Se revertirán los cambios.");
        loadData();
      } else {
        console.log('Reorder successful');
      }
    });
  };

  const handleReorderSongs = async (setlistId: string, songPositions: { songId: string; position: number }[]) => {
    const success = await reorderSetlistSongs(setlistId, songPositions);
    if (success) {
      toast.success('Orden actualizado');
    } else {
      toast.error('No se pudo actualizar el orden. Refrescando...');
      await loadData();
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingSetlist(null);
    setShowForm(false);
  };

  const formatDuration = (minutes: number | null | undefined) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getAvailableSongs = (setlist: Setlist) => {
    if (!songs) return [];
    const setlistSongIds = new Set((setlist.songs || []).map(ss => ss.song_id));
    return songs.filter(song => !setlistSongIds.has(song.id));
  };
  
  const handleSelectSetlist = (setlist: Setlist) => {
    const fullSetlistData = setlists.find(s => s.id === setlist.id);
    setSelectedSetlist(fullSetlistData || null);
  };

  const handleSongAddedToMedley = (medleyId: string, song: Song, medleySong: MedleySong) => {
    if (!selectedSetlist) return;
    
    const fullMedleySong = { ...medleySong, song };

    const updatedSetlist = {
      ...selectedSetlist,
      medleys: (selectedSetlist.medleys || []).map(m => 
        m.id === medleyId 
          ? { ...m, songs: [...(m.songs || []), fullMedleySong].sort((a,b) => a.position - b.position) } 
          : m
      ),
    };
    
    setSelectedSetlist(updatedSetlist);
    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));
  };

  const handleSongRemovedFromMedley = (medleyId: string, songId: string) => {
    if (!selectedSetlist) return;

    const updatedSetlist = {
        ...selectedSetlist,
        medleys: (selectedSetlist.medleys || []).map(m => 
            m.id === medleyId 
              ? { ...m, songs: (m.songs || []).filter(ms => ms.song_id !== songId) }
              : m
        ),
    };

    setSelectedSetlist(updatedSetlist);
    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));
  };

  const handleMedleyRenamed = (medleyId: string, newName: string) => {
    if (!selectedSetlist) return;

    const updatedSetlist = {
        ...selectedSetlist,
        medleys: (selectedSetlist.medleys || []).map(m => 
            m.id === medleyId ? { ...m, name: newName } : m
        ),
    };
    
    setSelectedSetlist(updatedSetlist);
    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));
  };

  const handleMedleyDeleted = (medleyId: string) => {
    if (!selectedSetlist) return;
    
    const updatedSetlist = {
        ...selectedSetlist,
        medleys: (selectedSetlist.medleys || []).filter(m => m.id !== medleyId),
    };

    setSelectedSetlist(updatedSetlist);
    setSetlists(prev => prev.map(s => s.id === updatedSetlist.id ? updatedSetlist : s));
  };

  const handleMedleyCreated = async (newMedley: Song) => {
    if (!selectedSetlist) return;
    
    // Add the new medley to the current setlist
    // Calculate position based on maximum existing position + 1
    const maxPosition = selectedSetlist.songs && selectedSetlist.songs.length > 0 
      ? Math.max(...selectedSetlist.songs.map(s => s.position)) 
      : 0;
    const newPosition = maxPosition + 1;
    const result = await addSongToSetlist(selectedSetlist.id, newMedley.id, newPosition);
    
    if (result) {
      toast.success('Medley creado y añadido al setlist');
      
      // Reload data to get updated setlist
      await loadData();
      
      // Find and select the updated setlist
      const updatedSetlists = await getSetlistsByGroup(groupId);
      if (updatedSetlists) {
        const updatedSetlist = updatedSetlists.find(s => s.id === selectedSetlist.id);
        if (updatedSetlist) {
          setSelectedSetlist(updatedSetlist);
        }
      }
    } else {
      toast.error('Medley creado pero no se pudo añadir al setlist');
    }
  };
  
  const handleDuplicateClick = (setlist: Setlist) => {
    setSetlistToDuplicate(setlist);
    setDuplicateSetlistName(`${setlist.name} (copia)`);
    setShowDuplicateModal(true);
  };

  const handleCreateSpotifyPlaylist = async (setlist: Setlist) => {
    if (!isAuthenticated) {
      toast.error('Debes conectar con Spotify primero');
      return;
    }

    setLoading(true);
    try {
      // Get all songs from the setlist
      const allSongs = setlist.songs || [];
      const spotifyTracks: SpotifyTrack[] = [];

      // Search for each song on Spotify
      for (const setlistSong of allSongs) {
        if (setlistSong.song) {
          const searchQuery = `${setlistSong.song.title} ${setlistSong.song.artist || ''}`.trim();
          try {
            const results = await searchTracks(searchQuery);
            if (results.length > 0) {
              // Take the first (most relevant) result
              spotifyTracks.push(results[0]);
            }
          } catch (error) {
            console.warn(`Could not find "${searchQuery}" on Spotify`);
          }
        }
      }

      if (spotifyTracks.length === 0) {
        toast.error('No se encontraron canciones del setlist en Spotify');
        return;
      }

      const playlistUrl = await createPlaylistFromSetlist(setlist.name, spotifyTracks);
      
      if (playlistUrl) {
        toast.success(
          <div>
            <p>¡Playlist creada en Spotify!</p>
            <p className="text-sm">Encontradas {spotifyTracks.length} de {allSongs.length} canciones</p>
            <a 
              href={playlistUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Abrir en Spotify
            </a>
          </div>
        );
      }
    } catch (error) {
      console.error('Error creating Spotify playlist:', error);
      toast.error('Error al crear playlist en Spotify');
    } finally {
      setLoading(false);
    }
  };

  const confirmDuplicate = async () => {
    if (!setlistToDuplicate || !duplicateSetlistName.trim()) return;
    
    setLoading(true);
    setShowDuplicateModal(false);
    
    const duplicatedSetlist = await duplicateSetlist(setlistToDuplicate.id, duplicateSetlistName.trim());
    
    if (duplicatedSetlist) {
      toast.success(`Setlist duplicado correctamente`);
      await loadData(); // Recargar todos los setlists
    } else {
      toast.error('No se pudo duplicar el setlist');
    }
    
    setSetlistToDuplicate(null);
    setDuplicateSetlistName('');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded"></div>
        </div>
        <CardSkeleton count={4} />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Setlists</h2>
        {canManageSetlists && (
          <div className="flex gap-3">
            <Button
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? 'secondary' : 'primary'}
            >
              {showForm ? 'Cancelar' : 'Crear Setlist'}
            </Button>
            <Button
              onClick={() => setShowImportPlaylistModal(true)}
              variant="secondary"
              className={`${
                isAuthenticated 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-gray-400 hover:bg-gray-500 text-white'
              }`}
              title={!isAuthenticated ? 'Conecta con Spotify para importar playlists' : 'Importar playlist desde Spotify'}
            >
              <FaSpotify className="mr-2" />
              Importar de Spotify
              {!isAuthenticated && (
                <span className="ml-2 text-xs opacity-75">(Conectar)</span>
              )}
            </Button>
          </div>
        )}
      </div>

      {!canManageSetlists && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">Solo los miembros principales pueden gestionar canciones y setlists.</p>
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
              placeholder="Descripción breve del setlist..."
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 lg:hidden">Setlists</h3>
          {setlists.map((setlist) => (
            <div
              key={setlist.id}
              className={`p-4 rounded-lg cursor-pointer transition-all ${selectedSetlist?.id === setlist.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-gray-100'}`}
              onClick={() => handleSelectSetlist(setlist)}
            >
              <h4 className={`font-bold ${selectedSetlist?.id === setlist.id ? 'text-white' : 'text-gray-800'}`}>{setlist.name}</h4>
              <p className={`text-sm ${selectedSetlist?.id === setlist.id ? 'text-blue-100' : 'text-gray-500'}`}>
                {(setlist.songs?.length || 0) + (setlist.medleys?.length || 0)} items
              </p>
            </div>
          ))}
          {setlists.length === 0 && !loading && (
            <p className="text-center text-gray-500 py-4">No hay setlists. ¡Crea el primero!</p>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedSetlist ? (
             <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-4 gap-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-bold text-gray-800 truncate">{selectedSetlist.name}</h3>
                        <p className="text-sm text-gray-500 break-words">{selectedSetlist.description}</p>
                    </div>
                     {canManageSetlists && (
                        <div className="flex flex-wrap gap-2 lg:flex-nowrap">
                           <Button variant="primary" onClick={() => setShowCreateMedleyModal(true)}>
                               <FaPlus className="mr-1" /> Crear Medley
                           </Button>
                            <Button variant="secondary" onClick={() => handleEdit(selectedSetlist)}>
                                <FaEdit className="mr-2" /> Editar
                            </Button>
                            <Button variant="secondary" onClick={() => handleDuplicateClick(selectedSetlist)}>
                                <FaCopy className="mr-2" /> Duplicar
                            </Button>
                            <Button variant="danger" onClick={() => handleDelete(selectedSetlist)}>
                                Eliminar
                            </Button>
                        </div>
                     )}
                 </div>
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
               <div>
                 <h4 className="font-semibold text-gray-700 mb-3">Canciones en el Setlist</h4>
                 <div className="space-y-2">
                   <DndContext 
                     sensors={sensors}
                     collisionDetection={closestCenter}
                     onDragEnd={handleDragEnd}
                   >
                     <SortableContext 
                       items={setlistItems.map(item => item.id)}
                       strategy={verticalListSortingStrategy}
                     >
                       {setlistItems.map((item, index) => (
                         <SortableSetlistItem
                           key={`${item.type}-${item.id}-${index}`}
                           item={item}
                           canManageSetlists={canManageSetlists}
                           songs={songs}
                           onRemoveSong={handleRemoveSongFromSetlist}
                           onSongAddedToMedley={handleSongAddedToMedley}
                           onSongRemovedFromMedley={handleSongRemovedFromMedley}
                           onMedleyRenamed={handleMedleyRenamed}
                           onMedleyDeleted={handleMedleyDeleted}
                         />
                       ))}
                     </SortableContext>
                   </DndContext>
                   {setlistItems.length === 0 && (
                     <p className="text-gray-500 text-sm py-4 text-center">
                       Este setlist está vacío.
                     </p>
                   )}
                 </div>
               </div>
   
               {canManageSetlists && (
                 <div>
                   <h4 className="font-semibold text-gray-700 mb-3">Añadir Canción al Setlist</h4>
                   <Input
                    placeholder="Buscar canción..."
                    value={addSongSearch}
                    onChange={(e) => setAddSongSearch(e.target.value)}
                    className="mb-2"
                   />
                   <div className="space-y-2 max-h-60 lg:max-h-80 overflow-y-auto pr-2">
                    {getAvailableSongs(selectedSetlist)
                      .filter(song => 
                        song.title.toLowerCase().includes(addSongSearch.toLowerCase()) ||
                        song.artist?.toLowerCase().includes(addSongSearch.toLowerCase())
                      )
                      .map(song => (
                       <div key={song.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                         <div>
                           <p className="font-medium text-sm">
                             {song.type === 'medley' && <span className="text-blue-600 mr-1">🎵</span>}
                             {song.title}
                           </p>
                           <p className="text-xs text-gray-500">
                             {song.type === 'medley' ? 'Medley' : song.artist}
                           </p>
                         </div>
                         <Button onClick={() => handleAddSongToSetlist(selectedSetlist.id, song.id)}>
                            <FaPlus />
                         </Button>
                       </div>
                     ))}
                     {getAvailableSongs(selectedSetlist).length === 0 && (
                       <p className="text-sm text-gray-500 text-center py-4">
                         Todas las canciones ya están en este setlist.
                       </p>
                     )}
                   </div>
                 </div>
               )}
             </div>
           </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Selecciona un setlist para ver los detalles</p>
            </div>
          )}
        </div>
      </div>

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

      {showDuplicateModal && setlistToDuplicate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Duplicar Setlist
            </h3>
            <p className="text-gray-600 mb-4">
              Introduce un nombre para el nuevo setlist:
            </p>
            <Input
              value={duplicateSetlistName}
              onChange={(e) => setDuplicateSetlistName(e.target.value)}
              className="mb-6"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setSetlistToDuplicate(null);
                  setDuplicateSetlistName('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={confirmDuplicate}
                disabled={!duplicateSetlistName.trim()}
              >
                Duplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreateMedleyModal && selectedSetlist && (
        <CreateMedleyModal
          isOpen={showCreateMedleyModal}
          onClose={() => setShowCreateMedleyModal(false)}
          groupId={groupId}
          availableSongs={getAvailableSongs(selectedSetlist)}
          onMedleyCreated={(newMedley) => {
            handleMedleyCreated(newMedley);
            setShowCreateMedleyModal(false);
          }}
        />
      )}

      {showImportPlaylistModal && (
        <ImportPlaylistModal
          isOpen={showImportPlaylistModal}
          onClose={() => setShowImportPlaylistModal(false)}
          groupId={groupId}
          onSetlistCreated={() => {
            loadData();
            setShowImportPlaylistModal(false);
          }}
        />
      )}
    </div>
  );
} 