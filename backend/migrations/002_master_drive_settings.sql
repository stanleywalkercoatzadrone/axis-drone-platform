-- Add master Drive credentials to system settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    encrypted BOOLEAN DEFAULT FALSE,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default master Drive settings
INSERT INTO system_settings (setting_key, setting_value, encrypted)
VALUES 
    ('master_drive_enabled', 'false', false),
    ('master_drive_access_token', NULL, true),
    ('master_drive_refresh_token', NULL, true),
    ('master_drive_folder_id', NULL, false),
    ('master_drive_email', NULL, false)
ON CONFLICT (setting_key) DO NOTHING;

-- Create index
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
