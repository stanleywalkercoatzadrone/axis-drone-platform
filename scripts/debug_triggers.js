
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function listTriggers() {
    try {
        await client.connect();
        console.log('Connected to DB via fallback string. Checking triggers...');

        const query = `
            SELECT 
                trigger_name,
                event_manipulation,
                event_object_table,
                action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'users';
        `;

        const res = await client.query(query);
        console.table(res.rows);

        // Also check triggers on tenants
        const query2 = `
            SELECT 
                trigger_name,
                event_manipulation,
                event_object_table,
                action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'tenants';
        `;
        const res2 = await client.query(query2);
        if (res2.rows.length > 0) console.table(res2.rows);


        const funcQuery = `
            SELECT routine_name, routine_definition
            FROM information_schema.routines
            WHERE routine_definition ILIKE '%Tenant or user not found%'
        `;
        const funcRes = await client.query(funcQuery);
        console.log('--- Functions with error string ---');
        console.table(funcRes.rows);

    } catch (err) {
        console.error('Error listing triggers:', err);
    } finally {
        await client.end();
    }
}

listTriggers();
