/**
 * PilotApplications.tsx
 * Admin view for the pilot candidate onboarding packet system.
 * – Generate a secure one-time application link for a new candidate
 * – See all sent packets and their status (sent → opened → submitted → reviewed)
 * – Copy link to clipboard or open the portal to preview
 * – Send pre-onboarding documents via email
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Link, Copy, CheckCircle, Clock, Mail, RefreshCw,
  ExternalLink, Send, FileText, AlertTriangle, Eye, ChevronDown, ChevronUp, X, Trash2
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { useCountry } from '../context/CountryContext';

interface Packet {
  id: string;
  candidate_email: string;
  status: 'sent' | 'opened' | 'submitted' | 'reviewed';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CONF = {
  sent:      { label: 'Link Sent',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   border: 'rgba(96,165,250,0.25)',  icon: Mail },
  opened:    { label: 'Opened',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.25)',  icon: Eye },
  submitted: { label: 'Submitted',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.25)',  icon: CheckCircle },
  reviewed:  { label: 'Reviewed',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.25)', icon: CheckCircle },
};

const PRE_ONBOARD_DOCS = [
  { id: 'nda',             label: 'NDA Agreement' },
  { id: 'pilot_agreement', label: 'Pilot Agreement' },
  { id: 'onboarding_guide',label: 'Onboarding Guide' },
  { id: 'w9',              label: 'W-9 Tax Form' },
  { id: 'direct_deposit',  label: 'Direct Deposit Form' },
];

const S = {
  page: { fontFamily: "'Inter',system-ui,sans-serif", color: '#e2e8f0', maxWidth: 1100 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 22px', marginBottom: 16 },
  label: { fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 5, display: 'block' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '9px 13px', width: '100%', outline: 'none', boxSizing: 'border-box' as const },
  btn: (v: 'primary' | 'danger' | 'ghost') => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: '1px solid', textTransform: 'uppercase' as const, letterSpacing: 0.5,
    ...(v === 'primary' ? { background: 'rgba(99,102,241,0.18)', borderColor: 'rgba(99,102,241,0.45)', color: '#818cf8' }
      : v === 'danger'  ? { background: 'rgba(239,68,68,0.1)',   borderColor: 'rgba(239,68,68,0.3)',   color: '#f87171' }
      : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }),
  }),
};

export default function PilotApplications() {
  const { activeCountryId } = useCountry();
  const [packets, setPackets] = useState<Packet[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Pre-onboarding docs state
  const [docsEmail, setDocsEmail] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [sendingDocs, setSendingDocs] = useState(false);
  const [showDocsPanel, setShowDocsPanel] = useState(false);

  const flash = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  const loadPackets = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeCountryId ? { countryId: activeCountryId } : {};
      const r = await apiClient.get('/candidates', { params });
      setPackets(r.data.data || []);
    } catch { setPackets([]); }
    finally { setLoading(false); }
  }, [activeCountryId]);

  useEffect(() => { loadPackets(); }, [loadPackets]);

  const generateLink = async () => {
    if (!email.trim() || !email.includes('@')) { flash('✗ Enter a valid email address', false); return; }
    setGenerating(true);
    setGeneratedLink(null);
    try {
      const payload = activeCountryId ? { candidate_email: email.trim(), countryId: activeCountryId } : { candidate_email: email.trim() };
      const r = await apiClient.post('/candidates/send', payload);
      setGeneratedLink(r.data.data.magicLink);
      setEmail('');
      flash('✓ Application link generated', true);
      loadPackets();
    } catch (e: any) { flash(`✗ ${e.response?.data?.message || 'Failed to generate link'}`, false); }
    finally { setGenerating(false); }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const deletePacket = async (id: string, email: string) => {
    if (!window.confirm(`Delete candidate packet for ${email}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await apiClient.delete(`/candidates/${id}`);
      setPackets(prev => prev.filter(p => p.id !== id));
      if (expandedId === id) setExpandedId(null);
      flash('✓ Candidate deleted', true);
    } catch (e: any) {
      flash(`✗ ${e.response?.data?.message || 'Failed to delete'}`, false);
    } finally {
      setDeleting(null);
    }
  };

  const sendPreOnboardDocs = async () => {
    if (!docsEmail.trim() || selectedDocs.length === 0) {
      flash('✗ Enter an email and select at least one document', false);
      return;
    }
    setSendingDocs(true);
    try {
      await apiClient.post('/candidates/send-docs', { candidate_email: docsEmail.trim(), documents: selectedDocs });
      flash('✓ Documents sent successfully', true);
      setDocsEmail('');
      setSelectedDocs([]);
      setShowDocsPanel(false);
    } catch (e: any) { flash(`✗ ${e.response?.data?.message || 'Failed to send documents'}`, false); }
    finally { setSendingDocs(false); }
  };

  const toggleDoc = (id: string) =>
    setSelectedDocs(d => d.includes(id) ? d.filter(x => x !== id) : [...d, id]);

  const filtered = filterStatus === 'all'
    ? packets
    : packets.filter(p => p.status === filterStatus);

  const counts = {
    all: packets.length,
    sent: packets.filter(p => p.status === 'sent').length,
    opened: packets.filter(p => p.status === 'opened').length,
    submitted: packets.filter(p => p.status === 'submitted').length,
    reviewed: packets.filter(p => p.status === 'reviewed').length,
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 10, padding: 8 }}>
            <UserPlus size={18} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.5 }}>
            Pilot Applications
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
          Generate secure one-time application links · Track candidate submissions · Send onboarding documents
        </p>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{ ...S.card, background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderColor: msg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)', color: msg.ok ? '#4ade80' : '#f87171', padding: '10px 16px', fontSize: 12, fontWeight: 700 }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
        {/* Generate Link Panel */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Link size={14} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Generate Application Link</span>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            Creates a secure, time-limited link (7 days) that a new pilot candidate can use to upload their Part 107 license and W-9 tax form.
          </p>
          <label style={S.label}>Candidate Email</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateLink()}
              placeholder="pilot@example.com"
              style={S.input}
              type="email"
            />
            <button onClick={generateLink} disabled={generating} style={{ ...S.btn('primary'), whiteSpace: 'nowrap', flexShrink: 0 }}>
              {generating ? '…' : <><Send size={12} /> Generate</>}
            </button>
          </div>

          {/* Generated link display */}
          {generatedLink && (
            <div style={{ marginTop: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                ✓ Secure Link Generated
              </div>
              <div style={{ fontSize: 11, color: '#86efac', wordBreak: 'break-all', marginBottom: 10, lineHeight: 1.5 }}>
                {generatedLink}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => copyLink(generatedLink)} style={S.btn('primary')}>
                  <Copy size={11} /> {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={() => window.open(generatedLink, '_blank')} style={S.btn('ghost')}>
                  <ExternalLink size={11} /> Preview Portal
                </button>
                <button onClick={() => setGeneratedLink(null)} style={{ ...S.btn('ghost'), marginLeft: 'auto', padding: '6px 8px' }}>
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pre-Onboarding Docs Panel */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <FileText size={14} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Send Onboarding Documents</span>
            <button onClick={() => setShowDocsPanel(p => !p)} style={{ ...S.btn('ghost'), marginLeft: 'auto', padding: '4px 8px' }}>
              {showDocsPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            Email the NDA, Pilot Agreement, W-9, or other pre-onboarding documents as attachments to a candidate.
          </p>

          {showDocsPanel && (
            <>
              <label style={S.label}>Recipient Email</label>
              <input
                value={docsEmail}
                onChange={e => setDocsEmail(e.target.value)}
                placeholder="pilot@example.com"
                style={{ ...S.input, marginBottom: 12 }}
                type="email"
              />
              <label style={S.label}>Select Documents</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {PRE_ONBOARD_DOCS.map(doc => (
                  <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: selectedDocs.includes(doc.id) ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedDocs.includes(doc.id) ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)'}` }}>
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      style={{ accentColor: '#818cf8' }}
                    />
                    <span style={{ fontSize: 12, color: selectedDocs.includes(doc.id) ? '#a5b4fc' : '#94a3b8', fontWeight: selectedDocs.includes(doc.id) ? 700 : 500 }}>
                      {doc.label}
                    </span>
                  </label>
                ))}
              </div>
              <button onClick={sendPreOnboardDocs} disabled={sendingDocs} style={S.btn('primary')}>
                <Mail size={12} /> {sendingDocs ? 'Sending…' : 'Send Documents'}
              </button>
            </>
          )}

          {!showDocsPanel && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRE_ONBOARD_DOCS.map(doc => (
                <span key={doc.id} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                  {doc.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, margin: '16px 0' }}>
        {(['all', 'sent', 'opened', 'submitted', 'reviewed'] as const).map(s => {
          const conf = s === 'all' ? null : STATUS_CONF[s];
          const isActive = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                background: isActive ? (conf?.bg || 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? (conf?.border || 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: isActive ? (conf?.color || '#e2e8f0') : '#475569', letterSpacing: -1 }}>
                {counts[s]}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>
                {s === 'all' ? 'All Candidates' : STATUS_CONF[s].label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Candidate list */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <UserPlus size={14} color="#64748b" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Candidate Pipeline {filterStatus !== 'all' ? `— ${STATUS_CONF[filterStatus as keyof typeof STATUS_CONF]?.label}` : ''}
          </span>
          <button onClick={loadPackets} style={{ ...S.btn('ghost'), marginLeft: 'auto', padding: '4px 8px' }}>
            <RefreshCw size={11} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading candidates…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            <UserPlus size={28} color="#334155" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              {filterStatus === 'all' ? 'No application links sent yet. Generate one above.' : `No candidates with status "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => {
              const conf = STATUS_CONF[p.status] || STATUS_CONF.sent;
              const StatusIcon = conf.icon;
              const isExpired = new Date(p.expires_at) < new Date() && p.status === 'sent';
              const isExpanded = expandedId === p.id;

              return (
                <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    {/* Status indicator */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isExpired ? '#475569' : conf.color, boxShadow: isExpired ? 'none' : `0 0 6px ${conf.color}` }} />

                    {/* Email */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.candidate_email}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Sent {new Date(p.created_at).toLocaleDateString()}
                        {isExpired && <span style={{ color: '#ef4444', marginLeft: 8, fontWeight: 700 }}>· Link Expired</span>}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: conf.bg, color: conf.color, border: `1px solid ${conf.border}`, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <StatusIcon size={10} />
                      {isExpired ? 'Expired' : conf.label}
                    </span>

                    {/* Expand chevron */}
                    {isExpanded ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}

                    {/* Delete button */}
                    <button
                      onClick={e => { e.stopPropagation(); deletePacket(p.id, p.candidate_email); }}
                      disabled={deleting === p.id}
                      title="Delete candidate"
                      style={{ ...S.btn('danger'), padding: '4px 8px', marginLeft: 4 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', background: 'rgba(0,0,0,0.15)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={S.label}>Expires</div>
                          <div style={{ fontSize: 12, color: isExpired ? '#ef4444' : '#94a3b8' }}>{new Date(p.expires_at).toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={S.label}>Last Updated</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(p.updated_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/candidate-portal/${p.id}`;
                            copyLink(url);
                          }}
                          style={S.btn('ghost')}
                        >
                          <Copy size={11} /> Copy Portal Link
                        </button>
                        <button
                          onClick={() => window.open(`/candidate-portal/${p.id}`, '_blank')}
                          style={S.btn('ghost')}
                        >
                          <ExternalLink size={11} /> Open Portal
                        </button>
                        {(p.status === 'sent' || p.status === 'opened') && (
                          <button
                            onClick={async () => {
                              try {
                                const r = await apiClient.post('/candidates/send', { candidate_email: p.candidate_email });
                                flash('✓ New link generated — check clipboard', true);
                                copyLink(r.data.data.magicLink);
                                loadPackets();
                              } catch { flash('✗ Failed to regenerate link', false); }
                            }}
                            style={S.btn('primary')}
                          >
                            <RefreshCw size={11} /> Re-send New Link
                          </button>
                        )}
                        {p.status === 'submitted' && (
                          <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <CheckCircle size={12} /> Documents submitted — review in pilot onboarding
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
