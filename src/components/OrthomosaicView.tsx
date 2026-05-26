import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import {
  Map, Upload, Zap, Clock, CheckCircle2, XCircle, Loader2,
  CloudUpload, ImageIcon, ChevronDown, RefreshCw, Download,
  Layers, AlertTriangle, Play, X, RotateCcw, FileArchive, Satellite,
  TrendingUp, Eye, FileText, ExternalLink, BarChart3, Timer, Image, Box,
  StopCircle, FolderOpen, Cuboid
} from 'lucide-react';
import apiClient from '../services/apiClient';

const OrthoMapViewer = lazy(() => import('./viewers/OrthoMapViewer'));
const Model3DViewer = lazy(() => import('./viewers/Model3DViewer'));
const ReportViewer = lazy(() => import('./viewers/ReportViewer'));

// ── Types ────────────────────────────────────────────────────────────────────
interface Mission {
  id: string;
  title?: string;
  siteName?: string;
  site_name?: string;
  client_name?: string;
  location?: string;
  type?: string;
  status?: string;
  date?: string;
}

interface OrthoOutput {
  id: string;
  output_type: string;
  file_name: string;
  is_approved?: boolean;
  file_size_bytes?: number;
}

interface OrthoJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'canceled';
  quality_tier: 'fast' | 'standard' | 'high';
  progress_pct: number;
  pipeline_stage: string | null;
  image_count: number;
  project_name: string;
  site_name: string | null;
  mission_id: string | null;
  error_message: string | null;
  created_at: string;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  retry_count?: number;
  max_retries?: number;
  output_count?: number;
  outputs?: OrthoOutput[] | null;
}

interface LinkedData {
  missionId: string;
  mission: { id: string; title: string; site_name: string; type: string; status: string; date: string; location: string; } | null;
  reports: Array<{ id: string; title: string; status: string; approval_status: string; created_at: string; }>;
  files: Array<{ id: string; name: string; url: string; type: string; size: number; created_at: string; }>;
}
interface PreviewData {
  previewUrl: string | null;
  hasPreview: boolean;
  stats: { imageCount: number; qualityTier: string; durationS: number; siteName: string; missionId: string; };
}
interface GeoData {
  tifUrl: string | null;
  objUrl: string | null;
  previewUrl: string | null;
  hasTif: boolean;
  hasObj: boolean;
  hasPreview: boolean;
  stats: { imageCount: number; qualityTier: string; durationS: number; siteName: string; missionId: string; };
}
type ViewerTab = 'ortho' | '3d' | 'mission' | 'report';

