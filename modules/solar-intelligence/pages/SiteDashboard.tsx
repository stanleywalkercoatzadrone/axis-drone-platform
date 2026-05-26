import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Zap, Calendar, AlertTriangle, Thermometer, Layers,
  TrendingUp, CheckCircle, Plus, FileText, Loader2, ChevronRight,
  MapPin, Star
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SolarSite {
  id: string;
  site_name: string;
  client_name?: string;
  location_description?: string;
  capacity_mw?: number;
  status: string;
  epc_contractor?: string;
  owner_name?: string;
  cod_target?: string;
}

interface Survey {
  id: string;
  survey_date: string;
  flight_date?: string;
  data_quality?: string;
  gsd_cm?: number;
  area_hectares?: number;
  total_images?: number;
  images_reconstructed?: number;
  processing_engine?: string;
  created_at: string;
}

interface Progress {
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
  overall_progress_pct?: number;
  created_at?: string;
}

interface Issue {
  id: string;
  title: string;
  severity: string;
  issue_type?: string;
  status: string;
  created_at: string;
}

interface ThermalFinding {
  id: string;
  finding_type: string;
  severity: string;
  delta_t_celsius?: number;
  module_id?: string;
  string_id?: string;
  status: string;
  created_at: string;
}

interface Props {
  siteId: string;
  onNavigate: (tab: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  planning:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  construction: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  operational:  { color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
  decommissioned:{ color: '#64748b',bg: 'rgba(100,116,139,0.15)'},
};

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
};

const QUALITY_COLOR: Record<string, string> = {
  excellent: '#22c55e', good: '#3b82f6', acceptable: '#f59e0b', poor: '#ef4444',
};

const pct = (inst?: number, plan?: number): number => {
  if (!plan || plan === 0) return 0;
  return Math.min(100, ((inst ?? 0) / plan) * 100);
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, iconBg, iconColor }) => (
  <div
    style={{
      background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)',
      border: '1px solid rgba(51,65,85,0.7)',
      backdropFilter: 'blur(12px)',
    }}
    className="rounded-2xl p-4 flex items-center gap-4"
  >
    <div
      style={{ background: iconBg, border: `1px solid ${iconColor}30` }}
      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
      aria-hidden
    >
      <span style={{ color: iconColor }}>{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-slate-400 text-xs font-medium truncate">{label}</p>
      <p className="text-white text-xl font-bold leading-tight">{value}</p>
      {sub && <p className="text-slate-500 text-xs">{sub}</p>}
    </div>
  </div>
);

// ─── Progress Bar ────────────────────────────────────────────────────────────

