import { supabase } from './supabase';
import { Song, Setlist, SetlistSong, Medley, MedleySong } from '../types';
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
        ),
        medleys(
          *,
          songs:medley_songs(
            *,
            song:songs(*)
          )
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
        ),
        medleys(
          *,
          songs:medley_songs(
            *,
            song:songs(*)
          )
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
          ),
          medleys(
            *,
            songs:medley_songs(
              *,
              song:songs(*)
            )
          )
        )
      `)
      .eq('id', eventId)
      .single(),
    'Error al cargar el evento con setlist'
  );
}

// Medley functions
export async function createMedley(
  setlistId: string,
  name: string,
  position: number,
  songIds: string[]
): Promise<Medley | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return null;
    }

    // Crear el medley
    const { data: medley, error: medleyError } = await supabase
      .from('medleys')
      .insert({
        setlist_id: setlistId,
        name,
        position,
        created_by: user.id
      })
      .select()
      .single();

    if (medleyError) {
      console.error('Error al crear el medley:', medleyError);
      toast.error('Error al crear el medley');
      return null;
    }

    // Añadir las canciones al medley
    const medleySongs = songIds.map((songId, index) => ({
      medley_id: medley.id,
      song_id: songId,
      position: index + 1,
      created_by: user.id
    }));

    const { error: songsError } = await supabase
      .from('medley_songs')
      .insert(medleySongs);

    if (songsError) {
      console.error('Error al añadir canciones al medley:', songsError);
      toast.error('Error al añadir canciones al medley');
      return null;
    }

    return medley;
  } catch (error) {
    console.error('Error al crear el medley:', error);
    toast.error('Error al crear el medley');
    return null;
  }
}

export async function updateMedley(
  medleyId: string,
  updates: Partial<Medley>
): Promise<Medley | null> {
  return safeSupabaseRequest(
    () => supabase
      .from('medleys')
      .update(updates)
      .eq('id', medleyId)
      .select()
      .single(),
    'Error al actualizar el medley'
  );
}

export async function deleteMedley(medleyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('medleys')
      .delete()
      .eq('id', medleyId);
    
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

export async function addSongToMedley(
  medleyId: string,
  songId: string,
  position: number
): Promise<MedleySong | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('medley_songs')
      .insert({
        medley_id: medleyId,
        song_id: songId,
        position,
        created_by: user.id
      })
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
    const { error } = await supabase
      .from('medley_songs')
      .delete()
      .eq('medley_id', medleyId)
      .eq('song_id', songId);
    
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
  songPositions: { songId: string; position: number }[]
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return false;
    }

    const updates = songPositions.map(({ songId, position }) => ({
      medley_id: medleyId,
      song_id: songId,
      position,
      created_by: user.id
    }));

    const { error } = await supabase
      .from('medley_songs')
      .upsert(updates, { onConflict: 'medley_id,song_id' });

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

export async function reorderSetlistItems(
  setlistId: string,
  items: { type: 'song' | 'medley'; id: string; position: number }[]
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No se pudo obtener la información del usuario');
      return false;
    }

    // Actualizar posiciones de canciones
    const songUpdates = items
      .filter(item => item.type === 'song')
      .map(item => ({
        setlist_id: setlistId,
        song_id: item.id,
        position: item.position,
        created_by: user.id
      }));

    if (songUpdates.length > 0) {
      const { error: songError } = await supabase
        .from('setlist_songs')
        .upsert(songUpdates, { onConflict: 'setlist_id,song_id' });

      if (songError) {
        console.error('Error al reordenar las canciones:', songError);
        toast.error('Error al reordenar las canciones');
        return false;
      }
    }

    // Actualizar posiciones de medleys
    const medleyUpdates = items
      .filter(item => item.type === 'medley')
      .map(item => ({
        id: item.id,
        position: item.position
      }));

    if (medleyUpdates.length > 0) {
      for (const update of medleyUpdates) {
        const { error: medleyError } = await supabase
          .from('medleys')
          .update({ position: update.position })
          .eq('id', update.id);

        if (medleyError) {
          console.error('Error al reordenar los medleys:', medleyError);
          toast.error('Error al reordenar los medleys');
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error al reordenar los elementos del setlist:', error);
    toast.error('Error al reordenar los elementos del setlist');
    return false;
  }
} 