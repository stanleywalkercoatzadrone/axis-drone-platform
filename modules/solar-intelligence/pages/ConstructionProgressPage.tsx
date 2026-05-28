import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Plus, X, Loader2, CheckCircle, Calendar
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProgressSnapshot {
  id: string;
  survey_id?: string;
  piles_planned?: number;
  piles_installed?: number;
  tracker_rows_planned?: number;
  tracker_rows_installed?: number;
  modules_planned?: number;
  modules_installed?: number;
  inverter_pads_planned?: number;
  inverter_pads_installed?: number;
  roads_planned_m?: number;
  roads_installed_m?: number;
  blocks_planned?: number;
  blocks_installed?: number;
  overall_progress_pct?: number;
  created_at: string;
}

interface Survey {
  id: string;
  survey_date: string;
}

interface UpdateForm {
  piles_installed: string;
  tracker_rows_installed: string;
  modules_installed: string;
  inverter_pads_installed: string;
  roads_installed_m: string;
  blocks_installed: string;
}

interface Props { siteId: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pct = (inst?: number, plan?: number): number => {
  if (!plan || plan === 0) return 0;
  return Math.min(100, ((inst ?? 0) / plan) * 100);
};

const colorForPct = (p: number): string => {
  if (p === 100) return '#22c55e';
  if (p >= 75)  return '#3b82f6';
  if (p >= 40)  return '#f59e0b';
  return '#ef4444';
};

// ─── Progress Row Component ───────────────────────────────────────────────────

interface ProgRowProps {
  label: string;
  planned?: number;
  installed?: number;
  unit?: string;
  icon?: React.ReactNode;
}

const ProgRow: React.FC<ProgRowProps> = ({ label, planned, installed, unit = '', icon }) => {
  const p = pct(installed, planned);
  const color = colorForPct(p);
  const remaining = Math.max(0, (planned ?? 0) - (installed ?? 0));

  return (
    <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }} className="hover:bg-slate-800/20 transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span className="text-slate-200 text-sm font-medium">{label}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-slate-300 text-sm text-right">{(planned ?? 0).toLocaleString()}{unit}</td>
      <td className="px-4 py-3.5 text-white text-sm font-medium text-right">{(installed ?? 0).toLocaleString()}{unit}</td>
      <td className="px-4 py-3.5 text-slate-400 text-sm text-right">{remaining.toLocaleString()}{unit}</td>
      <td className="px-4 py-3.5" style={{ minWidth: 160 }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-700/60 rounded-full overflow-hidden">
            <div style={{ width: `${p}%`, background: color, transition: 'width 1.2s ease' }} className="h-full rounded-full" />
          </div>
          <span style={{ color }} className="text-xs font-bold w-10 text-right">{p.toFixed(0)}%</span>
        </div>
      </td>
    </tr>
  );
};

// ─── Overall Circle ───────────────────────────────────────────────────────────

