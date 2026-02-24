
import { uploadToGCS } from './backend/services/gcsService.js';

async function testUpload() {
    console.log('🧪 Testing GCS Upload...');
    try {
        const mockFile = {
            buffer: Buffer.from('Test content'),
            originalname: 'test.txt',
            mimetype: 'text/plain',
            size: 12
        };

        const dest = `test_uploads/${Date.now()}_test.txt`;
        console.log(`Target: ${dest}`);

        const result = await uploadToGCS(mockFile, dest);
        console.log('✅ Success:', result);
    } catch (err) {
        console.error('❌ Failed:', err);
    }
}

testUpload();
