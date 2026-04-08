import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Check, Clock, AlertTriangle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface Assignment {
    id: string;
    work_date: string | null;
    task_description: string | null;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    sectors: string | null;
    pilot_name?: string;
    pilot_email?: string;
    personnel_id: string;
    completed: boolean;
    completed_at: string | null;
    file_name?: string | null;
    notes?: string | null;
}

interface Personnel {
    id: string;
    fullName: string;
    role: string;
    email?: string;
}

interface Props {
    missionId: string;
    personnel: Personnel[];
    isAdmin: boolean;
    /** Restrict to a single work date when called from the Daily Logs calendar */
    filterDate?: string;
}

const PRIORITY_STYLE: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-300',
    high:   'bg-orange-100 text-orange-800 border-orange-300',
    normal: 'bg-blue-100 text-blue-800 border-blue-300',
    low:    'bg-slate-100 text-slate-600 border-slate-200',
};

const fmt = (d: string | null) => {
    if (!d) return '—';
    const [y, m, day] = d.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const AssignmentsTab: React.FC<Props> = ({ missionId, personnel, isAdmin, filterDate }) => {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        personnelId: '',
        workDate: filterDate || new Date().toISOString().split('T')[0],
        taskDescription: '',
        priority: 'normal' as Assignment['priority'],
        sectors: '',
    });

    const load = async () => {
        try {
            setLoading(true);
            const endpoint = isAdmin
                ? `/deployments/${missionId}/assignments`
                : `/pilot/secure/missions/${missionId}/assignments`;
            const res = await apiClient.get(endpoint);
            let data: Assignment[] = res.data.data || [];
            if (filterDate) {
                data = data.filter(a => (a.work_date || '').split('T')[0] === filterDate);
            }
            setAssignments(data);
        } catch (e: any) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [missionId, filterDate]);

    const handleCreate = async () => {
        if (!form.personnelId || !form.taskDescription) return;
        setSaving(true);
        try {
            await apiClient.post(`/deployments/${missionId}/assignments`, {
                personnelId: form.personnelId,
                workDate: form.workDate || null,
                taskDescription: form.taskDescription,
                priority: form.priority,
                sectors: form.sectors || null,
                assignmentType: 'task',
            });
            setForm(f => ({ ...f, personnelId: '', taskDescription: '', sectors: '' }));
            setShowForm(false);
            await load();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Failed to create assignment');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Remove this assignment?')) return;
        try {
            await apiClient.delete(`/deployments/${missionId}/assignments/${id}`);
            setAssignments(prev => prev.filter(a => a.id !== id));
        } catch (e: any) {
            alert('Failed to delete');
        }
    };

    const handleToggleComplete = async (a: Assignment) => {
        try {
            const endpoint = isAdmin
                ? `/deployments/${missionId}/assignments/${a.id}`
                : `/pilot/secure/missions/${missionId}/assignments/${a.id}`;
            await apiClient.patch(endpoint, { completed: !a.completed });
            setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, completed: !x.completed } : x));
        } catch (e: any) {
            alert('Failed to update');
        }
    };

    // Group by date for display
    const grouped = assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
        const key = (a.work_date || '').split('T')[0] || 'Unscheduled';
        (acc[key] ||= []).push(a);
        return acc;
    }, {});

    const sortedDates = Object.keys(grouped).sort();

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-bold text-white">
                        {filterDate ? `Assignments — ${fmt(filterDate)}` : 'Daily Assignments'}
                    </h4>
                    {assignments.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
                            {assignments.filter(a => !a.completed).length} open
                        </span>
                    )}
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowForm(f => !f)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Task
                    </button>
                )}
            </div>

            {/* Create form (admin only) */}
            {isAdmin && showForm && (
                <div className="bg-slate-800 border border-white/10 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pilot / Technician *</label>
                            <select
                                className="w-full px-2 py-1.5 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-sky-500/30 outline-none"
                                value={form.personnelId}
                                onChange={e => setForm(f => ({ ...f, personnelId: e.target.value }))}
                            >
                                <option value="">Select pilot...</option>
                                {personnel.map(p => (
                                    <option key={p.id} value={p.id}>{p.fullName} ({p.role})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Date</label>
                            <input
                                type="date"
                                className="w-full px-2 py-1.5 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-sky-500/30 outline-none"
                                value={form.workDate}
                                onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Task Description *</label>
                        <textarea
                            rows={2}
                            className="w-full px-2 py-1.5 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-sky-500/30 outline-none resize-none"
                            placeholder="e.g. Fly sectors A1–A3, complete thermal scan..."
                            value={form.taskDescription}
                            onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                            <select
                                className="w-full px-2 py-1.5 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-sky-500/30 outline-none"
                                value={form.priority}
                                onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}
                            >
                                <option value="low">Low</option>
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sectors (optional)</label>
                            <input
                                type="text"
                                className="w-full px-2 py-1.5 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-sky-500/30 outline-none"
                                placeholder="A1, A2, B3..."
                                value={form.sectors}
                                onChange={e => setForm(f => ({ ...f, sectors: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={handleCreate}
                            disabled={saving || !form.personnelId || !form.taskDescription}
                            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Saving...' : 'Create Assignment'}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Loading / error */}
            {loading && <p className="text-sm text-slate-400 text-center py-6">Loading assignments...</p>}
            {error && <p className="text-sm text-red-400 text-center py-4">Error: {error}</p>}

            {/* Empty state */}
            {!loading && !error && assignments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                    <ClipboardList className="w-8 h-8 opacity-30" />
                    <p className="text-sm font-medium">No assignments yet</p>
                    {isAdmin && <p className="text-xs opacity-60">Use "Add Task" to assign daily work to pilots.</p>}
                </div>
            )}

            {/* Grouped by date */}
            {!loading && sortedDates.map(date => (
                <div key={date} className="space-y-2">
                    {/* Date header — only show if not filtering by a single date */}
                    {!filterDate && (
                        <div className="flex items-center gap-2 pb-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {date === 'Unscheduled' ? 'Unscheduled' : fmt(date)}
                            </span>
                            <div className="flex-1 border-t border-white/5" />
                        </div>
                    )}

                    {grouped[date].map(a => (
                        <div
                            key={a.id}
                            className={`border rounded-xl px-4 py-3 flex items-start gap-3 transition-all ${
                                a.completed
                                    ? 'border-white/5 bg-slate-800/30 opacity-60'
                                    : 'border-white/10 bg-slate-800'
                            }`}
                        >
                            {/* Complete toggle */}
                            <button
                                onClick={() => handleToggleComplete(a)}
                                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                    a.completed
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-slate-500 hover:border-sky-400'
                                }`}
                            >
                                {a.completed && <Check className="w-3 h-3" />}
                            </button>

                            <div className="flex-1 min-w-0">
                                {/* Pilot name (admin view) */}
                                {isAdmin && a.pilot_name && (
                                    <p className="text-xs font-bold text-sky-400 mb-0.5">{a.pilot_name}</p>
                                )}
                                {/* Task */}
                                <p className={`text-sm font-medium ${a.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                                    {a.task_description || a.notes || 'No description'}
                                </p>
                                {/* Priority + sectors chips */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${PRIORITY_STYLE[a.priority] || PRIORITY_STYLE.normal}`}>
                                        {a.priority}
                                    </span>
                                    {a.sectors && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-violet-500/15 text-violet-400 rounded border border-violet-500/20">
                                            Sectors: {a.sectors}
                                        </span>
                                    )}
                                    {a.file_name && (
                                        <span className="text-[10px] text-slate-400">📎 {a.file_name}</span>
                                    )}
                                    {a.completed && a.completed_at && (
                                        <span className="text-[10px] text-emerald-500">✓ Done {new Date(a.completed_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>

                            {/* Delete (admin only) */}
                            {isAdmin && (
                                <button
                                    onClick={() => handleDelete(a.id)}
                                    className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default AssignmentsTab;
