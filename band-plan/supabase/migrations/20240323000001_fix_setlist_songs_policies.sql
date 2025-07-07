-- Drop existing policies for setlist_songs
DROP POLICY IF EXISTS "Users can view setlist songs for their groups" ON public.setlist_songs;
DROP POLICY IF EXISTS "Principal members and admins can manage setlist songs" ON public.setlist_songs;

-- Create corrected policies for setlist_songs
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

-- Also fix the songs and setlists policies to be more specific
DROP POLICY IF EXISTS "Principal members and admins can manage songs" ON public.songs;
DROP POLICY IF EXISTS "Principal members and admins can manage setlists" ON public.setlists;

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