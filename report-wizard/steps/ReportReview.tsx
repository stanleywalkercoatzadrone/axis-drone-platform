import React, { useState } from 'react';
import { useReport } from '../ReportContext';
import { FileCheck, ChevronLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Severity } from '../../../types';

interface ReportReviewProps {
    onBack: () => void;
}

const ReportReview: React.FC<ReportReviewProps> = ({ onBack }) => {
    const {
        finalizeReport,
        images,
        title,
        industry,
        client,
        branding,
        theme
    } = useReport();

    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFinalize = async () => {
        setIsFinalizing(true);
        setError(null);
        try {
            await finalizeReport();
            setIsSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to finalize report');
        } finally {
            setIsFinalizing(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="max-w-xl mx-auto text-center py-20 animate-in zoom-in">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 text-green-600">
                    <CheckCircle className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Report Finalized!</h2>
                <p className="text-slate-500 mb-8">
                    Your inspection report has been successfully generated, saved, and locked.
                </p>
                <button
                    onClick={onBack}
                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const totalAnomalies = images.reduce((acc, img) => acc + img.annotations.length, 0);
    const criticals = images.reduce((acc, img) => acc + img.annotations.filter(a => a.severity === Severity.CRITICAL).length, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4">Executive Summary Preview</h3>
                    <div className="prose prose-sm text-slate-600">
                        <p>
                            This <strong>{theme}</strong> report for <strong>{client}</strong> covers the {industry} inspection titled "<strong>{title}</strong>".
                            Analysis has identified <strong>{totalAnomalies}</strong> anomalies, including <strong className="text-red-600">{criticals} Critical</strong> issues requiring immediate attention.
                        </p>
                    </div>
                </section>

                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4">Included Assets ({images.length})</h3>
                    <div className="grid grid-cols-4 gap-2">
                        {images.slice(0, 8).map(img => (
                            <div key={img.id} className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                                <img src={img.url} className="w-full h-full object-cover" />
                            </div>
                        ))}
                        {images.length > 8 && (
                            <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-bold text-sm">
                                +{images.length - 8}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-4">Publishing Actions</h3>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleFinalize}
                        disabled={isFinalizing}
                        className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 mb-3"
                    >
                        {isFinalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
                        Finalize Report
                    </button>

                    <p className="text-xs text-center text-slate-400">
                        This will generate the final PDF and lock editing capabilities.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReportReview;
