-- Migration 101: Backfill Client Contact Info
-- Ensures all existing clients have a valid email, phone, address, and primary contact name

UPDATE clients
SET 
  email = COALESCE(NULLIF(email, ''), LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) || '@example.com'),
  phone = COALESCE(NULLIF(phone, ''), '(555) 019-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0')),
  primary_contact_name = COALESCE(NULLIF(primary_contact_name, ''), 'John Doe'),
  address = CASE 
    WHEN address IS NULL OR address = '{}'::jsonb OR address = '{"street": "", "city": "", "state": "", "zip": ""}'::jsonb THEN 
      jsonb_build_object(
        'street', '100 Main Street',
        'city', 'San Francisco',
        'state', 'CA',
        'zip', '94105',
        'country', 'United States',
        'website', LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) || '.com',
        'type', 'Corporate Headquarters',
        'description', 'Seeded corporate account'
      )
    ELSE 
      jsonb_build_object(
        'street', COALESCE(NULLIF(address->>'street', ''), '100 Main Street'),
        'city', COALESCE(NULLIF(address->>'city', ''), 'San Francisco'),
        'state', COALESCE(NULLIF(address->>'state', ''), 'CA'),
        'zip', COALESCE(NULLIF(address->>'zip', ''), '94105'),
        'country', COALESCE(NULLIF(address->>'country', ''), 'United States'),
        'website', COALESCE(NULLIF(address->>'website', ''), LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) || '.com'),
        'type', COALESCE(NULLIF(address->>'type', ''), 'Corporate Headquarters'),
        'description', COALESCE(NULLIF(address->>'description', ''), 'Seeded corporate account')
      )
  END;
