/**
 * MarketingHub.tsx — Marketing & Outreach Center
 * Campaign email composition, live HTML preview, leads management, outreach logging
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Users, Tag, Building2, Send, Search, Plus, Trash2, Edit3, Eye, X,
  Megaphone, ChevronDown, RefreshCw, Download, Upload, Filter,
  CheckCircle2, Clock, AlertCircle, ExternalLink, Copy, BarChart3,
  Loader2, Globe, Phone, MapPin, FileText, Zap, Shield, Radio, Sun,
  HardHat, TrendingUp, Star, MoreVertical,
} from 'lucide-react';

// ── API helpers ──────────────────────────────────────────────────────────────
const API_BASE = '/api/marketing';
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  industry: string;
  sub_category: string;
  location: string;
  state: string;
  status: string;
  lead_type: string;
  discount_code: string;
  discount_percent: number;
  notes: string;
  tags: string[];
  last_contacted_at: string;
  created_at: string;
  updated_at: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: string;
  variables: string[];
}

interface OutreachLog {
  id: string;
  lead_id: string;
  template_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body_html: string;
  status: string;
  sent_at: string;
  opened_at: string;
  error_message: string;
  company_name?: string;
}

interface Stats {
  totalLeads: number;
  byIndustry: Record<string, number>;
  byStatus: Record<string, number>;
  totalSent: number;
  totalSimulated: number;
  totalOpened: number;
}

// ── Industry config ──────────────────────────────────────────────────────────
const INDUSTRIES = [
  { key: 'solar', label: 'Solar', icon: <Sun size={14} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'insurance', label: 'Insurance', icon: <Shield size={14} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  { key: 'construction', label: 'Construction', icon: <HardHat size={14} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { key: 'telecom', label: 'Telecom', icon: <Radio size={14} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
];

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  new:           { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', label: 'New' },
  contacted:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Contacted' },
  interested:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Interested' },
  proposal_sent: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'Proposal Sent' },
  converted:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Converted' },
  lost:          { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Lost' },
};

// ── Sub-tab type ─────────────────────────────────────────────────────────────
type SubTab = 'emailer' | 'leads' | 'partners' | 'logs';

// ── Main Component ───────────────────────────────────────────────────────────
export default function MarketingHub() {
  const [activeTab, setActiveTab] = useState<SubTab>('emailer');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Emailer state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState<'visual' | 'html'>('visual');

  // Leads management state
  const [leadSearch, setLeadSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, templatesRes, logsRes, statsRes] = await Promise.allSettled([
        apiFetch('/leads'),
        apiFetch('/templates'),
        apiFetch('/logs?limit=100'),
        apiFetch('/stats'),
      ]);
      if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data || []);
      if (templatesRes.status === 'fulfilled') setTemplates(templatesRes.value.data || []);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data || []);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || null);
    } catch (err) {
      console.error('[MarketingHub] Load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  // ── Template variable interpolation ────────────────────────────────────────
  const interpolate = (text: string, lead: Lead | null) => {
    if (!lead) return text;
    return text
      .replace(/\{\{company_name\}\}/g, lead.company_name || '')
      .replace(/\{\{contact_name\}\}/g, lead.contact_name || 'there')
      .replace(/\{\{contact_email\}\}/g, lead.contact_email || '')
      .replace(/\{\{industry\}\}/g, lead.industry || '')
      .replace(/\{\{location\}\}/g, lead.location || '')
      .replace(/\{\{state\}\}/g, lead.state || '');
  };

  // ── Select template handler ────────────────────────────────────────────────
  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setEmailSubject(interpolate(t.subject, selectedLead));
    setEmailBody(interpolate(t.body_html, selectedLead));
  };

  // ── Select lead handler ────────────────────────────────────────────────────
  const handleSelectLead = (l: Lead) => {
    setSelectedLead(l);
    if (selectedTemplate) {
      setEmailSubject(interpolate(selectedTemplate.subject, l));
      setEmailBody(interpolate(selectedTemplate.body_html, l));
    }
  };

  // ── Send email ─────────────────────────────────────────────────────────────
  const handleSend = async (simulate: boolean) => {
    if (!selectedLead?.contact_email || !emailSubject) {
      setToast({ ok: false, msg: 'Select a recipient and enter a subject' });
      return;
    }
    setSending(true);
    try {
      await apiFetch('/send', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          templateId: selectedTemplate?.id,
          subject: emailSubject,
          bodyHtml: emailBody,
          simulate,
        }),
      });
      setToast({ ok: true, msg: simulate ? 'Simulated send logged' : 'Email sent successfully!' });
      loadData();
    } catch (err: any) {
      setToast({ ok: false, msg: err.message || 'Send failed' });
    }
    setSending(false);
  };

  // ── Lead CRUD ──────────────────────────────────────────────────────────────
  const handleSaveLead = async () => {
    if (!editingLead?.company_name || !editingLead?.industry) {
      setToast({ ok: false, msg: 'Company name and industry are required' });
      return;
    }
    try {
      if (editingLead.id) {
        await apiFetch(`/leads/${editingLead.id}`, { method: 'PUT', body: JSON.stringify(editingLead) });
        setToast({ ok: true, msg: 'Lead updated' });
      } else {
        await apiFetch('/leads', { method: 'POST', body: JSON.stringify(editingLead) });
        setToast({ ok: true, msg: 'Lead created' });
      }
      setShowLeadForm(false);
      setEditingLead(null);
      loadData();
    } catch (err: any) {
      setToast({ ok: false, msg: err.message });
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    try {
      await apiFetch(`/leads/${id}`, { method: 'DELETE' });
      setToast({ ok: true, msg: 'Lead deleted' });
      loadData();
    } catch (err: any) {
      setToast({ ok: false, msg: err.message });
    }
  };

  // ── Filtered leads ─────────────────────────────────────────────────────────
  const filteredLeads = leads.filter(l => {
    if (industryFilter !== 'all' && l.industry !== industryFilter) return false;
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (leadSearch) {
      const s = leadSearch.toLowerCase();
      return (l.company_name || '').toLowerCase().includes(s) ||
        (l.contact_name || '').toLowerCase().includes(s) ||
        (l.contact_email || '').toLowerCase().includes(s) ||
        (l.location || '').toLowerCase().includes(s);
    }
    return true;
  });

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 };
  const input = { width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' };
  const select = { ...input, cursor: 'pointer' };

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabs: { key: SubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'emailer', label: 'Campaign Emailer', icon: <Mail size={14} /> },
    { key: 'leads', label: 'Leads & Prospects', icon: <Users size={14} />, badge: leads.length },
    { key: 'partners', label: 'Partners', icon: <Tag size={14} />, badge: leads.filter(l => l.lead_type === 'partner').length },
    { key: 'logs', label: 'Outreach Logs', icon: <FileText size={14} />, badge: logs.length },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10000,
          padding: '12px 20px', borderRadius: 10,
          background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: toast.ok ? '#34d399' : '#f87171',
          fontSize: 13, fontWeight: 700, backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Megaphone size={20} color="#06b6d4" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: 0 }}>Marketing & Outreach Center</h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0, fontWeight: 500 }}>
              Generate campaigns, manage leads, and grow CoatzaDrone's client base
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {INDUSTRIES.map(ind => (
            <div key={ind.key} style={{
              ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              borderLeft: `3px solid ${ind.color}`,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: ind.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ind.color }}>
                {ind.icon}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>{stats.byIndustry?.[ind.key] || 0}</div>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{ind.label}</div>
              </div>
            </div>
          ))}
          <div style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid #06b6d4' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
              <Send size={14} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>{stats.totalSent || 0}</div>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Emails Sent</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub Tabs ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'rgba(15,23,42,0.4)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === t.key ? 'rgba(6,182,212,0.12)' : 'transparent',
            color: activeTab === t.key ? '#06b6d4' : '#64748b',
            fontSize: 12, fontWeight: activeTab === t.key ? 800 : 600,
            transition: 'all 0.2s',
          }}>
            {t.icon} {t.label}
            {t.badge != null && t.badge > 0 && (
              <span style={{
                padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                background: activeTab === t.key ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)',
                color: activeTab === t.key ? '#06b6d4' : '#475569',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '60px 0', color: '#475569', fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading marketing data…
        </div>
      )}

      {!loading && activeTab === 'emailer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* ── LEFT: Outreach Composer ── */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Mail size={16} color="#06b6d4" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Outreach Composer</span>
            </div>

            {/* Recipient */}
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Select Target Recipient</label>
            <select value={selectedLead?.id || ''} onChange={e => {
              const l = leads.find(x => x.id === e.target.value);
              if (l) handleSelectLead(l);
            }} style={{ ...select, marginBottom: 12 }}>
              <option value="">— Choose Recipient —</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.company_name} {l.contact_name ? `(${l.contact_name})` : ''} — {l.industry}</option>
              ))}
            </select>

            {/* Template */}
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Campaign Template</label>
            <select value={selectedTemplate?.id || ''} onChange={e => {
              const t = templates.find(x => x.id === e.target.value);
              if (t) handleSelectTemplate(t);
            }} style={{ ...select, marginBottom: 12 }}>
              <option value="">— Choose Template —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Subject */}
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Subject Line</label>
            <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Enter email subject..."
              style={{ ...input, marginBottom: 12 }} />

            {/* Body */}
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Email Body</label>
            <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
              placeholder="Select a recipient and template to prefill the outreach email..."
              style={{ ...input, minHeight: 200, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 16 }} />

            {/* Send buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleSend(false)} disabled={sending || !selectedLead}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 10, border: 'none', cursor: sending ? 'wait' : 'pointer',
                  background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff',
                  fontSize: 13, fontWeight: 800, opacity: sending || !selectedLead ? 0.5 : 1,
                }}>
                <Send size={14} /> {sending ? 'Sending…' : 'Send Outreach Email'}
              </button>
              <button onClick={() => handleSend(true)} disabled={sending || !selectedLead}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)',
                  background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, opacity: sending || !selectedLead ? 0.5 : 1,
                }}>
                <Zap size={13} /> Simulate
              </button>
            </div>
          </div>

          {/* ── RIGHT: Live Preview ── */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {previewMode === 'visual' ? '📧 Visual Live Preview' : '</> HTML Source'}
              </span>
              <button onClick={() => setPreviewMode(m => m === 'visual' ? 'html' : 'visual')}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.3)',
                  background: 'rgba(139,92,246,0.08)', color: '#a78bfa', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}>
                {previewMode === 'visual' ? '</> HTML' : '👁 Visual'}
              </button>
            </div>

            {/* Email metadata */}
            <div style={{ background: '#fff', borderRadius: 8, padding: 16, color: '#1e293b', fontSize: 13, lineHeight: 1.8 }}>
              <div><strong>From:</strong> CoatzaDrone USA &lt;outreach@coatzadroneusa.com&gt;</div>
              <div><strong>To:</strong> {selectedLead ? `${selectedLead.contact_name || selectedLead.company_name} <${selectedLead.contact_email}>` : '(No recipient chosen)'}</div>
              <div><strong>Subject:</strong> {emailSubject || '(No subject)'}</div>
              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />

              {previewMode === 'visual' ? (
                <div dangerouslySetInnerHTML={{ __html: emailBody || '<p style="color:#94a3b8;font-style:italic;">Select a template to preview the email content.</p>' }} />
              ) : (
                <pre style={{ fontSize: 11, color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', maxHeight: 400, overflow: 'auto' }}>
                  {emailBody || '<!-- No content -->'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LEADS TAB ── */}
      {!loading && activeTab === 'leads' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Search leads..."
                style={{ ...input, paddingLeft: 32 }} />
            </div>
            <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} style={{ ...select, width: 140 }}>
              <option value="all">All Industries</option>
              {INDUSTRIES.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...select, width: 140 }}>
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => { setEditingLead({ industry: 'solar', status: 'new', lead_type: 'prospect' }); setShowLeadForm(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}>
              <Plus size={13} /> Add Lead
            </button>
            <button onClick={loadData} style={{ padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Count */}
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
            {filteredLeads.length} of {leads.length} leads
          </div>

          {/* Lead table */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Company', 'Contact', 'Industry', 'Location', 'Status', 'Last Contact', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(l => {
                    const ind = INDUSTRIES.find(i => i.key === l.industry);
                    const st = STATUS_COLORS[l.status] || STATUS_COLORS.new;
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                        onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{l.company_name}</div>
                          {l.sub_category && <div style={{ fontSize: 10, color: '#64748b' }}>{l.sub_category}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ color: '#cbd5e1' }}>{l.contact_name || '—'}</div>
                          {l.contact_email && <div style={{ fontSize: 10, color: '#475569' }}>{l.contact_email}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: ind?.bg, color: ind?.color }}>
                            {ind?.icon} {ind?.label || l.industry}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                          {l.location}{l.state ? `, ${l.state}` : ''}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11 }}>
                          {l.last_contacted_at ? new Date(l.last_contacted_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { handleSelectLead(l); setActiveTab('emailer'); }}
                              title="Send email" style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', padding: 4 }}>
                              <Mail size={13} />
                            </button>
                            <button onClick={() => { setEditingLead(l); setShowLeadForm(true); }}
                              title="Edit" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                              <Edit3 size={13} />
                            </button>
                            <button onClick={() => handleDeleteLead(l.id)}
                              title="Delete" style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>No leads found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PARTNERS TAB ── */}
      {!loading && activeTab === 'partners' && (
        <div>
          <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>Partnership Program</h3>
            <p style={{ fontSize: 12, color: '#64748b' }}>Manage discount partners and referral relationships</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {leads.filter(l => l.lead_type === 'partner').map(p => (
              <div key={p.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>{p.company_name}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: STATUS_COLORS[p.status]?.bg, color: STATUS_COLORS[p.status]?.color }}>
                    {STATUS_COLORS[p.status]?.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8' }}>
                  <span>{p.industry}</span>
                  <span>{p.location}</span>
                </div>
                {p.discount_code && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>Code: {p.discount_code}</span>
                    {p.discount_percent && <span style={{ color: '#f59e0b' }}>{p.discount_percent}% off</span>}
                  </div>
                )}
                {p.notes && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>{p.notes}</div>}
              </div>
            ))}
            {leads.filter(l => l.lead_type === 'partner').length === 0 && (
              <div style={{ ...card, textAlign: 'center', color: '#475569', padding: 40 }}>
                <Tag size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>No partners yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Add leads with type "Partner" to see them here</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {!loading && activeTab === 'logs' && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} color="#06b6d4" />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Outreach Logs ({logs.length})
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Date', 'Recipient', 'Subject', 'Status', 'Template'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{new Date(log.sent_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{log.recipient_name || log.recipient_email}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{log.recipient_email}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{log.subject}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: log.status === 'sent' ? 'rgba(16,185,129,0.1)' : log.status === 'simulated' ? 'rgba(139,92,246,0.1)' : 'rgba(239,68,68,0.1)',
                        color: log.status === 'sent' ? '#10b981' : log.status === 'simulated' ? '#a78bfa' : '#f87171',
                      }}>{log.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{log.company_name || '—'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>No outreach logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Lead Form Modal ── */}
      {showLeadForm && editingLead && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) { setShowLeadForm(false); setEditingLead(null); } }}>
          <div style={{ ...card, width: 520, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                {editingLead.id ? 'Edit Lead' : 'Add Lead'}
              </h3>
              <button onClick={() => { setShowLeadForm(false); setEditingLead(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Company Name *</label>
                <input value={editingLead.company_name || ''} onChange={e => setEditingLead(p => ({ ...p!, company_name: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Contact Name</label>
                <input value={editingLead.contact_name || ''} onChange={e => setEditingLead(p => ({ ...p!, contact_name: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Contact Email</label>
                <input value={editingLead.contact_email || ''} onChange={e => setEditingLead(p => ({ ...p!, contact_email: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Industry *</label>
                <select value={editingLead.industry || 'solar'} onChange={e => setEditingLead(p => ({ ...p!, industry: e.target.value }))} style={select}>
                  {INDUSTRIES.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Status</label>
                <select value={editingLead.status || 'new'} onChange={e => setEditingLead(p => ({ ...p!, status: e.target.value }))} style={select}>
                  {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Location</label>
                <input value={editingLead.location || ''} onChange={e => setEditingLead(p => ({ ...p!, location: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>State</label>
                <input value={editingLead.state || ''} onChange={e => setEditingLead(p => ({ ...p!, state: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={editingLead.lead_type || 'prospect'} onChange={e => setEditingLead(p => ({ ...p!, lead_type: e.target.value }))} style={select}>
                  <option value="prospect">Prospect</option>
                  <option value="partner">Partner</option>
                  <option value="directory_listing">Directory Listing</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Sub-Category</label>
                <input value={editingLead.sub_category || ''} onChange={e => setEditingLead(p => ({ ...p!, sub_category: e.target.value }))} placeholder="e.g. Solar farm operator" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Phone</label>
                <input value={editingLead.phone || ''} onChange={e => setEditingLead(p => ({ ...p!, phone: e.target.value }))} style={input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={editingLead.notes || ''} onChange={e => setEditingLead(p => ({ ...p!, notes: e.target.value }))}
                  style={{ ...input, minHeight: 60, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowLeadForm(false); setEditingLead(null); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveLead}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                {editingLead.id ? 'Save Changes' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
