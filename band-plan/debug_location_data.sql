-- Debug location data in events table
-- Check recent events with location data
SELECT 
    id,
    name as event_name,
    location,
    pg_typeof(location) as location_type,
    length(location::text) as location_length,
    CASE 
        WHEN location IS NULL THEN 'NULL'
        WHEN location::text = '' THEN 'EMPTY_STRING'
        WHEN location::text ~ '^[\{\[]' THEN 'JSON_FORMAT'
        ELSE 'TEXT_FORMAT'
    END as location_format,
    created_at
FROM events 
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC 
LIMIT 10;

-- Check if there are any events with actual location data
SELECT COUNT(*) as total_events,
       COUNT(location) as events_with_location,
       COUNT(CASE WHEN location IS NOT NULL AND location::text != '' THEN 1 END) as events_with_non_empty_location
FROM events 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Sample some location data to see the format
SELECT DISTINCT 
    location,
    pg_typeof(location) as type
FROM events 
WHERE location IS NOT NULL 
AND location::text != ''
LIMIT 5;