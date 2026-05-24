-- ── Social Media Blast Module ────────────────────────────────────────────────
-- Enables automatic social media posting when pilots are assigned or
-- mission status changes. Supports LinkedIn, Twitter/X, Facebook, Instagram.

-- Connected social media accounts (one row per platform per tenant)
CREATE TABLE IF NOT EXISTS social_media_accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT NOT NULL,
    platform         VARCHAR(50) NOT NULL,    -- 'linkedin'|'twitter'|'facebook'|'instagram'
    account_name     VARCHAR(255),            -- display label
    access_token     TEXT,                    -- OAuth access token (encrypted in app layer)
    refresh_token    TEXT,
    token_expires_at TIMESTAMP,
    platform_user_id VARCHAR(255),           -- LinkedIn URN / Twitter ID / FB user ID
    page_id          VARCHAR(255),           -- FB page ID / IG business account ID
    is_active        BOOLEAN DEFAULT TRUE,
    connected_at     TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, platform)              -- one account per platform per tenant
);

-- Post templates (configurable per trigger event)
CREATE TABLE IF NOT EXISTS social_media_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL,
    name        VARCHAR(255) NOT NULL,
    trigger     VARCHAR(50) NOT NULL,        -- 'pilot_assigned'|'mission_active'|'mission_complete'
    platforms   TEXT[] NOT NULL DEFAULT '{}',
    template    TEXT NOT NULL,
    auto_post   BOOLEAN DEFAULT FALSE,       -- if false, creates pending post for approval
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Post history / audit log
CREATE TABLE IF NOT EXISTS social_media_posts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT NOT NULL,
    deployment_id    UUID REFERENCES deployments(id) ON DELETE SET NULL,
    account_id       UUID REFERENCES social_media_accounts(id) ON DELETE SET NULL,
    template_id      UUID REFERENCES social_media_templates(id) ON DELETE SET NULL,
    platform         VARCHAR(50) NOT NULL,
    content          TEXT NOT NULL,
    status           VARCHAR(50) DEFAULT 'pending',  -- 'pending'|'posted'|'failed'|'skipped'
    platform_post_id VARCHAR(255),                   -- ID returned by the platform API
    error_message    TEXT,
    posted_at        TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant    ON social_media_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_deploy    ON social_media_posts(deployment_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status    ON social_media_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_templates_tenant ON social_media_templates(tenant_id, trigger);
