import pg from 'pg';

// Correctly encoded URI from the .env file!
const dbRaw = "postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new pg.Pool({ 
  connectionString: dbRaw, 
  ssl: { rejectUnauthorized: false } 
});

async function diagnose() {
  console.log('🔍 Diagnosing AI analysis pipeline...\n');

  try {
    const files = await pool.query(`
      SELECT uf.id, uf.file_name, uf.status, uf.error_message, 
             uj.upload_type, uj.analysis_type, uf.ai_result, uf.created_at
      FROM upload_files uf
      JOIN upload_jobs uj ON uj.id = uf.job_id
      ORDER BY uf.created_at DESC
      LIMIT 10
    `);
    
    console.log('\n=== Recent Files Pipeline Health ===');
    for (const row of files.rows) {
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
    console.log(e);
  }

  await pool.end();
}

diagnose();
