-- SIMPLE FUNCTION - Execute this after the SIMPLE_MIGRATION.sql

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
  v_role_id UUID;
  i INTEGER;
BEGIN
  -- Validate member type
  IF p_member_type NOT IN ('registered', 'local') THEN
    RAISE EXCEPTION 'Invalid member type: %', p_member_type;
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
    
    -- Generate invitation token
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
  IF p_new_instruments IS NOT NULL THEN
    FOR i IN 1..array_length(p_new_instruments, 1) LOOP
      -- Create new role
      INSERT INTO roles (name, group_id) 
      VALUES (p_new_instruments[i], p_group_id)
      ON CONFLICT (name, group_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_role_id;
      
      -- Assign role to member
      INSERT INTO group_member_roles (group_member_id, role_id)
      VALUES (v_member_id, v_role_id)
      ON CONFLICT (group_member_id, role_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Add existing instruments
  IF p_instruments IS NOT NULL THEN
    FOR i IN 1..array_length(p_instruments, 1) LOOP
      INSERT INTO group_member_roles (group_member_id, role_id)
      VALUES (v_member_id, p_instruments[i]::UUID)
      ON CONFLICT (group_member_id, role_id) DO NOTHING;
    END LOOP;
  END IF;

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