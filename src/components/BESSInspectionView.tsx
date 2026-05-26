import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────
interface BESSInspection {
  id: string;
  deployment_id?: string;
  inspection_type: 'container_qa' | 'inverter_qa' | 'site_survey' | 'full_audit';
  status: 'draft' | 'in_progress' | 'completed' | 'approved';
  site_name?: string;
  site_address?: string;
  inspector_name?: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  defect_count: number;
  critical_count: number;
  pass_rate?: number;
  created_at: string;
}

interface BESSDefect {
  id: string;
  inspection_id: string;
  component_type: string;
  component_id?: string;
  defect_category: string;
  severity: 'critical' | 'major' | 'minor' | 'observation';
  description: string;
  lat?: number;
  lng?: number;
  photo_url?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  is_recurring: boolean;
  created_at: string;
}

interface ChecklistResponse {
  item_key: string;
  item_label: string;
  section: string;
  response?: 'pass' | 'fail' | 'na' | 'pending';
  notes?: string;
}

interface Pattern {
  component_type: string;
  defect_category: string;
  occurrence_count: number;
  open_count: number;
}

interface Mission {
  id: string;
  title?: string;
  siteName?: string;
  location?: string;
}

type Tab = 'dashboard' | 'inspections' | 'detail' | 'patterns';

// ── Checklist Templates ───────────────────────────────────────────────────────
const CONTAINER_ITEMS: Omit<ChecklistResponse, 'response'>[] = [
  { section: 'container', item_key: 'container_exterior',  item_label: 'Exterior condition — no dents, rust, or damage' },
  { section: 'container', item_key: 'container_seals',     item_label: 'Door seals and gaskets intact' },
  { section: 'container', item_key: 'container_cooling',   item_label: 'Cooling/HVAC system operational' },
  { section: 'container', item_key: 'container_fire',      item_label: 'Fire suppression system armed' },
  { section: 'container', item_key: 'container_labels',    item_label: 'Safety labels and signage present' },
  { section: 'container', item_key: 'container_grounding', item_label: 'Grounding and bonding verified' },
  { section: 'container', item_key: 'container_electrical',item_label: 'Electrical panel accessible and labeled' },
  { section: 'container', item_key: 'container_moisture',  item_label: 'No moisture ingress detected' },
];

