-- 1. Sync pilot_banking_info back to personnel table for consistency
UPDATE personnel p
SET bank_name = pb.bank_name,
    account_number = pb.account_number,
    routing_number = pb.routing_number,
    swift_code = pb.swift_code,
    account_type = pb.account_type
FROM pilot_banking_info pb
WHERE p.id = pb.pilot_id
AND (p.bank_name IS NULL OR p.account_number IS NULL OR p.routing_number IS NULL);

-- 2. Populate NULL banking info in invoices table from the best available source
UPDATE invoices i
SET bank_name = COALESCE(i.bank_name, pb.bank_name, p.bank_name),
    account_number = COALESCE(i.account_number, pb.account_number, p.account_number),
    routing_number = COALESCE(i.routing_number, pb.routing_number, p.routing_number),
    swift_code = COALESCE(i.swift_code, pb.swift_code, p.swift_code),
    account_type = COALESCE(i.account_type, pb.account_type, p.account_type)
FROM personnel p
LEFT JOIN pilot_banking_info pb ON p.id = pb.pilot_id
WHERE i.personnel_id = p.id
AND (i.bank_name IS NULL OR i.account_number IS NULL OR i.routing_number IS NULL);

-- 3. Final cleanup of all tables to remove any special characters that might have been copied
UPDATE personnel 
SET routing_number = regexp_replace(routing_number, '\D', '', 'g')
WHERE routing_number ~ '\D';

UPDATE personnel 
SET account_number = regexp_replace(account_number, '\D', '', 'g')
WHERE account_number ~ '\D';

UPDATE pilot_banking_info 
SET routing_number = regexp_replace(routing_number, '\D', '', 'g')
WHERE routing_number ~ '\D';

UPDATE pilot_banking_info 
SET account_number = regexp_replace(account_number, '\D', '', 'g')
WHERE account_number ~ '\D';

UPDATE invoices 
SET routing_number = regexp_replace(routing_number, '\D', '', 'g')
WHERE routing_number ~ '\D';

UPDATE invoices 
SET account_number = regexp_replace(account_number, '\D', '', 'g')
WHERE account_number ~ '\D';
