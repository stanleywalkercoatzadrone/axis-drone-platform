/**
 * blockCoverageAnalyzer.js
 * Phase 3 – Block Coverage Analysis Service
 *
 * Estimates inspection coverage progress per solar block.
 * READ-ONLY — does not mutate data.
 */
import { query } from '../config/database.js';

const DEFAULT_PILOT_PRODUCTIVITY = 50; // acres/day baseline

/**
 * Analyze coverage for a single block.
 * @param {Object} block - solar_blocks row
 * @param {Array}  progressRows - block_progress rows for this block
 * @param {number} weatherScore - 0-100 from forecast
 * @returns {Object} coverage analysis
 */
export function analyzeBlockCoverage(block, progressRows = [], weatherScore = 70) {
    const totalAcres = parseFloat(block.acreage) || 0;
    const acresCompleted = progressRows.reduce(
        (sum, p) => sum + (parseFloat(p.acres_completed) || 0), 0
    );
    const acresRemaining = Math.max(0, totalAcres - acresCompleted);
    const percentComplete = totalAcres > 0
        ? Math.min(100, Math.round((acresCompleted / totalAcres) * 100))
        : 0;

    // Adjust pilot productivity by weather (low weather → slower progress)
    const weatherFactor = Math.max(0.4, (parseFloat(weatherScore) || 70) / 100);
    const avgFlightHours = progressRows.reduce((s, p) => s + (parseFloat(p.flight_hours) || 0), 0)
        / Math.max(1, progressRows.length);
    const effectiveAcresPerDay = DEFAULT_PILOT_PRODUCTIVITY * weatherFactor;
    const estimatedDaysRemaining = acresRemaining > 0
        ? Math.ceil(acresRemaining / effectiveAcresPerDay * 10) / 10
        : 0;
    const estimatedHoursRemaining = estimatedDaysRemaining * 6; // 6 flight hours/day

    const imagesCollected = progressRows.reduce((s, p) => s + (parseInt(p.images_collected) || 0), 0);
    const dataUploaded = progressRows.every(p => p.data_uploaded);

    return {
        blockId: block.id,
        blockName: block.block_name || `Block ${block.block_number}`,
        totalAcres,
        acresCompleted: Math.round(acresCompleted * 100) / 100,
        acresRemaining: Math.round(acresRemaining * 100) / 100,
        percentComplete,
        estimatedDaysRemaining,
        estimatedHoursRemaining: Math.round(estimatedHoursRemaining * 10) / 10,
        imagesCollected,
        dataUploaded,
        flightHoursLogged: Math.round(avgFlightHours * progressRows.length * 10) / 10,
        status: block.status,
    };
}

/**
 * Analyze all blocks for a deployment.
 * @param {string} deploymentId
 * @param {number} [weatherScore]
 * @returns {Object} deployment coverage summary + per-block analysis
 */
export async function analyzeDeploymentCoverage(deploymentId, weatherScore = 70) {
    // Load blocks
    const blocksRes = await query(
        `SELECT * FROM solar_blocks WHERE deployment_id = $1 ORDER BY block_number ASC, block_name ASC`,
        [deploymentId]
    );
    const blocks = blocksRes.rows;

    if (blocks.length === 0) {
        return {
            deploymentId,
            totalBlocks: 0,
            blocksCompleted: 0,
            blocksInProgress: 0,
            blocksPending: 0,
            totalAcres: 0,
            acresCompleted: 0,
            percentComplete: 0,
            estimatedDaysRemaining: 0,
            blocks: [],
        };
    }

    // Load all progress for these blocks in one query
    const blockIds = blocks.map(b => b.id);
    const progressRes = await query(
        `SELECT * FROM block_progress WHERE block_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
        [blockIds]
    );
    const progressByBlock = progressRes.rows.reduce((acc, row) => {
        (acc[row.block_id] = acc[row.block_id] || []).push(row);
        return acc;
    }, {});

    // Analyze each block
    const blockAnalyses = blocks.map(b => analyzeBlockCoverage(b, progressByBlock[b.id] || [], weatherScore));

    // Deployment-level summary
    const totalAcres = blockAnalyses.reduce((s, b) => s + b.totalAcres, 0);
    const acresCompleted = blockAnalyses.reduce((s, b) => s + b.acresCompleted, 0);
    const blocksCompleted = blockAnalyses.filter(b => b.percentComplete === 100).length;
    const blocksInProgress = blockAnalyses.filter(b => b.percentComplete > 0 && b.percentComplete < 100).length;
    const blocksPending = blockAnalyses.filter(b => b.percentComplete === 0).length;
    const percentComplete = totalAcres > 0 ? Math.round((acresCompleted / totalAcres) * 100) : 0;
    const estimatedDaysRemaining = Math.max(...blockAnalyses.map(b => b.estimatedDaysRemaining), 0);

    return {
        deploymentId,
        totalBlocks: blocks.length,
        blocksCompleted,
        blocksInProgress,
        blocksPending,
        totalAcres: Math.round(totalAcres * 100) / 100,
        acresCompleted: Math.round(acresCompleted * 100) / 100,
        acresRemaining: Math.round(Math.max(0, totalAcres - acresCompleted) * 100) / 100,
        percentComplete,
        estimatedDaysRemaining,
        blocks: blockAnalyses,
    };
}
