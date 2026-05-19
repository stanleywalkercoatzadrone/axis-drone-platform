/**
 * AXIS INTELLIGENCE — EXIF Metadata Service
 * 
 * Extracts technical flight data (altitude, coordinates, camera) from imagery.
 */

import exifr from 'exifr';

/**
 * Extracts GPS Altitude from an image URL.
 * 
 * @param {string} url - Publicly accessible URL of the image
 * @returns {Promise<number|null>} Altitude in meters (relative to sea level)
 */
export async function getAltitudeFromUrl(url) {
    if (!url) return null;

    try {
        // exifr.parse can take a URL directly. 
        // In Node environments, it uses the provided fetch or internal logic.
        const metadata = await exifr.parse(url, {
            pick: ['GPSAltitude'],
            // Optimization: only read the first few KB if possible
            // exifr handles this automatically for some sources
        });

        return metadata?.GPSAltitude ?? null;
    } catch (err) {
        console.warn(`[ExifService] Could not extract altitude from ${url.split('/').pop()}:`, err.message);
        return null;
    }
}

/**
 * Extracts a subset of technical metadata for reporting, including precise GPS coordinates.
 */
export async function getFlightMetadata(url) {
    if (!url) return null;

    try {
        const metadata = await exifr.parse(url, {
            pick: ['GPSAltitude', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model', 'DateTimeOriginal', 'FocalLength'],
            translateGPS: true
        });

        return {
            latitude: metadata?.latitude ?? metadata?.GPSLatitude ?? null,
            longitude: metadata?.longitude ?? metadata?.GPSLongitude ?? null,
            altitude: metadata?.GPSAltitude ?? null,
            cameraMake: metadata?.Make ?? null,
            cameraModel: metadata?.Model ?? null,
            timestamp: metadata?.DateTimeOriginal ?? null,
            focalLength: metadata?.FocalLength ?? null
        };
    } catch (err) {
        console.error('[ExifService] Error extracting full metadata:', err.message);
        return null;
    }
}
