import React, { useRef } from 'react';
import { useReport } from '../ReportContext';
import { Cloud, Loader2, CheckCircle, AlertCircle, Trash2, ArrowRight } from 'lucide-react';

const DataIngest: React.FC = () => {
    const { images, addImage, removeImage, uploadProgress, setStep } = useReport();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            for (const file of files) {
                await addImage(file);
            }
        }
    };

    const isAllUploaded = images.length > 0 && images.every(img => !uploadProgress[img.id] || uploadProgress[img.id] === 100);

    return (
        <div className="max-w-4xl mx-auto">

            {/* Upload Area */}
            <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center hover:bg-blue-50/50 hover:border-blue-400 transition-all cursor-pointer mb-12 bg-slate-50"
            >
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:scale-110 transition-transform text-blue-600">
                    <Cloud className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Upload source imagery</h3>
                <p className="text-slate-500 mb-8 max-w-md mx-auto">Drag & drop flight logs, thermal tiffs, or high-res JPEGs here. We'll process them in parallel.</p>

                <button className="px-6 py-3 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 shadow-sm group-hover:border-blue-400 group-hover:text-blue-600">
                    Browse Files
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                />
            </div>

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="mb-12">
                    <h4 className="font-bold text-slate-900 mb-4 flex justify-between items-center">
                        <span>Ingest Queue ({images.length})</span>
                        {isAllUploaded && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> All Synced</span>}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {images.map(img => {
                            const progress = uploadProgress[img.id];
                            const isComplete = progress === 100;
                            const isError = progress === -1;

                            return (
                                <div key={img.id} className="relative group bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 mb-2 relative">
                                        <img src={img.url} className="w-full h-full object-cover opacity-90" />

                                        {/* Overlay for Progress */}
                                        {!isComplete && !isError && progress !== undefined && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <div className="w-12 h-12 relative flex items-center justify-center">
                                                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                                                    <span className="absolute text-[10px] text-white font-bold">{progress}%</span>
                                                </div>
                                            </div>
                                        )}

                                        {isError && (
                                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                                                <AlertCircle className="w-8 h-8 text-red-600" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-xs font-mono text-slate-500 truncate max-w-[80px]">IMG-{img.id.slice(0, 4)}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-6 border-t border-slate-200">
                <button
                    onClick={() => setStep(3)}
                    disabled={images.length === 0}
                    className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-blue-200"
                >
                    Process & Analyze <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default DataIngest;
