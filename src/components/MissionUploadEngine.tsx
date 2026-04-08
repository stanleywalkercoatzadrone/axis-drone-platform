import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, CheckCircle2, AlertCircle, RotateCw, X, Pause, Play,
  FileImage, Zap, FileText, Layers, CloudUpload, Wifi, WifiOff,
  ChevronDown, ChevronRight, Database, Rocket, BrainCircuit
} from 'lucide-react';
import apiClient from '../services/apiClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const CHUNK_SIZE      = 10 * 1024 * 1024; // 10 MB
const MAX_CONCURRENT_FILES   = 3;
const MAX_CONCURRENT_CHUNKS  = 5;
const MAX_RETRIES     = 5;
const IDB_STORE       = 'mission_upload_sessions_v2';
const IDB_DB          = 'axis_mission_engine_v2';

// ─── Types ────────────────────────────────────────────────────────────────────
type UploadType = 'images' | 'thermal' | 'lbd' | 'kml' | 'orthomosaic';
type FileStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'failed';

interface ManagedFile {
  id:             string;
  file:           File;
  fileType:       UploadType;
  status:         FileStatus;
  progress:       number; // 0-100
  chunkCount:     number;
  uploadedChunks: Set<number>;
  error:          string | null;
}

interface IDBSession {
  id:             string;
  fileId:         string;
  jobId:          string;
  fileName:       string;
  fileSize:       number;
  uploadedChunks: number[];
  chunkCount:     number;
}

const UPLOAD_TYPES: { value: UploadType; label: string; icon: React.FC<any>; desc: string; accept: string }[] = [
  { value: 'images',   label: 'Aerial RGB',      icon: FileImage, desc: 'JPEG/PNG flight imagery',         accept: 'image/jpeg,image/png,image/jpg' },
  { value: 'thermal',  label: 'Thermal / IR',    icon: Zap,       desc: 'TIFF radiometric thermal images', accept: 'image/tiff,image/x-tiff,.tif,.tiff' },
  { value: 'lbd',      label: 'LBD Scan',        icon: Layers,    desc: 'Line-By-Defect scan data',        accept: 'image/*,.csv,.xlsx,.zip,.tif,.tiff' },
  { value: 'kml',      label: 'KML Flight Path', icon: FileText,  desc: 'KML/KMZ mission path files',      accept: '.kml,.kmz' },
];

const ANALYSIS_TYPES = [
  { value: 'thermal_fault',          label: 'Thermal Fault Detection',   desc: 'Identify heat anomalies & hotspots' },
  { value: 'lbd_defect',             label: 'LBD Defect Scan',           desc: 'Line-by-defect structural analysis' },
  { value: 'rgb_anomaly',            label: 'RGB Anomaly Detection',     desc: 'Visual defects in aerial imagery' },
  { value: 'solar_panel',            label: 'Solar Panel Inspection',    desc: 'PV cell fault & soiling detection' },
  { value: 'full_inspection',        label: 'Full Inspection Suite',     desc: 'All analysis types combined' },
];

const FILE_TYPE_META: Record<UploadType, { icon: React.FC<any>; color: string; label: string }> = {
  images:      { icon: FileImage, color: 'text-blue-400',   label: 'RGB' },
  thermal:     { icon: Zap,       color: 'text-amber-400',  label: 'Thermal' },
  kml:         { icon: FileText,  color: 'text-emerald-400',label: 'KML' },
  lbd:         { icon: Layers,    color: 'text-slate-400',  label: 'LBD' },
  orthomosaic: { icon: FileImage, color: 'text-indigo-400', label: 'Ortho' },
};

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
async function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(db: IDBDatabase, id: string): Promise<IDBSession | undefined> {
  return new Promise(resolve => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(undefined);
  });
}

async function idbPut(db: IDBDatabase, session: IDBSession): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise(resolve => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => resolve();
  });
}

// ─── File classification ──────────────────────────────────────────────────────
function classifyFile(file: File): UploadType {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['kml', 'kmz'].includes(ext)) return 'kml';
  if (['tif', 'tiff'].includes(ext)) return 'thermal';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'images';
  return 'lbd';
}

