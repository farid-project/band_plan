-- Crear tabla para grabaciones de referencia de canciones
CREATE TABLE IF NOT EXISTS public.song_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('audio', 'video', 'url', 'file')),
  title VARCHAR NOT NULL,
  url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type VARCHAR,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.song_references ENABLE ROW LEVEL SECURITY;

-- Añadir trigger para updated_at
CREATE TRIGGER set_updated_at_song_references
  BEFORE UPDATE ON public.song_references
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Políticas RLS para song_references
CREATE POLICY "Group members can view song references"
  ON public.song_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.songs s
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE s.id = song_references.song_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members and admins can manage song references"
  ON public.song_references FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin puede gestionar cualquier referencia
        u.role = 'admin'
        OR
        -- Miembros principales pueden gestionar referencias de su grupo
        EXISTS (
          SELECT 1 FROM public.songs s
          JOIN public.group_members gm ON gm.group_id = s.group_id
          WHERE s.id = song_references.song_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

CREATE POLICY "Principal members and admins can update song references"
  ON public.song_references FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin puede gestionar cualquier referencia
        u.role = 'admin'
        OR
        -- Miembros principales pueden gestionar referencias de su grupo
        EXISTS (
          SELECT 1 FROM public.songs s
          JOIN public.group_members gm ON gm.group_id = s.group_id
          WHERE s.id = song_references.song_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
        OR
        -- El creador puede editar sus propias referencias
        song_references.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Principal members and admins can delete song references"
  ON public.song_references FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin puede gestionar cualquier referencia
        u.role = 'admin'
        OR
        -- Miembros principales pueden gestionar referencias de su grupo
        EXISTS (
          SELECT 1 FROM public.songs s
          JOIN public.group_members gm ON gm.group_id = s.group_id
          WHERE s.id = song_references.song_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
        OR
        -- El creador puede eliminar sus propias referencias
        song_references.created_by = auth.uid()
      )
    )
  );

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_song_references_song_id ON public.song_references(song_id);
CREATE INDEX IF NOT EXISTS idx_song_references_type ON public.song_references(type);
CREATE INDEX IF NOT EXISTS idx_song_references_created_by ON public.song_references(created_by);

-- Crear bucket de almacenamiento para archivos de referencia si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('song-references', 'song-references', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para el bucket de almacenamiento
CREATE POLICY "Group members can view song reference files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'song-references'
    AND EXISTS (
      SELECT 1 FROM public.song_references sr
      JOIN public.songs s ON s.id = sr.song_id
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE sr.file_path = name
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members can upload song reference files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'song-references'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Principal members can update song reference files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'song-references'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Principal members can delete song reference files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'song-references'
    AND auth.uid() IS NOT NULL
  );