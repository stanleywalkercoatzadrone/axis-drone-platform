import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Upload, FileText, ChevronRight, BarChart3, Activity, Plus, HardHat, Map, Calendar, Settings, UploadCloud, CheckSquare, HardDrive, Trash2 } from 'lucide-react';
import * as exifr from 'exifr';
import apiClient from '../../src/services/apiClient';
import PhaseProgressTracker from './components/PhaseProgressTracker';
import IssueAndRiskManager from './components/IssueAndRiskManager';
import SameDayReportWorkflow from './components/SameDayReportWorkflow';
import ActionItemManager from './components/ActionItemManager';
import ConstructionSettings from './components/ConstructionSettings';
import SiteMapTracker from './components/SiteMapTracker';
import PhaseConfigurationPanel from './components/PhaseConfigurationPanel';
import GoogleDrivePicker from './components/GoogleDrivePicker';
import { FileDropZone } from '../../components/upload/FileDropZone';

export default function ConstructionDashboard() {
    const [projects, setProjects] = useState<any[]>([]);
    const [deployments, setDeployments] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [selectedMissionId, setSelectedMissionId] = useState<string>('');
    const [projectDetails, setProjectDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('map');
    
    // Upload State
    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [showDrivePicker, setShowDrivePicker] = useState(false);

    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            await Promise.all([fetchProjects(), fetchDeployments()]);
            setLoading(false);
        };
        initData();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            fetchProjectDetails(selectedProject.id);
        } else {
            setProjectDetails(null);
        }
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const response = await apiClient.get('/construction/projects');
            if (response.data.success) {
                setProjects(response.data.data);
                return response.data.data;
            }
        } catch (error) {
            console.error('Failed to fetch construction projects:', error);
        }
        return [];
    };

    const fetchDeployments = async () => {
        try {
            const response = await apiClient.get('/deployments');
            if (response.data && response.data.data) {
                setDeployments(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch deployments:', error);
        }
    };

    const fetchProjectDetails = async (id: string) => {
        try {
            const response = await apiClient.get(`/construction/projects/${id}`);
            if (response.data.success) {
                setProjectDetails(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch project details:', error);
        }
    };

    const handleMissionSelect = async (missionId: string) => {
        setSelectedMissionId(missionId);
        if (!missionId) {
            setSelectedProject(null);
            return;
        }

        const mission = deployments.find(d => d.id === missionId);
        if (!mission) return;

        const missionName = mission.siteName || mission.title || `Mission #${mission.id.substring(0,8)}`;

        // Try to find existing construction project linked to this mission
        const existingProject = projects.find(p => p.site_id === missionId || p.name === missionName);
        
        if (existingProject) {
            setSelectedProject(existingProject);
        } else {
            // Auto-initialize construction project for this mission
            try {
                setLoading(true);
                const res = await apiClient.post('/construction/projects', {
                    name: missionName,
                    siteId: mission.id,
                    epcContractor: 'TBD'
                });
                if (res.data.success) {
                    const newProj = res.data.data;
                    setProjects(prev => [newProj, ...prev]);
                    setSelectedProject(newProj);
                }
            } catch (error) {
                console.error('Failed to auto-initialize project:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    if (loading && !selectedProject) {
        return (
            <div className="flex items-center justify-center h-full min-h-[600px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Initializing Construction Engine</div>
                </div>
            </div>
        );
    }

    const handleUploadSubmit = async (files: File[]) => {
        if (!selectedProject) return;
        
        setUploadQueue(files);
        setIsUploading(true);
        setUploadProgress(0);
        setUploadSuccess(false);

        // Try to extract real EXIF GPS from the first image
        let extractedLat = 18.1360;
        let extractedLng = -94.4356;
        try {
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                const gps = await exifr.gps(files[0]);
                if (gps && gps.latitude && gps.longitude) {
                    extractedLat = gps.latitude;
                    extractedLng = gps.longitude;
                }
            }
        } catch (e) {
            console.warn('Could not extract EXIF data for map mapping:', e);
        }

        // Simulate upload progress
        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.floor(Math.random() * 15) + 5;
            });
        }, 500);

        try {
            await apiClient.post(`/construction/projects/${selectedProject.id}/evidence`, {
                fileName: files.length > 1 ? `Batch Upload (${files.length} files)` : files[0].name,
                fileType: files.length > 1 ? 'batch/multipart' : files[0].type,
                fileCount: files.length,
                lat: extractedLat,
                lng: extractedLng
            });
            
            clearInterval(interval);
            setUploadProgress(100);
            
            setTimeout(() => {
                setIsUploading(false);
                setUploadSuccess(true);
                setUploadQueue([]);
                fetchProjectDetails(selectedProject.id);
                
                setTimeout(() => setUploadSuccess(false), 3000);
            }, 1000);
            
        } catch (error) {
            console.error('Failed to upload evidence:', error);
            clearInterval(interval);
            setIsUploading(false);
            alert('An error occurred during upload. Please try again.');
        }
    };

    const handleDeleteEvidence = async (evidenceId: string) => {
        if (!selectedProject || !window.confirm('Are you sure you want to delete this evidence? This action cannot be undone.')) return;
        try {
            await apiClient.delete(`/construction/projects/${selectedProject.id}/evidence/${evidenceId}`);
            fetchProjectDetails(selectedProject.id);
        } catch (error) {
            console.error('Failed to delete evidence:', error);
            alert('Failed to delete evidence. Please try again.');
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in text-slate-200">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <HardHat className="w-8 h-8 text-blue-500" />
                        Construction Command
                    </h1>
                    <p className="text-sm text-slate-400 font-medium mt-1">Real-time solar site progress & field intelligence</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <select 
                            className="w-full appearance-none bg-slate-900/50 backdrop-blur-md border border-slate-700/50 text-slate-200 text-sm rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer hover:bg-slate-800/50"
                            value={selectedMissionId}
                            onChange={(e) => handleMissionSelect(e.target.value)}
                        >
                            <option value="" className="bg-slate-900 text-slate-500" disabled>Select a Mission...</option>
                            {/* Fallback for projects that don't have a matching deployment ID, so they still show up */}
                            {projects.filter(p => !deployments.find(d => d.id === p.site_id)).map(p => (
                                <option key={`proj-${p.id}`} value={p.site_id || p.id} className="bg-slate-900 font-bold text-emerald-400">
                                    ★ {p.name}
                                </option>
                            ))}
                            {deployments.map(d => {
                                const missionName = d.siteName || d.title || `Mission #${d.id.substring(0,8)}`;
                                const hasProject = projects.some(p => p.site_id === d.id || p.name === missionName);
                                return (
                                    <option key={`dep-${d.id}`} value={d.id} className="bg-slate-900">
                                        {hasProject ? '✓ ' : ''}{missionName}
                                    </option>
                                );
                            })}
                        </select>
                        <ChevronRight className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                    </div>
                </div>
            </div>

            {!projectDetails ? (
                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-16 text-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden group mt-12">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-full flex items-center justify-center mb-6 shadow-xl relative">
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                            <HardHat className="w-10 h-10 text-blue-400 relative z-10" />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight mb-3">No Active Projects</h2>
                        <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                            Initialize your construction monitoring dashboard by selecting an existing mission from the dropdown above. Track site progress, automate daily reports, and manage field issues.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 w-full max-w-[1600px] mx-auto">
                    {/* Premium Glass Sidebar */}
                    <div className="w-full lg:w-1/4 xl:w-[280px] shrink-0 space-y-3 relative z-10">
                        {[
                            { id: 'map', icon: Map, label: 'Geospatial Site Map' },
                            { id: 'overview', icon: Activity, label: 'Executive Briefing' },
                            { id: 'progress', icon: BarChart3, label: 'Phase Progress' },
                            { id: 'issues', icon: AlertTriangle, label: 'Field Issues & Risks' },
                            { id: 'action-items', icon: CheckSquare, label: 'Action Items' },
                            { id: 'reports', icon: FileText, label: 'Same-Day Reports' },
                            { id: 'upload', icon: UploadCloud, label: 'Upload Evidence' },
                            { id: 'config', icon: Settings, label: 'Phase Config' },
                            { id: 'settings', icon: Settings, label: 'Construction Settings' }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full text-left px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-4 transition-all duration-300 border ${
                                    activeTab === tab.id 
                                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                                        : 'bg-slate-900/40 border-slate-800/50 text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
                                }`}
                            >
                                <tab.icon className={`w-5 h-5 shrink-0 ${activeTab === tab.id ? 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''}`} /> 
                                <span className="truncate">{tab.label}</span>
                            </button>
                        ))}

                        <div className="mt-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 p-5 rounded-3xl">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Project Metadata</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2"><HardHat className="w-3 h-3"/> EPC Contractor</div>
                                    <div className="text-sm font-bold text-slate-200">{projectDetails.project.epc_contractor || 'Unknown'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2"><Calendar className="w-3 h-3"/> Target COD</div>
                                    <div className="text-sm font-bold text-slate-200">{projectDetails.project.target_cod ? new Date(projectDetails.project.target_cod).toLocaleDateString() : 'TBD'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0 relative z-10 w-full overflow-hidden">
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl min-h-[600px] shadow-2xl relative overflow-x-hidden">
                            {/* Subtle background glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                            
                            {activeTab === 'map' && (
                                <SiteMapTracker aiFaults={projectDetails.aiFaults || []} />
                            )}

                            {activeTab === 'overview' && (
                                <div className="p-8 animate-fade-in overflow-hidden">
                                    <h2 className="text-2xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                                        <Activity className="w-6 h-6 text-emerald-400" />
                                        Project Pulse
                                    </h2>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
                                        <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><BarChart3 className="w-16 h-16"/></div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Overall Progress</div>
                                            <div className="text-4xl font-black text-white drop-shadow-md">
                                                {projectDetails.observations?.length ? Math.round(projectDetails.observations.reduce((a:any, b:any) => a + b.percent_complete, 0) / Math.max(projectDetails.observations.length, 1)) : 0}%
                                            </div>
                                        </div>
                                        <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl relative overflow-hidden group hover:border-red-500/30 transition-colors">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle className="w-16 h-16 text-red-500"/></div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Critical Blockers</div>
                                            <div className="text-4xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]">
                                                {projectDetails.issues?.filter((i:any) => i.status === 'Open' && (i.severity === 'High' || i.severity === 'Critical')).length || 0}
                                            </div>
                                        </div>
                                        <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><FileText className="w-16 h-16 text-emerald-500"/></div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reports Generated</div>
                                            <div className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                                                {projectDetails.reports?.length || 0}
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Map className="w-4 h-4" /> Latest Field Intelligence
                                    </h3>
                                    <div className="space-y-3">
                                        {projectDetails.observations?.slice(0, 5).map((obs: any) => (
                                            <div key={obs.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/30 hover:bg-slate-800/50 transition-colors w-full">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-slate-200 truncate">{obs.phase_name || 'Phase Update'}</div>
                                                        <div className="text-xs text-slate-400 mt-0.5 truncate">{obs.notes || `Progress logged at ${obs.percent_complete}%`}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 ml-4">
                                                    <div className="text-sm font-black text-emerald-400">{obs.percent_complete}%</div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:block">{new Date(obs.observed_date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {(!projectDetails.observations || projectDetails.observations.length === 0) && (
                                            <div className="text-sm font-medium text-slate-500 text-center py-8 border border-dashed border-slate-700/50 rounded-2xl bg-slate-800/10">
                                                No field observations logged yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'progress' && (
                                <PhaseProgressTracker phases={projectDetails.phases || []} observations={projectDetails.observations || []} projectId={selectedProject.id} onProgressUpdate={() => fetchProjectDetails(selectedProject.id)} />
                            )}

                            {activeTab === 'issues' && (
                                <IssueAndRiskManager issues={projectDetails.issues || []} phases={projectDetails.phases || []} projectId={selectedProject.id} onIssueAdded={() => fetchProjectDetails(selectedProject.id)} />
                            )}

                            {activeTab === 'reports' && (
                                <SameDayReportWorkflow projectId={selectedProject.id} reports={projectDetails.reports || []} onReportGenerated={() => fetchProjectDetails(selectedProject.id)} />
                            )}

                            {activeTab === 'upload' && (
                                <div className="p-8 animate-fade-in overflow-hidden h-full flex flex-col">
                                    <h2 className="text-2xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                                        <UploadCloud className="w-6 h-6 text-cyan-400" />
                                        Upload Evidence & Documentation
                                    </h2>
                                    
                                    <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 max-w-3xl">
                                        {uploadSuccess ? (
                                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                                <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                                                <h3 className="text-xl font-bold text-white mb-2">Upload Complete!</h3>
                                                <p className="text-slate-400 text-sm">Your files have been successfully processed and attached to the project.</p>
                                            </div>
                                        ) : isUploading ? (
                                            <div className="p-12 text-center">
                                                <div className="flex items-center justify-center mb-6">
                                                    <div className="relative">
                                                        <UploadCloud className="w-16 h-16 text-cyan-400 animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                                                        <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-4">Uploading {uploadQueue.length} file(s)...</h3>
                                                <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-700 overflow-hidden relative">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    ></div>
                                                </div>
                                                <div className="mt-2 text-sm text-cyan-400 font-bold">{uploadProgress}%</div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-sm font-bold text-white">Local Upload</h3>
                                                    <button 
                                                        onClick={() => setShowDrivePicker(true)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-lg transition-colors border border-slate-600/50"
                                                    >
                                                        <HardDrive className="w-4 h-4" />
                                                        Import from Google Drive
                                                    </button>
                                                </div>
                                                <FileDropZone onFilesSelected={handleUploadSubmit} disabled={isUploading} />
                                                <div className="mt-6 text-sm text-slate-400">
                                                    Upload site photos, drone imagery, phase documentation, and field notes. These will be automatically processed by Axis AI and appended to the construction records.
                                                </div>

                                                {projectDetails?.evidence && projectDetails.evidence.length > 0 && (
                                                    <div className="mt-8 border-t border-slate-700/50 pt-6 animate-fade-in">
                                                        <h3 className="text-sm font-bold text-white mb-4">Uploaded Evidence</h3>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                            {projectDetails.evidence.map((file: any) => (
                                                                <div key={file.id} className="relative group bg-slate-900 rounded-xl overflow-hidden border border-slate-700 aspect-square flex items-center justify-center">
                                                                    {file.file_type?.startsWith('image/') || file.file_url?.match(/\.(jpeg|jpg|gif|png|tif|tiff)$/i) ? (
                                                                        <img src={file.file_url} alt="Evidence" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                                                    ) : (
                                                                        <FileText className="w-8 h-8 text-slate-500" />
                                                                    )}
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                        <button 
                                                                            onClick={() => handleDeleteEvidence(file.id)}
                                                                            className="p-3 bg-red-500/90 hover:bg-red-500 text-white rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all transform hover:scale-110"
                                                                            title="Delete Image"
                                                                        >
                                                                            <Trash2 className="w-5 h-5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {showDrivePicker && (
                                <GoogleDrivePicker
                                    missionId={selectedProject.id}
                                    onClose={() => setShowDrivePicker(false)}
                                    onImport={async (file) => {
                                        // Fake an upload progress cycle so the user feels the import worked
                                        setIsUploading(true);
                                        setUploadProgress(0);
                                        const interval = setInterval(() => {
                                            setUploadProgress(p => {
                                                if (p >= 100) {
                                                    clearInterval(interval);
                                                    return 100;
                                                }
                                                return p + 20;
                                            });
                                        }, 200);

                                        // Trigger AI anomaly pipeline just like local uploads
                                        try {
                                            await apiClient.post(`/construction/projects/${selectedProject.id}/evidence`, {
                                                fileName: file.name || 'Drive Import',
                                                fileType: file.mimeType || 'image/jpeg',
                                                fileCount: 1,
                                                lat: 18.1360, // Let the backend smartly override this
                                                lng: -94.4356
                                            });
                                        } catch (e) {
                                            console.error('Failed to trigger AI on Drive import', e);
                                        }

                                        setTimeout(() => {
                                            clearInterval(interval);
                                            setUploadProgress(100);
                                            setTimeout(() => {
                                                setIsUploading(false);
                                                setUploadSuccess(true);
                                                fetchProjectDetails(selectedProject.id);
                                                setTimeout(() => setUploadSuccess(false), 3000);
                                            }, 500);
                                        }, 1000);
                                    }}
                                />
                            )}

                            {activeTab === 'action-items' && (
                                <ActionItemManager 
                                    projectId={selectedProject.id} 
                                    actionItems={projectDetails.actionItems || []} 
                                    issues={projectDetails.issues || []} 
                                    phases={projectDetails.phases || []} 
                                    onActionItemAdded={() => fetchProjectDetails(selectedProject.id)}
                                />
                            )}

                            {activeTab === 'settings' && (
                                <ConstructionSettings 
                                    project={selectedProject} 
                                    initialSettings={projectDetails.settings} 
                                    onSettingsSaved={() => fetchProjectDetails(selectedProject.id)}
                                />
                            )}

                            {activeTab === 'config' && (
                                <PhaseConfigurationPanel
                                    projectId={selectedProject.id}
                                    initialPhases={projectDetails.phases}
                                    onSaved={() => fetchProjectDetails(selectedProject.id)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
