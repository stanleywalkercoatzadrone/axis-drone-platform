import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import apiClient from '../../../src/services/apiClient';

interface MissionFormData {
    mission_name: string; site: string; project_id: string;
    kml_url: string; flight_date: string; assigned_pilot_id: string;
}
interface Pilot { id: string; full_name: string; }
interface Project { id: string; project_name: string; }

const EMPTY: MissionFormData = {
    mission_name: '', site: '', project_id: '', kml_url: '', flight_date: '', assigned_pilot_id: '',
};

const MissionCreator: React.FC = () => {
    const [form, setForm] = useState<MissionFormData>(EMPTY);
    const [pilots, setPilots] = useState<Pilot[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([
            apiClient.get('/personnel?role=pilot_technician').catch(() => ({ data: { data: [] } })),
            apiClient.get('/client/projects').catch(() => ({ data: { data: [] } })),
        ]).then(([p, pr]) => {
            setPilots(p.data.data ?? []);
            setProjects(pr.data.data ?? []);
        });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.mission_name || !form.site) { setError('Mission name and site are required.'); return; }
        setStatus('loading'); setError('');
        try {
            await apiClient.post('/missions/create', form);
            setStatus('success');
            setForm(EMPTY);
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to create mission');
            setStatus('error');
        }
    };

    const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 transition-colors";
    const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5";

    return (
        <div className="p-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Mission Creator</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Admin — Create New Mission</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-8 space-y-5">
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>Mission Name *</label>
                        <input name="mission_name" value={form.mission_name} onChange={handleChange}
                            placeholder="e.g. Block A Thermal Scan" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Site *</label>
                        <input name="site" value={form.site} onChange={handleChange}
                            placeholder="e.g. Riverstart Solar, Indiana" className={inputCls} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>Flight Date</label>
                        <input type="date" name="flight_date" value={form.flight_date}
                            onChange={handleChange} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>KML URL</label>
                        <input name="kml_url" value={form.kml_url} onChange={handleChange}
                            placeholder="https://..." className={inputCls} />
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Project</label>
                    <select name="project_id" value={form.project_id} onChange={handleChange} className={inputCls}>
                        <option value="">— Select project —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Assign Pilot</label>
                    <select name="assigned_pilot_id" value={form.assigned_pilot_id} onChange={handleChange} className={inputCls}>
                        <option value="">— Unassigned —</option>
                        {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        <AlertTriangle size={14} />{error}
                    </div>
                )}
                {status === 'success' && (
                    <div className="flex items-center gap-2 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
                        <CheckCircle size={14} />Mission created successfully!
                    </div>
                )}
                <button type="submit" disabled={status === 'loading'}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500
                               text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all
                               disabled:opacity-50 disabled:cursor-not-allowed">
                    {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {status === 'loading' ? 'Creating…' : 'Create Mission'}
                </button>
            </form>
        </div>
    );
};

export default MissionCreator;
