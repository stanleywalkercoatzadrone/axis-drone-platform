-- ============================================================
-- Migration: RBAC Permission Seed
-- Date: 2026-04-06
-- Seeds canonical permission keys for all 19 Axis modules.
-- Maps roles to their default permission sets.
-- ADDITIVE ONLY — ON CONFLICT DO NOTHING on all inserts
-- SAFE TO RE-RUN multiple times
-- ============================================================

-- ── 1. Ensure canonical permission keys exist ─────────────────

INSERT INTO permissions (name, key) VALUES
    -- Mission Module
    ('View Missions',           'mission.view'),
    ('Create Missions',         'mission.create'),
    ('Edit Missions',           'mission.edit'),
    ('Delete Missions',         'mission.delete'),
    ('Manage Missions',         'mission.manage'),
    ('Change Mission Status',   'mission.status_change'),

    -- Reports Module
    ('View Reports',            'report.view'),
    ('Create Reports',          'report.create'),
    ('Edit Reports',            'report.edit'),
    ('Delete Reports',          'report.delete'),
    ('Finalize Reports',        'report.finalize'),
    ('Export Reports',          'report.export'),

    -- AI / Analysis Module
    ('Run AI Analysis',         'ai.run'),
    ('View AI Results',         'ai.view'),
    ('Manage AI Jobs',          'ai.jobs.manage'),

    -- Personnel Module
    ('View Personnel',          'personnel.view'),
    ('Create Personnel',        'personnel.create'),
    ('Edit Personnel',          'personnel.edit'),
    ('Delete Personnel',        'personnel.delete'),
    ('Manage Personnel',        'personnel.manage'),
    ('View Personnel Finance',  'personnel.finance.view'),

    -- Finance / Billing Module
    ('View Finance',            'finance.view'),
    ('Manage Finance',          'finance.manage'),
    ('Create Invoices',         'invoice.create'),
    ('View Invoices',           'invoice.view'),
    ('Manage Invoices',         'invoice.manage'),
    ('View Payroll',            'payroll.view'),
    ('Manage Payroll',          'payroll.manage'),

    -- Client Module
    ('View Clients',            'client.view'),
    ('Manage Clients',          'client.manage'),

    -- User Management
    ('View Users',              'user.view'),
    ('Create Users',            'user.create'),
    ('Manage Users',            'user.manage'),
    ('Assign Roles',            'user.roles_assign'),

    -- Audit Module
    ('View Audit Logs',         'audit.view'),
    ('Export Audit Logs',       'audit.export'),

    -- Assets / Sites
    ('View Assets',             'asset.view'),
    ('Manage Assets',           'asset.manage'),

    -- System Administration
    ('View System Settings',    'system.settings.view'),
    ('Manage System Settings',  'system.settings.manage'),
    ('View Feature Flags',      'system.flags.view'),

    -- Media / Uploads
    ('Upload Media',            'media.upload'),
    ('View Media',              'media.view'),
    ('Delete Media',            'media.delete'),

    -- Intelligence / Solar
    ('View Intelligence',       'intelligence.view'),
    ('Manage Intelligence',     'intelligence.manage')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Ensure canonical roles exist ──────────────────────────

INSERT INTO roles (name, description) VALUES
    ('admin',            'Full system access — all tenants, all operations'),
    ('operations',       'Day-to-day operational management'),
    ('analyst',          'Intelligence and analytics dashboards — read-only+ '),
    ('field_operator',   'Creates and edits inspections, manages media'),
    ('senior_inspector', 'Senior field operations with report finalization'),
    ('pilot_technician', 'Isolated pilot field operations — own missions only'),
    ('client',           'Read-only scoped client portal access'),
    ('client_user',      'Extended client user — scoped project & report access'),
    ('auditor',          'Immutable audit log access — read-only'),
    ('user',             'Basic authenticated user — minimal access')
ON CONFLICT (name) DO NOTHING;

-- ── 3. Map roles → permissions ────────────────────────────────
-- Uses role name join to be resilient to ID changes

-- ADMIN: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- OPERATIONS: mission + personnel + finance + reports + clients
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'mission.view', 'mission.create', 'mission.edit', 'mission.manage',
    'mission.status_change', 'report.view', 'report.create', 'report.edit',
    'report.export', 'personnel.view', 'personnel.manage',
    'finance.view', 'invoice.view', 'client.view', 'client.manage',
    'media.upload', 'media.view', 'intelligence.view', 'asset.view',
    'audit.view', 'user.view'
)
WHERE r.name = 'operations'
ON CONFLICT DO NOTHING;

-- ANALYST: read-heavy, intelligence focus
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'mission.view', 'report.view', 'report.export', 'intelligence.view',
    'finance.view', 'invoice.view', 'personnel.view', 'client.view',
    'media.view', 'ai.view', 'audit.view', 'asset.view'
)
WHERE r.name = 'analyst'
ON CONFLICT DO NOTHING;

-- FIELD_OPERATOR: inspection creation + media
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'mission.view', 'mission.create', 'mission.edit', 'mission.status_change',
    'report.view', 'report.create', 'report.edit',
    'ai.run', 'ai.view',
    'media.upload', 'media.view',
    'personnel.view', 'asset.view', 'intelligence.view'
)
WHERE r.name = 'field_operator'
ON CONFLICT DO NOTHING;

-- SENIOR_INSPECTOR: field_operator + finalize + finance view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'mission.view', 'mission.create', 'mission.edit', 'mission.manage',
    'mission.status_change', 'report.view', 'report.create', 'report.edit',
    'report.finalize', 'report.export', 'ai.run', 'ai.view',
    'media.upload', 'media.view', 'personnel.view',
    'finance.view', 'invoice.view', 'asset.view', 'intelligence.view', 'client.view'
)
WHERE r.name = 'senior_inspector'
ON CONFLICT DO NOTHING;

-- PILOT_TECHNICIAN: own missions only — media upload, basic ops
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'mission.view', 'report.view', 'media.upload', 'media.view',
    'intelligence.view'
)
WHERE r.name = 'pilot_technician'
ON CONFLICT DO NOTHING;

-- CLIENT: scoped read-only portal
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'mission.view', 'report.view', 'invoice.view', 'media.view'
)
WHERE r.name = 'client'
ON CONFLICT DO NOTHING;

-- CLIENT_USER: same as client + intelligence view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'mission.view', 'report.view', 'invoice.view',
    'media.view', 'intelligence.view'
)
WHERE r.name = 'client_user'
ON CONFLICT DO NOTHING;

-- AUDITOR: full audit log access, read-only elsewhere
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
    'audit.view', 'audit.export',
    'mission.view', 'report.view', 'personnel.view',
    'finance.view', 'invoice.view', 'user.view'
)
WHERE r.name = 'auditor'
ON CONFLICT DO NOTHING;

-- USER: minimal baseline
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('mission.view', 'report.view')
WHERE r.name = 'user'
ON CONFLICT DO NOTHING;

-- ── Verification (informational) ─────────────────────────────
-- SELECT r.name, COUNT(rp.permission_id) as perm_count
-- FROM roles r LEFT JOIN role_permissions rp ON r.id = rp.role_id
-- GROUP BY r.name ORDER BY r.name;
