import React, { useState } from 'react';
import { CheckSquare, AlertTriangle, Clock, Plus, Filter, Search, User } from 'lucide-react';
import apiClient from '../../../src/services/apiClient';

export default function ActionItemManager({ projectId, actionItems = [], issues = [], phases = [], onActionItemAdded }) {
    const [showNewForm, setShowNewForm] = useState(false);
    const [newItem, setNewItem] = useState({ title: '', priority: 'Medium', owner: '', dueDate: '' });
    const [submitting, setSubmitting] = useState(false);

    const handleSaveItem = async () => {
        setSubmitting(true);
        try {
            await apiClient.post(`/construction/projects/${projectId}/action-items`, newItem);
            setShowNewForm(false);
            setNewItem({ title: '', priority: 'Medium', owner: '', dueDate: '' });
            if (onActionItemAdded) onActionItemAdded();
        } catch (error) {
            console.error('Failed to save action item', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-8 animate-fade-in text-slate-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                    <CheckSquare className="w-6 h-6 text-amber-400" />
                    Action Items
                </h2>
                <button 
                    onClick={() => setShowNewForm(!showNewForm)}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(217,119,6,0.3)] flex items-center gap-2 transition-all"
                >
                    <Plus className="w-4 h-4" /> New Action Item
                </button>
            </div>

            {showNewForm && (
                <div className="bg-slate-900/60 border border-amber-500/30 p-6 rounded-2xl mb-8 animate-fade-in shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Create Action Item</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
                            <input type="text" placeholder="e.g. Inspect trenching block 4" className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Priority</label>
                            <select className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={newItem.priority} onChange={e => setNewItem({...newItem, priority: e.target.value})}>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Assignee</label>
                            <input type="text" placeholder="Owner Name" className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={newItem.owner} onChange={e => setNewItem({...newItem, owner: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Due Date</label>
                            <input type="date" className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={newItem.dueDate} onChange={e => setNewItem({...newItem, dueDate: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowNewForm(false)} className="px-5 py-2.5 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleSaveItem} disabled={submitting} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-colors">{submitting ? 'Saving...' : 'Save Item'}</button>
                    </div>
                </div>
            )}

            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Search action items..." className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
                <button className="bg-slate-900/50 border border-slate-800 hover:border-slate-600 text-slate-300 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors">
                    <Filter className="w-4 h-4" /> Filter
                </button>
            </div>

            <div className="flex-1 bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-950/50 border-b border-slate-800/50">
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Title</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Owner</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Due Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {actionItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group cursor-pointer">
                                <td className="p-4">
                                    <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">{item.title}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                        item.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        item.priority === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                        item.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                        {item.priority === 'Critical' && <AlertTriangle className="w-3 h-3" />}
                                        {item.priority}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                        item.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        item.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                            <User className="w-3 h-3 text-slate-400" />
                                        </div>
                                        <span className="text-sm text-slate-300">{item.owner}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2 text-sm text-slate-400">
                                        <Clock className="w-4 h-4" />
                                        {item.dueDate}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
