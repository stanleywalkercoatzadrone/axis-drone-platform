/**
 * AIUploadsAdmin.tsx — Admin panel: all pilot AI upload jobs + inline AI reports + image thumbnails
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit, FileImage, Zap, Layers, FileText, BarChart3,
  CheckCircle2, AlertTriangle, Clock, RotateCw, ChevronDown,
  ChevronRight, RefreshCw, Image, Eye, Thermometer, Activity,
  Printer, Trash2, CheckSquare, Square,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { AIReportViewer } from './AIReportPage';
import MissionMapGrid from './MissionMapGrid';

// ── Types ──────────────────────────────────────────────────────────────────────
interface UploadJob {
  id: string;
  mission_id: string;
  mission_title: string;
  site_name: string;
  pilot_email: string;
  pilot_name: string;
  upload_type: string;
  analysis_type: string;
  status: string;
  file_count: string;
  ai_result: any;
  created_at: string;
  updated_at: string;
}

interface DeploymentFile {
  id: string;
  file_name: string;
  storage_url: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.FC<any>> = {
  images: FileImage, thermal: Thermometer, lbd: Layers, kml: FileText,
  orthomosaic: BarChart3,
};

const STATUS_STYLES: Record<string, string> = {
  complete:   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  processing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  pending:    'bg-slate-800 text-slate-400 border border-slate-700',
  failed:     'bg-red-500/10 text-red-400 border border-red-500/20',
};

function fmt(dt: string) {
  try { return new Date(dt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return dt; }
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|tiff?|bmp)(\?|$)/i.test(url);
}

// ── AI Result Panel ─────────────────────────────────────────────────────────
function AIResultPanel({ result, uploadType }: { result: any; uploadType: string }) {
  if (!result) return null;

  const faults    = result.faults     ?? [];
  const defects   = result.defects    ?? [];
  const anomalies = result.anomalies  ?? [];
  const items     = [...faults, ...defects, ...anomalies];
  const totalCount = result.totalFaults ?? result.totalDefects ?? items.length ?? 0;
  const condition = result.overallCondition ?? result.overallSeverity ?? '—';
  const summary   = result.summary ?? '';
  const recs      = result.recommendations ?? [];
  const maxTemp   = result.maxTempDelta;

  const condColor = condition.includes('good') || condition.includes('low')
    ? 'text-emerald-400' : condition.includes('critical')
    ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="mt-2 p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <BrainCircuit size={11} className="text-indigo-400" />
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI Analysis</span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
          <p className="text-[9px] text-slate-500 uppercase">Faults / Defects</p>
          <p className={`text-xl font-black ${totalCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{totalCount}</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
          <p className="text-[9px] text-slate-500 uppercase">Condition</p>
          <p className={`text-xs font-bold capitalize mt-0.5 ${condColor}`}>{condition}</p>
        </div>
        {maxTemp != null && (
          <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
            <p className="text-[9px] text-slate-500 uppercase">Max ΔT</p>
            <p className="text-xl font-black text-orange-400">{maxTemp}°</p>
          </div>
        )}
        {result.imageQuality && (
          <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
            <p className="text-[9px] text-slate-500 uppercase">Image Quality</p>
            <p className="text-xs font-bold capitalize mt-0.5 text-slate-300">{result.imageQuality}</p>
          </div>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <p className="text-[11px] text-slate-300 leading-relaxed">{summary}</p>
      )}

      {/* Fault / defect list */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Detected Issues</p>
          {items.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase border
                ${item.severity === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : item.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                  : item.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {item.severity || 'low'}
              </span>
              <span className="text-slate-300 flex-1">{item.type}</span>
              {item.location && <span className="text-slate-600 text-[9px]">{item.location}</span>}
              {item.confidence != null && (
                <span className="text-slate-600 text-[9px]">{Math.round(item.confidence * 100)}%</span>
              )}
            </div>
          ))}
          {items.length > 5 && (
            <p className="text-[9px] text-slate-600">+{items.length - 5} more issues</p>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Recommendations</p>
          <ul className="space-y-0.5">
            {recs.slice(0, 3).map((r: string, i: number) => (
              <li key={i} className="text-[10px] text-slate-400 flex gap-1.5">
                <span className="text-indigo-500 shrink-0">→</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Image Grid ─────────────────────────────────────────────────────────────────
function ImageGrid({ files }: { files: DeploymentFile[] }) {
  const imageFiles = files.filter(f => isImageUrl(f.storage_url || '') || /image/i.test(f.mime_type || ''));
  if (imageFiles.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
        Images ({imageFiles.length})
      </p>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
        {imageFiles.slice(0, 12).map(f => (
          <a
            key={f.id}
            href={f.storage_url}
            target="_blank"
            rel="noreferrer"
            className="relative group rounded-lg overflow-hidden bg-slate-800 border border-slate-700 aspect-square"
            title={f.file_name}
          >
            <img
              src={f.storage_url}
              alt={f.file_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye size={12} className="text-white" />
            </div>
          </a>
        ))}
        {imageFiles.length > 12 && (
          <div className="rounded-lg bg-slate-800 border border-slate-700 aspect-square flex items-center justify-center">
            <p className="text-[10px] text-slate-500 font-bold">+{imageFiles.length - 12}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Job Row ────────────────────────────────────────────────────────────────────
function JobRow({ job, onDelete, isSelected }: {
  job: UploadJob;
  onDelete?: (id: string) => void;
  isSelected?: boolean;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [files, setFiles]             = useState<DeploymentFile[]>([]);
  const [loading, setLoading]         = useState(false);
  const [reportData, setReportData]   = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport]   = useState(false);
  const Icon = TYPE_ICONS[job.upload_type] || FileImage;
  const aiResult = job.ai_result;

  const loadFiles = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (files.length > 0) return;
    setLoading(true);
    try {
      const r = await apiClient.get(`/pilot/upload-jobs/${job.id}/files`);
      setFiles(r.data?.data || []);
    } catch (_) {} finally { setLoading(false); }
  };

  const generateReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setReportLoading(true);
    try {
      const r = await apiClient.post(`/pilot/upload-jobs/${job.id}/report`);
      setReportData(r.data?.reportData ?? null);
      setShowReport(true);
    } catch (_) {} finally { setReportLoading(false); }
  };

  const viewReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reportData) { setShowReport(true); return; }
    setReportLoading(true);
    try {
      const r = await apiClient.get(`/pilot/upload-jobs/${job.id}/report`);
      setReportData(r.data?.data ?? null);
      setShowReport(true);
    } catch (_) {} finally { setReportLoading(false); }
  };

  if (showReport && reportData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <AIReportViewer report={reportData} onBack={() => setShowReport(false)} />
      </div>
    );
  }

  const faultCount = aiResult?.totalFaults ?? aiResult?.totalDefects ?? null;
  const cond = aiResult?.overallCondition ?? aiResult?.overallSeverity;

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-colors
      ${isSelected ? 'border-red-500/40' : 'border-slate-800'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={loadFiles}>
        <div className="shrink-0 text-slate-500">
          {loading
            ? <RotateCw size={14} className="animate-spin text-slate-400" />
            : expanded
              ? <ChevronDown size={14} />
              : <ChevronRight size={14} />}
        </div>
        <div className="shrink-0 p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <Icon size={12} className="text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-white truncate">
              {job.site_name ? `${job.site_name} — ` : ''}{job.mission_title || job.mission_id?.slice(0,8)}
            </p>
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${STATUS_STYLES[job.status] || STATUS_STYLES.pending}`}>
              {job.status}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {job.pilot_name || job.pilot_email} · {job.upload_type}
            {job.analysis_type ? ` · ${job.analysis_type.replace(/_/g,' ')}` : ''}
            · {parseInt(job.file_count)||0} files · {fmt(job.created_at)}
          </p>
        </div>

        {/* Report buttons */}
        <div className="shrink-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {aiResult && (
            <>
              <button onClick={viewReport} disabled={reportLoading}
                className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-lg border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50">
                {reportLoading ? <RotateCw size={9} className="animate-spin" /> : <Eye size={9} />} Report
              </button>
              <button onClick={generateReport} disabled={reportLoading}
                className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-lg border bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 transition-colors">
                <Printer size={9} /> PDF
              </button>
            </>
          )}
          {faultCount != null && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border
              ${faultCount > 0
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
              <Activity size={10} />
              {faultCount}
            </div>
          )}
          {/* Individual delete */}
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(job.id); }}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-lg border bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
              <Trash2 size={9} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded: Map grid + AI results */}
      {expanded && (
        <div className="border-t border-slate-800">
          <MissionMapGrid
            missionId={job.mission_id}
            siteName={job.site_name}
            missionTitle={job.mission_title}
            lat={null}
            lng={null}
            files={files}
            onClose={() => setExpanded(false)}
          />
          {aiResult && <div className="px-4 pb-4"><AIResultPanel result={aiResult} uploadType={job.upload_type} /></div>}
          {loading && (
            <div className="px-4 pb-3 flex items-center gap-2 text-[11px] text-slate-500">
              <RotateCw size={12} className="animate-spin" /> Loading images…
            </div>
          )}
        </div>
      )}
    </div>
  );
}



// ── Main Component ─────────────────────────────────────────────────────────────
const AIUploadsAdmin: React.FC = () => {
  const [jobs, setJobs]           = useState<UploadJob[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<'all'|'pending'|'complete'|'failed'>('all');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [deleting, setDeleting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const r = await apiClient.get('/pilot/upload-jobs/admin/all');
      setJobs(r.data?.data || []);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  const deleteOne = async (jobId: string) => {
    if (!confirm('Delete this upload job and all its files? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/pilot/upload-jobs/${jobId}`);
      setJobs(j => j.filter(x => x.id !== jobId));
      setSelected(s => { const n = new Set(s); n.delete(jobId); return n; });
    } catch (e: any) { alert(e.response?.data?.message || 'Delete failed'); }
  };

  const deleteBulk = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} upload job(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiClient.delete('/pilot/upload-jobs/bulk', { data: { ids: [...selected] } });
      setJobs(j => j.filter(x => !selected.has(x.id)));
      setSelected(new Set());
    } catch (e: any) { alert(e.response?.data?.message || 'Bulk delete failed'); }
    finally { setDeleting(false); }
  };

  const toggleSelect = (id: string) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () =>
    setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(j => j.id)));

  useEffect(() => { load(); }, [load]);

  const filtered = jobs.filter(j => {
    if (filter !== 'all' && j.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        j.mission_title?.toLowerCase().includes(q) ||
        j.site_name?.toLowerCase().includes(q) ||
        j.pilot_email?.toLowerCase().includes(q) ||
        j.pilot_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total:    jobs.length,
    complete: jobs.filter(j => j.status === 'complete').length,
    pending:  jobs.filter(j => ['pending','processing'].includes(j.status)).length,
    failed:   jobs.filter(j => j.status === 'failed').length,
    withAI:   jobs.filter(j => j.ai_result).length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">AI Upload Monitor</h2>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest font-bold">All Pilot Submissions · AI Reports · Images</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:border-slate-600 transition-colors font-bold disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Jobs',  value: stats.total,    color: 'text-white' },
          { label: 'Complete',    value: stats.complete,  color: 'text-emerald-400' },
          { label: 'In Progress', value: stats.pending,   color: 'text-amber-400' },
          { label: 'Failed',      value: stats.failed,    color: 'text-red-400' },
          { label: 'AI Reports',  value: stats.withAI,    color: 'text-indigo-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search + Select-all */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Select-all checkbox */}
        <button onClick={toggleSelectAll}
          className="text-slate-500 hover:text-white transition-colors"
          title={selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}>
          {selected.size > 0 && selected.size === filtered.length
            ? <CheckSquare size={14} className="text-indigo-400" />
            : <Square size={14} />}
        </button>
        <div className="flex gap-1.5 flex-wrap">
          {(['all','pending','complete','failed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all
                ${filter===f ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
              {f}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search mission, pilot, site…"
          className="flex-1 min-w-[180px] px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40" />
      </div>

      {/* Bulk delete toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <span className="text-xs font-bold text-red-300">{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => setSelected(new Set())}
            className="text-[10px] text-slate-400 hover:text-white font-bold uppercase transition-colors">
            Cancel
          </button>
          <button onClick={deleteBulk} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-[10px] font-black uppercase rounded-lg transition-colors disabled:opacity-50">
            {deleting ? <RotateCw size={10} className="animate-spin" /> : <Trash2 size={10} />}
            Delete {selected.size} job{selected.size > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_,i) => (
            <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BrainCircuit size={32} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-bold">No upload jobs found</p>
          <p className="text-xs text-slate-600 mt-1">Pilots submit AI uploads from the AI Upload Center</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => (
            <div key={job.id} className="flex items-start gap-2">
              {/* Checkbox */}
              <button onClick={() => toggleSelect(job.id)}
                className="mt-3 shrink-0 text-slate-600 hover:text-indigo-400 transition-colors">
                {selected.has(job.id)
                  ? <CheckSquare size={14} className="text-indigo-400" />
                  : <Square size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <JobRow job={job} onDelete={deleteOne} isSelected={selected.has(job.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
    </div>
  );
};

export default AIUploadsAdmin;
