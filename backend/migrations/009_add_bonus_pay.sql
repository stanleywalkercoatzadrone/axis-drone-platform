-- Migration: Add bonus_pay to daily_logs table
-- This allows tracking bonus payments for pilots on specific days

ALTER TABLE daily_logs 
ADD COLUMN bonus_pay DECIMAL(10, 2) DEFAULT 0.00;
