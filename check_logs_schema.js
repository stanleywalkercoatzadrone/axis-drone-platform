import pool from './backend/config/database.js';

async function checkDailyLogs() {
    try {
        const logs = await pool.query("SELECT asterisk FROM information_schema.columns WHERE table_name = 'daily_logs'".replace('asterisk', '*'));
        console.log('--- DAILY_LOGS COLUMNS ---');
        logs.rows.forEach(row => console.log(row.column_name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDailyLogs();
