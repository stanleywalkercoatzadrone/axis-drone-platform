import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import db from './backend/config/database.js';
import { v4 as uuidv4 } from 'uuid';

async function backfill() {
    try {
        // 1. Get the "Solar" industry
        const solarIndustry = await db.query("SELECT id FROM industries WHERE key = 'solar'");
        if (solarIndustry.rows.length === 0) {
            console.error("Solar industry not found!");
            process.exit(1);
        }
        const solarIndustryId = solarIndustry.rows[0].id;

        // 2. Check if there's a client for Solar
        let clientRes = await db.query("SELECT id, name FROM clients WHERE industry_id = $1 LIMIT 1", [solarIndustryId]);
        let clientId;

        if (clientRes.rows.length === 0) {
            console.log("No Solar client found. Creating 'SunCoast Solar Partners'...");
            clientId = uuidv4();
            await db.query(
                "INSERT INTO clients (id, name, industry_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
                [clientId, 'SunCoast Solar Partners', solarIndustryId]
            );
        } else {
            clientId = clientRes.rows[0].id;
            console.log(`Found existing Solar client: ${clientRes.rows[0].name} (${clientId})`);
        }

        // 3. Assign orphaned missions (site_id is null and client_id is null) to this client
        console.log("Assigning orphaned legacy missions to the Solar client...");
        const updateRes = await db.query(
            "UPDATE deployments SET client_id = $1 WHERE client_id IS NULL AND site_id IS NULL",
            [clientId]
        );
        console.log(`Updated ${updateRes.rowCount} missions.`);

        // 4. Create a Solar Site for that client if one doesn't exist
        let siteRes = await db.query("SELECT id FROM sites WHERE client_id = $1 LIMIT 1", [clientId]);
        let siteId;
        if (siteRes.rows.length === 0) {
            console.log("No Site found for this client. Creating 'West Field Array 1'...");
            siteId = uuidv4();
            await db.query(
                "INSERT INTO sites (id, name, client, client_id, location, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())",
                [siteId, 'West Field Array 1', 'SunCoast Solar Partners', clientId, '{"lat": 34.05, "lng": -118.24}', 'Active']
            );
        } else {
            siteId = siteRes.rows[0].id;
            console.log(`Found existing Site for this client: ${siteId}`);
        }

        // 5. Create some mock assets for this site if none exist
        const assetCheck = await db.query("SELECT id FROM assets WHERE site_id = $1", [siteId]);
        if (assetCheck.rows.length === 0) {
            console.log("Creating mock assets for the solar site...");
            const userRes = await db.query("SELECT id FROM users LIMIT 1");
            const userId = userRes.rows[0]?.id;

            if (!userId) {
                console.error("No users found to assign to assets!");
                process.exit(1);
            }

            await db.query(
                `INSERT INTO assets (id, site_id, client_id, asset_key, asset_type, status, industry) VALUES 
         ($1, $4, $5, 'String-A1', 'Solar Panel', 'complete', 'solar'),
         ($2, $4, $5, 'Inverter-01', 'Inverter', 'complete', 'solar'),
         ($3, $4, $5, 'Tracker-Sys', 'Mounting', 'complete', 'solar')`,
                [uuidv4(), uuidv4(), uuidv4(), siteId, userId]
            );
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

backfill();
