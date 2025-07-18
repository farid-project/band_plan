import { supabase } from './supabase';
import { Song, Setlist, SetlistSong } from '../types';
import { safeSupabaseRequest } from './supabaseUtils';
import { toast } from 'react-hot-toast';

// Songs functions
export async function getSongsByGroup(groupId: string): Promise<Song[] | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('group_id', groupId)
        .order('title');
      return { data: data as Song[] | null, error };
    },
    'Error al cargar las canciones'
  );
}

export async function getRegularSongsByGroup(groupId: string): Promise<Song[] | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('group_id', groupId)
        .eq('type', 'song')
        .order('title');
      return { data: data as Song[] | null, error };
    },
    'Error al cargar las canciones'
  );
}

export async function getMedleysByGroup(groupId: string): Promise<Song[] | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('group_id', groupId)
        .eq('type', 'medley')
        .order('title');
      return { data: data as Song[] | null, error };
    },
    'Error al cargar los medleys'
  );
}

export async function createSong(song: Omit<Song, 'id' | 'created_at' | 'updated_at'>): Promise<Song | null> {
  const songData = {
    ...song,
    type: song.type || 'song'
  };
  
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .insert(songData)
        .select()
        .single();
      return { data: data as Song | null, error };
    },
    'Error al crear la canción'
  );
}

export async function createMedley(
  groupId: string,
  name: string,
  songIds: string[]
): Promise<Song | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast.error('No se pudo obtener la información del usuario');
    return null;
  }
  
  const medleyData = {
    group_id: groupId,
    title: name,
    type: 'medley' as const,
    medley_song_ids: songIds,
    created_by: user.id
  };
  
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .insert(medleyData)
        .select()
        .single();
      return { data: data as Song | null, error };
    },
    'Error al crear el medley'
  );
}

export async function updateSong(id: string, updates: Partial<Song>): Promise<Song | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      return { data: data as Song | null, error };
    },
    'Error al actualizar la canción'
  );
}

export async function deleteSong(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error al eliminar la canción:', error);
      toast.error('Error al eliminar la canción');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error al eliminar la canción:', error);
    toast.error('Error al eliminar la canción');
    return false;
  }
}

// Setlists functions
export async function getSetlistsByGroup(groupId: string): Promise<Setlist[] | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('setlists')
        .select(`
          *,
          songs:setlist_songs(
            *,
            song:songs(*)
          )
        `)
        .eq('group_id', groupId)
        .order('name');
      return { data: data as Setlist[] | null, error };
    },
    'Error al cargar los setlists'
  );
}

export async function getSetlistWithSongs(setlistId: string): Promise<Setlist | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('setlists')
        .select(`
          *,
          songs:setlist_songs(
            *,
            song:songs(*)
          )
        `)
        .eq('id', setlistId)
        .single();
      return { data: data as Setlist | null, error };
    },
    'Error al cargar el setlist'
  );
}

export async function createSetlist(setlist: Omit<Setlist, 'id' | 'created_at' | 'updated_at'>): Promise<Setlist | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('setlists')
        .insert(setlist)
        .select()
        .single();
      return { data: data as Setlist | null, error };
    },
    'Error al crear el setlist'
  );
}

export async function updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('setlists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      return { data: data as Setlist | null, error };
    },
    'Error al actualizar el setlist'
  );
}

export async function deleteSetlist(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('setlists')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error al eliminar el setlist:', error);
      toast.error('Error al eliminar el setlist');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error al eliminar el setlist:', error);
    toast.error('Error al eliminar el setlist');
    return false;
  }
}

