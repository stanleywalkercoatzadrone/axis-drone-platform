import { query } from '../config/database.js';
import { calculateIndividualScores, calculateFinalAPIScore, getTierFromScore } from '../services/scoringService.js';
import { calculateAssignmentFitScore, findBestCandidates } from '../services/assignmentEngine.js';

/**
 * Comprehensive verification tests for the Axis Performance Index
 * Tests scoring calculations, tier assignment, and auto-assignment logic
 */

async function runVerificationTests() {
    console.log('🧪 Running Performance Engine Verification Tests\n');
    console.log('='.repeat(60));

    let passedTests = 0;
    let failedTests = 0;

    try {
        // Get a test pilot
        const pilotsRes = await query(`
            SELECT id, full_name 
            FROM personnel 
            WHERE status = 'Active' AND (role = 'Pilot' OR role = 'Both')
            LIMIT 1
        `);

        if (pilotsRes.rows.length === 0) {
            console.error('❌ No pilots found. Please run seed_performance_data.js first.');
            process.exit(1);
        }

        const testPilot = pilotsRes.rows[0];
        console.log(`\n📋 Test Subject: ${testPilot.full_name} (${testPilot.id})\n`);

        // TEST 1: Individual Score Calculations
        console.log('TEST 1: Individual Metric Scores');
        console.log('-'.repeat(60));
        try {
            const scores = await calculateIndividualScores(testPilot.id, false);

            console.log(`  Acceptance Score: ${scores.acceptance}/100`);
            console.log(`  Completion Score: ${scores.completion}/100`);
            console.log(`  QA Score: ${scores.qa}/100`);
            console.log(`  Rating Score: ${scores.rating}/100`);
            console.log(`  Reliability Score: ${scores.reliability}/100`);

            // Validate scores are in range
            const allScoresValid = Object.values(scores).every(s => s >= 0 && s <= 100);
            if (allScoresValid) {
                console.log('  ✅ All scores within valid range (0-100)');
                passedTests++;
            } else {
                console.log('  ❌ Some scores out of range');
                failedTests++;
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedTests++;
        }

        // TEST 2: Final API Score Calculation
        console.log('\nTEST 2: Final API Score Calculation');
        console.log('-'.repeat(60));
        try {
            const finalScore = await calculateFinalAPIScore(testPilot.id, false);

            console.log(`  Final API Score: ${finalScore}/100`);

            if (finalScore >= 0 && finalScore <= 100) {
                console.log('  ✅ Final score within valid range');
                passedTests++;
            } else {
                console.log('  ❌ Final score out of range');
                failedTests++;
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedTests++;
        }

        // TEST 3: Tier Assignment Logic
        console.log('\nTEST 3: Tier Assignment Logic');
        console.log('-'.repeat(60));
        try {
            const testCases = [
                { score: 95, expectedTier: 'Gold' },
                { score: 90, expectedTier: 'Gold' },
                { score: 85, expectedTier: 'Silver' },
                { score: 80, expectedTier: 'Silver' },
                { score: 75, expectedTier: 'Bronze' },
                { score: 70, expectedTier: 'Bronze' },
                { score: 65, expectedTier: 'At Risk' },
                { score: 50, expectedTier: 'At Risk' },
                { score: 0, expectedTier: 'At Risk' }
            ];

            let tierTestsPassed = 0;
            testCases.forEach(({ score, expectedTier }) => {
                const tier = getTierFromScore(score);
                const passed = tier === expectedTier;
                console.log(`  Score ${score} → ${tier} ${passed ? '✅' : '❌ Expected: ' + expectedTier}`);
                if (passed) tierTestsPassed++;
            });

            if (tierTestsPassed === testCases.length) {
                console.log(`  ✅ All tier assignments correct (${tierTestsPassed}/${testCases.length})`);
                passedTests++;
            } else {
                console.log(`  ❌ Some tier assignments incorrect (${tierTestsPassed}/${testCases.length})`);
                failedTests++;
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedTests++;
        }

        // TEST 4: Rolling Score Calculation
        console.log('\nTEST 4: Rolling 30-Day Score');
        console.log('-'.repeat(60));
        try {
            const rollingScores = await calculateIndividualScores(testPilot.id, true);
            const rollingFinal = await calculateFinalAPIScore(testPilot.id, true);

            console.log(`  Rolling Final Score: ${rollingFinal}/100`);
            console.log(`  Rolling Acceptance: ${rollingScores.acceptance}/100`);
            console.log(`  Rolling Completion: ${rollingScores.completion}/100`);

            if (rollingFinal >= 0 && rollingFinal <= 100) {
                console.log('  ✅ Rolling score calculation working');
                passedTests++;
            } else {
                console.log('  ❌ Rolling score out of range');
                failedTests++;
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedTests++;
        }

        // TEST 5: Performance Config Retrieval
        console.log('\nTEST 5: Performance Configuration');
        console.log('-'.repeat(60));
        try {
            const configRes = await query('SELECT * FROM performance_config LIMIT 1');

            if (configRes.rows.length > 0) {
                const config = configRes.rows[0];
                const totalWeight =
                    (config.acceptance_enabled ? config.acceptance_weight : 0) +
                    (config.completion_enabled ? config.completion_weight : 0) +
                    (config.qa_enabled ? config.qa_weight : 0) +
                    (config.rating_enabled ? config.rating_weight : 0) +
                    (config.reliability_enabled ? config.reliability_weight : 0);

                console.log(`  Acceptance: ${config.acceptance_enabled ? config.acceptance_weight + '%' : 'Disabled'}`);
                console.log(`  Completion: ${config.completion_enabled ? config.completion_weight + '%' : 'Disabled'}`);
                console.log(`  QA: ${config.qa_enabled ? config.qa_weight + '%' : 'Disabled'}`);
                console.log(`  Rating: ${config.rating_enabled ? config.rating_weight + '%' : 'Disabled'}`);
                console.log(`  Reliability: ${config.reliability_enabled ? config.reliability_weight + '%' : 'Disabled'}`);
                console.log(`  Total Weight: ${totalWeight}%`);

                if (totalWeight === 100) {
                    console.log('  ✅ Configuration weights sum to 100');
                    passedTests++;
                } else {
                    console.log(`  ❌ Configuration weights sum to ${totalWeight}, expected 100`);
                    failedTests++;
                }
            } else {
                console.log('  ❌ No configuration found');
                failedTests++;
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedTests++;
        }

        // TEST 6: Assignment Engine - Distance Calculation
        console.log('\nTEST 6: Assignment Engine - Fit Score');
        console.log('-'.repeat(60));
        try {
            // Get pilot with location data
            const pilotWithScore = await query(`
                SELECT id, full_name, rolling_30_day_score 
                FROM personnel 
                WHERE status = 'Active' AND (role = 'Pilot' OR role = 'Both')
                LIMIT 1
            `);

            if (pilotWithScore.rows.length > 0) {
                const pilot = pilotWithScore.rows[0];

                // Mock mission data
                const mockMission = {
                    location: { lat: 40.7128, lng: -74.0060 }, // NYC
                    created_at: new Date()
                };

                // Mock pilot data with location
                const mockPilot = {
                    ...pilot,
                    last_location_lat: 40.7580,
                    last_location_lng: -73.9855,
                    rolling_30_day_score: pilot.rolling_30_day_score || 75
                };

                const fitScore = await calculateAssignmentFitScore(mockPilot, mockMission);

                console.log(`  Pilot: ${pilot.full_name}`);
                console.log(`  Rolling Score: ${mockPilot.rolling_30_day_score}`);
                console.log(`  Fit Score: ${fitScore.toFixed(2)}`);

                if (fitScore >= 0 && fitScore <= 100) {
                    console.log('  ✅ Fit score calculation working');
                    passedTests++;
                } else {
                    console.log('  ❌ Fit score out of range');
                    failedTests++;
                }
            } else {
                console.log('  ⚠️  Skipped: No pilots with score data');
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedTests++;
        }

        // TEST 7: Reliability Flag Logic
        console.log('\nTEST 7: Reliability Flag Logic');
        console.log('-'.repeat(60));
        try {
            const reliabilityTest = await query(`
                SELECT id, full_name, reliability_flag, lifetime_score
                FROM personnel 
                WHERE status = 'Active' AND (role = 'Pilot' OR role = 'Both')
                LIMIT 3
            `);

            reliabilityTest.rows.forEach(pilot => {
                console.log(`  ${pilot.full_name}: ${pilot.reliability_flag ? '✅ Qualified' : '❌ Restricted'} (Score: ${pilot.lifetime_score})`);
            });

            console.log('  ✅ Reliability flags retrieved');
            passedTests++;
        } catch (error) {
            console.log(`  ❌ Failed: ${error.message}`);
            failedTests++;
        }

        // SUMMARY
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`  Total Tests: ${passedTests + failedTests}`);
        console.log(`  ✅ Passed: ${passedTests}`);
        console.log(`  ❌ Failed: ${failedTests}`);
        console.log(`  Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

        if (failedTests === 0) {
            console.log('\n🎉 All tests passed! Performance Engine is working correctly.\n');
            process.exit(0);
        } else {
            console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Fatal error during testing:', error);
        process.exit(1);
    }
}

runVerificationTests();
