import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../src/services/apiClient';
import {
    Upload, FileText, Download, CheckCircle2,
    AlertCircle, Clock, Search, FolderOpen, Loader2
} from 'lucide-react';

interface PilotDocument {
    id: string;
    pilot_id: string;
    document_type: string;
    file_url: string;
    validation_status: string;
    uploaded_at: string;
    expiration_date?: string;
}

export const PilotFiles: React.FC = () => {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<PilotDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [filter, setFilter] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/personnel/me/documents`);
            if (response.data.success) {
                setDocuments(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch pilot files:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            // Auto-detect type or default to 'Other'
            const ext = file.name.split('.').pop()?.toLowerCase();
            let type = 'Other';
            if (['pdf', 'doc', 'docx'].includes(ext || '')) type = 'Document';
            if (['jpg', 'jpeg', 'png'].includes(ext || '')) type = 'Image';

            formData.append('documentType', type);

            const response = await apiClient.post(`/personnel/me/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                // Refresh list
                await fetchDocuments();
            }
        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Upload failed: ${error.response?.data?.message || error.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'VALID':
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Validated</span>;
            case 'REJECTED':
            case 'INVALID':
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-medium"><AlertCircle className="w-3.5 h-3.5" /> Invalid</span>;
            default:
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-medium"><Clock className="w-3.5 h-3.5" /> Pending</span>;
        }
    };

    const filteredDocs = documents.filter(d =>
        d.document_type.toLowerCase().includes(filter.toLowerCase()) ||
        d.file_url.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">My Files</h2>
                    <p className="text-sm text-slate-400 mt-1">Manage your global documents, logs, and uploads. Files cannot be deleted once uploaded.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Uploading...' : 'Upload File'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search your files..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-600"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="divide-y divide-slate-800/50">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                            <Loader2 className="w-6 h-6 animate-spin mb-3 text-slate-400" />
                            Loading files...
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                                <FolderOpen className="w-8 h-8 text-slate-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-200 mb-1">No files found</h3>
                            <p className="text-slate-500 text-sm max-w-sm mb-6">
                                Upload certificates, flight logs, compliance documents, or general files here.
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700 hover:border-slate-600"
                            >
                                Upload First File
                            </button>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            No files match your search.
                        </div>
                    ) : (
                        filteredDocs.map((doc) => (
                            <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-slate-200 capitalize">
                                                {doc.document_type.replace('_', ' ')}
                                            </h4>
                                            {getStatusBadge(doc.validation_status)}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                                            </span>
                                            {doc.expiration_date && (
                                                <span className="text-slate-400">
                                                    Expires {new Date(doc.expiration_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 w-8 h-8 bg-slate-800 hover:bg-blue-600 rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                                        title="Download"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
