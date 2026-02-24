import { query } from '../config/database.js';
import { refreshPilotPerformance } from '../services/scoringService.js';
import { logger } from '../services/logger.js';

/**
 * Recalculate all pilot lifetime and rolling scores.
 * Intended to be run nightly via CRON.
 */
async function recalculateAllScores() {
    console.log('Starting nightly API score recalculation at', new Date().toISOString());

    try {
        // Get all active pilots
        const pilotsRes = await query(`
            SELECT id, full_name 
            FROM personnel 
            WHERE status = 'Active' AND (role = 'Pilot' OR role = 'Both')
        `);

        console.log(`Found ${pilotsRes.rows.length} active pilots to process.`);

        for (const pilot of pilotsRes.rows) {
            try {
                process.stdout.write(`Processing ${pilot.full_name} (${pilot.id})... `);
                const results = await refreshPilotPerformance(pilot.id);
                console.log(`DONE. Score: ${results.lifetimeScore}, Tier: ${results.tierLevel}`);
            } catch (err) {
                console.error(`\nFAILED to process pilot ${pilot.id}:`, err.message);
            }
        }

        console.log('✅ Nightly recalculation complete.');
    } catch (error) {
        console.error('❌ Nightly recalculation failed:', error);
        process.exit(1);
    }
}

recalculateAllScores();
