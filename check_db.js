import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import db from './backend/config/database.js';

async function test() {
    try {
        let query = `
            SELECT p.*, cs.status as compliance_status
            FROM personnel p
            LEFT JOIN (
                SELECT 
                    personnel_id,
                    CASE 
                        WHEN COUNT(*) FILTER (WHERE expiration_date < NOW()) > 0 THEN 'expired'
                        WHEN COUNT(*) FILTER (WHERE expiration_date < NOW() + INTERVAL '30 days' AND expiration_date >= NOW()) > 0 THEN 'expiring_soon'
                        WHEN COUNT(*) > 0 THEN 'compliant'
                        ELSE 'pending'
                    END as status
                FROM pilot_documents
                GROUP BY personnel_id
            ) cs ON p.id = cs.personnel_id
        `;
        const res = await db.query(query);
        console.log(`Success! Found ${res.rows.length} personnel rows.`);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        process.exit();
    }
}
test();
