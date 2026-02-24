import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed performance data for testing the Axis Performance Index
 * Creates realistic job offers, completions, QA reviews, and client reviews
 * for existing pilots to test scoring calculations.
 */

async function seedPerformanceData() {
    console.log('🌱 Seeding Performance Data for Testing...\n');

    try {
        // Get existing pilots
        const pilotsRes = await query(`
            SELECT id, full_name 
            FROM personnel 
            WHERE status = 'Active' AND (role = 'Pilot' OR role = 'Both')
            LIMIT 5
        `);

        if (pilotsRes.rows.length === 0) {
            console.error('❌ No active pilots found. Please create pilots first.');
            process.exit(1);
        }

        const pilots = pilotsRes.rows;
        console.log(`Found ${pilots.length} pilots to seed data for:\n`);
        pilots.forEach((p, i) => console.log(`  ${i + 1}. ${p.full_name} (${p.id})`));
        console.log('');

        // Performance profiles for each pilot
        const profiles = [
            {
                name: 'High Performer',
                acceptanceRate: 0.95,
                completionRate: 0.92,
                avgQAScore: 90,
                avgRating: 4.5,
                noShows: 0,
                cancellations: 0,
                jobCount: 20
            },
            {
                name: 'Average Performer',
                acceptanceRate: 0.80,
                completionRate: 0.85,
                avgQAScore: 75,
                avgRating: 4.0,
                noShows: 1,
                cancellations: 2,
                jobCount: 15
            },
            {
                name: 'Below Average',
                acceptanceRate: 0.70,
                completionRate: 0.75,
                avgQAScore: 65,
                avgRating: 3.5,
                noShows: 2,
                cancellations: 3,
                jobCount: 12
            },
            {
                name: 'New Pilot',
                acceptanceRate: 0.85,
                completionRate: 0.90,
                avgQAScore: 80,
                avgRating: 4.2,
                noShows: 0,
                cancellations: 0,
                jobCount: 5
            },
            {
                name: 'Unreliable Pilot',
                acceptanceRate: 0.60,
                completionRate: 0.65,
                avgQAScore: 70,
                avgRating: 3.8,
                noShows: 5,
                cancellations: 4,
                jobCount: 18
            }
        ];

        // Seed data for each pilot
        for (let i = 0; i < pilots.length && i < profiles.length; i++) {
            const pilot = pilots[i];
            const profile = profiles[i];

            console.log(`\n📊 Seeding data for ${pilot.full_name} (${profile.name})...`);

            const totalOffers = Math.ceil(profile.jobCount / profile.acceptanceRate);
            const acceptedJobs = profile.jobCount;
            const completedJobs = Math.floor(acceptedJobs * profile.completionRate);

            // Create job offers
            console.log(`  Creating ${totalOffers} job offers...`);
            for (let j = 0; j < totalOffers; j++) {
                const offerId = uuidv4();
                const jobId = uuidv4();
                const accepted = j < acceptedJobs;
                const daysAgo = Math.floor(Math.random() * 60); // Within last 60 days

                if (accepted) {
                    await query(`
                        INSERT INTO job_offers (id, pilot_id, job_id, offered_at, accepted_at)
                        VALUES ($1, $2, $3, NOW() - INTERVAL '${daysAgo} days', NOW() - INTERVAL '${daysAgo} days')
                    `, [offerId, pilot.id, jobId]);
                } else {
                    await query(`
                        INSERT INTO job_offers (id, pilot_id, job_id, offered_at, declined_at)
                        VALUES ($1, $2, $3, NOW() - INTERVAL '${daysAgo} days', NOW() - INTERVAL '${daysAgo} days')
                    `, [offerId, pilot.id, jobId]);
                }
            }

            // Create job completions
            console.log(`  Creating ${completedJobs} job completions...`);
            for (let j = 0; j < completedJobs; j++) {
                const completionId = uuidv4();
                const jobId = uuidv4();
                const daysAgo = Math.floor(Math.random() * 60);
                const isNoShow = Math.random() < (profile.noShows / profile.jobCount);
                const isCancelled = !isNoShow && Math.random() < (profile.cancellations / profile.jobCount);
                const onTime = !isNoShow && !isCancelled && Math.random() > 0.1;

                await query(`
                    INSERT INTO job_completions (id, pilot_id, job_id, completed_at, on_time, cancelled, no_show)
                    VALUES ($1, $2, $3, NOW() - INTERVAL '${daysAgo} days', $4, $5, $6)
                `, [completionId, pilot.id, jobId, onTime, isCancelled, isNoShow]);
            }

            // Create QA reviews (1-5 scale)
            console.log(`  Creating ${completedJobs} QA reviews...`);
            for (let j = 0; j < completedJobs; j++) {
                const reviewId = uuidv4();
                const jobId = uuidv4();
                const daysAgo = Math.floor(Math.random() * 60);
                // Convert 0-100 avgQAScore to 1-5 scale
                const baseScore = Math.round((profile.avgQAScore / 100) * 4) + 1;
                const variance = Math.random() > 0.5 ? 1 : -1;
                const qaScore = Math.max(1, Math.min(5, baseScore + (Math.random() > 0.7 ? variance : 0)));
                const reworkRequired = qaScore < 3;

                await query(`
                    INSERT INTO qa_reviews (id, pilot_id, job_id, qa_score, rework_required)
                    VALUES ($1, $2, $3, $4, $5)
                `, [reviewId, pilot.id, jobId, qaScore, reworkRequired]);
            }

            // Create client reviews (1-5 scale)
            console.log(`  Creating ${completedJobs} client reviews...`);
            for (let j = 0; j < completedJobs; j++) {
                const reviewId = uuidv4();
                const jobId = uuidv4();
                const daysAgo = Math.floor(Math.random() * 60);
                const variance = Math.random() * 1 - 0.5; // ±0.5 variance
                const rating = Math.round(Math.max(1, Math.min(5, profile.avgRating + variance)));

                await query(`
                    INSERT INTO client_reviews (id, pilot_id, job_id, rating)
                    VALUES ($1, $2, $3, $4)
                `, [reviewId, pilot.id, jobId, rating]);
            }

            // Create reliability events (no-shows and cancellations)
            const totalReliabilityEvents = profile.noShows + profile.cancellations;
            if (totalReliabilityEvents > 0) {
                console.log(`  Creating ${totalReliabilityEvents} reliability events...`);
                // Note: Reliability is calculated from job_completions status and job_offers acceptance
                // No separate table needed - already handled in the data above
            }

            console.log(`  ✅ Completed seeding for ${pilot.full_name}`);
        }

        console.log('\n✅ Performance data seeding complete!\n');
        console.log('📊 Summary:');
        console.log(`  - Pilots seeded: ${pilots.length}`);
        console.log(`  - Total job offers created: ~${pilots.length * 15}`);
        console.log(`  - Total completions created: ~${pilots.length * 12}`);
        console.log(`  - Total QA reviews created: ~${pilots.length * 12}`);
        console.log(`  - Total client reviews created: ~${pilots.length * 12}`);
        console.log('\n🚀 Next step: Run score recalculation:');
        console.log('   node backend/scripts/recalculate_scores.js\n');

    } catch (error) {
        console.error('❌ Error seeding performance data:', error);
        process.exit(1);
    }

    process.exit(0);
}

seedPerformanceData();