interface ProgressBarProps {
  label: string;
  planned?: number;
  installed?: number;
  unit?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, planned, installed, unit = '' }) => {
  const p = pct(installed, planned);
  const color = p === 100 ? '#22c55e' : p >= 75 ? '#3b82f6' : p >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-slate-300 font-medium">{label}</span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">
            {(installed ?? 0).toLocaleString()}{unit} / {(planned ?? 0).toLocaleString()}{unit}
          </span>
          <span className="text-white font-bold w-10 text-right">{p.toFixed(0)}%</span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          style={{ width: `${p}%`, background: color, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }}
          className="h-full rounded-full"
        />
      </div>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const SiteDashboard: React.FC<Props> = ({ siteId, onNavigate }) => {
  const [site, setSite]         = useState<SolarSite | null>(null);
  const [surveys, setSurveys]   = useState<Survey[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [issues, setIssues]     = useState<Issue[]>([]);
  const [thermal, setThermal]   = useState<ThermalFinding[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [siteRes, surveysRes, progressRes, issuesRes, thermalRes] = await Promise.allSettled([
        apiClient.get(`/api/solar-farm/sites/${siteId}`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/surveys`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/progress`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/issues?status=open`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/thermal?status=open`),
      ]);

      if (siteRes.status === 'fulfilled') setSite(siteRes.value.data);
      if (surveysRes.status === 'fulfilled') setSurveys(surveysRes.value.data ?? []);
      if (progressRes.status === 'fulfilled') {
        const d = progressRes.value.data;
        setProgress(Array.isArray(d) ? d[0] ?? null : d ?? null);
      }
      if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value.data ?? []);
      if (thermalRes.status === 'fulfilled') setThermal(thermalRes.value.data ?? []);
    } catch {
      setError('Some data failed to load');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Demo fallback
  const displaySite = site ?? {
    id: siteId, site_name: 'Demo Solar Site', client_name: 'SunPower Capital',
    location_description: 'Sonora, CA', capacity_mw: 120, status: 'construction',
    epc_contractor: 'Mesa Energy Group', owner_name: 'SunPower Capital LLC', cod_target: '2025-09-30',
  };

  const displayProgress = progress ?? {
    piles_planned: 4200, piles_installed: 3100,
    tracker_rows_planned: 680, tracker_rows_installed: 510,
    modules_planned: 28000, modules_installed: 17500,
    inverter_pads_planned: 8, inverter_pads_installed: 6,
    overall_progress_pct: 62,
  };

  const overallPct = displayProgress.overall_progress_pct
    ?? pct(displayProgress.modules_installed, displayProgress.modules_planned);

  const siteStatus = displaySite.status as string;
  const statusCfg = STATUS_COLOR[siteStatus] ?? STATUS_COLOR.planning;

  const openIssues = issues.slice(0, 5);
  const openThermal = thermal.slice(0, 5);

  const sortedSurveys = [...surveys].sort(
    (a, b) => new Date(b.survey_date).getTime() - new Date(a.survey_date).getTime()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Site header + actions */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-white">{displaySite.site_name}</h2>
            <span
              style={{ color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.color}33` }}
              className="text-xs font-semibold px-3 py-1 rounded-full"
            >
              {siteStatus.charAt(0).toUpperCase() + siteStatus.slice(1)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-400">
            {displaySite.client_name && (
              <span className="flex items-center gap-1"><Building2 size={13} /> {displaySite.client_name}</span>
            )}
            {displaySite.location_description && (
              <span className="flex items-center gap-1"><MapPin size={13} /> {displaySite.location_description}</span>
            )}
            {displaySite.capacity_mw && (
              <span className="flex items-center gap-1"><Zap size={13} className="text-amber-400" /> {displaySite.capacity_mw} MW</span>
            )}
            {displaySite.epc_contractor && (
              <span className="flex items-center gap-1"><Building2 size={13} /> EPC: {displaySite.epc_contractor}</span>
            )}
            {displaySite.cod_target && (
              <span className="flex items-center gap-1"><Calendar size={13} /> COD: {new Date(displaySite.cod_target).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onNavigate('intake')}
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-all"
          >
            <Plus size={14} /> Add Survey
          </button>
          <button
            onClick={() => onNavigate('qaqc')}
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
          >
            <AlertTriangle size={14} /> Add Issue
          </button>
          <button
            onClick={() => onNavigate('reports')}
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-purple-400 text-sm font-medium hover:bg-purple-500/20 transition-all"
          >
            <FileText size={14} /> Generate Report
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          ⚠ {error} — showing demo data
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Modules"
          value={`${pct(displayProgress.modules_installed, displayProgress.modules_planned).toFixed(0)}%`}
          sub={`${(displayProgress.modules_installed ?? 0).toLocaleString()} installed`}
          icon={<Layers size={20} />}
          iconBg="rgba(59,130,246,0.15)"
          iconColor="#3b82f6"
        />
        <StatCard
          label="Tracker Rows"
          value={`${pct(displayProgress.tracker_rows_installed, displayProgress.tracker_rows_planned).toFixed(0)}%`}
          sub={`${(displayProgress.tracker_rows_installed ?? 0).toLocaleString()} installed`}
          icon={<TrendingUp size={20} />}
          iconBg="rgba(168,85,247,0.15)"
          iconColor="#a855f7"
        />
        <StatCard
          label="Piles"
          value={`${pct(displayProgress.piles_installed, displayProgress.piles_planned).toFixed(0)}%`}
          sub={`${(displayProgress.piles_installed ?? 0).toLocaleString()} driven`}
          icon={<CheckCircle size={20} />}
          iconBg="rgba(34,197,94,0.15)"
          iconColor="#22c55e"
        />
        <StatCard
          label="Open Issues"
          value={issues.length}
          sub="QA/QC findings"
          icon={<AlertTriangle size={20} />}
          iconBg={issues.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}
          iconColor={issues.length > 0 ? '#ef4444' : '#22c55e'}
        />
        <StatCard
          label="Thermal"
          value={thermal.length}
          sub="Open findings"
          icon={<Thermometer size={20} />}
          iconBg={thermal.length > 0 ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.15)'}
          iconColor={thermal.length > 0 ? '#f97316' : '#22c55e'}
        />
        <StatCard
          label="Surveys"
          value={surveys.length}
          sub={surveys.length > 0 ? `Latest ${new Date(surveys[0]?.survey_date ?? Date.now()).toLocaleDateString()}` : 'No surveys yet'}
          icon={<Star size={20} />}
          iconBg="rgba(245,158,11,0.15)"
          iconColor="#f59e0b"
        />
      </div>

      {/* ── Progress Section ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)',
          border: '1px solid rgba(51,65,85,0.7)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-400" /> Construction Progress
          </h3>
          <button
            onClick={() => onNavigate('progress')}
            className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            View details <ChevronRight size={14} />
          </button>
        </div>

        {/* Overall progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300 font-semibold">Overall Progress</span>
            <span className="text-white font-bold text-lg">{overallPct.toFixed(0)}%</span>
          </div>
          <div className="w-full h-4 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              style={{
                width: `${overallPct}%`,
                background: overallPct === 100
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                transition: 'width 1.2s ease',
                boxShadow: overallPct > 0 ? '0 0 10px rgba(59,130,246,0.4)' : 'none',
              }}
              className="h-full rounded-full"
            />
          </div>
        </div>

        <div className="space-y-4">
          <ProgressBar label="Piles" planned={displayProgress.piles_planned} installed={displayProgress.piles_installed} />
          <ProgressBar label="Tracker Rows" planned={displayProgress.tracker_rows_planned} installed={displayProgress.tracker_rows_installed} />
          <ProgressBar label="Solar Modules" planned={displayProgress.modules_planned} installed={displayProgress.modules_installed} />
          <ProgressBar label="Inverter Pads" planned={displayProgress.inverter_pads_planned} installed={displayProgress.inverter_pads_installed} />
        </div>
      </div>

      {/* ── Bottom two-column ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open QA/QC Issues */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)',
            border: '1px solid rgba(51,65,85,0.7)',
            backdropFilter: 'blur(12px)',
          }}
          className="rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" /> Open QA/QC Issues
            </h3>
            <button
              onClick={() => onNavigate('qaqc')}
              className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>

          {openIssues.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No open issues</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openIssues.map(issue => (
                <div
                  key={issue.id}
                  style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)' }}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                >
                  <span
                    style={{
                      color: SEV_COLOR[issue.severity] ?? '#64748b',
                      background: `${SEV_COLOR[issue.severity] ?? '#64748b'}1a`,
                      border: `1px solid ${SEV_COLOR[issue.severity] ?? '#64748b'}33`,
                    }}
                    className="text-xs font-bold px-2 py-0.5 rounded capitalize flex-shrink-0"
                  >
                    {issue.severity}
                  </span>
                  <span className="text-slate-200 text-sm truncate flex-1">{issue.title}</span>
                  <span className="text-slate-500 text-xs flex-shrink-0">
                    {issue.created_at && new Date(issue.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thermal Findings */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)',
            border: '1px solid rgba(51,65,85,0.7)',
            backdropFilter: 'blur(12px)',
          }}
          className="rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Thermometer size={16} className="text-orange-400" /> Thermal Findings
            </h3>
            <button
              onClick={() => onNavigate('thermal')}
              className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>

          {openThermal.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No thermal findings</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openThermal.map(f => (
                <div
                  key={f.id}
                  style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)' }}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                >
                  <span
                    style={{
                      color: SEV_COLOR[f.severity] ?? '#64748b',
                      background: `${SEV_COLOR[f.severity] ?? '#64748b'}1a`,
                      border: `1px solid ${SEV_COLOR[f.severity] ?? '#64748b'}33`,
                    }}
                    className="text-xs font-bold px-2 py-0.5 rounded capitalize flex-shrink-0"
                  >
                    {f.severity}
                  </span>
                  <span className="text-slate-200 text-sm flex-1 truncate capitalize">
                    {f.finding_type.replace(/_/g, ' ')}
                    {f.module_id && <span className="text-slate-500"> · {f.module_id}</span>}
                  </span>
                  {f.delta_t_celsius != null && (
                    <span className="text-orange-400 text-xs font-bold flex-shrink-0">
                      +{f.delta_t_celsius}°C
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Survey Timeline ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)',
          border: '1px solid rgba(51,65,85,0.7)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Calendar size={16} className="text-blue-400" /> Survey Timeline
          </h3>
          <button
            onClick={() => onNavigate('intake')}
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-all"
          >
            <Plus size={12} /> Add Survey
          </button>
        </div>

        {sortedSurveys.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No surveys yet for this site</div>
        ) : (
          <div className="space-y-3">
            {sortedSurveys.map((survey, idx) => {
              const qual = survey.data_quality ?? 'good';
              const qualColor = QUALITY_COLOR[qual] ?? '#3b82f6';
              return (
                <div
                  key={survey.id}
                  style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)' }}
                  className="rounded-xl px-4 py-3 flex items-center gap-4"
                >
                  <div
                    style={{ background: idx === 0 ? 'rgba(59,130,246,0.2)' : 'rgba(51,65,85,0.4)' }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-slate-300 text-xs font-bold"
                  >
                    {sortedSurveys.length - idx}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">
                        {new Date(survey.survey_date).toLocaleDateString()}
                      </span>
                      <span
                        style={{ color: qualColor, background: `${qualColor}1a`, border: `1px solid ${qualColor}33` }}
                        className="text-xs font-semibold px-2 py-0.5 rounded capitalize"
                      >
                        {qual}
                      </span>
                      {survey.processing_engine && (
                        <span className="text-slate-500 text-xs hidden sm:inline">{survey.processing_engine}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-0.5 text-slate-500 text-xs">
                      {survey.gsd_cm && <span>GSD: {survey.gsd_cm} cm</span>}
                      {survey.area_hectares && <span>{survey.area_hectares} ha</span>}
                      {survey.total_images && <span>{survey.total_images.toLocaleString()} images</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('map')}
                    className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors flex-shrink-0"
                  >
                    View Map <ChevronRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteDashboard;
