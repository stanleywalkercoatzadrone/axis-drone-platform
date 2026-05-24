import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialAccount {
  id: string;
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram';
  account_name: string;
  has_token: boolean;
  is_active: boolean;
}

type PostType = 'job_opening' | 'company_news' | 'manual';
type TriggerType = 'job_opening' | 'company_news' | 'manual';

interface SocialTemplate {
  id: string;
  name: string;
  trigger: TriggerType;
  platforms: string[];
  template: string;
  auto_post: boolean;
  is_active: boolean;
}

interface SocialPost {
  id: string;
  created_at: string;
  post_title?: string;
  post_type?: PostType;
  platform: string;
  status: 'posted' | 'pending' | 'failed' | 'skipped';
  content: string;
  error_message?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type PlatformKey = 'linkedin' | 'twitter' | 'facebook' | 'instagram';

interface PlatformMeta {
  icon: string;
  label: string;
  color: string;
  maxChars: number;
  guide: string;
  oauth?: string;
  hasCredentialForm: boolean;
}

const PLATFORMS: Record<PlatformKey, PlatformMeta> = {
  linkedin: {
    icon: '🔗',
    label: 'LinkedIn',
    color: 'bg-blue-700',
    maxChars: 3000,
    guide: 'Connect via OAuth. Required scopes: w_member_social, r_basicprofile.',
    oauth: '/api/social/oauth/linkedin',
    hasCredentialForm: false,
  },
  twitter: {
    icon: '𝕏',
    label: 'Twitter / X',
    color: 'bg-slate-700',
    maxChars: 280,
    guide: 'Connect via OAuth. Required: tweet.write permission.',
    oauth: '/api/social/oauth/twitter',
    hasCredentialForm: false,
  },
  facebook: {
    icon: '📘',
    label: 'Facebook',
    color: 'bg-blue-800',
    maxChars: 2000,
    guide: 'Enter a Page Access Token from Meta for Developers. Required: pages_manage_posts.',
    hasCredentialForm: true,
  },
  instagram: {
    icon: '📸',
    label: 'Instagram',
    color: 'bg-gradient-to-r from-purple-700 to-pink-700',
    maxChars: 2200,
    guide: 'Enter your IG User ID and access token from Meta for Developers.',
    hasCredentialForm: true,
  },
};

const PLATFORM_ORDER: PlatformKey[] = ['linkedin', 'twitter', 'facebook', 'instagram'];

const POST_TYPES: { value: PostType; label: string; emoji: string; description: string }[] = [
  { value: 'job_opening', label: 'Job Opening', emoji: '💼', description: 'Hiring announcement' },
  { value: 'company_news', label: 'Company News', emoji: '📢', description: 'Updates & milestones' },
  { value: 'manual', label: 'General Post', emoji: '✍️', description: 'Free-form marketing' },
];

const JOB_VARIABLES = ['title', 'location', 'pay_range', 'experience', 'apply_url', 'company', 'department'];
const NEWS_VARIABLES = ['headline', 'detail', 'date', 'location', 'company', 'link'];
const ALL_VARIABLES = [...new Set([...JOB_VARIABLES, ...NEWS_VARIABLES])];

const TRIGGER_GROUPS: { key: TriggerType; label: string; emoji: string }[] = [
  { key: 'job_opening', label: 'Job Opening Templates', emoji: '💼' },
  { key: 'company_news', label: 'Company News Templates', emoji: '📢' },
  { key: 'manual', label: 'General Templates', emoji: '✍️' },
];

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors';
const selectClass = 'bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-blue-600' : 'bg-slate-600'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${on ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ─── Compose & Blast Tab ──────────────────────────────────────────────────────

interface ComposeTabProps {
  initialContent?: string;
  onBlasted?: () => void;
}

function ComposeTab({ initialContent = '', onBlasted }: ComposeTabProps) {
  const [content, setContent] = useState(initialContent);
  const [postTitle, setPostTitle] = useState('');
  const [postType, setPostType] = useState<PostType>('job_opening');
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>(['linkedin']);
  const [autoPost, setAutoPost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; details?: { platform: string; status: string }[] } | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setContent(initialContent); }, [initialContent]);

