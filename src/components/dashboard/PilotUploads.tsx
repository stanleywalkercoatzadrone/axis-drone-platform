import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    UploadCloud,
    ArrowLeft,
    FileText,
    Image as ImageIcon,
    X,
    CheckCircle2,
    DownloadCloud
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface PilotUploadsProps {
    missionId: string;
    onBack: () => void;
}

export const PilotUploads: React.FC<PilotUploadsProps> = ({ missionId, onBack }) => {
    const { user } = useAuth();
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Placeholder data for Mission Pack (To download KML/Excel files)
    const missionPackFiles = [
        { id: '1', name: 'Site_Boundary_Map.kml', type: 'kml', url: '#' },
        { id: '2', name: 'Inspection_Specs.pdf', type: 'pdf', url: '#' },
    ];

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(files.filter((_, idx) => idx !== indexToRemove));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;
        setIsUploading(true);

        try {
            // Additive only: looping over files mimicking form integration
            await Promise.all(files.map(async (file) => {
                const formData = new FormData();
                formData.append('document', file);
                await apiClient.post(`/pilot/missions/${missionId}/uploads`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }));

            setUploadComplete(true);
            setFiles([]);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('A network error interrupted the upload session. Please ensure you are online and try again.');
        } finally {
            setIsUploading(false);
        }
    };

    if (uploadComplete) {
        return (
            <div className="flex flex-col items-center justify-center p-20 max-w-2xl mx-auto text-center space-y-6 animate-in fade-in slide-in-from-bottom-8">
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border-4 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="text-emerald-500" size={48} />
                </div>
                <h2 className="text-4xl font-black text-white tracking-tight uppercase">Upload Successful</h2>
                <p className="text-slate-400">All session resources securely logged to the intelligence database.</p>
                <button
                    onClick={onBack}
                    className="mt-8 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-blue-500/20 border border-blue-400/30"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-32">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Mission Pack & Uploads</h1>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mt-1">Resource Synchronization</p>
                </div>
            </div>

            {/* Mission Pack (Downloads) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
                    <DownloadCloud size={14} /> Available Mission Resources
                </h2>
                <div className="grid gap-3">
                    {missionPackFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:bg-slate-800/80 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                    <FileText className="text-orange-400" size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-200">{file.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{file.type} File</p>
                                </div>
                            </div>
                            <button className="px-4 py-2 bg-blue-600/10 text-blue-400 font-bold text-xs uppercase tracking-wider rounded-lg border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-colors">
                                Download
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Upload Area */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 bg-slate-800/20">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <UploadCloud size={14} className="text-emerald-400" /> Upload Today's Data
                    </h2>
                </div>

                <div className="p-8">
                    {/* Native Drag and Drop Zone Simulator */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/50 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors group"
                    >
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                        />
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UploadCloud className="text-emerald-400" size={32} />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-black text-slate-200 uppercase tracking-tight">Select Data Files</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Tap here to choose Images, KMLs, or Spreadsheets</p>
                        </div>
                    </div>

                    {/* Pending Queue */}
                    {files.length > 0 && (
                        <div className="mt-8">
                            <div className="flex justify-between items-end mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upload Queue ({files.length})</h3>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <ImageIcon size={16} className="text-blue-400 shrink-0" />
                                            <span className="text-sm font-medium text-slate-300 truncate">{file.name}</span>
                                        </div>
                                        <button
                                            onClick={() => removeFile(idx)}
                                            className="text-slate-600 hover:text-rose-400 p-2"
                                            disabled={isUploading}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg shadow-emerald-900/40 border border-emerald-400/30 disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Uploading Sequence...
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud size={20} /> Submit Work
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