const OverallCircle: React.FC<{ pct: number }> = ({ pct: p }) => {
  const r = 56;
  const circ = 2 * Math.PI * r;
  const dash = (p / 100) * circ;
  const color = colorForPct(p);

  return (
    <div className="flex flex-col items-center justify-center">
      <div style={{ position: 'relative', width: 144, height: 144 }}>
        <svg width="144" height="144" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(51,65,85,0.5)" strokeWidth="10" />
          <circle
            cx="72" cy="72" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: 'stroke-dasharray 1.5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span className="text-white font-black text-3xl leading-none">{p.toFixed(0)}</span>
          <span className="text-slate-400 text-xs mt-0.5">%</span>
        </div>
      </div>
      <p className="text-slate-400 text-sm mt-2">Overall Progress</p>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const BLANK_UPDATE: UpdateForm = {
  piles_installed: '', tracker_rows_installed: '', modules_installed: '',
  inverter_pads_installed: '', roads_installed_m: '', blocks_installed: '',
};



const ConstructionProgressPage: React.FC<Props> = ({ siteId }) => {
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [surveys, setSurveys]     = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<UpdateForm>(BLANK_UPDATE);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [snapRes, surRes] = await Promise.allSettled([
        apiClient.get(`/api/solar-farm/sites/${siteId}/progress`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/surveys`),
      ]);
      if (snapRes.status === 'fulfilled') setSnapshots(snapRes.value.data ?? []);
      else setSnapshots([]);
      if (surRes.status === 'fulfilled') {
        const s: Survey[] = surRes.value.data ?? [];
        setSurveys(s);
        if (s.length > 0 && !selectedSurveyId) setSelectedSurveyId(s[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Latest snapshot (most recent by created_at)
  const latestSnapshot = snapshots.length > 0
    ? [...snapshots].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;

  const overallPct = latestSnapshot
    ? (latestSnapshot.overall_progress_pct ?? pct(latestSnapshot.modules_installed, latestSnapshot.modules_planned))
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurveyId) { setFormError('Please select a survey'); return; }
    try {
      setSubmitting(true);
      setFormError(null);
      await apiClient.post(`/api/solar-farm/surveys/${selectedSurveyId}/progress`, {
        piles_installed: form.piles_installed ? parseInt(form.piles_installed) : 0,
        tracker_rows_installed: form.tracker_rows_installed ? parseInt(form.tracker_rows_installed) : 0,
        modules_installed: form.modules_installed ? parseInt(form.modules_installed) : 0,
        inverter_pads_installed: form.inverter_pads_installed ? parseInt(form.inverter_pads_installed) : 0,
        roads_installed_m: form.roads_installed_m ? parseFloat(form.roads_installed_m) : 0,
        blocks_installed: form.blocks_installed ? parseInt(form.blocks_installed) : 0,
        // Pass through planned from existing
        piles_planned: latestSnapshot.piles_planned,
        tracker_rows_planned: latestSnapshot.tracker_rows_planned,
        modules_planned: latestSnapshot.modules_planned,
        inverter_pads_planned: latestSnapshot.inverter_pads_planned,
        roads_planned_m: latestSnapshot.roads_planned_m,
        blocks_planned: latestSnapshot.blocks_planned,
      });
      setShowModal(false);
      setForm(BLANK_UPDATE);
      await fetchData();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Failed to update progress');
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
    border: '1px solid rgba(51,65,85,0.7)',
    backdropFilter: 'blur(12px)',
  };
  const inputCls = "w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={22} className="text-blue-400" /> Construction Progress
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">{snapshots.length} snapshots recorded</p>
        </div>
        <div className="flex items-center gap-3">
          {surveys.length > 0 && (
            <select value={selectedSurveyId} onChange={e => setSelectedSurveyId(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
              {surveys.map(s => (
                <option key={s.id} value={s.id}>{new Date(s.survey_date).toLocaleDateString()}</option>
              ))}
            </select>
          )}
          <button onClick={() => setShowModal(true)}
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 shadow-lg shadow-blue-500/20">
            <Plus size={14} /> Update Progress
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">⚠ {error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="text-blue-500 animate-spin" /></div>
      ) : !latestSnapshot ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <p className="text-sm font-semibold">No progress snapshots recorded yet</p>
          <p className="text-xs text-slate-600">Use “Update Progress” to log your first construction snapshot.</p>
        </div>
      ) : (
        <>
          {/* Overall + breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            {/* Circle */}
            <div style={cardStyle} className="rounded-2xl p-6 flex items-center justify-center">
              <OverallCircle pct={overallPct} />
            </div>

            {/* Quick stats */}
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Piles Driven', inst: latestSnapshot.piles_installed, plan: latestSnapshot.piles_planned },
                { label: 'Tracker Rows', inst: latestSnapshot.tracker_rows_installed, plan: latestSnapshot.tracker_rows_planned },
                { label: 'Modules',      inst: latestSnapshot.modules_installed,      plan: latestSnapshot.modules_planned },
                { label: 'Inverter Pads',inst: latestSnapshot.inverter_pads_installed,plan: latestSnapshot.inverter_pads_planned },
                { label: 'Roads (m)',    inst: latestSnapshot.roads_installed_m,       plan: latestSnapshot.roads_planned_m },
                { label: 'Blocks',       inst: latestSnapshot.blocks_installed,        plan: latestSnapshot.blocks_planned },
              ].map(({ label, inst, plan }) => {
                const p = pct(inst, plan);
                const color = colorForPct(p);
                return (
                  <div key={label} style={cardStyle} className="rounded-xl p-3.5">
                    <p className="text-slate-400 text-xs mb-1">{label}</p>
                    <p className="text-white font-bold text-lg">{(inst ?? 0).toLocaleString()}</p>
                    <p className="text-slate-500 text-xs">of {(plan ?? 0).toLocaleString()}</p>
                    <div className="mt-2 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div style={{ width: `${p}%`, background: color, transition: 'width 1.2s ease' }} className="h-full rounded-full" />
                    </div>
                    <p style={{ color }} className="text-xs font-bold mt-1">{p.toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed table */}
          <div style={cardStyle} className="rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-white font-bold">Progress Breakdown</h3>
              <span className="text-slate-400 text-xs">
                as of {latestSnapshot.created_at && new Date(latestSnapshot.created_at).toLocaleDateString()}
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                  {['Category', 'Planned', 'Installed', 'Remaining', '% Complete'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${h !== 'Category' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ProgRow label="Piles" planned={latestSnapshot.piles_planned} installed={latestSnapshot.piles_installed} />
                <ProgRow label="Tracker Rows" planned={latestSnapshot.tracker_rows_planned} installed={latestSnapshot.tracker_rows_installed} />
                <ProgRow label="Solar Modules" planned={latestSnapshot.modules_planned} installed={latestSnapshot.modules_installed} />
                <ProgRow label="Inverter Pads" planned={latestSnapshot.inverter_pads_planned} installed={latestSnapshot.inverter_pads_installed} />
                <ProgRow label="Roads" planned={latestSnapshot.roads_planned_m} installed={latestSnapshot.roads_installed_m} unit=" m" />
                <ProgRow label="Blocks" planned={latestSnapshot.blocks_planned} installed={latestSnapshot.blocks_installed} />
              </tbody>
            </table>
          </div>

          {/* Timeline */}
          <div style={cardStyle} className="rounded-2xl p-5">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-blue-400" /> Progress Timeline
            </h3>
            {snapshots.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No historical snapshots yet</p>
            ) : (
              <div className="space-y-3">
                {[...snapshots].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((snap, idx) => {
                  const p = snap.overall_progress_pct ?? pct(snap.modules_installed, snap.modules_planned);
                  const color = colorForPct(p);
                  return (
                    <div key={snap.id} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.4)' }}
                      className="rounded-xl px-4 py-3 flex items-center gap-4">
                      <div style={{ background: idx === 0 ? 'rgba(59,130,246,0.2)' : 'rgba(51,65,85,0.3)' }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 text-xs font-bold flex-shrink-0">
                        {snapshots.length - idx}
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-300 text-sm">{new Date(snap.created_at).toLocaleDateString()}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                            <div style={{ width: `${p}%`, background: color }} className="h-full rounded-full" />
                          </div>
                          <span style={{ color }} className="text-xs font-bold w-10">{p.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="text-slate-500 text-xs text-right">
                        {snap.modules_installed != null && <p>{(snap.modules_installed ?? 0).toLocaleString()} modules</p>}
                        {snap.piles_installed != null && <p>{(snap.piles_installed ?? 0).toLocaleString()} piles</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Update Progress Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)',
            border: '1px solid rgba(51,65,85,0.9)', maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          }} className="rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <h3 className="text-white font-bold flex items-center gap-2"><TrendingUp size={16} className="text-blue-400" /> Update Progress</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'piles_installed', label: 'Piles Installed', plan: latestSnapshot.piles_planned },
                  { key: 'tracker_rows_installed', label: 'Tracker Rows Installed', plan: latestSnapshot.tracker_rows_planned },
                  { key: 'modules_installed', label: 'Modules Installed', plan: latestSnapshot.modules_planned },
                  { key: 'inverter_pads_installed', label: 'Inverter Pads Installed', plan: latestSnapshot.inverter_pads_planned },
                  { key: 'roads_installed_m', label: 'Roads Installed (m)', plan: latestSnapshot.roads_planned_m },
                  { key: 'blocks_installed', label: 'Blocks Installed', plan: latestSnapshot.blocks_planned },
                ].map(({ key, label, plan }) => (
                  <div key={key}>
                    <label className="block text-slate-400 text-xs font-medium mb-1.5">
                      {label}
                      {plan != null && <span className="text-slate-600 ml-1">/ {plan.toLocaleString()}</span>}
                    </label>
                    <input type="number" min="0" max={plan ?? undefined}
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className={inputCls}
                      placeholder={(latestSnapshot as any)[key]?.toString() ?? '0'} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all">Cancel</button>
                <button type="submit" disabled={submitting}
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Save Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstructionProgressPage;
