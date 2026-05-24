/**
 * Social Media Service
 * Marketing tool: post job openings and company news/happenings to
 * LinkedIn, Twitter/X, Facebook, and Instagram.
 */

import { query as dbQuery } from '../config/database.js';

// ── Template Renderer ─────────────────────────────────────────────────────────
/**
 * Replaces {variable} placeholders in a template string.
 */
export function renderTemplate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// ── Platform Posting Functions ────────────────────────────────────────────────

/**
 * Post to LinkedIn using UGC Posts API v2.
 * Requires: account.access_token, account.platform_user_id (author URN)
 */
async function postToLinkedIn(account, content) {
    const authorUrn = account.platform_user_id;
    if (!account.access_token || !authorUrn) {
        throw new Error('LinkedIn account missing access_token or platform_user_id (author URN).');
    }

    const payload = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: content },
                shareMediaCategory: 'NONE',
            },
        },
        visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
    };

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${account.access_token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LinkedIn API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return { platformPostId: data.id || null };
}

/**
 * Post to Twitter/X using v2 API.
 * Requires: account.access_token (OAuth 2.0 bearer or user context token)
 */
async function postToTwitter(account, content) {
    if (!account.access_token) throw new Error('Twitter account missing access_token.');

    // Truncate to 280 characters
    const tweet = content.length > 280 ? content.slice(0, 277) + '...' : content;

    const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${account.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: tweet }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Twitter API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return { platformPostId: data.data?.id || null };
}

/**
 * Post to a Facebook Page.
 * Requires: account.access_token (page access token), account.page_id
 */
async function postToFacebook(account, content) {
    if (!account.access_token || !account.page_id) {
        throw new Error('Facebook account missing access_token or page_id.');
    }

    const url = `https://graph.facebook.com/v19.0/${account.page_id}/feed`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, access_token: account.access_token }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Facebook API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return { platformPostId: data.id || null };
}

/**
 * Post to Instagram Business Account via Graph API.
 * Two-step: create media container, then publish.
 * Requires: account.access_token, account.page_id (IG user ID)
 */
async function postToInstagram(account, content) {
    if (!account.access_token || !account.page_id) {
        throw new Error('Instagram account missing access_token or page_id (IG User ID).');
    }

    const igUserId = account.page_id;
    const imageUrl = account.default_image_url || process.env.INSTAGRAM_DEFAULT_IMAGE_URL;
    if (!imageUrl) {
        throw new Error('Instagram posting requires an image URL. Set default_image_url on the account or INSTAGRAM_DEFAULT_IMAGE_URL env var.');
    }

    // Step 1 — create container
    const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: imageUrl,
                caption: content,
                access_token: account.access_token,
            }),
        }
    );

    if (!containerRes.ok) {
        const errText = await containerRes.text();
        throw new Error(`Instagram create container ${containerRes.status}: ${errText}`);
    }

    const { id: containerId } = await containerRes.json();

    // Step 2 — publish container
    const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: containerId, access_token: account.access_token }),
        }
    );

    if (!publishRes.ok) {
        const errText = await publishRes.text();
        throw new Error(`Instagram publish ${publishRes.status}: ${errText}`);
    }

    const data = await publishRes.json();
    return { platformPostId: data.id || null };
}

// ── Platform Router ───────────────────────────────────────────────────────────
async function postToPlatform(platform, account, content) {
    switch (platform) {
        case 'linkedin':   return postToLinkedIn(account, content);
        case 'twitter':    return postToTwitter(account, content);
        case 'facebook':   return postToFacebook(account, content);
        case 'instagram':  return postToInstagram(account, content);
        default: throw new Error(`Unknown platform: ${platform}`);
    }
}

// ── Compose & Send ────────────────────────────────────────────────────────────
/**
 * Manually compose and send (or queue) a marketing post.
 * Called from POST /api/social/blast.
 *
 * @param {string}   tenantId
 * @param {string}   content       - The post body text
 * @param {string[]} platforms     - e.g. ['linkedin', 'twitter']
 * @param {boolean}  autoPost      - true = send immediately, false = queue as pending
 * @param {string}   postType      - 'job_opening' | 'company_news' | 'manual'
 * @param {string}   [postTitle]   - Optional headline / subject
 * @returns {Object} summary of created post records
 */
