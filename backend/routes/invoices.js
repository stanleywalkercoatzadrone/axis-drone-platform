import express from 'express';
import {
    createInvoice,
    getInvoiceByToken,
    updateInvoiceByToken,
    generatePartialInvoice,
    getAllInvoices,
    getPayrollData,
} from '../controllers/invoiceController.js';
import { protect, authorize } from '../middleware/auth.js';


const router = express.Router();

// Admin: list all invoices
router.get('/all', protect, authorize('admin'), getAllInvoices);

// Admin: payroll summary per pilot
router.get('/payroll', protect, authorize('admin'), getPayrollData);

// Protected: Admin creates invoice
router.post('/', protect, createInvoice);

// Public: Pilot views invoice (Token protected)
router.get('/:token', getInvoiceByToken);

// Public: Update invoice via secure token
router.put('/:token', updateInvoiceByToken);

// Phase 3: Partial invoice (session-based)
router.post('/missions/:missionId/partial', protect, generatePartialInvoice);

export default router;

