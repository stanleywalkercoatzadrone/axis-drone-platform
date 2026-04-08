CREATE TABLE IF NOT EXISTS candidate_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    payload_json JSONB,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_packets_token ON candidate_packets(token);
CREATE INDEX IF NOT EXISTS idx_candidate_packets_email ON candidate_packets(candidate_email);
