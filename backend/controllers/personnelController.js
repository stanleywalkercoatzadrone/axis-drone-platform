import db from '../config/database.js';
import axios from 'axios';
import fs from 'fs';
import { logAudit } from '../utils/auditLogger.js';
import { uploadFile } from '../services/storageService.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
        secondaryPhone: row.secondary_phone,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPhone: row.emergency_contact_phone,
        taxClassification: row.tax_classification,
        certificationLevel: row.certification_level,
        dailyPayRate: row.daily_pay_rate ? parseFloat(row.daily_pay_rate) : 0,
        maxTravelDistance: row.max_travel_distance || 0,
        status: row.status,
        onboarding_status: row.onboarding_status,
        onboarding_sent_at: row.onboarding_sent_at,
        onboarding_completed_at: row.onboarding_completed_at,
        companyName: row.company_name,
        homeAddress: row.home_address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        country: row.country,
        latitude: row.latitude,
        longitude: row.longitude,
        bankName: row.bank_name,
        routingNumber: row.routing_number,
        accountNumber: row.account_number,
        accountType: row.account_type,
        swiftCode: row.swift_code,
        photoUrl: row.photo_url || row.profile_picture_url,
        complianceStatus: row.compliance_status || 'pending',
        totalMissions: row.total_missions || 0,
        averageRating: row.average_rating ? parseFloat(row.average_rating) : 0,
        lifetimeScore: row.lifetime_score || 0,
        rollingScore: row.rolling_30_day_score || 0,
        tierLevel: row.tier_level || 'Bronze',
        reliabilityFlag: row.reliability_flag,
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
                headers: { 'User-Agent': 'Skylens-Enterprise-Platform/1.0 (internal-server-side)' },
                timeout: 5000
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
        const tenantId = req.user.tenantId || null;
        let query = `
            SELECT p.*, 'pending' as compliance_status
            FROM personnel p
            WHERE 1=1
        `;
        const params = [];

        if (tenantId) {
            params.push(tenantId);
            query += ` AND p.tenant_id = $${params.length}`;
        }

        if (role) {
            params.push(role);
            query += ` AND p.role = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND p.status = $${params.length}`;
        }

        query += ' ORDER BY p.created_at DESC';

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

        const tenantId = req.user.tenantId || null;
        let byIdQuery = 'SELECT * FROM personnel WHERE id = $1';
        const byIdParams = [id];
        if (tenantId) {
            byIdParams.push(tenantId);
            byIdQuery += ` AND tenant_id = $${byIdParams.length}`;
        }

        const result = await db.query(byIdQuery, byIdParams);

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
            fullName, role, email, phone, certificationLevel, dailyPayRate, maxTravelDistance, status, homeAddress,
            bankName, routingNumber, accountNumber, accountType, companyName, swiftCode,
            secondaryPhone, emergencyContactName, emergencyContactPhone, taxClassification,
            city, state, zipCode, country
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
            `INSERT INTO personnel (
                full_name, role, email, phone, certification_level, daily_pay_rate, max_travel_distance, status, 
                home_address, latitude, longitude, bank_name, routing_number, account_number, tenant_id, 
                company_name, swift_code, account_type,
                secondary_phone, emergency_contact_name, emergency_contact_phone, tax_classification,
                city, state, zip_code, country
            )
            VALUES(
                $1, $2, $3, $4, $5, $6, $7, $8, 
                $9, $10, $11, $12, $13, $14, $15, 
                $16, $17, $18,
                $19, $20, $21, $22,
                $23, $24, $25, $26
            )
            RETURNING * `,
            [
                fullName || null, role || null, email || null, phone || null, certificationLevel || null, dailyPayRate || 0, maxTravelDistance || 0, status || 'Active',
                homeAddress || null, latitude || null, longitude || null, bankName || null, routingNumber || null, accountNumber || null, req.user.tenantId || null,
                companyName || null, swiftCode || null, accountType || 'Checking',
                secondaryPhone || null, emergencyContactName || null, emergencyContactPhone || null, taxClassification || null,
                city || null, state || null, zipCode || null, country || null
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
            fullName, role, phone, certificationLevel, dailyPayRate, maxTravelDistance, status, homeAddress,
            bankName, routingNumber, accountNumber, accountType, companyName, swiftCode, photoUrl,
            secondaryPhone, emergencyContactName, emergencyContactPhone, taxClassification,
            city, state, zipCode, country
        } = req.body;

        const cleanRouting = routingNumber ? String(routingNumber).replace(/\D/g, '') : undefined;
        const cleanAccount = accountNumber ? String(accountNumber).replace(/\D/g, '') : undefined;
        const cleanSwift = swiftCode ? String(swiftCode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : undefined;

        // Check if personnel exists
        const checkResult = await db.query(
            'SELECT id, role FROM personnel WHERE id = $1 AND (tenant_id = $2::text OR (tenant_id IS NULL AND $2 IS NULL))',
            [id, req.user.tenantId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        // Audit Log for Role Change
        const currentPerson = checkResult.rows[0];
        if (role && role !== currentPerson.role) {
            await logAudit(
                req.user.id,
                'UPDATE_ROLE',
                'PERSONNEL',
                id,
                { oldRole: currentPerson.role, newRole: role, reason: 'Admin Update' },
                req.user.tenantId
            );
        }

        // Check if address is being updated
        let latitude = undefined;
        let longitude = undefined;

        if (homeAddress !== undefined) {
            if (homeAddress) {
                const coords = await geocodeAddress(homeAddress);
                if (coords) {
                    latitude = coords.lat;
                    longitude = coords.lng;
                }
            } else {
                latitude = null;
                longitude = null;
            }
        }

        // Fix potential NaN or undefined for numeric fields
        const payRate = (dailyPayRate === undefined || dailyPayRate === "" || isNaN(dailyPayRate)) ? undefined : parseFloat(dailyPayRate);
        const travelDist = (maxTravelDistance === undefined || maxTravelDistance === "" || isNaN(maxTravelDistance)) ? undefined : parseFloat(maxTravelDistance);

        const result = await db.query(
            `UPDATE personnel 
            SET full_name = COALESCE($1, full_name),
            role = COALESCE($2, role),
            phone = COALESCE($3, phone),
            certification_level = COALESCE($4, certification_level),
            daily_pay_rate = COALESCE($5, daily_pay_rate),
            max_travel_distance = COALESCE($6, max_travel_distance),
            status = COALESCE($7, status),
            home_address = COALESCE($8, home_address),
            latitude = COALESCE($9, latitude),
            longitude = COALESCE($10, longitude),
            bank_name = COALESCE($11, bank_name),
            routing_number = COALESCE($12, routing_number),
            account_number = COALESCE($13, account_number),
            photo_url = COALESCE($14, photo_url),
            company_name = COALESCE($15, company_name),
            swift_code = COALESCE($16, swift_code),
            secondary_phone = COALESCE($17, secondary_phone),
            emergency_contact_name = COALESCE($18, emergency_contact_name),
            emergency_contact_phone = COALESCE($19, emergency_contact_phone),
            tax_classification = COALESCE($20, tax_classification),
            city = COALESCE($21, city),
            state = COALESCE($22, state),
            zip_code = COALESCE($23, zip_code),
            country = COALESCE($24, country),
            account_type = COALESCE($25, account_type),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = $26 AND (tenant_id = $27::text OR (tenant_id IS NULL AND $27 IS NULL))
            RETURNING * `,
            [
                fullName || null, role || null, phone || null, certificationLevel || null, payRate || null, travelDist || null, status || null,
                homeAddress || null, latitude || null, longitude || null, bankName || null, cleanRouting || null, cleanAccount || null, photoUrl || null,
                companyName || null, cleanSwift || null,
                secondaryPhone || null, emergencyContactName || null, emergencyContactPhone || null, taxClassification || null,
                city || null, state || null, zipCode || null, country || null,
                accountType || null,
                id, req.user.tenantId
            ]
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
            'DELETE FROM personnel WHERE id = $1 AND (tenant_id = $2::text OR (tenant_id IS NULL AND $2 IS NULL)) RETURNING id',
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

/**
 * Get personnel country authorizations
 */
export const getPersonnelAuthorizations = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT pca.*, c.name as country_name, c.iso_code 
             FROM pilot_country_authorizations pca
             JOIN countries c ON pca.country_id = c.id
             WHERE pca.pilot_id = $1`,
            [id]
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                countryId: row.country_id,
                countryName: row.country_name,
                isoCode: row.iso_code,
                status: row.status,
                licenseNumber: row.license_number,
                authority: row.authority,
                expirationDate: row.expiration_date,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }))
        });
    } catch (error) {
        console.error('Error fetching personnel authorizations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch authorizations',
            error: error.message
        });
    }
};

/**
 * Update/Create personnel country authorization
 */
export const updatePersonnelAuthorization = async (req, res) => {
    try {
        const { id } = req.params;
        const { countryId, licenseNumber, authority, expirationDate, status } = req.body;

        if (!countryId) {
            return res.status(400).json({
                success: false,
                message: 'Country ID is required'
            });
        }

        // Check if authorization exists
        const check = await db.query(
            'SELECT id FROM pilot_country_authorizations WHERE pilot_id = $1 AND country_id = $2',
            [id, countryId]
        );

        let result;
        if (check.rows.length > 0) {
            // Update
            result = await db.query(
                `UPDATE pilot_country_authorizations 
                 SET license_number = COALESCE($1, license_number),
            authority = COALESCE($2, authority),
            expiration_date = COALESCE($3, expiration_date),
            status = COALESCE($4, status),
            updated_at = CURRENT_TIMESTAMP
                 WHERE pilot_id = $5 AND country_id = $6
                 RETURNING * `,
                [licenseNumber, authority, expirationDate, status || 'PENDING', id, countryId]
            );
        } else {
            // Insert
            result = await db.query(
                `INSERT INTO pilot_country_authorizations
            (pilot_id, country_id, license_number, authority, expiration_date, status)
                 VALUES($1, $2, $3, $4, $5, $6)
                 RETURNING * `,
                [id, countryId, licenseNumber, authority, expirationDate, status || 'PENDING']
            );
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Authorization updated successfully'
        });
    } catch (error) {
        console.error('Error updating personnel authorization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update authorization',
            error: error.message
        });
    }
};

/**
 * Get personnel banking info
 */
export const getPersonnelBanking = async (req, res) => {
    try {
        const { id } = req.params;

        // Ensure user is admin or requesting their own data (though typical use is admin)
        // For now, restrict to Admin/Finance roles (handled by route protection or check here)
        // Assuming strict role check in route or here:
        if (req.user.role !== 'ADMIN' && req.user.role !== 'FINANCE' && req.user.id !== id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view banking information'
            });
        }

        const result = await db.query(
            `SELECT * FROM pilot_banking_info WHERE pilot_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null
            });
        }

        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                id: row.id,
                pilotId: row.pilot_id,
                bankName: row.bank_name,
                accountNumber: row.account_number,
                routingNumber: row.routing_number,
                swiftCode: row.swift_code,
                accountType: row.account_type,
                currency: row.currency,
                countryId: row.country_id,
                updatedAt: row.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching banking info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch banking info',
            error: error.message
        });
    }
};

