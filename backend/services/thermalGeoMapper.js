/**
 * thermalGeoMapper.js
 * Phase 6 – Pixel → Geographic Coordinate Mapper
 *
 * Maps pixel coordinates from thermal imagery to real-world
 * latitude/longitude using drone altitude and camera FOV.
 *
 * Model: equirectangular perspective projection (flat earth,
 * valid for small areas at drone altitudes).
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// Earth radius in meters
const EARTH_R = 6_371_000;

/**
 * Map a pixel coordinate to geographic coordinates.
 *
 * @param {Object} params
 * @param {number} params.pixelX        - x pixel in image (0 = left)
 * @param {number} params.pixelY        - y pixel in image (0 = top)
 * @param {number} params.imageWidth    - full image width in pixels
 * @param {number} params.imageHeight   - full image height in pixels
 * @param {number} params.droneLat      - drone latitude (image center)
 * @param {number} params.droneLon      - drone longitude (image center)
 * @param {number} params.altitudeM     - drone altitude in meters AGL
 * @param {number} params.hFovDeg       - horizontal field of view in degrees
 * @param {number} [params.vFovDeg]     - vertical FOV (calculated if omitted)
 * @param {number} [params.headingDeg]  - drone heading (0 = north, 90 = east)
 * @returns {{ latitude: number, longitude: number, groundResolution_m: number }}
 */
export function mapPixelToGeo({
    pixelX, pixelY,
    imageWidth, imageHeight,
    droneLat, droneLon, altitudeM,
    hFovDeg = 45,
    vFovDeg = null,
    headingDeg = 0,
}) {
    // Aspect ratio based vFOV if not provided
    const effectiveVFov = vFovDeg ?? (hFovDeg * (imageHeight / imageWidth));

    // Ground footprint dimensions
    const footprintW = 2 * altitudeM * Math.tan((hFovDeg / 2) * DEG_TO_RAD); // meters
    const footprintH = 2 * altitudeM * Math.tan((effectiveVFov / 2) * DEG_TO_RAD);

    // Ground sampling distance (m/pixel)
    const gsdX = footprintW / imageWidth;
    const gsdY = footprintH / imageHeight;

    // Pixel offset from image center
    const offsetX = (pixelX - imageWidth / 2) * gsdX;
    const offsetY = (pixelY - imageHeight / 2) * gsdY; // positive Y = down = south

    // Rotate by heading
    const headingRad = headingDeg * DEG_TO_RAD;
    const northOffset = offsetX * Math.sin(headingRad) - offsetY * Math.cos(headingRad);  // negative = south
    const eastOffset = offsetX * Math.cos(headingRad) + offsetY * Math.sin(headingRad);

    // Convert meter offsets to degrees
    const latOffset = -northOffset / EARTH_R * RAD_TO_DEG;  // south is negative
    const lonOffset = eastOffset / (EARTH_R * Math.cos(droneLat * DEG_TO_RAD)) * RAD_TO_DEG;

    return {
        latitude: Math.round((droneLat + latOffset) * 1e7) / 1e7,
        longitude: Math.round((droneLon + lonOffset) * 1e7) / 1e7,
        groundResolution_m: Math.round(((gsdX + gsdY) / 2) * 100) / 100,
    };
}

/**
 * Map multiple pixel coordinates to geo in a batch.
 * @param {Array<{pixelX, pixelY}>} points
 * @param {Object} imageMeta - { imageWidth, imageHeight, droneLat, droneLon, altitudeM, hFovDeg, headingDeg }
 * @returns {Array<{pixelX, pixelY, latitude, longitude}>}
 */
export function mapBatchToGeo(points, imageMeta) {
    return points.map(pt => ({
        pixelX: pt.pixelX,
        pixelY: pt.pixelY,
        ...mapPixelToGeo({ ...imageMeta, pixelX: pt.pixelX, pixelY: pt.pixelY }),
    }));
}
