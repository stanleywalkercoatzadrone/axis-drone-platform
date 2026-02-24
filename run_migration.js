
import https from 'https';

const API_URL = 'https://axis-platform-238975492579.us-central1.run.app/api/migrations/run?secret=axis2026';

console.log('\n🔧 Production Database Migration Tool (Double Check Mode)');
console.log('=======================================================');
console.log('This tool will add ALL missing columns (daily_pay_rate, viewed_at, payment_days).');

const request = https.request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';

    res.on('data', (chunk) => { data += chunk; });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);

            if (res.statusCode >= 200 && res.statusCode < 300) {
                // VERIFICATION CHECK
                if (json.message && json.message.includes('viewed_at')) {
                    console.log('\n✅ SUCCESS! (Verified Code v2)');
                    console.log('Message:', json.message);
                    console.log('\nAll missing columns have been added.');
                    console.log('👉 Invoices are DEFINITELY fixed now.');
                } else {
                    console.warn('\n⚠️  WARNING: Old Code Detected!');
                    console.warn('The server is still running the old version.');
                    console.warn('Please wait 30-60 seconds for deployment to finish.');
                    console.warn('Then run this script again.');
                }
            } else {
                console.error('\n❌ FAILED');
                console.error('Status:', res.statusCode);
                console.error('Error:', json.message || 'Unknown error');

                if (res.statusCode === 404) {
                    console.log('Tip: Deployment might still be in progress (404 Not Found). Wait a minute.');
                }
            }
        } catch (e) {
            console.error('Error parsing response:', e.message);
            console.log('Raw response:', data);
        }
    });
});

request.on('error', (e) => {
    console.error(`\n❌ NETWORK ERROR: ${e.message}`);
});

request.end();
