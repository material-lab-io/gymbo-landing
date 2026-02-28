-- Import existing waitlist subscribers into Listmonk
-- Run AFTER `./listmonk --install` has created the schema
--
-- Prerequisites:
--   1. Listmonk installed (creates subscribers, lists tables)
--   2. A list exists with id=1 (Listmonk creates a default list on install)
--
-- Usage:
--   psql "postgresql://postgres:PASSWORD@db.spldnbrqbuhmlgvwhahj.supabase.co:5432/postgres?sslmode=require" -f import-waitlist.sql

INSERT INTO subscribers (uuid, email, name, attribs, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  w.email,
  COALESCE(w.name, ''),
  jsonb_build_object('phone', w.phone, 'source', 'waitlist'),
  'enabled',
  w.created_at,
  NOW()
FROM waitlist w
WHERE w.email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- Subscribe all imported users to the default list (id=1)
INSERT INTO subscriber_lists (subscriber_id, list_id, status, created_at, updated_at)
SELECT s.id, 1, 'confirmed', NOW(), NOW()
FROM subscribers s
WHERE s.attribs->>'source' = 'waitlist'
  AND NOT EXISTS (
    SELECT 1 FROM subscriber_lists sl
    WHERE sl.subscriber_id = s.id AND sl.list_id = 1
  );