function FileRow({ f, onRetry }: { f: ManagedFile; onRetry: (id: string) => void }) {
  const meta = FILE_TYPE_META[f.fileType];
  const Icon = meta.icon;
  const statusColor =
    f.status === 'completed' ? 'text-emerald-400' :
    f.status === 'failed'    ? 'text-red-400' :
    f.status === 'uploading' ? 'text-blue-400' :
    f.status === 'paused'    ? 'text-amber-400' : 'text-slate-500';

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
      <Icon size={14} className={meta.color} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium truncate">{f.file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                f.status === 'completed' ? 'bg-emerald-500' :
                f.status === 'failed'    ? 'bg-red-500' :
                f.status === 'paused'    ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${f.progress}%` }}
            />
          </div>
          <span className={`text-[9px] font-bold ${statusColor} min-w-[40px] text-right`}>
            {f.status === 'completed' ? '✓ Done' :
             f.status === 'failed'    ? 'Failed' :
             f.status === 'paused'    ? 'Paused' :
             f.status === 'uploading' ? `${f.progress}%` : 'Queued'}
          </span>
        </div>
      </div>
      {f.status === 'failed' && (
        <button onClick={() => onRetry(f.id)}
          className="flex items-center gap-1 px-2 py-1 bg-red-900/30 border border-red-500/30 rounded-lg text-[9px] text-red-400 hover:bg-red-900/50 transition-colors">
          <RotateCw size={9} /> Retry
        </button>
      )}
    </div>
  );
}

// ── Mission Picker (from UploadCenter) ───────────────────────────
function MissionPicker({ value, onChange }: { value: string; onChange: (id: string, siteName: string) => void; }) {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = React.useState(false);

  useEffect(() => {
    apiClient.get('/api/deployments?limit=50')
      .then(res => setMissions(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = missions.find(m => m.id === value);
  const getLabel = (m: any) => (m.project_name || m.site_name) ? `${m.project_name || m.site_name} — ${m.title}` : m.title;

  return (
    <div className="relative">
      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Mission</label>
      {loading ? (
        <div className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-500 animate-pulse">Loading missions...</div>
      ) : (
        <div className="relative">
          <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none cursor-pointer hover:border-slate-600 transition-colors">
            <span className={selected ? 'text-white font-medium' : 'text-slate-400'}>{selected ? getLabel(selected) : '— Select mission —'}</span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {missions.map(m => (
                <button key={m.id} type="button" onClick={() => { onChange(m.id, m.site_name || m.project_name || ''); setOpen(false); }} className="w-full text-left px-3 py-2.5 text-sm transition-colors text-white hover:bg-slate-800">
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

// ── Main Component ───────────────────────────────────────────────────────────
const MissionUploadEngine: React.FC<{ onComplete?: (jobId: string) => void }> = ({ onComplete }) => {

  const [missionId, setMissionId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [analysisType, setAnalysisType] = useState('thermal_fault');
  const [uploadType, setUploadType] = useState<UploadType>('images');
  const [missionFolder, setMissionFolder] = useState('');
  const [lbdBlock, setLbdBlock] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);

  const [files, setFiles]           = useState<ManagedFile[]>([]);
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'uploading' | 'paused' | 'completed' | 'failed'>('idle');
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const [showFiles, setShowFiles]   = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [jobError, setJobError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pauseRef     = useRef(false);
  const cancelRef    = useRef(false);
  const idbRef       = useRef<IDBDatabase | null>(null);
  const activeRef    = useRef<Set<string>>(new Set());

  useEffect(() => {
    const up   = () => { setIsOnline(true);  if (pauseRef.current) resumeUpload(); };
    const down = () => { setIsOnline(false); pauseUpload(); };
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    openIDB().then(db => { idbRef.current = db; }).catch(() => {});
  }, []);

  const totalFiles     = files.length;
  const completedFiles = files.filter(f => f.status === 'completed').length;
  const failedFiles    = files.filter(f => f.status === 'failed').length;
  const globalPct      = totalFiles > 0 ? Math.round((files.reduce((sum, f) => sum + f.progress, 0)) / totalFiles) : 0;

  const addFiles = useCallback((rawFiles: File[]) => {
    const managed: ManagedFile[] = rawFiles.map(file => ({
      id:             crypto.randomUUID(),
      file,
      fileType:       classifyFile(file),
      status:         'queued',
      progress:       0,
      chunkCount:     Math.max(1, Math.ceil(file.size / CHUNK_SIZE)),
      uploadedChunks: new Set(),
      error:          null,
    }));
    setFiles(prev => [...prev, ...managed]);
  }, []);

  const uploadFile = useCallback(async (managedFile: ManagedFile, activeJobId: string) => {
    const db = idbRef.current;
    activeRef.current.add(managedFile.id);

    const updateFile = (patch: Partial<ManagedFile>) =>
      setFiles(prev => prev.map(f => f.id === managedFile.id ? { ...f, ...patch } : f));

    try {
      updateFile({ status: 'uploading' });

      let resumedChunks = new Set<number>(managedFile.uploadedChunks);
      const savedSession = db ? await idbGet(db, managedFile.id) : undefined;
      let totalChunks = managedFile.chunkCount;

      if (savedSession && savedSession.jobId === activeJobId) {
        resumedChunks = new Set(savedSession.uploadedChunks);
      } else if (db) {
        await idbPut(db, {
          id: managedFile.id, fileId: managedFile.id, jobId: activeJobId,
          fileName: managedFile.file.name, fileSize: managedFile.file.size,
          uploadedChunks: [], chunkCount: totalChunks,
        });
      }

      const pendingChunks = Array.from({ length: totalChunks }, (_, i) => i).filter(i => !resumedChunks.has(i));

      for (let i = 0; i < pendingChunks.length; i += MAX_CONCURRENT_CHUNKS) {
        if (pauseRef.current || cancelRef.current) {
          updateFile({ status: pauseRef.current ? 'paused' : 'failed', error: cancelRef.current ? 'Cancelled' : null });
          activeRef.current.delete(managedFile.id);
          return;
        }

        const batch = pendingChunks.slice(i, i + MAX_CONCURRENT_CHUNKS);
        await Promise.all(batch.map(async chunkIdx => {
          let attempt = 0;
          while (attempt < MAX_RETRIES) {
            try {
              const start = chunkIdx * CHUNK_SIZE;
              const blob  = managedFile.file.slice(start, start + CHUNK_SIZE);

              const form = new FormData();
              form.append('image', blob, `${managedFile.file.name}.part${chunkIdx}`);
              form.append('fileId', managedFile.id);
              form.append('fileName', managedFile.file.name);
              form.append('mimeType', managedFile.file.type);
              form.append('chunkIndex', chunkIdx.toString());
              form.append('totalChunks', totalChunks.toString());

              await apiClient.post(`/pilot/upload-jobs/${activeJobId}/chunk`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000 // 60s timeout for chunks
              });

              resumedChunks.add(chunkIdx);
              if (db) {
                const saved = await idbGet(db, managedFile.id);
                if (saved) {
                  saved.uploadedChunks = Array.from(resumedChunks);
                  await idbPut(db, saved);
                }
              }
              const pct = Math.round((resumedChunks.size / totalChunks) * 100);
              updateFile({ progress: pct, uploadedChunks: new Set(resumedChunks) });
              break; // success
            } catch (err) {
              attempt++;
              if (attempt >= MAX_RETRIES) throw err;
              await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 30000)));
            }
          }
        }));
      }

      if (db) await idbDelete(db, managedFile.id);
      updateFile({ status: 'completed', progress: 100 });

    } catch (err: any) {
      updateFile({ status: 'failed', error: err.message || 'Upload failed' });
    } finally {
      activeRef.current.delete(managedFile.id);
    }
  }, []);

  const startUpload = useCallback(async () => {
    if (!missionId || files.length === 0) return;
    setJobError('');

    if (uploadType === 'lbd' && !lbdBlock.trim()) return setJobError('LBD block identifier is required.');
    if (['images', 'thermal'].includes(uploadType) && !missionFolder.trim()) return setJobError('Mission folder / flight ID required.');

    pauseRef.current  = false;
    cancelRef.current = false;
    setGlobalStatus('uploading');

    let currentJobId = jobId;
    if (!currentJobId) {
      try {
        const r = await apiClient.post('/api/pilot/upload-jobs', {
          missionId, uploadType, analysisType, lbdBlock, missionFolder
        });
        currentJobId = r.data.data.id;
        setJobId(currentJobId);
      } catch (e: any) {
        setJobError(e.response?.data?.message || 'Failed to create job.');
        setGlobalStatus('failed');
        return;
      }
    }

    const queued = files.filter(f => f.status === 'queued' || f.status === 'failed');

    for (let i = 0; i < queued.length; i += MAX_CONCURRENT_FILES) {
      if (pauseRef.current || cancelRef.current) break;
      const batch = queued.slice(i, i + MAX_CONCURRENT_FILES);
      await Promise.all(batch.map(f => uploadFile(f, currentJobId!)));
    }

    const allDone = files.every(f => f.status === 'completed' || f.status === 'failed');
    if (allDone && currentJobId) {
      const anyFailed = files.some(f => f.status === 'failed');
      if (!anyFailed) {
        await apiClient.patch(`/api/pilot/upload-jobs/${currentJobId}/complete`).catch(() => {});
        setGlobalStatus('completed');
        onComplete?.(currentJobId);
      } else {
        setGlobalStatus('failed');
      }
    }
  }, [missionId, files, jobId, uploadType, analysisType, lbdBlock, missionFolder, uploadFile, onComplete]);

  const pauseUpload  = useCallback(() => { pauseRef.current = true;  setGlobalStatus('paused'); }, []);
  const resumeUpload = useCallback(() => { pauseRef.current = false; startUpload(); }, [startUpload]);
  const cancelUpload = useCallback(() => { cancelRef.current = true; setGlobalStatus('idle'); setFiles([]); setJobId(null); }, []);
  const retryFile    = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'queued', error: null, progress: 0 } : f));
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const canStart  = files.some(f => f.status === 'queued' || f.status === 'failed') && missionId;
  const isActive  = globalStatus === 'uploading';
  const isPaused  = globalStatus === 'paused';
  const isDone    = globalStatus === 'completed';

  return (
    <div className="w-full flex flex-col space-y-4 pb-12 w-full">
      <div>
        <h2 className="text-sm font-black uppercase tracking-tight text-white/90">Mission Intelligence Engine</h2>
        <p className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-widest font-bold">
          Ingestion & Analysis Pipeline
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="space-y-3">
          <MissionPicker value={missionId} onChange={(id, sn) => { setMissionId(id); setSiteName(sn); }} />

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Analysis Type</label>
            <div className="flex flex-col gap-1.5">
              {ANALYSIS_TYPES.map(a => (
                <button key={a.value} onClick={() => setAnalysisType(a.value)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all
                  ${analysisType === a.value ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
                  <span className="text-xs font-bold">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Upload Target</label>
            <div className="flex flex-wrap gap-2">
              {UPLOAD_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.value} onClick={() => setUploadType(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                    ${uploadType === t.value ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                    <Icon size={12} />{t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {['images', 'thermal'].includes(uploadType) && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Mission / Flight ID <span className="text-red-400">*</span></label>
              <input value={missionFolder} onChange={e => setMissionFolder(e.target.value)} placeholder="e.g. Flight-01" className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm" />
            </div>
          )}

          {uploadType === 'lbd' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">LBD Block ID <span className="text-red-400">*</span></label>
              <input value={lbdBlock} onChange={e => setLbdBlock(e.target.value)} placeholder="e.g. Block-A" className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm" />
            </div>
          )}
        </div>
      </div>

      {jobError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={14} className="text-red-400" />
          <p className="text-xs text-red-300">{jobError}</p>
        </div>
      )}

      {/* Online/offline badge */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest w-fit ${isOnline ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-red-900/20 border-red-500/30 text-red-400'}`}>
        {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
        {isOnline ? 'Online — chunk uploads active' : 'Offline — uploads paused'}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer border border-dashed rounded-xl p-5 flex flex-col items-center gap-2 transition-all
          ${isDragging ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]' : 'border-slate-800 hover:border-slate-600 bg-slate-900/50'}`}
      >
        <CloudUpload size={24} className={isDragging ? 'text-indigo-400' : 'text-slate-400'} />
        <p className="text-sm font-bold text-white">Drag & drop mission data</p>
        <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,.tif,.tiff,.kml,.kmz,.csv,.xlsx,.zip" onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />
      </div>

      {/* Global progress */}
      {globalStatus !== 'idle' && totalFiles > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-white uppercase tracking-widest">{completedFiles} / {totalFiles} files · {globalPct}%</p>
            <span className="text-[9px] font-black uppercase text-indigo-400">{globalStatus}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${globalPct}%` }} /></div>
        </div>
      )}

      {/* File list */}
      {totalFiles > 0 && (
        <div className="border border-slate-800 rounded-2xl overflow-hidden">
          <button onClick={() => setShowFiles(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">File List · {totalFiles} files</span>
            {showFiles ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showFiles && (
            <div className="max-h-64 overflow-y-auto p-3 space-y-1.5 bg-slate-950">
              {files.slice(0, 200).map(f => <FileRow key={f.id} f={f} onRetry={retryFile} />)}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
        {canStart && !isActive && <button onClick={startUpload} className="w-full justify-center px-4 py-3 bg-indigo-600 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors tracking-wider"><Upload size={13} /> Inject Files</button>}
        {isActive && <button onClick={pauseUpload} className="w-full justify-center px-4 py-3 bg-amber-600/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-amber-600/30 transition-colors"><Pause size={13} /> Pause Stream</button>}
        {isPaused && <button onClick={resumeUpload} className="w-full justify-center px-4 py-3 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-blue-600/30 transition-colors"><Play size={13} /> Resume Stream</button>}
        {globalStatus !== 'idle' && !isDone && <button onClick={cancelUpload} className="w-full justify-center px-4 py-2.5 bg-red-900/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-red-900/30 transition-colors"><X size={13} /> Abort Injection</button>}
        {isDone && <div className="w-full justify-center px-4 py-3 bg-emerald-900/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold uppercase flex items-center gap-2"><CheckCircle2 size={13} /> Stream Finished</div>}
      </div>
    </div>
  );
};

export default MissionUploadEngine;
