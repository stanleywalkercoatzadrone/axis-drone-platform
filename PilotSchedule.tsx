import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface AvailabilityBlock {
    id?: string;
    start_time: string;
    end_time: string;
    type: 'AVAILABLE' | 'BLACKOUT' | 'WORKING_HOURS';
    description?: string;
}

interface PilotScheduleProps {
    pilotId: string;
}

const PilotSchedule: React.FC<PilotScheduleProps> = ({ pilotId }) => {
    const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newBlock, setNewBlock] = useState<Partial<AvailabilityBlock>>({
        type: 'BLACKOUT',
        start_time: new Date().toISOString().slice(0, 16),
        end_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16)
    });

    useEffect(() => {
        if (pilotId) {
            fetchAvailability();
        }
    }, [pilotId]);

    const fetchAvailability = async () => {
        try {
            const response = await apiClient.get(`/api/personnel/${pilotId}/availability`);
            if (response.data.success) {
                setAvailability(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch availability:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddBlock = async () => {
        try {
            const response = await apiClient.post(`/api/personnel/${pilotId}/availability`, {
                availabilityBlocks: [newBlock]
            });
            if (response.data.success) {
                setShowAddModal(false);
                fetchAvailability();
            }
        } catch (error) {
            console.error('Failed to add availability block:', error);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'BLACKOUT': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'WORKING_HOURS': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading schedule...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Pilot Availability</h3>
                    <p className="text-sm text-slate-500 text-sm">Manage blackout dates and working hours.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Block
                </button>
            </div>

            <div className="grid gap-4">
                {availability.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No schedule blocks defined.</p>
                        <p className="text-slate-400 text-sm">Add blackout dates to prevent mission conflicts.</p>
                    </div>
                ) : (
                    availability.map((block) => (
                        <div
                            key={block.id}
                            className={`p-4 rounded-xl border flex items-center justify-between ${getTypeColor(block.type)} transition-all hover:shadow-md`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/50 rounded-lg shadow-sm">
                                    {block.type === 'BLACKOUT' ? <AlertTriangle className="w-5 h-5 text-rose-600" /> : <Clock className="w-5 h-5 text-emerald-600" />}
                                </div>
                                <div>
                                    <div className="font-bold flex items-center gap-2">
                                        {block.type.replace('_', ' ')}
                                        {block.description && (
                                            <span className="text-xs font-normal opacity-70">— {block.description}</span>
                                        )}
                                    </div>
                                    <div className="text-xs font-medium opacity-80 mt-1">
                                        {new Date(block.start_time).toLocaleString()} to {new Date(block.end_time).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <button className="p-2 hover:bg-white/50 rounded-lg transition-colors text-slate-400 hover:text-rose-600">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Add Block Modal Stub */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Add Schedule Block</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Block Type</label>
                                <select
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                                    value={newBlock.type}
                                    onChange={e => setNewBlock({ ...newBlock, type: e.target.value as any })}
                                >
                                    <option value="BLACKOUT">Blackout (Busy)</option>
                                    <option value="WORKING_HOURS">Regular Working Hours</option>
                                    <option value="AVAILABLE">Extra Availability</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={newBlock.start_time}
                                        onChange={e => setNewBlock({ ...newBlock, start_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Time</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={newBlock.end_time}
                                        onChange={e => setNewBlock({ ...newBlock, end_time: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description / Reason</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Vacation, Maintenance..."
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                    value={newBlock.description || ''}
                                    onChange={e => setNewBlock({ ...newBlock, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors font-semibold text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddBlock}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold text-sm shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                                Save Block
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PilotSchedule;
