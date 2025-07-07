-- Añadir campos para agrupación de medleys en setlist_songs
ALTER TABLE public.setlist_songs
  ADD COLUMN IF NOT EXISTS medley_group_id UUID NULL,
  ADD COLUMN IF NOT EXISTS medley_group_name TEXT NULL;

-- (Opcional) Crear índice para medley_group_id para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_setlist_songs_medley_group_id ON public.setlist_songs(medley_group_id); 