-- Clean up personnel table
UPDATE personnel 
SET routing_number = regexp_replace(routing_number, '\D', '', 'g')
WHERE routing_number ~ '\D';

UPDATE personnel 
SET account_number = regexp_replace(account_number, '\D', '', 'g')
WHERE account_number ~ '\D';

UPDATE personnel 
SET swift_code = UPPER(regexp_replace(swift_code, '[^a-zA-Z0-9]', '', 'g'))
WHERE swift_code ~ '[^a-zA-Z0-9]';

-- Clean up pilot_banking_info table
UPDATE pilot_banking_info 
SET routing_number = regexp_replace(routing_number, '\D', '', 'g')
WHERE routing_number ~ '\D';

UPDATE pilot_banking_info 
SET account_number = regexp_replace(account_number, '\D', '', 'g')
WHERE account_number ~ '\D';

UPDATE pilot_banking_info 
SET swift_code = UPPER(regexp_replace(swift_code, '[^a-zA-Z0-9]', '', 'g'))
WHERE swift_code ~ '[^a-zA-Z0-9]';

-- Clean up invoices table (snapshotted data)
UPDATE invoices 
SET routing_number = regexp_replace(routing_number, '\D', '', 'g')
WHERE routing_number ~ '\D';

UPDATE invoices 
SET account_number = regexp_replace(account_number, '\D', '', 'g')
WHERE account_number ~ '\D';

UPDATE invoices 
SET swift_code = UPPER(regexp_replace(swift_code, '[^a-zA-Z0-9]', '', 'g'))
WHERE swift_code ~ '[^a-zA-Z0-9]';
