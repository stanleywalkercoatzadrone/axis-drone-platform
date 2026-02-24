import db from './backend/config/database.js';

async function fetchData() {
    try {
        const deployRes = await db.query('SELECT id FROM deployments LIMIT 1');
        const clientRes = await db.query('SELECT id FROM clients LIMIT 1');

        if (deployRes.rows.length === 0 || clientRes.rows.length === 0) {
            console.error('Missing data to verify');
            process.exit(1);
        }

        console.log(JSON.stringify({
            deploymentId: deployRes.rows[0].id,
            clientId: clientRes.rows[0].id
        }));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fetchData();
