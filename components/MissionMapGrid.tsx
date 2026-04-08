/**
 * MissionMapGrid.tsx — Leaflet map + image coverage grid for an upload job
 *
 * Shows:
 * 1. A Leaflet map centered on the mission's lat/lng with a site marker
 * 2. A thumbnail grid of all uploaded images
 * 3. A "Master Report" button that generates the consolidated mission report
 *
 * Usage (in AIUploadsAdmin):
 *   <MissionMapGrid missionId={job.mission_id} siteName={job.site_name}
 *     lat={mission.lat} lng={mission.lng} files={files} />
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Map, Image, BrainCircuit, RotateCw, Eye, Maximize2,
  FileText, AlertTriangle, Grid, X,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { AIReportViewer, AIReportData } from './AIReportPage';

// ── Types ──────────────────────────────────────────────────────────────────────
interface MapGridProps {
  missionId: string;
  siteName?: string;
  missionTitle?: string;
  lat?: number | null;
  lng?: number | null;
  files?: Array<{ id: string; storage_url: string; file_name: string; mime_type?: string }>;
  onClose?: () => void;
}

const isImageUrl = (url: string) =>
  /\.(jpe?g|png|gif|webp|tiff?|bmp)(\?|$)/i.test(url || '');

// ── Leaflet Map (lazy-loaded via CDN script tag) ───────────────────────────────
function SiteMap({ lat, lng, siteName }: { lat: number; lng: number; siteName?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Load Leaflet CSS + JS from CDN if not already loaded
    if (!(window as any).L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = (window as any).L;
      const map = L.map(mapRef.current).setView([lat, lng], 15);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 21,
      }).addTo(map);

      // Grid overlay — show approx drone coverage radius
      L.circle([lat, lng], { color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.08, radius: 200 }).addTo(map);

      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(`<b>${siteName || 'Mission Site'}</b><br>${lat.toFixed(5)}, ${lng.toFixed(5)}`).openPopup();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, siteName]);

  return <div ref={mapRef} className="w-full h-56 rounded-xl overflow-hidden z-0" />;
}

// ── Main Component ─────────────────────────────────────────────────────────────
const MissionMapGrid: React.FC<MapGridProps> = ({
  missionId, siteName, missionTitle, lat, lng, files = [], onClose,
}) => {
  const [masterReport, setMasterReport]     = useState<AIReportData | null>(null);
  const [masterLoading, setMasterLoading]   = useState(false);
  const [showReport, setShowReport]         = useState(false);
  const [selectedImage, setSelectedImage]   = useState<string | null>(null);
  const [view, setView]                     = useState<'grid' | 'map'>('grid');

  const imageFiles = files.filter(f => isImageUrl(f.storage_url) || /image/i.test(f.mime_type || ''));

  const generateMaster = useCallback(async () => {
    setMasterLoading(true);
    try {
      const r = await apiClient.get(`/pilot/upload-jobs/mission/${missionId}/master-report`);
      setMasterReport(r.data?.data ?? null);
      setShowReport(true);
    } catch (_) {
      console.error('Master report failed');
    } finally {
      setMasterLoading(false);
    }
  }, [missionId]);

  if (showReport && masterReport) {
    return (
      <AIReportViewer
        report={masterReport as any}
        onBack={() => setShowReport(false)}
      />
    );
  }

  return (
    <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <div className="flex-1">
          <p className="text-xs font-black text-white">{siteName || missionTitle || 'Mission'}</p>
          <p className="text-[9px] text-slate-500">{imageFiles.length} image(s) · {files.length} total files</p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <button onClick={() => setView('grid')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-colors
              ${view === 'grid' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'text-slate-500 hover:text-white'}`}>
            <Grid size={9} /> Grid
          </button>
          {lat && lng && (
            <button onClick={() => setView('map')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-colors
                ${view === 'map' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'text-slate-500 hover:text-white'}`}>
              <Map size={9} /> Map
            </button>
          )}
          {/* Master Report */}
          <button onClick={generateMaster} disabled={masterLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[9px] font-black uppercase hover:opacity-90 transition-opacity disabled:opacity-50">
            {masterLoading
              ? <RotateCw size={9} className="animate-spin" />
              : <FileText size={9} />}
            Master Report
          </button>
          {onClose && (
            <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Map view */}
      {view === 'map' && lat && lng && (
        <div className="p-3">
          <SiteMap lat={lat} lng={lng} siteName={siteName} />
          {imageFiles.length > 0 && (
            <p className="text-[9px] text-slate-500 mt-2 text-center">
              {imageFiles.length} images captured at this site · click thumbnails below to view
            </p>
          )}
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && (
        <div className="p-3">
          {imageFiles.length === 0 ? (
            <div className="py-8 text-center">
              <Image size={20} className="text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No images in this upload batch</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
              {imageFiles.map((f, i) => (
                <button key={f.id || i} onClick={() => setSelectedImage(f.storage_url)}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-slate-800 border border-slate-700 hover:border-indigo-500/40 transition-colors">
                  <img src={f.storage_url} alt={f.file_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 size={12} className="text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Non-image files */}
          {files.length > imageFiles.length && (
            <div className="mt-2 flex flex-wrap gap-1">
              {files.filter(f => !isImageUrl(f.storage_url) && !/image/i.test(f.mime_type || '')).map((f, i) => (
                <a key={i} href={f.storage_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[9px] text-slate-400 hover:border-slate-600 transition-colors">
                  <FileText size={9} />{f.file_name}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X size={20} />
          </button>
          <img src={selectedImage} alt="Preview"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default MissionMapGrid;