  useEffect(() => {
    apiClient.get('/social/accounts')
      .then(res => setAccounts((res.data as { data?: SocialAccount[] }).data ?? []))
      .catch(() => {});
  }, []);

  const getAccount = (p: PlatformKey) => accounts.find(a => a.platform === p && a.is_active && a.has_token);

  const togglePlatform = (p: PlatformKey) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const twitterSelected = selectedPlatforms.includes('twitter');
  const overTwitterLimit = twitterSelected && content.length > 280;
  const charWarning = twitterSelected
    ? content.length > 280
      ? `Twitter limit exceeded by ${content.length - 280} chars`
      : `Twitter: ${content.length}/280`
    : null;

  const submit = async (override_auto_post?: boolean) => {
    if (!content.trim()) { setResult({ ok: false, msg: 'Please write some content first.' }); return; }
    if (!selectedPlatforms.length) { setResult({ ok: false, msg: 'Select at least one platform.' }); return; }

    const ap = override_auto_post ?? autoPost;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await apiClient.post('/social/blast', {
        content: content.trim(),
        platforms: selectedPlatforms,
        auto_post: ap,
        post_type: postType,
        post_title: postTitle.trim() || null,
      });
      const data = res.data as { success: boolean; data?: { platform: string; status: string }[] };
      const posted = data.data?.filter(r => r.status === 'posted').length ?? 0;
      const pending = data.data?.filter(r => r.status === 'pending').length ?? 0;
      const failed = data.data?.filter(r => r.status === 'failed').length ?? 0;
      const skipped = data.data?.filter(r => r.status === 'skipped').length ?? 0;

      let msg = '';
      if (ap) {
        msg = `${posted} posted${failed ? `, ${failed} failed` : ''}${skipped ? `, ${skipped} skipped (no connected account)` : ''}.`;
      } else {
        msg = `${pending} post${pending !== 1 ? 's' : ''} queued for approval${skipped ? `, ${skipped} skipped` : ''}.`;
      }

      setResult({ ok: posted > 0 || pending > 0, msg, details: data.data });
      if (posted > 0 || pending > 0) {
        setContent('');
        setPostTitle('');
        onBlasted?.();
      }
    } catch (e: unknown) {
      const err = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong.';
      setResult({ ok: false, msg: err });
    } finally {
      setSubmitting(false);
    }
  };

  const platformsWithNoAccount = selectedPlatforms.filter(p => !getAccount(p));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-sm text-blue-300 font-medium">📣 Compose a post and send it to your connected social media accounts — share job openings, company news, or marketing content to grow your brand.</p>
      </div>

      {/* Post Type */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Post Type</label>
        <div className="grid grid-cols-3 gap-2">
          {POST_TYPES.map(pt => (
            <button
              key={pt.value}
              onClick={() => setPostType(pt.value)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all text-center ${
                postType === pt.value
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="text-xl">{pt.emoji}</span>
              <span className="text-xs font-semibold">{pt.label}</span>
              <span className="text-[10px] text-slate-500">{pt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Title / Headline */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          {postType === 'job_opening' ? 'Job Title / Role' : 'Headline (optional)'}
        </label>
        <input
          value={postTitle}
          onChange={e => setPostTitle(e.target.value)}
          placeholder={postType === 'job_opening' ? 'e.g. Senior Drone Pilot — Phoenix, AZ' : 'e.g. We hit 500 missions!'}
          className={inputClass}
        />
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Post Content</label>
          <span className={`text-xs ${overTwitterLimit ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
            {charWarning ?? `${content.length} chars`}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={
            postType === 'job_opening'
              ? '💼 We\'re hiring!\n\nWe\'re looking for a skilled drone pilot to join our growing team...\n\n📍 Location\n💰 Pay range\n✅ How to apply'
              : postType === 'company_news'
              ? '📢 Exciting news from CoatzaDrone!\n\n...'
              : 'Write your post content here…'
          }
          rows={7}
          className={`${inputClass} resize-none`}
        />
        {overTwitterLimit && (
          <p className="text-xs text-red-400 mt-1">⚠️ Content exceeds Twitter's 280-character limit. It will be truncated automatically.</p>
        )}
        {/* Variable quick-insert for job openings */}
        {postType !== 'manual' && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs text-slate-500">Insert variable:</span>
            {(postType === 'job_opening' ? JOB_VARIABLES : NEWS_VARIABLES).map(v => (
              <button
                key={v}
                onClick={() => {
                  const ta = textareaRef.current;
                  if (!ta) return;
                  const s = ta.selectionStart;
                  const e = ta.selectionEnd;
                  setContent(prev => prev.slice(0, s) + `{${v}}` + prev.slice(e));
                }}
                className="text-xs px-2 py-0.5 rounded-full bg-slate-700 hover:bg-blue-600/30 text-blue-400 border border-slate-600 hover:border-blue-500 transition-colors"
              >
                {'{' + v + '}'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Platform Selection */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Post to Platforms</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PLATFORM_ORDER.map(p => {
            const meta = PLATFORMS[p];
            const account = getAccount(p);
            const selected = selectedPlatforms.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                  selected
                    ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span>{meta.icon}</span>
                <span className="font-medium">{meta.label}</span>
                {!account && (
                  <span title="Not connected" className="ml-auto w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" />
                )}
                {account && (
                  <span title="Connected" className="ml-auto w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
        {platformsWithNoAccount.length > 0 && (
          <p className="text-xs text-amber-400 mt-1.5">
            ⚠️ {platformsWithNoAccount.map(p => PLATFORMS[p].label).join(', ')} {platformsWithNoAccount.length === 1 ? 'is' : 'are'} not connected — go to Connected Accounts to set up.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-slate-700">
        <button
          onClick={() => submit(true)}
          disabled={submitting || !content.trim() || !selectedPlatforms.length}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
        >
          {submitting ? '⏳ Posting…' : '🚀 Post Now'}
        </button>
        <button
          onClick={() => submit(false)}
          disabled={submitting || !content.trim() || !selectedPlatforms.length}
          className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold border border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '⏳ Saving…' : '📋 Queue for Approval'}
        </button>
        <p className="text-xs text-slate-500 sm:ml-auto">
          "Post Now" sends immediately. "Queue" lets you review first in Post History.
        </p>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {result.ok ? '✅' : '❌'} {result.msg}
          {result.details && (
            <div className="flex flex-wrap gap-2 mt-2">
              {result.details.map(d => (
                <span key={d.platform} className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                  d.status === 'posted' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
                  d.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' :
                  d.status === 'failed'  ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                  'bg-slate-700 border-slate-600 text-slate-400'
                }`}>
                  {d.platform}: {d.status}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: SocialTemplate;
  isNew?: boolean;
  onSaved: () => void;
  onDeleted: () => void;
  onUse: (content: string) => void;
}

function TemplateCard({ template, isNew = false, onSaved, onDeleted, onUse }: TemplateCardProps) {
  const [name, setName] = useState(template.name);
  const [platforms, setPlatforms] = useState<string[]>(template.platforms);
  const [content, setContent] = useState(template.template);
  const [isActive, setIsActive] = useState(template.is_active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const variables = template.trigger === 'job_opening' ? JOB_VARIABLES : template.trigger === 'company_news' ? NEWS_VARIABLES : ALL_VARIABLES;

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const insertVariable = (variable: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newContent = content.slice(0, start) + `{${variable}}` + content.slice(end);
    setContent(newContent);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + variable.length + 2; ta.focus(); }, 0);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { name, trigger: template.trigger, platforms, template: content, auto_post: false, is_active: isActive };
      if (isNew) {
        await apiClient.post('/social/templates', body);
      } else {
        await apiClient.put(`/social/templates/${template.id}`, body);
      }
      setEditing(false);
      onSaved();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm('Delete this template?')) return;
    setDeleting(true);
    try {
      if (!isNew) await apiClient.delete(`/social/templates/${template.id}`);
      onDeleted();
    } catch { /* ignore */ } finally { setDeleting(false); }
  };

  if (!editing) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 group hover:border-slate-600 transition-all">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold text-slate-200">{name || 'Untitled'}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {platforms.map(p => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-400 capitalize">{p}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Edit</button>
            <button onClick={del} disabled={deleting} className="text-xs px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors">{deleting ? '…' : 'Delete'}</button>
          </div>
        </div>
        <p className="text-xs text-slate-500 line-clamp-3 mb-3">{content || <em>No content yet</em>}</p>
        <button
          onClick={() => onUse(content)}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors w-full text-center font-medium"
        >
          ↗ Use Template
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-blue-500/40 p-4 space-y-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Template name"
        className={inputClass}
      />

      <div className="flex flex-wrap gap-3">
        {(['linkedin', 'twitter', 'facebook', 'instagram'] as const).map(p => (
          <label key={p} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} className="accent-blue-500" />
            {PLATFORMS[p].label}
          </label>
        ))}
      </div>

      <div className="space-y-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Template content — use {variables} for dynamic values…"
          rows={5}
          className={`${inputClass} resize-none`}
        />
        <div className="flex flex-wrap gap-1.5">
          {variables.map(v => (
            <button
              key={v}
              onClick={() => insertVariable(v)}
              className="text-xs px-2 py-0.5 rounded-full bg-slate-700 hover:bg-blue-600/30 text-blue-400 border border-slate-600 hover:border-blue-500 transition-colors"
            >
              {'{' + v + '}'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">Active</span>
        <Toggle on={isActive} onChange={() => setIsActive(a => !a)} />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Template'}
        </button>
        {!isNew && (
          <button onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
            Cancel
          </button>
        )}
        <button onClick={del} disabled={deleting} className="text-sm px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors ml-auto disabled:opacity-50">
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

const blankTemplate = (trigger: TriggerType): SocialTemplate => ({
  id: '', name: '', trigger, platforms: [], template: '', auto_post: false, is_active: true,
});

// ─── Job Templates Tab ────────────────────────────────────────────────────────

interface TemplatesTabProps {
  onUseTemplate: (content: string) => void;
}

function TemplatesTab({ onUseTemplate }: TemplatesTabProps) {
  const [templates, setTemplates] = useState<SocialTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCards, setNewCards] = useState<Partial<Record<TriggerType, SocialTemplate[]>>>({});

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiClient.get('/social/templates');
      setTemplates((res.data as { data?: SocialTemplate[] }).data ?? []);
    } catch { /* silently fail */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const addNew = (trigger: TriggerType) => {
    setNewCards(prev => ({ ...prev, [trigger]: [...(prev[trigger] ?? []), blankTemplate(trigger)] }));
  };

  const removeNew = (trigger: TriggerType, idx: number) => {
    setNewCards(prev => {
      const arr = [...(prev[trigger] ?? [])];
      arr.splice(idx, 1);
      return { ...prev, [trigger]: arr };
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading templates…</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-400">
        <p>Create reusable templates for job postings and company news. Click <strong className="text-slate-200">↗ Use Template</strong> to load it into Compose & Blast and then tweak before sending.</p>
      </div>

      {TRIGGER_GROUPS.map(({ key, label, emoji }) => {
        const group = templates.filter(t => t.trigger === key);
        const extras = newCards[key] ?? [];
        return (
          <div key={key} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span>{emoji}</span> {label}
              </h3>
              <button
                onClick={() => addNew(key)}
                className="text-sm px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors border border-slate-600"
              >
                + New
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onSaved={fetchTemplates}
                  onDeleted={fetchTemplates}
                  onUse={onUseTemplate}
                />
              ))}
              {extras.map((t, idx) => (
                <TemplateCard
                  key={`new-${key}-${idx}`}
                  template={t}
                  isNew
                  onSaved={() => { removeNew(key, idx); fetchTemplates(); }}
                  onDeleted={() => removeNew(key, idx)}
                  onUse={onUseTemplate}
                />
              ))}
              {group.length === 0 && extras.length === 0 && (
                <p className="text-sm text-slate-500 col-span-2 py-4 text-center border border-dashed border-slate-700 rounded-xl">
                  No templates yet — click <strong>+ New</strong> to create one.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Connected Accounts Tab ───────────────────────────────────────────────────

interface CredentialForm { access_token: string; page_id: string; account_name: string; }
const defaultCred = (): CredentialForm => ({ access_token: '', page_id: '', account_name: '' });

function AccountsTab() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [testMessages, setTestMessages] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [expandedForms, setExpandedForms] = useState<Partial<Record<PlatformKey, boolean>>>({});
  const [credForms, setCredForms] = useState<Partial<Record<PlatformKey, CredentialForm>>>({});
  const [savingCred, setSavingCred] = useState<Partial<Record<PlatformKey, boolean>>>({});

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/social/accounts');
      setAccounts((res.data as { data?: SocialAccount[] }).data ?? []);
    } catch { /* silently fail */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const getAccount = (platform: PlatformKey) => accounts.find(a => a.platform === platform);

  const sendTest = async (account: SocialAccount) => {
    try {
      await apiClient.post('/social/test', { accountId: account.id });
      setTestMessages(m => ({ ...m, [account.platform]: { ok: true, msg: 'Test post sent! Check your feed.' } }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Test post failed.';
      setTestMessages(m => ({ ...m, [account.platform]: { ok: false, msg } }));
    }
  };

  const disconnect = async (account: SocialAccount) => {
    if (!confirm(`Disconnect ${PLATFORMS[account.platform].label}?`)) return;
    try {
      await apiClient.delete(`/social/accounts/${account.id}`);
      fetchAccounts();
    } catch { /* ignore */ }
  };

  const toggleForm = (platform: PlatformKey) => {
    setExpandedForms(f => ({ ...f, [platform]: !f[platform] }));
    setCredForms(f => ({ ...f, [platform]: f[platform] ?? defaultCred() }));
  };

  const updateCred = (platform: PlatformKey, field: keyof CredentialForm, value: string) => {
    setCredForms(f => ({ ...f, [platform]: { ...(f[platform] ?? defaultCred()), [field]: value } }));
  };

  const submitCred = async (platform: PlatformKey) => {
    const form = credForms[platform];
    if (!form) return;
    setSavingCred(s => ({ ...s, [platform]: true }));
    try {
      await apiClient.post('/social/accounts', { platform, ...form });
      setExpandedForms(f => ({ ...f, [platform]: false }));
      fetchAccounts();
    } catch { /* ignore */ } finally { setSavingCred(s => ({ ...s, [platform]: false })); }
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading accounts…</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Connect your company's social media accounts to enable posting from this platform.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORM_ORDER.map(platform => {
          const meta = PLATFORMS[platform];
          const account = getAccount(platform);
          const connected = !!account?.has_token;
          const testMsg = testMessages[platform];
          const formOpen = expandedForms[platform];
          const cred = credForms[platform] ?? defaultCred();

          return (
            <div key={platform} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className={`${meta.color} px-4 py-3 flex items-center gap-2`}>
                <span className="text-lg">{meta.icon}</span>
                <span className="font-semibold text-white text-sm">{meta.label}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'}`}>
                  {connected ? '● Connected' : '○ Not connected'}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {connected ? (
                  <>
                    <p className="text-sm text-slate-300 font-medium">{account!.account_name}</p>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => sendTest(account!)} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                        Send Test Post
                      </button>
                      <button onClick={() => disconnect(account!)} className="text-sm px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors">
                        Disconnect
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 leading-relaxed">{meta.guide}</p>
                    {meta.hasCredentialForm ? (
                      <>
                        <button onClick={() => toggleForm(platform)} className="text-sm px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors border border-slate-600">
                          {formOpen ? 'Cancel' : 'Enter Credentials'}
                        </button>
                        {formOpen && (
                          <div className="space-y-2 pt-1">
                            <textarea value={cred.access_token} onChange={e => updateCred(platform, 'access_token', e.target.value)} placeholder="Access Token" rows={2} className={`${inputClass} resize-none`} />
                            <input value={cred.page_id} onChange={e => updateCred(platform, 'page_id', e.target.value)} placeholder="Page ID" className={inputClass} />
                            <input value={cred.account_name} onChange={e => updateCred(platform, 'account_name', e.target.value)} placeholder="Account Name (display label)" className={inputClass} />
                            <button onClick={() => submitCred(platform)} disabled={savingCred[platform]} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
                              {savingCred[platform] ? 'Saving…' : 'Save & Connect'}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <button onClick={() => { window.location.href = meta.oauth!; }} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                        Connect via OAuth →
                      </button>
                    )}
                  </>
                )}
                {testMsg && (
                  <p className={`text-xs mt-1 ${testMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{testMsg.msg}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Post History Tab ─────────────────────────────────────────────────────────

const POST_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  job_opening:  { label: 'Job',  color: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  company_news: { label: 'News', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  manual:       { label: 'Post', color: 'bg-slate-700 text-slate-300 border-slate-600' },
};

function HistoryTab() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/social/posts');
      setPosts((res.data as { data?: SocialPost[] }).data ?? []);
    } catch { /* silently fail */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const approve = async (postId: string) => {
    try { await apiClient.post(`/social/posts/${postId}/approve`, {}); fetchPosts(); } catch { /* ignore */ }
  };

  const discard = async (postId: string) => {
    try { await apiClient.delete(`/social/posts/${postId}`); fetchPosts(); } catch { /* ignore */ }
  };

  const filtered = posts.filter(p => {
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (typeFilter !== 'all' && p.post_type !== typeFilter) return false;
    return true;
  });

  const statusBadge = (post: SocialPost) => {
    switch (post.status) {
      case 'posted':
        return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✅ Posted</span>;
      case 'pending':
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">⏳ Pending</span>
            <div className="flex gap-1">
              <button onClick={() => approve(post.id)} className="text-xs px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors">Approve</button>
              <button onClick={() => discard(post.id)} className="text-xs px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors">Discard</button>
            </div>
          </div>
        );
      case 'failed':
        return (
          <div title={post.error_message ?? ''} className="cursor-help">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">❌ Failed</span>
          </div>
        );
      case 'skipped':
        return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">⏭ Skipped</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className={selectClass}>
          <option value="all">All Platforms</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter / X</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectClass}>
          <option value="all">All Types</option>
          <option value="job_opening">Job Openings</option>
          <option value="company_news">Company News</option>
          <option value="manual">General</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="posted">Posted</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <button onClick={fetchPosts} className="text-sm px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors border border-slate-600 ml-auto">
          ↺ Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading posts…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm gap-3 border border-dashed border-slate-700 rounded-xl">
          <span className="text-4xl">📣</span>
          <span>No posts yet. Compose your first post in the <strong className="text-slate-300">Compose & Blast</strong> tab.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr>
                {['Date', 'Type', 'Title', 'Platform', 'Status', 'Content'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map(post => {
                const typeMeta = POST_TYPE_LABEL[post.post_type ?? 'manual'] ?? POST_TYPE_LABEL.manual;
                return (
                  <tr key={post.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      {new Date(post.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${typeMeta.color}`}>{typeMeta.label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap max-w-[140px] truncate" title={post.post_title ?? ''}>
                      {post.post_title ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600 capitalize">{post.platform}</span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(post)}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate text-xs" title={post.content}>
                      {post.content.length > 80 ? post.content.slice(0, 80) + '…' : post.content}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabKey = 'compose' | 'templates' | 'accounts' | 'history';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'compose',   label: 'Compose & Blast', emoji: '✍️' },
  { key: 'templates', label: 'Templates',        emoji: '📋' },
  { key: 'accounts',  label: 'Connected Accounts', emoji: '🔗' },
  { key: 'history',   label: 'Post History',     emoji: '📜' },
];

export default function SocialMediaSettings() {
  const [activeTab, setActiveTab] = useState<TabKey>('compose');
  const [pendingTemplateContent, setPendingTemplateContent] = useState<string | undefined>(undefined);

  const handleUseTemplate = (content: string) => {
    setPendingTemplateContent(content);
    setActiveTab('compose');
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 min-h-full p-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          📣 Social Media Marketing
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Post job openings and company news to LinkedIn, Twitter/X, Facebook, and Instagram to grow your brand.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-colors flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <span>{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'compose' && (
        <ComposeTab
          initialContent={pendingTemplateContent}
          onBlasted={() => { setPendingTemplateContent(undefined); }}
        />
      )}
      {activeTab === 'templates' && <TemplatesTab onUseTemplate={handleUseTemplate} />}
      {activeTab === 'accounts' && <AccountsTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}
