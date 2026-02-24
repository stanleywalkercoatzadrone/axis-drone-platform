ALTER TABLE deployments ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Populate tenant_id from personnel involved in the deployment as a best effort
UPDATE deployments d
SET tenant_id = (
    SELECT p.tenant_id 
    FROM deployment_personnel dp
    JOIN personnel p ON dp.personnel_id = p.id
    WHERE dp.deployment_id = d.id
    LIMIT 1
)
WHERE d.tenant_id IS NULL;
