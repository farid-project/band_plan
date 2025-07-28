-- Fix location field parsing in get_group_calendar function
CREATE OR REPLACE FUNCTION public.get_group_calendar(
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
      COALESCE(e.location, '') as venue_name,
      g.name as band_name
    FROM events e
    JOIN event_members em ON em.event_id = e.id
    JOIN groups g ON g.id = e.group_id
    WHERE em.group_member_id = p_member_id
    AND e.group_id = p_group_id
    ORDER BY e.date, e.time
  LOOP
    calendar_text := calendar_text ||
      'BEGIN:VEVENT' || chr(13) || chr(10) ||
      'UID:' || event_record.id || '@bandmanager.app' || chr(13) || chr(10) ||
      'DTSTAMP:' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
      'DTSTART;TZID=Europe/Madrid:' || to_char((event_record.date + event_record.time)::timestamp, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
      'DTEND;TZID=Europe/Madrid:' || to_char((event_record.date + event_record.time + interval '2 hours')::timestamp, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
      'SUMMARY:' || event_record.band_name || ' - ' || event_record.event_name || chr(13) || chr(10);

    IF event_record.venue_name != '' THEN
      calendar_text := calendar_text ||
        'LOCATION:' || event_record.venue_name || chr(13) || chr(10);
    END IF;

    IF event_record.notes != '' THEN
      calendar_text := calendar_text ||
        'DESCRIPTION:' || event_record.notes || chr(13) || chr(10);
    END IF;

    calendar_text := calendar_text ||
      'END:VEVENT' || chr(13) || chr(10);
  END LOOP;

  calendar_text := calendar_text || 'END:VCALENDAR' || chr(13) || chr(10);

  RETURN calendar_text;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_group_calendar(UUID, UUID) TO authenticated;