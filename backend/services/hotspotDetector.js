/**
 * hotspotDetector.js
 * Phase 2 – Thermal Hotspot Detection Service
 *
 * Detects abnormal thermal signatures in imagery metadata.
 * Since Node.js doesn't process raw pixel data natively,
 * this service works on temperature metadata arrays (EXIF, JSON exports)
 * and infers hotspots from statistical anomaly detection.
 *
 * Non-destructive — never modifies existing services.
 */

// Default temperature threshold above mean to qualify as hotspot
const DEFAULT_DELTA_THRESHOLD = 4.0;   // °C above mean
const MIN_HOTSPOT_AREA = 4;     // minimum pixel cluster size

/**
 * Statistical hotspot detection on a temperature grid.
 * Works with any numeric 2D array (pixel rows × columns).
 *
 * @param {number[][]} tempMatrix - 2D array of temperature values
 * @param {Object} [options]
 * @param {number} [options.deltaThreshold] - °C above mean to flag
 * @param {number} [options.minArea] - minimum cluster pixel count
 * @returns {Array<{x, y, temp_delta, hotspot_area, peak_temp, mean_temp}>}
 */
export function detectHotspots(tempMatrix, options = {}) {
    const {
        deltaThreshold = DEFAULT_DELTA_THRESHOLD,
        minArea = MIN_HOTSPOT_AREA,
    } = options;

    if (!tempMatrix || tempMatrix.length === 0) return [];

    const rows = tempMatrix.length;
    const cols = tempMatrix[0].length;

    // Compute global mean and std dev
    const flat = tempMatrix.flat();
    const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
    const variance = flat.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / flat.length;
    const stdDev = Math.sqrt(variance);

    // Label hotspot pixels
    const threshold = mean + deltaThreshold + stdDev * 0.5;
    const labeled = tempMatrix.map(row => row.map(v => v >= threshold ? v : null));

    // Connected components — simple flood fill to group adjacent hotspot pixels
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const hotspots = [];
    let hotspotId = 0;

    const neighbors = (r, c) => [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
    ].filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (labeled[r][c] !== null && !visited[r][c]) {
                // BFS flood fill
                const cluster = [];
                const queue = [[r, c]];
                visited[r][c] = true;

                while (queue.length > 0) {
                    const [cr, cc] = queue.shift();
                    cluster.push({ r: cr, c: cc, temp: tempMatrix[cr][cc] });
                    for (const [nr, nc] of neighbors(cr, cc)) {
                        if (!visited[nr][nc] && labeled[nr][nc] !== null) {
                            visited[nr][nc] = true;
                            queue.push([nr, nc]);
                        }
                    }
                }

                if (cluster.length >= minArea) {
                    const avgR = Math.round(cluster.reduce((s, p) => s + p.r, 0) / cluster.length);
                    const avgC = Math.round(cluster.reduce((s, p) => s + p.c, 0) / cluster.length);
                    const peakTemp = Math.max(...cluster.map(p => p.temp));
                    const tempDelta = Math.round((peakTemp - mean) * 100) / 100;

                    hotspots.push({
                        hotspot_id: hotspotId++,
                        x: avgC,
                        y: avgR,
                        temp_delta: tempDelta,
                        hotspot_area: cluster.length,
                        peak_temp: Math.round(peakTemp * 100) / 100,
                        mean_temp: Math.round(mean * 100) / 100,
                        threshold: Math.round(threshold * 100) / 100,
                    });
                }
            }
        }
    }

    // Sort by severity (temperature delta descending)
    return hotspots.sort((a, b) => b.temp_delta - a.temp_delta);
}

/**
 * Simplified hotspot detection from an array of temperature readings
 * (e.g., EXIF metadata, CSV exports, FLIR measurement points).
 *
 * @param {Array<{value: number, x?: number, y?: number}>} measurements
 * @param {number} [deltaThreshold]
 * @returns {Array}
 */
export function detectHotspotsFromMeasurements(measurements, deltaThreshold = DEFAULT_DELTA_THRESHOLD) {
    if (!measurements || measurements.length === 0) return [];

    const values = measurements.map(m => m.value || 0);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;

    return measurements
        .filter(m => (m.value || 0) - mean >= deltaThreshold)
        .map((m, i) => ({
            hotspot_id: i,
            x: m.x || 0,
            y: m.y || 0,
            temp_delta: Math.round((m.value - mean) * 100) / 100,
            hotspot_area: 1,
            peak_temp: m.value,
            mean_temp: Math.round(mean * 100) / 100,
        }))
        .sort((a, b) => b.temp_delta - a.temp_delta);
}

/**
 * Classify hotspot severity by temperature delta.
 */
export function classifyHotspotSeverity(tempDelta) {
    if (tempDelta >= 15) return 'critical';
    if (tempDelta >= 8) return 'moderate';
    if (tempDelta >= 4) return 'low';
    return 'normal';
}
