/**
 * faultDensityAnalyzer.js
 * Phase 10 – Fault Density Analysis
 *
 * Identifies spatial clusters of faults across a solar site.
 * Generates density heatmap grid and cluster centroids.
 * READ-ONLY — does not mutate data.
 */
import { query } from '../config/database.js';

/**
 * Compute fault density grid for a deployment.
 * Divides the site into a lat/lon grid and counts faults per cell.
 *
 * @param {string} deploymentId
 * @param {number} [gridSize] - number of grid divisions per axis
 * @returns {Promise<Object>} density grid + hottest clusters
 */
export async function computeFaultDensity(deploymentId, gridSize = 10) {
    const result = await query(
        `SELECT id, latitude, longitude, severity, fault_type, temperature_delta
         FROM thermal_faults
         WHERE deployment_id = $1
           AND latitude IS NOT NULL
           AND longitude IS NOT NULL
         ORDER BY temperature_delta DESC`,
        [deploymentId]
    );

    const faults = result.rows;
    if (faults.length === 0) {
        return { deploymentId, faults: 0, clusters: [], grid: [] };
    }

    // Bounding box
    const lats = faults.map(f => parseFloat(f.latitude));
    const lons = faults.map(f => parseFloat(f.longitude));
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);

    const latRange = maxLat - minLat || 0.001;
    const lonRange = maxLon - minLon || 0.001;

    // Build grid — 2D map [row][col] → { count, criticalCount, faultIds }
    const grid = Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => ({
            count: 0, criticalCount: 0, faultIds: [],
            avgDelta: 0, sumDelta: 0,
        }))
    );

    for (const fault of faults) {
        const lat = parseFloat(fault.latitude);
        const lon = parseFloat(fault.longitude);
        const row = Math.min(Math.floor(gridSize * (lat - minLat) / latRange), gridSize - 1);
        const col = Math.min(Math.floor(gridSize * (lon - minLon) / lonRange), gridSize - 1);
        grid[row][col].count++;
        grid[row][col].sumDelta += parseFloat(fault.temperature_delta) || 0;
        if (fault.severity === 'critical') grid[row][col].criticalCount++;
        grid[row][col].faultIds.push(fault.id);
    }

    // Compute avg delta per cell
    grid.forEach(row => row.forEach(cell => {
        cell.avgDelta = cell.count > 0 ? Math.round((cell.sumDelta / cell.count) * 10) / 10 : 0;
    }));

    // Extract top clusters (grid cells with highest fault density)
    const clusters = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = grid[r][c];
            if (cell.count > 0) {
                // Centroid lat/lon of this cell
                const centerLat = minLat + (r + 0.5) * (latRange / gridSize);
                const centerLon = minLon + (c + 0.5) * (lonRange / gridSize);
                clusters.push({
                    row: r, col: c,
                    latitude: Math.round(centerLat * 1e7) / 1e7,
                    longitude: Math.round(centerLon * 1e7) / 1e7,
                    faultCount: cell.count,
                    criticalCount: cell.criticalCount,
                    avgTempDelta: cell.avgDelta,
                    density: Math.round((cell.count / faults.length) * 100) / 100,
                });
            }
        }
    }

    clusters.sort((a, b) => b.faultCount - a.faultCount);

    return {
        deploymentId,
        totalFaults: faults.length,
        gridSize,
        bounds: { minLat, maxLat, minLon, maxLon },
        topClusters: clusters.slice(0, 10),
        grid: grid.map(row => row.map(cell => ({
            count: cell.count,
            criticalCount: cell.criticalCount,
            avgDelta: cell.avgDelta,
        }))),
    };
}
