/**
 * geoProjection.js - Mathematical Projection Engine
 * 
 * Calculates precise real-world GPS coordinates (Lat/Lon) for anomalies
 * detected in aerial imagery, based on drone telemetry (EXIF/XMP).
 * Assumes a Nadir (straight-down) camera orientation.
 */

// Earth radius in meters
const R = 6378137;

/**
 * Calculates the Ground Sample Distance (GSD) in cm/pixel.
 * GSD represents the physical size of one pixel on the ground.
 */
function calculateGSD(altitudeMeters, focalLengthMm, imageWidthPx, sensorWidthMm = 13.2) {
    // Default sensorWidthMm to 13.2mm (1-inch sensor, common in enterprise mapping drones like Phantom 4 RTK/Mavic 2 Pro)
    // If we have an ultra-high res camera or different sensor, GSD will be an approximation.
    
    if (!altitudeMeters || !focalLengthMm || !imageWidthPx) {
        // Fallback: assume a standard 1.5 cm/pixel GSD for typical solar mapping (e.g., 30m altitude, 1-inch sensor)
        return 1.5;
    }

    const gsdCm = (sensorWidthMm * altitudeMeters * 100) / (focalLengthMm * imageWidthPx);
    return gsdCm;
}

/**
 * Projects a pixel coordinate to a geographic coordinate.
 * 
 * @param {number} x - The x-coordinate of the anomaly (0 to imageWidth)
 * @param {number} y - The y-coordinate of the anomaly (0 to imageHeight)
 * @param {number} imageWidth - Total width of the image in pixels
 * @param {number} imageHeight - Total height of the image in pixels
 * @param {number} centerLat - Latitude of the drone (image center)
 * @param {number} centerLon - Longitude of the drone (image center)
 * @param {number} gsdCm - Ground Sample Distance in cm/pixel
 * @param {number} headingDegrees - Drone heading (0 = North). Default 0 if unknown.
 * @returns {{ lat: number, lng: number }} The projected geographic coordinates
 */
export function projectPixelToLatLon(x, y, imageWidth, imageHeight, centerLat, centerLon, gsdCm, headingDegrees = 0) {
    // 1. Calculate pixel offset from the center of the image
    // Center of image is (0,0). Top-left is (-width/2, height/2).
    const cx = imageWidth / 2;
    const cy = imageHeight / 2;
    
    const deltaX_px = x - cx;
    const deltaY_px = cy - y; // y=0 is the top of the image in pixel coordinates
    
    // 2. Convert pixel offset to physical offset in meters
    const offsetX_m = deltaX_px * (gsdCm / 100);
    const offsetY_m = deltaY_px * (gsdCm / 100);

    // 3. Apply rotation based on drone heading (Yaw)
    // If heading is 0 (North), +Y is North, +X is East.
    // Convert heading to radians
    const headingRad = headingDegrees * (Math.PI / 180);
    
    // Rotate the 2D offset vector
    // A positive heading usually means rotating clockwise.
    const northOffset_m = offsetY_m * Math.cos(headingRad) - offsetX_m * Math.sin(headingRad);
    const eastOffset_m = offsetY_m * Math.sin(headingRad) + offsetX_m * Math.cos(headingRad);

    // 4. Translate physical offset to geographic coordinate shifts
    // 1 degree of latitude is roughly 111,320 meters
    const deltaLat = northOffset_m / 111320;
    
    // 1 degree of longitude varies by latitude
    const latRad = centerLat * (Math.PI / 180);
    const metersPerDegreeLon = 111320 * Math.cos(latRad);
    const deltaLon = eastOffset_m / metersPerDegreeLon;

    return {
        lat: centerLat + deltaLat,
        lng: centerLon + deltaLon
    };
}

/**
 * Main utility to geolocate an AI bounding box using EXIF data.
 * @param {object} aiBoundingBox - { x, y, width, height } (x,y is top-left, can be raw pixels or 0-1 percentage)
 * @param {object} exifMeta - Extracted EXIF metadata
 * @returns {{ lat: number, lng: number } | null}
 */
export function geolocateAnomaly(aiBoundingBox, exifMeta) {
    if (!exifMeta || exifMeta.GPSLatitude == null || exifMeta.GPSLongitude == null) {
        return null;
    }

    const centerLat = parseFloat(exifMeta.GPSLatitude);
    const centerLon = parseFloat(exifMeta.GPSLongitude);
    
    // Extract camera parameters
    const imageWidth = parseInt(exifMeta.ImageWidth) || 4000;
    const imageHeight = parseInt(exifMeta.ImageHeight) || 3000;
    const focalLengthMm = parseFloat(exifMeta.FocalLength) || 8.8; // 8.8mm is common for DJI 1-inch
    
    // Altitude: Prefer RelativeAltitude (height above takeoff) over MSL altitude.
    // If not available, assume 30m standard solar flight.
    const altitudeMeters = parseFloat(exifMeta.RelativeAltitude) || 30.0;
    
    // Heading: Prefer GimbalYawDegree. If not, FlightYawDegree. Default to 0.
    const heading = parseFloat(exifMeta.GimbalYawDegree) || parseFloat(exifMeta.FlightYawDegree) || 0;

    const gsdCm = calculateGSD(altitudeMeters, focalLengthMm, imageWidth);

    // Handle bounding box that might be a percentage (0 to 1) instead of raw pixels
    // Some AI engines return normalized coordinates.
    let targetX = aiBoundingBox.x;
    let targetY = aiBoundingBox.y;

    if (targetX <= 1.0 && targetY <= 1.0 && (aiBoundingBox.width || 0) <= 1.0) {
        // It's normalized. Convert to pixels.
        targetX = (aiBoundingBox.x + (aiBoundingBox.width / 2)) * imageWidth;
        targetY = (aiBoundingBox.y + (aiBoundingBox.height / 2)) * imageHeight;
    } else {
        // It's raw pixels. Find the center of the bounding box.
        targetX = aiBoundingBox.x + (aiBoundingBox.width / 2);
        targetY = aiBoundingBox.y + (aiBoundingBox.height / 2);
    }

    return projectPixelToLatLon(targetX, targetY, imageWidth, imageHeight, centerLat, centerLon, gsdCm, heading);
}
