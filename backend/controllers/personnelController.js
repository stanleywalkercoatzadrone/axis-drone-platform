import db from '../config/database.js';
import axios from 'axios';

/**
 * Helper to map personnel database row to camelCase
 */
const mapPersonnelRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        fullName: row.full_name,
        role: row.role,
        email: row.email,
        phone: row.phone,
        certificationLevel: row.certification_level,
        dailyPayRate: row.daily_pay_rate ? parseFloat(row.daily_pay_rate) : 0,
        maxTravelDistance: row.max_travel_distance || 0,
        status: row.status,
        onboarding_status: row.onboarding_status,
        onboarding_sent_at: row.onboarding_sent_at,
        onboarding_completed_at: row.onboarding_completed_at,
        homeAddress: row.home_address,
        latitude: row.latitude,
        longitude: row.longitude,
        bankName: row.bank_name,
        routingNumber: row.routing_number,
        accountNumber: row.account_number,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

/**
 * Geocode address using Nominatim (Server-side)
 * @param {string} address 
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
const geocodeAddress = async (address) => {
    if (!address || address.trim().length < 5) return null;

    const fetchFromApi = async (query) => {
        try {
            console.log(`[Geocoding] Server request for: ${query}`);
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { format: 'json', q: query, limit: 1 },
                headers: { 'User-Agent': 'Skylens-Enterprise-Platform/1.0 (internal-server-side)' }
            });

            if (response.data && response.data.length > 0) {
                const result = response.data[0];
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon)
                };
            }
        } catch (error) {
            console.error(`[Geocoding] Failed for query "${query}":`, error.message);
        }
        return null;
    };

    // 1. Try exact address
    let result = await fetchFromApi(address);
    if (result) return result;

    // 2. Try removing unit numbers
    const cleanAddress = address.replace(/(?:#|Unit|Apt|Suite)\s*\w+\d*\b,?/gi, '').replace(/\s+,/g, ',');
    if (cleanAddress !== address) {
        console.log(`[Geocoding] Retrying with cleaned address: ${cleanAddress}`);
        result = await fetchFromApi(cleanAddress);
    }

    return result;
};

/**
 * Get all personnel with optional role filter
 */
export const getAllPersonnel = async (req, res) => {
    try {
        const { role, status } = req.query;

        let query = 'SELECT * FROM personnel WHERE tenant_id = $1';
        const params = [req.user.tenantId];

        if (role) {
            params.push(role);
            query += ` AND role = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(mapPersonnelRow)
        });
    } catch (error) {
        console.error('Error fetching personnel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch personnel',
            error: error.message
        });
    }
};

/**
 * Get personnel by ID
 */
export const getPersonnelById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'SELECT * FROM personnel WHERE id = $1 AND tenant_id = $2',
            [id, req.user.tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        res.json({
            success: true,
            data: mapPersonnelRow(result.rows[0])
        });
    } catch (error) {
        console.error('Error fetching personnel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch personnel',
            error: error.message
        });
    }
};

/**
 * Create new personnel
 */
export const createPersonnel = async (req, res) => {
    try {
        const {
            fullName,
            role,
            email,
            phone,
            certificationLevel,
            dailyPayRate,
            maxTravelDistance,
            status,
            homeAddress,
            bankName,
            routingNumber,
            accountNumber
        } = req.body;

        // Validation
        if (!fullName || !role || !email) {
            return res.status(400).json({
                success: false,
                message: 'Full name, role, and email are required'
            });
        }

        if (!['Pilot', 'Technician', 'Both'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be either Pilot, Technician, or Both'
            });
        }

        // Geocode if address provided
        let latitude = null;
        let longitude = null;
        if (homeAddress) {
            const coords = await geocodeAddress(homeAddress);
            if (coords) {
                latitude = coords.lat;
                longitude = coords.lng;
            }
        }

        const result = await db.query(
            `INSERT INTO personnel 
            (full_name, role, email, phone, certification_level, daily_pay_rate, max_travel_distance, status, home_address, latitude, longitude, bank_name, routing_number, account_number, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *`,
            [
                fullName,
                role,
                email,
                phone || null,
                certificationLevel || null,
                dailyPayRate || 0,
                maxTravelDistance || 0,
                status || 'Active',
                homeAddress || null,
                latitude,
                longitude,
                bankName || null,
                routingNumber || null,
                accountNumber || null,
                req.user.tenantId
            ]
        );

        res.status(201).json({
            success: true,
            data: mapPersonnelRow(result.rows[0]),
            message: 'Personnel created successfully'
        });
    } catch (error) {
        console.error('Error creating personnel:', error);

        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create personnel',
            error: error.message
        });
    }
};

/**
 * Update personnel
 */
export const updatePersonnel = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            fullName,
            role,
            email,
            phone,
            certificationLevel,
            dailyPayRate,
            maxTravelDistance,
            status,
            homeAddress,
            bankName,
            routingNumber,
            accountNumber
        } = req.body;

        // Check if personnel exists
        const checkResult = await db.query(
            'SELECT id FROM personnel WHERE id = $1 AND tenant_id = $2',
            [id, req.user.tenantId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        // Check if address is being updated
        let latitude = undefined;
        let longitude = undefined;

        if (homeAddress !== undefined) {
            // If address changed (or is new), re-geocode
            // We could check against DB, but for now if it's in the body we assume intentional update
            if (homeAddress) {
                const coords = await geocodeAddress(homeAddress);
                if (coords) {
                    latitude = coords.lat;
                    longitude = coords.lng;
                }
            } else {
                // Address cleared
                latitude = null;
                longitude = null;
            }
        }

        const result = await db.query(
            `UPDATE personnel 
            SET full_name = COALESCE($1, full_name),
            role = COALESCE($2, role),
            email = COALESCE($3, email),
            phone = COALESCE($4, phone),
            certification_level = COALESCE($5, certification_level),
            daily_pay_rate = COALESCE($6, daily_pay_rate),
            max_travel_distance = COALESCE($7, max_travel_distance),
            status = COALESCE($8, status),
            home_address = COALESCE($9, home_address),
            latitude = COALESCE($10, latitude),
            longitude = COALESCE($11, longitude),
            bank_name = COALESCE($12, bank_name),
            routing_number = COALESCE($13, routing_number),
            account_number = COALESCE($14, account_number)
            WHERE id = $15 AND tenant_id = $16
            RETURNING *`,
            [fullName, role, email, phone, certificationLevel, dailyPayRate, maxTravelDistance, status, homeAddress, latitude, longitude, bankName, routingNumber, accountNumber, id, req.user.tenantId]
        );

        res.json({
            success: true,
            data: mapPersonnelRow(result.rows[0]),
            message: 'Personnel updated successfully'
        });
    } catch (error) {
        console.error('Error updating personnel:', error);

        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update personnel',
            error: error.message
        });
    }
};

/**
 * Delete personnel
 */
export const deletePersonnel = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM personnel WHERE id = $1 AND tenant_id = $2 RETURNING id',
            [id, req.user.tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        res.json({
            success: true,
            message: 'Personnel deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting personnel:', error);

        // Handle foreign key constraint violation
        if (error.code === '23503') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete personnel with existing daily logs or deployments'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete personnel',
            error: error.message
        });
    }
};
