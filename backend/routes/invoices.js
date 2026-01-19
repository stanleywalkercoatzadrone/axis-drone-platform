import express from 'express';
import { createInvoice, getInvoiceByToken } from '../controllers/invoiceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected: Admin creates invoice
router.post('/', protect, createInvoice);

// Public: Pilot views invoice (Token protected)
router.get('/:token', getInvoiceByToken);

export default router;
