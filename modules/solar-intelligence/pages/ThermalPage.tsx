import React, { useState, useEffect, useCallback } from 'react';
import {
  Thermometer, Flame, Plus, X, Loader2, Filter, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';
type FindingStatus = 'open' | 'under_review' | 'resolved' | 'false_positive';

interface ThermalFinding {
  id: string;
  finding_type: string;
  severity: Severity;
  delta_t_celsius?: number;
  module_id?: string;
  string_id?: string;
  lat?: number;
  lng?: number;
  status: FindingStatus;
  notes?: string;
  created_at: string;
  survey_id?: string;
}

interface Survey {
  id: string;
  survey_date: string;
}

interface NewFindingForm {
  finding_type: string;
  severity: Severity;
  delta_t_celsius: string;
  module_id: string;
  string_id: string;
  lat: string;
  lng: string;
  notes: string;
}

interface Props { siteId: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  label: 'Critical' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', label: 'High'     },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', label: 'Medium'   },
  low:      { color: '#fde047', bg: 'rgba(253,224,71,0.08)', border: 'rgba(253,224,71,0.3)',  label: 'Low'      },
};

const STATUS_CONFIG: Record<FindingStatus, { color: string; bg: string }> = {
  open:          { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  under_review:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  resolved:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  false_positive:{ color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const FINDING_TYPES = [
  'hotspot', 'offline_string', 'soiling', 'shading',
  'faulty_module', 'degradation', 'other',
];

const BLANK_FORM: NewFindingForm = {
  finding_type: 'hotspot', severity: 'medium',
  delta_t_celsius: '', module_id: '', string_id: '',
  lat: '', lng: '', notes: '',
};



// ─── Badges ───────────────────────────────────────────────────────────────────

const SevBadge: React.FC<{ sev: Severity }> = ({ sev }) => {
  const c = SEV_CONFIG[sev];
  return (
    <span style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
      className="text-xs font-bold px-2 py-0.5 rounded capitalize">{sev}</span>
  );
};

const StatusBadge: React.FC<{ status: FindingStatus }> = ({ status }) => {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span style={{ color: c.color, background: c.bg }}
      className="text-xs font-semibold px-2 py-0.5 rounded capitalize">{status.replace('_', ' ')}</span>
  );
};

// ─── Kanban Card ──────────────────────────────────────────────────────────────

const KanbanCard: React.FC<{ f: ThermalFinding; sev: Severity }> = ({ f, sev }) => {
  const c = SEV_CONFIG[sev];
  return (
    <div
      style={{ background: 'rgba(15,23,42,0.6)', border: `1px solid ${c.border}` }}
      className="rounded-xl p-3 space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ color: c.color }} className="text-xs font-bold capitalize">
          {f.finding_type.replace('_', ' ')}
        </span>
        {f.delta_t_celsius != null && (
          <span style={{ color: c.color }} className="text-sm font-bold">+{f.delta_t_celsius}°C</span>
        )}
      </div>
      {(f.module_id || f.string_id) && (
        <p className="text-slate-400 text-xs">
          {f.module_id && <span>Module: {f.module_id}</span>}
          {f.module_id && f.string_id && <span className="text-slate-600"> · </span>}
          {f.string_id && <span>String: {f.string_id}</span>}
        </p>
      )}
      <div className="flex items-center justify-between">
        <StatusBadge status={f.status} />
        <span className="text-slate-600 text-xs">{f.created_at && new Date(f.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const ThermalPage: React.FC<Props> = ({ siteId }) => {
  const [findings, setFindings]   = useState<ThermalFinding[]>([]);
  const [surveys, setSurveys]     = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<NewFindingForm>(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [thermalRes, surveysRes] = await Promise.allSettled([
        apiClient.get(`/api/solar-farm/sites/${siteId}/thermal`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/surveys`),
      ]);
      if (thermalRes.status === 'fulfilled') setFindings(thermalRes.value.data ?? []);
      else setFindings([]);
      if (surveysRes.status === 'fulfilled') {
        const s: Survey[] = surveysRes.value.data ?? [];
        setSurveys(s);
        if (s.length > 0 && !selectedSurveyId) setSelectedSurveyId(s[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);
      const endpoint = selectedSurveyId
        ? `/api/solar-farm/surveys/${selectedSurveyId}/thermal`
        : `/api/solar-farm/sites/${siteId}/thermal`;
      await apiClient.post(endpoint, {
        ...form,
        delta_t_celsius: form.delta_t_celsius ? parseFloat(form.delta_t_celsius) : null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      });
      setShowModal(false);
      setForm(BLANK_FORM);
      await fetchData();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Failed to create finding');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: FindingStatus) => {
    try {
      await apiClient.patch(`/api/solar-farm/thermal/${id}`, { status });
      setFindings(prev => prev.map(f => f.id === id ? { ...f, status } : f));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this finding?')) return;
    try {
      await apiClient.delete(`/api/solar-farm/thermal/${id}`);
      setFindings(prev => prev.filter(f => f.id !== id));
    } catch {}
  };

  const counts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high:     findings.filter(f => f.severity === 'high').length,
    medium:   findings.filter(f => f.severity === 'medium').length,
    low:      findings.filter(f => f.severity === 'low').length,
  };

  const filtered = findings.filter(f => {
    if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    return true;
  });

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
    border: '1px solid rgba(51,65,85,0.7)',
    backdropFilter: 'blur(12px)',
  };

  const inputCls = "w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Thermometer size={22} className="text-orange-400" /> Thermal Analysis
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">{findings.length} findings tracked</p>
        </div>
        <div className="sm:ml-auto">
          <button onClick={() => setShowModal(true)}
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 shadow-lg shadow-orange-500/20">
            <Plus size={14} /> Add Finding
          </button>
        </div>
      </div>

      {/* Survey selector */}
      {surveys.length > 0 && (
        <div className="mb-5 flex items-center gap-2">
          <span className="text-slate-500 text-xs">Survey:</span>
          <select value={selectedSurveyId} onChange={e => setSelectedSurveyId(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500">
            <option value="">All Surveys</option>
            {surveys.map(s => (
              <option key={s.id} value={s.id}>{new Date(s.survey_date).toLocaleDateString()}</option>
            ))}
          </select>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map(s => {
          const c = SEV_CONFIG[s];
          return (
            <div key={s} onClick={() => setSevFilter(sevFilter === s ? 'all' : s)}
              style={{
                background: c.bg, border: `1px solid ${sevFilter === s ? c.color : c.border}`,
                boxShadow: sevFilter === s ? `0 0 15px ${c.color}30` : 'none', cursor: 'pointer',
              }}
              className="rounded-2xl p-4 flex items-center gap-3 transition-all hover:border-opacity-80">
              <Flame size={24} style={{ color: c.color }} />
              <div>
                <div className="text-2xl font-bold" style={{ color: c.color }}>{counts[s]}</div>
                <div className="text-xs" style={{ color: c.color }}>{c.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="text-orange-500 animate-spin" /></div>
      ) : (
        <>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Filter size={15} className="text-slate-400" /> Severity Board
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {(['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => {
              const c = SEV_CONFIG[sev];
              const col = findings.filter(f => f.severity === sev);
              return (
                <div key={sev}
                  style={{ background: 'rgba(15,23,42,0.4)', border: `1px solid ${c.border}` }}
                  className="rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ color: c.color }} className="text-xs font-bold uppercase tracking-wide">{sev}</span>
                    <span style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
                      className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.length === 0 ? (
                      <p className="text-slate-600 text-xs text-center py-4">No findings</p>
                    ) : (
                      col.map(f => <KanbanCard key={f.id} f={f} sev={sev} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter bar */}
          <div style={cardStyle} className="rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
            <span className="text-slate-500 text-xs font-medium">Filter:</span>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                <button key={s} onClick={() => setSevFilter(s)}
                  style={sevFilter === s ? { background: '#3b82f6', color: 'white' } : {}}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${sevFilter === s ? '' : 'text-slate-400 border border-slate-700 hover:border-slate-500'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-slate-700" />
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'open', 'under_review', 'resolved', 'false_positive'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={statusFilter === s ? { background: '#3b82f6', color: 'white' } : {}}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${statusFilter === s ? '' : 'text-slate-400 border border-slate-700 hover:border-slate-500'}`}>
                  {s === 'all' ? 'All Status' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={cardStyle} className="rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.7)', background: 'rgba(15,23,42,0.5)' }}>
                  {['Type', 'Module', 'String', 'ΔT°C', 'Severity', 'Status', 'Survey Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <React.Fragment key={f.id}>
                    <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
                      <td className="px-4 py-3 text-slate-200 text-sm capitalize">{f.finding_type.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{f.module_id ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{f.string_id ?? '—'}</td>
                      <td className="px-4 py-3 text-orange-400 font-bold text-sm">
                        {f.delta_t_celsius != null ? `+${f.delta_t_celsius}` : '—'}
                      </td>
                      <td className="px-4 py-3"><SevBadge sev={f.severity} /></td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{f.created_at && new Date(f.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <select value={f.status}
                            onChange={e => handleStatusChange(f.id, e.target.value as FindingStatus)}
                            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 focus:outline-none focus:border-blue-500">
                            {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                          <button onClick={() => handleDelete(f.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                          {expandedId === f.id ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                        </div>
                      </td>
                    </tr>
                    {expandedId === f.id && (
                      <tr style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Notes</p>
                              <p className="text-slate-200">{f.notes ?? 'No additional notes.'}</p>
                            </div>
                            {(f.lat || f.lng) && (
                              <div>
                                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">GPS Coordinates</p>
                                <p className="text-slate-200 font-mono text-xs">{f.lat?.toFixed(6)}, {f.lng?.toFixed(6)}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500 text-sm">No findings match the current filters</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Floating Add */}
      <button onClick={() => setShowModal(true)}
        style={{
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          boxShadow: '0 0 20px rgba(249,115,22,0.5)',
          position: 'fixed', bottom: 32, right: 32,
        }}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform z-30">
        <Plus size={24} />
      </button>

      {/* ── Add Finding Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)',
            border: '1px solid rgba(51,65,85,0.9)', maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          }} className="rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <h3 className="text-white font-bold flex items-center gap-2"><Thermometer size={16} className="text-orange-400" /> Add Thermal Finding</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Finding Type</label>
                  <select value={form.finding_type} onChange={e => setForm(f => ({ ...f, finding_type: e.target.value }))} className={inputCls}>
                    {FINDING_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Severity</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Temperature Delta (°C)</label>
                  <input type="number" step="0.1" placeholder="42.5" value={form.delta_t_celsius}
                    onChange={e => setForm(f => ({ ...f, delta_t_celsius: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Module ID</label>
                  <input type="text" placeholder="B4-R22-M14" value={form.module_id}
                    onChange={e => setForm(f => ({ ...f, module_id: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">String ID</label>
                  <input type="text" placeholder="STR-022" value={form.string_id}
                    onChange={e => setForm(f => ({ ...f, string_id: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Latitude</label>
                  <input type="number" step="0.000001" placeholder="32.1234" value={form.lat}
                    onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Longitude</label>
                  <input type="number" step="0.000001" placeholder="-110.5678" value={form.lng}
                    onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Notes</label>
                  <textarea rows={3} value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className={`${inputCls} resize-none`} placeholder="Additional observations…" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all">Cancel</button>
                <button type="submit" disabled={submitting}
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Create Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThermalPage;