/**
 * Update personnel banking info
 */
export const updatePersonnelBanking = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountNumber, routingNumber, swiftCode, accountType, currency, countryId } = req.body;

        const cleanRouting = routingNumber ? String(routingNumber).replace(/\D/g, '') : undefined;
        const cleanAccount = accountNumber ? String(accountNumber).replace(/\D/g, '') : undefined;
        const cleanSwift = swiftCode ? String(swiftCode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : undefined;

        const allowedRoles = ['ADMIN', 'FINANCE', 'SENIOR_INSPECTOR', 'OPERATIONS'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update banking information'
            });
        }

        // Resolve countryId if it's an ISO2 code (like 'US')
        let resolvedCountryId = countryId;
        if (countryId && countryId.length === 2) {
            const countryRes = await db.query('SELECT id FROM countries WHERE iso_code = $1', [countryId]);
            if (countryRes.rows.length > 0) {
                resolvedCountryId = countryRes.rows[0].id;
            }
        }

        // Check if exists
        const check = await db.query(
            'SELECT id FROM pilot_banking_info WHERE pilot_id = $1',
            [id]
        );

        let result;
        if (check.rows.length > 0) {
            // Update
            result = await db.query(
                `UPDATE pilot_banking_info 
                 SET bank_name = COALESCE($1, bank_name),
            account_number = COALESCE($2, account_number),
            routing_number = COALESCE($3, routing_number),
            swift_code = COALESCE($4, swift_code),
            account_type = COALESCE($5, account_type),
            currency = COALESCE($6, currency),
            country_id = COALESCE($7, country_id),
            updated_at = CURRENT_TIMESTAMP
                 WHERE pilot_id = $8
                 RETURNING * `,
                [bankName, cleanAccount, cleanRouting, cleanSwift, accountType, currency, resolvedCountryId, id]
            );
        } else {
            // Insert
            result = await db.query(
                `INSERT INTO pilot_banking_info
            (pilot_id, bank_name, account_number, routing_number, swift_code, account_type, currency, country_id)
                 VALUES($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING * `,
                [id, bankName, cleanAccount, cleanRouting, cleanSwift, accountType || 'Checking', currency, resolvedCountryId]
            );
        }

        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                id: row.id,
                pilotId: row.pilot_id,
                bankName: row.bank_name,
                accountNumber: row.account_number,
                routingNumber: row.routing_number,
                swiftCode: row.swift_code,
                accountType: row.account_type,
                currency: row.currency,
                countryId: row.country_id,
                updatedAt: row.updated_at
            },
            message: 'Banking information updated successfully'
        });
    } catch (error) {
        console.error('Error updating banking info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update banking info',
            error: error.message
        });
    }
};

