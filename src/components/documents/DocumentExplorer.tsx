import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import { Search, Filter, FileText, Download, ExternalLink, RefreshCw, Folder } from 'lucide-react';

interface Document {
    id: string;
    filename: string;
    relative_path: string;
    file_size: number;
    mime_type: string;
    status: string;
    storage_path: string;
    uploaded_at: string;
    client_name?: string;
    site_name?: string;
    url?: string;
}

export const DocumentExplorer: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 20;

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/documents', {
                params: {
                    start: page * limit,
                    limit,
                    search: searchTerm
                }
            });
            if (res.data.success) {
                setDocuments(res.data.data);
                setTotal(res.data.pagination.total);
            }
        } catch (err) {
            console.error('Failed to fetch documents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [page, searchTerm]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Document Explorer</h1>
                    <p className="text-slate-400">View and manage all uploaded files across the platform.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchDocuments}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {/* Placeholder for future Export/Action buttons */}
                </div>
            </header>

            {/* Filters */}
            <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by filename or path..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(0); // Reset to first page on search
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                </div>
                {/* 
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
                    <Filter className="w-4 h-4" />
                    <span>Filter</span>
                </button>
                 */}
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Context</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Size</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-transparent">
                            {loading && documents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading documents...</td>
                                </tr>
                            ) : documents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No documents found matching your criteria.</td>
                                </tr>
                            ) : (
                                documents.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-200 truncate max-w-xs" title={doc.filename}>{doc.filename}</p>
                                                    <p className="text-xs text-slate-500 truncate max-w-xs" title={doc.relative_path}>{doc.relative_path || '/'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-300">{doc.client_name || 'Unknown Client'}</span>
                                                <span className="text-xs text-slate-500">{doc.site_name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{doc.mime_type || 'Unknown'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400 font-mono">{formatSize(doc.file_size)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{formatDate(doc.uploaded_at)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {doc.url ? (
                                                    <a
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                                                        title="Open in new tab"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-slate-600 px-2">No URL</span>
                                                )}
                                                {/* Download feature could be added here if needed */}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-white/5">
                    <span className="text-sm text-slate-400">
                        Showing {documents.length > 0 ? page * limit + 1 : 0} to {Math.min((page + 1) * limit, total)} of {total} results
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 text-sm rounded-md bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            disabled={(page + 1) * limit >= total}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 text-sm rounded-md bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
