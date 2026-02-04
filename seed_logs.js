import db from './backend/config/database.js';

async function seedDailyLogs() {
    try {
        console.log('🌱 Seeding sample daily logs...');

        // Insert sample daily logs for testing (linked to seeded deployments and personnel)
        const seedSql = `
        DO $$
        DECLARE
            dep_id_1 UUID;
            dep_id_2 UUID;
            dep_id_3 UUID;
            per_id_alex UUID;
            per_id_sarah UUID;
        BEGIN
            -- Get deployment IDs
            SELECT id INTO dep_id_1 FROM deployments WHERE title = 'Emergency Storm Assessment' LIMIT 1;
            SELECT id INTO dep_id_2 FROM deployments WHERE title = 'Construction Milestone 3' LIMIT 1;
            SELECT id INTO dep_id_3 FROM deployments WHERE title = 'Q1 Solar Field Audit' LIMIT 1;

            -- Get personnel IDs
            SELECT id INTO per_id_alex FROM personnel WHERE full_name = 'Alex Riviera' LIMIT 1;
            SELECT id INTO per_id_sarah FROM personnel WHERE full_name = 'Sarah Chen' LIMIT 1;

            -- Add logs if we found IDs
            IF dep_id_1 IS NOT NULL AND per_id_alex IS NOT NULL THEN
                INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
                VALUES (dep_id_1, '2026-01-17', per_id_alex, 450.00, 'Initial assessment complete')
                ON CONFLICT (deployment_id, date, technician_id) DO NOTHING;
            END IF;

            IF dep_id_1 IS NOT NULL AND per_id_sarah IS NOT NULL THEN
                INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
                VALUES (dep_id_1, '2026-01-17', per_id_sarah, 350.00, 'Grid sensor calibration')
                ON CONFLICT (deployment_id, date, technician_id) DO NOTHING;
            END IF;

            IF dep_id_2 IS NOT NULL AND per_id_alex IS NOT NULL THEN
                INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
                VALUES (dep_id_2, '2026-01-10', per_id_alex, 450.00, 'Site survey day 1')
                ON CONFLICT (deployment_id, date, technician_id) DO NOTHING;
                INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
                VALUES (dep_id_2, '2026-01-11', per_id_alex, 450.00, 'Final walkthrough')
                ON CONFLICT (deployment_id, date, technician_id) DO NOTHING;
            END IF;
        END $$;
        `;

        await db.query(seedSql);
        console.log('✅ Daily logs seeded successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seedDailyLogs();
