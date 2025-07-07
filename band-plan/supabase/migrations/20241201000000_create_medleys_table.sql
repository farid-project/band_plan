-- Crear tabla de medleys
CREATE TABLE IF NOT EXISTS public.medleys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de canciones dentro de medleys
CREATE TABLE IF NOT EXISTS public.medley_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medley_id UUID NOT NULL REFERENCES public.medleys(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(medley_id, position)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_medleys_setlist_id ON public.medleys(setlist_id);
CREATE INDEX IF NOT EXISTS idx_medleys_position ON public.medleys(position);
CREATE INDEX IF NOT EXISTS idx_medley_songs_medley_id ON public.medley_songs(medley_id);
CREATE INDEX IF NOT EXISTS idx_medley_songs_position ON public.medley_songs(position);

-- Crear función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear triggers para updated_at
CREATE TRIGGER update_medleys_updated_at BEFORE UPDATE ON public.medleys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medley_songs_updated_at BEFORE UPDATE ON public.medley_songs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Añadir políticas RLS para medleys
ALTER TABLE public.medleys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medley_songs ENABLE ROW LEVEL SECURITY;

-- Políticas para medleys
CREATE POLICY "Users can view medleys in their groups" ON public.medleys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.setlists s
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE s.id = medleys.setlist_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert medleys in their groups" ON public.medleys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.setlists s
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE s.id = medleys.setlist_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update medleys in their groups" ON public.medleys
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.setlists s
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE s.id = medleys.setlist_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete medleys in their groups" ON public.medleys
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.setlists s
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE s.id = medleys.setlist_id AND gm.user_id = auth.uid()
    )
  );

-- Políticas para medley_songs
CREATE POLICY "Users can view medley songs in their groups" ON public.medley_songs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.medleys m
      JOIN public.setlists s ON m.setlist_id = s.id
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE m.id = medley_songs.medley_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert medley songs in their groups" ON public.medley_songs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medleys m
      JOIN public.setlists s ON m.setlist_id = s.id
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE m.id = medley_songs.medley_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update medley songs in their groups" ON public.medley_songs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.medleys m
      JOIN public.setlists s ON m.setlist_id = s.id
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE m.id = medley_songs.medley_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete medley songs in their groups" ON public.medley_songs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.medleys m
      JOIN public.setlists s ON m.setlist_id = s.id
      JOIN public.groups g ON s.group_id = g.id
      JOIN public.group_members gm ON g.id = gm.group_id
      WHERE m.id = medley_songs.medley_id AND gm.user_id = auth.uid()
    )
  ); 