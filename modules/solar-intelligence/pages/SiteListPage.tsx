import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun, Plus, Search, Zap, Calendar, AlertTriangle, ChevronRight,
  X, Loader2, Building2, MapPin
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

type SiteStatus = 'planning' | 'construction' | 'operational' | 'decommissioned';

interface SolarSite {
  id: string;
  site_name: string;
  client_name?: string;
  location_description?: string;
  capacity_mw?: number;
  status: SiteStatus;
  epc_contractor?: string;
  owner_name?: string;
  cod_target?: string;
  notes?: string;
  overall_progress_pct?: number;
  open_issues_count?: number;
  latest_survey_date?: string;
  created_at: string;
}

interface NewSiteForm {
  site_name: string;
  client_name: string;
  location_description: string;
  capacity_mw: string;
  status: SiteStatus;
  epc_contractor: string;
  owner_name: string;
  cod_target: string;
  notes: string;
}

interface Props {
  onSelectSite: (id: string, name: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SiteStatus, { label: string; color: string; bg: string }> = {
  planning:        { label: 'Planning',        color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  construction:    { label: 'Construction',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  operational:     { label: 'Operational',     color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
  decommissioned:  { label: 'Decommissioned',  color: '#64748b', bg: 'rgba(100,116,139,0.15)'},
};

const BLANK_FORM: NewSiteForm = {
  site_name: '', client_name: '', location_description: '',
  capacity_mw: '', status: 'planning', epc_contractor: '',
  owner_name: '', cod_target: '', notes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

const SiteListPage: React.FC<Props> = ({ onSelectSite }) => {
  const [sites, setSites]           = useState<SolarSite[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState<NewSiteForm>(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/api/solar-farm/sites');
      setSites(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load sites');
      // Demo fallback
      setSites([
        {
          id: 'demo-1',
          site_name: 'Sonora Flats Solar',
          client_name: 'SunPower Capital',
          location_description: 'Sonora, CA',
          capacity_mw: 120,
          status: 'construction',
          epc_contractor: 'Mesa Energy Group',
          owner_name: 'SunPower Capital LLC',
          cod_target: '2025-09-30',
          overall_progress_pct: 62,
          open_issues_count: 14,
          latest_survey_date: '2025-05-18',
          created_at: '2025-01-10',
        },
        {
          id: 'demo-2',
          site_name: 'Desert Wind Agrivoltaic',
          client_name: 'GreenVolt Partners',
          location_description: 'Yuma, AZ',
          capacity_mw: 45,
          status: 'operational',
          epc_contractor: 'Apex Solar Build',
          owner_name: 'GreenVolt Partners',
          cod_target: '2024-12-01',
          overall_progress_pct: 100,
          open_issues_count: 3,
          latest_survey_date: '2025-05-10',
          created_at: '2024-03-05',
        },
        {
          id: 'demo-3',
          site_name: 'Lakewood Plains Phase II',
          client_name: 'Nexgen Energy',
          location_description: 'Lubbock, TX',
          capacity_mw: 200,
          status: 'planning',
          epc_contractor: 'TBD',
          owner_name: 'Nexgen Energy LLC',
          cod_target: '2026-06-30',
          overall_progress_pct: 0,
          open_issues_count: 0,
          latest_survey_date: undefined,
          created_at: '2025-05-01',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site_name.trim()) { setFormError('Site name is required'); return; }
    try {
      setSubmitting(true);
      setFormError(null);
      await apiClient.post('/api/solar-farm/sites', {
        ...form,
        capacity_mw: form.capacity_mw ? parseFloat(form.capacity_mw) : null,
      });
      setShowModal(false);
      setForm(BLANK_FORM);
      await fetchSites();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Failed to create site');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = sites.filter(s =>
    s.site_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.location_description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Solar Farm Portfolio</h2>
            <span
              style={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}
              className="text-xs font-bold px-2.5 py-1 rounded-full border border-blue-500/30"
            >
              {sites.length} Sites
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Manage and monitor all solar farm projects</p>
        </div>

        <div className="sm:ml-auto flex gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search sites…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56"
            />
          </div>
          {/* New site */}
          <button
            onClick={() => setShowModal(true)}
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} />
            New Site
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          ⚠ {error} — Showing demo data
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
          >
            <Sun size={36} className="text-amber-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">No solar sites yet</p>
            <p className="text-slate-400 text-sm mt-1">Add your first site to get started</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Add your first site
          </button>
        </div>
      ) : (
        /* Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(site => {
            const cfg = STATUS_CONFIG[site.status] ?? STATUS_CONFIG.planning;
            const progress = site.overall_progress_pct ?? 0;
            return (
              <div
                key={site.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(51,65,85,0.8)',
                }}
                className="rounded-2xl p-5 flex flex-col gap-4 hover:border-slate-500 transition-all group cursor-pointer"
                onClick={() => onSelectSite(site.id, site.site_name)}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-base truncate group-hover:text-blue-400 transition-colors">
                      {site.site_name}
                    </h3>
                    {site.client_name && (
                      <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                        <Building2 size={11} /> {site.client_name}
                      </p>
                    )}
                    {site.location_description && (
                      <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {site.location_description}
                      </p>
                    )}
                  </div>
                  <span
                    style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Capacity */}
                  <div
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
                    className="rounded-xl p-2.5 text-center"
                  >
                    <div className="flex items-center justify-center gap-1 text-amber-400 mb-0.5">
                      <Zap size={12} />
                      <span className="text-xs font-bold">{site.capacity_mw ?? '—'}</span>
                    </div>
                    <p className="text-slate-500 text-xs">MW</p>
                  </div>
                  {/* Latest survey */}
                  <div
                    style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
                    className="rounded-xl p-2.5 text-center"
                  >
                    <div className="flex items-center justify-center gap-1 text-blue-400 mb-0.5">
                      <Calendar size={12} />
                      <span className="text-xs font-bold">
                        {site.latest_survey_date ? new Date(site.latest_survey_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs">Survey</p>
                  </div>
                  {/* Open issues */}
                  <div
                    style={{
                      background: (site.open_issues_count ?? 0) > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                      border: `1px solid ${(site.open_issues_count ?? 0) > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
                    }}
                    className="rounded-xl p-2.5 text-center"
                  >
                    <div
                      className="flex items-center justify-center gap-1 mb-0.5"
                      style={{ color: (site.open_issues_count ?? 0) > 0 ? '#ef4444' : '#22c55e' }}
                    >
                      <AlertTriangle size={12} />
                      <span className="text-xs font-bold">{site.open_issues_count ?? 0}</span>
                    </div>
                    <p className="text-slate-500 text-xs">Issues</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400">Overall Progress</span>
                    <span className="text-white font-bold">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${progress}%`,
                        background: progress === 100
                          ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                          : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                        transition: 'width 1s ease',
                      }}
                      className="h-full rounded-full"
                    />
                  </div>
                </div>

                {/* COD */}
                {site.cod_target && (
                  <p className="text-slate-500 text-xs">
                    COD Target: <span className="text-slate-300">{new Date(site.cod_target).toLocaleDateString()}</span>
                  </p>
                )}

                {/* CTA */}
                <button
                  onClick={e => { e.stopPropagation(); onSelectSite(site.id, site.site_name); }}
                  style={{ borderTop: '1px solid rgba(51,65,85,0.6)' }}
                  className="pt-3 flex items-center justify-between text-sm text-slate-400 group-hover:text-blue-400 transition-colors w-full"
                >
                  <span>View Dashboard</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Site Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)',
              border: '1px solid rgba(51,65,85,0.9)',
              maxWidth: 600,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            className="rounded-2xl shadow-2xl"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                >
                  <Plus size={16} className="text-blue-400" />
                </div>
                <h3 className="text-white font-bold">New Solar Site</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Site Name <span className="text-red-400">*</span></label>
                  <input
                    required
                    type="text"
                    value={form.site_name}
                    onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Sonora Flats Solar Phase I"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Client Name</label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Client / Owner"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Location</label>
                  <input
                    type="text"
                    value={form.location_description}
                    onChange={e => setForm(f => ({ ...f, location_description: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="City, State"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Capacity (MW)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.capacity_mw}
                    onChange={e => setForm(f => ({ ...f, capacity_mw: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="120"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as SiteStatus }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="planning">Planning</option>
                    <option value="construction">Construction</option>
                    <option value="operational">Operational</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">EPC Contractor</label>
                  <input
                    type="text"
                    value={form.epc_contractor}
                    onChange={e => setForm(f => ({ ...f, epc_contractor: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Contractor name"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Owner</label>
                  <input
                    type="text"
                    value={form.owner_name}
                    onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Owner name"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">COD Target</label>
                  <input
                    type="date"
                    value={form.cod_target}
                    onChange={e => setForm(f => ({ ...f, cod_target: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Additional notes…"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Create Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteListPage;
