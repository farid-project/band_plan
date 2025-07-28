-- SIMPLE MIGRATION - Execute each step separately in Supabase SQL Editor

-- STEP 1: Add member_type column
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'registered';

-- STEP 2: Add email column  
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS email TEXT;

-- STEP 3: Add constraint for member_type
ALTER TABLE group_members 
DROP CONSTRAINT IF EXISTS check_member_type;

ALTER TABLE group_members 
ADD CONSTRAINT check_member_type CHECK (member_type IN ('registered', 'local'));

-- STEP 4: Update existing members
UPDATE group_members 
SET member_type = 'registered' 
WHERE member_type IS NULL;

-- STEP 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_group_members_type ON group_members(member_type);
CREATE INDEX IF NOT EXISTS idx_group_members_email ON group_members(email) WHERE email IS NOT NULL;