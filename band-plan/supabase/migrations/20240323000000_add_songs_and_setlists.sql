-- Create songs table (pool de canciones de cada banda)
CREATE TABLE IF NOT EXISTS public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  duration_minutes INTEGER,
  key TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create setlists table
CREATE TABLE IF NOT EXISTS public.setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  estimated_duration_minutes INTEGER,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create setlist_songs table (relación entre setlists y canciones con orden)
CREATE TABLE IF NOT EXISTS public.setlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(setlist_id, position),
  UNIQUE(setlist_id, song_id)
);

-- Add setlist_id to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

-- Create updated_at triggers for new tables
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.songs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.setlists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.setlist_songs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies for songs
CREATE POLICY "Users can view songs for their groups"
  ON public.songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = songs.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members and admins can manage songs"
  ON public.songs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = songs.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

-- RLS Policies for setlists
CREATE POLICY "Users can view setlists for their groups"
  ON public.setlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = setlists.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members and admins can manage setlists"
  ON public.setlists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = setlists.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

-- RLS Policies for setlist_songs
CREATE POLICY "Users can view setlist songs for their groups"
  ON public.setlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.setlists s
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE s.id = setlist_songs.setlist_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members and admins can manage setlist songs"
  ON public.setlist_songs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR
        EXISTS (
          SELECT 1 FROM public.setlists s
          JOIN public.group_members gm ON gm.group_id = s.group_id
          WHERE s.id = setlist_songs.setlist_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_songs_group_id ON public.songs(group_id);
CREATE INDEX IF NOT EXISTS idx_setlists_group_id ON public.setlists(group_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_id ON public.setlist_songs(setlist_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_position ON public.setlist_songs(setlist_id, position); 