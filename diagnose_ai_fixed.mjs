import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/Huvrs/Projects/axis-drone-platform/.env' });

const dbUrl = new URL(process.env.DATABASE_URL);
const pool = new pg.Pool({
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port),
  database: dbUrl.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

async function diagnose() {
  console.log('🔍 Diagnosing AI analysis pipeline...\n');

  // 1. Check upload_jobs analysis types
  const jobs = await pool.query(`
    SELECT upload_type, analysis_type, status, COUNT(*) as count
    FROM upload_jobs
    GROUP BY upload_type, analysis_type, status
    ORDER BY count DESC
    LIMIT 20
  `);
  console.log('=== Upload Jobs by Type ===');
  console.table(jobs.rows);

  // 2. Check upload_files — do they have ai_result?
  const files = await pool.query(`
    SELECT
      uj.upload_type, uj.analysis_type,
      COUNT(uf.id) as total_files,
      COUNT(uf.id) FILTER (WHERE uf.ai_result IS NOT NULL) as files_with_ai,
      COUNT(uf.id) FILTER (WHERE uf.status = 'complete') as files_complete,
      COUNT(uf.id) FILTER (WHERE uf.status = 'failed') as files_failed
    FROM upload_jobs uj
    LEFT JOIN upload_files uf ON uf.job_id = uj.id
    GROUP BY uj.upload_type, uj.analysis_type
    ORDER BY total_files DESC
    LIMIT 20
  `);
  console.log('\n=== Per-File AI Coverage ===');
  console.table(files.rows);

  // 3. Sample a real ai_result to see what Gemini returned
  const sample = await pool.query(`
    SELECT uf.file_name, uf.status, uf.error_message, uj.upload_type, uj.analysis_type,
           uf.ai_result
    FROM upload_files uf
    JOIN upload_jobs uj ON uj.id = uf.job_id
    ORDER BY uf.created_at DESC
    LIMIT 10
  `);
  console.log('\n=== Sample AI Results (last 10 files) ===');
  for (const row of sample.rows) {
    console.log(`\n📄 File: ${row.file_name} | Type: ${row.upload_type}/${row.analysis_type} | Status: ${row.status}`);
    const r = row.ai_result;
    if (r) {
        console.log('  faults:',    (r?.faults    || []).length);
        console.log('  defects:',   (r?.defects   || []).length);
        console.log('  anomalies:', (r?.anomalies || []).length);
        console.log('  totalFaults:', r?.totalFaults, '| totalDefects:', r?.totalDefects);
        console.log('  overallCondition:', r?.overallCondition);
        console.log('  summary:', (r?.summary || '').substring(0, 120));
        console.log('  error:', r?.error || 'none');
        if ((r?.faults || []).length > 0) {
            console.log('  first fault:', JSON.stringify(r.faults[0]));
        }
    } else {
        console.log(`  No ai_result. Error message: ${row.error_message}`);
    }
  }

  await pool.end();
}

diagnose().catch(e => { console.error('FATAL:', e.message); pool.end(); });
