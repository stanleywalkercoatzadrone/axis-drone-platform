-- 1. Sync daily_pay_rate from personnel to invoices where missing
UPDATE invoices i
SET daily_pay_rate = p.daily_pay_rate
FROM personnel p
WHERE i.personnel_id = p.id
AND i.daily_pay_rate IS NULL;

-- 2. If daily_pay_rate is still null (e.g. pilot has no rate set), try to get it from the last log
UPDATE invoices i
SET daily_pay_rate = (
    SELECT daily_pay 
    FROM daily_logs 
    WHERE technician_id = i.personnel_id 
    ORDER BY date DESC 
    LIMIT 1
)
WHERE i.daily_pay_rate IS NULL;
