-- Eliminar campos del sistema anterior de medleys
ALTER TABLE public.setlist_songs
  DROP COLUMN IF EXISTS medley_group_id,
  DROP COLUMN IF EXISTS medley_group_name;

-- Eliminar índice si existe
DROP INDEX IF EXISTS idx_setlist_songs_medley_group_id; 