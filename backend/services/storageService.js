import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import supabase from '../config/supabase.js';
import { Storage } from '@google-cloud/storage';

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

// Configure Google Cloud Storage — uses Application Default Credentials on Cloud Run
// (no keyFilename needed; Cloud Run service account provides credentials automatically)
let gcs = null;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;

if (process.env.STORAGE_PROVIDER === 'gcs' && GCS_BUCKET_NAME) {
    try {
        gcs = new Storage({
            projectId: process.env.GCS_PROJECT_ID || 'axis-platform-484701',
            // keyFilename intentionally omitted — uses ADC on Cloud Run
        });
        console.log(`✅ Google Cloud Storage initialized (ADC) - Bucket: ${GCS_BUCKET_NAME}`);
    } catch (error) {
        console.error('❌ GCS initialization error:', error.message);
    }
}

const BUCKET_NAME     = process.env.S3_BUCKET_NAME || 'skylens-images';
const S3_PATH_PREFIX  = process.env.S3_PATH_PREFIX ? process.env.S3_PATH_PREFIX.replace(/\/$/, '') + '/' : '';
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'drone-images';
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local'; // 'local', 's3', 'supabase', or 'gcs'


// ==================== SUPABASE STORAGE ====================

export const uploadToSupabase = async (file, folder = 'images') => {
    if (!supabase) {
        throw new Error('Supabase client not initialized. Please configure SUPABASE_URL and SUPABASE_SERVICE_KEY');
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;

    try {
        const { data, error } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error('Supabase upload error:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(SUPABASE_BUCKET)
            .getPublicUrl(data.path);

        return {
            url: publicUrl,
            key: data.path
        };
    } catch (error) {
        console.error('Supabase storage error:', error);
        throw new Error('Failed to upload file to Supabase storage');
    }
};

export const deleteFromSupabase = async (key) => {
    if (!supabase) return false;

    try {
        const { error } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .remove([key]);

        if (error) {
            console.error('Supabase delete error:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Supabase delete error:', error);
        return false;
    }
};

// ==================== GOOGLE CLOUD STORAGE ====================

export const uploadToGCS = async (file, folder = 'images') => {
    if (!gcs) {
        throw new Error('Google Cloud Storage not initialized. Please configure GCS_BUCKET_NAME');
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;

    try {
        const bucket = gcs.bucket(GCS_BUCKET_NAME);
        const blob = bucket.file(fileName);

        await blob.save(file.buffer, {
            contentType: file.mimetype,
            metadata: {
                originalName: file.originalname,
                cacheControl: 'private, max-age=3600',
            }
        });

        // Files are kept private — access via signed URL
        const gcsUri = `gs://${GCS_BUCKET_NAME}/${fileName}`;

        return {
            url: gcsUri,   // stored in DB; use getGCSSignedUrl() to generate download links
            key: fileName
        };
    } catch (error) {
        console.error('GCS upload error:', error);
        throw new Error('Failed to upload file to Google Cloud Storage');
    }
};

/**
 * Upload LBD/ground data to GCS with structured folder hierarchy.
 * GCS path: {projectName}/{pilotName}/{lbdBlock}/{uuid}{ext}
 *
 * @param {object} file        - multer file object
 * @param {string} projectName - Mission/project title
 * @param {string} pilotName   - Pilot or technician full name
 * @param {string} lbdBlock    - LBD block or scan area identifier
 */
export const uploadLBDToGCS = async (file, projectName, pilotName, lbdBlock) => {
    if (!gcs) throw new Error('GCS not initialised');

    const sanitize = str =>
        (str || 'Unknown').trim().replace(/[^\w\s\-().]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';

    const folder = [
        sanitize(projectName),
        sanitize(pilotName),
        sanitize(lbdBlock)
    ].join('/');

    const ext      = path.extname(file.originalname);
    const gcsKey   = `${folder}/${uuidv4()}${ext}`;
    const bucket   = gcs.bucket(GCS_BUCKET_NAME);
    const blob     = bucket.file(gcsKey);

    await blob.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
            originalName: file.originalname,
            projectName: sanitize(projectName),
            pilotName:   sanitize(pilotName),
            lbdBlock:    sanitize(lbdBlock),
            cacheControl: 'private, max-age=3600',
        }
    });

    return {
        url: `gs://${GCS_BUCKET_NAME}/${gcsKey}`,
        key: gcsKey
    };
};



export const deleteFromGCS = async (key) => {
    if (!gcs) return false;
    try {
        const bucket = gcs.bucket(GCS_BUCKET_NAME);
        await bucket.file(key).delete();
        return true;
    } catch (error) {
        console.error('GCS delete error:', error);
        return false;
    }
};

/**
 * Generate a signed download URL for a private GCS file.
 * @param {string} key - GCS object path (e.g. 'kml/abc123.kml')
 * @param {number} expiresInSeconds - default 1 hour
 */
export const getGCSSignedUrl = async (key, expiresInSeconds = 3600) => {
    if (!gcs) return null;
    try {
        const [url] = await gcs.bucket(GCS_BUCKET_NAME).file(key).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + expiresInSeconds * 1000,
        });
        return url;
    } catch (error) {
        console.error('GCS signed URL error:', error);
        return null;
    }
};


