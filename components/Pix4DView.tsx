/**
 * Pix4DView.tsx — Pix4D Integration Hub
 * DB-backed workspace URL + active job polling.
 */
import React, { useState, useEffect } from 'react';
import { ExternalLink, Map, Layers, Settings, CheckCircle, AlertCircle, Save, RefreshCw } from 'lucide-react';
import apiClient from '../services/apiClient';

const Pix4DView: React.FC = () => {
  const [workspaceUrl, setWorkspaceUrl] = useState<string>('');
  const [draft, setDraft] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pix4dJobs, setPix4dJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    // Load workspace URL from DB
    apiClient.get('/ai/pix4d-workspace')
      .then(res => {
        const url = res.data.url || '';
        setWorkspaceUrl(url);
        setDraft(url);
      })
      .catch(() => {
        const stored = localStorage.getItem('axis_pix4d_workspace_url') || '';
        setWorkspaceUrl(stored);
        setDraft(stored);
      });
    fetchPix4dJobs();
  }, []);

  const fetchPix4dJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await apiClient.get('/pilot/upload-jobs?limit=8');
      const jobs = (res.data.jobs || []).filter((j: any) => j.status === 'processing' || j.pix4d_job_id);
      setPix4dJobs(jobs);
    } catch { setPix4dJobs([]); }
    finally { setJobsLoading(false); }
  };

  const handleSave = async () => {
    const trimmed = draft.trim().replace(/\/$/, '');
    setSaving(true);
    try {
      await apiClient.put('/ai/pix4d-workspace', { url: trimmed });
      localStorage.setItem('axis_pix4d_workspace_url', trimmed);
      setWorkspaceUrl(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      localStorage.setItem('axis_pix4d_workspace_url', trimmed);
      setWorkspaceUrl(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const openPix4D = (path = '') => {
    const base = workspaceUrl || 'https://cloud.pix4d.com';
    window.open(`${base}${path}`, '_blank', 'noopener,noreferrer');
  };

  const cards = [
    { icon: Map, color: '#34d399', label: 'Projects', description: 'View all photogrammetry projects and point clouds.', path: '/projects' },
    { icon: Layers, color: '#60a5fa', label: 'Maps', description: '2D orthomosaic maps and elevation models (DSM/DTM).', path: '/maps' },
    { icon: Settings, color: '#a78bfa', label: 'Processing', description: 'Monitor active processing jobs and reconstruction status.', path: '/processing' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 16, padding: '32px 32px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 12, width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(99,102,241,0.35)', fontWeight: 900, color: '#fff', fontSize: 18, letterSpacing: '-0.02em' }}>
            P4
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.01em' }}>Pix4D Integration</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Photogrammetry · Point Clouds · 3D Reconstruction · Orthomosaics</p>
          </div>
          <button
            onClick={() => openPix4D()}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, color: '#a5b4fc', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.2)')}
          >
            <ExternalLink size={14} /> Open Pix4D Cloud
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }} className="lg:grid-cols-[1fr_340px] grid-cols-1">

        {/* Quick-access cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Quick Access</h3>
          {cards.map(({ icon: Icon, color, label, description, path }) => (
            <button key={label} onClick={() => openPix4D(path)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', width: '100%', transition: 'background 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: `${color}1a`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{label}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{description}</p>
              </div>
              <ExternalLink size={14} color="#475569" style={{ flexShrink: 0 }} />
            </button>
          ))}

          {/* Workflow info */}
          <div style={{ marginTop: 8, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 12, padding: '16px 20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Axis + Pix4D Workflow</h4>
            {['Fly mission and capture images using Axis-managed fleet', 'Upload imagery to Pix4D Cloud for processing', 'Generate orthomosaics, DSMs, and point clouds', 'Link processed deliverables back to Axis client portfolio'].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#34d399' }}>{i + 1}</div>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Settings sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Workspace Settings</h3>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Pix4D Cloud Workspace URL
            </label>
            <input
              type="url"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="https://cloud.pix4d.com"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
            <p style={{ margin: '8px 0 16px', fontSize: 11, color: '#475569' }}>
              Saved to organization settings — persists across devices.
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: '10px', background: saved ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.2)', border: `1px solid ${saved ? 'rgba(52,211,153,0.35)' : 'rgba(99,102,241,0.35)'}`, borderRadius: 8, color: saved ? '#34d399' : '#a5b4fc', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', transition: 'all 0.2s', opacity: saving ? 0.6 : 1 }}
            >
              {saved ? <CheckCircle size={14} /> : <Save size={14} />}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Workspace'}
            </button>
          </div>

          {/* Active Pix4D Jobs */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Jobs</h4>
              <button onClick={fetchPix4dJobs} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><RefreshCw size={12} /></button>
            </div>
            {jobsLoading ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: '#475569', fontSize: 12 }}>Loading…</div>
            ) : pix4dJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: '#475569', fontSize: 12 }}>No active Pix4D jobs</div>
            ) : pix4dJobs.map((job: any) => (
              <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{job.site_name || job.id.slice(0, 10)}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>{job.file_count || 0} files</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>{job.status}</span>
              </div>
            ))}
          </div>

          {/* Connection Status */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Connection Status</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {workspaceUrl ? (
                <>
                  <CheckCircle size={16} color="#34d399" />
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#34d399' }}>Workspace Configured</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569', wordBreak: 'break-all' }}>{workspaceUrl}</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={16} color="#f59e0b" />
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>No Workspace Set</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569' }}>Links will open the default Pix4D Cloud.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Pix4D products */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pix4D Products</h4>
            {[
              { label: 'Pix4Dmapper', desc: 'Professional photogrammetry desktop' },
              { label: 'Pix4Dcloud', desc: 'Cloud processing & collaboration' },
              { label: 'Pix4Dsurvey', desc: 'Point cloud editing & vectorization' },
              { label: 'Pix4Dmatic', desc: 'Large-scale automated processing' },
            ].map(({ label, desc }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                className="last:border-0 last:pb-0 last:mb-0"
              >
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>{desc}</p>
                </div>
                <button onClick={() => window.open('https://www.pix4d.com/product', '_blank', 'noopener,noreferrer')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}>
                  <ExternalLink size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pix4DView;
