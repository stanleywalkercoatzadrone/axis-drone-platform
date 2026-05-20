/**
 * MissionUploader.tsx — Enterprise Mission Data Ingestion Engine
 *
 * Features:
 *  - Drag & drop / multi-file selection (10,000+ files)
 *  - Auto file classification (RGB / Thermal / KML / Other)
 *  - 10MB chunked upload → signed GCS URLs (no server proxy)
 *  - Max 10 concurrent chunk threads per file (5 files parallel)
 *  - IndexedDB persistence: survives page reload / network drop
 *  - Automatic pause on offline, auto-resume on reconnect
 *  - Per-chunk exponential backoff retry (max 5 attempts)
 *  - Per-file progress bars + global mission progress
 *  - Pause / Resume / Retry / Cancel controls
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, CheckCircle2, AlertCircle, RotateCw, X, Pause, Play,
  FileImage, Zap, FileText, Layers, CloudUpload, Wifi, WifiOff,
  ChevronDown, ChevronRight, Database, FolderUp,
} from 'lucide-react';
import apiClient from '../services/apiClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const CHUNK_SIZE      = 10 * 1024 * 1024; // 10 MB
const MAX_CONCURRENT_FILES   = 5;
const MAX_CONCURRENT_CHUNKS  = 10;
const MAX_RETRIES     = 5;
const IDB_STORE       = 'mission_upload_sessions';
const IDB_DB          = 'axis_mission_engine';

// ─── Types ────────────────────────────────────────────────────────────────────
type FileType = 'rgb' | 'thermal' | 'kml' | 'other';
type FileStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'failed';

interface ManagedFile {
  id:             string;
  file:           File;
  fileType:       FileType;
  status:         FileStatus;
  progress:       number; // 0-100
  chunkCount:     number;
  uploadedChunks: Set<number>;
  sessionId:      string | null;
  error:          string | null;
  previewUrl?:    string;
}

interface IDBSession {
  id:             string;
  fileId:         string;
  fileName:       string;
  fileSize:       number;
  sessionId:      string;
  uploadedChunks: number[];
  chunkCount:     number;
  storagePath:    string;
}

interface Props {
  missionId: string;
  siteName?: string;
  initialFiles?: File[];
  onComplete?: (datasetId: string) => void;
}

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
function classifyFile(file: File): FileType {
  const path = (file as any).webkitRelativePath || file.name;
  const lowerPath = path.toLowerCase();
  
  if (lowerPath.includes('/thermal/') || lowerPath.includes('/ir/')) return 'thermal';
  if (lowerPath.includes('/rgb/') || lowerPath.includes('/visual/')) return 'rgb';
  if (lowerPath.includes('/kml/') || lowerPath.includes('/path/')) return 'kml';

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['kml', 'kmz'].includes(ext)) return 'kml';
  if (['tif', 'tiff'].includes(ext)) return 'thermal';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'rgb';
  return 'other';
}

// ─── Exponential backoff PUT ──────────────────────────────────────────────────
async function putChunkWithRetry(
  url: string, blob: Blob, attempt = 0
): Promise<void> {
  try {
    const resp = await fetch(url, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 30_000);
    await new Promise(r => setTimeout(r, delay));
    return putChunkWithRetry(url, blob, attempt + 1);
  }
}

// ─── FileRow ─────────────────────────────────────────────────────────────────
const FILE_TYPE_META: Record<FileType, { icon: React.FC<any>; color: string; label: string }> = {
  rgb:     { icon: FileImage, color: 'text-blue-400',   label: 'RGB' },
  thermal: { icon: Zap,       color: 'text-amber-400',  label: 'Thermal' },
  kml:     { icon: FileText,  color: 'text-emerald-400',label: 'KML' },
  other:   { icon: Layers,    color: 'text-slate-400',  label: 'Other' },
};

function FileCard({ f, onRetry }: { f: ManagedFile; onRetry: (id: string) => void }) {
  const meta = FILE_TYPE_META[f.fileType];
  const Icon = meta.icon;
  const statusColor =
    f.status === 'completed' ? 'text-emerald-400' :
    f.status === 'failed'    ? 'text-red-400' :
    f.status === 'uploading' ? 'text-blue-400' :
    f.status === 'paused'    ? 'text-amber-400' : 'text-slate-300';

  return (
    <div className="relative group flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden aspect-square transition-all hover:border-slate-600">
      {f.previewUrl ? (
        <img src={f.previewUrl} alt={f.file.name} loading="lazy" decoding="async" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-800/30">
          <Icon size={28} className={meta.color} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent flex flex-col justify-end p-2.5">
        <p className="text-[10px] text-white font-medium truncate drop-shadow-md">{f.file.name}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 bg-slate-800/80 backdrop-blur-sm rounded-full overflow-hidden border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                f.status === 'completed' ? 'bg-emerald-500' :
                f.status === 'failed'    ? 'bg-red-500' :
                f.status === 'paused'    ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${f.progress}%` }}
            />
          </div>
          <span className={`text-[9px] font-bold ${statusColor} drop-shadow-md min-w-[32px] text-right`}>
            {f.status === 'completed' ? 'Done' :
             f.status === 'failed'    ? 'Fail' :
             f.status === 'paused'    ? 'Pause' :
             f.status === 'uploading' ? `${f.progress}%` : 'Wait'}
          </span>
        </div>
        {f.status === 'failed' && (
          <button onClick={(e) => { e.stopPropagation(); onRetry(f.id); }}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-red-900/80 backdrop-blur border border-red-500/50 rounded-lg text-[9px] text-white hover:bg-red-900 transition-colors">
            <RotateCw size={9} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MissionUploader: React.FC<Props> = ({ missionId, siteName, initialFiles, onComplete }) => {
  const [files, setFiles]           = useState<ManagedFile[]>([]);
  const [datasetId, setDatasetId]   = useState<string | null>(null);
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'uploading' | 'paused' | 'completed' | 'failed'>('idle');
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const [showFiles, setShowFiles]   = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pauseRef     = useRef(false);
  const cancelRef    = useRef(false);
  const idbRef       = useRef<IDBDatabase | null>(null);
  const activeRef    = useRef<Set<string>>(new Set());

  // ── Online/offline detection ─────────────────────────────────────────────
  useEffect(() => {
    const up   = () => { setIsOnline(true);  if (pauseRef.current) resumeUpload(); };
    const down = () => { setIsOnline(false); pauseUpload(); };
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // ── Init IndexedDB ───────────────────────────────────────────────────────
  useEffect(() => {
    openIDB().then(db => { idbRef.current = db; }).catch(() => {});
  }, []);

  // ── Derived progress ──────────────────────────────────────────────────────
  const totalFiles     = files.length;
  const completedFiles = files.filter(f => f.status === 'completed').length;
  const failedFiles    = files.filter(f => f.status === 'failed').length;
  const globalPct      = totalFiles > 0
    ? Math.round((files.reduce((sum, f) => sum + f.progress, 0)) / totalFiles)
    : 0;

  // ── File addition ─────────────────────────────────────────────────────────
  const addFiles = useCallback((rawFiles: File[]) => {
    const managed: ManagedFile[] = rawFiles.map(file => {
      const fileType = classifyFile(file);
      const previewUrl = ['rgb', 'thermal'].includes(fileType) ? URL.createObjectURL(file) : undefined;
      return {
        id:             crypto.randomUUID(),
        file,
        fileType,
        previewUrl,
        status:         'queued',
        progress:       0,
        chunkCount:     Math.max(1, Math.ceil(file.size / CHUNK_SIZE)),
        uploadedChunks: new Set(),
        sessionId:      null,
        error:          null,
      };
    });
    setFiles(prev => [...prev, ...managed]);
  }, []);

  // ── Auto-ingest initial files ─────────────────────────────────────────────
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      addFiles(initialFiles);
    }
  }, [initialFiles, addFiles]);

  // ── Upload a single file ──────────────────────────────────────────────────
  const uploadFile = useCallback(async (managedFile: ManagedFile, currentDatasetId: string) => {
    const db = idbRef.current;
    activeRef.current.add(managedFile.id);

    const updateFile = (patch: Partial<ManagedFile>) =>
      setFiles(prev => prev.map(f => f.id === managedFile.id ? { ...f, ...patch } : f));

    try {
      updateFile({ status: 'uploading' });

      // Check IndexedDB for an existing session (resume)
      let sessionId   = managedFile.sessionId;
      let resumedChunks = new Set<number>(managedFile.uploadedChunks);
      let allSignedUrls: { index: number; url: string }[] = [];

      const savedSession = db ? await idbGet(db, managedFile.id) : undefined;

      if (savedSession && savedSession.sessionId) {
        // Resume existing session — re-fetch missing chunk URLs
        sessionId = savedSession.sessionId;
        resumedChunks = new Set(savedSession.uploadedChunks);

        if (resumedChunks.size < savedSession.chunkCount) {
          const missing = Array.from({ length: savedSession.chunkCount }, (_, i) => i)
            .filter(i => !resumedChunks.has(i));
          const retryRes = await apiClient.post('/mission-uploads/retry', {
            upload_session_id: sessionId, missing_chunks: missing,
          });
          allSignedUrls = retryRes.data.signed_urls;
        }
      } else {
        // Fresh initiation
        const res = await apiClient.post('/mission-uploads/initiate', {
          dataset_id: currentDatasetId,
          mission_id: missionId,
          file_name:  managedFile.file.name,
          file_size:  managedFile.file.size,
          file_type:  managedFile.fileType,
        });

        sessionId     = res.data.upload_session_id;
        allSignedUrls = res.data.signed_urls;

        // Persist to IndexedDB
        if (db) {
          await idbPut(db, {
            id:             managedFile.id,
            fileId:         res.data.file_id,
            fileName:       managedFile.file.name,
            fileSize:       managedFile.file.size,
            sessionId:      sessionId!,
            uploadedChunks: [],
            chunkCount:     res.data.total_chunks,
            storagePath:    '',
          });
        }

        updateFile({ sessionId });
      }

      const totalChunks  = savedSession?.chunkCount ?? Math.max(1, Math.ceil(managedFile.file.size / CHUNK_SIZE));
      const urlMap = new Map(allSignedUrls.map(u => [u.index, u.url]));

      // Build list of pending chunks
      const pendingChunks = Array.from({ length: totalChunks }, (_, i) => i)
        .filter(i => !resumedChunks.has(i));

      // Upload in batches of MAX_CONCURRENT_CHUNKS
      for (let i = 0; i < pendingChunks.length; i += MAX_CONCURRENT_CHUNKS) {
        if (pauseRef.current || cancelRef.current) {
          updateFile({ status: pauseRef.current ? 'paused' : 'failed', error: cancelRef.current ? 'Cancelled' : null });
          activeRef.current.delete(managedFile.id);
          return;
        }

        const batch = pendingChunks.slice(i, i + MAX_CONCURRENT_CHUNKS);
        await Promise.all(batch.map(async chunkIdx => {
          const start = chunkIdx * CHUNK_SIZE;
          const blob  = managedFile.file.slice(start, start + CHUNK_SIZE);
          const url   = urlMap.get(chunkIdx);
          if (!url) throw new Error(`No signed URL for chunk ${chunkIdx}`);

          await putChunkWithRetry(url, blob);

          // Acknowledge chunk to backend
          await apiClient.post('/mission-uploads/chunk', {
            upload_session_id: sessionId,
            chunk_index:       chunkIdx,
          });

          resumedChunks.add(chunkIdx);

          // Update IDB
          if (db) {
            const saved = await idbGet(db, managedFile.id);
            if (saved) {
              saved.uploadedChunks = Array.from(resumedChunks);
              await idbPut(db, saved);
            }
          }

          // Update progress
          const pct = Math.round((resumedChunks.size / totalChunks) * 100);
          updateFile({ progress: pct, uploadedChunks: new Set(resumedChunks) });
        }));
      }

      // Trigger GCS Compose to assemble fragments
      await apiClient.post('/mission-uploads/complete', { upload_session_id: sessionId });

      // Cleanup IDB
      if (db) await idbDelete(db, managedFile.id);

      updateFile({ status: 'completed', progress: 100 });

    } catch (err: any) {
      updateFile({ status: 'failed', error: err.message || 'Upload failed' });
    } finally {
      activeRef.current.delete(managedFile.id);
    }
  }, [missionId]);

  // ── Start upload session ──────────────────────────────────────────────────
  const startUpload = useCallback(async () => {
    if (!missionId || files.length === 0) return;
    pauseRef.current  = false;
    cancelRef.current = false;
    setGlobalStatus('uploading');

    // Create dataset if not already created
    let currentDatasetId = datasetId;
    if (!currentDatasetId) {
      const res = await apiClient.post('/mission-uploads/dataset/create', {
        mission_id:  missionId,
        total_files: files.length,
      });
      currentDatasetId = res.data.dataset_id;
      setDatasetId(currentDatasetId);
    }

    const queued = files.filter(f => f.status === 'queued' || f.status === 'failed');

    // Upload up to MAX_CONCURRENT_FILES in parallel
    for (let i = 0; i < queued.length; i += MAX_CONCURRENT_FILES) {
      if (pauseRef.current || cancelRef.current) break;
      const batch = queued.slice(i, i + MAX_CONCURRENT_FILES);
      await Promise.all(batch.map(f => uploadFile(f, currentDatasetId!)));
    }

    // Mark dataset complete if all done
    const allDone = files.every(f => f.status === 'completed' || f.status === 'failed');
    if (allDone && currentDatasetId) {
      const anyFailed = files.some(f => f.status === 'failed');
      if (!anyFailed) {
        await apiClient.post('/mission-uploads/dataset/complete', { dataset_id: currentDatasetId });
        setGlobalStatus('completed');
        onComplete?.(currentDatasetId);
      } else {
        setGlobalStatus('failed');
      }
    }
  }, [missionId, files, datasetId, uploadFile, onComplete]);

  const pauseUpload  = useCallback(() => { pauseRef.current = true;  setGlobalStatus('paused');    }, []);
  const resumeUpload = useCallback(() => { pauseRef.current = false; startUpload();                }, [startUpload]);
  const cancelUpload = useCallback(() => { cancelRef.current = true; setGlobalStatus('idle'); setFiles([]); setDatasetId(null); }, []);
  const retryFile    = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'queued', error: null, progress: 0 } : f));
  }, []);

  // ── Drop handlers ─────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }, [addFiles]);

  // ─── UI ───────────────────────────────────────────────────────────────────
  const canStart  = files.some(f => f.status === 'queued' || f.status === 'failed');
  const isActive  = globalStatus === 'uploading';
  const isPaused  = globalStatus === 'paused';
  const isDone    = globalStatus === 'completed';

  return (
    <div className="space-y-4">
      {/* Online/offline badge */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest w-fit
        ${isOnline ? 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-400' : 'bg-red-900/20 border border-red-500/30 text-red-400'}`}>
        {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
        {isOnline ? 'Online — uploads active' : 'Offline — uploads paused, progress saved'}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-all duration-200
          ${isDragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'}`}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
          ${isDragging ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
          <CloudUpload size={24} className={isDragging ? 'text-indigo-400' : 'text-slate-400'} />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">
            {isDragging ? 'Drop files or folders' : 'Ingest Mission Data'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            RGB · Thermal TIFF · KML · 10,000+ files supported · Directory trees preserved
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition-all flex items-center gap-2"
            >
                <FileText size={12} className="text-blue-400" />
                Choose Files
            </button>
            <span className="text-slate-700 font-bold text-[9px] uppercase tracking-tighter">OR</span>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition-all flex items-center gap-2"
            >
                <FolderUp size={12} className="text-emerald-400" />
                Choose Folder
            </button>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {['rgb', 'thermal', 'kml', 'other'].map(type => {
            const m = FILE_TYPE_META[type as FileType];
            return (
              <span key={type} className={`flex items-center gap-1 text-[9px] font-bold uppercase ${m.color}`}>
                <m.icon size={9} />{m.label}
              </span>
            );
          })}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.tif,.tiff,.kml,.kmz,.csv,.xlsx,.zip"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }}
        />
      </div>

      {/* File count summary */}
      {totalFiles > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
            <Database size={12} className="text-slate-400" />
            <span className="text-xs font-bold text-white">{totalFiles.toLocaleString()} files</span>
          </div>
          {(['rgb','thermal','kml','other'] as FileType[]).map(type => {
            const count = files.filter(f => f.fileType === type).length;
            if (!count) return null;
            const m = FILE_TYPE_META[type];
            return (
              <span key={type} className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold ${m.color}`}>
                <m.icon size={9} /> {count.toLocaleString()} {m.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Global progress bar */}
      {globalStatus !== 'idle' && totalFiles > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-widest">Mission Upload Progress</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {completedFiles} / {totalFiles} files · {failedFiles > 0 ? `${failedFiles} failed · ` : ''}{globalPct}%
              </p>
            </div>
            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${
              isDone    ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' :
              isPaused  ? 'bg-amber-900/30 border-amber-500/30 text-amber-400' :
              isActive  ? 'bg-blue-900/30 border-blue-500/30 text-blue-400' :
                          'bg-red-900/30 border-red-500/30 text-red-400'
            }`}>
              {isDone ? '✓ Complete' : isPaused ? '⏸ Paused' : isActive ? '↑ Uploading' : 'Failed'}
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isDone   ? 'bg-emerald-500' :
                isPaused ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ width: `${globalPct}%` }}
            />
          </div>
        </div>
      )}

      {/* File list (collapsible) */}
      {totalFiles > 0 && (
        <div className="border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowFiles(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              File List · {totalFiles.toLocaleString()} files
            </span>
            {showFiles ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
          </button>
          {showFiles && (
            <div className="max-h-[60vh] overflow-y-auto p-4 bg-slate-950">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {files.slice(0, 200).map(f => (
                  <FileCard key={f.id} f={f} onRetry={retryFile} />
                ))}
              </div>
              {files.length > 200 && (
                <div className="mt-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    +{(files.length - 200).toLocaleString()} more files in queue not shown
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action controls */}
      {totalFiles > 0 && (
        <div className="flex gap-2 flex-wrap">
          {canStart && !isActive && (
            <button
              onClick={startUpload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-black uppercase hover:opacity-90 transition-opacity"
            >
              <Upload size={13} /> Start Upload
            </button>
          )}

          {!isActive && !isPaused && files.length > 0 && (
            <button
              onClick={() => { setFiles([]); setGlobalStatus('idle'); setDatasetId(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 text-xs font-bold uppercase hover:bg-slate-700 transition-colors"
            >
              <X size={13} /> Clear Queue
            </button>
          )}

          {isActive && (
            <button
              onClick={pauseUpload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase hover:bg-amber-600/30 transition-colors"
            >
              <Pause size={13} /> Pause
            </button>
          )}

          {isPaused && (
            <button
              onClick={resumeUpload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-black uppercase hover:bg-blue-600/30 transition-colors"
            >
              <Play size={13} /> Resume
            </button>
          )}

          {globalStatus !== 'idle' && !isDone && (
            <button
              onClick={cancelUpload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-900/40 transition-colors"
            >
              <X size={13} /> Cancel
            </button>
          )}

          {isDone && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase">
              <CheckCircle2 size={13} /> Upload Complete
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MissionUploader;