/**
 * Get personnel documents
 */
export const getPersonnelDocuments = async (req, res) => {
    try {
        const { id } = req.params;

        // Check Access
        if (req.user.role !== 'ADMIN' && req.user.role !== 'FINANCE' && req.user.id !== id) {
            return res.status(403).json({ success: false, message: 'Not authorized to view documents for this user' });
        }

        // Try personnel_id first (new schema), fall back to pilot_id (old schema)
        let docResult;
        try {
            docResult = await db.query(
                `SELECT 
                    id,
                personnel_id as pilot_id,
                category as document_type,
                url as file_url,
                'VALID' as validation_status,
                created_at as uploaded_at,
                updated_at,
                expiration_date
                 FROM pilot_documents
                 WHERE personnel_id = $1
                 ORDER BY created_at DESC`,
                [id]
            );
        } catch (schemaErr) {
            // Fall back to old schema with pilot_id
            docResult = await db.query(
                `SELECT 
                    id,
                pilot_id,
                document_type,
                file_url,
                validation_status,
                uploaded_at,
                updated_at
                 FROM pilot_documents
                 WHERE pilot_id = $1
                 ORDER BY uploaded_at DESC`,
                [id]
            );
        }
        const result = docResult;

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching personnel documents:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch documents' });
    }
};

