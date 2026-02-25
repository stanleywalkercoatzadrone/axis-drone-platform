import pg from 'pg';

const dbUrl = 'postgresql://postgres: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@db.nkhiiwleyjsmvvdtkcud.supabase.co:5432/postgres?ipv4=true';

const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const createTableSQL = `
CREATE TABLE IF NOT EXISTS performance_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acceptance_enabled BOOLEAN DEFAULT true,
    completion_enabled BOOLEAN DEFAULT true,
    qa_enabled BOOLEAN DEFAULT true,
    rating_enabled BOOLEAN DEFAULT true,
    reliability_enabled BOOLEAN DEFAULT true,
    travel_enabled BOOLEAN DEFAULT true,
    speed_enabled BOOLEAN DEFAULT true,
    acceptance_weight INTEGER DEFAULT 15,
    completion_weight INTEGER DEFAULT 15,
    qa_weight INTEGER DEFAULT 20,
    rating_weight INTEGER DEFAULT 20,
    reliability_weight INTEGER DEFAULT 10,
    travel_weight INTEGER DEFAULT 10,
    speed_weight INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
`;

const insertDefaultsSQL = `
INSERT INTO performance_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM performance_config WHERE is_active = true);
`;

async function run() {
    try {
        console.log('Creating performance_config table...');
        await pool.query(createTableSQL);
        console.log('Table created or already exists.');

        console.log('Inserting default configuration row...');
        await pool.query(insertDefaultsSQL);
        console.log('Defaults inserted (if missing).');

    } catch (err) {
        console.error('Error during DB setup:', err);
    } finally {
        await pool.end();
    }
}

run();
