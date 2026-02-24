import React, { useRef } from 'react';
import { useReport } from '../ReportContext';
import { Upload, Loader2, CheckCircle, AlertCircle, Trash2, ArrowRight } from 'lucide-react';

import { Button } from '../../../src/stitch/components/Button';
import { Card } from '../../../src/stitch/components/Card';

const DataIngest: React.FC = () => {
    const { images, addImages, removeImage, uploadProgress, setStep, isUploading } = useReport();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('[DataIngest] handleFileUpload triggered, files:', e.target.files?.length);
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            console.log('[DataIngest] calling addImages with', files.length, 'files');
            try {
                await addImages(files);
                console.log('[DataIngest] addImages completed');
            } catch (err) {
                console.error('[DataIngest] addImages threw:', err);
            }
            e.target.value = '';
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) await addImages(files);
    };

    const isAllUploaded = images.length > 0 && images.every(img =>
        uploadProgress[img.id] === 100 || uploadProgress[img.id] === undefined
    );

    return (
        <div className="max-w-4xl mx-auto">

            {/* Upload Area */}
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer mb-8 bg-white relative"
            >
                {isUploading && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 rounded-t-xl overflow-hidden">
                        <div className="h-full bg-blue-500 animate-pulse w-full" />
                    </div>
                )}

                <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    {isUploading
                        ? <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
                        : <Upload className="w-7 h-7 text-slate-400" />
                    }
                </div>

                <p className="font-semibold text-slate-700 mb-1">
                    {isUploading ? 'Uploading...' : 'Drop images here or click to browse'}
                </p>
                <p className="text-sm text-slate-400">Supports JPG, PNG, TIFF — multiple files allowed</p>

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
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-semibold text-slate-600">{images.length} image{images.length !== 1 ? 's' : ''} selected</p>
                        {isAllUploaded && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                                <CheckCircle className="w-3.5 h-3.5" /> All uploaded
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {images.map(img => {
                            const progress = uploadProgress[img.id];
                            const isComplete = progress === 100 || progress === undefined;
                            const isError = progress === -1;
                            const isLoading = !isComplete && !isError && progress !== undefined;

                            return (
                                <div key={img.id} className="relative group aspect-square">
                                    <div className="w-full h-full rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                        <img src={img.url} className="w-full h-full object-cover" alt="" />

                                        {isLoading && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                                            </div>
                                        )}

                                        {isError && (
                                            <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center rounded-lg">
                                                <AlertCircle className="w-5 h-5 text-red-600" />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <Button variant="outline" onClick={() => setStep(1)} className="h-10 px-5 rounded-lg">
                    Back
                </Button>
                <Button
                    size="lg"
                    onClick={() => setStep(3)}
                    disabled={images.length === 0 || isUploading}
                    className="h-11 px-8 rounded-lg gap-2"
                >
                    Run Analysis <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default DataIngest;
