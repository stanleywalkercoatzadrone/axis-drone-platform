import db from '../config/database.js';
import axios from 'axios';
import { logAudit } from '../utils/auditLogger.js';
import { uploadFile } from '../services/storageService.js';

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
        profilePictureUrl: row.profile_picture_url,
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

        let query = 'SELECT * FROM personnel WHERE (tenant_id = $1 OR (tenant_id IS NULL AND $1 IS NULL))';
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
            'SELECT * FROM personnel WHERE id = $1 AND (tenant_id = $2 OR (tenant_id IS NULL AND $2 IS NULL))',
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
            accountNumber,
            profilePictureUrl // Allow direct update if needed (e.g. clear)
        } = req.body;

        // Check if personnel exists
        const checkResult = await db.query(
            'SELECT id FROM personnel WHERE id = $1 AND (tenant_id = $2 OR (tenant_id IS NULL AND $2 IS NULL))',
            [id, req.user.tenantId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        // Audit Log for Role Change
        const currentPerson = mapPersonnelRow(checkResult.rows[0]);
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
            account_number = COALESCE($14, account_number),
            profile_picture_url = COALESCE($15, profile_picture_url)
            WHERE id = $16 AND (tenant_id = $17 OR (tenant_id IS NULL AND $17 IS NULL))
            RETURNING *`,
            [fullName, role, email, phone, certificationLevel, dailyPayRate, maxTravelDistance, status, homeAddress, latitude, longitude, bankName, routingNumber, accountNumber, profilePictureUrl, id, req.user.tenantId]
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
            'DELETE FROM personnel WHERE id = $1 AND (tenant_id = $2 OR (tenant_id IS NULL AND $2 IS NULL)) RETURNING id',
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
                 RETURNING *`,
                [licenseNumber, authority, expirationDate, status || 'PENDING', id, countryId]
            );
        } else {
            // Insert
            result = await db.query(
                `INSERT INTO pilot_country_authorizations 
                 (pilot_id, country_id, license_number, authority, expiration_date, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
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
                accountNumber: row.account_number, // TODO: Decrypt if encrypted
                routingNumber: row.routing_number,
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
        const { bankName, accountNumber, routingNumber, accountType, currency, countryId } = req.body;

        if (req.user.role !== 'ADMIN' && req.user.role !== 'FINANCE') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update banking information'
            });
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
                     account_type = COALESCE($4, account_type),
                     currency = COALESCE($5, currency),
                     country_id = COALESCE($6, country_id),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE pilot_id = $7
                 RETURNING *`,
                [bankName, accountNumber, routingNumber, accountType, currency, countryId, id]
            );
        } else {
            // Insert
            result = await db.query(
                `INSERT INTO pilot_banking_info 
                 (pilot_id, bank_name, account_number, routing_number, account_type, currency, country_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [id, bankName, accountNumber, routingNumber, accountType || 'Checking', currency, countryId]
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
 * Upload personnel document
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Upload personnel document
 */
export const uploadPersonnelDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { documentType, countryId, missionId } = req.body; // Removed expirationDate
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

        // 2. Save Document Record to DB
        const docResult = await db.query(
            `INSERT INTO pilot_documents (pilot_id, country_id, document_type, file_url, validation_status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             RETURNING *`,
            [id, countryId || null, documentType, webViewLink]
        );

        // 3. AI Extraction (Gemini)
        let extractedData = {};

        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                const prompt = `
                    Analyze this document image. Extract the following information in JSON format:
                    - For Banking: bankName, routingNumber, accountNumber, accountType (Checking/Savings).
                    - For Address: fullAddress, street, city, state, zipCode.
                    - For License: licenseNumber, expirationDate.
                    
                    Return ONLY the JSON object. access nested fields directly.
                    If value is not found, return null. 
                    Format the keys exactly as: bankName, routingNumber, accountNumber, accountType, homeAddress, licenseNumber.
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

                // Clean markdown code blocks if present
                const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                extractedData = JSON.parse(jsonStr);

                console.log('🤖 Gemini Extracted:', extractedData);

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

        res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            document: docResult.rows[0],
            extractedData: extractedData
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
                 SET profile_picture_url = $1, updated_at = CURRENT_TIMESTAMP
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
