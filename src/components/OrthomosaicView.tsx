import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Map, Upload, Zap, Clock, CheckCircle2, XCircle, Loader2,
  CloudUpload, ImageIcon, ChevronDown, RefreshCw, Download,
  Layers, AlertTriangle, Play, X, RotateCcw, FileArchive, Satellite,
  TrendingUp
} from 'lucide-react';
import apiClient from '../services/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────
interface Mission {
  id: string;
  site_name: string;
  client_name: string;
  location: string;
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load missions + jobs ──────────────────────────────────────────────────
  useEffect(() => {
    apiClient.get('/deployments?limit=50')
      .then(r => setMissions(r.data?.data || r.data?.deployments || []))
      .catch(() => {});

    loadJobs();
  }, []);

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

  // ── Upload single file with retry ─────────────────────────────────────────
  async function uploadFileWithRetry(
    jobId: string,
    file: File,
    maxAttempts = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const urlRes = await apiClient.post(`/orthomosaic/jobs/${jobId}/upload-url`, {
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
          fileSize: file.size,
        });
        const { uploadSetId, signedUrl } = urlRes.data.data;

        if (signedUrl) {
          const putRes = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type || 'image/jpeg' },
          });
          if (!putRes.ok) {
            throw new Error(`GCS PUT failed: ${putRes.status} ${putRes.statusText}`);
          }
        }

        await apiClient.post(`/orthomosaic/jobs/${jobId}/upload-confirm`, { uploadSetId });
        return; // success — exit retry loop
      } catch (err: any) {
        if (attempt === maxAttempts) {
          throw new Error(`File "${file.name}" failed after ${maxAttempts} attempts: ${err.message}`);
        }
        // Wait before retry (exponential backoff: 1s, 2s)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedMission) { setError('Please select a mission.'); return; }
    if (files.length === 0) { setError('Please add at least 1 image.'); return; }
    setError(''); setSuccess(''); setUploading(true); setUploadProgress(0); setUploadStage('Creating project…');

    try {
      // 1. Create project
      const missionObj = missions.find(m => m.id === selectedMission);
      const projectRes = await apiClient.post('/orthomosaic/projects', {
        name: `${missionObj?.site_name || missionObj?.location || 'Mission'} — ${new Date().toLocaleDateString()}`,
        missionId: selectedMission,
        siteName: missionObj?.site_name || missionObj?.location,
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

      // 3. Upload each file with per-file retry (3 attempts)
      const failedFiles: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStage(`Uploading ${i + 1}/${files.length}: ${file.name}`);
        try {
          await uploadFileWithRetry(jobId, file, 3);
        } catch (uploadErr: any) {
          failedFiles.push(file.name);
          // Log but don't halt — continue uploading remaining files
          console.warn('[Orthomosaic upload]', uploadErr.message);
        }
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      if (failedFiles.length === files.length) {
        throw new Error(`All ${files.length} files failed to upload. Check your connection and try again.`);
      }

      if (failedFiles.length > 0) {
        setError(`⚠️ ${failedFiles.length} file(s) failed and will be skipped: ${failedFiles.slice(0, 3).join(', ')}${failedFiles.length > 3 ? '…' : ''}`);
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

  const elapsedMins = activeJob?.processing_started_at
    ? Math.round((Date.now() - new Date(activeJob.processing_started_at).getTime()) / 60000)
    : null;

  return (
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
                        {m.site_name || m.location || m.id.slice(0, 8)}
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
                    className="p-1 rounded-lg transition-colors hover:bg-white/10">
                    <X className="w-4 h-4" style={{ color: '#64748b' }} />
                  </button>
                </div>
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
            <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                  {uploadStage || 'Uploading images…'}
                </span>
                <span className="text-xs font-black text-white">{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #2563eb, #38bdf8)' }} />
              </div>
              <p className="text-[10px]" style={{ color: '#475569' }}>
                Each file is uploaded directly to secure cloud storage with 3 automatic retries.
              </p>
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

              {/* Progress bar */}
              {activeJob.status === 'processing' && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest" style={{ color: '#64748b' }}>
                    <span>{activeJob.pipeline_stage || 'Processing'}</span>
                    <span>{activeJob.progress_pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${activeJob.progress_pct}%`, background: 'linear-gradient(90deg, #2563eb, #38bdf8)' }} />
                  </div>
                </div>
              )}

              {/* Outputs */}
              {activeJob.status === 'completed' && activeJob.outputs && activeJob.outputs.filter(Boolean).length > 0 && (
                <div className="space-y-2">
                  {activeJob.outputs.filter(Boolean).map(out => (
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
              <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: '#64748b' }}>Recent Jobs</h2>
              {jobs.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(30,41,59,0.8)', color: '#94a3b8' }}>
                  {jobs.length}
                </span>
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
  );
};

export default OrthomosaicView;
