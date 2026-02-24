import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Clock, CheckCircle, AlertCircle, History, FileText, Paperclip, Save } from 'lucide-react';
import { GridAsset, GridAssetEvent } from '../../types';
import apiClient from '../../src/services/apiClient';

interface AssetDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    asset: GridAsset | null;
    onUpdate: (asset: GridAsset) => void;
}

const AssetDrawer: React.FC<AssetDrawerProps> = ({ isOpen, onClose, asset, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'files'>('details');
    const [events, setEvents] = useState<GridAssetEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    // Edit State
    const [editStatus, setEditStatus] = useState<string>('');
    const [editCount, setEditCount] = useState<number>(0);
    const [editNote, setEditNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (asset) {
            setEditStatus(asset.status);
            setEditCount(asset.completedCount || 0);
            setEditNote(''); // Reset note
            if (isOpen && activeTab === 'history') {
                fetchHistory();
            }
        }
    }, [asset, isOpen, activeTab]);

    const fetchHistory = async () => {
        if (!asset) return;
        try {
            setLoadingEvents(true);
            const response = await apiClient.get(`/assets/${asset.id}/events`);
            setEvents(response.data.data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingEvents(false);
        }
    };

    const handleSave = async () => {
        if (!asset) return;
        try {
            setIsSaving(true);
            const payload = {
                status: editStatus,
                completed_count: editCount,
                expectedVersion: asset.version,
                // meta note could be handled if backend supports it
            };

            const response = await apiClient.patch(`/assets/${asset.id}`, payload);
            const updated = response.data.data;

            // Map back to CamelCase if backend returns snake_case (Controller maps it, but let's be safe)
            // My controller returns mapped camelCase.
            onUpdate(updated);
            alert('Asset updated successfully');
        } catch (error: any) {
            console.error('Update failed:', error);
            alert(`Update failed: ${error.response?.data?.message || error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !asset) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-slate-900 z-10">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-100">{asset.assetKey}</h2>
                        <p className="text-sm text-slate-500 mt-1">{asset.assetType} • {asset.industry}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-slate-800 flex gap-6">
                    {['details', 'history', 'files'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                    ? 'border-indigo-500 text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            {/* Status Section */}
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-2">Status</label>
                                <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-indigo-500/50"
                                >
                                    <option value="not_started">Not Started</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="complete">Complete</option>
                                    <option value="blocked">Blocked</option>
                                    <option value="needs_review">Needs Review</option>
                                </select>
                            </div>

                            {/* Progress Section */}
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-2">Progress</label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-300">Completed</span>
                                            <span className="text-slate-500">Target: {asset.plannedCount}</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={editCount}
                                            onChange={(e) => setEditCount(parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                                        />
                                    </div>
                                    {asset.plannedCount && (
                                        <div className="w-12 h-12 rounded-full border-4 border-slate-700 flex items-center justify-center relative">
                                            <span className="text-[10px] font-bold text-slate-300">
                                                {Math.round((editCount / asset.plannedCount) * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Assignment */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Assigned To</label>
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-800">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                        <User className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-300">{asset.assignedToName || 'Unassigned'}</p>
                                        <p className="text-xs text-slate-500">Click to reassign (Admin only)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata Read-only */}
                            {asset.meta && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-500">Technical Details</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(asset.meta).map(([key, value]) => (
                                            <div key={key} className="p-2 bg-slate-800/30 rounded border border-slate-800">
                                                <div className="text-[10px] text-slate-500 uppercase">{key}</div>
                                                <div className="text-sm text-slate-300 truncate">{String(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            {loadingEvents ? (
                                <div className="text-center py-8 text-slate-500 text-sm">Loading history...</div>
                            ) : events.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm">No events recorded</div>
                            ) : (
                                <div className="relative border-l border-slate-800 ml-2 space-y-6 pl-6 py-2">
                                    {events.map((event) => (
                                        <div key={event.id} className="relative">
                                            <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-slate-800 border-2 border-slate-600" />
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm font-medium text-slate-300">
                                                        {event.eventType.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(event.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    by {event.userName || 'System'}
                                                </p>
                                                {event.message && (
                                                    <p className="text-sm text-slate-400 mt-1 bg-slate-800/50 p-2 rounded">
                                                        {event.message}
                                                    </p>
                                                )}
                                                {event.eventType === 'field_update' && event.beforeState && event.afterState && (
                                                    <div className="text-xs font-mono text-slate-500 mt-1">
                                                        Changed from <span className="text-slate-400">{event.beforeState.status}</span> to <span className="text-indigo-400">{event.afterState.status}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'files' && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                            <Paperclip className="w-8 h-8 mb-3 opacity-50" />
                            <p className="text-sm">No attachments found</p>
                            <button className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
                                Upload File
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 z-10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                    >
                        {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssetDrawer;
