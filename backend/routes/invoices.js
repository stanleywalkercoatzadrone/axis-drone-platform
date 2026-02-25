import express from 'express';
import { createInvoice, getInvoiceByToken, updateInvoiceByToken } from '../controllers/invoiceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected: Admin creates invoice
router.post('/', protect, createInvoice);

// Public: Pilot views invoice (Token protected)
router.get('/:token', getInvoiceByToken);

// Public: Update invoice via secure token
router.put('/:token', updateInvoiceByToken);

export default router;
