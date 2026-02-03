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

// Configure Google Cloud Storage
let gcs = null;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;

if (process.env.STORAGE_PROVIDER === 'gcs' && GCS_BUCKET_NAME) {
    try {
        gcs = new Storage({
            projectId: process.env.GCS_PROJECT_ID,
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        console.log(`✅ Google Cloud Storage initialized - Bucket: ${GCS_BUCKET_NAME}`);
    } catch (error) {
        console.error('❌ GCS initialization error:', error.message);
    }
}

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'skylens-images';
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
        throw new Error('Google Cloud Storage not initialized. Please configure GCS_BUCKET_NAME and GOOGLE_APPLICATION_CREDENTIALS');
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;

    try {
        const bucket = gcs.bucket(GCS_BUCKET_NAME);
        const blob = bucket.file(fileName);

        // Upload file
        await blob.save(file.buffer, {
            contentType: file.mimetype,
            metadata: {
                cacheControl: 'public, max-age=31536000',
            }
        });

        // Make file public (optional - remove if using private buckets)
        await blob.makePublic();

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileName}`;

        return {
            url: publicUrl,
            key: fileName
        };
    } catch (error) {
        console.error('GCS upload error:', error);
        throw new Error('Failed to upload file to Google Cloud Storage');
    }
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


export const uploadToS3 = async (file, folder = 'images') => {
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

