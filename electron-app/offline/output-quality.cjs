'use strict';
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const execute = promisify(execFile);

async function inspectRaster(file, environment, signal) {
  if (!environment) throw Error('The native runtime did not provide its raster validator.');
  const binary = path.join(environment, process.platform === 'win32' ? 'Library/bin/gdalinfo.exe' : 'bin/gdalinfo');
  // Checksums force GDAL to decode the raster, rather than accepting its TIFF header alone.
  const {stdout, stderr} = await execute(binary, ['-json', '-checksum', file], {
    signal, timeout: 120000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    env: {...process.env, CONDA_PREFIX: environment, PATH: [path.dirname(binary), process.env.PATH].join(path.delimiter)},
  });
  if (/ERROR\s+\d+:/i.test(stderr)) throw Error('The generated raster could not be fully decoded.');
  return JSON.parse(stdout);
}

function rasterSummary(info) {
  const transform = info?.geoTransform;
  const size = info?.size;
  if (info?.driverShortName !== 'GTiff' || !Array.isArray(size) || size.length !== 2 || size.some(n => !Number.isSafeInteger(n) || n < 1)
    || !info.coordinateSystem?.wkt || !Array.isArray(transform) || transform.length !== 6 || transform.some(n => !Number.isFinite(n))
    || Math.abs(transform[1] * transform[5] - transform[2] * transform[4]) === 0
    || !Array.isArray(info.bands) || !info.bands.length || info.bands.some(b => !Number.isInteger(b.checksum))) {
    throw Error('The orthomosaic must be a readable GeoTIFF with a coordinate system and valid pixel geometry.');
  }
  return {
    width: size[0], height: size[1], epsg: info.stac?.['proj:epsg'] || null,
    coordinateSystem: info.coordinateSystem.wkt, geoTransform: transform,
    pixelSize: [Math.hypot(transform[1], transform[4]), Math.hypot(transform[2], transform[5])],
    cloudOptimized: info.metadata?.IMAGE_STRUCTURE?.LAYOUT === 'COG',
    bands: info.bands.map(b => ({type: b.type, color: b.colorInterpretation, checksum: b.checksum})),
  };
}

function qualitySummary(job, raster, stats) {
  const r = stats?.reconstruction_statistics || {};
  const total = job.inputs.length, aligned = Number.isSafeInteger(r.reconstructed_shots_count) ? r.reconstructed_shots_count : null;
  const warnings = [];
  if (job.preset === 'fast') warnings.push('Fast preview: review seams, missing coverage and surface detail before client delivery.');
  if (aligned === null) warnings.push('Camera alignment statistics are unavailable.');
  else if (aligned < total * .9) warnings.push('Fewer than 90% of selected images were reconstructed. Review missing coverage.');
  if (r.components > 1) warnings.push('The reconstruction contains disconnected components.');
  if (Number.isFinite(r.reprojection_error_pixels) && r.reprojection_error_pixels > 2) warnings.push('Reprojection error exceeds the Axis review threshold of 2 pixels.');
  if (!r.has_gcp) warnings.push('No ground control is recorded. Independent positional accuracy has not been verified.');
  if (!raster.cloudOptimized) warnings.push('This raster is not identified as a cloud optimized GeoTIFF.');
  if (job.radiometricCalibration) warnings.push('Camera calibration was requested. Temperature units and accuracy require camera-specific validation; this summary does not certify thermal measurements.');
  return {
    schemaVersion: 1, jobId: job.id, generatedAt: new Date().toISOString(), status: 'review_required',
    selectedImages: total, reconstructedImages: aligned,
    reconstructionRatio: aligned === null ? null : aligned / total,
    reprojectionErrorPixels: Number.isFinite(r.reprojection_error_pixels) ? r.reprojection_error_pixels : null,
    groundControlRecorded: r.has_gcp === true, independentAccuracyVerified: false,
    preset: job.preset, raster, warnings,
    review: 'Inspect gaps, seams, blur, site coverage and independent checkpoints before approving this output for a client. These thresholds flag review; they are not a survey accuracy certification.',
  };
}
async function sha256(file) {const hash = crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(file)) hash.update(chunk); return hash.digest('hex');}
module.exports = {inspectRaster, rasterSummary, qualitySummary, sha256};
