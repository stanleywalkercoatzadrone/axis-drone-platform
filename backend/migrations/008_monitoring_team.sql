-- Migration 008: Deployment Monitoring Team
-- Description: Create junction table for assigning monitoring users (Admin/Auditor) to deployments

CREATE TABLE IF NOT EXISTS deployment_monitoring_users (
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Monitor',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (deployment_id, user_id)
);

CREATE INDEX idx_deployment_monitoring_deployment ON deployment_monitoring_users(deployment_id);
CREATE INDEX idx_deployment_monitoring_user ON deployment_monitoring_users(user_id);
