import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const bucketName = 'documents';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');
    process.exit(1);
}

async function testSupabaseStorage() {
    console.log('Testing Supabase Storage...');
    console.log(`URL: ${supabaseUrl}`);
    console.log(`Bucket: ${bucketName}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // Test 1: List buckets
    console.log('\n1. Listing buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
        console.error('❌ Failed to list buckets:', bucketsError);
    } else {
        console.log('✅ Buckets:', buckets.map(b => b.name));
    }

    // Test 2: Try to upload a test file
    console.log(`\n2. Uploading test PDF file to ${bucketName}...`);
    const testData = Buffer.from('test file content');
    const testFileName = `test/${Date.now()}_test.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(testFileName, testData, {
            contentType: 'application/pdf',
            upsert: false
        });

    if (uploadError) {
        console.error('❌ Upload failed:', uploadError);
        console.error('Error details:', JSON.stringify(uploadError, null, 2));
    } else {
        console.log('✅ Upload successful!');
        console.log('Path:', uploadData.path);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(uploadData.path);

        console.log('Public URL:', publicUrl);
    }
}

testSupabaseStorage().catch(console.error);
