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
    unassignMonitoringUser
} from '../controllers/deploymentController.js';
import { sendDeploymentInvoices as sendInvoicesController } from '../controllers/invoiceController.js';

import { protect } from '../middleware/auth.js';
import { uploadSingle } from '../utils/fileUpload.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Deployment routes
router.get('/', getAllDeployments);
router.get('/:id', getDeploymentById);
router.post('/', createDeployment);
router.put('/:id', updateDeployment);
router.delete('/:id', deleteDeployment);

// Daily log routes
router.post('/:id/daily-logs', addDailyLog);
router.put('/:id/daily-logs/:logId', updateDailyLog);
router.delete('/:id/daily-logs/:logId', deleteDailyLog);

// Cost calculation
router.get('/:id/cost', getDeploymentCost);

// Invoicing
router.post('/:id/invoices/send', sendInvoicesController);


// File routes
router.post('/:id/files', uploadSingle, uploadDeploymentFile);
router.get('/:id/files', getDeploymentFiles);
router.delete('/:id/files/:fileId', deleteDeploymentFile);

// Personnel Assignment routes
router.post('/:id/personnel', assignPersonnel);
router.delete('/:id/personnel/:personnelId', unassignPersonnel);

// Monitoring Team Assignment routes
router.post('/:id/monitoring', assignMonitoringUser);
router.delete('/:id/monitoring/:userId', unassignMonitoringUser);

export default router;
