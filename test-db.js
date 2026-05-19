import pkg from 'pg';
const { Client } = pkg;

async function testConnection(url) {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log(`✅ Success: ${url}`);
    await client.end();
  } catch (err) {
    console.error(`❌ Failed: ${url}`);
    console.error(`   Error: ${err.message}`);
  }
}

async function run() {
  await testConnection('postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:5432/postgres');
  await testConnection('postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres');
}

run();
