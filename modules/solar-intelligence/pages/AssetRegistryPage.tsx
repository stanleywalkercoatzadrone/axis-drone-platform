import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, X, Loader2, Search, Filter, Download,
  ChevronDown, ChevronUp, MapPin, FileJson, Map
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetType = 'panel' | 'string' | 'tracker_row' | 'inverter' | 'combiner_box' | 'road' | 'pile' | 'racking' | 'substation' | 'other';
type InstallStatus = 'planned' | 'installed' | 'commissioned' | 'faulty' | 'decommissioned';

interface Asset {
  id: string;
  asset_type: AssetType;
  asset_id_label: string;
  installation_status: InstallStatus;
  lat?: number;
  lng?: number;
  notes?: string;
  specs?: Record<string, any>;
  last_inspection_date?: string;
  open_issues_count?: number;
  created_at: string;
}

interface NewAssetForm {
  asset_type: AssetType;
  asset_id_label: string;
  installation_status: InstallStatus;
  lat: string;
  lng: string;
  notes: string;
  specs_raw: string;
}

interface Props { siteId: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_TYPES: AssetType[] = ['panel', 'string', 'tracker_row', 'inverter', 'combiner_box', 'road', 'pile', 'racking', 'substation', 'other'];

const STATUS_CONFIG: Record<InstallStatus, { color: string; bg: string; label: string }> = {
  planned:       { color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'Planned'       },
  installed:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  label: 'Installed'     },
  commissioned:  { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   label: 'Commissioned'  },
  faulty:        { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'Faulty'        },
  decommissioned:{ color: '#475569', bg: 'rgba(71,85,105,0.15)',   label: 'Decommissioned'},
};

const BLANK_FORM: NewAssetForm = {
  asset_type: 'panel', asset_id_label: '', installation_status: 'planned',
  lat: '', lng: '', notes: '', specs_raw: '',
};

const DEMO_ASSETS: Asset[] = [
  { id: 'a1', asset_type: 'inverter', asset_id_label: 'INV-001', installation_status: 'commissioned', lat: 32.1234, lng: -110.5678, created_at: '2025-03-01T00:00:00Z', specs: { model: 'SMA Sunny Boy 25', capacity_kw: 25 } },
  { id: 'a2', asset_type: 'tracker_row', asset_id_label: 'TRK-022', installation_status: 'installed', lat: 32.1240, lng: -110.5680, created_at: '2025-04-10T00:00:00Z', open_issues_count: 2 },
  { id: 'a3', asset_type: 'pile', asset_id_label: 'PIL-1421', installation_status: 'installed', lat: 32.1238, lng: -110.5690, created_at: '2025-04-12T00:00:00Z' },
  { id: 'a4', asset_type: 'combiner_box', asset_id_label: 'CB-004', installation_status: 'planned', created_at: '2025-01-01T00:00:00Z' },
  { id: 'a5', asset_type: 'substation', asset_id_label: 'SUB-A', installation_status: 'commissioned', lat: 32.1220, lng: -110.5700, created_at: '2025-02-20T00:00:00Z', specs: { voltage_kv: 34.5 } },
];

