import express from 'express';
import {
    getAllSubscriptionInvoices,
    getTenantBillingSummary,
    getTenantInvoices,
    createSubscriptionInvoice,
    updateInvoiceStatus,
    deleteSubscriptionInvoice,
} from '../controllers/subscriptionInvoiceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require auth + admin
router.use(protect);
router.use(authorize('admin'));

router.get('/',               getAllSubscriptionInvoices);   // All invoices (filterable)
router.get('/tenants',        getTenantBillingSummary);      // Per-tenant billing summary
router.get('/:tenantSlug',    getTenantInvoices);            // Invoices for one tenant
router.post('/',              createSubscriptionInvoice);    // Generate new invoice
router.put('/:id/status',     updateInvoiceStatus);          // Mark sent/paid/void
router.delete('/:id',         deleteSubscriptionInvoice);    // Delete draft

export default router;
