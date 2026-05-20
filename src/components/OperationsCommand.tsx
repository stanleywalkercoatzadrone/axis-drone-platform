/**
 * OperationsCommand.tsx
 * Enterprise Mission Intelligence System — Operations Command view.
 * Fetches real deployment data from the existing /deployments API,
 * adapts it to the MissionRecord shape, and renders the premium command UI.
 * Falls back to demo data if the API is unavailable.
 *
 * Safe to drop in alongside DeploymentTracker — does not modify any
 * backend routes, auth, or existing component logic.
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, ChevronRight, CircleDollarSign, Database, Eye, FileBarChart2,
  FolderOpen, MapPinned, Radar, ShieldAlert, SunMedium, Users, Wrench,
  Activity, Bot, AlertTriangle, CheckCircle2, Clock3, PlayCircle,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { Deployment, DeploymentStatus } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type MissionStatus = 'scheduled' | 'active' | 'at_risk' | 'blocked' | 'completed';

interface MissionRecord {
  id: string;
  operation: string;
  workType: string;
  client: string;
  site: string;
  location: string;
  schedule: string;
  teamCount: number;
  status: MissionStatus;
  progress: number;
  kmlUploaded: boolean;
  rgbUploaded: boolean;
  thermalUploaded: boolean;
  lbdProgress: number;
  budget?: number;
  actual?: number;
  // raw ref so detail view can still open DeploymentTracker
  _raw?: Deployment;
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo fallback
// ─────────────────────────────────────────────────────────────────────────────

const DEMO: MissionRecord[] = [
  { id: 'C05DB7BB', operation: 'Commissioning', workType: 'Maintenance Verification', client: '—', site: 'Gaia Solar', location: 'Kerens', schedule: '2026-03-30', teamCount: 1, status: 'scheduled', progress: 8, kmlUploaded: true, rgbUploaded: false, thermalUploaded: false, lbdProgress: 0, budget: 2400, actual: 0 },
  { id: '1178AEE1', operation: 'Commissioning', workType: 'Routine Inspection', client: '—', site: 'Walker Springs', location: 'Walker Springs', schedule: '2026-03-12', teamCount: 2, status: 'completed', progress: 100, kmlUploaded: true, rgbUploaded: true, thermalUploaded: true, lbdProgress: 100, budget: 3200, actual: 2900 },
  { id: '47A32715', operation: 'Site Inspection', workType: 'Routine Inspection', client: '—', site: 'Storey Bend', location: 'St. Cloud, FL', schedule: '2026-03-09', teamCount: 1, status: 'at_risk', progress: 42, kmlUploaded: true, rgbUploaded: true, thermalUploaded: false, lbdProgress: 35, budget: 2100, actual: 1500 },
  { id: '8357C791', operation: 'Site Inspection', workType: 'Routine Inspection', client: '—', site: 'Harmony', location: 'St. Cloud, FL', schedule: '2026-03-09', teamCount: 0, status: 'blocked', progress: 12, kmlUploaded: false, rgbUploaded: false, thermalUploaded: false, lbdProgress: 0, budget: 1800, actual: 300 },
  { id: 'D14B08BA', operation: 'IR / RGB', workType: 'Routine Inspection', client: '—', site: 'Midpoint', location: 'Blum, Texas', schedule: '2026-01-05', teamCount: 2, status: 'active', progress: 71, kmlUploaded: true, rgbUploaded: true, thermalUploaded: true, lbdProgress: 78, budget: 5300, actual: 4100 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Adapter — maps Deployment → MissionRecord
// ─────────────────────────────────────────────────────────────────────────────

function adaptStatus(s: DeploymentStatus | string): MissionStatus {
  const v = (s || '').toLowerCase();
  if (v === 'active') return 'active';
  if (v === 'completed' || v === 'archived') return 'completed';
  if (v === 'delayed') return 'at_risk';
  if (v === 'cancelled') return 'blocked';
  if (v === 'review') return 'active';
  return 'scheduled'; // draft / scheduled
}

function adaptDeployment(d: Deployment): MissionRecord {
  // Infer data-readiness from files list if present
  const files = d.files || [];
  const hasKml     = files.some(f => f.name?.toLowerCase().includes('kml') || f.type?.toLowerCase().includes('kml'));
  const hasRgb     = files.some(f => f.name?.toLowerCase().match(/rgb|visual|ortho/i));
  const hasThermal = files.some(f => f.name?.toLowerCase().match(/thermal|ir|infrared/i));

  // Progress heuristic: completed=100, review=90, active=50+fileCount, scheduled=10, draft=0
  const rawStatus = d.status;
  let progress = 0;
  if (rawStatus === DeploymentStatus.COMPLETED || rawStatus === DeploymentStatus.ARCHIVED) progress = 100;
  else if (rawStatus === DeploymentStatus.REVIEW) progress = 90;
  else if (rawStatus === DeploymentStatus.ACTIVE) progress = Math.min(85, 40 + (d.fileCount || 0) * 5);
  else if (rawStatus === DeploymentStatus.SCHEDULED) progress = 10;

  return {
    id:           d.id.slice(0, 8).toUpperCase(),
    operation:    d.title || 'Mission',
    workType:     d.type  || 'Inspection',
    client:       d.clientName || '—',
    site:         d.siteName   || '—',
    location:     d.location   || '—',
    schedule:     d.date       || '—',
    teamCount:    d.personnelCount ?? d.technicianIds?.length ?? 0,
    status:       adaptStatus(d.status),
    progress,
    kmlUploaded:     hasKml    || (d.fileCount ?? 0) > 0,
    rgbUploaded:     hasRgb,
    thermalUploaded: hasThermal,
    lbdProgress:     rawStatus === DeploymentStatus.COMPLETED ? 100 : Math.round(progress * 0.8),
    budget:       d.baseCost      ?? undefined,
    actual:       d.clientPrice   ?? undefined,
    _raw: d,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' '); }

function fmt(v?: number) {
  if (typeof v !== 'number') return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function statusCfg(s: MissionStatus) {
  switch (s) {
    case 'scheduled': return { label: 'Scheduled', dot: 'bg-sky-400',     badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',         Icon: Clock3 };
    case 'active':    return { label: 'Active',    dot: 'bg-emerald-400 animate-pulse', badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', Icon: PlayCircle };
    case 'at_risk':   return { label: 'At Risk',   dot: 'bg-amber-400',   badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',   Icon: AlertTriangle };
    case 'blocked':   return { label: 'Blocked',   dot: 'bg-rose-400',    badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',      Icon: ShieldAlert };
    case 'completed': return { label: 'Completed', dot: 'bg-zinc-400',    badge: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',      Icon: CheckCircle2 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function AssetChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium',
      active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-400' : 'bg-zinc-600')} />
      {label}
    </span>
  );
}

function ProgressBar({ value = 0, danger }: { value?: number; danger?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
        <span>Progress</span><span>{v}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
        <div className={cn('h-full rounded-full transition-all duration-500',
          danger ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400')}
          style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext, icon: Icon }: { label: string; value: string | number; subtext?: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
      {subtext && <div className="mt-1 text-sm text-zinc-400">{subtext}</div>}
    </div>
  );
}

function IntelligenceCard({ title, value, subtext, icon: Icon, accent }: { title: string; value: string; subtext: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-950 to-black p-4">
      <div className="pointer-events-none absolute inset-0 opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white"><Icon className="h-4 w-4" /></div>
          <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
        </div>
        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</div>
        <div className="mt-2 text-xl font-semibold text-white">{value}</div>
        <div className="mt-1 text-sm text-zinc-400">{subtext}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onViewMission?: (m: MissionRecord) => void;
  onScheduleMission?: () => void;
  onOpenData?: (m: MissionRecord) => void;
  onOpenFinance?: (m: MissionRecord) => void;
  onAssignCrew?: (m: MissionRecord) => void;
  onViewMap?: (m: MissionRecord) => void;
}

export default function OperationsCommand({
  onViewMission,
  onScheduleMission,
  onOpenData,
  onOpenFinance,
  onAssignCrew,
  onViewMap,
}: Props) {
  const [rawData, setRawData]   = useState<MissionRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [tab, setTab]           = useState<'all' | 'scheduled' | 'active' | 'completed' | 'exceptions'>('all');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get('/deployments');
      const deployments: Deployment[] = Array.isArray(res.data)
        ? res.data
        : (res.data?.data ?? res.data?.deployments ?? []);
      setRawData(deployments.map(adaptDeployment));
      setLastUpdated(new Date());
    } catch {
      // Fall back to demo data for display purposes
      setRawData(DEMO);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rawData.filter(m => {
      const matchQ = !q || [m.id, m.site, m.location, m.operation, m.workType, m.client]
        .some(v => v.toLowerCase().includes(q));
      const matchTab = tab === 'all'        ? true
        : tab === 'exceptions' ? m.status === 'at_risk' || m.status === 'blocked'
        : m.status === tab;
      return matchQ && matchTab;
    });
  }, [rawData, query, tab]);

  const metrics = useMemo(() => {
    const total     = rawData.length;
    const active    = rawData.filter(m => m.status === 'active').length;
    const atRisk    = rawData.filter(m => m.status === 'at_risk' || m.status === 'blocked').length;
    const completed = rawData.filter(m => m.status === 'completed').length;
    const revenue   = rawData.reduce((s, m) => s + (m.actual || 0), 0);
    return { total, active, atRisk, completionRate: total ? Math.round(completed / total * 100) : 0, revenue };
  }, [rawData]);

  const updatedStr = lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_24%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_35%)]" />

        <div className="relative mx-auto max-w-[1800px] px-4 py-6 md:px-6 lg:px-8">

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                <Radar className="h-3.5 w-3.5" />
                Operations Command
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Mission Intelligence System</h1>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 md:text-base">
                Live deployment visibility, data-state awareness, financial control, and mission readiness across your fleet.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Updated {updatedStr}
              </div>
              <button
                onClick={onScheduleMission}
                className="inline-flex items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-400"
              >
                Schedule Mission
              </button>
            </div>
          </div>

          {/* ── Hero Metrics ──────────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Active Missions"     value={loading ? '…' : metrics.active}           subtext="Live field operations"        icon={Activity} />
            <MetricCard label="At Risk / Blocked"   value={loading ? '…' : metrics.atRisk}           subtext="Requires intervention"        icon={ShieldAlert} />
            <MetricCard label="Completion Rate"     value={loading ? '…' : `${metrics.completionRate}%`} subtext="Across all missions"      icon={CheckCircle2} />
            <MetricCard label="Revenue Tracked"     value={loading ? '…' : fmt(metrics.revenue)}     subtext="Actual client billings"       icon={CircleDollarSign} />
          </div>

          {/* ── Intelligence Strip ────────────────────────────────────────── */}
          <div className="mb-6 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Intelligence Core</div>
                <h2 className="mt-1 text-xl font-semibold">AI Operations Layer</h2>
              </div>
              <div className="text-sm text-zinc-400">Elevate mission awareness with fault detection, solar analytics, and AI-assisted review.</div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <IntelligenceCard title="Thermal Faults"  value="Fault Detection" subtext="Prioritized anomalies requiring review"       icon={ShieldAlert} accent="radial-gradient(circle, rgba(244,63,94,0.85) 0%, transparent 70%)" />
              <IntelligenceCard title="Solar Command"   value="Site Health"     subtext="Performance and readiness intelligence"      icon={SunMedium}  accent="radial-gradient(circle, rgba(16,185,129,0.85) 0%, transparent 70%)" />
              <IntelligenceCard title="AI Studio"       value="Run Analysis"    subtext="Launch mission-grade automated review"       icon={Bot}        accent="radial-gradient(circle, rgba(59,130,246,0.85) 0%, transparent 70%)" />
            </div>
          </div>

          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(['all','scheduled','active','completed','exceptions'] as const).map(k => (
                <button key={k} onClick={() => setTab(k)}
                  className={cn('rounded-xl border px-3 py-2 text-sm capitalize transition',
                    tab === k ? 'border-white bg-white text-black' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]')}>
                  {k === 'exceptions' ? 'Exceptions' : k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search mission ID, site, location, operation..."
              className="w-full max-w-xl rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-sky-500/50 lg:w-auto"
            />
          </div>

          {/* ── Command Table ────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Operations Grid</h3>
                  <p className="text-sm text-zinc-400">Status, progress, data readiness, team posture, and financial visibility per mission.</p>
                </div>
                <div className="text-sm text-zinc-500">
                  {loading ? 'Loading…' : `${filtered.length} mission${filtered.length === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>

            {/* Desktop grid */}
            <div className="hidden xl:block">
              <div className="grid grid-cols-[120px_220px_150px_150px_160px_170px_150px_160px_auto] border-b border-white/10 bg-white/[0.02] px-5 py-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                <div>Mission ID</div><div>Operation</div><div>Site</div><div>Schedule</div>
                <div>Status</div><div>Data</div><div>Team</div><div>Financials</div><div>Actions</div>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-20 text-zinc-500">Loading missions…</div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
                  <span className="text-2xl">🛰</span>
                  <span>No missions match this filter</span>
                </div>
              )}

              {filtered.map(m => {
                const cfg = statusCfg(m.status);
                const StatusIcon = cfg.Icon;
                const variance = typeof m.budget === 'number' && typeof m.actual === 'number' ? m.budget - m.actual : null;

                return (
                  <div key={m.id}
                    className="group grid grid-cols-[120px_220px_150px_150px_160px_170px_150px_160px_auto] items-start border-b border-white/5 px-5 py-4 transition hover:bg-white/[0.03]">

                    {/* Mission ID */}
                    <div>
                      <div className="font-mono text-sm font-medium text-white">{m.id}</div>
                      <div className="mt-1 text-xs text-zinc-500">{m.client}</div>
                    </div>

                    {/* Operation */}
                    <div className="pr-3">
                      <div className="font-medium text-white">{m.operation}</div>
                      <div className="mt-0.5 text-sm text-zinc-400">{m.workType}</div>
                      <div className="mt-3">
                        <ProgressBar value={m.progress} danger={m.status === 'at_risk' || m.status === 'blocked'} />
                      </div>
                    </div>

                    {/* Site */}
                    <div>
                      <div className="font-medium text-white">{m.site}</div>
                      <div className="mt-0.5 text-sm text-zinc-400">{m.location}</div>
                    </div>

                    {/* Schedule */}
                    <div className="inline-flex items-center gap-2 text-sm text-white">
                      <CalendarDays className="h-4 w-4 text-zinc-500 shrink-0" />{m.schedule}
                    </div>

                    {/* Status */}
                    <div>
                      <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium', cfg.badge)}>
                        <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                        <StatusIcon className="h-3.5 w-3.5" />{cfg.label}
                      </div>
                      {(m.status === 'at_risk' || m.status === 'blocked') && (
                        <div className="mt-2 text-xs text-amber-300">Attention recommended</div>
                      )}
                    </div>

                    {/* Data */}
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        <AssetChip label="KML"     active={m.kmlUploaded} />
                        <AssetChip label="RGB"     active={m.rgbUploaded} />
                        <AssetChip label="THERMAL" active={m.thermalUploaded} />
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 text-[11px] text-zinc-500">LBD Completion</div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                              style={{ width: `${m.lbdProgress}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400">{m.lbdProgress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Team */}
                    <div>
                      <div className="inline-flex items-center gap-2 text-sm text-white">
                        <Users className="h-4 w-4 text-zinc-500" />{m.teamCount} assigned
                      </div>
                      <div className="mt-1.5 text-xs text-zinc-500">
                        {m.teamCount === 0 ? 'No crew assigned' : m.teamCount === 1 ? 'Lean deployment' : 'Crew ready'}
                      </div>
                    </div>

                    {/* Financials */}
                    <div>
                      <div className="text-sm"><span className="text-zinc-500">Budget:</span> <span className="text-white">{fmt(m.budget)}</span></div>
                      <div className="mt-1 text-sm"><span className="text-zinc-500">Actual:</span> <span className="text-white">{fmt(m.actual)}</span></div>
                      {variance !== null && (
                        <div className={cn('mt-1.5 text-xs font-medium', variance >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                          Variance: {variance >= 0 ? '+' : ''}{fmt(variance)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'View Mission', Icon: Eye,           fn: onViewMission },
                        { label: 'Open Data',    Icon: FolderOpen,    fn: onOpenData },
                        { label: 'Finance',      Icon: FileBarChart2, fn: onOpenFinance },
                        { label: 'Assign Crew',  Icon: Wrench,        fn: onAssignCrew },
                        { label: 'Map',          Icon: MapPinned,     fn: onViewMap },
                      ].map(({ label, Icon, fn }) => (
                        <button key={label} onClick={() => fn?.(m)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.09]">
                          <Icon className="h-3.5 w-3.5" />{label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile cards */}
            <div className="xl:hidden">
              {filtered.map(m => {
                const cfg = statusCfg(m.status);
                const variance = typeof m.budget === 'number' && typeof m.actual === 'number' ? m.budget - m.actual : null;
                return (
                  <div key={m.id} className="border-b border-white/5 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs text-zinc-500">{m.id}</div>
                        <div className="text-lg font-semibold text-white">{m.site}</div>
                        <div className="text-sm text-zinc-400">{m.operation} · {m.workType}</div>
                      </div>
                      <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap', cfg.badge)}>
                        <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />{cfg.label}
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                        <div className="text-zinc-500">Schedule</div>
                        <div className="mt-1 text-white">{m.schedule}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                        <div className="text-zinc-500">Team</div>
                        <div className="mt-1 text-white">{m.teamCount} assigned</div>
                      </div>
                    </div>

                    <div className="mb-3 rounded-2xl border border-white/10 bg-black/40 p-3">
                      <ProgressBar value={m.progress} danger={m.status === 'at_risk' || m.status === 'blocked'} />
                    </div>

                    <div className="mb-3 rounded-2xl border border-white/10 bg-black/40 p-3">
                      <div className="mb-2 text-sm text-zinc-500">Data Status</div>
                      <div className="flex flex-wrap gap-2">
                        <AssetChip label="KML" active={m.kmlUploaded} />
                        <AssetChip label="RGB" active={m.rgbUploaded} />
                        <AssetChip label="THERMAL" active={m.thermalUploaded} />
                      </div>
                    </div>

                    {(m.budget || m.actual) && (
                      <div className="mb-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-sm">
                        <div className="text-white">Budget: {fmt(m.budget)}</div>
                        <div className="mt-1 text-white">Actual: {fmt(m.actual)}</div>
                        {variance !== null && (
                          <div className={cn('mt-1 text-xs', variance >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                            Variance: {variance >= 0 ? '+' : ''}{fmt(variance)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onViewMission?.(m)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.08] transition">View Mission</button>
                      <button onClick={() => onOpenData?.(m)}    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.08] transition">Open Data</button>
                      <button onClick={() => onOpenFinance?.(m)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.08] transition">Finance</button>
                      <button onClick={() => onAssignCrew?.(m)}  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.08] transition">Assign Crew</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Footer Insight Bar ───────────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { Icon: Database,         color: 'text-sky-400',   title: 'Data Integrity',    body: 'Surface missing KML, RGB, thermal, or incomplete LBD records before mission closeout.' },
              { Icon: Users,            color: 'text-emerald-400', title: 'Crew Readiness',  body: 'Highlight under-assigned or unassigned missions so scheduling gaps are visible immediately.' },
              { Icon: CircleDollarSign, color: 'text-amber-400', title: 'Financial Control', body: 'Mission-level budget, actuals, and variance create stronger operational decision support.' },
            ].map(({ Icon, color, title, body }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                <div className={cn('mb-2 flex items-center gap-2 text-sm font-medium text-white')}>
                  <Icon className={cn('h-4 w-4', color)} />{title}
                </div>
                <p className="text-sm text-zinc-400">{body}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
