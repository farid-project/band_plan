-- Add member type field to group_members table
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'registered' CHECK (member_type IN ('registered', 'local'));

-- Add email field as optional (make it nullable if not already)
ALTER TABLE group_members 
ALTER COLUMN user_id DROP NOT NULL;

-- Add a check constraint to ensure either user_id OR email is provided for registered members
-- and neither is required for local members
ALTER TABLE group_members 
ADD CONSTRAINT check_member_data 
CHECK (
  (member_type = 'registered' AND (user_id IS NOT NULL OR email IS NOT NULL)) OR
  (member_type = 'local' AND name IS NOT NULL)
);

-- Add email column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'group_members' AND column_name = 'email') THEN
        ALTER TABLE group_members ADD COLUMN email TEXT;
    END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_group_members_type ON group_members(member_type);
CREATE INDEX IF NOT EXISTS idx_group_members_email ON group_members(email) WHERE email IS NOT NULL;

-- Update existing members to be 'registered' type
UPDATE group_members SET member_type = 'registered' WHERE member_type IS NULL;

-- Create function to add member with flexible options
CREATE OR REPLACE FUNCTION add_group_member_flexible(
  p_group_id UUID,
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'principal',
  p_user_id UUID DEFAULT NULL,
  p_instruments TEXT[] DEFAULT '{}',
  p_new_instruments TEXT[] DEFAULT '{}',
  p_member_type TEXT DEFAULT 'registered'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
  v_invitation_token TEXT;
  v_existing_user BOOLEAN := false;
  v_group_name TEXT;
  v_result JSON;
  v_new_role_id UUID;
  v_existing_role_id UUID;
  v_role_id UUID;
BEGIN
  -- Validate member type
  IF p_member_type NOT IN ('registered', 'local') THEN
    RAISE EXCEPTION 'Invalid member type: %', p_member_type;
  END IF;

  -- For registered members, validate that we have either email or user_id
  IF p_member_type = 'registered' AND p_email IS NULL AND p_user_id IS NULL THEN
    RAISE EXCEPTION 'Registered members must have either email or user_id';
  END IF;

  -- For local members, validate that we have a name
  IF p_member_type = 'local' AND (p_name IS NULL OR trim(p_name) = '') THEN
    RAISE EXCEPTION 'Local members must have a name';
  END IF;

  -- Get group name
  SELECT name INTO v_group_name FROM groups WHERE id = p_group_id;
  
  IF v_group_name IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  -- For registered members with email, check if user exists
  IF p_member_type = 'registered' AND p_email IS NOT NULL THEN
    SELECT id INTO p_user_id FROM auth.users WHERE email = lower(trim(p_email));
    v_existing_user := (p_user_id IS NOT NULL);
  END IF;

  -- Generate invitation token only for registered members
  IF p_member_type = 'registered' THEN
    v_invitation_token := encode(gen_random_bytes(32), 'base64');
  END IF;

  -- Insert the member
  INSERT INTO group_members (
    group_id, 
    user_id, 
    name, 
    email,
    role_in_group, 
    member_type,
    invitation_token,
    sync_calendar
  )
  VALUES (
    p_group_id,
    CASE WHEN p_member_type = 'registered' THEN p_user_id ELSE NULL END,
    p_name,
    CASE WHEN p_member_type = 'registered' THEN lower(trim(p_email)) ELSE NULL END,
    p_role,
    p_member_type,
    v_invitation_token,
    CASE WHEN p_member_type = 'registered' THEN false ELSE NULL END
  )
  RETURNING id INTO v_member_id;

  -- Add new instruments/roles
  FOR i IN 1..array_length(p_new_instruments, 1) LOOP
    -- Check if role already exists
    SELECT id INTO v_existing_role_id 
    FROM roles 
    WHERE name = p_new_instruments[i] AND group_id = p_group_id;
    
    IF v_existing_role_id IS NULL THEN
      -- Create new role
      INSERT INTO roles (name, group_id) 
      VALUES (p_new_instruments[i], p_group_id)
      RETURNING id INTO v_new_role_id;
      
      v_role_id := v_new_role_id;
    ELSE
      v_role_id := v_existing_role_id;
    END IF;
    
    -- Assign role to member
    INSERT INTO group_member_roles (group_member_id, role_id)
    VALUES (v_member_id, v_role_id)
    ON CONFLICT (group_member_id, role_id) DO NOTHING;
  END LOOP;

  -- Add existing instruments
  FOR i IN 1..array_length(p_instruments, 1) LOOP
    INSERT INTO group_member_roles (group_member_id, role_id)
    VALUES (v_member_id, p_instruments[i]::UUID)
    ON CONFLICT (group_member_id, role_id) DO NOTHING;
  END LOOP;

  -- Prepare result
  IF p_member_type = 'registered' THEN
    v_result := json_build_object(
      'member_id', v_member_id,
      'member_type', p_member_type,
      'invitation', json_build_object(
        'token', v_invitation_token,
        'email', p_email,
        'userExists', v_existing_user,
        'groupName', v_group_name,
        'groupMemberId', v_member_id
      )
    );
  ELSE
    v_result := json_build_object(
      'member_id', v_member_id,
      'member_type', p_member_type,
      'invitation', NULL
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Add comment to document the new functionality
COMMENT ON FUNCTION add_group_member_flexible IS 'Adds a group member with flexible options: registered (with email/invitation) or local (internal only)';

-- Update existing function to maintain compatibility
CREATE OR REPLACE FUNCTION add_group_member_with_instruments(
  p_group_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_role TEXT DEFAULT 'principal',
  p_user_id UUID DEFAULT NULL,
  p_instruments TEXT[] DEFAULT '{}',
  p_new_instruments TEXT[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the new flexible function with 'registered' type
  RETURN add_group_member_flexible(
    p_group_id,
    p_name,
    p_email,
    p_role,
    p_user_id,
    p_instruments,
    p_new_instruments,
    'registered'
  );
END;
$$;