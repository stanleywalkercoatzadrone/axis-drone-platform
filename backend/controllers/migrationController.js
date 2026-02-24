import { query } from '../config/database.js';

/**
 * Run pending migrations - specifically add missing invoice columns
 */
export const runMigration = async (req, res) => {
    try {
        console.log('🔧 Running migration: Add missing invoice columns');

        // Add daily_pay_rate column if not exists
        await query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS daily_pay_rate NUMERIC(10, 2),
            ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS payment_days INTEGER DEFAULT 30;
        `);

        console.log('✅ Migration completed successfully');

        res.json({
            success: true,
            message: 'Migration completed: Added daily_pay_rate, viewed_at, and payment_days columns'
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
