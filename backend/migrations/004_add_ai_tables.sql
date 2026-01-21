-- AI Decisions and Audit Trail Schema
-- Migration: Add tables for AI reasoning engine audit and compliance

-- AI Decisions Table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS ai_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    
    -- Input/Output Data
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    
    -- Model Information
    model_version VARCHAR(50) NOT NULL,
    prompt_version VARCHAR(50) NOT NULL,
    
    -- Metrics
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    processing_time_ms INTEGER NOT NULL,
    token_count INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Additional Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Indexes
    CONSTRAINT valid_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

-- Indexes for performance
CREATE INDEX idx_ai_decisions_user_id ON ai_decisions(user_id);
CREATE INDEX idx_ai_decisions_created_at ON ai_decisions(created_at DESC);
CREATE INDEX idx_ai_decisions_endpoint ON ai_decisions(endpoint);
CREATE INDEX idx_ai_decisions_request_id ON ai_decisions(request_id);
CREATE INDEX idx_ai_decisions_confidence ON ai_decisions(confidence_score) WHERE confidence_score IS NOT NULL;

-- AI Analysis Results (Linked to Reports)
CREATE TABLE IF NOT EXISTS ai_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    decision_id UUID REFERENCES ai_decisions(id) ON DELETE SET NULL,
    
    -- Analysis Data
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    severity VARCHAR(50),
    risk_score DECIMAL(5,2) CHECK (risk_score >= 0 AND risk_score <= 100),
    recommendations JSONB DEFAULT '[]'::jsonb,
    
    -- Confidence and Reasoning
    confidence JSONB NOT NULL,
    reasoning JSONB NOT NULL,
    
    -- Human Override
    human_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    override_by UUID REFERENCES users(id),
    override_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_ai_analysis_report_id ON ai_analysis_results(report_id);
CREATE INDEX idx_ai_analysis_decision_id ON ai_analysis_results(decision_id);
CREATE INDEX idx_ai_analysis_severity ON ai_analysis_results(severity);
CREATE INDEX idx_ai_analysis_created_at ON ai_analysis_results(created_at DESC);

-- Prompt Templates (Version Control)
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    template TEXT NOT NULL,
    description TEXT,
    
    -- Metadata
    variables JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    deprecated_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(name, version)
);

-- Indexes
CREATE INDEX idx_prompt_templates_name ON ai_prompt_templates(name);
CREATE INDEX idx_prompt_templates_active ON ai_prompt_templates(is_active) WHERE is_active = TRUE;

-- AI Usage Metrics (for monitoring and quotas)
CREATE TABLE IF NOT EXISTS ai_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Usage Data
    date DATE NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_processing_time_ms BIGINT DEFAULT 0,
    
    -- Costs (optional)
    estimated_cost_usd DECIMAL(10,4),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(user_id, date, endpoint)
);

-- Indexes
CREATE INDEX idx_usage_metrics_user_date ON ai_usage_metrics(user_id, date DESC);
CREATE INDEX idx_usage_metrics_date ON ai_usage_metrics(date DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_ai_analysis_results_updated_at BEFORE UPDATE ON ai_analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_prompt_templates_updated_at BEFORE UPDATE ON ai_prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_usage_metrics_updated_at BEFORE UPDATE ON ai_usage_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default prompt templates
INSERT INTO ai_prompt_templates (name, version, template, description, variables) VALUES
(
    'inspection_analysis',
    '1.0.0',
    'You are an expert inspection analyst. Analyze the following inspection data and provide structured findings.\n\nIndustry: {{industry}}\nClient: {{client}}\nImages: {{image_count}}\nMetadata: {{metadata}}\n\nProvide your analysis in the following JSON format:\n{\n  "findings": [...],\n  "severity": "LOW|MEDIUM|HIGH|CRITICAL",\n  "riskScore": 0-100,\n  "recommendations": [...]\n}',
    'Primary template for inspection analysis',
    '["industry", "client", "image_count", "metadata"]'::jsonb
),
(
    'anomaly_detection',
    '1.0.0',
    'Analyze the provided image for anomalies specific to {{industry}} inspections.\n\nImage analysis should identify:\n- Defects and their severity\n- Safety concerns\n- Maintenance requirements\n- Compliance issues\n\nReturn structured JSON with detected anomalies.',
    'Template for image-based anomaly detection',
    '["industry", "image_url", "context"]'::jsonb
),
(
    'mission_readiness',
    '1.0.0',
    'Evaluate mission readiness for the following deployment:\n\nAssets: {{assets}}\nPersonnel: {{personnel}}\nWeather: {{weather}}\nRegulations: {{regulations}}\n\nProvide a readiness assessment with risk flags.',
    'Template for pre-flight mission validation',
    '["assets", "personnel", "weather", "regulations"]'::jsonb
);

-- Grant permissions (adjust as needed for your RLS policies)
-- GRANT SELECT, INSERT ON ai_decisions TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON ai_analysis_results TO authenticated;
-- GRANT SELECT ON ai_prompt_templates TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON ai_usage_metrics TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE ai_decisions IS 'Immutable audit trail for all AI/LLM decisions';
COMMENT ON TABLE ai_analysis_results IS 'Structured analysis results linked to inspection reports';
COMMENT ON TABLE ai_prompt_templates IS 'Version-controlled prompt templates for AI operations';
COMMENT ON TABLE ai_usage_metrics IS 'Usage tracking and quota management for AI endpoints';
