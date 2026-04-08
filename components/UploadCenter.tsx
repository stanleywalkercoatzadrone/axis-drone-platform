/**
 * UploadCenter.tsx — AI-powered upload hub styled to match Mission Uploads
 *
 * Matches PilotUploadV2 design exactly: dark-slate Tailwind theme.
 * Added: Gemini AI auto-analysis + Pix4D dispatch per file.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, CheckCircle2, AlertCircle, RotateCw, X, FolderOpen,
  ChevronDown, Rocket, BrainCircuit, Zap, FileImage,
  Layers, FileText, BarChart3, Clock,
} from 'lucide-react';
import apiClient from '../services/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────
type UploadType = 'images' | 'thermal' | 'lbd' | 'kml' | 'orthomosaic';
type FileStatus  = 'pending' | 'uploading' | 'processing' | 'complete' | 'failed';

interface UploadFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  aiResult: any;
  pix4dJob: string | null;
  error: string | null;
  previewUrl: string | null;
}

interface UploadJob {
  id: string;
  uploadType: UploadType;
  missionId: string;
  status: string;
  fileCount: number;
  processedCount: number;
  createdAt: string;
  missionTitle?: string;
}

const UPLOAD_TYPES: { value: UploadType; label: string; icon: React.FC<any>; desc: string; accept: string }[] = [
  { value: 'images',      label: 'Aerial RGB',      icon: FileImage, desc: 'JPEG/PNG flight imagery',         accept: 'image/jpeg,image/png,image/jpg' },
  { value: 'thermal',     label: 'Thermal / IR',    icon: Zap,       desc: 'TIFF radiometric thermal images', accept: 'image/tiff,image/x-tiff,.tif,.tiff' },
  { value: 'lbd',         label: 'LBD Scan',        icon: Layers,    desc: 'Line-By-Defect scan data',        accept: 'image/*,.csv,.xlsx,.zip,.tif,.tiff' },
  { value: 'orthomosaic', label: 'Orthomosaic',     icon: BarChart3, desc: 'GeoTIFF orthomosaic output',      accept: '.tif,.tiff,image/tiff' },
  { value: 'kml',         label: 'KML Flight Path', icon: FileText,  desc: 'KML/KMZ mission path files',      accept: '.kml,.kmz' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function summarizeAI(aiResult: any): { label: string; color: string } | null {
  if (!aiResult || aiResult.error) return aiResult?.error ? { label: 'AI failed', color: 'text-red-400' } : null;
  if (aiResult.totalFaults !== undefined)
    return { label: `${aiResult.totalFaults} fault${aiResult.totalFaults !== 1 ? 's' : ''} · ${aiResult.overallCondition || ''}`, color: aiResult.totalFaults > 0 ? 'text-amber-400' : 'text-emerald-400' };
  if (aiResult.totalDefects !== undefined)
    return { label: `${aiResult.totalDefects} defect${aiResult.totalDefects !== 1 ? 's' : ''}`, color: aiResult.totalDefects > 0 ? 'text-red-400' : 'text-emerald-400' };
  return { label: aiResult.summary?.slice(0, 60) || 'Analyzed', color: 'text-blue-400' };
}

// ── Mission Picker (matches PilotUploadV2 exactly) ───────────────────────────
interface MissionRaw {
  id: string; title: string; status?: string;
  site_name?: string; project_name?: string;
}
function MissionPicker({ value, onChange }: {
  value: string;
  onChange: (id: string, siteName: string) => void;
}) {
  const [missions, setMissions] = useState<MissionRaw[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = React.useState(false);

  useEffect(() => {
    apiClient.get('/pilot/secure/missions')
      .then(res => {
        const data = res.data?.data || res.data || [];
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setMissions(list);
        } else {
          return apiClient.get('/api/deployments?limit=50').then(r2 => {
            setMissions(r2.data?.data || r2.data?.deployments || []);
          });
        }
      })
      .catch(() =>
        apiClient.get('/api/deployments?limit=50')
          .then(r => setMissions(r.data?.data || r.data?.deployments || []))
          .catch(() => {})
      )
      .finally(() => setLoading(false));
  }, []);

  const selected = missions.find(m => m.id === value);
  const getLabel = (m: MissionRaw) => {
    const projectLabel = m.project_name || m.site_name;
    return projectLabel ? `${projectLabel} — ${m.title}` : m.title;
  };

  return (
    <div className="relative">
      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
        Mission
      </label>
      {loading ? (
        <div className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-500 animate-pulse">
          Loading missions...
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer hover:border-slate-600 transition-colors"
          >
            <span className={selected ? 'text-white font-medium' : 'text-slate-400'}>
              {selected ? getLabel(selected) : '— Select mission —'}
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onChange('', ''); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-800 transition-colors border-b border-slate-800"
              >
                — Select mission —
              </button>
              {missions.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange(m.id, m.site_name || m.project_name || ''); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-slate-800
                    ${value === m.id ? 'text-blue-300 bg-blue-900/20' : 'text-white'}`}
                >
                  {getLabel(m)}
                </button>
              ))}
            </div>
          )}
          {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
        </div>
      )}
    </div>
  );
}

const ANALYSIS_TYPES = [
  { value: 'thermal_fault',   label: 'Thermal Fault Detection',   desc: 'Identify heat anomalies & hotspots' },
  { value: 'lbd_defect',      label: 'LBD Defect Scan',           desc: 'Line-by-defect structural analysis' },
  { value: 'rgb_anomaly',     label: 'RGB Anomaly Detection',     desc: 'Visual defects in aerial imagery' },
  { value: 'solar_panel',     label: 'Solar Panel Inspection',    desc: 'PV cell fault & soiling detection' },
  { value: 'full_inspection', label: 'Full Inspection Suite',     desc: 'All analysis types combined' },
];

// ── Main Component ────────────────────────────────────────────────────────────
const UploadCenter: React.FC = () => {
  const [missionId, setMissionId]     = useState('');
  const [siteName, setSiteName]       = useState('');
  const [analysisType, setAnalysisType] = useState('thermal_fault');
  const [uploadType, setUploadType]   = useState<UploadType>('images');
  const [missionFolder, setMissionFolder] = useState('');
  const [lbdBlock, setLbdBlock]       = useState('');
  const [files, setFiles]             = useState<UploadFile[]>([]);
  const [currentJob, setCurrentJob]   = useState<UploadJob | null>(null);
  const [recentJobs, setRecentJobs]   = useState<UploadJob[]>([]);
  const [isDragging, setIsDragging]   = useState(false);
  const [jobError, setJobError]       = useState('');
  const [uploading, setUploading]     = useState(false);
  const [reportUrl, setReportUrl]     = useState<string | null>(null);
  const cancelRef   = useRef(false);
  const dropRef     = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentType = UPLOAD_TYPES.find(t => t.value === uploadType)!;

  // Load recent jobs
  useEffect(() => {
    apiClient.get('/pilot/upload-jobs').then(r => {
      setRecentJobs(r.data?.data || []);
    }).catch(() => {});
  }, []);

  // Socket real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(window.location.origin.replace(/^http/, 'ws'));
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (!['upload:processing', 'upload:complete'].includes(msg.event)) return;
          const { fileName, aiResult, pix4dJobId } = msg.data;
          setFiles(prev => prev.map(f => {
            if (f.file.name !== fileName) return f;
            return { ...f, status: msg.event === 'upload:complete' ? 'complete' : 'processing', aiResult: aiResult ?? f.aiResult, pix4dJob: pix4dJobId ?? f.pix4dJob };
          }));
        } catch (_) {}
      };
    } catch (_) {}
    return () => ws?.close();
  }, []);

  // Auto-detect upload type from file extensions
  const detectType = (files: File[]): UploadType | null => {
    const exts = files.map(f => f.name.split('.').pop()?.toLowerCase() ?? '');
    if (exts.every(e => ['las','laz','ply','pcd','xyz','e57'].includes(e))) return 'lbd';
    if (exts.every(e => ['kml','kmz'].includes(e))) return 'kml';
    if (exts.some(e => ['tif','tiff'].includes(e))) {
      // Thermal = TIFF without geotiff orthomosaic clues
      const names = files.map(f => f.name.toLowerCase());
      if (names.some(n => n.includes('ortho') || n.includes('mosaic'))) return 'orthomosaic';
      return 'thermal';
    }
    if (exts.some(e => ['jpg','jpeg','png'].includes(e))) return 'images';
    return null;
  };

  // Create job
  const createJob = async () => {
    setJobError('');
    if (!missionId) return setJobError('Select a mission first.');
    if (uploadType === 'lbd' && !lbdBlock.trim()) return setJobError('LBD block identifier is required.');
    if (['images', 'thermal', 'orthomosaic'].includes(uploadType) && !missionFolder.trim())
      return setJobError('Mission folder label required.');
    try {
      const r = await apiClient.post('/pilot/upload-jobs', {
        missionId, uploadType, analysisType,
        lbdBlock:      lbdBlock || undefined,
        missionFolder: missionFolder || undefined,
      });
      setCurrentJob({ ...r.data.data, fileCount: 0, processedCount: 0 });
      setFiles([]);
      setJobError('');
    } catch (e: any) {
      setJobError(e.response?.data?.message || 'Failed to create upload job.');
    }
  };

  // Upload files
  const uploadFiles = useCallback(async (rawFiles: File[]) => {
    if (!currentJob) return;
    cancelRef.current = false;
    setUploading(true);
    setReportUrl(null);

    // Auto-detect type and update if detected
    const detected = detectType(rawFiles);
    if (detected && detected !== uploadType) setUploadType(detected);

    const newFiles: UploadFile[] = rawFiles.map(f => ({
      id: uid(), file: f, status: 'pending', progress: 0, aiResult: null, pix4dJob: null, error: null,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }));
    setFiles(prev => [...prev, ...newFiles]);

    for (const uf of newFiles) {
      if (cancelRef.current) {
        setFiles(prev => prev.map(f => f.id === uf.id && f.status === 'pending' ? { ...f, status: 'failed', error: 'Cancelled' } : f));
        continue;
      }
      setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'uploading' } : f));
      const form = new FormData();
      form.append('image', uf.file, uf.file.name);
      try {
        await apiClient.post(`/pilot/upload-jobs/${currentJob.id}/files`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded / (e.total ?? 1)) * 100);
            setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, progress: pct } : f));
          },
        });
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'processing', progress: 100 } : f));
        setTimeout(() => {
          setFiles(prev => {
            const f = prev.find(x => x.id === uf.id);
            if (f && f.status === 'processing') return prev.map(x => x.id === uf.id ? { ...x, status: 'complete' } : x);
            return prev;
          });
        }, 15_000);
      } catch (e: any) {
        if (cancelRef.current) {
          setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'failed', error: 'Cancelled' } : f));
        } else {
          setFiles(prev => prev.map(f => f.id === uf.id
            ? { ...f, status: 'failed', error: e.response?.data?.message || 'Upload failed' }
            : f
          ));
        }
      }
    }

    setUploading(false);

    // Mark job complete
    if (!cancelRef.current) {
      await apiClient.patch(`/pilot/upload-jobs/${currentJob.id}/complete`).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJob, uploadType]);

  const pending   = files.filter(f => f.status === 'pending').length;
  const completed = files.filter(f => f.status === 'complete').length;
  const failed    = files.filter(f => f.status === 'failed').length;
  const inFlight  = files.filter(f => ['uploading', 'processing'].includes(f.status)).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 pb-28">

      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight">AI Upload Center</h2>
        <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest font-bold">
          Gemini AI Analysis · Pix4D Auto-Dispatch
        </p>
      </div>

      {/* Mission selector */}
      <MissionPicker value={missionId} onChange={(id, sn) => { setMissionId(id); setSiteName(sn); }} />

      {/* Site name display */}
      {siteName && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Site</span>
          <span className="text-sm font-bold text-white">{siteName}</span>
        </div>
      )}

      {/* Analysis type */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Analysis Type</label>
        <div className="flex flex-col gap-1.5">
          {ANALYSIS_TYPES.map(a => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAnalysisType(a.value)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all
                ${analysisType === a.value
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
            >
              <span className={`text-xs font-bold ${analysisType === a.value ? 'text-indigo-200' : 'text-slate-300'}`}>{a.label}</span>
              <span className="text-[10px] text-slate-500">{a.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload type pills */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Upload Type</label>
        <div className="flex flex-wrap gap-2">
          {UPLOAD_TYPES.map(t => {
            const Icon = t.icon;
            const active = uploadType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setUploadType(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                  ${active
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
              >
                <Icon size={12} />{t.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">{currentType.desc}</p>
      </div>

      {/* Mission folder field (aerial types) */}
      {['images', 'thermal', 'orthomosaic'].includes(uploadType) && (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
            Mission / Flight ID <span className="text-red-400">*</span>
          </label>
          <input
            value={missionFolder}
            onChange={e => setMissionFolder(e.target.value)}
            placeholder="e.g. M14, Flight-3, Block-A-Day2"
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      )}

      {/* LBD block field */}
      {uploadType === 'lbd' && (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
            LBD Block ID <span className="text-red-400">*</span>
          </label>
          <input
            value={lbdBlock}
            onChange={e => setLbdBlock(e.target.value)}
            placeholder="e.g. Block-A, B3, Row-12"
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      )}

      {/* Error */}
      {jobError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{jobError}</p>
        </div>
      )}

      {/* Create / reset job button */}
      <button
        onClick={createJob}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all
          ${currentJob
            ? 'bg-slate-900 border border-slate-700 text-slate-400 hover:border-slate-500'
            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}
      >
        <Rocket size={12} />
        {currentJob ? 'Change Job Config' : 'Create Upload Job'}
      </button>

      {/* Job active confirmation */}
      {currentJob && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300 font-bold">Job Active · {uploadType} · Drop files below</p>
        </div>
      )}

      {/* No mission warning */}
      {!missionId && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">Select a mission above before creating a job</p>
        </div>
      )}

      {/* Sticky action bar */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl sticky top-0 z-10">
          <span className="text-xs text-slate-400 font-bold flex-1">
            {uploading
              ? `Uploading ${completed + inFlight}/${files.length}…`
              : `${completed} done · ${failed} failed · ${pending} pending`}
          </span>
          {uploading && (
            <button
              onClick={() => { cancelRef.current = true; }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300 hover:bg-red-900/70 font-bold transition-all"
            >
              <X size={11} /> Cancel
            </button>
          )}
          {!uploading && (
            <button
              onClick={() => setFiles([])}
              className="text-xs text-slate-600 hover:text-red-400 px-2 py-1 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!currentJob || uploading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all
              ${currentJob && !uploading
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >
            <Upload size={11} /> Add Files
          </button>
        </div>
      )}



      {/* Drop zone */}
      <div className="space-y-2">
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault(); setIsDragging(false);
            if (!currentJob) return;
            uploadFiles(Array.from(e.dataTransfer.files));
          }}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all
            ${!currentJob ? 'opacity-40 pointer-events-none' : ''}
            ${isDragging
              ? 'border-indigo-400 bg-indigo-500/10'
              : 'border-slate-700 hover:border-indigo-500/40 hover:bg-indigo-500/5'}`}
        >
          <Upload size={28} className={`mb-2 transition-colors ${isDragging ? 'text-indigo-400' : 'text-slate-600'}`} />
          <p className="text-xs font-semibold text-slate-400">
            {currentJob ? 'Drag files here' : 'Create an upload job first'}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            {currentJob ? currentType.accept.replace(/,/g, ' · ') : 'Configure mission, type, then click Create Upload Job'}
          </p>
        </div>

        {/* File buttons */}
        <div className="grid grid-cols-2 gap-2">
          <label className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none
            ${!currentJob ? 'opacity-40 pointer-events-none' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300'}`}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={currentType.accept}
              className="sr-only"
              disabled={!currentJob}
              onChange={e => { if (e.target.files?.length) uploadFiles(Array.from(e.target.files)); }}
            />
            <Upload size={12} /> Select Files
          </label>
          <label className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none
            ${!currentJob ? 'opacity-40 pointer-events-none' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300'}`}>
            <input
              type="file"
              multiple
              className="sr-only"
              disabled={!currentJob}
              // @ts-ignore
              webkitdirectory=""
              onChange={e => { if (e.target.files?.length) uploadFiles(Array.from(e.target.files)); }}
            />
            <FolderOpen size={12} /> Select Folder
          </label>
        </div>
      </div>

      {/* File queue */}
      {files.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Queue {completed}/{files.length}
            </span>
            {failed > 0 && <span className="text-[10px] text-red-400">{failed} failed</span>}
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/50">
            {files.map((f) => {
              const aiSummary = summarizeAI(f.aiResult);
              return (
                <div key={f.id} className="flex flex-col px-3 py-2.5 gap-1">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      {f.previewUrl ? (
                        <img src={f.previewUrl} alt={f.file.name}
                          className="w-8 h-8 rounded object-cover border border-slate-700" />
                      ) : (
                        <>
                          {f.status === 'complete'   && <CheckCircle2 size={13} className="text-emerald-400" />}
                          {f.status === 'failed'     && <AlertCircle  size={13} className="text-red-400" />}
                          {f.status === 'uploading'  && <RotateCw     size={13} className="text-indigo-400 animate-spin" />}
                          {f.status === 'processing' && <BrainCircuit size={13} className="text-amber-400 animate-pulse" />}
                          {f.status === 'pending'    && <Clock        size={13} className="text-slate-600" />}
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-300 truncate">{f.file.name}</p>
                      {f.error && <p className="text-[10px] text-red-400">{f.error}</p>}
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {(f.file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    {f.status === 'failed' && (
                      <button onClick={() => setFiles(p => p.filter(x => x.id !== f.id))} className="text-slate-600 hover:text-red-400 shrink-0">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  {/* Upload progress bar */}
                  {f.status === 'uploading' && (
                    <div className="h-0.5 bg-slate-800 rounded-full mx-8">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent jobs */}
      {recentJobs.length > 0 && files.length === 0 && (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Recent Upload Jobs</label>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/50">
            {recentJobs.slice(0, 6).map(job => (
              <div key={job.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-300 truncate">{job.missionTitle || job.missionId?.slice(0, 8)}</p>
                  <p className="text-[10px] text-slate-600">{job.uploadType} · {job.fileCount} file{job.fileCount !== 1 ? 's' : ''} · {new Date(job.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                  ${job.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' : job.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
    </div>
  );
};

export default UploadCenter;