// Setlist songs functions
export async function addSongToSetlist(
  setlistId: string, 
  songId: string, 
  position: number
): Promise<SetlistSong | null> {
  try {
    console.log('Iniciando addSongToSetlist con:', { setlistId, songId, position });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No se pudo obtener la información del usuario');
      toast.error('No se pudo obtener la información del usuario');
      return null;
    }

    console.log('Usuario autenticado:', user.id);

    const insertData = {
      setlist_id: setlistId,
      song_id: songId,
      position,
      created_by: user.id
    };

    console.log('Datos a insertar:', insertData);

    const { data, error } = await supabase
      .from('setlist_songs')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error de Supabase al añadir la canción al setlist:', error);
      console.error('Código de error:', error.code);
      console.error('Mensaje de error:', error.message);
      console.error('Detalles:', error.details);
      toast.error(`Error al añadir la canción al setlist: ${error.message}`);
      return null;
    }

    console.log('Canción añadida exitosamente:', data);
    return data;
  } catch (error) {
    console.error('Error general al añadir la canción al setlist:', error);
    toast.error('Error al añadir la canción al setlist');
    return null;
  }
}

export async function updateSetlistSongPosition(
  setlistId: string,
  songId: string,
  newPosition: number
): Promise<SetlistSong | null> {
  try {
    const { data, error } = await supabase
      .from('setlist_songs')
      .update({ position: newPosition })
      .eq('setlist_id', setlistId)
      .eq('song_id', songId)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar la posición de la canción:', error);
      toast.error('Error al actualizar la posición de la canción');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error al actualizar la posición de la canción:', error);
    toast.error('Error al actualizar la posición de la canción');
    return null;
  }
}

export async function removeSongFromSetlist(setlistId: string, songId: string): Promise<boolean> {
  try {
    const { error, count } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', setlistId)
      .eq('song_id', songId);
    
    console.log('Resultado de Supabase al eliminar:', { error, count });
    
    if (error) {
      console.error('Error al eliminar la canción del setlist:', error);
      toast.error('Error al eliminar la canción del setlist');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error al eliminar la canción del setlist:', error);
    toast.error('Error al eliminar la canción del setlist');
    return false;
  }
}

export async function reorderSetlistSongs(setlistId: string, songPositions: { songId: string; position: number }[]): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('reorder_setlist_songs', {
      p_setlist_id: setlistId,
      p_song_positions: songPositions,
    });

    if (error) {
      console.error('Error al reordenar las canciones del setlist:', error);
      toast.error('Error al reordenar las canciones del setlist');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error al reordenar las canciones del setlist:', error);
    toast.error('Error al reordenar las canciones del setlist');
    return false;
  }
}

// Event setlist functions
export async function assignSetlistToEvent(eventId: number, setlistId: string | null): Promise<boolean> {
  const result = await safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('events')
        .update({ setlist_id: setlistId })
        .eq('id', eventId);
      return { data, error };
    },
    'Error al asignar el setlist al evento'
  );
  return result !== null;
}

