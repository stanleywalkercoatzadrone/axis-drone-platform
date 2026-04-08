import pool from '../config/database.js';

export const getRegions = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM regions ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching regions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch regions' });
    }
};

export const getCountries = async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT c.*, r.name as region_name FROM countries c JOIN regions r ON c.region_id = r.id';
        const params = [];

        if (status) {
            query += ' WHERE c.status = $1';
            params.push(status);
        }

        query += ' ORDER BY c.name ASC';

        const { rows } = await pool.query(query, params);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch countries' });
    }
};

export const toggleCountryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ENABLED', 'DISABLED'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const { rows } = await pool.query(
            'UPDATE countries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Country not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error updating country status:', error);
        res.status(500).json({ success: false, message: 'Failed to update country status' });
    }
};

export const seedRegionsCountries = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS regions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
        await client.query(`CREATE TABLE IF NOT EXISTS countries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), region_id UUID REFERENCES regions(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, iso_code VARCHAR(10) NOT NULL UNIQUE, currency VARCHAR(10) DEFAULT 'USD', units_of_measurement VARCHAR(20) DEFAULT 'imperial', status VARCHAR(20) DEFAULT 'ENABLED', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

        await client.query(`INSERT INTO regions (name) VALUES ('North America'),('Central America'),('South America'),('Caribbean'),('Europe'),('Asia Pacific') ON CONFLICT (name) DO NOTHING`);

        const regions = (await client.query('SELECT id, name FROM regions')).rows;
        const rm = Object.fromEntries(regions.map(r => [r.name, r.id]));

        const countries = [
            ['North America', 'United States', 'US', 'USD', 'imperial'], ['North America', 'Canada', 'CA', 'CAD', 'metric'], ['North America', 'Mexico', 'MX', 'MXN', 'metric'],
            ['Central America', 'Guatemala', 'GT', 'GTQ', 'metric'], ['Central America', 'Belize', 'BZ', 'BZD', 'metric'], ['Central America', 'Honduras', 'HN', 'HNL', 'metric'],
            ['Central America', 'El Salvador', 'SV', 'USD', 'metric'], ['Central America', 'Nicaragua', 'NI', 'NIO', 'metric'], ['Central America', 'Costa Rica', 'CR', 'CRC', 'metric'], ['Central America', 'Panama', 'PA', 'PAB', 'metric'],
            ['South America', 'Colombia', 'CO', 'COP', 'metric'], ['South America', 'Venezuela', 'VE', 'VES', 'metric'], ['South America', 'Brazil', 'BR', 'BRL', 'metric'],
            ['South America', 'Peru', 'PE', 'PEN', 'metric'], ['South America', 'Ecuador', 'EC', 'USD', 'metric'], ['South America', 'Bolivia', 'BO', 'BOB', 'metric'],
            ['South America', 'Chile', 'CL', 'CLP', 'metric'], ['South America', 'Argentina', 'AR', 'ARS', 'metric'], ['South America', 'Paraguay', 'PY', 'PYG', 'metric'], ['South America', 'Uruguay', 'UY', 'UYU', 'metric'],
            ['Caribbean', 'Cuba', 'CU', 'CUP', 'metric'], ['Caribbean', 'Dominican Republic', 'DO', 'DOP', 'metric'], ['Caribbean', 'Puerto Rico', 'PR', 'USD', 'imperial'],
            ['Caribbean', 'Jamaica', 'JM', 'JMD', 'metric'], ['Caribbean', 'Trinidad and Tobago', 'TT', 'TTD', 'metric'],
            ['Europe', 'United Kingdom', 'GB', 'GBP', 'metric'], ['Europe', 'Germany', 'DE', 'EUR', 'metric'], ['Europe', 'France', 'FR', 'EUR', 'metric'], ['Europe', 'Spain', 'ES', 'EUR', 'metric'], ['Europe', 'Netherlands', 'NL', 'EUR', 'metric'],
            ['Asia Pacific', 'Australia', 'AU', 'AUD', 'metric'], ['Asia Pacific', 'Japan', 'JP', 'JPY', 'metric'], ['Asia Pacific', 'Singapore', 'SG', 'SGD', 'metric'],
        ];

        let inserted = 0;
        for (const [region, name, iso, currency, units] of countries) {
            const regionId = rm[region];
            if (!regionId) continue;
            const r = await client.query(
                `INSERT INTO countries (region_id,name,iso_code,currency,units_of_measurement,status) VALUES ($1,$2,$3,$4,$5,'ENABLED') ON CONFLICT (iso_code) DO NOTHING RETURNING id`,
                [regionId, name, iso, currency, units]
            );
            if (r.rowCount > 0) inserted++;
        }

        const total = (await client.query('SELECT COUNT(*) FROM countries')).rows[0].count;
        res.json({ success: true, regions: regions.length, countriesInserted: inserted, totalCountries: parseInt(total) });
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
};

