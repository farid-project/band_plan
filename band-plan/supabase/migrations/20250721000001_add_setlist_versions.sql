-- Create setlist_versions table for version control
CREATE TABLE setlist_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setlist_id UUID NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    change_summary TEXT, -- Brief description of what changed
    is_current_version BOOLEAN DEFAULT FALSE,
    -- Store the snapshot of setlist data at this version
    version_data JSONB NOT NULL, -- Contains songs, order, medleys, etc.
    UNIQUE(setlist_id, version_number)
);

-- Create version_changes table for detailed change tracking
CREATE TABLE setlist_version_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    version_id UUID NOT NULL REFERENCES setlist_versions(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed', 'modified', 'reordered')),
    item_type TEXT NOT NULL CHECK (item_type IN ('song', 'medley', 'position')),
    item_id UUID, -- Song or medley ID if applicable
    old_value JSONB, -- Previous state
    new_value JSONB, -- New state
    position_old INTEGER, -- Old position for reordering
    position_new INTEGER, -- New position for reordering
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE setlist_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_version_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for setlist_versions
CREATE POLICY "Users can view setlist versions they have access to"
    ON setlist_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM setlists s
            JOIN groups g ON s.group_id = g.id
            LEFT JOIN group_members gm ON g.id = gm.group_id
            WHERE s.id = setlist_versions.setlist_id
            AND (
                g.created_by = auth.uid() OR
                gm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Group admins can manage setlist versions"
    ON setlist_versions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM setlists s
            JOIN groups g ON s.group_id = g.id
            WHERE s.id = setlist_versions.setlist_id
            AND g.created_by = auth.uid()
        )
    );

-- RLS Policies for setlist_version_changes
CREATE POLICY "Users can view version changes they have access to"
    ON setlist_version_changes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM setlist_versions sv
            JOIN setlists s ON sv.setlist_id = s.id
            JOIN groups g ON s.group_id = g.id
            LEFT JOIN group_members gm ON g.id = gm.group_id
            WHERE sv.id = setlist_version_changes.version_id
            AND (
                g.created_by = auth.uid() OR
                gm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Group admins can manage version changes"
    ON setlist_version_changes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM setlist_versions sv
            JOIN setlists s ON sv.setlist_id = s.id
            JOIN groups g ON s.group_id = g.id
            WHERE sv.id = setlist_version_changes.version_id
            AND g.created_by = auth.uid()
        )
    );

