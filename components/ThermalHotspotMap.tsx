/**
 * ThermalHotspotMap.tsx — Phase 7 frontend
 * Displays AI-detected thermal faults with severity badges + upload trigger.
 * Reads from GET /api/faults?deploymentId=:id (already live).
 * Uploads to POST /api/thermal/detect/:deploymentId (already live).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../src/services/apiClient';
import {
    Thermometer, AlertTriangle, Upload, RefreshCw, Flame,
    MapPin, CheckCircle2, Camera, Loader2
} from 'lucide-react';

interface Fault {
    id: string;
    fault_type: string;
    temperature_delta?: number;
    severity?: string;
    coordinates?: { lat?: number; lng?: number; x?: number; y?: number };
    block_id?: string;
    block_name?: string;
    status?: string;
    created_at?: string;
}

interface Props {
    deploymentId: string;
}

const SEVERITY_STYLE: Record<string, { bg: string; border: string; text: string; badge: string; icon: string }> = {
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/40', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300 border-red-500/30', icon: '🔴' },
    moderate: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: '🟠' },
    minor: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '🟡' },
    default: { bg: 'bg-slate-800', border: 'border-slate-700', text: 'text-slate-400', badge: 'bg-slate-700 text-slate-400 border-slate-600', icon: '⚪' },
};

function getSeverity(fault: Fault): string {
    if (fault.severity) return fault.severity.toLowerCase();
    const delta = fault.temperature_delta ?? 0;
    if (delta > 20) return 'critical';
    if (delta >= 10) return 'moderate';
    return 'minor';
}

export const ThermalHotspotMap: React.FC<Props> = ({ deploymentId }) => {
    const [faults, setFaults] = useState<Fault[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const fetchFaults = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/faults?deploymentId=${deploymentId}`);
            setFaults(res.data.data || res.data || []);
        } catch { setFaults([]); }
        finally { setLoading(false); }
    }, [deploymentId]);

    useEffect(() => { fetchFaults(); }, [fetchFaults]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadMsg(null);
        try {
            const fd = new FormData();
            fd.append('image', file);
            await apiClient.post(`/thermal/detect/${deploymentId}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadMsg({ type: 'success', text: 'Thermal image analyzed — faults logged below.' });
            await fetchFaults();
        } catch (e: any) {
            setUploadMsg({ type: 'error', text: e?.response?.data?.message || 'Analysis failed. Check image format.' });
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const critical = faults.filter(f => getSeverity(f) === 'critical').length;
    const moderate = faults.filter(f => getSeverity(f) === 'moderate').length;
    const minor = faults.filter(f => getSeverity(f) === 'minor').length;

    return (
        <div className="p-4 space-y-5">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                    {[
                        { label: 'Critical', count: critical, cls: 'text-red-400' },
                        { label: 'Moderate', count: moderate, cls: 'text-orange-400' },
                        { label: 'Minor', count: minor, cls: 'text-amber-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-center min-w-[80px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</p>
                            <p className={`text-2xl font-black ${s.cls}`}>{s.count}</p>
                        </div>
                    ))}
                </div>

                {/* Upload button */}
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${uploading
                        ? 'bg-slate-700 text-slate-400 cursor-wait'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}>
                    {uploading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                        : <><Upload className="w-4 h-4" /> Upload Thermal Image</>
                    }
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,.tiff,.tif"
                        className="hidden"
                        disabled={uploading}
                        onChange={handleUpload}
                    />
                </label>
            </div>

            {/* Upload result message */}
            {uploadMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${uploadMsg.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                    }`}>
                    {uploadMsg.type === 'success'
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    }
                    {uploadMsg.text}
                </div>
            )}

            {/* Info box */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg px-4 py-3 text-xs text-slate-400 flex items-start gap-2">
                <Thermometer className="w-4 h-4 flex-shrink-0 text-orange-400 mt-0.5" />
                <span>Upload thermal imagery from drone flights. AI will detect hotspots, measure temperature delta vs. surrounding cells, and classify severity: <strong className="text-amber-400">Minor</strong> (&lt;10°C), <strong className="text-orange-400">Moderate</strong> (10–20°C), <strong className="text-red-400">Critical</strong> (&gt;20°C).</span>
            </div>

            {/* Fault list */}
            {loading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading faults...
                </div>
            ) : faults.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                    <Flame className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    No thermal faults detected yet.<br />
                    <span className="text-xs text-slate-600">Upload thermal images to begin AI detection.</span>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Detected Faults ({faults.length})
                    </p>
                    {faults.map((fault, i) => {
                        const sev = getSeverity(fault);
                        const style = SEVERITY_STYLE[sev] || SEVERITY_STYLE.default;
                        const delta = fault.temperature_delta;

                        return (
                            <div
                                key={fault.id}
                                className={`${style.bg} border ${style.border} rounded-xl p-4 flex items-start gap-4`}
                            >
                                {/* Severity icon */}
                                <div className="text-xl flex-shrink-0 mt-0.5">{style.icon}</div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        <span className="text-sm font-bold text-slate-100 capitalize">
                                            {(fault.fault_type || 'Unknown fault').replace(/_/g, ' ')}
                                        </span>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${style.badge}`}>
                                            {sev}
                                        </span>
                                        {fault.block_name && (
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />{fault.block_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                                        {delta != null && (
                                            <span className={`font-bold ${style.text}`}>
                                                ΔT {delta > 0 ? '+' : ''}{delta.toFixed(1)}°C
                                            </span>
                                        )}
                                        {fault.created_at && (
                                            <span>{new Date(fault.created_at).toLocaleString()}</span>
                                        )}
                                        {fault.status && (
                                            <span className="capitalize">{fault.status.replace(/_/g, ' ')}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ThermalHotspotMap;
