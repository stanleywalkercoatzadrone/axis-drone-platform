import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'skylens_secret_key_change_in_prod';

// Create a fake admin token
const token = jwt.sign({ id: 'dummy-admin-id', role: 'admin' }, secret, { expiresIn: '1h' });

async function checkDiagnostics() {
    try {
        const url = 'https://axis-platform-238975492579.us-central1.run.app/api/pilot/upload-jobs/_diagnostics/ai-pipeline';
        console.log('Fetching', url);
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
           console.log('Error:', data);
           return;
        }

        console.log('\n=== Recent Files Pipeline Health ===');
        for (const row of data.data) {
          console.log(`\n📄 File: ${row.file_name} | Type: ${row.upload_type}/${row.analysis_type} | Status: ${row.status}`);
          console.log(`  Time: ${row.created_at}`);
          const r = row.ai_result;
          if (r) {
              console.log('  faults:',    (r?.faults    || []).length);
              console.log('  defects:',   (r?.defects   || []).length);
              console.log('  anomalies:', (r?.anomalies || []).length);
              console.log('  overallCondition:', r?.overallCondition);
              if (r.error) console.log('  error:', r.error);
              
              if ((r?.faults || []).length > 0) {
                  console.log('  first fault:', JSON.stringify(r.faults[0]));
              }
          } else {
              console.log(`  No ai_result object. Error_message:`, row.error_message);
          }
        }

    } catch (e) {
        console.error(e);
    }
}

checkDiagnostics();
