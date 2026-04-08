import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    AlertTriangle,
    ArrowLeft,
    Camera,
    Send
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface PilotIssuesProps {
    missionId: string;
    onBack: () => void;
}

export const PilotIssues: React.FC<PilotIssuesProps> = ({ missionId, onBack }) => {
    const { user } = useAuth();
    const [category, setCategory] = useState('Safety');
    const [severity, setSeverity] = useState('Medium');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const categories = ['Safety', 'Access', 'Equipment', 'Weather', 'Other'];
    const severities = ['Low', 'Medium', 'High', 'Critical'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;

        setIsSubmitting(true);
        try {
            await apiClient.post(`/pilot/missions/${missionId}/issues`, {
                category,
                severity,
                description
            });
            setIsSuccess(true);
            setTimeout(() => onBack(), 2000);
        } catch (error) {
            console.error('Failed to submit issue:', error);
            alert('A network error interrupted submission. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center p-20 max-w-lg mx-auto text-center space-y-4 animate-in fade-in slide-in-from-bottom-8">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                    <Send className="text-emerald-500" size={32} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Issue Logged</h2>
                <p className="text-slate-400 text-sm">Operations has been notified immediately.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-32">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase text-rose-500 flex items-center gap-2">
                        <AlertTriangle size={24} /> Report Issue
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Real-Time Operations Incident Log</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">

                {/* Category Selection */}
                <div>
                    <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-3">
                        Incident Category
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`px-4 py-3 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all duration-200 ${category === cat
                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Severity Selection */}
                <div>
                    <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-3">
                        Severity Level
                    </label>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {severities.map(sev => (
                            <button
                                key={sev}
                                type="button"
                                onClick={() => setSeverity(sev)}
                                className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all duration-200 ${severity === sev
                                        ? sev === 'Critical' ? 'bg-red-600/20 border-red-500/50 text-red-500' :
                                            sev === 'High' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' :
                                                'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800'
                                    }`}
                            >
                                {sev}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-[10px] font-black tracking-widest uppercase text-slate-500 mb-3">
                        Detailed Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the issue, hazards, or blockers encountered..."
                        className="w-full h-40 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-200 placeholder-slate-600 resize-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all text-sm"
                        required
                    />
                </div>

                {/* Optional Photo Attachment */}
                <div>
                    <button type="button" className="w-full flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:bg-slate-800/50 transition-colors gap-3 group">
                        <Camera size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest">Attach Evidence Photo (Optional)</span>
                    </button>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isSubmitting || !description.trim()}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-[0_0_20px_rgba(225,29,72,0.3)] border border-rose-400/30 disabled:opacity-50 mt-8"
                >
                    {isSubmitting ? 'Transmitting Data...' : 'Submit Incident Report'}
                </button>
            </form>
        </div>
    );
};
