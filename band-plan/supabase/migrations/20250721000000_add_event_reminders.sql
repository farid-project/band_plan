-- Create event_reminders table for automated notifications
CREATE TABLE event_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    group_member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '2h', '30min')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    notification_method TEXT NOT NULL DEFAULT 'browser' CHECK (notification_method IN ('browser', 'email', 'both')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, group_member_id, reminder_type)
);

-- Enable RLS
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reminders"
    ON event_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.id = event_reminders.group_member_id
            AND (
                gm.user_id = auth.uid() OR
                g.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage reminders"
    ON event_reminders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.id = event_reminders.group_member_id
            AND g.created_by = auth.uid()
        )
    );

-- Function to automatically create reminders when event is created/updated
CREATE OR REPLACE FUNCTION create_event_reminders()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete existing reminders for this event if updating
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM event_reminders WHERE event_id = NEW.id;
    END IF;

    -- Create reminders for selected members only
    INSERT INTO event_reminders (event_id, group_member_id, reminder_type, scheduled_for)
    SELECT 
        NEW.id,
        em.group_member_id,
        reminder_type,
        CASE 
            WHEN reminder_type = '24h' THEN NEW.datetime - INTERVAL '24 hours'
            WHEN reminder_type = '2h' THEN NEW.datetime - INTERVAL '2 hours'
            WHEN reminder_type = '30min' THEN NEW.datetime - INTERVAL '30 minutes'
        END as scheduled_for
    FROM event_members em
    CROSS JOIN (VALUES ('24h'), ('2h'), ('30min')) AS r(reminder_type)
    WHERE em.event_id = NEW.id
    AND NEW.datetime > NOW() + CASE 
        WHEN reminder_type = '24h' THEN INTERVAL '24 hours'
        WHEN reminder_type = '2h' THEN INTERVAL '2 hours'
        WHEN reminder_type = '30min' THEN INTERVAL '30 minutes'
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create reminders automatically
CREATE TRIGGER trigger_create_event_reminders
    AFTER INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION create_event_reminders();

-- Function to get pending reminders (for cron job or client polling)
CREATE OR REPLACE FUNCTION get_pending_reminders()
RETURNS TABLE (
    id UUID,
    event_id UUID,
    group_member_id UUID,
    reminder_type TEXT,
    event_title TEXT,
    event_datetime TIMESTAMPTZ,
    member_name TEXT,
    member_email TEXT,
    user_id UUID,
    group_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        er.id,
        er.event_id,
        er.group_member_id,
        er.reminder_type,
        e.title as event_title,
        e.datetime as event_datetime,
        gm.name as member_name,
        u.email as member_email,
        gm.user_id,
        g.name as group_name
    FROM event_reminders er
    JOIN events e ON er.event_id = e.id
    JOIN group_members gm ON er.group_member_id = gm.id
    JOIN groups g ON gm.group_id = g.id
    LEFT JOIN auth.users u ON gm.user_id = u.id
    WHERE er.scheduled_for <= NOW()
    AND er.sent_at IS NULL
    ORDER BY er.scheduled_for ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark reminder as sent
CREATE OR REPLACE FUNCTION mark_reminder_sent(reminder_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE event_reminders 
    SET sent_at = NOW() 
    WHERE id = reminder_id;
END;
$$ LANGUAGE plpgsql;

-- Add notification preferences to users
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"browser": true, "email": false, "reminders": {"24h": true, "2h": true, "30min": true}}';