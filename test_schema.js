import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function run() {
    import('./backend/config/database.js').then(async (dbModule) => {
        const db = dbModule.default;
        const result = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pilot_documents'");
        console.log(result.rows.map(r => r.column_name));
        process.exit(0);
    });
}
run();
