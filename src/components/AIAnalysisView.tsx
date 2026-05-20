
import React, { useState, useEffect, useRef } from 'react';
import {
    Scan,
    AlertCircle,
    CheckCircle2,
    BrainCircuit,
    Target,
    Maximize2,
    Cpu,
    Activity,
    ChevronRight,
    ShieldAlert,
    Zap,
    Crosshair
} from 'lucide-react';
import { Annotation, Severity } from '../types';

interface AIAnalysisViewProps {
    imageUrl: string;
    annotations: Annotation[];
    isScanning: boolean;
    onScanComplete: () => void;
    onAnnotationSelect: (id: string) => void;
    selectedAnnotationId: string | null;
}

const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({
    imageUrl,
    annotations,
    isScanning,
    onScanComplete,
    onAnnotationSelect,
    selectedAnnotationId
}) => {
    const [scanProgress, setScanProgress] = useState(0);
    const [detectedCount, setDetectedCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Simulated Scanning Effect
    useEffect(() => {
        if (isScanning) {
            setDetectedCount(0);
            setScanProgress(0);

            const interval = setInterval(() => {
                setScanProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        onScanComplete();
                        return 100;
                    }
                    return prev + 1;
                });
            }, 30); // 3 seconds scan time

            return () => clearInterval(interval);
        }
    }, [isScanning, onScanComplete]);

    // Update detected count during scan
    useEffect(() => {
        if (isScanning) {
            const count = Math.floor((scanProgress / 100) * annotations.length);
            setDetectedCount(count);
        } else {
            setDetectedCount(annotations.length);
        }
    }, [scanProgress, isScanning, annotations.length]);

    return (
        <div className="flex bg-slate-950 rounded-xl overflow-hidden shadow-2xl border border-slate-800 h-[600px] relative">
            {/* HUD Overlay Graphics */}
            <div className="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs opacity-70">
                        <Crosshair className="w-4 h-4" />
                        <span>SYS.TGT.LOCKED</span>
                    </div>
                    <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs opacity-70">
                        <span>COORDS: {Math.random().toFixed(4)}N, {Math.random().toFixed(4)}W</span>
                    </div>
                </div>
                <div className="flex justify-between items-end">
                    <div className="text-cyan-400 font-mono text-xs opacity-70">
                        MOD: AI-VISION-V4
                    </div>
                    <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs opacity-70">
                        {isScanning ? 'SCANNING...' : 'ANALYSIS COMPLETE'}
                    </div>
                </div>

                {/* Corner Brackets */}
                <svg className="absolute top-0 left-0 w-16 h-16 text-cyan-500 opacity-50 m-4" viewBox="0 0 100 100">
                    <path d="M2 30 L2 2 L30 2" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
                <svg className="absolute top-0 right-0 w-16 h-16 text-cyan-500 opacity-50 m-4 transform rotate-90" viewBox="0 0 100 100">
                    <path d="M2 30 L2 2 L30 2" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
                <svg className="absolute bottom-0 right-0 w-16 h-16 text-cyan-500 opacity-50 m-4 transform rotate-180" viewBox="0 0 100 100">
                    <path d="M2 30 L2 2 L30 2" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
                <svg className="absolute bottom-0 left-0 w-16 h-16 text-cyan-500 opacity-50 m-4 transform -rotate-90" viewBox="0 0 100 100">
                    <path d="M2 30 L2 2 L30 2" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
            </div>

            {/* Main Analysis Viewport */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
                <img
                    src={imageUrl}
                    className="max-h-full max-w-full object-contain opacity-80"
                    alt="Analysis Subject"
                />

                {/* Scanning Beam */}
                {isScanning && (
                    <div
                        className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_2px_rgba(34,211,238,0.8)] z-20 transition-all ease-linear"
                        style={{ top: `${scanProgress}%` }}
                    />
                )}

                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                {/* Annotations Overlay */}
                <div className="absolute inset-0 w-full h-full">
                    {annotations.slice(0, isScanning ? detectedCount : undefined).map((anno) => (
                        <div
                            key={anno.id}
                            className={`absolute border-2 transition-all duration-300 cursor-pointer group/anno ${selectedAnnotationId === anno.id
                                    ? 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-30'
                                    : 'border-cyan-500/60 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                                }`}
                            style={{
                                left: `${anno.x}%`,
                                top: `${anno.y}%`,
                                width: `${anno.width}%`,
                                height: `${anno.height}%`
                            }}
                            onClick={() => onAnnotationSelect(anno.id)}
                        >
                            {/* Corner accents for selected box */}
                            {selectedAnnotationId === anno.id && (
                                <>
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-yellow-400" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400" />
                                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-yellow-400" />
                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-yellow-400" />
                                </>
                            )}

                            {/* Hover Label */}
                            <div className={`absolute -top-8 left-0 px-2 py-1 bg-black/80 border border-cyan-500/50 text-cyan-400 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover/anno:opacity-100 transition-opacity ${selectedAnnotationId === anno.id ? 'opacity-100' : ''}`}>
                                {anno.label} ({Math.round((anno.confidence || 0) * 100)}%)
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cyberpunk Sidebar */}
            <div className="w-80 bg-slate-900/95 border-l border-slate-800 p-6 flex flex-col backdrop-blur-md">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                    <div className={`w-3 h-3 rounded-full ${isScanning ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-500'}`} />
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">AI DIAGNOSTICS</h3>
                        <p className="text-[10px] text-slate-400 font-mono">{isScanning ? 'PROCESSING NEURAL LAYERS...' : 'ANALYSIS COMPLETE'}</p>
                    </div>
                </div>

                {/* Live Log Stream */}
                <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-2 custom-scrollbar">
                    {annotations.slice(0, detectedCount).map((anno, idx) => (
                        <div
                            key={anno.id}
                            onClick={() => onAnnotationSelect(anno.id)}
                            className={`p-3 rounded border transition-all cursor-pointer animate-in slide-in-from-right-2 duration-300 ${selectedAnnotationId === anno.id
                                    ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-100'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-cyan-500/30'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold ${anno.severity === Severity.CRITICAL ? 'text-red-400' : anno.severity === Severity.HIGH ? 'text-orange-400' : 'text-cyan-400'}`}>
                                    {anno.severity === Severity.CRITICAL ? 'CRITICAL' : 'WARNING'}
                                </span>
                                <span className="text-slate-500">{Math.round((anno.confidence || 0) * 100)}%</span>
                            </div>
                            <p className="font-semibold mb-1 truncate">{anno.label}</p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Cpu className="w-3 h-3" />
                                <span>LAYER_ID: {idx + 4092}</span>
                            </div>
                        </div>
                    ))}

                    {detectedCount === 0 && isScanning && (
                        <div className="text-cyan-500/50 italic text-center mt-10">
                            Scanning sector...
                        </div>
                    )}
                </div>

                {/* Bottom Stats */}
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/50 p-2 rounded text-center">
                        <p className="text-[10px] text-slate-400 uppercase">Anomalies</p>
                        <p className="text-lg font-bold text-white">{detectedCount}</p>
                    </div>
                    <div className="bg-slate-800/50 p-2 rounded text-center">
                        <p className="text-[10px] text-slate-400 uppercase">Reliability</p>
                        <p className="text-lg font-bold text-emerald-400">98.2%</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAnalysisView;