const INVERTER_ITEMS: Omit<ChecklistResponse, 'response'>[] = [
  { section: 'inverter', item_key: 'inverter_connections', item_label: 'DC/AC connections torqued and secure' },
  { section: 'inverter', item_key: 'inverter_fuses',       item_label: 'Fuse ratings verified' },
  { section: 'inverter', item_key: 'inverter_display',     item_label: 'Display/HMI operational' },
  { section: 'inverter', item_key: 'inverter_alarms',      item_label: 'No active fault alarms' },
  { section: 'inverter', item_key: 'inverter_cooling',     item_label: 'Cooling fans operational' },
  { section: 'inverter', item_key: 'inverter_insulation',  item_label: 'Insulation resistance within spec' },
  { section: 'inverter', item_key: 'inverter_wiring',      item_label: 'Wiring harness organized and undamaged' },
  { section: 'inverter', item_key: 'inverter_grounding',   item_label: 'Inverter grounding verified' },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    padding: '24px',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#e2e8f0',
  } as React.CSSProperties,
  card: {
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '20px',
    backdropFilter: 'blur(12px)',
  } as React.CSSProperties,
  kpiCard: (accent: string) => ({
    background: `linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))`,
    border: `1px solid ${accent}30`,
    borderRadius: '16px',
    padding: '20px',
    boxShadow: `0 0 20px ${accent}15`,
  } as React.CSSProperties),
  tab: (active: boolean) => ({
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'all 0.2s',
    background: active ? 'rgba(56,189,248,0.2)' : 'transparent',
    color: active ? '#38bdf8' : '#64748b',
    borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
  } as React.CSSProperties),
  btn: (variant: 'primary' | 'danger' | 'ghost' | 'success') => {
    const map = {
      primary: { background: '#2563eb', color: '#fff', border: 'none' },
      danger:  { background: '#dc2626', color: '#fff', border: 'none' },
      ghost:   { background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' },
      success: { background: '#16a34a', color: '#fff', border: 'none' },
    };
    return { ...map[variant], padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'opacity 0.2s' } as React.CSSProperties;
  },
  badge: (type: string) => {
    const map: Record<string, [string, string]> = {
      draft:       ['#475569', '#cbd5e1'],
      in_progress: ['rgba(251,191,36,0.15)', '#fbbf24'],
      completed:   ['rgba(74,222,128,0.15)', '#4ade80'],
      approved:    ['rgba(56,189,248,0.15)', '#38bdf8'],
      critical:    ['rgba(239,68,68,0.15)', '#ef4444'],
      major:       ['rgba(251,146,60,0.15)', '#fb923c'],
      minor:       ['rgba(250,204,21,0.15)', '#facc15'],
      observation: ['rgba(56,189,248,0.15)', '#38bdf8'],
      open:        ['rgba(239,68,68,0.12)', '#f87171'],
      resolved:    ['rgba(74,222,128,0.12)', '#4ade80'],
      container_qa:['rgba(139,92,246,0.15)', '#a78bfa'],
      inverter_qa: ['rgba(236,72,153,0.15)', '#f472b6'],
      site_survey: ['rgba(56,189,248,0.15)', '#38bdf8'],
      full_audit:  ['rgba(251,146,60,0.15)', '#fb923c'],
    };
    const [bg, text] = map[type] || ['rgba(100,116,139,0.15)', '#94a3b8'];
    return { background: bg, color: text, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties;
  },
  input: {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  } as React.CSSProperties,
};

const severityIcon: Record<string, string> = { critical: '🔴', major: '🟠', minor: '🟡', observation: '🔵' };

// ── Main Component ────────────────────────────────────────────────────────────
export default function BESSInspectionView() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [inspections, setInspections] = useState<BESSInspection[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState<(BESSInspection & { defects: BESSDefect[]; checklist_responses: ChecklistResponse[] }) | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);

  // New inspection form
  const [newForm, setNewForm] = useState({ deployment_id: '', inspection_type: 'site_survey' as const, site_name: '', inspector_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Detail: defect form
  const [defectForm, setDefectForm] = useState({ component_type: 'container', component_id: '', defect_category: '', severity: 'minor' as const, description: '' });
  const [addingDefect, setAddingDefect] = useState(false);
  const [expandedDefect, setExpandedDefect] = useState<string | null>(null);

  // Detail: checklist
  const [checklistState, setChecklistState] = useState<Record<string, 'pass' | 'fail' | 'na' | 'pending'>>({});
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Filter
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [inspRes, patternRes] = await Promise.all([
        apiClient.get('/bess/inspections?limit=50'),
        apiClient.get('/bess/patterns'),
      ]);
      setInspections((inspRes.data as { data: BESSInspection[] }).data || []);
      setPatterns((patternRes.data as { data: Pattern[] }).data || []);
    } catch { setError('Failed to load BESS data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    apiClient.get('/deployments?limit=100').then(r => {
      const data = (r.data as { data?: Mission[] })?.data || [];
      setMissions(data);
    }).catch(() => {});
  }, []);

  const openDetail = async (id: string) => {
    try {
      const res = await apiClient.get(`/bess/inspections/${id}`);
      const detail = (res.data as { data: BESSInspection & { defects: BESSDefect[]; checklist_responses: ChecklistResponse[] } }).data;
      setSelectedInspection(detail);
      // Populate checklist state
      const state: Record<string, 'pass' | 'fail' | 'na' | 'pending'> = {};
      (detail.checklist_responses || []).forEach(cr => { if (cr.response) state[cr.item_key] = cr.response; });
      setChecklistState(state);
      setTab('detail');
    } catch { setError('Failed to load inspection detail'); }
  };

  const createInspection = async () => {
    if (!newForm.site_name) { setError('Site name is required'); return; }
    setSubmitting(true);
    try {
      await apiClient.post('/bess/inspections', newForm);
      setShowNewForm(false);
      setNewForm({ deployment_id: '', inspection_type: 'site_survey', site_name: '', inspector_name: '' });
      await loadAll();
    } catch { setError('Failed to create inspection'); }
    finally { setSubmitting(false); }
  };

  const addDefect = async () => {
    if (!selectedInspection || !defectForm.defect_category || !defectForm.description) {
      setError('Defect category and description are required'); return;
    }
    setAddingDefect(true);
    try {
      const res = await apiClient.post(`/bess/inspections/${selectedInspection.id}/defects`, defectForm);
      const newDefect = (res.data as { data: BESSDefect }).data;
      setSelectedInspection(prev => prev ? { ...prev, defects: [newDefect, ...prev.defects], defect_count: prev.defect_count + 1, critical_count: prev.critical_count + (newDefect.severity === 'critical' ? 1 : 0) } : prev);
      setDefectForm({ component_type: 'container', component_id: '', defect_category: '', severity: 'minor', description: '' });
    } catch { setError('Failed to add defect'); }
    finally { setAddingDefect(false); }
  };

  const resolveDefect = async (defectId: string) => {
    try {
      await apiClient.put(`/bess/defects/${defectId}`, { status: 'resolved' });
      setSelectedInspection(prev => prev ? { ...prev, defects: prev.defects.map(d => d.id === defectId ? { ...d, status: 'resolved' as const } : d) } : prev);
    } catch { setError('Failed to resolve defect'); }
  };

  const saveChecklist = async () => {
    if (!selectedInspection) return;
    setSavingChecklist(true);
    const allItems = [...CONTAINER_ITEMS, ...INVERTER_ITEMS];
    const responses = allItems.map(item => ({ ...item, response: checklistState[item.item_key] || 'pending' }));
    try {
      await apiClient.post(`/bess/inspections/${selectedInspection.id}/checklist`, { responses });
      const passed = responses.filter(r => r.response === 'pass').length;
      const answered = responses.filter(r => r.response && r.response !== 'pending').length;
      const passRate = answered > 0 ? Math.round((passed / answered) * 100) : 0;
      setSelectedInspection(prev => prev ? { ...prev, pass_rate: passRate } : prev);
    } catch { setError('Failed to save checklist'); }
    finally { setSavingChecklist(false); }
  };

  const completeInspection = async () => {
    if (!selectedInspection) return;
    try {
      await apiClient.put(`/bess/inspections/${selectedInspection.id}`, { status: 'completed', completed_at: new Date().toISOString() });
      setSelectedInspection(prev => prev ? { ...prev, status: 'completed' } : prev);
      await loadAll();
    } catch { setError('Failed to complete inspection'); }
  };

  const exportInspection = async () => {
    if (!selectedInspection) return;
    try {
      const res = await apiClient.get(`/bess/inspections/${selectedInspection.id}/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `bess-audit-${selectedInspection.id.slice(0,8)}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Failed to export inspection'); }
  };

  // ── Computed ─────────────────────────────────────────────────────────────
  const filteredInspections = inspections.filter(i => {
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterSearch && !((i.site_name || '').toLowerCase().includes(filterSearch.toLowerCase()))) return false;
    return true;
  });

  const totalDefects   = inspections.reduce((s, i) => s + i.defect_count, 0);
  const criticalOpen   = inspections.reduce((s, i) => s + i.critical_count, 0);
  const completedThisMonth = inspections.filter(i => i.status === 'completed' && new Date(i.created_at).getMonth() === new Date().getMonth()).length;
  const avgPassRate    = (() => { const with_rate = inspections.filter(i => i.pass_rate != null); return with_rate.length ? Math.round(with_rate.reduce((s, i) => s + (i.pass_rate || 0), 0) / with_rate.length) : null; })();
  const criticalPatterns = patterns.filter(p => Number(p.occurrence_count) >= 3);

  const checklistPassRate = (() => {
    const all = [...CONTAINER_ITEMS, ...INVERTER_ITEMS];
    const answered = all.filter(i => checklistState[i.item_key] && checklistState[i.item_key] !== 'pending');
    const passed = answered.filter(i => checklistState[i.item_key] === 'pass');
    return answered.length ? Math.round((passed.length / answered.length) * 100) : 0;
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔋</div>
        <p style={{ color: '#64748b' }}>Loading BESS QA/QC data…</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            🔋 BESS QA/QC
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>Battery Energy Storage System Inspection Platform</p>
        </div>
        {tab !== 'detail' && (
          <button style={S.btn('primary')} onClick={() => setShowNewForm(true)}>+ New Inspection</button>
        )}
        {tab === 'detail' && (
          <button style={S.btn('ghost')} onClick={() => { setTab('inspections'); setSelectedInspection(null); }}>← Back to Inspections</button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#f87171', fontSize: '14px' }}>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>
      )}

      {/* Pattern alert */}
      {criticalPatterns.length > 0 && tab !== 'detail' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#f87171', fontSize: '14px' }}>{criticalPatterns.length} recurring defect pattern{criticalPatterns.length > 1 ? 's' : ''} detected</p>
            <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '12px' }}>Early detection active — {criticalPatterns[0]?.defect_category} in {criticalPatterns[0]?.component_type} appears {criticalPatterns[0]?.occurrence_count}× across inspections</p>
          </div>
          <button style={{ ...S.btn('ghost'), marginLeft: 'auto', whiteSpace: 'nowrap' }} onClick={() => setTab('patterns')}>View Patterns →</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
        {(['dashboard', 'inspections', ...(tab === 'detail' ? ['detail'] : []), 'patterns'] as Tab[]).map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => t !== 'detail' && setTab(t)}>
            {t === 'dashboard' ? '📊 Dashboard' : t === 'inspections' ? '📋 Inspections' : t === 'detail' ? `🔍 ${selectedInspection?.site_name || 'Detail'}` : '🧠 Patterns'}
          </button>
        ))}
      </div>

      {/* ── TAB: Dashboard ── */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Total Inspections', value: inspections.length, accent: '#38bdf8', icon: '📋' },
              { label: 'Open Defects', value: totalDefects, accent: criticalOpen > 0 ? '#ef4444' : '#fb923c', icon: criticalOpen > 0 ? '🔴' : '🟠', sub: criticalOpen > 0 ? `${criticalOpen} critical` : undefined },
              { label: 'Completed This Month', value: completedThisMonth, accent: '#4ade80', icon: '✅' },
              { label: 'Avg Pass Rate', value: avgPassRate != null ? `${avgPassRate}%` : '—', accent: '#818cf8', icon: '📈' },
            ].map(kpi => (
              <div key={kpi.label} style={S.kpiCard(kpi.accent)}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{kpi.icon}</div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: kpi.accent }}>{kpi.value}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{kpi.label}</div>
                {kpi.sub && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', fontWeight: 600 }}>{kpi.sub}</div>}
              </div>
            ))}
          </div>

          {/* Recent Inspections */}
          <div style={S.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Recent Inspections</h3>
            {inspections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>🔋</div>
                <p style={{ margin: 0 }}>No inspections yet. Create your first BESS inspection.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Site', 'Type', 'Status', 'Inspector', 'Defects', 'Pass Rate', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inspections.slice(0, 5).map(ins => (
                      <tr key={ins.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => openDetail(ins.id)}>
                        <td style={{ padding: '12px' }}>{ins.site_name || '—'}</td>
                        <td style={{ padding: '12px' }}><span style={S.badge(ins.inspection_type)}>{ins.inspection_type.replace('_', ' ')}</span></td>
                        <td style={{ padding: '12px' }}><span style={S.badge(ins.status)}>{ins.status.replace('_', ' ')}</span></td>
                        <td style={{ padding: '12px', color: '#94a3b8' }}>{ins.inspector_name || '—'}</td>
                        <td style={{ padding: '12px' }}>{ins.critical_count > 0 ? <span style={{ color: '#ef4444', fontWeight: 700 }}>{ins.defect_count} ({ins.critical_count} crit)</span> : ins.defect_count}</td>
                        <td style={{ padding: '12px' }}>{ins.pass_rate != null ? <span style={{ color: ins.pass_rate >= 80 ? '#4ade80' : ins.pass_rate >= 60 ? '#fbbf24' : '#ef4444' }}>{ins.pass_rate}%</span> : '—'}</td>
                        <td style={{ padding: '12px' }}><button style={S.btn('ghost')} onClick={e => { e.stopPropagation(); openDetail(ins.id); }}>Open →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Inspections List ── */}
      {tab === 'inspections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search by site name…" style={{ ...S.input, width: '240px' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width: '160px' }}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          {filteredInspections.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔋</div>
              <p style={{ color: '#64748b', margin: 0 }}>No inspections found. Click "New Inspection" to start.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filteredInspections.map(ins => (
                <div key={ins.id} style={{ ...S.card, cursor: 'pointer', transition: 'border-color 0.2s', border: '1px solid rgba(255,255,255,0.08)' }} onClick={() => openDetail(ins.id)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{ins.site_name || 'Unnamed Site'}</h3>
                    <span style={S.badge(ins.status)}>{ins.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={S.badge(ins.inspection_type)}>{ins.inspection_type.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#94a3b8' }}>
                    <span>👤 {ins.inspector_name || '—'}</span>
                    <span>📅 {ins.started_at ? new Date(ins.started_at).toLocaleDateString() : '—'}</span>
                    <span style={ins.critical_count > 0 ? { color: '#ef4444', fontWeight: 700 } : {}}>
                      🔍 {ins.defect_count} defect{ins.defect_count !== 1 ? 's' : ''}{ins.critical_count > 0 ? ` (${ins.critical_count} critical)` : ''}
                    </span>
                    <span style={{ color: ins.pass_rate != null ? (ins.pass_rate >= 80 ? '#4ade80' : ins.pass_rate >= 60 ? '#fbbf24' : '#ef4444') : '#64748b' }}>
                      ✓ {ins.pass_rate != null ? `${ins.pass_rate}%` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Inspection Detail ── */}
      {tab === 'detail' && selectedInspection && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* LEFT: Checklists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Inspection info */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{selectedInspection.site_name || 'Unnamed Site'}</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={S.badge(selectedInspection.status)}>{selectedInspection.status.replace('_', ' ')}</span>
                  <span style={S.badge(selectedInspection.inspection_type)}>{selectedInspection.inspection_type.replace('_', ' ')}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#94a3b8' }}>
                <span>👤 {selectedInspection.inspector_name || '—'}</span>
                <span>📅 {selectedInspection.started_at ? new Date(selectedInspection.started_at).toLocaleDateString() : '—'}</span>
              </div>
              {/* Pass rate bar */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Checklist Pass Rate</span>
                  <span style={{ fontWeight: 700, color: checklistPassRate >= 80 ? '#4ade80' : checklistPassRate >= 60 ? '#fbbf24' : '#ef4444' }}>{checklistPassRate}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${checklistPassRate}%`, background: checklistPassRate >= 80 ? '#4ade80' : checklistPassRate >= 60 ? '#fbbf24' : '#ef4444', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>

            {/* Container QA Checklist */}
            <ChecklistSection title="🔲 Container QA" items={CONTAINER_ITEMS} checklistState={checklistState} setChecklistState={setChecklistState} />
            {/* Inverter QA Checklist */}
            <ChecklistSection title="⚡ Inverter QA" items={INVERTER_ITEMS} checklistState={checklistState} setChecklistState={setChecklistState} />

            <button style={{ ...S.btn('primary'), padding: '12px', width: '100%', fontSize: '14px' }} onClick={saveChecklist} disabled={savingChecklist}>
              {savingChecklist ? '⏳ Saving…' : '💾 Save Checklist'}
            </button>
          </div>

          {/* RIGHT: Defects + Site Map */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Site Map */}
            <div style={S.card}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700 }}>📍 Site Defect Map</h3>
              <SiteMap defects={selectedInspection.defects} />
            </div>

            {/* Add Defect Form */}
            <div style={S.card}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700 }}>+ Log Defect</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Component Type</label>
                  <select value={defectForm.component_type} onChange={e => setDefectForm(f => ({ ...f, component_type: e.target.value }))} style={{ ...S.input, marginTop: '4px' }}>
                    {['container','inverter','cable','transformer','rack','bms','hvac','other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Component ID</label>
                  <input value={defectForm.component_id} onChange={e => setDefectForm(f => ({ ...f, component_id: e.target.value }))} placeholder="e.g. INV-03" style={{ ...S.input, marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Defect Category</label>
                  <input value={defectForm.defect_category} onChange={e => setDefectForm(f => ({ ...f, defect_category: e.target.value }))} placeholder="e.g. Corrosion, Loose connection" style={{ ...S.input, marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Severity</label>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {(['critical','major','minor','observation'] as const).map(s => (
                      <button key={s} onClick={() => setDefectForm(f => ({ ...f, severity: s }))} style={{ ...S.btn(defectForm.severity === s ? (s === 'critical' ? 'danger' : 'primary') : 'ghost'), padding: '4px 10px', fontSize: '11px' }}>
                        {severityIcon[s]} {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Description</label>
                <textarea value={defectForm.description} onChange={e => setDefectForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the defect in detail…" rows={3} style={{ ...S.input, marginTop: '4px', resize: 'vertical' }} />
              </div>
              <button style={{ ...S.btn('primary'), width: '100%' }} onClick={addDefect} disabled={addingDefect}>
                {addingDefect ? '⏳ Logging…' : '🔍 Log Defect'}
              </button>
            </div>

            {/* Defects List */}
            <div style={S.card}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700 }}>Defects ({selectedInspection.defects.length})</h3>
              {selectedInspection.defects.length === 0 ? (
                <p style={{ color: '#475569', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No defects logged yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                  {selectedInspection.defects.map(d => (
                    <div key={d.id} style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', cursor: 'pointer' }} onClick={() => setExpandedDefect(expandedDefect === d.id ? null : d.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={S.badge(d.severity)}>{severityIcon[d.severity]} {d.severity}</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{d.component_type}{d.component_id ? ` (${d.component_id})` : ''}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>— {d.defect_category}</span>
                        <span style={{ ...S.badge(d.status), marginLeft: 'auto' }}>{d.status}</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedDefect === d.id ? 'normal' : 'nowrap' }}>{d.description}</p>
                      {expandedDefect === d.id && d.status !== 'resolved' && (
                        <button style={{ ...S.btn('success'), marginTop: '8px', fontSize: '12px' }} onClick={e => { e.stopPropagation(); resolveDefect(d.id); }}>✓ Mark Resolved</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ ...S.btn('ghost'), flex: 1 }} onClick={exportInspection}>📄 Export Audit Report</button>
              {selectedInspection.status !== 'completed' && (
                <button style={{ ...S.btn('success'), flex: 1 }} onClick={completeInspection}>✅ Complete Inspection</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Patterns ── */}
      {tab === 'patterns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={S.card}>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>🧠 Recurring Defect Pattern Analysis</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>Defect patterns detected across all BESS inspections — sorted by frequency</p>
            {patterns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                <p style={{ color: '#64748b', margin: 0 }}>No recurring patterns detected — inspections are consistent</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Component', 'Defect Category', 'Occurrences', 'Open', 'Risk Level'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.map((p, i) => {
                      const count = Number(p.occurrence_count);
                      const risk = count >= 5 ? 'critical' : count >= 3 ? 'major' : 'minor';
                      const riskLabel = count >= 5 ? '🔴 Critical' : count >= 3 ? '🟠 High' : '🟡 Moderate';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>{p.component_type}</td>
                          <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{p.defect_category}</td>
                          <td style={{ padding: '12px 14px' }}><span style={{ fontWeight: 800, color: risk === 'critical' ? '#ef4444' : risk === 'major' ? '#fb923c' : '#fbbf24', fontSize: '18px' }}>{count}</span></td>
                          <td style={{ padding: '12px 14px', color: '#f87171' }}>{Number(p.open_count)}</td>
                          <td style={{ padding: '12px 14px' }}><span style={S.badge(risk)}>{riskLabel}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ ...S.card, background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(129,140,248,0.08))', border: '1px solid rgba(56,189,248,0.2)' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>🔬 Early Detection Active</span> — Axis monitors all BESS inspections for recurring defect patterns across your fleet. Patterns appearing 3+ times are flagged as High risk. Patterns appearing 5+ times trigger Critical alerts.
            </p>
          </div>
        </div>
      )}

      {/* ── New Inspection Modal ── */}
      {showNewForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ ...S.card, width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>New BESS Inspection</h3>
              <button onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '22px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Link to Mission</label>
                <select value={newForm.deployment_id} onChange={e => { const m = missions.find(x => x.id === e.target.value); setNewForm(f => ({ ...f, deployment_id: e.target.value, site_name: f.site_name || (m?.siteName || m?.location || '') })); }} style={{ ...S.input, marginTop: '4px' }}>
                  <option value="">Select mission (optional)</option>
                  {missions.map(m => <option key={m.id} value={m.id}>{m.title || m.siteName || m.location || m.id.slice(0, 8)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Inspection Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  {[['container_qa','🔲 Container QA'], ['inverter_qa','⚡ Inverter QA'], ['site_survey','🗺️ Site Survey'], ['full_audit','📋 Full Audit']].map(([val, label]) => (
                    <button key={val} onClick={() => setNewForm(f => ({ ...f, inspection_type: val as typeof newForm.inspection_type }))} style={{ ...S.btn(newForm.inspection_type === val ? 'primary' : 'ghost'), textAlign: 'left' }}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Site Name *</label>
                <input value={newForm.site_name} onChange={e => setNewForm(f => ({ ...f, site_name: e.target.value }))} placeholder="e.g. Badger Hollow BESS — Unit 1" style={{ ...S.input, marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Inspector Name</label>
                <input value={newForm.inspector_name} onChange={e => setNewForm(f => ({ ...f, inspector_name: e.target.value }))} placeholder="Your name" style={{ ...S.input, marginTop: '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button style={{ ...S.btn('ghost'), flex: 1 }} onClick={() => setShowNewForm(false)}>Cancel</button>
                <button style={{ ...S.btn('primary'), flex: 2 }} onClick={createInspection} disabled={submitting}>
                  {submitting ? '⏳ Creating…' : '🔋 Create Inspection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ChecklistSection ──────────────────────────────────────────────────────────
function ChecklistSection({ title, items, checklistState, setChecklistState }: {
  title: string;
  items: Omit<ChecklistResponse, 'response'>[];
  checklistState: Record<string, 'pass' | 'fail' | 'na' | 'pending'>;
  setChecklistState: React.Dispatch<React.SetStateAction<Record<string, 'pass' | 'fail' | 'na' | 'pending'>>>;
}) {
  const [open, setOpen] = useState(true);
  const passCount = items.filter(i => checklistState[i.item_key] === 'pass').length;
  const failCount = items.filter(i => checklistState[i.item_key] === 'fail').length;

  return (
    <div style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e2e8f0' }}>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>{title}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {passCount > 0 && <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>✓ {passCount}</span>}
          {failCount > 0 && <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>✗ {failCount}</span>}
          <span style={{ color: '#64748b' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(item => {
            const val = checklistState[item.item_key];
            return (
              <div key={item.item_key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ flex: 1, fontSize: '13px', color: '#94a3b8' }}>{item.item_label}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['pass', 'fail', 'na'] as const).map(r => (
                    <button key={r} onClick={() => setChecklistState(s => ({ ...s, [item.item_key]: r }))}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.15s',
                        background: val === r ? (r === 'pass' ? '#16a34a' : r === 'fail' ? '#dc2626' : '#475569') : 'rgba(255,255,255,0.05)',
                        color: val === r ? '#fff' : '#64748b',
                      }}>
                      {r === 'pass' ? '✓' : r === 'fail' ? '✗' : 'N/A'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SiteMap ───────────────────────────────────────────────────────────────────
function SiteMap({ defects }: { defects: BESSDefect[] }) {
  const colors: Record<string, string> = { critical: '#ef4444', major: '#fb923c', minor: '#facc15', observation: '#38bdf8' };
  return (
    <div style={{ position: 'relative', width: '100%', height: '220px', background: 'rgba(15,23,42,0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {/* Grid lines */}
      {[1,2,3,4].map(i => <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 20}%`, height: '1px', background: 'rgba(255,255,255,0.04)' }} />)}
      {[1,2,3,4].map(i => <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 20}%`, width: '1px', background: 'rgba(255,255,255,0.04)' }} />)}
      {/* BESS site representation */}
      <div style={{ position: 'absolute', left: '10%', top: '15%', width: '35%', height: '30%', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 600 }}>CONTAINER A</span>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '15%', width: '35%', height: '30%', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 600 }}>CONTAINER B</span>
      </div>
      <div style={{ position: 'absolute', left: '10%', top: '55%', width: '35%', height: '25%', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 600 }}>INVERTER A</span>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', width: '35%', height: '25%', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 600 }}>INVERTER B</span>
      </div>
      {/* Defect pins — distribute deterministically using index */}
      {defects.slice(0, 12).map((d, i) => {
        const x = 10 + (i * 7) % 80;
        const y = 10 + (i * 13) % 80;
        return (
          <div key={d.id} title={`${d.severity}: ${d.defect_category} — ${d.description}`}
            style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: '14px', height: '14px', borderRadius: '50%', background: colors[d.severity] || '#94a3b8', border: '2px solid rgba(0,0,0,0.4)', cursor: 'pointer', transform: 'translate(-50%,-50%)', boxShadow: `0 0 8px ${colors[d.severity]}60`, zIndex: 10 }} />
        );
      })}
      {defects.length === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#475569', fontSize: '13px' }}>No defects logged yet</span></div>}
      {/* Legend */}
      <div style={{ position: 'absolute', bottom: '6px', right: '8px', display: 'flex', gap: '8px' }}>
        {Object.entries(colors).map(([sev, col]) => (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col }} />
            <span style={{ fontSize: '10px', color: '#64748b' }}>{sev}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
