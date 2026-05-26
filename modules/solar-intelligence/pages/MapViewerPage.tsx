import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Map, Layers, AlertTriangle, Thermometer, Package, Loader2, X, ChevronRight
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SolarSite {
  id: string;
  site_name: string;
  lat?: number;
  lng?: number;
  center_lat?: number;
  center_lng?: number;
}

interface Asset {
  id: string;
  asset_type: string;
  asset_id_label: string;
  installation_status: string;
  lat?: number;
  lng?: number;
}

interface Issue {
  id: string;
  title: string;
  severity: string;
  description?: string;
  lat?: number;
  lng?: number;
}

interface ThermalFinding {
  id: string;
  finding_type: string;
  severity: string;
  delta_t_celsius?: number;
  module_id?: string;
  lat?: number;
  lng?: number;
}

type LayerKey = 'assets' | 'issues' | 'thermal';

interface Props { siteId: string }

// ─── Status / severity helpers ────────────────────────────────────────────────

const ASSET_STATUS_COLOR: Record<string, string> = {
  planned: '#64748b', installed: '#3b82f6', commissioned: '#22c55e',
  faulty: '#ef4444', decommissioned: '#475569',
};

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
};

// ─── Leaflet map component ────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [25.0, -90.0];
const DEFAULT_ZOOM = 13;

const LeafletMap: React.FC<{
  center: [number, number];
  assets: Asset[];
  issues: Issue[];
  thermal: ThermalFinding[];
  layers: Record<LayerKey, boolean>;
  onMarkerClick: (type: 'asset' | 'issue' | 'thermal', item: any) => void;
}> = ({ center, assets, issues, thermal, layers, onMarkerClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupsRef = useRef<{ assets?: any; issues?: any; thermal?: any }>({});
  const [leafletError, setLeafletError] = useState<string | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let L: any;
    try {
      L = require('leaflet');
      // Fix default icon paths for bundlers
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Inject Leaflet CSS if not present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const map = L.map(mapRef.current, {
        center,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22,
      }).addTo(map);

      mapInstanceRef.current = map;
      layerGroupsRef.current = {
        assets: L.layerGroup().addTo(map),
        issues: L.layerGroup().addTo(map),
        thermal: L.layerGroup().addTo(map),
      };
    } catch (e) {
      console.warn('Leaflet not available:', e);
      setLeafletError('Leaflet is not installed. Run: npm install leaflet @types/leaflet');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center when it changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(center, DEFAULT_ZOOM);
  }, [center]);

  // Render asset markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    let L: any;
    try { L = require('leaflet'); } catch { return; }
    const grp = layerGroupsRef.current.assets;
    if (!grp) return;
    grp.clearLayers();
    if (!layers.assets) return;
    assets.filter(a => a.lat && a.lng).forEach(a => {
      const color = ASSET_STATUS_COLOR[a.installation_status] ?? '#64748b';
      const marker = L.circleMarker([a.lat!, a.lng!], {
        radius: 8, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9,
      });
      marker.bindPopup(`
        <div style="font-family:system-ui; min-width:160px">
          <b style="font-size:13px">${a.asset_id_label}</b><br>
          <span style="color:#64748b;text-transform:capitalize;font-size:12px">${a.asset_type.replace('_', ' ')}</span><br>
          <span style="color:${color};font-size:11px;font-weight:600;text-transform:capitalize">${a.installation_status}</span>
        </div>
      `);
      marker.on('click', () => onMarkerClick('asset', a));
      grp.addLayer(marker);
    });
  }, [assets, layers.assets, onMarkerClick]);

  // Render issue markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    let L: any;
    try { L = require('leaflet'); } catch { return; }
    const grp = layerGroupsRef.current.issues;
    if (!grp) return;
    grp.clearLayers();
    if (!layers.issues) return;
    issues.filter(i => i.lat && i.lng).forEach(i => {
      const color = SEV_COLOR[i.severity] ?? '#ef4444';
      const marker = L.circleMarker([i.lat!, i.lng!], {
        radius: 9, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85,
      });
      marker.bindPopup(`
        <div style="font-family:system-ui; min-width:200px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="color:${color};font-weight:700;text-transform:uppercase;font-size:10px">${i.severity}</span>
          </div>
          <b style="font-size:13px">${i.title}</b>
          ${i.description ? `<p style="color:#64748b;font-size:11px;margin-top:4px">${i.description}</p>` : ''}
        </div>
      `);
      marker.on('click', () => onMarkerClick('issue', i));
      grp.addLayer(marker);
    });
  }, [issues, layers.issues, onMarkerClick]);

  // Render thermal markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    let L: any;
    try { L = require('leaflet'); } catch { return; }
    const grp = layerGroupsRef.current.thermal;
    if (!grp) return;
    grp.clearLayers();
    if (!layers.thermal) return;
    thermal.filter(f => f.lat && f.lng).forEach(f => {
      const color = SEV_COLOR[f.severity] ?? '#f97316';
      const marker = L.circleMarker([f.lat!, f.lng!], {
        radius: 9, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85,
      });
      marker.bindPopup(`
        <div style="font-family:system-ui; min-width:200px">
          <b style="font-size:13px;text-transform:capitalize">${f.finding_type.replace('_', ' ')}</b>
          ${f.delta_t_celsius != null ? `<p style="color:#f97316;font-weight:700;font-size:14px">+${f.delta_t_celsius}°C</p>` : ''}
          ${f.module_id ? `<p style="color:#64748b;font-size:11px">Module: ${f.module_id}</p>` : ''}
          <span style="color:${color};font-weight:600;text-transform:capitalize;font-size:10px">${f.severity}</span>
        </div>
      `);
      marker.on('click', () => onMarkerClick('thermal', f));
      grp.addLayer(marker);
    });
  }, [thermal, layers.thermal, onMarkerClick]);

  if (leafletError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-800/50 rounded-2xl p-10">
        <Map size={48} className="text-slate-600 mb-4" />
        <p className="text-white font-semibold text-lg mb-2">Map Unavailable</p>
        <p className="text-slate-400 text-sm mb-4">{leafletError}</p>
        <code
          style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.8)' }}
          className="px-4 py-2 rounded-lg text-green-400 text-sm font-mono"
        >
          npm install leaflet @types/leaflet
        </code>
      </div>
    );
  }

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />;
};