export async function composeAndSend(tenantId, content, platforms, autoPost, postType = 'manual', postTitle = null) {
    const results = [];

    for (const platform of platforms) {
        // Fetch connected account for this platform
        const acctRes = await dbQuery(
            `SELECT * FROM social_media_accounts
             WHERE tenant_id = $1 AND platform = $2 AND is_active = true`,
            [tenantId, platform]
        );

        if (!acctRes.rows.length) {
            results.push({ platform, status: 'skipped', reason: 'no connected account' });
            continue;
        }

        const account = acctRes.rows[0];

        if (autoPost) {
            let postStatus = 'failed';
            let platformPostId = null;
            let errorMessage = null;
            let postedAt = null;

            try {
                const result = await postToPlatform(platform, account, content);
                platformPostId = result.platformPostId;
                postStatus = 'posted';
                postedAt = new Date();
                console.log(`✅ [socialMedia] Posted to ${platform} (${postType})`);
            } catch (err) {
                errorMessage = err.message;
                console.error(`❌ [socialMedia] Failed to post to ${platform}:`, err.message);
            }

            const insertRes = await dbQuery(
                `INSERT INTO social_media_posts
                 (tenant_id, account_id, platform, content, status, post_type, post_title, platform_post_id, error_message, posted_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 RETURNING id`,
                [tenantId, account.id, platform, content, postStatus, postType, postTitle, platformPostId, errorMessage, postedAt]
            );

            results.push({ platform, status: postStatus, postId: insertRes.rows[0].id, errorMessage });
        } else {
            // Queue as pending — admin approves in Settings → Social Media
            const insertRes = await dbQuery(
                `INSERT INTO social_media_posts
                 (tenant_id, account_id, platform, content, status, post_type, post_title)
                 VALUES ($1,$2,$3,$4,'pending',$5,$6)
                 RETURNING id`,
                [tenantId, account.id, platform, content, postType, postTitle]
            );
            console.log(`📋 [socialMedia] Pending post created for ${platform} (${postType})`);
            results.push({ platform, status: 'pending', postId: insertRes.rows[0].id });
        }
    }

    return results;
}

// ── Approve Pending Post ──────────────────────────────────────────────────────
/**
 * Approves and sends a pending social media post.
 */
export async function approvePost(postId, tenantId) {
    const postRes = await dbQuery(
        `SELECT p.*, a.access_token, a.platform_user_id, a.page_id, a.default_image_url
         FROM social_media_posts p
         JOIN social_media_accounts a ON a.id = p.account_id
         WHERE p.id = $1 AND p.tenant_id = $2 AND p.status = 'pending'`,
        [postId, tenantId]
    );

    if (!postRes.rows.length) throw new Error('Pending post not found');
    const post = postRes.rows[0];

    const account = {
        access_token:      post.access_token,
        platform_user_id:  post.platform_user_id,
        page_id:           post.page_id,
        default_image_url: post.default_image_url,
    };

    try {
        const result = await postToPlatform(post.platform, account, post.content);
        await dbQuery(
            `UPDATE social_media_posts
             SET status='posted', platform_post_id=$1, posted_at=NOW()
             WHERE id=$2`,
            [result.platformPostId, postId]
        );
        return { success: true, platformPostId: result.platformPostId };
    } catch (err) {
        await dbQuery(
            `UPDATE social_media_posts SET status='failed', error_message=$1 WHERE id=$2`,
            [err.message, postId]
        );
        throw err;
    }
}

// ── Test Post ─────────────────────────────────────────────────────────────────
/**
 * Send a test post to a connected account.
 */
export async function sendTestPost(accountId, tenantId) {
    const acctRes = await dbQuery(
        `SELECT * FROM social_media_accounts WHERE id=$1 AND tenant_id=$2`,
        [accountId, tenantId]
    );
    if (!acctRes.rows.length) throw new Error('Account not found');
    const account = acctRes.rows[0];

    const testContent = `🚁 CoatzaDrone — our social media integration is live! Follow us for drone inspection updates, job openings, and industry news. #CoatzaDrone #DroneInspection #Hiring`;
    return postToPlatform(account.platform, account, testContent);
}