interface OdmReportData {
  pdfUrl: string | null;
  hasPdf: boolean;
  hasStats: boolean;
  stats: {
    processing_statistics?: {
      steps_times?: Record<string, number>;
      date?: string;
      area?: number;
    };
    features_statistics?: {
      detected_features?: { min: number; max: number; mean: number; median: number };
      reconstructed_features?: { min: number; max: number; mean: number; median: number };
    };
    reconstruction_statistics?: {
      components?: number;
      has_gps?: boolean;
      reconstructed_points_count?: number;
      reconstructed_shots_count?: number;
      initial_shots_count?: number;
      reprojection_error_pixels?: number;
    };
  } | null;
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  queued:     { bg: 'rgba(234,179,8,0.12)',  text: '#facc15', label: 'Queued' },
  processing: { bg: 'rgba(14,165,233,0.12)', text: '#38bdf8', label: 'Processing' },
  completed:  { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', label: 'Completed' },
  failed:     { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', label: 'Failed' },
  canceled:   { bg: 'rgba(100,116,139,0.12)',text: '#94a3b8', label: 'Canceled' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.queued;
  return (
    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function outputTypeIcon(type: string) {
  if (type === 'dsm') return <TrendingUp className="w-3.5 h-3.5" />;
  if (type === 'report') return <FileArchive className="w-3.5 h-3.5" />;
  return <Satellite className="w-3.5 h-3.5" />;
}

function outputTypeLabel(type: string) {
  if (type === 'orthomosaic') return 'Orthomosaic (GeoTIFF)';
  if (type === 'dsm') return 'DSM Elevation Model';
  if (type === 'report') return 'Full Archive (ZIP)';
  return type;
}

// ── Main Component ────────────────────────────────────────────────────────────
const OrthomosaicView: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [jobs, setJobs] = useState<OrthoJob[]>([]);
  const [selectedMission, setSelectedMission] = useState('');
  const [qualityTier, setQualityTier] = useState<'fast' | 'standard'>('fast');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<OrthoJob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localOrthoInputRef = useRef<HTMLInputElement>(null);
  const localObjInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerJobId, setViewerJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [linkedData, setLinkedData] = useState<LinkedData | null>(null);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerTab, setViewerTab] = useState<ViewerTab>('ortho');
  const [activeReport, setActiveReport] = useState<Record<string, unknown> | null>(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const isDraggingImg = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [localObjUrl, setLocalObjUrl] = useState<string | null>(null);
  const [localOrthoUrl, setLocalOrthoUrl] = useState<string | null>(null);
  const [odmReportData, setOdmReportData] = useState<OdmReportData | null>(null);

  // ── Load missions + jobs ──────────────────────────────────────────────────
  useEffect(() => {
    apiClient.get('/deployments?limit=50')
      .then(r => setMissions(r.data?.data || r.data?.deployments || []))
      .catch(() => {});

    loadJobs();
  }, []);

  // ── Delete a single job ──────────────────────────────────────────────────
  async function deleteJob(jobId: string) {
    try {
      await apiClient.delete(`/orthomosaic/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (activeJobId === jobId) { setActiveJobId(null); setActiveJob(null); }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete job.');
    }
  }

  // ── Clear all non-processing jobs ───────────────────────────────────────
  async function clearAllJobs() {
    const deletable = jobs.filter(j => j.status !== 'processing');
    if (!deletable.length) return;
    try {
      await apiClient.delete('/orthomosaic/jobs', { data: { ids: deletable.map(j => j.id) } });
      setJobs(prev => prev.filter(j => j.status === 'processing'));
      if (activeJob && activeJob.status !== 'processing') {
        setActiveJobId(null); setActiveJob(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear jobs.');
    }
  }

  function loadJobs() {
    apiClient.get('/orthomosaic/jobs')
      .then(r => setJobs(r.data?.data || []))
      .catch(() => {});
  }

  // ── Poll active job ───────────────────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeJobId) return;

    const poll = () => {
      apiClient.get(`/orthomosaic/jobs/${activeJobId}`)
        .then(r => {
          const job = r.data?.data;
          if (job) {
            setActiveJob(job);
            if (['completed', 'failed', 'canceled'].includes(job.status)) {
              clearInterval(pollRef.current!);
              loadJobs(); // refresh history when job finishes
            }
          }
        })
        .catch(() => {});
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeJobId]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.tif') || f.name.toLowerCase().endsWith('.tiff')
    );
    setFiles(prev => [...prev, ...dropped]);
  }, []);

  // ── Direct streaming upload (browser → Cloud Run → GCS) ──────────────────
  async function uploadDirect(jobId: string, file: File, signal: AbortSignal): Promise<void> {
    const token = sessionStorage.getItem('skylens_token');
    const res = await fetch(`/api/orthomosaic/jobs/${jobId}/upload-direct`, {
      method: 'POST',
      signal,
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': file.type || 'image/jpeg',
        'X-File-Name': encodeURIComponent(file.name),
        'X-File-Size': String(file.size),
      },
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(err.message || `Upload failed: ${res.status}`);
    }
  }

  // ── Stop upload ────────────────────────────────────────────────────────────
  function handleStopUpload() {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploading(false);
    setUploadStage('');
    setUploadProgress(0);
    setError('Upload stopped.');
  }

  // ── Upload all files with concurrency ──────────────────────────────────────
  async function uploadAllFiles(jobId: string, allFiles: File[], signal: AbortSignal, onProgress: (done: number) => void): Promise<string[]> {
    const CONCURRENCY = 5;
    const failedFiles: string[] = [];
    let done = 0;

    for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
      if (signal.aborted) break;
      const group = allFiles.slice(i, i + CONCURRENCY);
      await Promise.all(group.map(async (file) => {
        if (signal.aborted) { failedFiles.push(file.name); done++; onProgress(done); return; }
        try {
          await uploadDirect(jobId, file, signal);
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            failedFiles.push(file.name);
            console.warn('[upload-direct]', file.name, err.message);
          }
        } finally {
          done++;
          onProgress(done);
        }
      }));
    }
    return failedFiles;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedMission) { setError('Please select a mission.'); return; }
    if (files.length === 0) { setError('Please add at least 1 image.'); return; }
    setError(''); setSuccess(''); setUploading(true); setUploadProgress(0); setUploadStage('Creating project…');
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // 1. Create project
      const missionObj = missions.find(m => m.id === selectedMission);
      const projectRes = await apiClient.post('/orthomosaic/projects', {
        name: `${missionObj?.title || missionObj?.siteName || missionObj?.site_name || missionObj?.location || 'Mission'} — ${new Date().toLocaleDateString()}`,
        missionId: selectedMission,
        siteName: missionObj?.siteName || missionObj?.site_name || missionObj?.location,
      });
      const projectId = projectRes.data.data.id;

      // 2. Create job
      setUploadStage('Creating job…');
      const jobRes = await apiClient.post(`/orthomosaic/projects/${projectId}/jobs`, {
        qualityTier,
        missionId: selectedMission,
        imageCount: files.length,
        flightDate: new Date().toISOString().split('T')[0],
      });
      const jobId = jobRes.data.data.id;

      // 3. Upload files (streaming, 5 concurrent)
      setUploadStage(`Uploading 0/${files.length} images…`);
      const failedFiles = await uploadAllFiles(jobId, files, abort.signal, (done) => {
        setUploadProgress(Math.round((done / files.length) * 100));
        setUploadStage(`Uploading ${done}/${files.length} images…`);
      });
      if (abort.signal.aborted) return; // user stopped

      if (failedFiles.length === files.length) {
        throw new Error(`All ${files.length} files failed to upload. Check your connection and try again.`);
      }
      if (failedFiles.length > 0) {
        setError(`⚠️ ${failedFiles.length} file(s) failed: ${failedFiles.slice(0, 3).join(', ')}${failedFiles.length > 3 ? '…' : ''}`);
      }

      // 4. Submit for processing
      setUploadStage('Starting processing engine…');
      await apiClient.post(`/orthomosaic/jobs/${jobId}/submit`);

      setActiveJobId(jobId);
      setFiles([]);
      setSuccess(qualityTier === 'fast'
        ? '⚡ Lightning processing started — estimated 20–40 minutes.'
        : '🗺️ Standard quality processing started — estimated 2–4 hours.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadStage('');
    }
  }



  // ── Retry failed job ───────────────────────────────────────────────────────
  async function handleRetry(jobId: string) {
    setRetrying(jobId);
    try {
      await apiClient.post(`/orthomosaic/jobs/${jobId}/retry`);
      setActiveJobId(jobId);
      setSuccess('Job queued for retry. Processing will resume shortly.');
      loadJobs();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retry job.');
    } finally {
      setRetrying(null);
    }
  }

  // ── Download output ────────────────────────────────────────────────────────
  async function downloadOutput(jobId: string, outId: string, fileName: string) {
    try {
      const r = await apiClient.get(`/orthomosaic/jobs/${jobId}/outputs/${outId}/download`);
      const url = r.data?.data?.downloadUrl;
      if (url) {
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
      }
    } catch { setError('Download failed.'); }
  }

  // ── Open viewer ────────────────────────────────────────────────────────────
  const openViewer = useCallback(async (jobId: string) => {
    setViewerOpen(true);
    setViewerJobId(jobId);
    setViewerLoading(true);
    setViewerTab('ortho');
    setActiveReport(null);
    setPreviewData(null);
    setLinkedData(null);
    setGeoData(null);
    setImgZoom(1);
    setImgPos({ x: 0, y: 0 });
    try {
      const [prevRes, linkRes, geoRes] = await Promise.all([
        apiClient.get(`/orthomosaic/jobs/${jobId}/preview`),
        apiClient.get(`/orthomosaic/jobs/${jobId}/linked-reports`),
        apiClient.get(`/orthomosaic/jobs/${jobId}/geo-data?_t=${Date.now()}`),
      ]);
      setPreviewData(prevRes.data?.data || null);
      setLinkedData(linkRes.data?.data || null);
      setGeoData(geoRes.data?.data || null);
    } catch { /* ignore */ }
    setViewerLoading(false);

    // Pre-fetch ODM report data in background
    setOdmReportData(null);
    apiClient.get(`/orthomosaic/jobs/${jobId}/report`)
      .then(r => setOdmReportData(r.data?.data || null))
      .catch(() => {});
  }, []);

  // ── Open report inline ────────────────────────────────────────────────────
  const openReport = useCallback(async (reportId: string) => {
    try {
      const r = await apiClient.get(`/reports/${reportId}`);
      setActiveReport(r.data?.data || r.data || null);
    } catch { /* ignore */ }
  }, []);

  const elapsedMins = activeJob?.processing_started_at
    ? Math.round((Date.now() - new Date(activeJob.processing_started_at).getTime()) / 60000)
    : null;

  const etaMins = (() => {
    if (!activeJob?.processing_started_at) return null;
    const pct = activeJob.progress_pct;
    if (pct < 3 || !elapsedMins) return null;
    const remaining = Math.round((elapsedMins / pct) * (100 - pct));
    return remaining > 0 ? remaining : null;
  })();

  const ODM_STAGES = [
    'Loading Dataset',
    'Feature Detection',
    'Feature Matching',
    'Structure from Motion',
    'Building Point Cloud',
    'DSM Generation',
    'Generating Orthophoto',
    'Finalizing Outputs',
  ];

  function stageIndex(stageName: string | null) {
    if (!stageName) return -1;
    const idx = ODM_STAGES.findIndex(s => s.toLowerCase() === (stageName || '').toLowerCase());
    return idx;
  }

  return (
    <>
    <div className="flex flex-col gap-6 p-6 min-h-0" style={{ overflow: 'auto' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl" style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.2)' }}>
            <Map className="w-6 h-6" style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Orthomosaic Processing</h1>
            <p className="text-xs font-medium uppercase tracking-widest mt-0.5" style={{ color: '#64748b' }}>
              Upload field images · NodeODM photogrammetry · Same-day delivery
            </p>
          </div>
        </div>
        <button onClick={loadJobs} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── On-demand viewer buttons ── */}
      {/* Hidden inputs for local file selection */}
      <input ref={localObjInputRef} type="file" accept=".obj" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          if (localObjUrl) URL.revokeObjectURL(localObjUrl);
          setLocalObjUrl(URL.createObjectURL(f));
          setViewerJobId(null); setPreviewData(null); setLinkedData(null); setGeoData(null);
          setViewerTab('3d'); setViewerOpen(true);
          e.target.value = '';
        }} />
      <input ref={localOrthoInputRef} type="file" accept=".tif,.tiff,.geotiff" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          if (localOrthoUrl) URL.revokeObjectURL(localOrthoUrl);
          setLocalOrthoUrl(URL.createObjectURL(f));
          setViewerJobId(null); setPreviewData(null); setLinkedData(null); setGeoData(null);
          setViewerTab('ortho'); setViewerOpen(true);
          e.target.value = '';
        }} />
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#334155' }}>Open locally:</span>
        <button
          onClick={() => localObjInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80 active:scale-95"
          style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}
        >
          <Box className="w-3.5 h-3.5" /> Open 3D Model
        </button>
        <button
          onClick={() => localOrthoInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80 active:scale-95"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}
        >
          <Satellite className="w-3.5 h-3.5" /> Open Orthomosaic
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* ── Left: Upload Panel ── */}
        <div className="flex flex-col gap-4">
          {/* Mission + Quality */}
          <div className="p-6 rounded-2xl" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>Job Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mission selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#64748b' }}>Mission</label>
                <div className="relative">
                  <select
                    value={selectedMission}
                    onChange={e => setSelectedMission(e.target.value)}
                    className="w-full appearance-none px-4 py-3 pr-10 rounded-xl text-sm font-bold text-white outline-none transition-all"
                    style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="" style={{ background: '#0f172a' }}>Select mission…</option>
                    {missions.map(m => (
                      <option key={m.id} value={m.id} style={{ background: '#0f172a' }}>
                        {m.title || m.siteName || m.site_name || m.location || m.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#64748b' }} />
                </div>
              </div>

              {/* Quality tier */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#64748b' }}>Processing Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['fast', 'standard'] as const).map(tier => (
                    <button
                      key={tier}
                      onClick={() => setQualityTier(tier)}
                      className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      style={{
                        background: qualityTier === tier ? (tier === 'fast' ? 'rgba(234,179,8,0.15)' : 'rgba(14,165,233,0.12)') : 'rgba(30,41,59,0.5)',
                        border: `1px solid ${qualityTier === tier ? (tier === 'fast' ? 'rgba(234,179,8,0.4)' : 'rgba(14,165,233,0.3)') : 'rgba(255,255,255,0.06)'}`,
                        color: qualityTier === tier ? (tier === 'fast' ? '#facc15' : '#38bdf8') : '#64748b',
                      }}
                    >
                      {tier === 'fast' ? <Zap className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      {tier === 'fast' ? '⚡ Lightning' : '🗺️ Standard'}
                      <span className="text-[9px] opacity-70 normal-case font-medium">
                        {tier === 'fast' ? '20–40 min' : '2–4 hrs'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="relative flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all min-h-[220px]"
            style={{
              background: isDragging ? 'rgba(14,165,233,0.08)' : 'rgba(15,23,42,0.5)',
              border: `2px dashed ${isDragging ? 'rgba(14,165,233,0.5)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.tif,.tiff"
              className="hidden"
              onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
            />
            <CloudUpload className="w-10 h-10 mb-3" style={{ color: isDragging ? '#38bdf8' : '#334155' }} />
            <p className="text-sm font-black text-white">Drop images here or click to browse</p>
            <p className="text-xs mt-1" style={{ color: '#475569' }}>JPG, PNG, TIFF, GeoTIFF · Any quantity</p>

            {files.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" style={{ color: '#38bdf8' }} />
                    <span className="text-sm font-black text-white">{files.length} image{files.length !== 1 ? 's' : ''} ready</span>
                    <span className="text-xs" style={{ color: '#64748b' }}>
                      ({(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setFiles([]); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black transition-colors hover:bg-white/10"
                    style={{ color: '#64748b' }}>
                    <X className="w-3 h-3" /> Clear all
                  </button>
                </div>
                {/* Scrollable file list with individual remove */}
                {files.length > 0 && files.length <= 20 && (
                  <div className="mt-1 max-h-28 overflow-y-auto rounded-xl" style={{ background: 'rgba(15,23,42,0.95)' }}>
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b last:border-b-0"
                        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <span className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{f.name}</span>
                        <button onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== i)); }}
                          className="ml-2 shrink-0 p-0.5 rounded hover:bg-white/10">
                          <X className="w-3 h-3" style={{ color: '#475569' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Errors / success */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                  {uploadStage || 'Uploading images…'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-white">{uploadProgress}%</span>
                  <button
                    onClick={handleStopUpload}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-80 active:scale-95"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                  >
                    <StopCircle className="w-3 h-3" />
                    Stop
                  </button>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #2563eb, #38bdf8)' }} />
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={uploading || files.length === 0 || !selectedMission}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{
              background: uploading ? 'rgba(37,99,235,0.3)' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
              color: 'white',
              boxShadow: files.length > 0 && selectedMission ? '0 0 40px rgba(37,99,235,0.3)' : 'none',
            }}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {uploading ? 'Uploading & Submitting…' : `Start ${qualityTier === 'fast' ? '⚡ Lightning' : '🗺️ Standard'} Processing`}
          </button>
        </div>

        {/* ── Right: Active Job + History ── */}
        <div className="flex flex-col gap-4">
          {/* Active job card */}
          {activeJob && (
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {activeJob.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#38bdf8' }} />}
                  {activeJob.status === 'completed' && <CheckCircle2 className="w-4 h-4" style={{ color: '#4ade80' }} />}
                  {activeJob.status === 'failed' && <XCircle className="w-4 h-4" style={{ color: '#f87171' }} />}
                  <span className="text-sm font-black text-white">Active Job</span>
                </div>
                <StatusBadge status={activeJob.status} />
              </div>

              <p className="text-xs font-bold mb-1" style={{ color: '#94a3b8' }}>{activeJob.project_name}</p>
              <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: '#475569' }}>
                {activeJob.image_count} images · {activeJob.quality_tier === 'fast' ? '⚡ Lightning' : '🗺️ Standard'}
                {elapsedMins !== null && ` · ${elapsedMins}m elapsed`}
              </p>

              {/* Progress — rich stage indicator */}
              {activeJob.status === 'processing' && (
                <div className="mb-4 space-y-3">
                  {/* Bar + pct */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#38bdf8' }}>
                        {activeJob.pipeline_stage || 'Processing…'}
                      </span>
                      <span className="text-xs font-black text-white tabular-nums">{activeJob.progress_pct}%</span>
                    </div>
                    <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.9)' }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${activeJob.progress_pct}%`, background: 'linear-gradient(90deg, #2563eb, #0ea5e9, #38bdf8)' }} />
                      {/* shimmer */}
                      <div className="absolute inset-0 rounded-full"
                        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)', animation: 'shimmer 2s infinite', backgroundSize: '200% 100%' }} />
                    </div>
                  </div>

                  {/* Time row */}
                  <div className="flex items-center justify-between text-[10px]" style={{ color: '#475569' }}>
                    <span>{elapsedMins !== null ? `${elapsedMins}m elapsed` : 'Starting…'}</span>
                    {etaMins !== null && (
                      <span style={{ color: '#64748b' }}>~{etaMins}m remaining</span>
                    )}
                  </div>

                  {/* Stage steps */}
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    {ODM_STAGES.map((s, i) => {
                      const current = stageIndex(activeJob.pipeline_stage);
                      const done = i < current;
                      const active = i === current;
                      return (
                        <div key={s} className="flex items-center gap-1.5">
                          <div className="relative flex-shrink-0 w-3 h-3 flex items-center justify-center">
                            {done && (
                              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                                <circle cx="6" cy="6" r="6" fill="rgba(34,197,94,0.25)" />
                                <path d="M3 6l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            {active && (
                              <span className="w-2.5 h-2.5 rounded-full inline-block animate-pulse" style={{ background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                            )}
                            {!done && !active && (
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'rgba(100,116,139,0.4)' }} />
                            )}
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider truncate"
                            style={{ color: done ? '#4ade80' : active ? '#e2e8f0' : '#334155' }}>
                            {s}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              {/* Outputs */}
              {activeJob.status === 'completed' && (
                <div className="space-y-2">
                  {/* Open Viewer button */}
                  <button
                    onClick={() => openViewer(activeJob.id)}
                    className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8' }}
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5" />
                      View Results in Axis
                    </div>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  {/* Individual output downloads */}
                  {activeJob.outputs && activeJob.outputs.filter(Boolean).length > 0 && activeJob.outputs.filter(Boolean).map(out => (
                    <button
                      key={out.id}
                      onClick={() => downloadOutput(activeJob.id, out.id, out.file_name || out.output_type)}
                      className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}
                    >
                      <div className="flex items-center gap-2">
                        {outputTypeIcon(out.output_type)}
                        {outputTypeLabel(out.output_type)}
                      </div>
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Failed state + retry */}
              {activeJob.status === 'failed' && (
                <div className="space-y-2">
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                    {activeJob.error_message || 'Processing failed. Please retry.'}
                  </p>
                  {(activeJob.retry_count ?? 0) < (activeJob.max_retries ?? 3) && (
                    <button
                      onClick={() => handleRetry(activeJob.id)}
                      disabled={retrying === activeJob.id}
                      className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                    >
                      {retrying === activeJob.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {retrying === activeJob.id ? 'Retrying…' : `Retry Job (attempt ${(activeJob.retry_count ?? 0) + 1} / ${activeJob.max_retries ?? 3})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Job history */}
          <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: '#64748b' }}>Recent Jobs</h2>
                {jobs.length > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(30,41,59,0.8)', color: '#94a3b8' }}>
                    {jobs.length}
                  </span>
                )}
              </div>
              {jobs.filter(j => j.status !== 'processing').length > 0 && (
                <button
                  onClick={clearAllJobs}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-80"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                >
                  <X className="w-3 h-3" /> Clear All
                </button>
              )}
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: '#1e293b' }} />
                <p className="text-xs font-bold" style={{ color: '#334155' }}>No jobs yet</p>
                <p className="text-[10px]" style={{ color: '#1e293b' }}>Upload images to get started</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-auto" style={{ maxHeight: 420 }}>
                {jobs.map(job => (
                  <div key={job.id}
                    onClick={() => setActiveJobId(job.id === activeJobId ? null : job.id)}
                    className="flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all hover:opacity-90"
                    style={{
                      background: job.id === activeJobId ? 'rgba(14,165,233,0.08)' : 'rgba(30,41,59,0.4)',
                      border: `1px solid ${job.id === activeJobId ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-white truncate">{job.project_name || job.site_name || 'Untitled'}</p>
                        <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#475569' }}>
                          {job.image_count} img · {job.quality_tier === 'fast' ? '⚡' : '🗺️'} · {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {job.status === 'processing' && (
                          <span className="text-[10px] font-black tabular-nums" style={{ color: '#38bdf8' }}>
                            {job.progress_pct}%
                          </span>
                        )}
                        {job.output_count != null && job.output_count > 0 && job.status === 'completed' && (
                          <span className="text-[10px] font-black" style={{ color: '#4ade80' }}>
                            {job.output_count} file{job.output_count !== 1 ? 's' : ''}
                          </span>
                        )}
                        <StatusBadge status={job.status} />
                        {/* Delete button — only protected while actively processing */}
                        {job.status !== 'processing' && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteJob(job.id); }}
                            className="p-1 rounded-lg transition-all hover:bg-red-500/20 opacity-40 hover:opacity-100"
                            title="Remove from history"
                          >
                            <X className="w-3 h-3" style={{ color: '#f87171' }} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline error for failed jobs */}
                    {job.status === 'failed' && job.error_message && (
                      <div className="mt-2 flex items-start gap-2">
                        <p className="text-[10px] leading-relaxed truncate" style={{ color: '#f87171' }}>
                          ✗ {job.error_message}
                        </p>
                        {(job.retry_count ?? 0) < (job.max_retries ?? 3) && (
                          <button
                            onClick={e => { e.stopPropagation(); handleRetry(job.id); }}
                            disabled={retrying === job.id}
                            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition-all"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                          >
                            {retrying === job.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RotateCcw className="w-2.5 h-2.5" />}
                            Retry
                          </button>
                        )}
                      </div>
                    )}

                    {/* Processing progress mini bar */}
                    {job.status === 'processing' && job.progress_pct > 0 && (
                      <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                        <div className="h-full rounded-full" style={{ width: `${job.progress_pct}%`, background: 'linear-gradient(90deg, #2563eb, #38bdf8)' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.12)' }}>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#facc15' }} />
              <div>
                <p className="text-xs font-black text-white mb-1">Same-Day Delivery</p>
                <p className="text-[10px] leading-relaxed" style={{ color: '#64748b' }}>
                  ⚡ <strong className="text-white">Lightning</strong> mode uses OpenDroneMap fast-orthophoto for 20–40 min turnarounds.
                  Perfect for same-day client reports. Standard mode delivers full resolution in 2–4 hours.
                  All uploads use 3× auto-retry for upload resilience.
                </p>
              </div>
            </div>
          </div>
    </div>
    </div>
    </div>

      {/* ── Inline Report Viewer ─────────────────────────────────────────────── */}
      {activeReport && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: '#020817' }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#38bdf8' }} /></div>}>
          <ReportViewer
            report={activeReport as Parameters<typeof ReportViewer>[0]['report']}
            onClose={() => setActiveReport(null)}
          />
        </Suspense>
      )}

      {/* ── Full-screen Orthomosaic Viewer ─────────────────────────────────── */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: '#020817' }}
        >
          {/* ── Header bar ── */}
          <div className="flex items-center justify-between px-6 py-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(2,8,23,0.97)' }}>
            <div className="flex items-center gap-3">
              <Satellite className="w-5 h-5" style={{ color: '#38bdf8' }} />
              <div>
                <p className="text-sm font-black text-white">
                  {(geoData?.stats?.siteName || previewData?.stats?.siteName) || 'Orthomosaic Results'}
                </p>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: '#475569' }}>
                  {(geoData?.stats?.qualityTier || previewData?.stats?.qualityTier) === 'fast' ? '⚡ Lightning' : '🗺️ Standard'}
                  {(geoData?.stats?.imageCount || previewData?.stats?.imageCount) ? ` · ${geoData?.stats?.imageCount || previewData?.stats?.imageCount} images` : ''}
                </p>
              </div>
            </div>
            {/* Tab nav */}
            <div className="flex items-center gap-1">
              {([
                { key: 'ortho',   label: 'Ortho Map',          icon: <Map className="w-3.5 h-3.5" /> },
                { key: '3d',      label: '3D Model',            icon: <Box className="w-3.5 h-3.5" /> },
                { key: 'report',  label: 'ODM Report',          icon: <FileText className="w-3.5 h-3.5" /> },
                { key: 'mission', label: 'Mission & Reports',   icon: <FileArchive className="w-3.5 h-3.5" /> },
              ] as { key: ViewerTab; label: string; icon: React.ReactNode }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setViewerTab(tab.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                  style={{
                    background: viewerTab === tab.key ? 'rgba(14,165,233,0.15)' : 'transparent',
                    border: `1px solid ${viewerTab === tab.key ? 'rgba(14,165,233,0.35)' : 'transparent'}`,
                    color: viewerTab === tab.key ? '#38bdf8' : '#475569',
                  }}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setViewerOpen(false)}
              className="p-2 rounded-xl transition-all hover:opacity-70"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Tab body ── */}
          <div className="flex-1 min-h-0 overflow-hidden">

            {/* Ortho Map tab */}
            {viewerTab === 'ortho' && (
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0f1e' }}>
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#38bdf8' }} />
                </div>
              }>
                <OrthoMapViewer
                  tifUrl={localOrthoUrl ?? geoData?.tifUrl ?? null}
                  siteName={geoData?.stats?.siteName || previewData?.stats?.siteName || (localOrthoUrl ? 'Local File' : undefined)}
                  isLoading={viewerLoading}
                  error={null}
                  onExtract={(!localOrthoUrl && viewerJobId) ? async () => {
                    try {
                      await apiClient.post(`/orthomosaic/jobs/${viewerJobId}/extract`);
                      let polls = 0;
                      const poll = setInterval(async () => {
                        polls++;
                        if (polls > 24) { clearInterval(poll); return; }
                        try {
                          const r = await apiClient.get(`/orthomosaic/jobs/${viewerJobId}/geo-data?_t=${Date.now()}`);
                          if (r.data?.data?.tifUrl) { setGeoData(r.data.data); clearInterval(poll); }
                        } catch { /* ignore */ }
                      }, 5000);
                    } catch { /* ignore */ }
                  } : undefined}
                />
              </Suspense>
            )}

            {/* ODM Report tab */}
            {viewerTab === 'report' && (
              <div className="h-full flex flex-col overflow-hidden" style={{ background: '#020817' }}>
                {odmReportData === null ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#38bdf8' }} />
                      <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#475569' }}>Loading ODM Report…</p>
                      <p className="text-[10px]" style={{ color: '#334155' }}>Extracting from archive on first load</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-0">
                    {/* Left: Stats dashboard */}
                    <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-4" style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(2,8,23,0.95)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#64748b' }}>Processing Stats</p>

                      {odmReportData.stats?.processing_statistics && (() => {
                        const ps = odmReportData.stats!.processing_statistics!;
                        const rs = odmReportData.stats!.reconstruction_statistics;
                        const fs = odmReportData.stats!.features_statistics;
                        const totalTime = ps.steps_times?.['Total Time'];
                        const areaSqM = ps.area || 0;
                        const areaSqKm = (areaSqM / 1_000_000).toFixed(4);
                        const areaHa = (areaSqM / 10_000).toFixed(2);
                        return (
                          <>
                            {/* Key metrics */}
                            <div className="grid grid-cols-2 gap-2">
                              {[{
                                label: 'Images Used',
                                value: rs?.reconstructed_shots_count ?? '—',
                                sub: `of ${rs?.initial_shots_count ?? '?'} total`,
                                color: '#4ade80',
                              }, {
                                label: 'Area Covered',
                                value: `${areaHa} ha`,
                                sub: `${areaSqKm} km²`,
                                color: '#38bdf8',
                              }, {
                                label: 'Point Cloud',
                                value: rs?.reconstructed_points_count?.toLocaleString() ?? '—',
                                sub: 'points',
                                color: '#a78bfa',
                              }, {
                                label: 'Reprojection',
                                value: rs?.reprojection_error_pixels != null
                                  ? `${rs.reprojection_error_pixels.toFixed(2)}px`
                                  : '—',
                                sub: 'avg error',
                                color: rs?.reprojection_error_pixels != null && rs.reprojection_error_pixels < 1.0 ? '#4ade80' : '#facc15',
                              }].map(m => (
                                <div key={m.label} className="rounded-xl p-3" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#475569' }}>{m.label}</p>
                                  <p className="text-sm font-black" style={{ color: m.color }}>{m.value}</p>
                                  <p className="text-[10px]" style={{ color: '#334155' }}>{m.sub}</p>
                                </div>
                              ))}
                            </div>

                            {/* Processing times */}
                            {ps.steps_times && (
                              <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Processing Times</p>
                                {Object.entries(ps.steps_times)
                                  .filter(([k]) => k !== 'Total Time')
                                  .map(([step, secs]) => {
                                    const mins = Math.round((secs as number) / 60);
                                    const pct = totalTime ? Math.round(((secs as number) / (totalTime as number)) * 100) : 0;
                                    return (
                                      <div key={step}>
                                        <div className="flex justify-between text-[10px] mb-1">
                                          <span style={{ color: '#94a3b8' }}>{step}</span>
                                          <span className="font-bold" style={{ color: '#64748b' }}>{mins}m</span>
                                        </div>
                                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2563eb, #38bdf8)' }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                {totalTime && (
                                  <div className="pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="font-black" style={{ color: '#e2e8f0' }}>Total</span>
                                      <span className="font-black" style={{ color: '#38bdf8' }}>{Math.round((totalTime as number) / 60)}m</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Feature quality */}
                            {fs && (
                              <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Feature Quality</p>
                                {[{
                                  label: 'Detected / image',
                                  val: fs.detected_features ? `avg ${fs.detected_features.mean?.toLocaleString()}` : '—',
                                }, {
                                  label: 'Reconstructed / image',
                                  val: fs.reconstructed_features ? `avg ${fs.reconstructed_features.mean?.toLocaleString()}` : '—',
                                }].map(f => (
                                  <div key={f.label} className="flex justify-between text-[10px]">
                                    <span style={{ color: '#64748b' }}>{f.label}</span>
                                    <span className="font-bold" style={{ color: '#94a3b8' }}>{f.val}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-[10px]">
                                  <span style={{ color: '#64748b' }}>GPS</span>
                                  <span className="font-bold" style={{ color: rs?.has_gps ? '#4ade80' : '#f87171' }}>{rs?.has_gps ? 'Yes' : 'No'}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span style={{ color: '#64748b' }}>Components</span>
                                  <span className="font-bold" style={{ color: rs?.components === 1 ? '#4ade80' : '#facc15' }}>{rs?.components}</span>
                                </div>
                              </div>
                            )}

                            {/* Date */}
                            {ps.date && (
                              <p className="text-[10px] text-center" style={{ color: '#334155' }}>Processed {ps.date}</p>
                            )}
                          </>
                        );
                      })()}

                      {!odmReportData.stats && (
                        <p className="text-xs" style={{ color: '#334155' }}>Stats not available.</p>
                      )}

                      {/* Download PDF button */}
                      {odmReportData.hasPdf && odmReportData.pdfUrl && (
                        <a
                          href={odmReportData.pdfUrl}
                          download="odm_report.pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
                          style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8' }}
                        >
                          <Download className="w-3.5 h-3.5" /> Download Full Report PDF
                        </a>
                      )}
                    </div>

                    {/* Right: PDF iframe */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      {odmReportData.hasPdf && odmReportData.pdfUrl ? (
                        <iframe
                          src={odmReportData.pdfUrl}
                          className="flex-1 w-full border-0"
                          title="ODM Processing Report"
                          style={{ background: '#ffffff' }}
                        />
                      ) : (
                        <div className="flex-1 flex items-center justify-center flex-col gap-3">
                          <FileText className="w-12 h-12" style={{ color: '#1e293b' }} />
                          <p className="text-sm font-black" style={{ color: '#334155' }}>PDF report not available</p>
                          <p className="text-xs" style={{ color: '#1e293b' }}>The report may still be extracting from the archive</p>
                          <button
                            onClick={() => {
                              setOdmReportData(null);
                              viewerJobId && apiClient.get(`/orthomosaic/jobs/${viewerJobId}/report`)
                                .then(r => setOdmReportData(r.data?.data || null))
                                .catch(() => setOdmReportData({ pdfUrl: null, hasPdf: false, hasStats: false, stats: null }));
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest"
                            style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', color: '#38bdf8' }}
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3D Model tab */}
            {viewerTab === '3d' && (
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#030712' }}>
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#38bdf8' }} />
                </div>
              }>
                <Model3DViewer
                  objUrl={localObjUrl ?? geoData?.objUrl ?? null}
                  isLoading={viewerLoading}
                  error={null}
                  qualityTier={geoData?.stats?.qualityTier || previewData?.stats?.qualityTier}
                />
              </Suspense>
            )}

            {/* Mission & Reports tab */}
            {viewerTab === 'mission' && (
              <div className="h-full overflow-y-auto flex">
                {/* Left: mission info + files */}
                <div className="flex-1 p-6 space-y-5">
                  {linkedData?.mission ? (
                    <>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>Linked Mission</p>
                        <div className="rounded-2xl p-5" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                          <p className="text-base font-black text-white mb-1">{linkedData.mission.title}</p>
                          <p className="text-xs" style={{ color: '#64748b' }}>{linkedData.mission.site_name} · {linkedData.mission.type}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{linkedData.mission.location}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>Downloads</p>
                        <div className="space-y-2">
                          {activeJob?.outputs?.filter(Boolean).map(out => (
                            <button key={out.id}
                              onClick={() => viewerJobId && downloadOutput(viewerJobId, out.id, out.file_name || out.output_type)}
                              className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#4ade80' }}>
                              <div className="flex items-center gap-2">{outputTypeIcon(out.output_type)}<span>{outputTypeLabel(out.output_type)}</span></div>
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Satellite className="w-10 h-10 mb-4" style={{ color: '#1e293b' }} />
                      <p className="text-sm font-black" style={{ color: '#334155' }}>No mission linked</p>
                      <p className="text-xs mt-1" style={{ color: '#1e293b' }}>Attach this job to a mission when submitting</p>
                    </div>
                  )}
                </div>
                {/* Right: reports */}
                <div className="w-80 shrink-0 p-6 space-y-4" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#64748b' }}>Inspection Reports</p>
                  {viewerLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#334155' }} /></div>
                  ) : linkedData?.reports?.length ? (
                    <div className="space-y-2">
                      {linkedData.reports.map(r => (
                        <div key={r.id} className="rounded-xl p-3 cursor-pointer transition-all hover:opacity-80"
                          onClick={() => openReport(r.id)}
                          style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-xs font-black text-white truncate">{r.title}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: r.approval_status === 'Approved' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.1)', color: r.approval_status === 'Approved' ? '#4ade80' : '#64748b' }}>
                              {r.approval_status || r.status}
                            </span>
                            <span className="text-[9px] font-bold" style={{ color: '#38bdf8' }}>Open →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs py-4" style={{ color: '#334155' }}>No reports linked to this mission yet.</p>
                  )}
                  <button
                    onClick={() => { setViewerOpen(false); window.dispatchEvent(new CustomEvent('axis:navigate', { detail: { key: 'reports' } })); }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}>
                    <FileText className="w-3.5 h-3.5" /> Create Inspection Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default OrthomosaicView;
