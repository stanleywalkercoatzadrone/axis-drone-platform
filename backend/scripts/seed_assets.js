import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const generateAssets = async () => {
    try {
        console.log('🌱 Seeding Asset Grid Data...');

        // 1. Get a Client and Site
        const sitesRes = await pool.query('SELECT * FROM sites LIMIT 1');
        if (sitesRes.rows.length === 0) {
            console.error('❌ No sites found. Run migrations/fix_db_state first!');
            return;
        }
        const site = sitesRes.rows[0];
        console.log(`📍 Using Site: ${site.name} (${site.id})`);

        // 2. Get a User for assignment
        const userRes = await pool.query('SELECT * FROM users LIMIT 1');
        const user = userRes.rows[0];
        console.log(`👤 Assigning to: ${user?.email || 'None'}`);

        const assets = [
            {
                key: 'BLK-A1',
                type: 'Solar Block',
                industry: 'Solar',
                desc: 'Northeast corner block, high shading risk.',
                status: 'in_progress',
                planned: 120,
                completed: 45
            },
            {
                key: 'BLK-A2',
                type: 'Solar Block',
                industry: 'Solar',
                desc: 'Adjacent to access road.',
                status: 'not_started',
                planned: 120,
                completed: 0
            },
            {
                key: 'INV-01',
                type: 'Inverter',
                industry: 'Solar',
                desc: 'Central inverter station 1.',
                status: 'complete',
                planned: 1,
                completed: 1
            },
            {
                key: 'BLK-B1',
                type: 'Solar Block',
                industry: 'Solar',
                desc: 'South field, terrain undulation.',
                status: 'blocked',
                planned: 120,
                completed: 10,
                meta: { obstruction: 'Vegetation' }
            }
        ];

        for (const asset of assets) {
            await pool.query(`
                INSERT INTO assets (
                    site_id, client_id, industry, asset_type, asset_key, description, 
                    status, planned_count, completed_count, assigned_to_user_id, meta
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (site_id, asset_type, asset_key) DO UPDATE SET
                    status = EXCLUDED.status,
                    completed_count = EXCLUDED.completed_count
                RETURNING id;
            `, [
                site.id,
                // client_id from site? Site table has 'client' string, NOT client_id UUID in existing fix_db schema?
                // Wait, fix_db created sites with `client VARCHAR`.
                // My asset table requires `client_id UUID`.
                // I need a UUID for client_id.
                // I'll allow NULL or fetch from users?
                // assets table: client_id UUID NOT NULL REFERENCES users(id).
                // So I must provide a valid User ID as client_id.
                user ? user.id : '00000000-0000-0000-0000-000000000000', // potentially fail constraint if user missing
                asset.industry,
                asset.type,
                asset.key,
                asset.desc,
                asset.status,
                asset.planned,
                asset.completed,
                user ? user.id : null,
                asset.meta || {}
            ]);
        }

        console.log('✅ Seed complete.');

    } catch (e) {
        console.error('❌ Error seeding:', e);
    } finally {
        await pool.end();
    }
};

generateAssets();
