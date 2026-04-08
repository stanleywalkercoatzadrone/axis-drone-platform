/**
 * thermalPipeline.js
 * Phase 5 + Phase 7 + Phase 8 – Full Thermal Processing Pipeline
 *
 * Orchestrates the full pipeline:
 *   hotspotDetector → panelSegmentation → panelFaultMatcher
 *   → thermalGeoMapper → blockAssignment → faultClassifier
 *   → thermal_faults INSERT → energyLossEstimator
 *
 * Called by the thermalProcessingWorker or directly from upload API.
 * Does NOT modify any existing upload pipeline or services.
 */
import { query } from '../config/database.js';
import { detectHotspotsFromMeasurements, classifyHotspotSeverity } from './hotspotDetector.js';
import { segmentPanelsFromMetadata, parsePanelBoxes } from './panelSegmentation.js';
import { matchHotspotsToPanels, deduplicatePanelMatches } from './panelFaultMatcher.js';
import { mapPixelToGeo } from './thermalGeoMapper.js';
import { analyzeThermalFault } from './thermalFaultClassifier.js';
import { calculateAndPersistLoss } from './energyLossEstimator.js';

/**
 * Assign a coordinate to a solar block by nearest centroid.
 * Falls back to deployment-wide null if no blocks defined.
 * @param {string} deploymentId
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string|null>} block_id
 */
async function findNearestBlock(deploymentId, lat, lon) {
    try {
        const res = await query(
            `SELECT id,
                    (latitude  - $1) * (latitude  - $1) +
                    (longitude - $2) * (longitude - $2) AS dist_sq
             FROM solar_blocks
             WHERE deployment_id = $3
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL
             ORDER BY dist_sq ASC
             LIMIT 1`,
            [lat, lon, deploymentId]
        );
        return res.rows[0]?.id || null;
    } catch {
        return null;
    }
}

/**
 * Phase 8: Run the full thermal detection pipeline for an image record.
 *
 * @param {Object} imageRecord - row from thermal_images
 * @param {Object} [opts]
 * @param {Array} [opts.measurements] - pre-extracted temp readings [{value, x, y}]
 * @param {Array} [opts.panelBoxes]   - pre-extracted panel bounding boxes
 * @param {number[][]} [opts.tempMatrix] - 2D temperature matrix (optional)
 * @param {Object} [opts.droneMetadata] - { altitudeM, hFovDeg, headingDeg }
 * @returns {Promise<{ processed: number, faults: Array }>}
 */
export async function runThermalPipeline(imageRecord, opts = {}) {
    const {
        measurements = [],
        panelBoxes = null,
        tempMatrix = null,
        droneMetadata = {},
    } = opts;

    const results = [];

    // ── Step 1: Hotspot detection ─────────────────────────────────────────────
    let hotspots = [];
    if (tempMatrix && tempMatrix.length > 0) {
        const { detectHotspots } = await import('./hotspotDetector.js');
        hotspots = detectHotspots(tempMatrix);
    } else if (measurements.length > 0) {
        hotspots = detectHotspotsFromMeasurements(measurements);
    }

    if (hotspots.length === 0) {
        return { processed: 0, faults: [], message: 'No hotspots detected' };
    }

    // ── Step 2: Panel segmentation ────────────────────────────────────────────
    const panels = panelBoxes
        ? parsePanelBoxes(panelBoxes)
        : segmentPanelsFromMetadata({
            width: imageRecord.image_width || 4000,
            height: imageRecord.image_height || 3000,
            gsd_cm: droneMetadata.gsd_cm || 5,
        });

    // ── Step 3: Match hotspots to panels ─────────────────────────────────────
    const rawMatches = matchHotspotsToPanels(hotspots, panels);
    const matches = deduplicatePanelMatches(rawMatches);

    // ── Step 4-7: Per-match: geo-map → classify → block-assign → insert ──────
    const imageMeta = {
        imageWidth: imageRecord.image_width || 4000,
        imageHeight: imageRecord.image_height || 3000,
        droneLat: parseFloat(imageRecord.latitude) || 0,
        droneLon: parseFloat(imageRecord.longitude) || 0,
        altitudeM: droneMetadata.altitudeM || 120,
        hFovDeg: droneMetadata.hFovDeg || 45,
        headingDeg: droneMetadata.headingDeg || 0,
    };

    for (const match of matches) {
        try {
            // Phase 6: Geo-map pixel to lat/lon
            const geo = mapPixelToGeo({ ...imageMeta, pixelX: match.x, pixelY: match.y });

            // Phase 5: AI/rule-based fault classification
            const classified = await analyzeThermalFault(null, match.temp_delta, {
                blockName: imageRecord.block_name || undefined,
                latitude: geo.latitude,
                longitude: geo.longitude,
                imageFilename: imageRecord.file_url,
            });

            // Phase 7: Block assignment by nearest centroid
            const blockId = await findNearestBlock(
                imageRecord.deployment_id, geo.latitude, geo.longitude
            );

            // Phase 8: Insert into thermal_faults
            const faultRes = await query(
                `INSERT INTO thermal_faults
                    (deployment_id, block_id, image_id,
                     latitude, longitude,
                     temperature_delta, fault_type, severity,
                     confidence_score, ai_detected, review_status, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,'pending','open')
                 ON CONFLICT DO NOTHING
                 RETURNING *`,
                [
                    imageRecord.deployment_id,
                    blockId,
                    imageRecord.id,
                    geo.latitude,
                    geo.longitude,
                    classified.temperature_delta || match.temp_delta,
                    classified.fault_type,
                    classified.severity,
                    classified.confidence_score || 70,
                ]
            );

            if (faultRes.rows.length > 0) {
                const fault = faultRes.rows[0];

                // Phase 4 (energyLoss): trigger energy loss calculation
                calculateAndPersistLoss(fault).catch(() => { });

                results.push({
                    faultId: fault.id,
                    faultType: fault.fault_type,
                    severity: fault.severity,
                    latitude: geo.latitude,
                    longitude: geo.longitude,
                    tempDelta: fault.temperature_delta,
                });
            }
        } catch (err) {
            console.warn('[thermalPipeline] Fault insert failed:', err.message);
        }
    }

    return { processed: results.length, faults: results };
}
