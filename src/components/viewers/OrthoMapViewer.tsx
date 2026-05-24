import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import apiClient from '../../services/apiClient';

interface OrthoMapViewerProps {
  tifUrl: string | null;        // e.g. /api/orthomosaic/jobs/:id/proxy-tif
  siteName?: string;
  isLoading?: boolean;
  error?: string | null;
  onExtract?: () => void;
}

const OrthoMapViewer: React.FC<OrthoMapViewerProps> = ({
  tifUrl, siteName, isLoading, error, onExtract,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [opacity, setOpacity] = useState(0.85);
  const [layerLoading, setLayerLoading] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [loadStep, setLoadStep] = useState('');
  const [hasLayer, setHasLayer] = useState(false);

  // ── Init Leaflet map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, { center: [20, -100], zoom: 4, zoomControl: false });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri', maxZoom: 21 }
    ).addTo(map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { attribution: '', maxZoom: 21, opacity: 0.5 }
    ).addTo(map);

    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  // ── Load ortho PNG when tifUrl changes ────────────────────────────────────
  useEffect(() => {
    if (!tifUrl) return;

    // Wait for map to be ready
    const tryLoad = () => {
      if (!leafletMap.current) {
        setTimeout(tryLoad, 100);
        return;
      }
      loadOrtho(tifUrl, leafletMap.current);
    };
    tryLoad();
  }, [tifUrl]);

  const loadOrtho = async (tifUrl: string, map: L.Map) => {
    setLayerLoading(true);
    setLayerError(null);
    setHasLayer(false);

    // Revoke any previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    try {
      // Build the PNG endpoint URL from the tifUrl
      // tifUrl: /api/orthomosaic/jobs/:id/proxy-tif
      // pngUrl: /orthomosaic/jobs/:id/proxy-ortho-png  (strip /api prefix for apiClient)
      const pngPath = tifUrl
        .replace(/^\/api/, '')           // strip /api prefix (apiClient adds it)
        .replace('proxy-tif', 'proxy-ortho-png');

      setLoadStep('Generating ortho preview…');
      console.log('[OrthoMapViewer] requesting PNG:', pngPath);

      const resp = await apiClient.get(pngPath, {
        responseType: 'arraybuffer',
        timeout: 120000,  // 2 min — server-side rendering can take ~30s first time
      });

      // Read geographic bounds from response header
      const boundsHeader = resp.headers['x-ortho-bounds'];
      if (!boundsHeader) throw new Error('No bounds in response — server may have failed');
      const { west, south, east, north } = JSON.parse(boundsHeader);

      // Create a blob URL for the PNG
      const blob = new Blob([resp.data], { type: 'image/png' });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      setLoadStep('Rendering on map…');

      // Add as Leaflet ImageOverlay
      const bounds: L.LatLngBoundsExpression = [[south, west], [north, east]];
      const overlay = L.imageOverlay(blobUrl, bounds, { opacity, interactive: false });
      overlay.addTo(map);
      overlayRef.current = overlay;

      // Fly to ortho bounds
      map.fitBounds(overlay.getBounds(), { padding: [20, 20], maxZoom: 20 });
      setHasLayer(true);
    } catch (e: any) {
      console.error('[OrthoMapViewer] failed:', e);
      const msg = e?.response?.status
        ? `Server error ${e.response.status} — check logs`
        : (e?.message ?? 'Unknown error');
      setLayerError(`Ortho render failed: ${msg}`);
    } finally {
      setLayerLoading(false);
      setLoadStep('');
    }
  };

  // ── Sync opacity ───────────────────────────────────────────────────────────
  useEffect(() => {
    overlayRef.current?.setOpacity(opacity);
  }, [opacity]);

  // ── Cleanup blob URL on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: '#0a0f1e' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Site badge */}
      {siteName && (
        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-xl text-xs font-black"
          style={{ background: 'rgba(2,8,23,0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', backdropFilter: 'blur(8px)' }}>
          📍 {siteName}
        </div>
      )}

      {/* Loading overlay */}
      {(isLoading || layerLoading) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(2,8,23,0.88)', backdropFilter: 'blur(4px)' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#38bdf8' }} />
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#38bdf8' }}>
            {isLoading ? 'Preparing orthomosaic…' : (loadStep || 'Loading…')}
          </p>
          {layerLoading && !isLoading && (
            <p className="text-[10px]" style={{ color: '#475569' }}>
              First load renders server-side (~30 seconds). Subsequent loads are instant.
            </p>
          )}
        </div>
      )}

      {/* Error overlay */}
      {(error || layerError) && !isLoading && !layerLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-8"
          style={{ background: 'rgba(2,8,23,0.92)' }}>
          <div className="p-4 rounded-2xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle className="w-8 h-8" style={{ color: '#f87171' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-white mb-1">Ortho Unavailable</p>
            <p className="text-xs max-w-sm" style={{ color: '#475569' }}>{error || layerError}</p>
          </div>
        </div>
      )}

      {/* No URL — offer extraction */}
      {!tifUrl && !isLoading && !error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 p-8">
          <div className="p-5 rounded-3xl" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}>
            <Layers className="w-10 h-10" style={{ color: '#0ea5e9' }} />
          </div>
          <div className="text-center">
            <p className="text-base font-black text-white mb-2">Orthomosaic Map</p>
            <p className="text-sm max-w-xs mb-4" style={{ color: '#475569' }}>
              The georeferenced map needs to be prepared. This extracts the GeoTIFF from your job archive (~30 seconds).
            </p>
            {onExtract && (
              <button onClick={onExtract}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest mx-auto transition-all hover:opacity-80"
                style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.35)', color: '#38bdf8' }}>
                <Layers className="w-4 h-4" /> Prepare Map View
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      {hasLayer && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(2,8,23,0.85)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
            <Layers className="w-3 h-3 shrink-0" style={{ color: '#64748b' }} />
            <input type="range" min="0" max="1" step="0.05" value={opacity}
              onChange={e => setOpacity(parseFloat(e.target.value))}
              style={{ width: 80, accentColor: '#38bdf8' }} />
            <span className="text-[10px] font-black tabular-nums" style={{ color: '#64748b' }}>
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <button onClick={() => leafletMap.current?.zoomIn()}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(2,8,23,0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', backdropFilter: 'blur(8px)' }}>
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => leafletMap.current?.zoomOut()}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(2,8,23,0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', backdropFilter: 'blur(8px)' }}>
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (overlayRef.current && leafletMap.current) {
                  leafletMap.current.fitBounds(overlayRef.current.getBounds(), { padding: [20, 20] });
                }
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(2,8,23,0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', backdropFilter: 'blur(8px)' }}>
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrthoMapViewer;
