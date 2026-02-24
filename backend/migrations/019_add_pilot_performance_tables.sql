CREATE TABLE IF NOT EXISTS pilot_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pilot_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    note_type VARCHAR(50) DEFAULT 'general',
    content TEXT NOT NULL,
    rating INTEGER,
    mission_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add mission_count and average_rating to personnel for quick matching
ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS total_missions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00;
