import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload, FileText, CheckCircle2, AlertCircle, Loader2,
    Map, Navigation, Layers, Gauge, Camera, Wind,
    RotateCcw, Info, Ruler, ChevronDown, ChevronRight
} from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface FlightParams {
    flightAltitudeM: number | null;
    flightAltitudeFt: number | null;
    flightSpeedMs: number | null;
    overlapPercent: number | null;
    gsdCm: number | null;
    cameraModel: string | null;
    droneModel: string | null;
    missionAreaAcres: number | null;
    waypointCount: number | null;
    paramsRaw: Record<string, any> | null;
    createdAt: string | null;
    updatedAt: string | null;
}

interface FlightDataUploadProps {
    deploymentId: string;
    deploymentTitle?: string;
    onParamsLoaded?: (params: FlightParams) => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export const FlightDataUpload: React.FC<FlightDataUploadProps> = ({
    deploymentId,
    deploymentTitle,
    onParamsLoaded,
}) => {
    const [kmlFiles, setKmlFiles] = useState<File[]>([]);
    const [paramsFile, setParamsFile] = useState<File | null>(null);
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [result, setResult] = useState<FlightParams | null>(null);
    const [kmlSummary, setKmlSummary] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [showRaw, setShowRaw] = useState(false);
    const [kmlDragging, setKmlDragging] = useState(false);
    const [paramsDragging, setParamsDragging] = useState(false);

    const kmlInput = useRef<HTMLInputElement>(null);
    const paramsInput = useRef<HTMLInputElement>(null);

    // Load existing flight data on mount
    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiClient.get(`/flight-data/${deploymentId}`);
                if (res.data?.data) {
                    setResult(res.data.data);
                    onParamsLoaded?.(res.data.data);
                }
            } catch { /* no data yet */ }
            finally { setLoading(false); }
        };
        load();
    }, [deploymentId]);

    const handleIngest = async () => {
        if (!kmlFiles.length && !paramsFile) return;
        setUploadState('uploading');
        setErrorMsg('');
        try {
            const fd = new FormData();
            fd.append('deploymentId', deploymentId);
            kmlFiles.forEach(f => fd.append('kml', f));
            if (paramsFile) fd.append('params', paramsFile);
            const res = await apiClient.post('/flight-data/ingest', fd, {
                headers: { 'Content-Type': undefined }
            });
            if (res.data.success) {
                // Re-fetch structured response
                const refetch = await apiClient.get(`/flight-data/${deploymentId}`);
                const params = refetch.data?.data;
                setResult(params);
                setKmlSummary(res.data.kmlSummary);
                onParamsLoaded?.(params);
                setUploadState('success');
            }
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.message || err?.message || 'Upload failed');
            setUploadState('error');
        }
    };

    const onKmlDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setKmlDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.kml'));
        if (files.length) setKmlFiles(prev => [...prev, ...files]);
    }, []);

    const onParamsDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setParamsDragging(false);
        const f = Array.from(e.dataTransfer.files)[0];
        if (f) setParamsFile(f);
    }, []);

    const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | null; sub?: string; accent?: string }> =
        ({ icon, label, value, sub, accent = 'text-cyan-400' }) => (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2">
                <div className={`${accent}`}>{icon}</div>
                <div>
                    <div className="text-white font-bold text-lg leading-tight">{value ?? <span className="text-slate-600 text-sm font-normal">—</span>}</div>
                    {sub && <div className="text-slate-500 text-[10px] mt-0.5">{sub}</div>}
                </div>
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">{label}</div>
            </div>
        );

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Map className="w-5 h-5 text-cyan-400" />
                        Flight Data Ingest
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Upload KML and flight parameter files to auto-populate mission data and AI reports
                    </p>
                </div>
                {result && (
                    <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Data Loaded
                    </span>
                )}
            </div>

            {/* If data exists — show it */}
            {result && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard
                            icon={<Navigation className="w-5 h-5" />}
                            label="Flight Altitude"
                            value={result.flightAltitudeM ? `${result.flightAltitudeM}m` : null}
                            sub={result.flightAltitudeFt ? `${result.flightAltitudeFt} ft` : undefined}
                            accent="text-cyan-400"
                        />
                        <StatCard
                            icon={<Wind className="w-5 h-5" />}
                            label="Flight Speed"
                            value={result.flightSpeedMs ? `${result.flightSpeedMs} m/s` : null}
                            sub={result.flightSpeedMs ? `${(result.flightSpeedMs * 2.237).toFixed(1)} mph` : undefined}
                            accent="text-blue-400"
                        />
                        <StatCard
                            icon={<Layers className="w-5 h-5" />}
                            label="Overlap"
                            value={result.overlapPercent ? `${result.overlapPercent}%` : null}
                            accent="text-purple-400"
                        />
                        <StatCard
                            icon={<Gauge className="w-5 h-5" />}
                            label="GSD"
                            value={result.gsdCm ? `${result.gsdCm} cm/px` : null}
                            accent="text-amber-400"
                        />
                        <StatCard
                            icon={<Camera className="w-5 h-5" />}
                            label="Camera"
                            value={result.cameraModel}
                            sub={result.droneModel ?? undefined}
                            accent="text-rose-400"
                        />
                        <StatCard
                            icon={<Ruler className="w-5 h-5" />}
                            label="Mission Area"
                            value={result.missionAreaAcres ? `${result.missionAreaAcres} ac` : null}
                            sub={result.missionAreaAcres ? `${(result.missionAreaAcres * 0.004047).toFixed(3)} km²` : undefined}
                            accent="text-green-400"
                        />
                        <StatCard
                            icon={<Map className="w-5 h-5" />}
                            label="Waypoints"
                            value={result.waypointCount ? String(result.waypointCount) : null}
                            accent="text-indigo-400"
                        />
                        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2 col-span-1">
                            <Info className="w-5 h-5 text-slate-500" />
                            <div className="text-slate-400 text-xs leading-relaxed">
                                {result.updatedAt
                                    ? `Last updated ${new Date(result.updatedAt).toLocaleDateString()}`
                                    : `Uploaded ${new Date(result.createdAt!).toLocaleDateString()}`}
                            </div>
                            <button
                                onClick={() => { setResult(null); setUploadState('idle'); }}
                                className="text-[10px] font-bold text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-all mt-auto"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Re-upload
                            </button>
                        </div>
                    </div>

                    {/* AI Reports Pre-fill notice */}
                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="text-sm font-bold text-cyan-300 mb-1">Auto-populated into AI Reports</div>
                            <div className="text-xs text-slate-400 leading-relaxed">
                                Flight altitude ({result.flightAltitudeM}m), GSD ({result.gsdCm} cm/px), and overlap ({result.overlapPercent}%) are now available in your AI report generators.
                                Open the <strong className="text-slate-300">AI Reports</strong> tab and generators will show these parameters pre-filled.
                            </div>
                        </div>
                    </div>

                    {/* Raw params collapsible */}
                    {result.paramsRaw && (
                        <div>
                            <button
                                onClick={() => setShowRaw(p => !p)}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-all font-bold"
                            >
                                {showRaw ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                Raw parameters
                            </button>
                            {showRaw && (
                                <div className="mt-2 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
                                    <pre className="text-[11px] text-slate-400 font-mono">{JSON.stringify(result.paramsRaw, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}


            {/* Upload zone — always visible */}
            <div className="space-y-4">
                {result && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Update / Append Data</span>
                        <span className="text-[10px] text-slate-600 font-normal normal-case tracking-normal">New upload will merge with existing data</span>
                    </div>
                )}
                {/* KML drop zone — multi-file */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                        KML Files <span className="text-slate-600 font-normal normal-case tracking-normal">(multiple allowed — flight path, waypoints, site boundary)</span>
                    </label>
                    <div
                        onDrop={onKmlDrop}
                        onDragOver={e => { e.preventDefault(); setKmlDragging(true); }}
                        onDragLeave={() => setKmlDragging(false)}
                        onClick={() => kmlInput.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all ${kmlFiles.length
                            ? 'border-cyan-500/40 bg-cyan-500/5'
                            : kmlDragging
                                ? 'border-cyan-500/60 bg-cyan-500/10'
                                : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                            }`}
                    >
                        {kmlFiles.length > 0 ? (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Map className="w-4 h-4 text-cyan-400" />
                                    <span className="text-sm font-bold text-white">{kmlFiles.length} KML file{kmlFiles.length > 1 ? 's' : ''} selected</span>
                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">+ Add more</span>
                                </div>
                                {kmlFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs bg-slate-800/60 rounded-lg px-3 py-1.5">
                                        <Map className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                                        <span className="font-medium text-slate-200 truncate flex-1">{f.name}</span>
                                        <span className="text-slate-600">{(f.size / 1024).toFixed(1)} KB</span>
                                        <button onClick={e => { e.stopPropagation(); setKmlFiles(p => p.filter((_, j) => j !== i)); }}
                                            className="text-slate-600 hover:text-red-400 transition-colors font-bold">×</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center">
                                <Map className="w-7 h-7 text-slate-600 mx-auto mb-1.5" />
                                <p className="text-sm text-slate-400">Drop <strong className="text-slate-300">.kml</strong> files here or click to browse</p>
                                <p className="text-[11px] text-slate-600 mt-0.5">Multiple files supported — DJI GS Pro, Litchi, Pix4D, DroneDeploy</p>
                            </div>
                        )}
                    </div>
                    <input ref={kmlInput} type="file" accept=".kml" multiple className="hidden"
                        onChange={e => { if (e.target.files) setKmlFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
                </div>

                {/* Params drop zone */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                        Flight Parameters File <span className="text-slate-600 font-normal normal-case tracking-normal">(altitude, speed, overlap, GSD, camera)</span>
                    </label>
                    <div
                        onDrop={onParamsDrop}
                        onDragOver={e => { e.preventDefault(); setParamsDragging(true); }}
                        onDragLeave={() => setParamsDragging(false)}
                        onClick={() => paramsInput.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${paramsFile
                            ? 'border-purple-500/40 bg-purple-500/5'
                            : paramsDragging
                                ? 'border-purple-500/60 bg-purple-500/10'
                                : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                            }`}
                    >
                        {paramsFile ? (
                            <div className="flex items-center justify-center gap-3">
                                <FileText className="w-5 h-5 text-purple-400" />
                                <div className="text-left">
                                    <div className="text-sm font-bold text-white">{paramsFile.name}</div>
                                    <div className="text-xs text-slate-400">{(paramsFile.size / 1024).toFixed(1)} KB — Click to replace</div>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto" />
                            </div>
                        ) : (
                            <div>
                                <FileText className="w-7 h-7 text-slate-600 mx-auto mb-1.5" />
                                <p className="text-sm text-slate-400">Drop <strong className="text-slate-300">.pdf / .docx / .doc / .json / .csv / .txt</strong></p>
                                <p className="text-[11px] text-slate-600 mt-0.5">Text extracted from PDF and Word docs automatically</p>
                            </div>
                        )}
                    </div>
                    <input ref={paramsInput} type="file" accept=".json,.csv,.txt,.parameters,.pdf,.doc,.docx" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) setParamsFile(e.target.files[0]); }} />
                </div>

                {/* Format hint */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Accepted parameter formats</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-slate-500">
                        <div>
                            <div className="font-bold text-slate-400 mb-1">PDF / DOCX</div>
                            <div className="text-slate-500">Text auto-extracted from flight plan docs</div>
                        </div>
                        <div>
                            <div className="font-bold text-slate-400 mb-1">JSON</div>
                            <code className="block text-[10px] bg-slate-900 rounded p-1.5 text-cyan-400">{`{"altitude":120,"gsd":2.4}`}</code>
                        </div>
                        <div>
                            <div className="font-bold text-slate-400 mb-1">CSV</div>
                            <code className="block text-[10px] bg-slate-900 rounded p-1.5 text-green-400">altitude,speed,overlap{'\n'}120,8,80</code>
                        </div>
                        <div>
                            <div className="font-bold text-slate-400 mb-1">TXT</div>
                            <code className="block text-[10px] bg-slate-900 rounded p-1.5 text-purple-400">Altitude=120m{'\n'}Camera=Zenmuse X7</code>
                        </div>
                    </div>
                </div>

                {/* Upload button */}
                <button
                    onClick={handleIngest}
                    disabled={(!kmlFiles.length && !paramsFile) || uploadState === 'uploading'}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${(!kmlFiles.length && !paramsFile)
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : uploadState === 'uploading'
                            ? 'bg-cyan-600 text-white cursor-wait'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        }`}
                >
                    {uploadState === 'uploading' ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Parsing & saving...</>
                    ) : (
                        <><Upload className="w-4 h-4" /> Parse & Apply to Mission</>
                    )}
                </button>

                {uploadState === 'error' && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {errorMsg}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlightDataUpload;
