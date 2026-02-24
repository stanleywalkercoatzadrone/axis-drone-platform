import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import supabase from '../config/supabase.js';
import { logger } from './logger.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure AWS S3 (Lazy load or conditional?)
// We keep the S3 config but wrap it to be safe
let s3;
if (process.env.AWS_ACCESS_KEY_ID) {
    s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
    });
}

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'skylens-images';
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'drone-images';
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local'; // 'local', 's3', 'supabase' ('gcs' deprecated)


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

// ==================== S3 STORAGE ====================

export const uploadToS3 = async (file, folder = 'images') => {
    if (!s3) throw new Error('AWS S3 not configured');

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;

    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private'
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
    if (!s3) return false;
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
    if (!s3) throw new Error('AWS S3 not configured');
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
        case 'supabase':
            if (!supabase) {
                console.warn('⚠️  Supabase not configured — falling back to local storage');
                return uploadLocal(file, folder);
            }
            return uploadToSupabase(file, folder);
        case 's3':
            return uploadToS3(file, folder);
        case 'gcs': // Fallback for deprecated config
            console.warn('GCS provider is deprecated. Falling back to Supabase or Local.');
            if (supabase) return uploadToSupabase(file, folder);
            return uploadLocal(file, folder);
        case 'local':
        default:
            return uploadLocal(file, folder);
    }
};

export const deleteFile = async (key) => {
    switch (STORAGE_PROVIDER) {
        case 'supabase':
            return deleteFromSupabase(key);
        case 's3':
            return deleteFromS3(key);
        case 'local':
        default:
            return deleteLocal(key);
    }
};

// Log storage configuration
console.log(`📦 Storage provider: ${STORAGE_PROVIDER}`);
if (STORAGE_PROVIDER === 'supabase') {
    console.log(`   Supabase bucket: ${SUPABASE_BUCKET}`);
} else if (STORAGE_PROVIDER === 's3') {
    console.log(`   S3 bucket: ${BUCKET_NAME}`);
} else {
    console.log(`   Local storage: ./uploads`);
}

