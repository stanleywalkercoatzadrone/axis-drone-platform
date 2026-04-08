import { calculateFinalAPIScore } from './services/scoringService.js';
import db from './config/database.js';

async function run() {
    try {
        console.log("Testing calculateFinalAPIScore...");

        // Find a pilot ID to test with
        const res = await db.query('SELECT id FROM personnel WHERE role = \'Pilot\' LIMIT 1');
        if (res.rows.length === 0) {
            console.log("No pilots found.");
            process.exit(0);
        }
        const pilotId = res.rows[0].id;
        console.log("Using Pilot ID:", pilotId);

        const score = await calculateFinalAPIScore(pilotId, false);
        console.log("Calculated Score:", score);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

run();
