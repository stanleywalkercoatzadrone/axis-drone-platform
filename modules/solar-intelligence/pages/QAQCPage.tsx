import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, Filter, Search, Download, Plus, X,
  Loader2, ChevronDown, ChevronUp, MapPin, User, FileText, Trash2
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';
type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface QAIssue {
  id: string;
  title: string;
  description?: string;
  issue_type?: string;
  severity: Severity;
  status: IssueStatus;
  lat?: number;
  lng?: number;
  assignee_name?: string;
  assignee_email?: string;
  resolution_notes?: string;
  created_at: string;
  survey_id?: string;
}

interface Survey {
  id: string;
  survey_date: string;
}

interface NewIssueForm {
  title: string;
  issue_type: string;
  severity: Severity;
  description: string;
  lat: string;
  lng: string;
  assignee_name: string;
  assignee_email: string;
}

interface Props { siteId: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<Severity, { color: string; bg: string; border: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  },
};

const STATUS_CONFIG: Record<IssueStatus, { color: string; bg: string }> = {
  open:        { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  in_progress: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  resolved:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  closed:      { color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const ISSUE_TYPES = [
  'misalignment', 'missing_module', 'spacing', 'pile_tolerance',
  'erosion', 'drainage', 'damage', 'incomplete', 'other',
];

const BLANK_FORM: NewIssueForm = {
  title: '', issue_type: 'misalignment', severity: 'medium',
  description: '', lat: '', lng: '', assignee_name: '', assignee_email: '',
};



// ─── SeverityBadge ────────────────────────────────────────────────────────────

const SevBadge: React.FC<{ sev: Severity }> = ({ sev }) => {
  const c = SEV_CONFIG[sev] ?? SEV_CONFIG.low;
  return (
    <span style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
      className="text-xs font-bold px-2 py-0.5 rounded capitalize">{sev}</span>
  );
};

const StatusBadge: React.FC<{ status: IssueStatus }> = ({ status }) => {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.closed;
  return (
    <span style={{ color: c.color, background: c.bg }}
      className="text-xs font-semibold px-2 py-0.5 rounded capitalize">{status.replace('_', ' ')}</span>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const QAQCPage: React.FC<Props> = ({ siteId }) => {
  const [issues, setIssues]               = useState<QAIssue[]>([]);
  const [surveys, setSurveys]             = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [loading, setLoading]             = useState(true);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState<NewIssueForm>(BLANK_FORM);
  const [submitting, setSubmitting]       = useState(false);
  const [formError, setFormError]         = useState<string | null>(null);

  // Filters
  const [sevFilter, setSevFilter]         = useState<string>('all');
  const [statusFilter, setStatusFilter]   = useState<string>('all');
  const [typeFilter, setTypeFilter]       = useState<string>('all');
  const [search, setSearch]               = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [issuesRes, surveysRes] = await Promise.allSettled([
        apiClient.get(`/api/solar-farm/sites/${siteId}/issues`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/surveys`),
      ]);
      if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value.data ?? []);
      else setIssues([]);
      if (surveysRes.status === 'fulfilled') {
        const s: Survey[] = surveysRes.value.data ?? [];
        setSurveys(s);
        if (s.length > 0 && !selectedSurveyId) setSelectedSurveyId(s[0].id);
      }
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    try {
      setSubmitting(true);
      setFormError(null);
      const endpoint = selectedSurveyId
        ? `/api/solar-farm/surveys/${selectedSurveyId}/issues`
        : `/api/solar-farm/sites/${siteId}/issues`;
      await apiClient.post(endpoint, {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      });
      setShowModal(false);
      setForm(BLANK_FORM);
      await fetchData();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: IssueStatus) => {
    try {
      await apiClient.patch(`/api/solar-farm/issues/${issueId}`, { status: newStatus });
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: newStatus } : i));
    } catch {}
  };

  const handleDelete = async (issueId: string) => {
    if (!window.confirm('Delete this issue?')) return;
    try {
      await apiClient.delete(`/api/solar-farm/issues/${issueId}`);
      setIssues(prev => prev.filter(i => i.id !== issueId));
    } catch {}
  };

  const handleExport = async () => {
    try {
      const res = await apiClient.get(`/api/solar-farm/sites/${siteId}/export/csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `qaqc-issues-${siteId}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  // Filtered
  const filtered = issues.filter(i => {
    if (sevFilter !== 'all' && i.severity !== sevFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (typeFilter !== 'all' && i.issue_type !== typeFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high:     issues.filter(i => i.severity === 'high').length,
    medium:   issues.filter(i => i.severity === 'medium').length,
    low:      issues.filter(i => i.severity === 'low').length,
  };

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
    border: '1px solid rgba(51,65,85,0.7)',
    backdropFilter: 'blur(12px)',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle size={22} className="text-amber-400" /> QA/QC Issues
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">{issues.length} total issues</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={handleExport}
            style={{ border: '1px solid rgba(51,65,85,0.8)' }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 text-sm hover:text-white hover:border-slate-500 transition-all">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/20">
            <Plus size={14} /> Add Issue
          </button>
        </div>
      </div>

      {/* Survey selector */}
      {surveys.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-slate-500 text-xs">Survey:</span>
          <select
            value={selectedSurveyId}
            onChange={e => setSelectedSurveyId(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">All Surveys</option>
            {surveys.map(s => (
              <option key={s.id} value={s.id}>{new Date(s.survey_date).toLocaleDateString()}</option>
            ))}
          </select>
        </div>
      )}

      {/* Severity count summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map(s => {
          const c = SEV_CONFIG[s];
          return (
            <div key={s} onClick={() => setSevFilter(sevFilter === s ? 'all' : s)}
              style={{ background: c.bg, border: `1px solid ${sevFilter === s ? c.color : c.border}`, cursor: 'pointer' }}
              className="rounded-xl p-3 text-center transition-all hover:border-opacity-100">
              <div className="text-2xl font-bold" style={{ color: c.color }}>{counts[s]}</div>
              <div className="text-xs mt-0.5 capitalize" style={{ color: c.color }}>{s}</div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={cardStyle} className="rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
        <Filter size={14} className="text-slate-500" />
        {/* Severity chips */}
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              style={sevFilter === s ? { background: '#3b82f6', color: 'white' } : {}}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${sevFilter === s ? '' : 'text-slate-400 border border-slate-700 hover:border-slate-500'}`}>
              {s === 'all' ? 'All Severity' : s}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-700" />
        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={statusFilter === s ? { background: '#3b82f6', color: 'white' } : {}}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${statusFilter === s ? '' : 'text-slate-400 border border-slate-700 hover:border-slate-500'}`}>
              {s === 'all' ? 'All Status' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-xs focus:outline-none focus:border-blue-500">
            <option value="all">All Types</option>
            {ISSUE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500 w-40" />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="text-blue-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
          <p className="text-white font-semibold">No issues found</p>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div style={cardStyle} className="rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.7)', background: 'rgba(15,23,42,0.5)' }}>
                {['#', 'Severity', 'Type', 'Title', 'Assignee', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue, idx) => (
                <React.Fragment key={issue.id}>
                  <tr
                    style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                  >
                    <td className="px-4 py-3 text-slate-500 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3"><SevBadge sev={issue.severity} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs capitalize">{issue.issue_type?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        {issue.title}
                        {expandedId === issue.id ? <ChevronUp size={12} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={12} className="text-slate-500 flex-shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{issue.assignee_name ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{issue.created_at && new Date(issue.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <select
                          value={issue.status}
                          onChange={e => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                        <button onClick={() => handleDelete(issue.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === issue.id && (
                    <tr style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div className="sm:col-span-2">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1"><FileText size={11} /> Description</p>
                            <p className="text-slate-200">{issue.description ?? 'No description provided.'}</p>
                            {issue.resolution_notes && (
                              <div className="mt-3">
                                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Resolution Notes</p>
                                <p className="text-slate-200">{issue.resolution_notes}</p>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            {(issue.lat || issue.lng) && (
                              <div className="flex items-center gap-2 text-xs">
                                <MapPin size={12} className="text-blue-400" />
                                <span className="text-slate-300">{issue.lat?.toFixed(6)}, {issue.lng?.toFixed(6)}</span>
                              </div>
                            )}
                            {issue.assignee_name && (
                              <div className="flex items-center gap-2 text-xs">
                                <User size={12} className="text-purple-400" />
                                <span className="text-slate-300">{issue.assignee_name}</span>
                                {issue.assignee_email && <span className="text-slate-500">({issue.assignee_email})</span>}
                              </div>
                            )}
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

      {/* Floating Add button */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          boxShadow: '0 0 20px rgba(59,130,246,0.5)',
          position: 'fixed', bottom: 32, right: 32,
        }}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform z-30"
      >
        <Plus size={24} />
      </button>

      {/* ── Add Issue Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)',
            border: '1px solid rgba(51,65,85,0.9)', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          }} className="rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <h3 className="text-white font-bold flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /> Add QA/QC Issue</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{formError}</div>
              )}
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Title <span className="text-red-400">*</span></label>
                <input required type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Brief description of the issue" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Issue Type</label>
                  <select value={form.issue_type} onChange={e => setForm(f => ({ ...f, issue_type: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Severity</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Detailed description…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Latitude</label>
                  <input type="number" step="0.000001" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="32.1234" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Longitude</label>
                  <input type="number" step="0.000001" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="-110.5678" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Assignee Name</label>
                  <input type="text" value={form.assignee_name} onChange={e => setForm(f => ({ ...f, assignee_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Assignee Email</label>
                  <input type="email" value={form.assignee_email} onChange={e => setForm(f => ({ ...f, assignee_email: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="email@example.com" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all">Cancel</button>
                <button type="submit" disabled={submitting}
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Create Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QAQCPage;
