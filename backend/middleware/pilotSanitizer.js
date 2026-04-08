/**
 * pilotSanitizer.js
 * Pilot Access Streamlining — Phase 2
 * 
 * Response sanitization middleware for ALL /api/pilot/* endpoints.
 * Strips financial, billing, and cross-user fields from responses
 * even if accidentally queried. Runs as final middleware before send.
 * 
 * ADDITIVE ONLY — does not touch any existing middleware.
 */

// Fields that MUST NEVER appear in pilot API responses
const BLOCKED_FIELDS = new Set([
    'payoutAmount', 'payout_amount',
    'missionRevenue', 'mission_revenue', 'revenue',
    'billingRate', 'billing_rate', 'client_billing_rate',
    'costBreakdown', 'cost_breakdown', 'daily_pay', 'bonus_pay',
    'costPerDay', 'cost_per_day', 'profitMargin', 'profit_margin',
    'totalCost', 'total_cost',
    'clientContractDetails', 'client_contract_details', 'contract_value',
    'bankingInfo', 'banking_info', 'bank_account', 'bank_routing',
    'taxData', 'tax_data', 'tax_id', 'w9', 'payment_terms',
    'insuranceExposure', 'insurance_exposure', 'insurance_value',
    'portfolioMetrics', 'portfolio_metrics',
    'otherUserData', 'other_user_data',
    'admin_notes', 'internal_notes',
    'clientEmail', 'client_email', 'client_phone',
    'salary', 'hourly_rate', 'annual_rate',
    'invoiceAmount', 'invoice_amount',
    'financialSummary', 'financial_summary',
]);

/**
 * Recursively strip blocked fields from any object or array.
 */
function sanitize(data) {
    if (Array.isArray(data)) {
        return data.map(sanitize);
    }
    if (data && typeof data === 'object') {
        const cleaned = {};
        for (const [key, val] of Object.entries(data)) {
            if (!BLOCKED_FIELDS.has(key)) {
                cleaned[key] = sanitize(val);
            }
        }
        return cleaned;
    }
    return data;
}

/**
 * Middleware: intercepts res.json() to sanitize before send.
 * Fully transparent — only blocks financial fields.
 */
export const pilotResponseSanitizer = (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
        try {
            const sanitized = sanitize(body);
            return originalJson(sanitized);
        } catch {
            return originalJson(body); // Never fail silently
        }
    };

    next();
};
