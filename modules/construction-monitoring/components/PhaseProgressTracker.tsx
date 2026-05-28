import React from 'react';
import { CheckCircle2, ChevronRight, BarChart3, TrendingUp, Sun, Zap, Shield, Grid, Box, Map, CheckSquare, HardHat, Cpu, Wrench, Mountain, ArrowDownToLine } from 'lucide-react';

export default function PhaseProgressTracker({ phases, observations, projectId, onProgressUpdate }) {
    // Map latest observation for each phase
    const getLatestProgress = (phaseId: string) => {
        const obs = observations?.filter((o:any) => o.phase_id === phaseId) || [];
        if (obs.length === 0) return 0;
        obs.sort((a:any, b:any) => new Date(b.observed_date).getTime() - new Date(a.observed_date).getTime());
        return obs[0].percent_complete;
    };

    const getPhaseIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('civil') || n.includes('grad') || n.includes('road')) return Mountain;
        if (n.includes('fenc')) return Shield;
        if (n.includes('pile')) return ArrowDownToLine;
        if (n.includes('rack')) return Grid;
        if (n.includes('module') || n.includes('panel')) return Sun;
        if (n.includes('electrical') || n.includes('cable') || n.includes('trench')) return Zap;
        if (n.includes('inverter') || n.includes('substation')) return Cpu;
        if (n.includes('test') || n.includes('commission')) return CheckSquare;
        if (n.includes('punch')) return Wrench;
        return HardHat;
    };

    // Helper for ArrowDownToDot since it's not a standard lucide icon, we'll use a standard one
    const getIconComponent = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('civil') || n.includes('grad') || n.includes('road')) return Mountain;
        if (n.includes('fenc')) return Shield;
        if (n.includes('pile')) return Box;
        if (n.includes('rack')) return Grid;
        if (n.includes('module') || n.includes('panel')) return Sun;
        if (n.includes('electrical') || n.includes('cable') || n.includes('trench')) return Zap;
        if (n.includes('inverter') || n.includes('substation')) return Cpu;
        if (n.includes('test') || n.includes('commission')) return CheckSquare;
        if (n.includes('punch')) return Wrench;
        return HardHat;
    };

    return (
        <div className="p-8 animate-fade-in">
            <h2 className="text-2xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                Phase Progression
            </h2>
            
            <div className="space-y-6">
                {phases?.map((phase: any, index: number) => {
                    const progress = getLatestProgress(phase.id);
                    const isComplete = progress === 100;
                    const IconComp = getIconComponent(phase.name);
                    
                    return (
                        <div key={phase.id} className="relative group">
                            <div className={`absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500 ${isComplete ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                            <div className="relative bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-6 transition-all hover:bg-slate-800/80">
                                <div className={`flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full border shadow-inner ${isComplete ? 'border-emerald-500/50 bg-emerald-500/10' : progress > 0 ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-700/50 bg-slate-950'}`}>
                                    <IconComp className={`w-6 h-6 ${isComplete ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : progress > 0 ? 'text-blue-400' : 'text-slate-500'}`} />
                                </div>
                                
                                <div className="flex-1 w-full">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h4 className={`text-sm font-black uppercase tracking-wider ${isComplete ? 'text-emerald-400' : progress > 0 ? 'text-blue-100' : 'text-slate-300'}`}>{phase.name}</h4>
                                            <p className="text-xs text-slate-400 mt-1">{phase.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {isComplete && <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                                            <div className={`text-xl font-black tracking-tighter ${isComplete ? 'text-emerald-400' : progress > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                                                {progress}%
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800/80 overflow-hidden relative">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ease-out relative ${
                                                isComplete ? 'bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.6)]' : 'bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.6)]'
                                            }`}
                                            style={{ width: `${progress}%` }}
                                        >
                                            {/* Micro-animation shimmer */}
                                            {progress > 0 && !isComplete && (
                                                <div className="absolute top-0 left-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {(!phases || phases.length === 0) && (
                    <div className="text-sm font-medium text-slate-500 text-center py-16 border border-dashed border-slate-700/50 rounded-3xl bg-slate-800/10 flex flex-col items-center">
                        <TrendingUp className="w-12 h-12 text-slate-700 mb-4" />
                        No construction phases have been defined for this project.
                    </div>
                )}
            </div>
        </div>
    );
}