export async function getEventWithSetlist(eventId: number): Promise<any | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          setlist:setlists(
            *,
            songs:setlist_songs(
              *,
              song:songs(*)
            )
          )
        `)
        .eq('id', eventId)
        .single();
      return { data, error };
    },
    'Error al cargar el evento con setlist'
  );
}

export async function updateMedley(
  medleyId: string,
  updates: Partial<Song>
): Promise<Song | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .update(updates)
        .eq('id', medleyId)
        .eq('type', 'medley')
        .select()
        .single();
      return { data: data as Song | null, error };
    },
    'Error al actualizar el medley'
  );
}

export async function addSongToMedley(
  medleyId: string,
  songId: string
): Promise<Song | null> {
  try {
    // Obtener el medley actual
    const { data: medley, error: medleyError } = await supabase
      .from('songs')
      .select('medley_song_ids')
      .eq('id', medleyId)
      .eq('type', 'medley')
      .single();

    if (medleyError) {
      console.error('Error al obtener el medley:', medleyError);
      toast.error('Error al obtener el medley');
      return null;
    }

    // Añadir la nueva canción al array
    const currentSongIds = medley.medley_song_ids || [];
    const updatedSongIds = [...currentSongIds, songId];

    // Actualizar el medley
    const { data, error } = await supabase
      .from('songs')
      .update({ medley_song_ids: updatedSongIds })
      .eq('id', medleyId)
      .select()
      .single();

    if (error) {
      console.error('Error al añadir la canción al medley:', error);
      toast.error('Error al añadir la canción al medley');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error al añadir la canción al medley:', error);
    toast.error('Error al añadir la canción al medley');
    return null;
  }
}

export async function removeSongFromMedley(medleyId: string, songId: string): Promise<boolean> {
  try {
    // Obtener el medley actual
    const { data: medley, error: medleyError } = await supabase
      .from('songs')
      .select('medley_song_ids')
      .eq('id', medleyId)
      .eq('type', 'medley')
      .single();

    if (medleyError) {
      console.error('Error al obtener el medley:', medleyError);
      toast.error('Error al obtener el medley');
      return false;
    }

    // Remover la canción del array
    const currentSongIds = medley.medley_song_ids || [];
    const updatedSongIds = currentSongIds.filter(id => id !== songId);

    // Actualizar el medley
    const { error } = await supabase
      .from('songs')
      .update({ medley_song_ids: updatedSongIds })
      .eq('id', medleyId);

    if (error) {
      console.error('Error al eliminar la canción del medley:', error);
      toast.error('Error al eliminar la canción del medley');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error al eliminar la canción del medley:', error);
    toast.error('Error al eliminar la canción del medley');
    return false;
  }
}

export async function reorderMedleySongs(
  medleyId: string,
  songIds: string[]
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('songs')
      .update({ medley_song_ids: songIds })
      .eq('id', medleyId)
      .eq('type', 'medley');

    if (error) {
      console.error('Error al reordenar las canciones del medley:', error);
      toast.error('Error al reordenar las canciones del medley');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error al reordenar las canciones del medley:', error);
    toast.error('Error al reordenar las canciones del medley');
    return false;
  }
}

export async function deleteMedley(medleyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', medleyId)
      .eq('type', 'medley');
    
    if (error) {
      console.error('Error al eliminar el medley:', error);
      toast.error('Error al eliminar el medley');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error al eliminar el medley:', error);
    toast.error('Error al eliminar el medley');
    return false;
  }
}

export async function reorderSetlistItems(
  setlistId: string,
  items: { type: 'song' | 'medley'; id: string; position: number }[]
): Promise<boolean> {
  try {
    const p_items = items.map(item => ({
      item_id: item.id,
      item_type: item.type,
      new_position: item.position,
    }));

    const { error } = await supabase.rpc('reorder_setlist_items', {
      p_setlist_id: setlistId,
      p_items,
    });

    if (error) {
      console.error('Error al reordenar los items del setlist:', error);
      toast.error(`Error al reordenar: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error al reordenar los items del setlist:', error);
    toast.error('Ocurrió un error inesperado al reordenar.');
    return false;
  }
} 

export async function duplicateSetlist(setlistId: string, newName?: string): Promise<Setlist | null> {
  try {
    // 1. Obtener el setlist original con todas sus canciones
    const originalSetlist = await getSetlistWithSongs(setlistId);
    if (!originalSetlist) {
      toast.error('No se pudo encontrar el setlist original');
      return null;
    }

    // 2. Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return null;
    }

    // 3. Crear un nuevo setlist con los datos del original
    const newSetlistData = {
      name: newName || `${originalSetlist.name} (copia)`,
      description: originalSetlist.description,
      group_id: originalSetlist.group_id,
      estimated_duration_minutes: originalSetlist.estimated_duration_minutes,
      created_by: user.id
    };

    const newSetlist = await createSetlist(newSetlistData);
    if (!newSetlist) {
      toast.error('Error al crear el nuevo setlist');
      return null;
    }

    // 4. Duplicar las canciones del setlist
    if (originalSetlist.songs && originalSetlist.songs.length > 0) {
      const songPromises = originalSetlist.songs.map(song => 
        addSongToSetlist(newSetlist.id, song.song_id, song.position)
      );
      await Promise.all(songPromises);
    }

    // 5. Obtener el setlist completo con todas sus relaciones
    return await getSetlistWithSongs(newSetlist.id);
  } catch (error) {
    console.error('Error al duplicar el setlist:', error);
    toast.error('Error al duplicar el setlist');
    return null;
  }
}