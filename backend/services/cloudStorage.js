/**
 * cloudStorage.js — thin wrapper over storageService for GCS-specific operations.
 * Provides `getSignedUploadUrl` used by the candidate upload portal.
 */
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID;

let storage = null;

if (GCS_BUCKET_NAME) {
    try {
        storage = new Storage({ projectId: GCS_PROJECT_ID });
    } catch (err) {
        console.warn('⚠️  GCS cloudStorage: failed to initialize Storage client:', err.message);
    }
}

/**
 * Generate a signed upload URL that allows a client to PUT a file
 * directly to GCS without going through the backend.
 * Falls back to a local upload endpoint path if GCS is not configured.
 */
export const getSignedUploadUrl = async ({ fileName, contentType, folder = 'candidates' }) => {
    if (!storage || !GCS_BUCKET_NAME) {
        // Fallback: return a flag telling the caller to use direct upload
        console.warn('⚠️  GCS not configured — returning fallback upload path');
        return {
            url: null,
            gcsPath: null,
            fallback: true,
        };
    }

    const ext = path.extname(fileName) || '';
    const gcsPath = `${folder}/${uuidv4()}${ext}`;

    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: contentType || 'application/octet-stream',
    };

    try {
        const [url] = await storage
            .bucket(GCS_BUCKET_NAME)
            .file(gcsPath)
            .getSignedUrl(options);

        return { url, gcsPath, fallback: false };
    } catch (err) {
        console.error('❌ getSignedUploadUrl error:', err.message);
        return { url: null, gcsPath: null, fallback: true };
    }
};
