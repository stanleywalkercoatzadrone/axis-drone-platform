import React, { useState } from 'react';
import { useReport } from '../ReportContext';
import {
    FileCheck, Loader2, AlertCircle, CheckCircle, ArrowLeft,
    Sparkles, Edit3, Plus, Trash2, Eye, ZoomIn, X,
    ChevronDown, ChevronUp, Save
} from 'lucide-react';
import { Severity } from '../../../types';
import { Button } from '../../../src/stitch/components/Button';

interface ReportReviewProps {
    onBack: () => void;
}

const severityColors: Record<string, string> = {
    [Severity.CRITICAL]: 'bg-red-100 text-red-700 border-red-200',
    [Severity.HIGH]: 'bg-orange-100 text-orange-700 border-orange-200',
    [Severity.MEDIUM]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    [Severity.LOW]: 'bg-blue-100 text-blue-700 border-blue-200',
};

const ReportReview: React.FC<ReportReviewProps> = ({ onBack }) => {
    const {
        finalizeReport, images, title, setTitle, industry, client, setClient,
        theme, reportStatus, summary, setSummary, recommendations, setRecommendations,
        generateReportNarrative, saveDraft, setStep
    } = useReport();

    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [newRec, setNewRec] = useState('');
    const [editingRecIdx, setEditingRecIdx] = useState<number | null>(null);

    const totalAnomalies = images.reduce((acc, img) => acc + img.annotations.length, 0);
    const criticals = images.reduce((acc, img) => acc + img.annotations.filter(a => a.severity === Severity.CRITICAL).length, 0);
    const highs = images.reduce((acc, img) => acc + img.annotations.filter(a => a.severity === Severity.HIGH).length, 0);

    const handleFinalize = async () => {
        setIsFinalizing(true);
        setError(null);
        try {
            await finalizeReport();
            setIsSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Failed to finalize report');
        } finally {
            setIsFinalizing(false);
        }
    };

    const handleSaveDraft = async () => {
        setIsSavingDraft(true);
        try {
            await saveDraft();
        } catch (err: any) {
            setError(err.message || 'Failed to save draft');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleGenerateNarrative = async () => {
        setIsGeneratingNarrative(true);
        try {
            await generateReportNarrative();
        } finally {
            setIsGeneratingNarrative(false);
        }
    };

    const addRecommendation = () => {
        if (!newRec.trim()) return;
        setRecommendations([...recommendations, newRec.trim()]);
        setNewRec('');
    };

    const removeRecommendation = (idx: number) => {
        setRecommendations(recommendations.filter((_, i) => i !== idx));
    };

    const updateRecommendation = (idx: number, val: string) => {
        setRecommendations(recommendations.map((r, i) => i === idx ? val : r));
    };

    // Read-only finalized view
    if (isSuccess || reportStatus === 'FINALIZED') {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                {lightboxImg && (
                    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
                        <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X className="w-6 h-6" /></button>
                        <img src={lightboxImg} className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} alt="" />
                    </div>
                )}

                {/* Finalized Banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-emerald-900">Report Finalized</h3>
                        <p className="text-sm text-emerald-700">This report has been committed and is read-only.</p>
                    </div>
                    <Button size="sm" onClick={onBack} className="ml-auto gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Reports
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Images', value: images.length, color: 'text-slate-900' },
                        { label: 'Total Findings', value: totalAnomalies, color: 'text-slate-900' },
                        { label: 'Critical', value: criticals, color: criticals > 0 ? 'text-red-600' : 'text-slate-900' },
                        { label: 'High', value: highs, color: highs > 0 ? 'text-orange-600' : 'text-slate-900' },
                    ].map(s => (
                        <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
                            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Summary */}
                {summary && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Executive Summary</h3>
                        <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
                    </div>
                )}

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recommendations</h3>
                        <ul className="space-y-2">
                            {recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                                    {rec}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Image Gallery */}
                {images.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Images ({images.length})</h3>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {images.map((img, idx) => (
                                <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer" onClick={() => setLightboxImg(img.url)}>
                                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                    </div>
                                    {img.annotations.length > 0 && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                                            {img.annotations.length}
                                        </div>
                                    )}
                                    <div className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/50 rounded px-1">{idx + 1}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Editable draft view
    return (
        <div className="max-w-5xl mx-auto">
            {lightboxImg && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X className="w-6 h-6" /></button>
                    <img src={lightboxImg} className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} alt="" />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left — Main Editor */}
                <div className="lg:col-span-8 space-y-5">

                    {/* Report Details */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Report Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Report Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter report title..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client</label>
                                <input
                                    type="text"
                                    value={client}
                                    onChange={e => setClient(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Client name..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Industry</label>
                                <div className="px-3 py-2 text-sm border border-slate-100 rounded-lg bg-slate-50 text-slate-600">{industry}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Theme</label>
                                <div className="px-3 py-2 text-sm border border-slate-100 rounded-lg bg-slate-50 text-slate-600">{theme}</div>
                            </div>
                        </div>
                    </div>

                    {/* Executive Summary */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Executive Summary</h3>
                            <button
                                onClick={handleGenerateNarrative}
                                disabled={isGeneratingNarrative || totalAnomalies === 0}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGeneratingNarrative
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Writing...</>
                                    : <><Sparkles className="w-3 h-3" /> AI Write</>
                                }
                            </button>
                        </div>
                        <textarea
                            value={summary}
                            onChange={e => setSummary(e.target.value)}
                            rows={5}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed"
                            placeholder={totalAnomalies > 0
                                ? "Click 'AI Write' to generate an executive summary based on findings, or write your own..."
                                : "Write your executive summary here..."
                            }
                        />
                        <p className="text-xs text-slate-400 mt-1.5">{summary.length} characters</p>
                    </div>

                    {/* Recommendations */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recommendations</h3>
                            <span className="text-xs text-slate-400">{recommendations.length} item{recommendations.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="space-y-2 mb-4">
                            {recommendations.map((rec, idx) => (
                                <div key={idx} className="flex items-start gap-2 group">
                                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-2">{idx + 1}</span>
                                    {editingRecIdx === idx ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={rec}
                                            onChange={e => updateRecommendation(idx, e.target.value)}
                                            onBlur={() => setEditingRecIdx(null)}
                                            onKeyDown={e => e.key === 'Enter' && setEditingRecIdx(null)}
                                            className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <div
                                            className="flex-1 px-3 py-1.5 text-sm text-slate-700 rounded-lg hover:bg-slate-50 cursor-text border border-transparent hover:border-slate-200 transition-colors"
                                            onClick={() => setEditingRecIdx(idx)}
                                        >
                                            {rec}
                                        </div>
                                    )}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5">
                                        <button onClick={() => setEditingRecIdx(idx)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => removeRecommendation(idx)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newRec}
                                onChange={e => setNewRec(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addRecommendation()}
                                placeholder="Add a recommendation..."
                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={addRecommendation}
                                disabled={!newRec.trim()}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Findings Table */}
                    {totalAnomalies > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Findings ({totalAnomalies})
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {images.map((img, imgIdx) =>
                                    img.annotations.map((ann, annIdx) => (
                                        <div key={ann.id} className="flex items-start gap-4 px-6 py-3 hover:bg-slate-50 transition-colors">
                                            <div
                                                className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer"
                                                onClick={() => setLightboxImg(img.url)}
                                            >
                                                <img src={img.url} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-semibold text-slate-800">{ann.label}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityColors[ann.severity] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {ann.severity}
                                                    </span>
                                                    {ann.confidence && (
                                                        <span className="text-[10px] text-slate-400">{Math.round(ann.confidence * 100)}% confidence</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-2">{ann.description}</p>
                                            </div>
                                            <div className="text-xs text-slate-400 shrink-0">Img {imgIdx + 1}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Image Gallery with Findings */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                            Images ({images.length})
                        </h3>
                        <div className="space-y-3">
                            {images.map((img, idx) => (
                                <div key={img.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div
                                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => setExpandedImage(expandedImage === img.id ? null : img.id)}
                                    >
                                        <div
                                            className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer"
                                            onClick={e => { e.stopPropagation(); setLightboxImg(img.url); }}
                                        >
                                            <img src={img.url} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-800">Image {idx + 1}</span>
                                                {img.annotations.length > 0 ? (
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                                        {img.annotations.length} finding{img.annotations.length !== 1 ? 's' : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                                        No issues
                                                    </span>
                                                )}
                                            </div>
                                            {img.summary && (
                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{img.summary}</p>
                                            )}
                                        </div>
                                        <div className="text-slate-400">
                                            {expandedImage === img.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>

                                    {expandedImage === img.id && img.annotations.length > 0 && (
                                        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-2">
                                            {img.annotations.map(ann => (
                                                <div key={ann.id} className="flex items-start gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${severityColors[ann.severity] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {ann.severity}
                                                    </span>
                                                    <div>
                                                        <div className="text-xs font-semibold text-slate-700">{ann.label}</div>
                                                        <div className="text-xs text-slate-500">{ann.description}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right — Actions Sidebar */}
                <div className="lg:col-span-4">
                    <div className="sticky top-4 space-y-4">
                        {/* Stats */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Report Stats</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Images</span>
                                    <span className="font-semibold text-slate-900">{images.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Total Findings</span>
                                    <span className="font-semibold text-slate-900">{totalAnomalies}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Critical</span>
                                    <span className={`font-semibold ${criticals > 0 ? 'text-red-600' : 'text-slate-900'}`}>{criticals}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">High</span>
                                    <span className={`font-semibold ${highs > 0 ? 'text-orange-600' : 'text-slate-900'}`}>{highs}</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</h3>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex gap-2 border border-red-200">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                onClick={handleSaveDraft}
                                disabled={isSavingDraft}
                                className="w-full flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSavingDraft ? 'Saving...' : 'Save Draft'}
                            </button>

                            <Button
                                size="lg"
                                onClick={handleFinalize}
                                disabled={isFinalizing}
                                className="w-full h-11 rounded-lg gap-2"
                            >
                                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                                {isFinalizing ? 'Finalizing...' : 'Finalize & Publish'}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => setStep(3)}
                                className="w-full h-10 rounded-lg text-slate-500 gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Analysis
                            </Button>
                        </div>

                        {/* Checklist */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Checklist</h3>
                            <div className="space-y-2 text-xs">
                                {[
                                    { label: 'Report title set', done: !!title },
                                    { label: 'Client name set', done: !!client },
                                    { label: 'Images uploaded', done: images.length > 0 },
                                    { label: 'AI analysis run', done: images.some(i => i.annotations.length > 0) },
                                    { label: 'Summary written', done: summary.length > 20 },
                                    { label: 'Recommendations added', done: recommendations.length > 0 },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? 'bg-green-100' : 'bg-slate-100'}`}>
                                            {item.done
                                                ? <CheckCircle className="w-3 h-3 text-green-600" />
                                                : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                            }
                                        </div>
                                        <span className={item.done ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportReview;
