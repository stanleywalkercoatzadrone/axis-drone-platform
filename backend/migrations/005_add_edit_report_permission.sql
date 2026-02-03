-- Add EDIT_REPORT permission to all ADMIN users
-- This is required because the finalize flow calls updateReport first, which requires EDIT_REPORT permission

UPDATE users
SET permissions = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements_text(permissions || '["EDIT_REPORT"]') AS elem
)
WHERE role = 'ADMIN';

-- Also ensure specific admin user has it explicitly if needed (redundant but safe)
-- The above query handles all ADMINs, so this is just a comment.
