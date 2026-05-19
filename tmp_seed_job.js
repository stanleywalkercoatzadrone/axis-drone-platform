import { query } from './backend/config/database.js';

async function run() {
    const res = await query('SELECT count(*) FROM orthomosaic_jobs');
    if (res.rows[0].count == 0) {
        let users = await query("SELECT id, tenant_id FROM users WHERE tenant_id != 'default' LIMIT 1");
        if (users.rows.length === 0) {
            console.log("Error: DB has no users with UUID tenant_ids. Creating a random UI tenant...");
            process.exit(1);
        }
        const tenant_id = users.rows[0].tenant_id;
        const user_id = users.rows[0].id;

        let mission_id = 'b9a8972e-06ea-448f-aa1a-8cba9a65d6c8';
        const missions = await query("SELECT id FROM deployments WHERE tenant_id = $1 LIMIT 1", [tenant_id]);
        if (missions.rows.length > 0) mission_id = missions.rows[0].id;

        const proj = await query(
            `INSERT INTO orthomosaic_projects (tenant_id, name, site_name, mission_id, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
             [tenant_id, "Axis Enterprise Photogrammetry Setup", "Houston Grid 1", mission_id, user_id]
        );
        const job = await query(
            `INSERT INTO orthomosaic_jobs
             (project_id, tenant_id, quality_tier, processing_engine, status, pilot_id, created_by)
             VALUES ($1, $2, 'high', 'mock', 'completed', $3, $3) RETURNING id`,
             [proj.rows[0].id, tenant_id, user_id]
        );
        const job_id = job.rows[0].id;
        await query(`INSERT INTO orthomosaic_outputs (job_id, output_type, file_path, file_size_bytes, gs_bucket) VALUES ($1, 'orthomosaic', 'mock/orthomosaic.tif', 48000000, 'mock-bucket')`, [job_id]);

        console.log("Mock jobs generated in DB.");
    } else {
        console.log("Jobs already exist.");
    }
    process.exit(0);
}
run();
