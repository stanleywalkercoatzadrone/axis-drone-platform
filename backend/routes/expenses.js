/**
 * expenses.js — Finance Expense Sheet API
 * Aggregates pilot mission pay from daily_logs and manages manual expense entries.
 * Supports CSV and XLSX (.xlsx/.xls) file uploads.
 */
import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { query } from '../config/database.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(protect);

// ── GET /api/expenses/pilot-summary ─────────────────────────────────────────
router.get('/pilot-summary', async (req, res) => {
    try {
        // tenantId may be a plain string like "default" (not a UUID) — guard against cast errors
        const tenantId = req.user.tenantId;
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId || '');

        const { rows } = await query(`
            SELECT
                p.id            AS pilot_id,
                p.full_name     AS pilot_name,
                p.email         AS pilot_email,
                p.role,
                d.id            AS mission_id,
                d.title         AS mission_title,
                d.site_name,
                d.status        AS mission_status,
                d.date          AS mission_date,
                COUNT(dl.id)    AS days_logged,
                COALESCE(SUM(dl.daily_pay), 0)  AS base_pay,
                COALESCE(SUM(dl.bonus_pay), 0)  AS bonus_pay,
                COALESCE(SUM(dl.daily_pay + dl.bonus_pay), 0) AS total_pay
            FROM daily_logs dl
            JOIN personnel p  ON p.id  = dl.technician_id
            JOIN deployments d ON d.id = dl.deployment_id
            ${isValidUuid ? 'WHERE d.tenant_id = $1' : ''}
            GROUP BY p.id, p.full_name, p.email, p.role, d.id, d.title, d.site_name, d.status, d.date
            ORDER BY d.date DESC, p.full_name ASC
        `, isValidUuid ? [tenantId] : []);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('GET /expenses/pilot-summary error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /api/expenses/manual ─────────────────────────────────────────────────
router.get('/manual', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId || '');
        const { rows } = await query(`
            SELECT id, category, description, amount, expense_date, vendor, mission_id,
                   uploaded_by, file_url, file_name, notes, created_at
            FROM mission_expenses
            ${isValidUuid ? 'WHERE tenant_id = $1' : ''}
            ORDER BY expense_date DESC
        `, isValidUuid ? [tenantId] : []);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/expenses/manual ────────────────────────────────────────────────
router.post('/manual', authorize('admin'), async (req, res) => {
    try {
        const { category, description, amount, expense_date, vendor, mission_id, notes } = req.body;
        const tenantId = req.user.tenantId;
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId || '');
        const { rows } = await query(`
            INSERT INTO mission_expenses (category, description, amount, expense_date, vendor, mission_id, tenant_id, uploaded_by, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
        `, [category || 'Other', description, amount, expense_date, vendor || null, mission_id || null, isValidUuid ? tenantId : null, req.user.id, notes || null]);
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── DELETE /api/expenses/manual/:id ─────────────────────────────────────────
router.delete('/manual/:id', authorize('admin'), async (req, res) => {
    try {
        // Delete by ID only — tenant_id may be non-UUID string so skip that filter
        await query(`DELETE FROM mission_expenses WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/expenses/upload-csv ────────────────────────────────────────────
// Accepts CSV (.csv) and Excel (.xlsx / .xls) expense sheets.
router.post('/upload-csv', authorize('admin'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const fileName = (req.file.originalname || '').toLowerCase();
        const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
            || (req.file.mimetype || '').includes('spreadsheet')
            || (req.file.mimetype || '').includes('excel');

        // ── Field matcher: substring regex on raw header text ─────────────────
        // Handles "Total Cost", "Invoice Amount", "Expense Date", "Vendor/Pilot", "Invoice D" etc.
        const matchField = (rawHeader) => {
            const h = String(rawHeader || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
            if (!h) return null;
            // Amount — explicit exclusions so "days pay" doesn't match "pay" for amount
            if (/\bamount\b|\bcost\b|\btotal\b|\bprice\b|\bvalue\b|\bcharge\b|\bfee\b/.test(h)) return 'amount';
            // Date — must be more specific to avoid matching "invoice d" alone
            if (/\bdate\b|\binvoice date\b|\bpayment date\b|\bexpense date\b/.test(h)) return 'expense_date';
            // Fallback: ends with " d" or " dt" (truncated "date") but NOT standalone letters
            if (/\bd$|\bdt$/.test(h) && h.length > 2) return 'expense_date';
            // Category
            if (/\bcategory\b|\btype\b|\bclass\b|\bkind\b/.test(h)) return 'category';
            // Description
            if (/\bdesc\b|\bitem\b|\bdetail\b|\bservice\b|\bnarr\b|\bnotes?\b|\bproject\b/.test(h)) return 'description';
            // Vendor — "vendor/pilot", "supplier", "payee", "merchant"
            if (/\bvendor\b|\bsupplier\b|\bpayee\b|\bmerchant\b|\bpilot\b/.test(h)) return 'vendor';
            // Invoice number → description
            if (/\binv\b.*\bnum\b|\binvoice\b.*\bnum\b|\binv\b.*\bno\b/.test(h)) return 'description';
            // Mission
            if (/\bmission\b|\bdeployment\b/.test(h)) return 'mission_id';
            return null;
        };

        // ── Auto-detect the header row (rows 1-10) ────────────────────────────
        // The header row is the one where the most cells match known field names.
        // This handles spreadsheets where row 1 is a summary/totals row.
        const findHeaderRow = (ws) => {
            let bestRow = 1;
            let bestScore = -1;
            for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
                let matchScore = 0;
                let numericCount = 0;
                let cellCount = 0;
                ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
                    cellCount++;
                    const v = cell.value;
                    // Only count actual text header matches
                    if (matchField(v) !== null) matchScore++;
                    // Count numeric cells (formulas, numbers, currency strings)
                    const raw = (v && typeof v === 'object' && v.result !== undefined) ? v.result : v;
                    const s = String(raw ?? '').replace(/[$,\s]/g, '');
                    if (!isNaN(parseFloat(s)) && s.length > 0) numericCount++;
                });
                // Penalise rows that are mostly numbers (data/totals rows)
                const numericRatio = cellCount > 0 ? numericCount / cellCount : 0;
                const score = matchScore - (numericRatio > 0.5 ? 10 : 0);
                if (score > bestScore) { bestScore = score; bestRow = r; }
            }
            return bestRow;
        };

        // ── Safe numeric extractor ────────────────────────────────────────────
        const toNum = (val) => {
            if (val === null || val === undefined || val === '') return null;
            if (typeof val === 'object' && val !== null) {
                if (val.result !== undefined) val = val.result;
                else if (val.text !== undefined) val = val.text;
                else val = String(val);
            }
            if (typeof val === 'number') return isFinite(val) && val > 0 ? val : null;
            const cleaned = String(val).replace(/[$,\s]/g, '').replace(/[()]/g, '');
            const n = parseFloat(cleaned);
            return isFinite(n) && n > 0 ? n : null;
        };

        // ── Safe string extractor ─────────────────────────────────────────────
        const toStr = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'object' && val !== null) {
                if (val.result !== undefined) val = val.result;
                else if (val.text !== undefined) val = val.text;
                else if (val instanceof Date) return val.toISOString().split('T')[0];
            }
            if (val instanceof Date) return val.toISOString().split('T')[0];
            const s = String(val).trim();
            return s || null;
        };

        // ── Safe date extractor ───────────────────────────────────────────────
        const toDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val.toISOString().split('T')[0];
            if (typeof val === 'object' && val !== null) {
                if (val.result instanceof Date) return val.result.toISOString().split('T')[0];
                if (val.result) val = val.result;
            }
            const s = String(val).trim();
            if (!s) return null;
            // Excel date serial (e.g. 45123)
            if (/^\d{4,5}$/.test(s)) {
                const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
                return d.toISOString().split('T')[0];
            }
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
        };

        let dataRows = [];

        if (isXlsx) {
            // ── Excel: ExcelJS column-number based access (no index arrays) ───
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(req.file.buffer);
            const ws = wb.worksheets[0];
            if (!ws) throw new Error('No worksheets found in the Excel file');

            // Auto-detect which row is the real header (handles summary rows above headers)
            const headerRowNum = findHeaderRow(ws);

            // Build colMap: field -> 1-indexed column number from the detected header row
            const colMap = {};
            ws.getRow(headerRowNum).eachCell({ includeEmpty: false }, (cell, colNum) => {
                const field = matchField(cell.value);
                if (field && !colMap[field]) colMap[field] = colNum;
            });

            // Auto-detect amount column if header matching still failed
            if (!colMap['amount']) {
                const maxCol = ws.columnCount || 20;
                for (let c = 1; c <= maxCol; c++) {
                    if (Object.values(colMap).includes(c)) continue;
                    let hits = 0;
                    for (let r = headerRowNum + 1; r <= Math.min(headerRowNum + 6, ws.rowCount); r++) {
                        if (toNum(ws.getRow(r).getCell(c).value) !== null) hits++;
                    }
                    if (hits >= 1) { colMap['amount'] = c; break; }
                }
            }

            ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
                if (rowNum <= headerRowNum) return; // skip header and any rows above it
                const get = (field) => colMap[field] ? row.getCell(colMap[field]).value : null;
                // Skip fully empty rows
                const amt = get('amount');
                const desc = get('description');
                const vendor = get('vendor');
                if (!amt && !desc && !vendor) return;
                dataRows.push({
                    category:    toStr(get('category')),
                    description: toStr(get('description')) || toStr(get('vendor')),
                    rawAmount:   amt,
                    rawDate:     get('expense_date'),
                    vendor:      toStr(get('vendor')),
                    mission_id:  toStr(get('mission_id')),
                });
            });

        } else {
            // ── CSV: plain text parse ─────────────────────────────────────────
            const text = req.file.buffer.toString('utf-8');
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) {
                return res.status(400).json({ success: false, error: 'File must have a header row and at least one data row' });
            }

            const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const colMap = {};
            rawHeaders.forEach((h, i) => {
                const field = matchField(h);
                if (field && colMap[field] === undefined) colMap[field] = i;
            });

            const getCol = (cells, field) => {
                const idx = colMap[field];
                return idx !== undefined ? (cells[idx] || '').trim().replace(/^"|"$/g, '') || null : null;
            };

            for (let i = 1; i < lines.length; i++) {
                const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                dataRows.push({
                    category:    getCol(cells, 'category'),
                    description: getCol(cells, 'description'),
                    rawAmount:   getCol(cells, 'amount'),
                    rawDate:     getCol(cells, 'expense_date'),
                    vendor:      getCol(cells, 'vendor'),
                    mission_id:  getCol(cells, 'mission_id'),
                });
            }
        }

        // ── Bulk insert ───────────────────────────────────────────────────────
        const inserted = [];
        const errors = [];

        const uploadTenantId = req.user.tenantId;
        const uploadTenantIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadTenantId || '');

        for (let i = 0; i < dataRows.length; i++) {
            const { category, description, rawAmount, rawDate, vendor } = dataRows[i];
            const amount = toNum(rawAmount);
            const expense_date = toDate(rawDate) || new Date().toISOString().split('T')[0];

            if (!amount) {
                errors.push(`Row ${i + 2}: invalid amount "${rawAmount}"`);
                continue;
            }

            try {
                const { rows } = await query(`
                    INSERT INTO mission_expenses
                        (category, description, amount, expense_date, vendor, mission_id, tenant_id, uploaded_by, file_name, notes)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    RETURNING id
                `, [
                    category || 'Other',
                    description || 'Imported expense',
                    amount,
                    expense_date,
                    vendor || null,
                    null,
                    uploadTenantIsUuid ? uploadTenantId : null,
                    req.user.id,
                    req.file.originalname,
                    null,
                ]);
                inserted.push(rows[0].id);
            } catch (rowErr) {
                errors.push(`Row ${i + 2}: ${rowErr.message}`);
            }
        }

        res.json({
            success: inserted.length > 0 || errors.length === 0,
            inserted: inserted.length,
            errors,
            message: `${inserted.length} expense(s) imported${errors.length ? `, ${errors.length} row(s) skipped` : ''}.`,
        });
    } catch (err) {
        console.error('POST /expenses/upload-csv error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
