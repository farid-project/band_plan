-- Diagnose the calendar function issue
-- Check the current function definition
SELECT prosrc FROM pg_proc 
WHERE proname = 'get_group_calendar';

-- Check for events with problematic location data
SELECT id, name, location, 
       pg_typeof(location) as location_type,
       CASE 
         WHEN location IS NULL THEN 'NULL'
         WHEN location = '' THEN 'EMPTY'
         WHEN location::text ~ '^[\{\[]' THEN 'JSON-LIKE'
         ELSE 'TEXT'
       END as location_format
FROM events 
WHERE location IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- Check the schema of the events table location column
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name = 'location';