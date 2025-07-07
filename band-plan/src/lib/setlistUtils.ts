import { supabase } from './supabase';
import { Song, Setlist, SetlistSong } from '../types';
import { safeSupabaseRequest } from './supabaseUtils';
import { toast } from 'react-hot-toast';

// Songs functions
export async function getSongsByGroup(groupId: string): Promise<Song[] | null> {
  return safeSupabaseRequest(
    () => supabase
      .from('songs')
      .select('*')
      .eq('group_id', groupId)
      .order('title'),
    'Error al cargar las canciones'
  );
}

export async function createSong(song: Omit<Song, 'id' | 'created_at' | 'updated_at'>): Promise<Song | null> {
  return safeSupabaseRequest(
    () => supabase
      .from('songs')
      .insert(song)
      .select()
      .single(),
    'Error al crear la canción'
  );
}

export async function updateSong(id: string, updates: Partial<Song>): Promise<Song | null> {
  return safeSupabaseRequest(
    () => supabase
      .from('songs')
      .update(updates)
      .eq('id', id)
      .select()
      .single(),
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
    () => supabase
      .from('setlists')
      .select(`
        *,
        songs:setlist_songs(
          *,
          song:songs(*)
        )
      `)
      .eq('group_id', groupId)
      .order('name'),
    'Error al cargar los setlists'
  );
}

export async function getSetlistWithSongs(setlistId: string): Promise<Setlist | null> {
  return safeSupabaseRequest(
    () => supabase
      .from('setlists')
      .select(`
        *,
        songs:setlist_songs(
          *,
          song:songs(*)
        )
      `)
      .eq('id', setlistId)
      .order('songs.position')
      .single(),
    'Error al cargar el setlist'
  );
}

export async function createSetlist(setlist: Omit<Setlist, 'id' | 'created_at' | 'updated_at'>): Promise<Setlist | null> {
  return safeSupabaseRequest(
    () => supabase
      .from('setlists')
      .insert(setlist)
      .select()
      .single(),
    'Error al crear el setlist'
  );
}

export async function updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist | null> {
  return safeSupabaseRequest(
    () => supabase
      .from('setlists')
      .update(updates)
      .eq('id', id)
      .select()
      .single(),
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
    const { error } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', setlistId)
      .eq('song_id', songId);
    
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return false;
    }

    // Use a transaction to update all positions at once
    const updates = songPositions.map(({ songId, position }) => ({
      setlist_id: setlistId,
      song_id: songId,
      position,
      created_by: user.id
    }));

    const { error } = await supabase
      .from('setlist_songs')
      .upsert(updates, { onConflict: 'setlist_id,song_id' });

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
    () => supabase
      .from('events')
      .update({ setlist_id: setlistId })
      .eq('id', eventId),
    'Error al asignar el setlist al evento'
  );
  return result !== null;
}

export async function getEventWithSetlist(eventId: number): Promise<any | null> {
  return safeSupabaseRequest(
    () => supabase
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
      .single(),
    'Error al cargar el evento con setlist'
  );
} 