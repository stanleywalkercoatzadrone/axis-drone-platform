-- Migration 102: Remove fake client contact placeholders
-- Reverts dummy placeholders (like '100 Main Street', '94105', or '@example.com') to NULL or removes them from address JSONB

UPDATE clients
SET
  email = CASE WHEN email LIKE '%@example.com' THEN NULL ELSE email END,
  phone = CASE WHEN phone LIKE '(555) 019-%' THEN NULL ELSE phone END,
  primary_contact_name = CASE WHEN primary_contact_name = 'John Doe' THEN NULL ELSE primary_contact_name END,
  address = (
    CASE 
      WHEN address->>'street' = '100 Main Street' THEN address - 'street' - 'zip'
      ELSE address
    END
  );
