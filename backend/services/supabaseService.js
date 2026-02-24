import { supabase } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const uploadToSupabase = async (file, path, options = {}) => {
    // Debug Log for Env
    if (!supabase) {
        console.error('❌ Supabase Client is NULL. detailed env check:');
        console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
        console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Missing');
        throw new AppError('Supabase is not configured', 500);
    }

    const { bucketName = 'documents', upsert = false } = options;

    console.log(`📤 Uploading to Supabase: Bucket=${bucketName}, Path=${path}, Size=${file.size}`);

    try {
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(path, file.buffer, {
                contentType: file.mimetype,
                upsert: upsert
            });

        if (error) {
            console.error('❌ Supabase Upload Error:', JSON.stringify(error, null, 2));
            throw error;
        }

        console.log('✅ Supabase Upload Success:', data);

        // Get Public URL
        const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(path);

        return {
            path: data.path,
            fullPath: data.fullPath,
            publicUrl: publicUrlData.publicUrl
        };
    } catch (error) {
        console.error('🔥 CRITICAL Error uploading to Supabase:', error);
        throw new AppError('Failed to upload file to storage: ' + error.message, 500);
    }
};

export const getSignedUrl = async (path, expiresIn = 3600, bucketName = 'documents') => {
    if (!supabase) {
        throw new AppError('Supabase is not configured', 500);
    }

    try {
        const { data, error } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(path, expiresIn);

        if (error) throw error;

        return data.signedUrl;
    } catch (error) {
        console.error('Error getting signed URL:', error);
        throw new AppError('Failed to generate access link', 500);
    }
};
