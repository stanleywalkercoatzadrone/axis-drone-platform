import React, { useState } from 'react';
import { AlertTriangle, Plus, CheckCircle2, AlertOctagon, Info, Flame } from 'lucide-react';
import apiClient from '../../../src/services/apiClient';

export default function IssueAndRiskManager({ issues, phases, projectId, onIssueAdded }) {
    const [showModal, setShowModal] = useState(false);
    const [newIssue, setNewIssue] = useState({ title: '', description: '', severity: 'Medium', phaseId: '' });
    const [submitting, setSubmitting] = useState(false);

    const handleAddIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await apiClient.post(`/construction/projects/${projectId}/issues`, newIssue);
            setShowModal(false);
            setNewIssue({ title: '', description: '', severity: 'Medium', phaseId: '' });
            onIssueAdded();
        } catch (error) {
            console.error('Failed to report issue', error);
        } finally {
            setSubmitting(false);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'Critical': return <AlertOctagon className="w-4 h-4 text-red-500" />;
            case 'High': return <Flame className="w-4 h-4 text-orange-500" />;
            case 'Medium': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'Critical': return 'bg-red-500/10 text-red-400 border-red-500/30 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]';
            case 'High': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
            case 'Medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            default: return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
        }
    };

    return (
        <div className="p-8 animate-fade-in relative">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    Field Issues & Risks
                </h2>
                <button 
                    onClick={() => setShowModal(true)} 
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_25px_rgba(239,68,68,0.3)]"
                >
                    <Plus className="w-4 h-4" /> Report Issue
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {issues?.map((issue: any) => (
                    <div key={issue.id} className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl shadow-xl hover:bg-slate-800/60 transition-all flex flex-col group relative overflow-hidden">
                        {/* Status bar */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${issue.status === 'Open' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-emerald-500'}`}></div>
                        
                        <div className="flex justify-between items-start mb-3">
                            <h4 className="text-base font-black text-white leading-snug pr-4">{issue.title}</h4>
                            <div className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border flex items-center gap-1.5 shrink-0 ${getSeverityStyles(issue.severity)}`}>
                                {getSeverityIcon(issue.severity)}
                                {issue.severity}
                            </div>
                        </div>
                        
                        <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">{issue.description}</p>
                        
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Logged: {new Date(issue.reported_date).toLocaleDateString()}
                            </div>
                            <div className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                                issue.status === 'Open' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}>
                                {issue.status}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {(!issues || issues.length === 0) && (
                <div className="bg-slate-900/40 border border-emerald-500/20 p-12 rounded-3xl text-center shadow-[0_0_30px_rgba(52,211,153,0.05)]">
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full"></div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 relative z-10 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                    </div>
                    <h3 className="text-xl font-black text-emerald-400 tracking-tight mb-2">No Open Issues</h3>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto">The project is running smoothly. There are no reported issues or field risks currently blocking progress.</p>
                </div>
            )}

            {/* Premium Create Issue Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700/60 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
                        <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            Log Field Issue
                        </h3>
                        
                        <form onSubmit={handleAddIssue} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Issue Title</label>
                                <input required type="text" placeholder="Brief summary of the blocker..." className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder:text-slate-600" value={newIssue.title} onChange={e => setNewIssue({...newIssue, title: e.target.value})} />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Related Phase</label>
                                    <select className="w-full appearance-none bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all cursor-pointer" value={newIssue.phaseId} onChange={e => setNewIssue({...newIssue, phaseId: e.target.value})}>
                                        <option value="" className="bg-slate-900">General (No Phase)</option>
                                        {phases?.map((p: any) => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Severity Level</label>
                                    <select className="w-full appearance-none bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all cursor-pointer" value={newIssue.severity} onChange={e => setNewIssue({...newIssue, severity: e.target.value})}>
                                        <option value="Low" className="bg-slate-900">Low</option>
                                        <option value="Medium" className="bg-slate-900">Medium</option>
                                        <option value="High" className="bg-slate-900">High</option>
                                        <option value="Critical" className="bg-slate-900 text-red-500">Critical</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Detailed Description</label>
                                <textarea required rows={4} placeholder="Describe the impact on the timeline and any immediate actions required..." className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder:text-slate-600 resize-none" value={newIssue.description} onChange={e => setNewIssue({...newIssue, description: e.target.value})}></textarea>
                            </div>
                            
                            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-800/50">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors disabled:opacity-50" disabled={submitting}>Cancel</button>
                                <button type="submit" className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2" disabled={submitting}>
                                    {submitting ? 'Submitting...' : 'Log Issue'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
