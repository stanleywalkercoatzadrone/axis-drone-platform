import React, { useState } from 'react';
import { FileDropZone } from './FileDropZone';
import { useGlobalContext } from '../../context/GlobalContext';
import { X, File as FileIcon, Folder, AlertCircle, CheckCircle, RotateCw } from 'lucide-react';
import apiClient from '../../services/apiClient';

interface QueuedFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
    path: string;
}

export const UploadCenter: React.FC = () => {
    const { selectedIndustry, selectedClientId, selectedSiteId } = useGlobalContext();
    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);

    const handleFilesSelected = (files: File[]) => {
        const newQueue = files.map(file => ({
            file,
            status: 'pending' as const,
            progress: 0,
            path: (file as any).webkitRelativePath || file.name
        }));
        setQueue(prev => [...prev, ...newQueue]);
    };

    const removeFile = (index: number) => {
        setQueue(prev => prev.filter((_, i) => i !== index));
    };

    const startUpload = async () => {
        if (!selectedClientId || !selectedSiteId) {
            alert('Please select a Client and Site explicitly before uploading.');
            return;
        }

        setIsUploading(true);

        try {
            // 1. Create Job
            const jobRes = await apiClient.post('/ingestion/jobs', {
                industry: selectedIndustry,
                clientId: selectedClientId,
                siteId: selectedSiteId,
                totalFiles: queue.length
            });

            if (jobRes.data.success) {
                const newJobId = jobRes.data.data.id;
                setJobId(newJobId);

                // 2. Register Files (Metadata)
                const filesMeta = queue.map(q => ({
                    name: q.file.name,
                    path: q.path,
                    size: q.file.size,
                    type: q.file.type
                }));

                await apiClient.post(`/ingestion/jobs/${newJobId}/files`, { files: filesMeta });

                // 3. Mock Upload Progress (In real app, we'd use Signed URLs or multipart upload here)
                // For this demo, we'll simulate the upload progress
                simulateUploadProgress();
            }

        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to start ingestion job.');
            setIsUploading(false);
        }
    };

    const simulateUploadProgress = () => {
        // Mock progress simulation
        let processed = 0;
        const interval = setInterval(() => {
            setQueue(prev => {
                const next = [...prev];
                // Mark some as uploading/completed
                for (let i = 0; i < next.length; i++) {
                    if (next[i].status === 'pending') {
                        next[i].status = 'uploading';
                        next[i].progress = 10;
                    } else if (next[i].status === 'uploading') {
                        next[i].progress += Math.floor(Math.random() * 20);
                        if (next[i].progress >= 100) {
                            next[i].progress = 100;
                            next[i].status = 'completed';
                        }
                    }
                }

                if (next.every(f => f.status === 'completed')) {
                    clearInterval(interval);
                    setIsUploading(false);
                    // Could confirm ingestion endpoint here
                }
                return next;
            });
        }, 500);
    };

    const getIcon = (item: QueuedFile) => {
        if (item.status === 'completed') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        if (item.status === 'error') return <AlertCircle className="w-5 h-5 text-red-500" />;
        if (item.status === 'uploading') return <RotateCw className="w-5 h-5 text-cyan-500 animate-spin" />;
        return item.path.includes('/') ? <Folder className="w-5 h-5 text-slate-500" /> : <FileIcon className="w-5 h-5 text-slate-500" />;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Ingestion Center</h1>
                    <p className="text-slate-400">Upload drone imagery, logs, and assets for processing.</p>
                </div>
                {queue.length > 0 && !isUploading && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setQueue([])}
                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Clear All
                        </button>
                        <button
                            onClick={startUpload}
                            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg shadow-glow hover:shadow-lg hover:scale-105 transition-all"
                        >
                            Start Ingestion ({queue.length})
                        </button>
                    </div>
                )}
            </header>

            {!selectedSiteId && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-amber-200 font-medium">Context Required</h4>
                        <p className="text-amber-200/70 text-sm">Please select a Client and Site from the top bar before uploading data.</p>
                    </div>
                </div>
            )}

            {queue.length === 0 ? (
                <FileDropZone onFilesSelected={handleFilesSelected} disabled={!selectedSiteId || isUploading} />
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/30 flex justify-between items-center">
                        <h3 className="font-medium text-slate-200">Upload Queue</h3>
                        <span className="text-xs text-slate-500">{queue.filter(q => q.status === 'completed').length} / {queue.length} completed</span>
                    </div>
                    <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
                        {queue.map((item, idx) => (
                            <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors group">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="shrink-0">
                                        {getIcon(item)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-200 truncate" title={item.path}>
                                            {item.path}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 max-w-xs h-1 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-500' :
                                                            item.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-500'
                                                        }`}
                                                    style={{ width: `${item.progress}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-[10px] text-slate-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                    </div>
                                </div>
                                {item.status === 'pending' && !isUploading && (
                                    <button
                                        onClick={() => removeFile(idx)}
                                        className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
