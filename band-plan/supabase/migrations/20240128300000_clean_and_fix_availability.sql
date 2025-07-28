-- Clean up duplicates and add group_member_id to member_availability table to support local members

-- First, let's remove duplicates by keeping only the most recent record for each user_id, date combination
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (
               PARTITION BY user_id, date 
               ORDER BY created_at DESC, id DESC
           ) as rn
    FROM public.member_availability
    WHERE user_id IS NOT NULL
),
to_delete AS (
    SELECT id FROM duplicates WHERE rn > 1
)
DELETE FROM public.member_availability 
WHERE id IN (SELECT id FROM to_delete);

-- Add the new column if it doesn't exist
ALTER TABLE public.member_availability 
ADD COLUMN IF NOT EXISTS group_member_id UUID REFERENCES public.group_members(id);

-- Make user_id nullable since local members won't have one
ALTER TABLE public.member_availability 
ALTER COLUMN user_id DROP NOT NULL;

-- Now create the unique indexes after cleaning duplicates
-- One for registered users (user_id + date) - only if user_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS member_availability_user_id_date_unique 
ON public.member_availability (user_id, date) 
WHERE user_id IS NOT NULL;

-- One for local members (group_member_id + date) - only if group_member_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS member_availability_group_member_id_date_unique 
ON public.member_availability (group_member_id, date) 
WHERE group_member_id IS NOT NULL;

-- Add check constraint to ensure either user_id or group_member_id is provided
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'member_availability_has_reference'
    ) THEN
        ALTER TABLE public.member_availability 
        ADD CONSTRAINT member_availability_has_reference 
        CHECK (
          (user_id IS NOT NULL AND group_member_id IS NULL) OR 
          (user_id IS NULL AND group_member_id IS NOT NULL)
        );
    END IF;
END
$$;

-- Update policies to handle both user_id and group_member_id
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.member_availability;
DROP POLICY IF EXISTS "Users can delete their own availability" ON public.member_availability;
DROP POLICY IF EXISTS "Users can manage availability" ON public.member_availability;
DROP POLICY IF EXISTS "Users can delete availability" ON public.member_availability;
DROP POLICY IF EXISTS "Users can update availability" ON public.member_availability;

-- New policy for INSERT - allows users to manage their own availability or group members
CREATE POLICY "Users can manage availability"
  ON public.member_availability FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    group_member_id IN (
      SELECT gm.id FROM public.group_members gm
      WHERE gm.user_id = auth.uid() OR 
      gm.group_id IN (
        SELECT gm2.group_id FROM public.group_members gm2
        WHERE gm2.user_id = auth.uid() AND gm2.role_in_group = 'principal'
      ) OR
      gm.group_id IN (
        SELECT g.id FROM public.groups g
        WHERE g.created_by = auth.uid()
      )
    )
  );

-- New policy for DELETE - allows users to delete their own availability or group members they manage
CREATE POLICY "Users can delete availability"
  ON public.member_availability FOR DELETE
  USING (
    auth.uid() = user_id OR 
    group_member_id IN (
      SELECT gm.id FROM public.group_members gm
      WHERE gm.user_id = auth.uid() OR 
      gm.group_id IN (
        SELECT gm2.group_id FROM public.group_members gm2
        WHERE gm2.user_id = auth.uid() AND gm2.role_in_group = 'principal'
      ) OR
      gm.group_id IN (
        SELECT g.id FROM public.groups g
        WHERE g.created_by = auth.uid()
      )
    )
  );

-- New policy for UPDATE
CREATE POLICY "Users can update availability"
  ON public.member_availability FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    group_member_id IN (
      SELECT gm.id FROM public.group_members gm
      WHERE gm.user_id = auth.uid() OR 
      gm.group_id IN (
        SELECT gm2.group_id FROM public.group_members gm2
        WHERE gm2.user_id = auth.uid() AND gm2.role_in_group = 'principal'
      ) OR
      gm.group_id IN (
        SELECT g.id FROM public.groups g
        WHERE g.created_by = auth.uid()
      )
    )
  );

-- Display information about what was cleaned up
DO $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- This is just for information - the actual cleanup happened above
    RAISE NOTICE 'Migration completed successfully. Duplicates have been cleaned up and local member support added.';
END
$$;