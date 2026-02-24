import React, { useState } from 'react';
import { useReport } from '../ReportContext';
import { useIndustry } from '../../../src/context/IndustryContext';
import {
    Sparkles, Loader2, CheckCircle, ArrowRight, ArrowLeft,
    Image as ImageIcon, AlertTriangle, Eye, ZoomIn, X
} from 'lucide-react';
import { Button } from '../../../src/stitch/components/Button';
import { Severity } from '../../../types';

const severityColors: Record<string, string> = {
    [Severity.CRITICAL]: 'bg-red-100 text-red-700 border-red-200',
    [Severity.HIGH]: 'bg-orange-100 text-orange-700 border-orange-200',
    [Severity.MEDIUM]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    [Severity.LOW]: 'bg-blue-100 text-blue-700 border-blue-200',
};

const severityDot: Record<string, string> = {
    [Severity.CRITICAL]: 'bg-red-500',
    [Severity.HIGH]: 'bg-orange-500',
    [Severity.MEDIUM]: 'bg-yellow-500',
    [Severity.LOW]: 'bg-blue-500',
};

const AIAnalysis: React.FC = () => {
    const { isAnalyzing, analyzeAllImages, images, setStep, analysisProgress } = useReport();
    const { currentIndustry } = useIndustry();
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    const hasAnnotations = images.some(img => img.annotations.length > 0);
    const totalFindings = images.reduce((acc, img) => acc + img.annotations.length, 0);
    const criticals = images.reduce((acc, img) => acc + img.annotations.filter(a => a.severity === Severity.CRITICAL).length, 0);
    const highs = images.reduce((acc, img) => acc + img.annotations.filter(a => a.severity === Severity.HIGH).length, 0);

    const progressPct = analysisProgress.total > 0
        ? Math.round((analysisProgress.current / analysisProgress.total) * 100)
        : 0;

    return (
        <div className="max-w-5xl mx-auto">
            {/* Lightbox */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxImg(null)}
                >
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={lightboxImg}
                        className="max-w-full max-h-full rounded-xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                        alt="Full size"
                    />
                </div>
            )}

            {/* Ready to Analyze */}
            {!isAnalyzing && !hasAnnotations && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                        <div className="flex items-start gap-5">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                                <Sparkles className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 mb-1">{currentIndustry ? currentIndustry.charAt(0).toUpperCase() + currentIndustry.slice(1) : ''} AI Analysis Engine</h2>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Gemini 2.0 Pro will analyze each of your {images.length} image{images.length !== 1 ? 's' : ''} for
                                    structural anomalies, defects, and safety hazards. Each image is processed individually
                                    with bounding box annotations and severity scoring.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Image Preview Grid */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                            Images Queued ({images.length})
                        </h3>
                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                            {images.map((img, idx) => (
                                <div
                                    key={img.id}
                                    className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer"
                                    onClick={() => setLightboxImg(img.url)}
                                >
                                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/50 rounded px-1">
                                        {idx + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <Button variant="outline" onClick={() => setStep(2)} className="h-10 px-5 rounded-lg gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button
                            size="lg"
                            onClick={analyzeAllImages}
                            disabled={images.length === 0}
                            className="h-11 px-8 rounded-lg gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            Start AI Analysis
                        </Button>
                    </div>
                </div>
            )}

            {/* Analyzing — live progress */}
            {isAnalyzing && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Analyzing with Gemini 2.0 Pro</h2>
                    <p className="text-sm text-slate-500 mb-8">
                        Processing image {analysisProgress.current} of {analysisProgress.total}...
                    </p>

                    <div className="max-w-md mx-auto">
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-2">
                            <div
                                className="h-full bg-blue-600 transition-all duration-700 ease-out rounded-full"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Detecting anomalies &amp; generating findings</span>
                            <span>{progressPct}%</span>
                        </div>
                    </div>

                    {/* Live image grid showing which ones are done */}
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mt-8 max-w-lg mx-auto">
                        {images.map((img, idx) => {
                            const isDone = idx < analysisProgress.current;
                            const isCurrent = idx === analysisProgress.current - 1;
                            return (
                                <div key={img.id} className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${isCurrent ? 'border-blue-500 scale-110' :
                                    isDone ? 'border-green-400 opacity-60' :
                                        'border-slate-200 opacity-30'
                                    }`}>
                                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                                    {isDone && !isCurrent && (
                                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-green-600" />
                                        </div>
                                    )}
                                    {isCurrent && (
                                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                            <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Analysis Complete */}
            {!isAnalyzing && hasAnnotations && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                            <div className="text-2xl font-bold text-slate-900">{images.length}</div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Images
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                            <div className="text-2xl font-bold text-slate-900">{totalFindings}</div>
                            <div className="text-xs text-slate-400 mt-1">Total Findings</div>
                        </div>
                        <div className={`rounded-xl p-4 shadow-sm text-center border ${criticals > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                            <div className={`text-2xl font-bold ${criticals > 0 ? 'text-red-600' : 'text-slate-900'}`}>{criticals}</div>
                            <div className={`text-xs mt-1 ${criticals > 0 ? 'text-red-400' : 'text-slate-400'}`}>Critical</div>
                        </div>
                        <div className={`rounded-xl p-4 shadow-sm text-center border ${highs > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                            <div className={`text-2xl font-bold ${highs > 0 ? 'text-orange-600' : 'text-slate-900'}`}>{highs}</div>
                            <div className={`text-xs mt-1 ${highs > 0 ? 'text-orange-400' : 'text-slate-400'}`}>High</div>
                        </div>
                    </div>

                    {/* Per-image results */}
                    <div className="space-y-3">
                        {images.map((img, idx) => (
                            <div key={img.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="flex items-start gap-4 p-4">
                                    <div
                                        className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer group relative"
                                        onClick={() => setLightboxImg(img.url)}
                                    >
                                        <img src={img.url} className="w-full h-full object-cover" alt="" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                            <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-slate-800">Image {idx + 1}</span>
                                            {img.annotations.length > 0 ? (
                                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                                    {img.annotations.length} finding{img.annotations.length !== 1 ? 's' : ''}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> No issues
                                                </span>
                                            )}
                                        </div>
                                        {img.summary && (
                                            <p className="text-xs text-slate-500 mb-2 line-clamp-2">{img.summary}</p>
                                        )}
                                        {img.annotations.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {img.annotations.map(ann => (
                                                    <span
                                                        key={ann.id}
                                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${severityColors[ann.severity] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${severityDot[ann.severity] || 'bg-slate-400'}`} />
                                                        {ann.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <Button variant="outline" onClick={() => setStep(2)} className="h-10 px-5 rounded-lg gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </Button>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={analyzeAllImages}
                                className="h-10 px-5 rounded-lg gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                                <Sparkles className="w-4 h-4" /> Re-analyze
                            </Button>
                            <Button
                                size="lg"
                                onClick={() => setStep(4)}
                                className="h-11 px-8 rounded-lg gap-2"
                            >
                                Edit Report <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIAnalysis;
