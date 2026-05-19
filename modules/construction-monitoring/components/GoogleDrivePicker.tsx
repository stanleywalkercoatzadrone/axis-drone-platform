import React, { useState, useEffect } from 'react';
import { HardDrive, Folder, File, ChevronRight, X, DownloadCloud, AlertCircle } from 'lucide-react';
import apiClient from '../../../src/services/apiClient';

export default function GoogleDrivePicker({ onClose, onImport, missionId }) {
    const [files, setFiles] = useState([]);
    const [path, setPath] = useState([{ id: 'root', name: 'My Drive' }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchFiles('root');
    }, []);

    const fetchFiles = async (folderId) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get(`/drive/files?parent=${folderId}`);
            if (res.data.success) {
                setFiles(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch Drive files:', err);
            // 400 likely means not authenticated or no token
            if (err.response?.status === 400 || err.response?.data?.message?.includes('not linked')) {
                setError('needs_auth');
            } else {
                setError('Failed to load Google Drive contents. Please check your connection.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        try {
            const res = await apiClient.get('/auth/google/url');
            if (res.data.success && res.data.data.url) {
                window.location.href = res.data.data.url;
            }
        } catch (e) {
            setError('Failed to initiate Google authentication.');
        }
    };

    const navigateToFolder = (folder) => {
        setPath([...path, { id: folder.id, name: folder.name }]);
        fetchFiles(folder.id);
    };

    const navigateUp = (index) => {
        const newPath = path.slice(0, index + 1);
        setPath(newPath);
        fetchFiles(newPath[newPath.length - 1].id);
    };

    const handleImport = async (file) => {
        setImporting(file.id);
        try {
            const res = await apiClient.post('/drive/import', {
                fileId: file.id,
                missionId: missionId
            });
            if (res.data.success) {
                onImport(res.data.data);
                onClose();
            }
        } catch (err) {
            console.error('Import failed:', err);
            setError(`Failed to import ${file.name}. Please try again.`);
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh] animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 bg-slate-900/80 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Import from Google Drive</h2>
                            <p className="text-xs text-slate-400">Select files to pull directly into the Axis Platform</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    
                    {error === 'needs_auth' ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mb-6">
                                <HardDrive className="w-8 h-8 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Connect Google Drive</h3>
                            <p className="text-sm text-slate-400 max-w-md mb-8">
                                Axis needs read access to your Google Drive to import files. If you previously linked your account, you need to re-authenticate to grant read permissions.
                            </p>
                            <button onClick={handleConnect} className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-200 font-bold rounded-xl transition-colors flex items-center gap-2">
                                Connect Google Account
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Breadcrumbs */}
                            <div className="flex items-center gap-2 p-3 px-5 bg-slate-950/50 border-b border-slate-800 overflow-x-auto whitespace-nowrap">
                                {path.map((segment, index) => (
                                    <React.Fragment key={segment.id}>
                                        {index > 0 && <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />}
                                        <button 
                                            onClick={() => navigateUp(index)}
                                            className={`text-sm font-medium hover:text-white transition-colors shrink-0 ${index === path.length - 1 ? 'text-white' : 'text-slate-400'}`}
                                        >
                                            {segment.name}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* File List */}
                            <div className="flex-1 overflow-y-auto p-2">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                    </div>
                                ) : error ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                        <AlertCircle className="w-12 h-12 text-red-400/50 mb-4" />
                                        <p className="text-red-400">{error}</p>
                                    </div>
                                ) : files.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                        <Folder className="w-12 h-12 mb-4 opacity-20" />
                                        <p>This folder is empty</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {files.map(f => {
                                            const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
                                            const isImage = f.mimeType.startsWith('image/');
                                            
                                            return (
                                                <div key={f.id} 
                                                    className="group flex flex-col p-4 bg-slate-800/20 hover:bg-slate-800/50 border border-slate-700/30 hover:border-blue-500/30 rounded-xl transition-all cursor-pointer relative"
                                                    onClick={() => isFolder ? navigateToFolder(f) : null}
                                                >
                                                    <div className="flex items-start gap-3 mb-3">
                                                        {isFolder ? (
                                                            <Folder className="w-10 h-10 text-blue-400/80" fill="currentColor" opacity={0.2} />
                                                        ) : isImage && f.thumbnailLink ? (
                                                            <img src={f.thumbnailLink} alt={f.name} className="w-10 h-10 object-cover rounded-lg" />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400">
                                                                <File className="w-5 h-5" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-slate-200 truncate">{f.name}</p>
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                                                                {isFolder ? 'Folder' : `${(parseInt(f.size || 0) / 1024 / 1024).toFixed(1)} MB`}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {!isFolder && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleImport(f); }}
                                                            disabled={importing !== false}
                                                            className={`absolute inset-0 bg-blue-600/90 backdrop-blur-sm rounded-xl flex items-center justify-center gap-2 font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity ${importing === f.id ? 'opacity-100 bg-blue-700' : ''}`}
                                                        >
                                                            {importing === f.id ? (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                    Importing...
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <DownloadCloud className="w-5 h-5" />
                                                                    Import File
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
