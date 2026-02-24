import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Only create client if Supabase credentials are configured
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log('✅ Supabase client initialized');
    } catch (err) {
        console.error('❌ Failed to initialize Supabase client:', err.message);
        console.log('ℹ️  Proceeding without Supabase storage.');
        supabase = null;
    }
} else {
    console.log('ℹ️  Supabase credentials not found - storage features will use local filesystem');
}

export { supabase };
export default supabase;
