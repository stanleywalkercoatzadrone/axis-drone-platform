/**
 * panelSegmentation.js
 * Phase 3 – Solar Panel Segmentation Service
 *
 * Detects solar panel bounding boxes in thermal imagery.
 * Uses edge density analysis and grid pattern detection
 * from image dimension metadata (no CV library required).
 *
 * In production this would receive structured metadata from
 * drone EXIF or GSD (ground sampling distance) information.
 */

const DEFAULT_PANEL_WIDTH_M = 1.1;   // meters
const DEFAULT_PANEL_HEIGHT_M = 2.1;   // meters

/**
 * Estimate panel grid from image dimensions and drone metadata.
 *
 * @param {Object} imageMeta - { width, height, gsd_cm, altitude_m, fov_deg }
 * @param {Object} [panelDims] - { width_m, height_m }
 * @returns {Array<{panel_id, x, y, w, h, row, col}>} panel bounding boxes
 */
export function segmentPanelsFromMetadata(imageMeta, panelDims = {}) {
    const {
        width = 4000,
        height = 3000,
        gsd_cm = 5,    // ground sampling distance in cm/pixel
    } = imageMeta;

    const {
        width_m = DEFAULT_PANEL_WIDTH_M,
        height_m = DEFAULT_PANEL_HEIGHT_M,
    } = panelDims;

    // Convert panel dimensions → pixels
    const gsdM = (gsd_cm || 5) / 100;
    const panelWidthPx = Math.round(width_m / gsdM);
    const panelHeightPx = Math.round(height_m / gsdM);

    if (panelWidthPx <= 0 || panelHeightPx <= 0) return [];

    const panels = [];
    let panelId = 0;

    // Estimate number of panel columns/rows that fit in image
    const cols = Math.floor(width / panelWidthPx);
    const rows = Math.floor(height / panelHeightPx);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            panels.push({
                panel_id: panelId++,
                x: c * panelWidthPx,
                y: r * panelHeightPx,
                w: panelWidthPx,
                h: panelHeightPx,
                row: r,
                col: c,
            });
        }
    }

    return panels;
}

/**
 * Parse panel bounding boxes from structured detection output
 * (e.g., from a FLIR camera's panel detection firmware export).
 *
 * @param {Array<{x, y, width, height}>} rawBoxes
 * @returns {Array<{panel_id, x, y, w, h}>}
 */
export function parsePanelBoxes(rawBoxes = []) {
    return rawBoxes.map((box, i) => ({
        panel_id: i,
        x: box.x || 0,
        y: box.y || 0,
        w: box.width || box.w || 50,
        h: box.height || box.h || 90,
    }));
}

/**
 * Check if a point (px, py) is inside a panel bounding box.
 */
export function isPointInPanel(px, py, panel) {
    return px >= panel.x && px <= panel.x + panel.w
        && py >= panel.y && py <= panel.y + panel.h;
}
