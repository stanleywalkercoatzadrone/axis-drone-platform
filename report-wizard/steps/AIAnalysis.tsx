import React, { useEffect, useState } from 'react';
import { useReport } from '../ReportContext';
import { Sparkles, Loader2, CheckCircle, ArrowRight, BrainCircuit } from 'lucide-react';

const AIAnalysis: React.FC = () => {
    const { isAnalyzing, startAIAnalysis, images, setStep } = useReport();
    const [scanProgress, setScanProgress] = useState(0);

    useEffect(() => {
        // Auto-start analysis if not already done? 
        // Or wait for user trigger. Let's trigger automatically for "Magic" feel if logic permits.
        // For now, let's show a start screen.
    }, []);

    useEffect(() => {
        if (isAnalyzing) {
            const interval = setInterval(() => {
                setScanProgress(prev => (prev < 90 ? prev + (Math.random() * 5) : prev));
            }, 500);
            return () => clearInterval(interval);
        } else {
            setScanProgress(100);
        }
    }, [isAnalyzing]);

    const hasAnnotations = images.some(img => img.annotations.length > 0);

    return (
        <div className="max-w-3xl mx-auto text-center py-12">
            {!isAnalyzing && !hasAnnotations && (
                <div className="animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl shadow-purple-200">
                        <Sparkles className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Neural Analysis Ready</h2>
                    <p className="text-slate-500 text-lg mb-10 max-w-xl mx-auto">
                        Our model will scan {images.length} images for anomalies specific to the selected industry protocol.
                    </p>
                    <button
                        onClick={startAIAnalysis}
                        className="px-10 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 hover:scale-105 transition-all shadow-xl"
                    >
                        Run Analysis Engine
                    </button>
                </div>
            )}

            {isAnalyzing && (
                <div className="animate-in fade-in duration-700">
                    <div className="relative w-32 h-32 mx-auto mb-8">
                        <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <BrainCircuit className="w-12 h-12 text-purple-600 animate-pulse" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Analyzing Imagery...</h2>
                    <p className="text-slate-500 mb-8">Detecting thermal variances and structural anomalies...</p>

                    <div className="w-full max-w-md mx-auto h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${scanProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {!isAnalyzing && hasAnnotations && (
                <div className="animate-in slide-in-from-bottom-8 duration-500">
                    <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-6 flex items-center justify-center text-green-600">
                        <CheckCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Analysis Complete</h2>
                    <p className="text-slate-500 mb-10">
                        Processed {images.length} images. Found anomalies across the dataset.
                    </p>

                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => setStep(4)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                        >
                            Review Findings <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIAnalysis;
