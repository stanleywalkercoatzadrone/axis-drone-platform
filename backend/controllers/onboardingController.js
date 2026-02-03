/**
 * Onboarding Controller
 * Handles HTTP requests for onboarding system
 */

import * as onboardingService from '../services/onboardingService.js';
import { upload } from '../utils/fileUpload.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Create and send onboarding package
 * POST /api/onboarding/send
 */
export const sendOnboardingPackage = async (req, res) => {
    try {
        const { personnelId } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        if (!personnelId) {
            return res.status(400).json({
                success: false,
                message: 'Personnel ID is required'
            });
        }

        // Create package
        const pkg = await onboardingService.createOnboardingPackage(
            personnelId,
            tenantId,
            userId
        );

        // Send email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const result = await onboardingService.sendOnboardingPackage(pkg.id, frontendUrl);

        res.json({
            success: true,
            message: 'Onboarding package sent successfully',
            data: {
                packageId: pkg.id,
                portalUrl: result.portalUrl
            }
        });
    } catch (error) {
        console.error('Error sending onboarding package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send onboarding package',
            error: error.message
        });
    }
};

/**
 * Get onboarding portal (public - no auth required)
 * GET /api/onboarding/portal/:token
 */
export const getOnboardingPortal = async (req, res) => {
    try {
        const { token } = req.params;

        const pkg = await onboardingService.getPackageByToken(token);

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Onboarding package not found or expired'
            });
        }

        res.json({
            success: true,
            data: {
                personnelName: pkg.full_name,
                email: pkg.email,
                role: pkg.role,
                status: pkg.status,
                documents: pkg.documents.map(doc => ({
                    id: doc.id,
                    type: doc.document_type,
                    name: doc.document_name,
                    status: doc.status,
                    completedAt: doc.completed_at
                })),
                expiresAt: pkg.expires_at
            }
        });
    } catch (error) {
        console.error('Error fetching onboarding portal:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load onboarding portal',
            error: error.message
        });
    }
};

/**
 * Upload completed document
 * POST /api/onboarding/portal/:token/upload
 */
export const uploadDocument = async (req, res) => {
    try {
        const { token } = req.params;
        const { documentId } = req.body;

        // Verify token is valid
        const pkg = await onboardingService.getPackageByToken(token);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // File should be uploaded via multer middleware
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Save file to onboarding directory
        const uploadDir = path.join(process.cwd(), 'uploads', 'onboarding', pkg.tenant_id, pkg.personnel_id);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${documentId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, req.file.buffer);

        // Generate file URL (relative path for serving)
        const fileUrl = `/uploads/onboarding/${pkg.tenant_id}/${pkg.personnel_id}/${fileName}`;

        // Mark document as completed
        await onboardingService.completeDocument(documentId, fileUrl);

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            data: {
                fileUrl
            }
        });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document',
            error: error.message
        });
    }
};

/**
 * Get all onboarding packages (admin)
 * GET /api/onboarding/packages
 */
export const getAllPackages = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const packages = await onboardingService.getAllPackages(tenantId);

        res.json({
            success: true,
            data: packages
        });
    } catch (error) {
        console.error('Error fetching onboarding packages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch onboarding packages',
            error: error.message
        });
    }
};

/**
 * Get onboarding package for specific personnel
 * GET /api/onboarding/packages/:personnelId
 */
export const getPackageByPersonnelId = async (req, res) => {
    try {
        const { personnelId } = req.params;
        const tenantId = req.user.tenantId;

        const pkg = await onboardingService.getPackageByPersonnelId(personnelId);

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'No onboarding package found for this personnel'
            });
        }

        // Verify tenant isolation
        if (pkg.tenant_id !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: pkg
        });
    } catch (error) {
        console.error('Error fetching personnel onboarding package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch onboarding package',
            error: error.message
        });
    }
};
