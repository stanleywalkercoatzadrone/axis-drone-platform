/**
 * flightTimeEstimator.js
 * Phase 14 – Predictive Flight Time Model
 *
 * Estimates flight hours, battery swaps, and pilot days required for a mission.
 * Uses site acreage, flight altitude, sensor type, and waypoint density.
 */

// Sensor efficiency presets (acres per flight hour at standard settings)
const SENSOR_EFFICIENCY = {
    rgb: 120,         // RGB camera: fast, high resolution
    multispectral: 80, // Multispectral: slower, more passes
    thermal: 60,      // Thermal: requires overlap, precise gimbal
    lidar: 50,        // LiDAR: dense point cloud, slower
    hyperspectral: 40, // Most intensive
    default: 90,
};

// Average flight time per battery swap (minutes)
const BATTERY_DURATION_MINUTES = 22;

// Pilot productive hours per day (accounting for setup/data download/breaks)
const PILOT_HOURS_PER_DAY = 5.5;

/**
 * Estimate flight requirements for a mission.
 * @param {Object} params
 * @param {number} params.acreage - site size in acres
 * @param {number} params.altitudeM - flight altitude in meters (affects GSD and coverage)
 * @param {string} params.sensorType - rgb | multispectral | thermal | lidar | hyperspectral
 * @param {number} params.waypointDensity - waypoints per acre (affects overlap/flight line density)
 * @param {number} [params.overlapPercent=80] - front/side overlap percentage
 * @returns {Object} flight plan estimate
 */
export function estimateFlightTime({
    acreage,
    altitudeM = 60,
    sensorType = 'rgb',
    waypointDensity = 4,
    overlapPercent = 80
}) {
    if (!acreage || acreage <= 0) {
        throw new Error('Acreage is required and must be positive');
    }

    // Base efficiency for sensor type
    const baseEfficiencyAcresPerHour = SENSOR_EFFICIENCY[sensorType?.toLowerCase()] || SENSOR_EFFICIENCY.default;

    // Altitude modifier: higher altitude = more coverage = faster (up to a point)
    // Nominal altitude is 60m — each 10m above reduces time; below 60m increases
    const altitudeFactor = Math.min(1.4, Math.max(0.6, 1 + (altitudeM - 60) / 200));

    // Waypoint density modifier: more waypoints = more total distance
    const waypointFactor = 1 + (waypointDensity - 4) * 0.05;

    // Overlap modifier: higher overlap = more passes = slower
    const overlapFactor = 1 + (overlapPercent - 70) / 200;

    // Effective efficiency
    const effectiveEfficiency = baseEfficiencyAcresPerHour * altitudeFactor / (waypointFactor * overlapFactor);

    // Total flight hours
    const totalFlightHours = acreage / effectiveEfficiency;

    // Battery swaps (each battery lasts BATTERY_DURATION_MINUTES minutes of flight)
    const totalFlightMinutes = totalFlightHours * 60;
    const batteryCycles = Math.ceil(totalFlightMinutes / BATTERY_DURATION_MINUTES);
    // Subtract 1 for first battery (already loaded), minimum 0
    const batterySwaps = Math.max(0, batteryCycles - 1);

    // Pilot days required
    const pilotDaysRequired = Math.ceil(totalFlightHours / PILOT_HOURS_PER_DAY);

    // Setup/logistics days (roughly 1 day per 3 field days, min 1)
    const setupDays = Math.max(1, Math.floor(pilotDaysRequired / 3));

    // Total project duration
    const totalProjectDays = pilotDaysRequired + setupDays;

    return {
        acreage,
        altitudeM,
        sensorType,
        waypointDensity,
        overlapPercent,
        totalFlightHours: Math.round(totalFlightHours * 10) / 10,
        totalFlightMinutes: Math.round(totalFlightMinutes),
        batterySwaps,
        batteryCycles,
        pilotDaysRequired,
        setupDays,
        totalProjectDays,
        effectiveAcresPerHour: Math.round(effectiveEfficiency * 10) / 10,
        assumptions: {
            hoursPerPilotDay: PILOT_HOURS_PER_DAY,
            batteryDurationMinutes: BATTERY_DURATION_MINUTES,
            sensorEfficiencyUsed: baseEfficiencyAcresPerHour,
        }
    };
}

/**
 * Estimate from a deployment/site record.
 * @param {Object} site - site object with acreage, latitude, longitude, etc.
 * @param {Object} flightParams - flight_parameters record
 */
export function estimateFromSiteRecord(site, flightParams = {}) {
    return estimateFlightTime({
        acreage: parseFloat(site.acreage) || 100,
        altitudeM: parseFloat(flightParams.flight_altitude_m) || 60,
        sensorType: flightParams.sensor_type || site.sensorType || 'rgb',
        waypointDensity: parseFloat(flightParams.waypoint_count) / Math.max(1, parseFloat(site.acreage)) || 4,
        overlapPercent: parseFloat(flightParams.overlap_percent) || 80,
    });
}
