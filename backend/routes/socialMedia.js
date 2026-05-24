import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query as dbQuery } from '../config/database.js';
import { approvePost, sendTestPost, composeAndSend } from '../services/socialMediaService.js';

const router = Router();
router.use(protect);

// ── Connected Accounts ────────────────────────────────────────────────────────

// GET /api/social/accounts — list all connected accounts for this tenant
router.get('/accounts', async (req, res) => {
    try {
        const r = await dbQuery(
            `SELECT id, platform, account_name, platform_user_id, page_id,
                    is_active, connected_at, updated_at,
                    CASE WHEN access_token IS NOT NULL AND access_token != '' THEN true ELSE false END as has_token
             FROM social_media_accounts
             WHERE tenant_id = $1
             ORDER BY platform`,
            [req.user.tenantId]
        );
        res.json({ success: true, data: r.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/social/accounts — add or update a connected account
router.post('/accounts', authorize('admin'), async (req, res) => {
    const { platform, account_name, access_token, refresh_token, token_expires_at,
            platform_user_id, page_id, default_image_url } = req.body;

    if (!platform || !access_token) {
        return res.status(400).json({ success: false, error: 'platform and access_token are required' });
    }

    const validPlatforms = ['linkedin', 'twitter', 'facebook', 'instagram'];
    if (!validPlatforms.includes(platform)) {
        return res.status(400).json({ success: false, error: `platform must be one of: ${validPlatforms.join(', ')}` });
    }

    try {
        // Upsert — one account per platform per tenant
        const r = await dbQuery(
            `INSERT INTO social_media_accounts
                (tenant_id, platform, account_name, access_token, refresh_token, token_expires_at,
                 platform_user_id, page_id, default_image_url, is_active, connected_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW(),NOW())
             ON CONFLICT (tenant_id, platform)
             DO UPDATE SET
                account_name     = EXCLUDED.account_name,
                access_token     = EXCLUDED.access_token,
                refresh_token    = COALESCE(EXCLUDED.refresh_token, social_media_accounts.refresh_token),
                token_expires_at = COALESCE(EXCLUDED.token_expires_at, social_media_accounts.token_expires_at),
                platform_user_id = COALESCE(EXCLUDED.platform_user_id, social_media_accounts.platform_user_id),
                page_id          = COALESCE(EXCLUDED.page_id, social_media_accounts.page_id),
                default_image_url= COALESCE(EXCLUDED.default_image_url, social_media_accounts.default_image_url),
                is_active        = true,
                updated_at       = NOW()
             RETURNING id, platform, account_name, platform_user_id, is_active`,
            [req.user.tenantId, platform, account_name || platform, access_token,
             refresh_token || null, token_expires_at || null,
             platform_user_id || null, page_id || null, default_image_url || null]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE /api/social/accounts/:id — disconnect an account
router.delete('/accounts/:id', authorize('admin'), async (req, res) => {
    try {
        await dbQuery(
            `UPDATE social_media_accounts
             SET is_active=false, access_token=null, refresh_token=null, updated_at=NOW()
             WHERE id=$1 AND tenant_id=$2`,
            [req.params.id, req.user.tenantId]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/social/test — send a test post to a connected account
router.post('/test', authorize('admin'), async (req, res) => {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ success: false, error: 'accountId required' });

    try {
        const result = await sendTestPost(accountId, req.user.tenantId);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Post Templates ────────────────────────────────────────────────────────────

// GET /api/social/templates
router.get('/templates', async (req, res) => {
    try {
        const r = await dbQuery(
            `SELECT * FROM social_media_templates WHERE tenant_id=$1 ORDER BY trigger, name`,
            [req.user.tenantId]
        );
        res.json({ success: true, data: r.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/social/templates — create
router.post('/templates', authorize('admin'), async (req, res) => {
    const { name, trigger, platforms, template, auto_post } = req.body;
    if (!name || !trigger || !template) {
        return res.status(400).json({ success: false, error: 'name, trigger, template are required' });
    }

    const validTriggers = ['job_opening', 'company_news', 'manual'];
    if (!validTriggers.includes(trigger)) {
        return res.status(400).json({ success: false, error: `trigger must be one of: ${validTriggers.join(', ')}` });
    }

    try {
        const r = await dbQuery(
            `INSERT INTO social_media_templates
                (tenant_id, name, trigger, platforms, template, auto_post, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,true)
             RETURNING *`,
            [req.user.tenantId, name, trigger, platforms || [], template, auto_post || false]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/social/blast — compose and send (or queue) a marketing post
router.post('/blast', authorize('admin'), async (req, res) => {
    const { content, platforms, auto_post = false, post_type = 'manual', post_title } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ success: false, error: 'content is required' });
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ success: false, error: 'at least one platform is required' });
    }

    const validPlatforms = ['linkedin', 'twitter', 'facebook', 'instagram'];
    const invalid = platforms.filter(p => !validPlatforms.includes(p));
    if (invalid.length) {
        return res.status(400).json({ success: false, error: `invalid platforms: ${invalid.join(', ')}` });
    }

    try {
        const results = await composeAndSend(
            req.user.tenantId,
            content.trim(),
            platforms,
            !!auto_post,
            post_type,
            post_title || null
        );
        res.json({ success: true, data: results });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /api/social/templates/:id — update
router.put('/templates/:id', authorize('admin'), async (req, res) => {
    const { name, trigger, platforms, template, auto_post, is_active } = req.body;
    try {
        const r = await dbQuery(
            `UPDATE social_media_templates SET
                name      = COALESCE($1, name),
                trigger   = COALESCE($2, trigger),
                platforms = COALESCE($3, platforms),
                template  = COALESCE($4, template),
                auto_post = COALESCE($5, auto_post),
                is_active = COALESCE($6, is_active),
                updated_at= NOW()
             WHERE id=$7 AND tenant_id=$8
             RETURNING *`,
            [name, trigger, platforms, template, auto_post, is_active, req.params.id, req.user.tenantId]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Template not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE /api/social/templates/:id
router.delete('/templates/:id', authorize('admin'), async (req, res) => {
    try {
        await dbQuery(
            `DELETE FROM social_media_templates WHERE id=$1 AND tenant_id=$2`,
            [req.params.id, req.user.tenantId]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Post History ─────────────────────────────────────────────────────────────

// GET /api/social/posts — post history with optional filters
router.get('/posts', async (req, res) => {
    const { platform, status, deploymentId, limit = 50, offset = 0 } = req.query;

    try {
        let conditions = [`p.tenant_id = $1`];
        let params = [req.user.tenantId];

        if (platform) {
            params.push(platform);
            conditions.push(`p.platform = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`p.status = $${params.length}`);
        }
        if (deploymentId) {
            params.push(deploymentId);
            conditions.push(`p.deployment_id = $${params.length}`);
        }

        params.push(parseInt(limit), parseInt(offset));

        const r = await dbQuery(
            `SELECT p.*,
                    d.title as mission_title,
                    d.site_name,
                    a.account_name,
                    t.name as template_name
             FROM social_media_posts p
             LEFT JOIN deployments d ON d.id = p.deployment_id
             LEFT JOIN social_media_accounts a ON a.id = p.account_id
             LEFT JOIN social_media_templates t ON t.id = p.template_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY p.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countRes = await dbQuery(
            `SELECT COUNT(*) FROM social_media_posts p WHERE ${conditions.slice(0, -2).join(' AND ') || 'p.tenant_id=$1'}`,
            params.slice(0, -2)
        );

        res.json({ success: true, data: r.rows, total: parseInt(countRes.rows[0].count) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/social/posts/:id/approve — approve and send a pending post
router.post('/posts/:id/approve', authorize('admin'), async (req, res) => {
    try {
        const result = await approvePost(req.params.id, req.user.tenantId);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE /api/social/posts/:id — discard a pending post
router.delete('/posts/:id', authorize('admin'), async (req, res) => {
    try {
        await dbQuery(
            `UPDATE social_media_posts SET status='skipped' WHERE id=$1 AND tenant_id=$2 AND status='pending'`,
            [req.params.id, req.user.tenantId]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── OAuth Redirects ───────────────────────────────────────────────────────────
// LinkedIn OAuth 2.0
router.get('/oauth/linkedin', authorize('admin'), (req, res) => {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
        return res.status(400).json({ success: false, error: 'LINKEDIN_CLIENT_ID not configured' });
    }
    const callbackBase = process.env.SOCIAL_MEDIA_CALLBACK_BASE_URL || process.env.FRONTEND_URL || '';
    const redirectUri  = `${callbackBase}/api/social/oauth/linkedin/callback`;
    const scope        = 'w_member_social r_basicprofile';
    const state        = req.user.tenantId; // pass tenantId through state

    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
    res.redirect(url);
});

router.get('/oauth/linkedin/callback', async (req, res) => {
    const { code, state: tenantId, error } = req.query;
    if (error || !code) {
        return res.redirect(`${process.env.FRONTEND_URL || ''}/?social_error=linkedin_denied`);
    }

    try {
        const clientId     = process.env.LINKEDIN_CLIENT_ID;
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        const callbackBase = process.env.SOCIAL_MEDIA_CALLBACK_BASE_URL || process.env.FRONTEND_URL || '';
        const redirectUri  = `${callbackBase}/api/social/oauth/linkedin/callback`;

        // Exchange code for token
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) throw new Error('No access_token in LinkedIn response');

        // Fetch profile for URN
        const profileRes = await fetch('https://api.linkedin.com/v2/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileRes.json();
        const authorUrn = `urn:li:person:${profile.id}`;
        const displayName = `${profile.localizedFirstName} ${profile.localizedLastName}`.trim();

        // Upsert account
        await dbQuery(
            `INSERT INTO social_media_accounts
                (tenant_id, platform, account_name, access_token, token_expires_at, platform_user_id, is_active, connected_at, updated_at)
             VALUES ($1,'linkedin',$2,$3,$4,$5,true,NOW(),NOW())
             ON CONFLICT (tenant_id, platform) DO UPDATE SET
                account_name=EXCLUDED.account_name, access_token=EXCLUDED.access_token,
                token_expires_at=EXCLUDED.token_expires_at, platform_user_id=EXCLUDED.platform_user_id,
                is_active=true, updated_at=NOW()`,
            [tenantId, displayName, tokenData.access_token,
             new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000),
             authorUrn]
        );

        res.redirect(`${process.env.FRONTEND_URL || ''}/?social_connected=linkedin`);
    } catch (err) {
        console.error('[social/oauth/linkedin/callback]', err.message);
        res.redirect(`${process.env.FRONTEND_URL || ''}/?social_error=${encodeURIComponent(err.message)}`);
    }
});

// Twitter OAuth 2.0
router.get('/oauth/twitter', authorize('admin'), (req, res) => {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) {
        return res.status(400).json({ success: false, error: 'TWITTER_CLIENT_ID not configured' });
    }
    const callbackBase = process.env.SOCIAL_MEDIA_CALLBACK_BASE_URL || process.env.FRONTEND_URL || '';
    const redirectUri  = `${callbackBase}/api/social/oauth/twitter/callback`;

    // PKCE challenge (simplified — in production store code_verifier in session/Redis)
    const codeVerifier  = Buffer.from(Math.random().toString()).toString('base64url');
    const codeChallenge = codeVerifier; // plain method for simplicity

    const url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.write+users.read+offline.access&state=${req.user.tenantId}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
    res.redirect(url);
});

router.get('/oauth/twitter/callback', async (req, res) => {
    const { code, state: tenantId, error } = req.query;
    if (error || !code) {
        return res.redirect(`${process.env.FRONTEND_URL || ''}/?social_error=twitter_denied`);
    }

    try {
        const clientId     = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        const callbackBase = process.env.SOCIAL_MEDIA_CALLBACK_BASE_URL || process.env.FRONTEND_URL || '';
        const redirectUri  = `${callbackBase}/api/social/oauth/twitter/callback`;

        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: code }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) throw new Error('No access_token in Twitter response');

        // Fetch user info
        const userRes = await fetch('https://api.twitter.com/2/users/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userRes.json();
        const handle   = `@${userData.data?.username || 'unknown'}`;

        await dbQuery(
            `INSERT INTO social_media_accounts
                (tenant_id, platform, account_name, access_token, refresh_token, platform_user_id, is_active, connected_at, updated_at)
             VALUES ($1,'twitter',$2,$3,$4,$5,true,NOW(),NOW())
             ON CONFLICT (tenant_id, platform) DO UPDATE SET
                account_name=EXCLUDED.account_name, access_token=EXCLUDED.access_token,
                refresh_token=EXCLUDED.refresh_token, platform_user_id=EXCLUDED.platform_user_id,
                is_active=true, updated_at=NOW()`,
            [tenantId, handle, tokenData.access_token, tokenData.refresh_token || null, userData.data?.id || null]
        );

        res.redirect(`${process.env.FRONTEND_URL || ''}/?social_connected=twitter`);
    } catch (err) {
        console.error('[social/oauth/twitter/callback]', err.message);
        res.redirect(`${process.env.FRONTEND_URL || ''}/?social_error=${encodeURIComponent(err.message)}`);
    }
});

export default router;
