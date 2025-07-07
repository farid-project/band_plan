-- Migrar medleys del sistema anterior al nuevo
-- Este script debe ejecutarse después de crear las nuevas tablas pero antes de eliminar los campos antiguos

-- Crear medleys basados en medley_group_id existentes
INSERT INTO public.medleys (setlist_id, name, position, created_by, created_at, updated_at)
SELECT DISTINCT 
  ss.setlist_id,
  ss.medley_group_name,
  ROW_NUMBER() OVER (PARTITION BY ss.setlist_id ORDER BY MIN(ss.position)) as position,
  ss.created_by,
  NOW(),
  NOW()
FROM public.setlist_songs ss
WHERE ss.medley_group_id IS NOT NULL
GROUP BY ss.setlist_id, ss.medley_group_name, ss.medley_group_id, ss.created_by;

-- Añadir canciones a los medleys
INSERT INTO public.medley_songs (medley_id, song_id, position, created_by, created_at, updated_at)
SELECT 
  m.id,
  ss.song_id,
  ss.position,
  ss.created_by,
  NOW(),
  NOW()
FROM public.setlist_songs ss
JOIN public.medleys m ON m.setlist_id = ss.setlist_id AND m.name = ss.medley_group_name
WHERE ss.medley_group_id IS NOT NULL;

-- Eliminar las canciones que ahora están en medleys de setlist_songs
DELETE FROM public.setlist_songs
WHERE medley_group_id IS NOT NULL; 