-- BESS QA/QC Module
CREATE TABLE IF NOT EXISTS bess_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES deployments(id) ON DELETE SET NULL,
  tenant_id UUID,
  inspection_type TEXT NOT NULL DEFAULT 'site_survey' CHECK (inspection_type IN ('container_qa','inverter_qa','site_survey','full_audit')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','approved')),
  site_name TEXT,
  site_address TEXT,
  inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
  inspector_name TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  defect_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  pass_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bess_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES bess_inspections(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (component_type IN ('container','inverter','cable','transformer','rack','bms','hvac','other')),
  component_id TEXT,
  defect_category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('critical','major','minor','observation')),
  description TEXT NOT NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wont_fix')),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_count INTEGER DEFAULT 1,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bess_checklist_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES bess_inspections(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  response TEXT CHECK (response IN ('pass','fail','na','pending')),
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inspection_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_bess_inspections_deployment ON bess_inspections(deployment_id);
CREATE INDEX IF NOT EXISTS idx_bess_defects_inspection ON bess_defects(inspection_id);
CREATE INDEX IF NOT EXISTS idx_bess_defects_severity ON bess_defects(severity);
