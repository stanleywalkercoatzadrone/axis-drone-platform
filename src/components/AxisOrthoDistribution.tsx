/**
 * AxisOrthoDistribution.tsx
 * Admin panel for distributing the Axis Ortho desktop application.
 * Allows admins to download it themselves and email the download link to any user.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Send, Monitor, Users, CheckCircle, Clock,
  AlertCircle, Search, Laptop, ChevronRight, Package
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DownloadEntry { arch: string; url: string; filename: string; size: string }

interface DownloadMeta {
  name: string;
  version: string;
  description: string;
  requires: string;
  releasedAt: string;
  downloads: {
    arm64:     DownloadEntry;
    x64:       DownloadEntry;
    win_x64?:  DownloadEntry;
    win_arm64?: DownloadEntry;
  };
}

interface LogEntry {
  id: string;
  recipient_email: string;
  recipient_type: string;
  sent_by_name: string | null;
  sent_at: string;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  type: 'user' | 'personnel';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const API = (path: string) => `/api${path}`;

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  const res = await fetch(API(path), {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AxisOrthoDistribution() {
  const [meta, setMeta]           = useState<DownloadMeta | null>(null);
  const [log, setLog]             = useState<LogEntry[]>([]);
  const [users, setUsers]         = useState<UserOption[]>([]);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<UserOption | null>(null);
  const [sending, setSending]     = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Fetch metadata + log
  useEffect(() => {
    Promise.all([
      apiFetch('/downloads/axis-ortho'),
      apiFetch('/downloads/axis-ortho/log'),
    ])
      .then(([metaRes, logRes]) => {
        setMeta(metaRes.data);
        setLog(logRes.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load users + personnel for search
  useEffect(() => {
    Promise.all([
      apiFetch('/users?limit=200').catch(() => ({ data: [] })),
      apiFetch('/personnel?limit=200').catch(() => ({ data: [] })),
    ]).then(([usersRes, personnelRes]) => {
      const u: UserOption[] = (usersRes.data || usersRes.users || []).map((x: any) => ({
        id: x.id, full_name: x.full_name || x.name, email: x.email, type: 'user' as const,
      }));
      const p: UserOption[] = (personnelRes.data || []).map((x: any) => ({
        id: x.id, full_name: x.full_name || x.name, email: x.email, type: 'personnel' as const,
      }));
      setUsers([...u, ...p].filter(x => x.email));
    });
  }, []);

  const filteredUsers = search.length > 1
    ? users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSend = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await apiFetch('/downloads/axis-ortho/send', {
        method: 'POST',
        body: JSON.stringify({ recipientId: selected.id, recipientType: selected.type }),
      });
      setSendResult({ ok: true, msg: res.message });
      setSelected(null);
      setSearch('');
      // Refresh log
      apiFetch('/downloads/axis-ortho/log').then(r => setLog(r.data));
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message });
    } finally {
      setSending(false);
    }
  }, [selected]);

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <Package size={36} style={{ margin: '0 auto 12px', color: '#38bdf8' }} />
        <p style={{ fontSize: 13, fontWeight: 600 }}>Loading Axis Ortho distribution…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
      <AlertCircle size={36} style={{ margin: '0 auto 12px', color: '#ef4444' }} />
      <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>Failed to load: {error}</p>
    </div>
  );

  const v = meta?.version ?? '1.0.0';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', color: '#e2e8f0' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        border: '1px solid rgba(56,189,248,0.2)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 0 24px rgba(14,165,233,0.4)',
        }}>
          <Monitor size={26} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Axis Ortho
            </h1>
            <span style={{
              background: 'rgba(56,189,248,0.15)', color: '#38bdf8',
              border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999,
              fontSize: 10, fontWeight: 700, padding: '3px 10px',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              v{v}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            {meta?.description ?? 'Offline orthomosaic processing for Mac.'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569' }}>
            Requires: {meta?.requires ?? 'macOS 10.12+, Docker Desktop'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* ── Download for yourself ────────────────────────────────────── */}
        <div style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Laptop size={16} color="#38bdf8" />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Download
            </span>
          </div>

          {meta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── macOS section ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>🍎</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>macOS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Apple Silicon */}
                  <a
                    href={meta.downloads.arm64.url}
                    download={meta.downloads.arm64.filename}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', textDecoration: 'none',
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                      borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <span>
                      <span style={{ fontSize: 15 }}>↙</span> Apple Silicon
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>
                        M1 / M2 / M3 · {meta.downloads.arm64.size}
                      </span>
                    </span>
                    <Download size={15} />
                  </a>

                  {/* Intel */}
                  <a
                    href={meta.downloads.x64.url}
                    download={meta.downloads.x64.filename}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', textDecoration: 'none',
                      background: '#1e293b', border: '1px solid #334155',
                      borderRadius: 10, color: '#cbd5e1', fontWeight: 700, fontSize: 13,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#273548')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
                  >
                    <span>
                      <span style={{ fontSize: 15 }}>↙</span> Intel Mac
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>
                        x64 · {meta.downloads.x64.size}
                      </span>
                    </span>
                    <Download size={15} />
                  </a>
                </div>
                {/* Gatekeeper tip */}
                <div style={{
                  marginTop: 10, padding: '8px 12px',
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 8,
                }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#fbbf24', lineHeight: 1.6 }}>
                    <strong>First launch:</strong> Right-click → Open to bypass macOS Gatekeeper.
                  </p>
                </div>
              </div>

              {/* ── Windows section ── */}
              {meta.downloads.win_x64 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Monitor size={13} color="#38bdf8" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Windows</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Windows x64 */}
                    <a
                      href={meta.downloads.win_x64.url}
                      download={meta.downloads.win_x64.filename}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', textDecoration: 'none',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      <span>
                        <span style={{ fontSize: 15 }}>↙</span> Windows x64
                        <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>
                          Intel / AMD · {meta.downloads.win_x64.size}
                        </span>
                      </span>
                      <Download size={15} />
                    </a>

                    {/* Windows ARM64 */}
                    {meta.downloads.win_arm64 && (
                      <a
                        href={meta.downloads.win_arm64.url}
                        download={meta.downloads.win_arm64.filename}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', textDecoration: 'none',
                          background: '#1e293b', border: '1px solid #334155',
                          borderRadius: 10, color: '#cbd5e1', fontWeight: 700, fontSize: 13,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#273548')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
                      >
                        <span>
                          <span style={{ fontSize: 15 }}>↙</span> Windows ARM64
                          <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>
                            Snapdragon / ARM · {meta.downloads.win_arm64.size}
                          </span>
                        </span>
                        <Download size={15} />
                      </a>
                    )}
                  </div>
                  {/* SmartScreen tip */}
                  <div style={{
                    marginTop: 10, padding: '8px 12px',
                    background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                    borderRadius: 8,
                  }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#60a5fa', lineHeight: 1.6 }}>
                      <strong>First launch:</strong> Click "More info" → "Run anyway" to bypass Windows SmartScreen.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Send to user ─────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Send size={16} color="#38bdf8" />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Send Download Link
            </span>
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search user or pilot…"
              value={selected ? selected.full_name : search}
              onChange={e => {
                setSearch(e.target.value);
                setSelected(null);
                setSendResult(null);
              }}
              style={{
                width: '100%', padding: '10px 12px 10px 34px', boxSizing: 'border-box',
                background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
                color: '#e2e8f0', fontSize: 13, outline: 'none',
              }}
            />

            {/* Dropdown results */}
            {filteredUsers.length > 0 && !selected && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4,
                background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden',
              }}>
                {filteredUsers.map(u => (
                  <button
                    key={u.id + u.type}
                    onClick={() => { setSelected(u); setSearch(''); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 14px', background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      color: '#cbd5e1', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span>
                      <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{u.full_name}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b' }}>{u.email}</span>
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: u.type === 'personnel' ? '#a78bfa' : '#38bdf8',
                      background: u.type === 'personnel' ? 'rgba(167,139,250,0.1)' : 'rgba(56,189,248,0.1)',
                      padding: '2px 6px', borderRadius: 4,
                    }}>
                      {u.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected recipient chip */}
          {selected && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'rgba(56,189,248,0.08)',
              border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, marginBottom: 12,
            }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>{selected.full_name}</span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{selected.email}</span>
              </div>
              <button
                onClick={() => { setSelected(null); setSearch(''); setSendResult(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: 2 }}
              >✕</button>
            </div>
          )}

          {/* Send button */}
          <button
            id="axis-ortho-send-btn"
            onClick={handleSend}
            disabled={!selected || sending}
            style={{
              width: '100%', padding: '11px 16px', fontWeight: 800, fontSize: 13,
              background: selected && !sending ? 'linear-gradient(135deg, #0ea5e9, #2563eb)' : 'rgba(30,41,59,0.8)',
              color: selected && !sending ? '#fff' : '#475569',
              border: 'none', borderRadius: 10, cursor: selected && !sending ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            {sending ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Sending…
              </>
            ) : (
              <><Send size={14} /> Send Download Link</>
            )}
          </button>

          {/* Result toast */}
          {sendResult && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: sendResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${sendResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {sendResult.ok
                ? <CheckCircle size={14} color="#10b981" />
                : <AlertCircle size={14} color="#ef4444" />}
              <span style={{ fontSize: 12, color: sendResult.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {sendResult.msg}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Distribution log ─────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <Users size={15} color="#38bdf8" />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Distribution Log
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#475569',
            background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 999,
          }}>
            {log.length} sent
          </span>
        </div>

        {log.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#475569' }}>
            <Clock size={28} style={{ margin: '0 auto 10px', color: '#334155' }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>No links sent yet</p>
            <p style={{ margin: '4px 0 0', fontSize: 11 }}>Send Axis Ortho to your first user above.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {['Recipient', 'Type', 'Sent By', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <td style={{ padding: '11px 20px', color: '#cbd5e1', fontWeight: 600 }}>
                      {entry.recipient_email}
                    </td>
                    <td style={{ padding: '11px 20px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                        color: entry.recipient_type === 'personnel' ? '#a78bfa' : '#38bdf8',
                        background: entry.recipient_type === 'personnel' ? 'rgba(167,139,250,0.1)' : 'rgba(56,189,248,0.1)',
                        padding: '2px 7px', borderRadius: 4,
                      }}>
                        {entry.recipient_type}
                      </span>
                    </td>
                    <td style={{ padding: '11px 20px', color: '#64748b' }}>
                      {entry.sent_by_name || '—'}
                    </td>
                    <td style={{ padding: '11px 20px', color: '#64748b' }}>
                      {new Date(entry.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