// ─── Side panel item ──────────────────────────────────────────────────────────

const SidePanelItem: React.FC<{
  type: 'asset' | 'issue' | 'thermal';
  item: any;
  onClick: () => void;
}> = ({ type, item, onClick }) => {
  if (type === 'asset') {
    const color = ASSET_STATUS_COLOR[item.installation_status] ?? '#64748b';
    return (
      <button onClick={onClick}
        className="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 transition-colors border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span className="text-slate-200 text-xs font-medium font-mono">{item.asset_id_label}</span>
          <span className="text-slate-500 text-xs capitalize ml-auto">{item.asset_type.replace('_', ' ')}</span>
        </div>
      </button>
    );
  }
  if (type === 'issue') {
    const color = SEV_COLOR[item.severity] ?? '#ef4444';
    return (
      <button onClick={onClick}
        className="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 transition-colors border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span className="text-slate-200 text-xs truncate flex-1">{item.title}</span>
          <span style={{ color }} className="text-xs font-bold capitalize flex-shrink-0">{item.severity}</span>
        </div>
      </button>
    );
  }
  // thermal
  const color = SEV_COLOR[item.severity] ?? '#f97316';
  return (
    <button onClick={onClick}
      className="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 transition-colors border-b border-slate-700/30">
      <div className="flex items-center gap-2">
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span className="text-slate-200 text-xs capitalize flex-1">{item.finding_type.replace('_', ' ')}</span>
        {item.delta_t_celsius != null && (
          <span style={{ color }} className="text-xs font-bold flex-shrink-0">+{item.delta_t_celsius}°C</span>
        )}
      </div>
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const MapViewerPage: React.FC<Props> = ({ siteId }) => {
  const [site, setSite]       = useState<SolarSite | null>(null);
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [issues, setIssues]   = useState<Issue[]>([]);
  const [thermal, setThermal] = useState<ThermalFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers]   = useState<Record<LayerKey, boolean>>({ assets: true, issues: true, thermal: true });
  const [showPanel, setShowPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<LayerKey>('assets');
  const [selectedItem, setSelectedItem] = useState<{ type: 'asset' | 'issue' | 'thermal'; item: any } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [siteRes, assetsRes, issuesRes, thermalRes] = await Promise.allSettled([
        apiClient.get(`/api/solar-farm/sites/${siteId}`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/assets`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/issues`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/thermal`),
      ]);
      if (siteRes.status === 'fulfilled') setSite(siteRes.value.data);
      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value.data ?? []);
      if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value.data ?? []);
      if (thermalRes.status === 'fulfilled') setThermal(thermalRes.value.data ?? []);
    } catch {
      // Demo — add GPS to demo data
      setAssets([
        { id: 'a1', asset_type: 'inverter', asset_id_label: 'INV-001', installation_status: 'commissioned', lat: 32.1234, lng: -110.5678 },
        { id: 'a2', asset_type: 'tracker_row', asset_id_label: 'TRK-022', installation_status: 'installed', lat: 32.1240, lng: -110.5682 },
        { id: 'a3', asset_type: 'substation', asset_id_label: 'SUB-A', installation_status: 'commissioned', lat: 32.1220, lng: -110.5700 },
      ]);
      setIssues([
        { id: 'q1', title: 'Module misalignment Block 4A', severity: 'high', lat: 32.1237, lng: -110.5675, description: 'Modules out of alignment' },
        { id: 'q2', title: 'Missing module Row 22', severity: 'critical', lat: 32.1242, lng: -110.5685 },
      ]);
      setThermal([
        { id: 't1', finding_type: 'hotspot', severity: 'critical', delta_t_celsius: 42.5, module_id: 'B4-R22-M14', lat: 32.1241, lng: -110.5683 },
        { id: 't2', finding_type: 'offline_string', severity: 'high', delta_t_celsius: 28.0, lat: 32.1235, lng: -110.5679 },
      ]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mapCenter: [number, number] = (() => {
    if (site?.lat && site?.lng) return [site.lat, site.lng];
    if (site?.center_lat && site?.center_lng) return [site.center_lat, site.center_lng];
    // Try to derive from assets
    const withGPS = assets.filter(a => a.lat && a.lng);
    if (withGPS.length > 0) return [withGPS[0].lat!, withGPS[0].lng!];
    return DEFAULT_CENTER;
  })();

  const toggleLayer = (key: LayerKey) =>
    setLayers(l => ({ ...l, [key]: !l[key] }));

  const handleMarkerClick = (type: 'asset' | 'issue' | 'thermal', item: any) => {
    setSelectedItem({ type, item });
  };

  const panelItems = {
    assets: assets.filter(a => a.lat && a.lng),
    issues: issues.filter(i => i.lat && i.lng),
    thermal: thermal.filter(f => f.lat && f.lng),
  };

  const sideCardStyle = {
    background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
    border: '1px solid rgba(51,65,85,0.8)',
    backdropFilter: 'blur(16px)',
  };

  return (
    <div style={{ height: 'calc(100vh - 145px)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* ── Toolbar ── */}
      <div
        style={{ ...sideCardStyle, zIndex: 20, position: 'relative' }}
        className="flex items-center gap-3 px-4 py-3 flex-wrap"
      >
        <h2 className="text-white font-bold flex items-center gap-2 mr-2">
          <Map size={18} className="text-blue-400" /> Map Viewer
        </h2>

        {/* Layer toggles */}
        {([
          { key: 'assets' as LayerKey, label: 'Assets', icon: <Package size={13} />, color: '#3b82f6' },
          { key: 'issues' as LayerKey, label: 'QA/QC Issues', icon: <AlertTriangle size={13} />, color: '#ef4444' },
          { key: 'thermal' as LayerKey, label: 'Thermal', icon: <Thermometer size={13} />, color: '#f97316' },
        ]).map(({ key, label, icon, color }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            style={{
              background: layers[key] ? `${color}20` : 'rgba(51,65,85,0.3)',
              border: `1px solid ${layers[key] ? color + '60' : 'rgba(51,65,85,0.6)'}`,
              color: layers[key] ? color : '#64748b',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
          >
            {icon} {label}
            <span style={{ background: layers[key] ? color + '30' : 'rgba(51,65,85,0.3)', color: layers[key] ? color : '#475569' }}
              className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold">
              {key === 'assets' ? assets.length : key === 'issues' ? issues.length : thermal.length}
            </span>
          </button>
        ))}

        <button
          onClick={() => setShowPanel(p => !p)}
          style={{ border: '1px solid rgba(51,65,85,0.8)' }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:text-white hover:border-slate-500 transition-all"
        >
          <Layers size={13} /> {showPanel ? 'Hide Panel' : 'Show Panel'}
        </button>
      </div>

      {/* ── Map + Panel ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/70">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
            </div>
          )}
          <LeafletMap
            center={mapCenter}
            assets={assets}
            issues={issues}
            thermal={thermal}
            layers={layers}
            onMarkerClick={handleMarkerClick}
          />

          {/* Selected item overlay */}
          {selectedItem && (
            <div
              style={{
                position: 'absolute', bottom: 20, left: 20, zIndex: 500,
                ...sideCardStyle, borderRadius: 12, padding: '14px 16px', maxWidth: 300,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {selectedItem.type === 'asset' && (
                    <>
                      <p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-1">Asset</p>
                      <p className="text-white font-bold font-mono">{selectedItem.item.asset_id_label}</p>
                      <p className="text-slate-400 text-xs capitalize mt-0.5">{selectedItem.item.asset_type.replace('_', ' ')}</p>
                    </>
                  )}
                  {selectedItem.type === 'issue' && (
                    <>
                      <p style={{ color: SEV_COLOR[selectedItem.item.severity] }} className="text-xs font-bold uppercase tracking-wide mb-1">
                        {selectedItem.item.severity} Severity Issue
                      </p>
                      <p className="text-white font-bold text-sm">{selectedItem.item.title}</p>
                      {selectedItem.item.description && (
                        <p className="text-slate-400 text-xs mt-1 line-clamp-2">{selectedItem.item.description}</p>
                      )}
                    </>
                  )}
                  {selectedItem.type === 'thermal' && (
                    <>
                      <p style={{ color: SEV_COLOR[selectedItem.item.severity] }} className="text-xs font-bold uppercase tracking-wide mb-1">
                        Thermal Finding
                      </p>
                      <p className="text-white font-bold capitalize">{selectedItem.item.finding_type.replace('_', ' ')}</p>
                      {selectedItem.item.delta_t_celsius != null && (
                        <p className="text-orange-400 font-bold text-lg mt-0.5">+{selectedItem.item.delta_t_celsius}°C</p>
                      )}
                      {selectedItem.item.module_id && (
                        <p className="text-slate-400 text-xs font-mono">{selectedItem.item.module_id}</p>
                      )}
                    </>
                  )}
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        {showPanel && (
          <div style={{ width: 260, ...sideCardStyle, borderLeft: '1px solid rgba(51,65,85,0.6)', display: 'flex', flexDirection: 'column' }}>
            {/* Panel tabs */}
            <div className="flex border-b border-slate-700/60">
              {(['assets', 'issues', 'thermal'] as LayerKey[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent' }}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize transition-all ${activeTab === tab ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Panel items */}
            <div className="flex-1 overflow-y-auto">
              {panelItems[activeTab].length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-slate-500 text-xs">No {activeTab} with GPS</p>
                </div>
              ) : (
                panelItems[activeTab].map(item => (
                  <SidePanelItem
                    key={item.id}
                    type={activeTab === 'assets' ? 'asset' : activeTab === 'issues' ? 'issue' : 'thermal'}
                    item={item}
                    onClick={() => handleMarkerClick(activeTab === 'assets' ? 'asset' : activeTab === 'issues' ? 'issue' : 'thermal', item)}
                  />
                ))
              )}
            </div>

            {/* Panel footer */}
            <div style={{ borderTop: '1px solid rgba(51,65,85,0.5)' }} className="px-3 py-2">
              <p className="text-slate-600 text-xs text-center">
                {panelItems[activeTab].length} items with GPS
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapViewerPage;
