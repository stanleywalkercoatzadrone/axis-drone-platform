import React, { useState, useEffect } from 'react';
import {
    CheckSquare, Clock, AlertCircle, CheckCircle2,
    MessageSquare, Paperclip, Upload, X, Search, Filter
} from 'lucide-react';
import apiClient from '../src/services/apiClient';
import { WorkItem } from '../types';

const MyWorkItems: React.FC = () => {
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'done'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
    const [noteText, setNoteText] = useState('');
    const [assetFile, setAssetFile] = useState<File | null>(null);

    useEffect(() => {
        fetchMyWorkItems();
    }, []);

    const fetchMyWorkItems = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/work-items?assignedTo=me');
            if (response.data.success) {
                setWorkItems(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch work items:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (itemId: string, newStatus: 'open' | 'in_progress' | 'done') => {
        try {
            const response = await apiClient.patch(`/work-items/${itemId}/status`, {
                status: newStatus
            });
            if (response.data.success) {
                // Update local state
                setWorkItems(prev => prev.map(item =>
                    item.id === itemId ? { ...item, status: newStatus } : item
                ));
            }
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to update status');
        }
    };

    const addNote = async (itemId: string) => {
        if (!noteText.trim()) return;

        try {
            const response = await apiClient.post(`/work-items/${itemId}/notes`, {
                note: noteText
            });
            if (response.data.success) {
                setNoteText('');
                alert('Note added successfully');
            }
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to add note');
        }
    };

    const attachAsset = async (itemId: string) => {
        if (!assetFile) return;

        try {
            const formData = new FormData();
            formData.append('file', assetFile);

            // Our backend addWorkItemAsset now accepts multipart/form-data
            const response = await apiClient.post(`/work-items/${itemId}/assets`, formData);

            if (response.data.success) {
                setAssetFile(null);
                alert('Asset attached successfully');
                // Could refresh work items here or update local state to show the new attachment
            }
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to attach asset');
        }
    };

    const filteredItems = workItems.filter(item => {
        const matchesFilter = filter === 'all' || item.status === filter;
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'done': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'in_progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'blocked': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done': return <CheckCircle2 size={16} />;
            case 'in_progress': return <Clock size={16} />;
            case 'blocked': return <AlertCircle size={16} />;
            default: return <CheckSquare size={16} />;
        }
    };

    return (
        <div className="bg-slate-900 min-h-screen text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
                        <CheckSquare className="text-blue-400" size={32} />
                        My Tasks
                    </h1>
                    <p className="text-slate-400">Manage your assigned work items and track progress</p>
                </div>

                {/* Filters and Search */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex gap-2">
                            {(['all', 'open', 'in_progress', 'done'] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === status
                                        ? 'bg-blue-600 shadow-lg'
                                        : 'bg-slate-700 hover:bg-slate-600'
                                        }`}
                                >
                                    {status === 'all' ? 'All' : status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Work Items Grid */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-slate-400 mt-4">Loading tasks...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                        <CheckSquare size={48} className="text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No tasks found</h3>
                        <p className="text-slate-400">
                            {filter === 'all' ? 'You have no assigned tasks yet.' : `No ${filter.replace('_', ' ')} tasks.`}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredItems.map((item) => (
                            <div
                                key={item.id}
                                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-all cursor-pointer"
                                onClick={() => setSelectedItem(item)}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                                        {item.description && (
                                            <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                                        )}
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(item.status)}`}>
                                        {getStatusIcon(item.status)}
                                        {item.status.replace('_', ' ')}
                                    </span>
                                </div>

                                {/* Metadata */}
                                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                                    {item.dueDate && (
                                        <div className="flex items-center gap-1">
                                            <Clock size={14} />
                                            Due: {new Date(item.dueDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        Priority: <span className="capitalize">{item.priority}</span>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex gap-2">
                                    {item.status !== 'in_progress' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateStatus(item.id, 'in_progress');
                                            }}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Start
                                        </button>
                                    )}
                                    {item.status === 'in_progress' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateStatus(item.id, 'done');
                                            }}
                                            className="flex-1 bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Complete
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedItem(item);
                                        }}
                                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Details
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Detail Modal */}
                {selectedItem && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-start justify-between">
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold mb-2">{selectedItem.title}</h2>
                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedItem.status)}`}>
                                        {getStatusIcon(selectedItem.status)}
                                        {selectedItem.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6">
                                {/* Description */}
                                {selectedItem.description && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Description</h3>
                                        <p className="text-slate-300">{selectedItem.description}</p>
                                    </div>
                                )}

                                {/* Status Actions */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Update Status</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateStatus(selectedItem.id, 'open')}
                                            disabled={selectedItem.status === 'open'}
                                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Open
                                        </button>
                                        <button
                                            onClick={() => updateStatus(selectedItem.id, 'in_progress')}
                                            disabled={selectedItem.status === 'in_progress'}
                                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                                        >
                                            In Progress
                                        </button>
                                        <button
                                            onClick={() => updateStatus(selectedItem.id, 'done')}
                                            disabled={selectedItem.status === 'done'}
                                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>

                                {/* Add Note */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                        <MessageSquare size={16} />
                                        Add Note
                                    </h3>
                                    <textarea
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Add a note or comment..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 transition-colors resize-none"
                                        rows={3}
                                    />
                                    <button
                                        onClick={() => addNote(selectedItem.id)}
                                        disabled={!noteText.trim()}
                                        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Add Note
                                    </button>
                                </div>

                                {/* Attach Evidence */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                        <Paperclip size={16} />
                                        Attach Evidence
                                    </h3>
                                    <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center">
                                        <input
                                            type="file"
                                            id="asset-upload"
                                            className="hidden"
                                            accept="image/*,.pdf,.doc,.docx"
                                            onChange={(e) => setAssetFile(e.target.files?.[0] || null)}
                                        />
                                        <label htmlFor="asset-upload" className="cursor-pointer">
                                            <Upload className="mx-auto mb-2 text-slate-400" size={24} />
                                            <p className="text-sm text-slate-400">
                                                {assetFile ? assetFile.name : 'Click to upload photo or document'}
                                            </p>
                                        </label>
                                    </div>
                                    {assetFile && (
                                        <button
                                            onClick={() => attachAsset(selectedItem.id)}
                                            className="mt-2 w-full px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Upload Asset
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyWorkItems;
