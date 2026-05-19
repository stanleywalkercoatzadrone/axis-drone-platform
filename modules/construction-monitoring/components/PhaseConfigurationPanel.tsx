import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, GripVertical, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import apiClient from '../../../src/services/apiClient';

export default function PhaseConfigurationPanel({ projectId, initialPhases, onSaved }) {
    const [phases, setPhases] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Clone initial phases for local state, ensure is_active is explicitly true if missing
        if (initialPhases) {
            setPhases(JSON.parse(JSON.stringify(initialPhases)).map(p => ({
                ...p,
                is_active: p.is_active !== false,
            })));
        }
    }, [initialPhases]);

    const handleAddPhase = () => {
        const newPhase = {
            id: `new-${Date.now()}`,
            name: 'New Phase',
            description: '',
            order_index: phases.length + 1,
            is_active: true
        };
        setPhases([...phases, newPhase]);
    };

    const handleRemovePhase = (id) => {
        setPhases(phases.map(p => p.id === id ? { ...p, is_active: false } : p));
    };

    const handleRestorePhase = (id) => {
        setPhases(phases.map(p => p.id === id ? { ...p, is_active: true } : p));
    };

    const handleChange = (id, field, value) => {
        setPhases(phases.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const movePhase = (index, direction) => {
        if (index + direction < 0 || index + direction >= phases.length) return;
        
        const newPhases = [...phases];
        const temp = newPhases[index];
        newPhases[index] = newPhases[index + direction];
        newPhases[index + direction] = temp;
        
        // Re-index
        newPhases.forEach((p, i) => { p.order_index = i + 1; });
        setPhases(newPhases);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        try {
            await apiClient.post(`/construction/projects/${projectId}/phases/config`, { phases });
            onSaved(); // trigger refresh in parent
        } catch (e) {
            console.error(e);
            setError('Failed to save phase configuration.');
        } finally {
            setIsSaving(false);
        }
    };

    const activePhases = phases.filter(p => p.is_active);
    const archivedPhases = phases.filter(p => !p.is_active);

    return (
        <div className="p-8 animate-fade-in bg-slate-950 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Phase Configuration</h2>
                        <p className="text-sm text-slate-400 mt-1">Customize the construction milestones and AI tracking phases for this specific project.</p>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50"
                    >
                        {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Configuration
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2 text-sm">
                        <XCircle className="w-4 h-4" /> {error}
                    </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700/50 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                            Active Phases <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs">{activePhases.length}</span>
                        </h3>
                        <button onClick={handleAddPhase} className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Add Phase
                        </button>
                    </div>
                    
                    <div className="divide-y divide-slate-800/50">
                        {activePhases.map((phase, index) => (
                            <div key={phase.id} className="p-4 flex items-start gap-4 hover:bg-slate-800/30 transition-colors group">
                                <div className="flex flex-col items-center gap-1 mt-2 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => movePhase(phases.indexOf(phase), -1)} disabled={index === 0} className="hover:text-blue-400 disabled:opacity-30">▲</button>
                                    <GripVertical className="w-4 h-4" />
                                    <button onClick={() => movePhase(phases.indexOf(phase), 1)} disabled={index === activePhases.length - 1} className="hover:text-blue-400 disabled:opacity-30">▼</button>
                                </div>
                                
                                <div className="flex-1 space-y-3">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Phase Name</label>
                                            <input 
                                                value={phase.name} 
                                                onChange={(e) => handleChange(phase.id, 'name', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Description</label>
                                        <input 
                                            value={phase.description || ''} 
                                            onChange={(e) => handleChange(phase.id, 'description', e.target.value)}
                                            placeholder="What does this phase entail?"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-6 pl-4 border-l border-slate-800">
                                    <button onClick={() => handleRemovePhase(phase.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Archive Phase">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        
                        {activePhases.length === 0 && (
                            <div className="p-12 text-center text-slate-500 text-sm">
                                No active phases. Add a phase to get started.
                            </div>
                        )}
                    </div>
                </div>

                {archivedPhases.length > 0 && (
                    <div className="mt-8">
                        <h3 className="font-bold text-slate-500 flex items-center gap-2 text-xs uppercase tracking-wider mb-4 px-2">
                            Archived Phases <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{archivedPhases.length}</span>
                        </h3>
                        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                            <div className="divide-y divide-slate-800/30">
                                {archivedPhases.map(phase => (
                                    <div key={phase.id} className="p-3 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                                        <div>
                                            <p className="text-sm font-bold text-slate-400 line-through">{phase.name}</p>
                                            <p className="text-xs text-slate-600">{phase.description}</p>
                                        </div>
                                        <button onClick={() => handleRestorePhase(phase.id)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-blue-400 transition-colors bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg">
                                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-3 px-2">Archived phases will not appear in reports or AI progression tracking, but historical data remains safely stored.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