/**
 * Upload personnel document
 */
export const uploadPersonnelDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { documentType, countryId, missionId, expirationDate } = req.body;
        const file = req.file;

        // Check Access
        if (req.user.role !== 'ADMIN' && req.user.role !== 'FINANCE' && req.user.id !== id) {
            return res.status(403).json({ success: false, message: 'Not authorized to upload documents for this user' });
        }

        if (!file) {
            console.error('❌ Upload Failed: No file in request');
            console.log('Headers:', JSON.stringify(req.headers, null, 2));
            console.log('Body:', req.body);

            return res.status(400).json({
                success: false,
                message: 'No file uploaded. Debug Info: ' + JSON.stringify({
                    contentType: req.headers['content-type'],
                    contentLength: req.headers['content-length'],
                    bodyKeys: Object.keys(req.body || {}),
                    isMultipart: (req.headers['content-type'] || '').includes('multipart/form-data')
                })
            });
        }

        // Check Access
        if (req.user.role !== 'ADMIN' && req.user.role !== 'FINANCE' && req.user.id !== id) {
            return res.status(403).json({ success: false, message: 'Not authorized to upload documents for this user' });
        }

        // 1. Upload to Storage (Unified)
        let webViewLink = null;
        try {
            const fileName = `pilots/${id}/documents/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            console.log(`Attempting upload for: ${file.originalname} -> ${fileName}`);

            // Use unified storage service
            const uploadResult = await uploadFile(file, 'pilots'); // helper handles folder prefix if needed, or we pass path

            // storageService usually takes (file, folder), generating uuid. 
            // If we want exact path control, we might need to adjust or just accept the uuid path.
            // Let's rely on storageService's return. 

            console.log('Upload Result:', uploadResult);
            webViewLink = uploadResult.url;

        } catch (storageError) {
            console.error('❌ Storage Upload Failed:', storageError);
            console.error('Stack:', storageError.stack);

            return res.status(500).json({
                success: false,
                message: 'Storage Upload Failed: ' + storageError.message
            });
        }

        // 2. Save Document Record to DB - try new schema first, fall back to old
        let docResult;
        try {
            docResult = await db.query(
                `INSERT INTO pilot_documents(personnel_id, category, name, url, expiration_date)
                VALUES($1, $2, $3, $4, $5)
                RETURNING *, category as document_type, url as file_url, created_at as uploaded_at, 'VALID' as validation_status`,
                [id, documentType, documentType, webViewLink, expirationDate || null]
            );
        } catch (schemaErr) {
            // Fall back to old schema
            docResult = await db.query(
                `INSERT INTO pilot_documents(pilot_id, document_type, file_url, validation_status, expiration_date)
                VALUES($1, $2, $3, 'PENDING', $4)
                RETURNING *`,
                [id, documentType, webViewLink, expirationDate || null]
            );
        }

        // 3. AI Extraction (Gemini)
        let extractedData = {};

        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                const prompt = `
                    Analyze this document image. Extract the following information in JSON format:
                    - Banking: bankName, routingNumber, accountNumber, accountType (Checking / Savings).
                    - Address: fullAddress (as homeAddress), street, city, state, zipCode.
                    - License: licenseNumber, expirationDate (YYYY-MM-DD).
                    - Profile: name, email, phone.
                    
                    Return ONLY the JSON object. Access nested fields directly.
                    If value is not found, return null. 
                    Format the keys exactly as: bankName, routingNumber, accountNumber, accountType, homeAddress, licenseNumber, name, email, phone.
                `;

                const image = {
                    inlineData: {
                        data: file.buffer.toString('base64'),
                        mimeType: file.mimetype,
                    },
                };

                const result = await model.generateContent([prompt, image]);
                const response = await result.response;
                const text = response.text();

                // Debug logging to file (Relative path for container compatibility)
                const logPath = 'ai_debug.log';
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] (Upload) RAW RESPONSE: ${text}\n`);

                // Clean markdown code blocks if present
                const jsonStr = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
                try {
                    extractedData = JSON.parse(jsonStr);
                } catch (parseErr) {
                    console.error('JSON Parse Error:', parseErr);
                    const match = text.match(/\{[\s\S]*\}/);
                    if (match) {
                        extractedData = JSON.parse(match[0]);
                    }
                }

                console.log('🤖 Gemini 1.5 Extracted:', extractedData);
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] (Upload) PARSED DATA: ${JSON.stringify(extractedData)}\n`);

                // Debug tracking
                analysisDebug = {
                    raw: text,
                    json: extractedData,
                    updates: []
                };

                // 4. Auto-Populate Database

                // Address Update
                if (extractedData.homeAddress || extractedData.fullAddress) {
                    const address = extractedData.homeAddress || extractedData.fullAddress;
                    await db.query(
                        `UPDATE personnel SET home_address = $1 WHERE id = $2`,
                        [address, id]
                    );
                    analysisDebug.updates.push('address');
                }

                // Banking Update
                if (extractedData.routingNumber && extractedData.accountNumber) {
                    const bankData = {
                        bankName: extractedData.bankName || 'Unknown Bank',
                        routingNumber: extractedData.routingNumber.toString().replace(/\D/g, ''),
                        accountNumber: extractedData.accountNumber.toString().replace(/\D/g, ''),
                        accountType: extractedData.accountType || 'Checking',
                        currency: 'USD',
                        countryId: countryId || 'US'
                    };

                    const existingBank = await db.query('SELECT id FROM pilot_banking_info WHERE pilot_id = $1', [id]);

                    if (existingBank.rows.length > 0) {
                        await db.query(
                            `UPDATE pilot_banking_info 
                             SET bank_name = $1, routing_number = $2, account_number = $3, account_type = $4, currency = $5, country_id = $6, updated_at = CURRENT_TIMESTAMP
                             WHERE pilot_id = $7`,
                            [bankData.bankName, bankData.routingNumber, bankData.accountNumber, bankData.accountType, bankData.currency, bankData.countryId, id]
                        );
                        analysisDebug.updates.push('banking_update');
                    } else {
                        await db.query(
                            `INSERT INTO pilot_banking_info (pilot_id, bank_name, routing_number, account_number, account_type, currency, country_id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [id, bankData.bankName, bankData.routingNumber, bankData.accountNumber, bankData.accountType, bankData.currency, bankData.countryId]
                        );
                        analysisDebug.updates.push('banking_insert');
                    }

                    await logAudit(req.user.id, 'AUTO_POPULATE', 'BANKING', id, { source: 'AI Extraction' }, req.user.tenantId);
                }

            } catch (err) {
                console.error('AI Processing Error:', err);
                // Don't fail the upload, just log it
            }
        } else {
            console.warn('⚠️ GEMINI_API_KEY is missing. Skipping AI analysis.');
        }

        // 5. Fetch Final State to return to FE
        const updatedPersonnel = await db.query('SELECT * FROM personnel WHERE id = $1', [id]);
        const updatedBanking = await db.query('SELECT * FROM pilot_banking_info WHERE pilot_id = $1', [id]);

        res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            document: docResult.rows[0],
            extractedData: extractedData,
            updatedPersonnel: mapPersonnelRow(updatedPersonnel.rows[0]),
            updatedBanking: updatedBanking.rows[0] ? {
                id: updatedBanking.rows[0].id,
                pilotId: updatedBanking.rows[0].pilot_id,
                bankName: updatedBanking.rows[0].bank_name,
                accountNumber: updatedBanking.rows[0].account_number,
                routingNumber: updatedBanking.rows[0].routing_number,
                swiftCode: updatedBanking.rows[0].swift_code,
                accountType: updatedBanking.rows[0].account_type,
                currency: updatedBanking.rows[0].currency,
                countryId: updatedBanking.rows[0].country_id,
                updatedAt: updatedBanking.rows[0].updated_at
            } : null
        });

    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ success: false, message: 'Failed to upload document', error: error.message });
    }
};

