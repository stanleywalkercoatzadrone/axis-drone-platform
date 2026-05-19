-- Migration 100: Fix deployment status constraint
-- Uses single atomic ALTER TABLE to drop old constraint and add new comprehensive one.
-- The original constraint only allowed 5 values; the app uses many more.
ALTER TABLE deployments
    DROP CONSTRAINT IF EXISTS valid_deployment_status,
    ADD CONSTRAINT valid_deployment_status
        CHECK (status IN (
            'Draft', 'Scheduled', 'Active', 'In Progress',
            'Review', 'Completed', 'Archived', 'Cancelled',
            'Delayed', 'Finalized'
        ));
