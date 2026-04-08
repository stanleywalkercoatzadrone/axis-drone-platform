import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../stitch/components/Card';
import { Button } from '../../../../stitch/components/Button';
import { Heading, Text } from '../../../../stitch/components/Typography';
import { AlertTriangle, AlertOctagon } from 'lucide-react';
import apiClient from '../../../services/apiClient';

export default function PilotIssuesV2() {
    const { id: missionId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ category: 'Hardware', severity: 'Low', description: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await apiClient.post(`/pilot/missions/${missionId}/issues`, formData);
            alert('Incident Report successfully transmitted to Command.');
            navigate('/pilot/dashboard');
        } catch (error) {
            console.error(error);
            alert('Failed to transmit. Report queued offline.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-6 mb-6">
                <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 flex items-center justify-center rounded-xl">
                    <AlertOctagon size={24} className="text-rose-500 animate-pulse" />
                </div>
                <div>
                    <Heading level={2} className="text-2xl font-black text-rose-500 tracking-tight uppercase">
                        Incident Report
                    </Heading>
                    <Text variant="small" className="text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Aeronautical & Operations
                    </Text>
                </div>
            </div>

            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest font-black text-slate-500">Incident Category</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-mono focus:border-rose-500/50 outline-none"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option>Hardware / Equipment</option>
                                <option>Airspace Violation / ATC</option>
                                <option>Weather Grounding</option>
                                <option>Client Interference</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest font-black text-slate-500">Severity Level</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['Low', 'Medium', 'Critical'].map(level => (
                                    <button
                                        type="button"
                                        key={level}
                                        onClick={() => setFormData({ ...formData, severity: level })}
                                        className={`py-3 px-4 rounded-xl border font-black uppercase text-xs tracking-wider transition-all
                                                ${formData.severity === level
                                                ? level === 'Critical' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-blue-500/20 border-blue-500 text-blue-400'
                                                : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest font-black text-slate-500">Log Details</label>
                            <textarea
                                required
                                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 font-mono focus:border-rose-500/50 outline-none resize-none"
                                placeholder="Describe exact conditions and asset identifiers..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full h-14 text-sm bg-rose-600 hover:bg-rose-500 flex items-center gap-3"
                            isLoading={submitting}
                        >
                            <AlertTriangle size={18} />
                            TRANSMIT REPORT TO COMMAND
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
