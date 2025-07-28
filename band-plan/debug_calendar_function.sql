-- Debug version of get_group_calendar function with logging
CREATE OR REPLACE FUNCTION public.get_group_calendar_debug(
  p_group_id UUID,
  p_member_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calendar_text TEXT;
  event_record RECORD;
  group_name TEXT;
  safe_location TEXT;
  event_count INTEGER := 0;
  location_count INTEGER := 0;
BEGIN
  -- Obtener el nombre del grupo
  SELECT name INTO group_name
  FROM groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;

  -- Validar que el miembro pertenece al grupo
  IF NOT EXISTS (
    SELECT 1 
    FROM group_members 
    WHERE id = p_member_id 
    AND group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'El miembro no pertenece a este grupo';
  END IF;

  -- Iniciar el calendario con los headers necesarios y el nombre del grupo
  calendar_text := 'BEGIN:VCALENDAR' || chr(13) || chr(10) ||
                  'VERSION:2.0' || chr(13) || chr(10) ||
                  'PRODID:-//Band Manager//ES' || chr(13) || chr(10) ||
                  'X-WR-CALNAME:' || group_name || chr(13) || chr(10) ||
                  'NAME:' || group_name || chr(13) || chr(10) ||
                  'BEGIN:VTIMEZONE' || chr(13) || chr(10) ||
                  'TZID:Europe/Madrid' || chr(13) || chr(10) ||
                  'X-LIC-LOCATION:Europe/Madrid' || chr(13) || chr(10) ||
                  'END:VTIMEZONE' || chr(13) || chr(10);

  -- Obtener eventos
  FOR event_record IN 
    SELECT 
      e.id,
      e.name as event_name,
      e.date,
      e.time,
      COALESCE(e.notes, '') as notes,
      e.location as raw_location,
      g.name as band_name
    FROM events e
    JOIN event_members em ON em.event_id = e.id
    JOIN groups g ON g.id = e.group_id
    WHERE em.group_member_id = p_member_id
    AND e.group_id = p_group_id
    ORDER BY e.date, e.time
  LOOP
    event_count := event_count + 1;
    
    -- Safely extract location regardless of whether it's stored as JSON or TEXT
    BEGIN
      -- Try to parse as JSON first (in case it's stored as JSON)
      IF event_record.raw_location IS NOT NULL AND event_record.raw_location != '' THEN
        location_count := location_count + 1;
        IF event_record.raw_location::text ~ '^[\{\[]' THEN
          -- It looks like JSON, try to parse it
          safe_location := COALESCE(event_record.raw_location->>'name', event_record.raw_location::text);
        ELSE
          -- It's plain text
          safe_location := event_record.raw_location::text;
        END IF;
      ELSE
        safe_location := '';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If JSON parsing fails, treat as plain text
      safe_location := COALESCE(event_record.raw_location::text, '');
    END;

    calendar_text := calendar_text ||
      'BEGIN:VEVENT' || chr(13) || chr(10) ||
      'UID:' || event_record.id || '@bandmanager.app' || chr(13) || chr(10) ||
      'DTSTAMP:' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
      'DTSTART;TZID=Europe/Madrid:' || to_char((event_record.date + event_record.time)::timestamp, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
      'DTEND;TZID=Europe/Madrid:' || to_char((event_record.date + event_record.time + interval '2 hours')::timestamp, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
      'SUMMARY:' || event_record.band_name || ' - ' || event_record.event_name || chr(13) || chr(10);

    -- Add debug information to description
    calendar_text := calendar_text ||
      'DESCRIPTION:' || event_record.notes;
    
    IF event_record.notes != '' AND safe_location != '' THEN
      calendar_text := calendar_text || chr(13) || chr(10) || chr(13) || chr(10);
    END IF;
    
    -- Add debug info about location
    calendar_text := calendar_text || 
      'DEBUG - Raw location: ' || COALESCE(event_record.raw_location::text, 'NULL') || chr(13) || chr(10) ||
      'DEBUG - Safe location: ' || COALESCE(safe_location, 'NULL') || chr(13) || chr(10);

    IF safe_location != '' THEN
      calendar_text := calendar_text ||
        'LOCATION:' || safe_location || chr(13) || chr(10);
    END IF;

    calendar_text := calendar_text ||
      'END:VEVENT' || chr(13) || chr(10);
  END LOOP;

  -- Add summary debug info
  calendar_text := calendar_text ||
    'BEGIN:VEVENT' || chr(13) || chr(10) ||
    'UID:debug@bandmanager.app' || chr(13) || chr(10) ||
    'DTSTAMP:' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
    'DTSTART;TZID=Europe/Madrid:' || to_char(NOW()::timestamp, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
    'DTEND;TZID=Europe/Madrid:' || to_char((NOW() + interval '1 hour')::timestamp, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
    'SUMMARY:DEBUG INFO' || chr(13) || chr(10) ||
    'DESCRIPTION:Total events: ' || event_count || ', Events with location: ' || location_count || chr(13) || chr(10) ||
    'END:VEVENT' || chr(13) || chr(10);

  calendar_text := calendar_text || 'END:VCALENDAR' || chr(13) || chr(10);

  RETURN calendar_text;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_group_calendar_debug(UUID, UUID) TO authenticated;