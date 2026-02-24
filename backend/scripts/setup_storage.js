import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try to load from .env files if they exist
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('\n❌ Error: Missing Supabase Credentials');
    console.error('Please verify that SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) are set in your environment or .env file.');
    console.error('You can run this script with inline env vars:');
    console.error('  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node backend/scripts/setup_storage.js\n');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
    console.log('🚀 Starting Storage Setup...');
    const bucketName = 'documents';

    // 1. Create/Check Bucket
    console.log(`\nChecking bucket: '${bucketName}'...`);
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Error listing buckets:', listError.message);
        return;
    }

    const bucketExists = buckets.find(b => b.name === bucketName);

    if (bucketExists) {
        console.log(`✅ Bucket '${bucketName}' already exists.`);
    } else {
        console.log(`Creating bucket '${bucketName}'...`);
        const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true, // For immediate retrieval as requested
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
        });

        if (createError) {
            console.error(`❌ Failed to create bucket '${bucketName}':`, createError.message);
            return;
        }
        console.log(`✅ Bucket '${bucketName}' created successfully.`);
    }

    // 2. Create Folder Structure
    // S3/Supabase storage is flat; folders are created by file paths.
    // We use .keep files to establish the structure.
    const folders = [
        'pilots/.keep',
        'missions/photos/.keep',
        'missions/files/.keep',
        'misc/.keep'
    ];

    console.log('\nCreating folder structure (via .keep files)...');

    for (const filePath of folders) {
        // Optimistic upload - standard way to ensure "folder" exists
        const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, '', {
                contentType: 'text/plain',
                upsert: true
            });

        if (uploadError) {
            console.error(`  ❌ Failed to ensure '${filePath}':`, uploadError.message);
        } else {
            console.log(`  ✅ Verified '${filePath}'`);
        }
    }

    console.log('\n✨ Storage setup complete!');
}

setupStorage();