-- Function to create a new setlist version
CREATE OR REPLACE FUNCTION create_setlist_version(
    p_setlist_id UUID,
    p_change_summary TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_version_number INTEGER;
    v_version_id UUID;
    v_setlist_data JSONB;
BEGIN
    -- Get the next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version_number
    FROM setlist_versions
    WHERE setlist_id = p_setlist_id;

    -- Get current setlist data
    SELECT json_build_object(
        'name', name,
        'description', description,
        'songs', (
            SELECT json_agg(
                json_build_object(
                    'id', ss.id,
                    'position', ss.position,
                    'song_id', ss.song_id,
                    'song', json_build_object(
                        'id', s.id,
                        'title', s.title,
                        'artist', s.artist,
                        'duration', s.duration,
                        'key', s.key,
                        'notes', s.notes,
                        'type', s.type,
                        'medley_song_ids', s.medley_song_ids
                    )
                )
                ORDER BY ss.position
            )
            FROM setlist_songs ss
            JOIN songs s ON ss.song_id = s.id
            WHERE ss.setlist_id = p_setlist_id
        )
    )
    INTO v_setlist_data
    FROM setlists
    WHERE id = p_setlist_id;

    -- Mark all previous versions as not current
    UPDATE setlist_versions
    SET is_current_version = FALSE
    WHERE setlist_id = p_setlist_id;

    -- Insert new version
    INSERT INTO setlist_versions (
        setlist_id,
        version_number,
        name,
        description,
        created_by,
        change_summary,
        is_current_version,
        version_data
    )
    SELECT 
        p_setlist_id,
        v_version_number,
        name,
        description,
        auth.uid(),
        p_change_summary,
        TRUE,
        v_setlist_data
    FROM setlists
    WHERE id = p_setlist_id
    RETURNING id INTO v_version_id;

    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Function to restore a setlist to a specific version
CREATE OR REPLACE FUNCTION restore_setlist_version(
    p_version_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_setlist_id UUID;
    v_version_data JSONB;
    v_song_item JSONB;
BEGIN
    -- Get version data
    SELECT setlist_id, version_data
    INTO v_setlist_id, v_version_data
    FROM setlist_versions
    WHERE id = p_version_id;

    IF v_setlist_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Update setlist basic info
    UPDATE setlists
    SET 
        name = v_version_data->>'name',
        description = v_version_data->>'description',
        updated_at = NOW()
    WHERE id = v_setlist_id;

    -- Delete current songs
    DELETE FROM setlist_songs WHERE setlist_id = v_setlist_id;

    -- Restore songs from version data
    FOR v_song_item IN SELECT * FROM jsonb_array_elements(v_version_data->'songs')
    LOOP
        INSERT INTO setlist_songs (setlist_id, song_id, position)
        VALUES (
            v_setlist_id,
            (v_song_item->'song_id')::UUID,
            (v_song_item->>'position')::INTEGER
        );
    END LOOP;

    -- Mark this version as current
    UPDATE setlist_versions
    SET is_current_version = FALSE
    WHERE setlist_id = v_setlist_id;

    UPDATE setlist_versions
    SET is_current_version = TRUE
    WHERE id = p_version_id;

    -- Create a new version entry for this restoration
    PERFORM create_setlist_version(
        v_setlist_id,
        'Restored to version ' || (SELECT version_number FROM setlist_versions WHERE id = p_version_id)
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to compare two versions
CREATE OR REPLACE FUNCTION compare_setlist_versions(
    p_version_id_1 UUID,
    p_version_id_2 UUID
) RETURNS TABLE (
    change_type TEXT,
    item_title TEXT,
    old_position INTEGER,
    new_position INTEGER,
    details JSONB
) AS $$
BEGIN
    -- This is a simplified comparison - in practice you'd want more sophisticated diff logic
    RETURN QUERY
    WITH 
    v1_songs AS (
        SELECT 
            (song_item->>'position')::INTEGER as position,
            song_item->'song'->>'title' as title,
            song_item->'song'->>'artist' as artist,
            song_item->'song_id' as song_id
        FROM setlist_versions sv1,
        LATERAL jsonb_array_elements(sv1.version_data->'songs') as song_item
        WHERE sv1.id = p_version_id_1
    ),
    v2_songs AS (
        SELECT 
            (song_item->>'position')::INTEGER as position,
            song_item->'song'->>'title' as title,
            song_item->'song'->>'artist' as artist,
            song_item->'song_id' as song_id
        FROM setlist_versions sv2,
        LATERAL jsonb_array_elements(sv2.version_data->'songs') as song_item
        WHERE sv2.id = p_version_id_2
    )
    -- Songs added in v2
    SELECT 
        'added'::TEXT,
        v2.title || ' - ' || v2.artist,
        NULL::INTEGER,
        v2.position,
        json_build_object('song_id', v2.song_id)::JSONB
    FROM v2_songs v2
    LEFT JOIN v1_songs v1 ON v2.song_id = v1.song_id
    WHERE v1.song_id IS NULL
    
    UNION ALL
    
    -- Songs removed from v1
    SELECT 
        'removed'::TEXT,
        v1.title || ' - ' || v1.artist,
        v1.position,
        NULL::INTEGER,
        json_build_object('song_id', v1.song_id)::JSONB
    FROM v1_songs v1
    LEFT JOIN v2_songs v2 ON v1.song_id = v2.song_id
    WHERE v2.song_id IS NULL
    
    UNION ALL
    
    -- Songs reordered
    SELECT 
        'reordered'::TEXT,
        v1.title || ' - ' || v1.artist,
        v1.position,
        v2.position,
        json_build_object('song_id', v1.song_id)::JSONB
    FROM v1_songs v1
    JOIN v2_songs v2 ON v1.song_id = v2.song_id
    WHERE v1.position != v2.position
    
    ORDER BY old_position NULLS LAST, new_position NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create versions when setlist changes significantly
CREATE OR REPLACE FUNCTION auto_version_setlist()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create versions for significant changes (not just metadata updates)
    IF TG_TABLE_NAME = 'setlist_songs' THEN
        -- Song added, removed, or reordered
        PERFORM create_setlist_version(
            COALESCE(NEW.setlist_id, OLD.setlist_id),
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'Added song'
                WHEN TG_OP = 'DELETE' THEN 'Removed song'
                WHEN TG_OP = 'UPDATE' THEN 'Modified song order'
            END
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic versioning (optional - can be disabled if too aggressive)
-- CREATE TRIGGER trigger_auto_version_setlist_songs
--     AFTER INSERT OR UPDATE OR DELETE ON setlist_songs
--     FOR EACH ROW
--     EXECUTE FUNCTION auto_version_setlist();