/**
 * Upload personnel profile photo
 */
export const uploadPersonnelPhoto = async (req, res) => {
    try {
        const { id } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        let webViewLink = null;
        try {
            // Upload to Supabase (avatars bucket)
            const fileName = `avatars/${id}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const { uploadToSupabase } = await import('../services/supabaseService.js');
            const uploadResult = await uploadToSupabase(file, fileName, { bucketName: 'avatars' });
            webViewLink = uploadResult.publicUrl;

            // Update Personnel DB
            const result = await db.query(
                `UPDATE personnel 
                 SET photo_url = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *`,
                [webViewLink, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Personnel not found' });
            }

            res.json({
                success: true,
                data: mapPersonnelRow(result.rows[0]),
                message: 'Profile photo updated successfully'
            });

        } catch (error) {
            console.error('Photo Upload Failed:', error);
            res.status(500).json({ success: false, message: 'Failed to upload photo', error: error.message });
        }
    } catch (error) {
        console.error('Error in photo upload controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};


/**
 * Analyze personnel document — Vertex AI primary, AI Studio fallback
 */
export const analyzePersonnelDocument = async (req, res) => {
    const file = req.file;
    console.log(`[analyzePersonnelDocument] File: ${file?.originalname}, type: ${file?.mimetype}`);

    if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const prompt = `Analyze this document (image or PDF). Extract professional and banking information for a personnel record.
Return ONLY a valid JSON object. Do not include markdown formatting or extra text.

Fields to extract:
- name: Full name of the individual
- email: Email address
- phone: Phone number
- businessName: Company or business name (if applicable)
- homeAddress: Street address
- city, state, zipCode, country: Structured address components
- documentType: One of ["Direct Deposit", "W9", "Driver License", "FAA License", "Insurance", "Passport", "Other"]
- bankName: Financial institution name
- routingNumber: 9-digit routing number
- accountNumber: Bank account number
- swiftCode: SWIFT/BIC code
- accountType: "Checking" or "Savings"
- licenseNumber: Certification or license ID
- expirationDate: Expiration date in YYYY-MM-DD format
- taxClassification: "Individual", "C Corp", "S Corp", "LLC", or "Other"

If a field is not found, set it to null.`;

    const fileBase64 = file.buffer.toString('base64');
    const mimeType = file.mimetype;

    const parseAIText = (text) => {
        const jsonStr = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(jsonStr);
        } catch (_) {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            throw new Error('Could not parse AI response as JSON');
        }
    };

    // ── Strategy 1: Vertex AI (uses Cloud project billing — high quota) ──────
    try {
        const { GoogleGenAI } = await import('@google/genai');
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'axis-platform-484701';
        const location = 'us-central1';

        const ai = new GoogleGenAI({ vertexai: true, project: projectId, location });
        console.log('[AI] Trying Vertex AI (gemini-2.0-flash)...');

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: fileBase64 } }
                ]
            }]
        });

        const text = response.text;
        const extractedData = parseAIText(text);
        console.log('[AI] Vertex AI extraction succeeded');
        return res.json({ success: true, data: extractedData });

    } catch (vertexErr) {
        console.warn('[AI] Vertex AI failed:', vertexErr?.message?.slice(0, 120));
        // Fall through to AI Studio key
    }

    // ── Strategy 2: AI Studio key (free tier — may be rate limited) ──────────
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, message: 'No AI credentials available' });
    }

    const is429 = (err) =>
        err?.status === 429 ||
        String(err?.message).includes('429') ||
        String(err?.message).includes('Too Many Requests');

    const isDailyQuota = (err) =>
        String(err?.message).includes('PerDay') ||
        (err?.errorDetails || []).some(d =>
            (d.violations || []).some(v => v?.quotaId?.includes('PerDay'))
        );

    const getRetryDelaySecs = (err) => {
        try {
            for (const d of (err?.errorDetails || [])) {
                if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
                    return Math.min(parseInt(d.retryDelay.replace(/\D/g, ''), 10) || 15, 30);
                }
            }
        } catch (_) { }
        return 15;
    };

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const studioModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let lastError = null;

    for (let i = 0; i < studioModels.length; i++) {
        const modelName = studioModels[i];
        try {
            if (i > 0 && lastError) {
                // Only wait+retry if it's a per-minute limit, not a daily limit
                if (isDailyQuota(lastError)) {
                    console.warn(`[AI] Daily quota exhausted on ${studioModels[i - 1]}, skipping to next model`);
                } else {
                    const delaySecs = getRetryDelaySecs(lastError);
                    console.log(`[AI] Waiting ${delaySecs}s then retrying with ${modelName}...`);
                    await new Promise(r => setTimeout(r, delaySecs * 1000));
                }
            }

            console.log(`[AI] AI Studio attempt with ${modelName}`);
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([
                prompt,
                { inlineData: { data: fileBase64, mimeType } }
            ]);
            const text = result.response.text();
            const extractedData = parseAIText(text);
            console.log(`[AI] AI Studio success with ${modelName}`);
            return res.json({ success: true, data: extractedData });

        } catch (err) {
            lastError = err;
            if (is429(err) && i < studioModels.length - 1) {
                console.warn(`[AI] 429 on ${modelName}, trying next`);
                continue;
            }
            break;
        }
    }

    // All strategies failed
    console.error('[AI] All strategies failed:', lastError?.message?.slice(0, 200));

    if (is429(lastError) && isDailyQuota(lastError)) {
        return res.status(503).json({
            success: false,
            message: 'AI quota reached for today. Please enter details manually or try again tomorrow.',
        });
    }
    if (is429(lastError)) {
        return res.status(429).json({
            success: false,
            message: 'AI service is busy. Please wait a moment and try again.',
            retryAfter: getRetryDelaySecs(lastError)
        });
    }
    return res.status(500).json({ success: false, message: 'Analysis failed', error: lastError?.message });
};
/**
 * Get detailed pilot performance metrics and insights
 */
export const getPilotPerformance = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id; // From auth middleware

        const performanceRes = await db.query(`
            SELECT 
                lifetime_score, 
                rolling_30_day_score, 
                tier_level, 
                reliability_flag
            FROM personnel 
            WHERE id = $1
        `, [id]);

        if (performanceRes.rows.length === 0) {
            return res.status(404).json({ message: 'Pilot not found' });
        }

        const stats = performanceRes.rows[0];

        // Fetch detailed breakdown from scoring service
        const { calculateIndividualScores } = await import('../services/scoringService.js');
        const { generatePilotInsights } = await import('../services/aiInsightsService.js');

        const breakdown = await calculateIndividualScores(id, false);
        const rollingBreakdown = await calculateIndividualScores(id, true);
        const insights = await generatePilotInsights(id, userId);

        res.json({
            lifetimeScore: stats.lifetime_score,
            rollingScore: stats.rolling_30_day_score,
            tierLevel: stats.tier_level,
            reliabilityFlag: stats.reliability_flag,
            breakdown,
            rollingBreakdown,
            insights
        });
    } catch (error) {
        console.error('Error fetching pilot performance:', error);
        res.status(500).json({ message: 'Error fetching performance metrics' });
    }
};

/**
 * Update performance configuration (Admin only)
 */
export const updatePerformanceConfig = async (req, res) => {
    try {
        const {
            acceptance_enabled, completion_enabled, qa_enabled, rating_enabled, reliability_enabled,
            acceptance_weight, completion_weight, qa_weight, rating_weight, reliability_weight
        } = req.body;

        await db.query(`
            UPDATE performance_config 
            SET acceptance_enabled = $1, completion_enabled = $2, qa_enabled = $3, 
                rating_enabled = $4, reliability_enabled = $5,
                acceptance_weight = $6, completion_weight = $7, qa_weight = $8, 
                rating_weight = $9, reliability_weight = $10,
                updated_at = NOW()
            WHERE is_active = TRUE
        `, [
            acceptance_enabled, completion_enabled, qa_enabled, rating_enabled, reliability_enabled,
            acceptance_weight, completion_weight, qa_weight, rating_weight, reliability_weight
        ]);

        res.json({ message: 'Performance configuration updated successfully' });
    } catch (error) {
        console.error('Error updating performance config:', error);
        res.status(500).json({ message: 'Error updating configuration' });
    }
};

/**
 * Get current performance configuration
 */
export const getPerformanceConfig = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM performance_config WHERE is_active = TRUE LIMIT 1');
        res.json(result.rows[0] || {});
    } catch (error) {
        console.error('Error fetching performance config:', error);
        res.status(500).json({ message: 'Error fetching configuration' });
    }
};

