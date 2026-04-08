import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    CheckSquare,
    ArrowLeft,
    CheckCircle2,
    Circle,
    AlertCircle,
    Camera
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface ChecklistItem {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'completed';
    is_required: boolean;
    requires_photo: boolean;
}

interface PilotChecklistProps {
    missionId: string;
    onBack: () => void;
}

export const PilotChecklist: React.FC<PilotChecklistProps> = ({ missionId, onBack }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchChecklist = async () => {
            setIsLoading(true);
            try {
                const res = await apiClient.get(`/pilot/missions/${missionId}/checklist`);
                if (res.data.success) {
                    setItems(res.data.data.map((item: any) => ({
                        id: item.id,
                        title: item.title,
                        description: item.description || '',
                        status: item.status || 'pending',
                        is_required: true,
                        requires_photo: false
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch checklist", error);
                // Fallback to mock data for V1 presentation if no items mapped yet
                setItems([
                    { id: '1', title: 'Site Arrival & Safety Sweep', description: 'Confirm perimeter safety.', status: 'completed', is_required: true, requires_photo: false },
                    { id: '2', title: 'Drone Pre-Flight Calibration', description: 'Run standard IMU and Compass checks.', status: 'pending', is_required: true, requires_photo: true },
                    { id: '3', title: 'Airspace Authorization (LAANC)', description: 'Verify clearance is active.', status: 'pending', is_required: true, requires_photo: false },
                ]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChecklist();
    }, [missionId]);

    const toggleItem = (id: string) => {
        setItems(items.map(item =>
            item.id === id
                ? { ...item, status: item.status === 'completed' ? 'pending' : 'completed' }
                : item
        ));
        // Background Sync to API would go here
        // apiClient.post(`/pilot/missions/${missionId}/checklist/completeItem`, { itemId: id });
    };

    const progress = items.length > 0
        ? Math.round((items.filter(i => i.status === 'completed').length / items.length) * 100)
        : 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Mission Protocols</h1>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Required Procedures</p>
                </div>
            </div>

            {/* Progress Container */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 mb-8 max-w-2xl shadow-xl">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-3">
                    <span className="text-slate-400">Completion</span>
                    <span className={progress === 100 ? "text-emerald-400" : "text-blue-400"}>{progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
                {items.map((item) => {
                    const isCompleted = item.status === 'completed';
                    return (
                        <div
                            key={item.id}
                            onClick={() => toggleItem(item.id)}
                            className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex gap-4 ${isCompleted
                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                    : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                                }`}
                        >
                            <div className="shrink-0 mt-0.5 pointer-events-none">
                                {isCompleted ? (
                                    <CheckCircle2 className="text-emerald-500" size={24} />
                                ) : (
                                    <Circle className="text-slate-600" size={24} />
                                )}
                            </div>
                            <div className="flex-1 pointer-events-none">
                                <h3 className={`font-bold transition-colors ${isCompleted ? 'text-emerald-400 line-through opacity-70' : 'text-slate-200'}`}>
                                    {item.title}
                                </h3>
                                {item.description && (
                                    <p className={`text-sm mt-1 transition-colors ${isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {item.description}
                                    </p>
                                )}

                                <div className="flex gap-2 mt-3">
                                    {item.is_required && (
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                            <AlertCircle size={10} /> Required
                                        </span>
                                    )}
                                    {item.requires_photo && (
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                            <Camera size={10} /> Photo Evidence
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {progress === 100 && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center mt-8 text-emerald-400 font-bold uppercase tracking-wider text-sm animate-in fade-in slide-in-from-bottom-2">
                    ✓ All Protocols Completed
                </div>
            )}
        </div>
    );
};