export const uploadToS3 = async (file, folder = 'images') => {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${S3_PATH_PREFIX}${folder}/${uuidv4()}${fileExtension}`;

    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype
        // ACL omitted: bucket uses Object Ownership 'Bucket owner enforced' which disables ACLs
    };

    try {
        const result = await s3.upload(params).promise();
        return {
            url: result.Location,
            key: result.Key
        };
    } catch (error) {
        console.error('S3 upload error:', error);
        throw new Error('Failed to upload file to storage');
    }
};

export const deleteFromS3 = async (key) => {
    const params = {
        Bucket: BUCKET_NAME,
        Key: key
    };

    try {
        await s3.deleteObject(params).promise();
        return true;
    } catch (error) {
        console.error('S3 delete error:', error);
        return false;
    }
};

export const getSignedUrl = async (key, expiresIn = 3600) => {
    const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Expires: expiresIn
    };

    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        return url;
    } catch (error) {
        console.error('S3 signed URL error:', error);
        throw new Error('Failed to generate signed URL');
    }
};

// ==================== LOCAL STORAGE ====================

export const uploadLocal = async (file, folder = 'uploads') => {
    const uploadDir = path.join(process.cwd(), folder);
    const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadDir, fileName);

    try {
        // Ensure directory exists
        await fs.mkdir(uploadDir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, file.buffer);

        return {
            url: `/${folder}/${fileName}`,
            key: `${folder}/${fileName}`
        };
    } catch (error) {
        console.error('Local upload error:', error);
        throw new Error('Failed to upload file to local storage');
    }
};

export const deleteLocal = async (key) => {
    try {
        const filePath = path.join(process.cwd(), key);
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        console.error('Local delete error:', error);
        return false;
    }
};

// ==================== UNIFIED STORAGE API ====================

export const uploadFile = async (file, folder = 'images') => {
    console.log(`📁 Uploading file using ${STORAGE_PROVIDER} storage provider`);

    switch (STORAGE_PROVIDER) {
        case 'gcs':
            return uploadToGCS(file, folder);
        case 'supabase':
            return uploadToSupabase(file, folder);
        case 's3':
            return uploadToS3(file, folder);
        case 'local':
        default:
            return uploadLocal(file, folder);
    }
};

export const deleteFile = async (key) => {
    switch (STORAGE_PROVIDER) {
        case 'gcs':
            return deleteFromGCS(key);
        case 'supabase':
            return deleteFromSupabase(key);
        case 's3':
            return deleteFromS3(key);
        case 'local':
        default:
            return deleteLocal(key);
    }
};

/**
 * Upload to an explicit destination regardless of STORAGE_PROVIDER.
 * Used by split-portal routes:
 *   destination='s3'  — aerial RGB/IR/orthomosaic images → tm-prod-pilot-california
 *   destination='gcs' — ground LBD/KML/sensor logs      → axis-platform-uploads
 */
export const uploadByDestination = async (file, folder, destination) => {
    console.log(`📁 Upload → ${destination.toUpperCase()} / ${folder}`);
    switch (destination) {
        case 's3':   return uploadToS3(file, folder);
        case 'gcs':  return uploadToGCS(file, folder);
        case 'supabase': return uploadToSupabase(file, folder);
        default:     return uploadLocal(file, folder);
    }
};

export const deleteByDestination = async (key, destination) => {
    switch (destination) {
        case 's3':   return deleteFromS3(key);
        case 'gcs':  return deleteFromGCS(key);
        default:     return deleteLocal(key);
    }
};

// Log storage configuration
console.log(`📦 Storage provider: ${STORAGE_PROVIDER}`);
if (STORAGE_PROVIDER === 'gcs') {
    console.log(`   Google Cloud Storage bucket: ${GCS_BUCKET_NAME}`);
} else if (STORAGE_PROVIDER === 'supabase') {
    console.log(`   Supabase bucket: ${SUPABASE_BUCKET}`);
} else if (STORAGE_PROVIDER === 's3') {
    console.log(`   S3 bucket: ${BUCKET_NAME}`);
} else {
    console.log(`   Local storage: ./uploads`);
}


// ==================== AERIAL IMAGING — EXIF-SMART IR/RGB SORT ====================
// Uses EXIF metadata as the primary classification signal.
// Falls back to MIME type, extension, and filename keywords.
//
// S3 structure:
//   {S3_PATH_PREFIX}{SiteName}/{missionId}/IR/{uuid}{ext}   — thermal/infrared
//   {S3_PATH_PREFIX}{SiteName}/{missionId}/RGB/{uuid}{ext}  — standard RGB

// Thermal camera model identifiers (DJI + FLIR product lines)
const IR_CAMERA_MODELS = ['xt', 'xt2', 'h20t', 'zh20t', 'xt s', 'zenmuse xt', 'flir', 'tau', 'boson', 'lepton', 'duo r'];
const IR_FILENAME_KW   = ['ir', 'thermal', 'infra', 'infrared', 'radiometric', 'flir', 'tir', 'temp', 'heat'];
const IR_EXTENSIONS    = ['.tif', '.tiff'];
const IR_MIMETYPES     = ['image/tiff', 'image/x-tiff', 'image/geotiff'];

/**
 * Classify an aerial image as 'IR' or 'RGB' using EXIF metadata.
 * Async — reads EXIF from file.buffer via exifr.
 *
 * Classification priority:
 * 1. EXIF camera model — DJI thermal (XT/H20T) or FLIR → IR
 * 2. EXIF BitsPerSample ≥ 14  OR  SamplesPerPixel = 1 (greyscale) → IR
 * 3. MIME type / extension (TIFF) → IR
 * 4. Filename keyword → IR
 * 5. Default → RGB
 *
 * @param {object} file - multer file object (file.buffer, file.originalname, file.mimetype)
 * @returns {Promise<{ imageType: 'IR'|'RGB', exifMeta: object|null }>}
 */
export async function classifyAerialImage(file) {
    let exifMeta = null;

    // ── 1. EXIF-based classification ──────────────────────────────────────────
    try {
        const exifr = (await import('exifr')).default;
        exifMeta = await exifr.parse(file.buffer, {
            tiff: true,
            ifd0: true, ifd1: false,
            exif: true,
            gps: true,
            xmp: false,
            iptc: false,
            pick: [
                'Make', 'Model',
                'BitsPerSample', 'SamplesPerPixel',
                'PhotometricInterpretation',
                'ImageWidth', 'ImageHeight',
                'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
                'DateTimeOriginal', 'CreateDate',
            ],
        });

        if (exifMeta) {
            const model = ((exifMeta.Model || '') + ' ' + (exifMeta.Make || '')).toLowerCase();

            // Thermal camera by make/model
            if (IR_CAMERA_MODELS.some(m => model.includes(m))) {
                console.log(`[classify] IR by camera model: "${exifMeta.Make} ${exifMeta.Model}" — ${file.originalname}`);
                return { imageType: 'IR', exifMeta };
            }

            // Thermal by bit depth (radiometric TIFFs are 14-bit or 16-bit)
            const bits = Array.isArray(exifMeta.BitsPerSample)
                ? Math.max(...exifMeta.BitsPerSample)
                : (exifMeta.BitsPerSample || 8);
            if (bits >= 14) {
                console.log(`[classify] IR by bit depth ${bits}-bit — ${file.originalname}`);
                return { imageType: 'IR', exifMeta };
            }

            // Thermal by greyscale (single channel)
            if (exifMeta.SamplesPerPixel === 1 || exifMeta.PhotometricInterpretation === 1) {
                console.log(`[classify] IR by greyscale (SamplesPerPixel=${exifMeta.SamplesPerPixel}) — ${file.originalname}`);
                return { imageType: 'IR', exifMeta };
            }
        }
    } catch (exifErr) {
        // EXIF read failure is non-fatal — fall through to heuristics
        console.warn(`[classify] EXIF read failed for ${file.originalname}: ${exifErr.message}`);
    }

    // ── 2. MIME / extension heuristics ────────────────────────────────────────
    const mime = (file.mimetype || '').toLowerCase();
    const name = (file.originalname || '').toLowerCase();
    const ext  = path.extname(name);

    if (IR_MIMETYPES.includes(mime) || IR_EXTENSIONS.includes(ext)) {
        console.log(`[classify] IR by MIME/ext (${mime || ext}) — ${file.originalname}`);
        return { imageType: 'IR', exifMeta };
    }

    // ── 3. Filename keyword fallback ──────────────────────────────────────────
    const base = name.slice(0, name.length - ext.length);
    if (IR_FILENAME_KW.some(kw => new RegExp(`(^|[_\\-\\s])${kw}([_\\-\\s]|$)`).test(base) || base === kw)) {
        console.log(`[classify] IR by filename keyword — ${file.originalname}`);
        return { imageType: 'IR', exifMeta };
    }

    return { imageType: 'RGB', exifMeta };
}

/**
 * Upload an aerial image to S3, auto-sorted into IR or RGB subfolder.
 * Uses EXIF metadata for classification. Stores EXIF-derived metadata on the S3 object.
 *
 * @param {object} file          - multer file object
 * @param {string} missionId     - Mission UUID
 * @param {string} [forceType]   - 'IR' or 'RGB' override (pilot selection)
 * @param {string} [siteName]    - Site/deployment name used as the parent S3 folder
 * @returns {Promise<{ url, key, imageType, exifMeta, bucket }>}
 */
export const uploadAerialImage = async (file, missionId, forceType = null, siteName = null) => {
    // Classify using EXIF (unless pilot explicitly chose IR/RGB)
    let imageType, exifMeta;
    if (forceType === 'IR' || forceType === 'RGB') {
        imageType = forceType;
        exifMeta  = null;
    } else {
        ({ imageType, exifMeta } = await classifyAerialImage(file));
    }

    const ext = path.extname(file.originalname);

    // Build site folder: sanitize for S3 key (preserve slashes for sub-folders like "Site/M14")
    // Each path segment is sanitized separately, then rejoined with /
    const sanitizeSegment = (s) =>
        s.trim().replace(/[^a-zA-Z0-9\-_.() ]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';

    const siteFolder = siteName
        ? siteName.split('/').map(sanitizeSegment).join('/')
        : 'Missions';

    // Final key: {prefix}{SiteName}/M{N}/IR|RGB/{uuid}{ext}
    // e.g. "Coatza Solar/M14/RGB/abc123.jpg"
    const s3Key = `${S3_PATH_PREFIX}${siteFolder}/${imageType}/${uuidv4()}${ext}`;

    // Extract mission label (last path segment of siteFolder, e.g. 'M14') for metadata
    const folderSegments = siteFolder.split('/');
    const missionLabel = folderSegments.length > 1 ? folderSegments[folderSegments.length - 1] : null;
    const siteFolderRoot = folderSegments.length > 1 ? folderSegments.slice(0, -1).join('/') : siteFolder;

    // Build S3 metadata from EXIF (all values must be strings for S3)
    const s3ObjectMeta = {
        originalName:  file.originalname,
        missionId,
        imageType,
        ...(missionLabel   && { missionLabel }),           // e.g. "M14"
        ...(siteFolderRoot && { siteName: siteFolderRoot }),// e.g. "Coatza Solar Farm"
        ...(exifMeta?.Make           && { cameraMake:  String(exifMeta.Make)  }),
        ...(exifMeta?.Model          && { cameraModel: String(exifMeta.Model) }),
        ...(exifMeta?.DateTimeOriginal && { capturedAt: String(exifMeta.DateTimeOriginal) }),
        ...(exifMeta?.GPSLatitude  != null && { gpsLat: String(exifMeta.GPSLatitude)  }),
        ...(exifMeta?.GPSLongitude != null && { gpsLon: String(exifMeta.GPSLongitude) }),
        ...(exifMeta?.GPSAltitude  != null && { gpsAlt: String(exifMeta.GPSAltitude)  }),
    };

    const params = {
        Bucket:      BUCKET_NAME,
        Key:         s3Key,
        Body:        file.buffer,
        ContentType: file.mimetype,
        // ACL omitted: bucket uses Object Ownership 'Bucket owner enforced' which disables ACLs
        Metadata:    s3ObjectMeta,
    };

    try {
        const result = await s3.upload(params).promise();
        console.log(`[storageService] Aerial → S3 ${imageType}: ${s3Key}`);
        return {
            url:       result.Location,
            key:       result.Key,
            imageType,
            exifMeta,
            bucket:    BUCKET_NAME,
        };
    } catch (error) {
        console.error('[storageService] S3 aerial upload error:', error.message);
        throw new Error(`Failed to upload aerial image to S3: ${error.message}`);
    }
};

/**
 * Generate a signed URL for downloading a private aerial image from S3.
 */
export const getAerialSignedUrl = async (key, expiresIn = 3600) => {
    try {
        return await s3.getSignedUrlPromise('getObject', { Bucket: BUCKET_NAME, Key: key, Expires: expiresIn });
    } catch (e) {
        console.error('[storageService] signed URL error:', e.message);
        return null;
    }
};
