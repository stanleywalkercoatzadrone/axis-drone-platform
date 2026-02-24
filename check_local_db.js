
import pkg from 'pg';
const { Client } = pkg;

async function check() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@localhost:5432/skylens_db"
    });
    try {
        await client.connect();
        const resUsers = await client.query('SELECT COUNT(*) FROM users');
        const resPersonnel = await client.query('SELECT COUNT(*) FROM personnel');
        console.log('Local Projects DB Stats:');
        console.log('Users:', resUsers.rows[0].count);
        console.log('Personnel:', resPersonnel.rows[0].count);

        const users = await client.query('SELECT email, full_name, role, password_hash, company_name, permissions FROM users');
        const personnel = await client.query('SELECT * FROM personnel');

        return { users: users.rows, personnel: personnel.rows };
    } catch (err) {
        console.error('Connection failed:', err.message);
    } finally {
        await client.end();
    }
}
check();
