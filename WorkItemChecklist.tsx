import React, { useState, useEffect } from 'react';
import {
    CheckCircle, Circle, Clock, AlertCircle,
    MessageSquare, ChevronDown, ChevronUp, MapPin,
    Calendar, Tag, MoreHorizontal, User, Save
} from 'lucide-react';
import apiClient from '../src/services/apiClient';
import { WorkItem } from '../types';

interface WorkItemChecklistProps {
    scopeType: string;
    scopeId: string;
}

const WorkItemChecklist: React.FC<WorkItemChecklistProps> = ({ scopeType, scopeId }) => {
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [updateNotes, setUpdateNotes] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchWorkItems();
    }, [scopeId]);

    const fetchWorkItems = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/work-items?scopeType=${scopeType}&scopeId=${scopeId}`);
            if (response.data.success) {
                setWorkItems(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch work items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            const response = await apiClient.patch(`/work-items/${id}/status`, { status: newStatus });
            if (response.data.success) {
                setWorkItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus as any } : item));
            }
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleAddNote = async (id: string) => {
        const note = updateNotes[id];
        if (!note) return;

        try {
            const response = await apiClient.post(`/work-items/${id}/notes`, { note });
            if (response.data.success) {
                setUpdateNotes(prev => ({ ...prev, [id]: '' }));
                alert('Note added');
                // Could refresh history here if we had a history view per item
            }
        } catch (error) {
            alert('Failed to add note');
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Loading checklist...</div>;
    }

    if (workItems.length === 0) {
        return (
            <div className="p-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle className="mx-auto mb-4 text-slate-300" size={48} />
                <h3 className="text-lg font-semibold text-slate-900">No work items assigned</h3>
                <p className="text-sm text-slate-500 mt-1">There are no specific checklist items for this mission scope.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2 px-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Mission Checklist</span>
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {workItems.filter(i => i.status === 'done').length}/{workItems.length} COMPLETED
                    </span>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                    {workItems.map((item) => (
                        <div key={item.id} className={`transition-all ${expandedItem === item.id ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}>
                            <div className="p-4 flex items-start gap-4">
                                <button
                                    onClick={() => handleStatusUpdate(item.id, item.status === 'done' ? 'open' : 'done')}
                                    className={`mt-0.5 shrink-0 transition-all ${item.status === 'done' ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'}`}
                                >
                                    {item.status === 'done' ? <CheckCircle size={22} fill="currentColor" className="text-white" /> : <Circle size={22} />}
                                    {item.status === 'done' && <CheckCircle size={22} className="absolute inset-0 text-green-500" />}
                                </button>

                                <div className="flex-1 min-w-0 pointer-cursor" onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
                                    <h4 className={`text-sm font-semibold transition-all ${item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.title}</h4>
                                    <div className="flex items-center gap-4 mt-1">
                                        {item.priority && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${item.priority.toLowerCase() === 'high' ? 'bg-red-50 text-red-600' :
                                                    item.priority.toLowerCase() === 'medium' ? 'bg-amber-50 text-amber-600' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {item.priority}
                                            </span>
                                        )}
                                        {item.dueDate && (
                                            <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                                <Calendar size={12} />
                                                {new Date(item.dueDate).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                >
                                    {expandedItem === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                            </div>

                            {expandedItem === item.id && (
                                <div className="px-12 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <p className="text-sm text-slate-600 mb-4">{item.description || 'No additional details provided.'}</p>

                                    <div className="space-y-3 pt-3 border-t border-slate-100">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flight Evidence / Notes</label>
                                            <textarea
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[80px]"
                                                placeholder="Add field observations or evidence links..."
                                                value={updateNotes[item.id] || ''}
                                                onChange={(e) => setUpdateNotes({ ...updateNotes, [item.id]: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleAddNote(item.id)}
                                                disabled={!updateNotes[item.id]}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all"
                                            >
                                                <Save size={14} />
                                                Update Item
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorkItemChecklist;
