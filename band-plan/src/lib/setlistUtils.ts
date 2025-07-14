import { supabase } from './supabase';
import { Song, Setlist, SetlistSong, Medley, MedleySong } from '../types';
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

export async function createSong(song: Omit<Song, 'id' | 'created_at' | 'updated_at'>): Promise<Song | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .insert(song)
        .select()
        .single();
      return { data: data as Song | null, error };
    },
    'Error al crear la canción'
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
        .single();
      return { data, error };
    },
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast.error('No se pudo obtener la información del usuario');
    return null;
  }
  
  const createdMedley = await safeSupabaseRequest<Medley>(
    async () => {
      const { data: medleyData, error: medleyError } = await supabase
        .from('medleys')
        .insert({ setlist_id: setlistId, name, position, created_by: user.id })
        .select()
        .single();

      if (medleyError) throw medleyError;

      if (songIds.length > 0) {
        const medleySongsData = songIds.map((song_id, index) => ({
          medley_id: medleyData.id,
          song_id,
          position: index + 1,
          created_by: user.id
        }));

        const { error: songsError } = await supabase
          .from('medley_songs')
          .insert(medleySongsData);

        if (songsError) throw songsError;
      }

      return { data: medleyData, error: null };
    },
    'Error al crear el medley'
  );

  if (createdMedley) {
    return getMedleyById(createdMedley.id);
  }

  return null;
}

export async function getMedleyById(medleyId: string): Promise<Medley | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('medleys')
        .select(`
          *,
          songs:medley_songs(
            *,
            song:songs(*)
          )
        `)
        .eq('id', medleyId)
        .single();
      return { data: data as Medley | null, error };
    },
    'Error al cargar el medley'
  );
}

export async function updateMedley(
  medleyId: string,
  updates: Partial<Medley>
): Promise<Medley | null> {
  return safeSupabaseRequest(
    async () => {
      const { data, error } = await supabase
        .from('medleys')
        .update(updates)
        .eq('id', medleyId)
        .select()
        .single();
      return { data: data as Medley | null, error };
    },
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
    const updates = songPositions.map(({ songId, position }) =>
      supabase
        .from('medley_songs')
        .update({ position })
        .eq('medley_id', medleyId)
        .eq('song_id', songId)
    );
    
    const results = await Promise.all(updates);
    const error = results.find(res => res.error);

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
    // 1. Obtener el setlist original con todas sus canciones y medleys
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

    // 5. Duplicar los medleys del setlist
    if (originalSetlist.medleys && originalSetlist.medleys.length > 0) {
      for (const medley of originalSetlist.medleys) {
        // Crear el nuevo medley
        const newMedley = await createMedley(
          newSetlist.id,
          medley.name,
          medley.position,
          []
        );

        if (newMedley && medley.songs && medley.songs.length > 0) {
          // Añadir las canciones al nuevo medley
          for (const medleySong of medley.songs) {
            await addSongToMedley(
              newMedley.id,
              medleySong.song_id,
              medleySong.position
            );
          }
        }
      }
    }

    // 6. Obtener el setlist completo con todas sus relaciones
    return await getSetlistWithSongs(newSetlist.id);
  } catch (error) {
    console.error('Error al duplicar el setlist:', error);
    toast.error('Error al duplicar el setlist');
    return null;
  }
}