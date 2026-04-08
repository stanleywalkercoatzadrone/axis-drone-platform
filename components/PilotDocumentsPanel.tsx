/**
 * PilotDocumentsPanel.tsx
 * Admin panel to view, add (URL-based), and delete pilot compliance documents.
 * Uses existing routes: GET/POST/DELETE /api/personnel/:id/documents
 */
import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../src/services/apiClient';
import {
    FileText, Plus, Trash2, Clock, CheckCircle2, AlertCircle,
    Link, Calendar, Tag, Loader2, RefreshCw, X, Upload
} from 'lucide-react';

interface PilotDoc {
    id: string;
    name?: string;
    category?: string;
    document_type?: string;
    url?: string;
    file_url?: string;
    expiration_date?: string;
    validation_status?: string;
    created_at?: string;
    uploaded_at?: string;
}

const DOC_CATEGORIES = [
    'Certification', 'License', 'Insurance', 'Flight Logs',
    'W9', 'Photo ID', 'Background Check', 'Medical', 'Other'
];

interface Props {
    personnelId: string;
    personnelName?: string;
}

export const PilotDocumentsPanel: React.FC<Props> = ({ personnelId, personnelName }) => {
    const [docs, setDocs] = useState<PilotDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Add form state
    const [form, setForm] = useState({
        name: '',
        category: 'Other',
        url: '',
        expiration_date: '',
    });
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    const fetchDocs = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get(`/personnel/${personnelId}/documents`);
            setDocs(res.data.data || []);
        } catch (e: any) {
            setError('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDocs(); }, [personnelId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setUploadFile(f);
            if (!form.name) setForm(prev => ({ ...prev, name: f.name }));
        }
    };

    const handleAdd = async () => {
        if (!form.name || (!form.url && !uploadFile)) {
            setError('Name and either a URL or file are required.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            if (uploadFile) {
                const fd = new FormData();
                fd.append('file', uploadFile);
                fd.append('documentType', form.category);
                if (form.expiration_date) fd.append('expirationDate', form.expiration_date);
                await apiClient.post(`/personnel/${personnelId}/documents`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await apiClient.post(`/personnel/${personnelId}/documents`, {
                    name: form.name,
                    category: form.category,
                    url: form.url,
                    expirationDate: form.expiration_date || undefined,
                });
            }
            setSuccess('Document added.');
            setShowAddForm(false);
            setForm({ name: '', category: 'Other', url: '', expiration_date: '' });
            setUploadFile(null);
            await fetchDocs();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to add document');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (docId: string) => {
        if (!window.confirm('Remove this document?')) return;
        setDeleting(docId);
        try {
            await apiClient.delete(`/personnel/${personnelId}/documents/${docId}`);
            setDocs(prev => prev.filter(d => d.id !== docId));
            setSuccess('Document removed.');
        } catch (e: any) {
            setError('Failed to delete document');
        } finally {
            setDeleting(null);
        }
    };

    const statusBadge = (doc: PilotDoc) => {
        const status = doc.validation_status || 'PENDING';
        const expired = doc.expiration_date && new Date(doc.expiration_date) < new Date();
        if (expired) return (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold">
                <AlertCircle className="w-3 h-3" /> Expired
            </span>
        );
        if (status === 'VALID') return (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Valid
            </span>
        );
        return (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full text-xs font-semibold">
                <Clock className="w-3 h-3" /> Pending
            </span>
        );
    };

    const pendingCount = docs.filter(d => {
        const expired = d.expiration_date && new Date(d.expiration_date) < new Date();
        return d.validation_status !== 'VALID' || expired;
    }).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-slate-800">Compliance Documents</h3>
                    {personnelName && (
                        <p className="text-xs text-slate-500 mt-0.5">{personnelName}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">
                            <Clock className="w-3 h-3" /> {pendingCount} Pending
                        </span>
                    )}
                    <button
                        onClick={fetchDocs}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => { setShowAddForm(v => !v); setError(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                        {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        {showAddForm ? 'Cancel' : 'Add Document'}
                    </button>
                </div>
            </div>

            {/* Feedback */}
            {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
                    <button onClick={() => setSuccess(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">New Document</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-500 font-medium mb-1">Document Name *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Part 107 Certificate"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1">
                                <Tag className="w-3 h-3 inline mr-1" />Category
                            </label>
                            <select
                                value={form.category}
                                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            >
                                {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1">
                                <Calendar className="w-3 h-3 inline mr-1" />Expiration Date
                            </label>
                            <input
                                type="date"
                                value={form.expiration_date}
                                onChange={e => setForm(p => ({ ...p, expiration_date: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                        </div>
                    </div>

                    {/* Upload OR URL */}
                    <div className="space-y-2">
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1">
                                <Upload className="w-3 h-3 inline mr-1" />Upload File
                            </label>
                            <div
                                className="flex items-center gap-3 px-3 py-2 bg-white border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 cursor-pointer transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-500">
                                    {uploadFile ? uploadFile.name : 'Click to choose file'}
                                </span>
                                {uploadFile && (
                                    <button
                                        onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                                        className="ml-auto text-slate-400 hover:text-red-500"
                                    ><X className="w-3.5 h-3.5" /></button>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                        </div>

                        {!uploadFile && (
                            <div>
                                <label className="block text-xs text-slate-500 font-medium mb-1">
                                    <Link className="w-3 h-3 inline mr-1" />Or paste URL
                                </label>
                                <input
                                    type="url"
                                    value={form.url}
                                    onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                                    placeholder="https://drive.google.com/..."
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleAdd}
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {submitting ? 'Adding...' : 'Add Document'}
                    </button>
                </div>
            )}

            {/* Document List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                    </div>
                ) : docs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <FileText className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-600">No documents on file</p>
                        <p className="text-xs text-slate-400 mt-1">Add certifications, licenses, and compliance docs above.</p>
                    </div>
                ) : docs.map(doc => {
                    const name = doc.name || doc.category || doc.document_type || 'Document';
                    const url = doc.url || doc.file_url;
                    const date = doc.created_at || doc.uploaded_at;
                    return (
                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 transition-colors group">
                            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-slate-800 truncate">{name}</span>
                                    {statusBadge(doc)}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                                    <span className="font-medium text-slate-500">{doc.category || doc.document_type || '—'}</span>
                                    {date && <span>Added {new Date(date).toLocaleDateString()}</span>}
                                    {doc.expiration_date && (
                                        <span className={new Date(doc.expiration_date) < new Date() ? 'text-red-500 font-semibold' : ''}>
                                            Expires {new Date(doc.expiration_date).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {url && (
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Open document"
                                    >
                                        <Link className="w-4 h-4" />
                                    </a>
                                )}
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    disabled={deleting === doc.id}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Remove document"
                                >
                                    {deleting === doc.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Trash2 className="w-4 h-4" />
                                    }
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {docs.length > 0 && (
                <p className="text-xs text-slate-400 text-center">{docs.length} document{docs.length !== 1 ? 's' : ''} on file · {pendingCount} pending/expired</p>
            )}
        </div>
    );
};

export default PilotDocumentsPanel;
