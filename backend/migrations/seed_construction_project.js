import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.nkhiiwleyjsmvvdtkcud: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@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runSeed() {
  console.log('🌱 Starting Construction Project Seed...');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if phases exist, if not, wait for migration
    const phasesRes = await client.query('SELECT id, name FROM construction_phases');
    if (phasesRes.rows.length === 0) {
      console.log('⚠️  No construction phases found. Please ensure 005_add_construction_monitoring.sql has been applied.');
      return;
    }
    
    // Get phase IDs mapping
    const phases = {};
    phasesRes.rows.forEach(p => { phases[p.name] = p.id; });
    
    // Create Project
    console.log('📝 Creating Sample Project: "Project Helios - Phase 1"');
    const projectRes = await client.query(`
      INSERT INTO construction_projects (name, epc_contractor, target_cod, baseline_start_date, baseline_end_date, status)
      VALUES ($1, $2, CURRENT_DATE + INTERVAL '120 days', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '110 days', 'Active')
      RETURNING id
    `, ['Project Helios - Phase 1', 'Apex Solar EPC']);
    
    const projectId = projectRes.rows[0].id;
    
    // Create Milestones
    console.log('📝 Creating Milestones...');
    await client.query(`
      INSERT INTO construction_milestones (project_id, name, target_date, actual_date, status) VALUES
      ($1, 'Site Mobilization', CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE - INTERVAL '48 days', 'Completed'),
      ($1, 'Grading Completion', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '15 days', 'Completed'),
      ($1, 'Racking Commenced', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '10 days', 'Completed'),
      ($1, 'First Block Mechanical Completion', CURRENT_DATE + INTERVAL '30 days', NULL, 'Pending')
    `, [projectId]);
    
    // Create Issues
    console.log('📝 Creating Issues & Risks...');
    await client.query(`
      INSERT INTO construction_issues (project_id, phase_id, title, description, severity, status, reported_date) VALUES
      ($1, $2, 'Heavy Rain Delay on Access Roads', 'Recent heavy rainfall has made primary access roads impassable for heavy equipment, delaying racking delivery.', 'High', 'Open', CURRENT_DATE - INTERVAL '2 days'),
      ($1, $3, 'Missing Steel Pilings', 'Shipment #402 containing 500 steel pilings was delayed at the port.', 'Medium', 'Open', CURRENT_DATE - INTERVAL '1 days'),
      ($1, $4, 'Resolved: Trenching Rock Strike', 'Hit bedrock during trenching for Block 2. Required specialized equipment.', 'Medium', 'Closed', CURRENT_DATE - INTERVAL '15 days')
    `, [projectId, phases['Access roads'], phases['Pile installation'], phases['Trenching']]);
    
    // Create Observations
    console.log('📝 Creating Progress Observations...');
    await client.query(`
      INSERT INTO construction_observations (project_id, phase_id, percent_complete, notes, observed_date) VALUES
      ($1, $2, 100, 'Site clearing completely finished.', CURRENT_DATE - INTERVAL '40 days'),
      ($1, $3, 95, 'Grading nearly complete, minor touchups on South quadrant.', CURRENT_DATE - INTERVAL '10 days'),
      ($1, $4, 60, 'Access roads stalled due to weather.', CURRENT_DATE - INTERVAL '1 days'),
      ($1, $5, 45, 'Pile installation proceeding well on Block 1 & 2.', CURRENT_DATE),
      ($1, $6, 15, 'Racking started on Block 1.', CURRENT_DATE)
    `, [projectId, phases['Civil work'], phases['Grading'], phases['Access roads'], phases['Pile installation'], phases['Racking installation']]);

    // Create a generated report
    console.log('📝 Creating Previous Daily Report...');
    await client.query(`
      INSERT INTO construction_daily_reports (project_id, report_date, executive_summary, status) VALUES
      ($1, CURRENT_DATE - INTERVAL '1 days', 'Yesterday saw strong progress on Pile Installation, reaching 40% completion overall. However, Access Roads remain at 60% due to the weather event, creating a slight bottleneck for incoming Racking deliveries. Focus for tomorrow is resolving the road blockages.', 'Published')
    `, [projectId]);
    
    await client.query('COMMIT');
    console.log('✅ Successfully seeded Project Helios!');
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error during seed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
