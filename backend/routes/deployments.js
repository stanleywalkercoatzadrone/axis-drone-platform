import express from 'express';
import {
    getAllDeployments,
    getDeploymentById,
    createDeployment,
    updateDeployment,
    deleteDeployment,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    getDeploymentCost,
    uploadDeploymentFile,
    getDeploymentFiles,
    deleteDeploymentFile,
    assignPersonnel,
    unassignPersonnel,
    assignMonitoringUser,
    unassignMonitoringUser,
    notifyAssignment
} from '../controllers/deploymentController.js';
import { sendDeploymentInvoices as sendInvoicesController } from '../controllers/invoiceController.js';

import { protect, authorize, checkScopedPermission } from '../middleware/auth.js';
import { preventPilotMissionMutation } from '../middleware/missionGuard.js';
import { uploadSingle } from '../utils/fileUpload.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Deployment routes
router.get('/', getAllDeployments);
router.get('/:id', checkScopedPermission('missions:read'), getDeploymentById);
router.post('/', authorize('admin'), preventPilotMissionMutation, createDeployment);
router.put('/:id', preventPilotMissionMutation, checkScopedPermission('missions:update_status'), updateDeployment);
router.delete('/:id', authorize('admin'), preventPilotMissionMutation, deleteDeployment);

// Daily log routes
router.post('/:id/daily-logs', checkScopedPermission('missions:update_status'), addDailyLog);
router.put('/:id/daily-logs/:logId', checkScopedPermission('missions:update_status'), updateDailyLog);
router.delete('/:id/daily-logs/:logId', checkScopedPermission('missions:update_status'), deleteDailyLog);

// Cost calculation
router.get('/:id/cost', getDeploymentCost);

// Invoicing
router.post('/:id/invoices/send', authorize('ADMIN'), sendInvoicesController);


// File routes
router.post('/:id/files', uploadSingle, uploadDeploymentFile);
router.get('/:id/files', getDeploymentFiles);
router.delete('/:id/files/:fileId', deleteDeploymentFile);

// Personnel Assignment routes (admin-only, mission mutation)
router.post('/:id/personnel', authorize('admin'), preventPilotMissionMutation, assignPersonnel);
router.delete('/:id/personnel/:personnelId', authorize('admin'), preventPilotMissionMutation, unassignPersonnel);

// Monitoring Team Assignment routes (admin-only, mission mutation)
router.post('/:id/monitoring', authorize('admin'), preventPilotMissionMutation, assignMonitoringUser);
router.delete('/:id/monitoring/:userId', authorize('admin'), preventPilotMissionMutation, unassignMonitoringUser);
router.post('/:id/notify-assignment', authorize('admin'), preventPilotMissionMutation, notifyAssignment);

export default router;