// ─── Badges ───────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: InstallStatus }> = ({ status }) => {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.planned;
  return (
    <span style={{ color: c.color, background: c.bg }}
      className="text-xs font-semibold px-2 py-0.5 rounded capitalize">{c.label}</span>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const AssetRegistryPage: React.FC<Props> = ({ siteId }) => {
  const [assets, setAssets]           = useState<Asset[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState<NewAssetForm>(BLANK_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
  const [typeFilter, setTypeFilter]   = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch]           = useState('');
  const [sortField, setSortField]     = useState<string>('asset_id_label');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('asc');

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/solar-farm/sites/${siteId}/assets`);
      setAssets(res.data ?? []);
    } catch {
      setAssets(DEMO_ASSETS);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_id_label.trim()) { setFormError('Asset label is required'); return; }
    try {
      setSubmitting(true);
      setFormError(null);
      let specs: Record<string, any> | null = null;
      if (form.specs_raw.trim()) {
        try { specs = JSON.parse(form.specs_raw); } catch { setFormError('Invalid JSON in specs'); setSubmitting(false); return; }
      }
      await apiClient.post(`/api/solar-farm/sites/${siteId}/assets`, {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        specs,
        specs_raw: undefined,
      });
      setShowModal(false);
      setForm(BLANK_FORM);
      await fetchAssets();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async (format: 'geojson' | 'kml') => {
    try {
      const ext = format === 'geojson' ? 'geojson' : 'kml';
      const res = await apiClient.get(`/api/solar-farm/sites/${siteId}/export/${format}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `assets-${siteId}.${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert(`${format.toUpperCase()} export failed`); }
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const typeCounts: Record<string, number> = {};
  assets.forEach(a => { typeCounts[a.asset_type] = (typeCounts[a.asset_type] ?? 0) + 1; });

  const filtered = assets
    .filter(a => {
      if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
      if (statusFilter !== 'all' && a.installation_status !== statusFilter) return false;
      if (search && !a.asset_id_label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const av = (a as any)[sortField] ?? '';
      const bv = (b as any)[sortField] ?? '';
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
    border: '1px solid rgba(51,65,85,0.7)',
    backdropFilter: 'blur(12px)',
  };
  const inputCls = "w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

  const SortIcon: React.FC<{ field: string }> = ({ field }) =>
    sortField === field
      ? (sortDir === 'asc' ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)
      : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package size={22} className="text-purple-400" /> Asset Registry
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">{assets.length} assets tracked</p>
        </div>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          <button onClick={() => handleExport('geojson')}
            style={{ border: '1px solid rgba(51,65,85,0.8)' }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 text-sm hover:text-white hover:border-slate-500 transition-all">
            <FileJson size={14} /> GeoJSON
          </button>
          <button onClick={() => handleExport('kml')}
            style={{ border: '1px solid rgba(51,65,85,0.8)' }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 text-sm hover:text-white hover:border-slate-500 transition-all">
            <Map size={14} /> KML
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 shadow-lg shadow-purple-500/20">
            <Plus size={14} /> Add Asset
          </button>
        </div>
      </div>

      {/* Type count pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(typeCounts).map(([type, count]) => (
          <button key={type} onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
            style={typeFilter === type ? { background: '#a855f7', color: 'white' } : { background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}
            className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-all">
            {type.replace('_', ' ')}: {count}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={cardStyle} className="rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
        <Filter size={14} className="text-slate-500" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-blue-500">
          <option value="all">All Types</option>
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-blue-500">
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Search by label…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500 w-44" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="text-purple-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={36} className="text-slate-600 mx-auto mb-3" />
          <p className="text-white font-semibold">No assets found</p>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or add an asset</p>
        </div>
      ) : (
        <div style={cardStyle} className="rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                {[
                  { label: 'Label/ID', field: 'asset_id_label' },
                  { label: 'Type', field: 'asset_type' },
                  { label: 'Status', field: 'installation_status' },
                  { label: 'Location', field: null },
                  { label: 'Last Inspection', field: 'last_inspection_date' },
                  { label: 'Issues', field: 'open_issues_count' },
                  { label: 'Actions', field: null },
                ].map(({ label, field }) => (
                  <th key={label}
                    onClick={() => field && toggleSort(field)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider ${field ? 'cursor-pointer hover:text-slate-200' : ''}`}>
                    {label} {field && <SortIcon field={field} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => (
                <React.Fragment key={asset.id}>
                  <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}>
                    <td className="px-4 py-3 text-white font-mono text-sm font-medium">{asset.asset_id_label}</td>
                    <td className="px-4 py-3 text-slate-400 text-sm capitalize">{asset.asset_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3"><StatusBadge status={asset.installation_status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {asset.lat && asset.lng ? (
                        <a href={`https://maps.google.com/?q=${asset.lat},${asset.lng}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                          <MapPin size={11} /> {asset.lat.toFixed(4)}, {asset.lng.toFixed(4)}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {asset.last_inspection_date ? new Date(asset.last_inspection_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(asset.open_issues_count ?? 0) > 0 ? (
                        <span style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
                          className="text-xs font-bold px-2 py-0.5 rounded">{asset.open_issues_count}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-500">
                        {expandedId === asset.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expandedId === asset.id && (
                    <tr style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          {/* Specs */}
                          <div>
                            <p className="text-purple-400 text-xs font-bold uppercase tracking-wide mb-2">Specifications</p>
                            {asset.specs && Object.keys(asset.specs).length > 0 ? (
                              <div className="space-y-1">
                                {Object.entries(asset.specs).map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-xs">
                                    <span className="text-slate-400 capitalize">{k.replace('_', ' ')}</span>
                                    <span className="text-slate-200 font-medium">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : <p className="text-slate-600 text-xs">No specs recorded</p>}
                          </div>

                          {/* Coordinates */}
                          <div>
                            <p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-2">Location</p>
                            {(asset.lat || asset.lng) ? (
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Latitude</span>
                                  <span className="text-slate-200 font-mono">{asset.lat?.toFixed(6)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Longitude</span>
                                  <span className="text-slate-200 font-mono">{asset.lng?.toFixed(6)}</span>
                                </div>
                                <a href={`https://maps.google.com/?q=${asset.lat},${asset.lng}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-2 transition-colors">
                                  <MapPin size={11} /> View on Google Maps
                                </a>
                              </div>
                            ) : <p className="text-slate-600 text-xs">No GPS data</p>}
                          </div>

                          {/* Notes */}
                          <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-2">Notes</p>
                            <p className="text-slate-300 text-xs">{asset.notes ?? 'No notes recorded.'}</p>
                            <p className="text-slate-600 text-xs mt-2">
                              Added {asset.created_at && new Date(asset.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Add */}
      <button onClick={() => setShowModal(true)}
        style={{
          background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
          boxShadow: '0 0 20px rgba(168,85,247,0.5)',
          position: 'fixed', bottom: 32, right: 32,
        }}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform z-30">
        <Plus size={24} />
      </button>

      {/* ── Add Asset Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)',
            border: '1px solid rgba(51,65,85,0.9)', maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          }} className="rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <h3 className="text-white font-bold flex items-center gap-2"><Package size={16} className="text-purple-400" /> Add Asset</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Asset Type</label>
                  <select value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value as AssetType }))} className={inputCls}>
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Label / ID <span className="text-red-400">*</span></label>
                  <input required type="text" placeholder="INV-001" value={form.asset_id_label}
                    onChange={e => setForm(f => ({ ...f, asset_id_label: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Installation Status</label>
                  <select value={form.installation_status} onChange={e => setForm(f => ({ ...f, installation_status: e.target.value as InstallStatus }))} className={inputCls}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
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
                  <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className={`${inputCls} resize-none`} placeholder="Optional notes…" />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Specs (JSON)</label>
                  <textarea rows={3} value={form.specs_raw} onChange={e => setForm(f => ({ ...f, specs_raw: e.target.value }))}
                    className={`${inputCls} resize-none font-mono text-xs`}
                    placeholder='{"model": "SMA SB 25", "capacity_kw": 25}' />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all">Cancel</button>
                <button type="submit" disabled={submitting}
                  style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetRegistryPage;
