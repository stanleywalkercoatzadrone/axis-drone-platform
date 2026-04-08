/**
 * panelFaultMatcher.js
 * Phase 4 – Hotspot to Panel Association Service
 *
 * Matches detected hotspots to specific solar panel bounding boxes.
 * Determines which panel(s) each hotspot falls within.
 */
import { isPointInPanel } from './panelSegmentation.js';

/**
 * Match hotspots to panels using point-in-box intersection.
 *
 * @param {Array} hotspots - from hotspotDetector.detectHotspots()
 * @param {Array} panels   - from panelSegmentation.segmentPanelsFromMetadata()
 * @returns {Array<{hotspot_id, panel_id, x, y, temp_delta, hotspot_area, matched}>}
 */
export function matchHotspotsToPanels(hotspots, panels) {
    return hotspots.map(hotspot => {
        const matchedPanel = panels.find(p => isPointInPanel(hotspot.x, hotspot.y, p));

        return {
            hotspot_id: hotspot.hotspot_id,
            panel_id: matchedPanel?.panel_id ?? null,
            panel_row: matchedPanel?.row ?? null,
            panel_col: matchedPanel?.col ?? null,
            x: hotspot.x,
            y: hotspot.y,
            temp_delta: hotspot.temp_delta,
            hotspot_area: hotspot.hotspot_area,
            peak_temp: hotspot.peak_temp,
            mean_temp: hotspot.mean_temp,
            matched: matchedPanel != null,
        };
    });
}

/**
 * Deduplicate panel matches — when multiple hotspots hit the same panel,
 * keep only the worst-ΔT hotspot per panel for fault insertion.
 *
 * @param {Array} matches - output of matchHotspotsToPanels()
 * @returns {Array}
 */
export function deduplicatePanelMatches(matches) {
    const byPanel = {};

    for (const m of matches) {
        const key = m.panel_id !== null ? `panel:${m.panel_id}` : `unmatched:${m.hotspot_id}`;
        if (!byPanel[key] || m.temp_delta > byPanel[key].temp_delta) {
            byPanel[key] = m;
        }
    }

    return Object.values(byPanel).sort((a, b) => b.temp_delta - a.temp_delta);
}
