import { query } from '../config/database.js';
import bcrypt from 'bcryptjs';

/**
 * Run pending migrations
 */
export const runMigration = async (req, res) => {
    try {
        console.log('🔧 Running migration: Add missing columns + vendor_expenses table');

        // Add daily_pay_rate column if not exists
        await query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS daily_pay_rate NUMERIC(10, 2),
            ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS payment_days INTEGER DEFAULT 30;
        `);

        // Create vendor_expenses table
        await query(`
            CREATE TABLE IF NOT EXISTS vendor_expenses (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_name     TEXT NOT NULL,
                project_name    TEXT NOT NULL,
                inv_number      TEXT,
                inv_date        DATE NOT NULL,
                inv_year        INT,
                inv_month       TEXT,
                inv_status      TEXT NOT NULL DEFAULT 'Unpaid',
                payment_date    DATE,
                payment_year    INT,
                payment_month   TEXT,
                invoice_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
                stanley_addon   NUMERIC(12,2) NOT NULL DEFAULT 0,
                paid_to_vendor  NUMERIC(12,2) NOT NULL DEFAULT 0,
                paid_to_stanley NUMERIC(12,2) NOT NULL DEFAULT 0,
                notes           TEXT,
                tenant_id       UUID,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_ve_inv_date ON vendor_expenses(inv_date DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_ve_status ON vendor_expenses(inv_status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_ve_vendor ON vendor_expenses(vendor_name)`);

        console.log('✅ Migration completed successfully');

        res.json({
            success: true,
            message: 'Migration completed: invoice columns + vendor_expenses table'
        });

    } catch (error) {
        console.error('❌ Migration failed:', error);
        res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message
        });
    }
};
