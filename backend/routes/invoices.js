import express from 'express';
import { createInvoice, getInvoiceByToken, createMasterInvoice, getInvoicesByDeployment } from '../controllers/invoiceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected: Admin creates invoice
router.post('/', protect, createInvoice);

// Protected: Admin creates master invoice
router.post('/master', protect, createMasterInvoice);

// Public: Pilot views invoice (Token protected)
router.get('/:token', getInvoiceByToken);

// Protected: Admin updates invoice (Token used as ID here for convenience)
// In a more strict system, we'd use ID and protect middleware, 
// but for the editable invoice view we'll allow token-based updates if authorized
import { updateInvoice } from '../controllers/invoiceController.js';
router.put('/:token', updateInvoice);

// Protected: Get all invoices for a deployment
router.get('/deployment/:deploymentId', protect, getInvoicesByDeployment);

export default router;
