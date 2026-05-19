import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Rectangle, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Target, AlertTriangle, ShieldAlert, AlertCircle, Info, MapPin, Layers, Plus, CheckCircle2, Crosshair, BoxSelect, Maximize2, Minimize2 } from 'lucide-react';

// Custom Map Panner
const MapController = ({ selectedLocation }: { selectedLocation: { lat: number, lng: number } | null }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedLocation) {
            map.flyTo([selectedLocation.lat, selectedLocation.lng], 19, { duration: 1.5 });
        }
    }, [selectedLocation, map]);
    return null;
};

// Map Click Handler for Drop Pin Mode
const MapEvents = ({ onMapClick, isDropMode }: { onMapClick: (latlng: any) => void, isDropMode: boolean }) => {
    useMapEvents({
        click(e) {
            if (isDropMode) {
                onMapClick(e.latlng);
            }
        }
    });
    return null;
};

// Glowing Icons
const createGlowingIcon = (severity: string, isManual: boolean = false) => {
    let colorClass = 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)]';
    if (severity.toLowerCase() === 'critical') colorClass = 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)]';
    if (severity.toLowerCase() === 'high') colorClass = 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.9)]';
    if (isManual) colorClass = 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.9)]'; // Manual pins are cyan

    return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="relative w-6 h-6 flex items-center justify-center">
                 <div class="absolute inset-0 ${colorClass} rounded-full animate-ping opacity-75"></div>
                 <div class="relative w-3 h-3 ${colorClass} rounded-full border border-white"></div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

interface SiteMapTrackerProps {
    aiFaults: any[];
}

export default function SiteMapTracker({ aiFaults }: SiteMapTrackerProps) {
    const [selectedFault, setSelectedFault] = useState<any | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([38.8951, -77.0364]);
    
    // Layers State
    const [showDroneOverlay, setShowDroneOverlay] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // Drop Pin State
    const [isDropMode, setIsDropMode] = useState(false);
    const [manualPins, setManualPins] = useState<any[]>([]);
    const [newPinLoc, setNewPinLoc] = useState<any | null>(null);
    const [newPinForm, setNewPinForm] = useState({ title: '', severity: 'Medium', desc: '' });

    const geolocatedFaults = [...aiFaults.filter(f => f.geolocation && f.geolocation.lat && f.geolocation.lng), ...manualPins];

    useEffect(() => {
        if (geolocatedFaults.length > 0 && !selectedFault && !newPinLoc) {
            setMapCenter([geolocatedFaults[0].geolocation.lat, geolocatedFaults[0].geolocation.lng]);
        }
    }, [geolocatedFaults]);

    const getSeverityIcon = (severity: string, isManual: boolean = false) => {
        if (isManual) return <MapPin className="w-4 h-4 text-cyan-500" />;
        if (severity.toLowerCase() === 'critical') return <ShieldAlert className="w-4 h-4 text-red-500" />;
        if (severity.toLowerCase() === 'high') return <AlertTriangle className="w-4 h-4 text-orange-500" />;
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    };

    const handleMapClick = (latlng: any) => {
        setNewPinLoc(latlng);
        setSelectedFault(null);
    };

    const saveManualPin = () => {
        if (!newPinLoc || !newPinForm.title) return;
        
        const newPin = {
            label: newPinForm.title,
            severity: newPinForm.severity,
            description: newPinForm.desc,
            geolocation: { lat: newPinLoc.lat, lng: newPinLoc.lng },
            isManual: true
        };
        
        setManualPins([newPin, ...manualPins]);
        setNewPinLoc(null);
        setNewPinForm({ title: '', severity: 'Medium', desc: '' });
        setIsDropMode(false);
    };

    // Calculate Heatmap grids based on mapCenter
    const heatmapBounds = [
        [[mapCenter[0] + 0.001, mapCenter[1] - 0.001], [mapCenter[0] + 0.002, mapCenter[1]]], // Zone 1
        [[mapCenter[0], mapCenter[1] - 0.001], [mapCenter[0] + 0.001, mapCenter[1]]], // Zone 2
        [[mapCenter[0], mapCenter[1]], [mapCenter[0] + 0.001, mapCenter[1] + 0.001]], // Zone 3
    ];

    const droneBounds: [number, number][] = [
        [mapCenter[0] - 0.002, mapCenter[1] - 0.002],
        [mapCenter[0] + 0.003, mapCenter[1] + 0.002]
    ];

    return (
        <div className={`flex flex-col lg:flex-row bg-slate-950 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-fade-in relative transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[999] rounded-none' : 'h-[750px] rounded-3xl'}`}>
            
            {/* Left Sidebar: Spatial Command Center */}
            <div className="w-full lg:w-[380px] bg-slate-900/95 backdrop-blur-2xl border-r border-slate-800 flex flex-col z-10 shrink-0">
                <div className="p-6 border-b border-slate-800/80 bg-slate-900 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Target className="w-24 h-24"/></div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 relative z-10">
                        <Crosshair className="w-5 h-5 text-blue-500" />
                        Spatial Punch List
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 relative z-10">{geolocatedFaults.length} georeferenced issues tracked</p>
                    
                    <button 
                        onClick={() => { setIsDropMode(!isDropMode); setNewPinLoc(null); }}
                        className={`mt-4 w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                            isDropMode 
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                    >
                        {isDropMode ? <Crosshair className="w-4 h-4 animate-spin-slow" /> : <Plus className="w-4 h-4" />}
                        {isDropMode ? 'Select Location on Map...' : 'Drop Manual Pin'}
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {/* New Pin Form */}
                    {newPinLoc && (
                        <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4 animate-in slide-in-from-left-4">
                            <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> New Field Issue
                            </h4>
                            <input 
                                type="text" placeholder="Issue Title..." 
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mb-2 outline-none focus:border-cyan-500"
                                value={newPinForm.title} onChange={e => setNewPinForm({...newPinForm, title: e.target.value})}
                            />
                            <select 
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 mb-2 outline-none focus:border-cyan-500"
                                value={newPinForm.severity} onChange={e => setNewPinForm({...newPinForm, severity: e.target.value})}
                            >
                                <option value="Critical">Critical Severity</option>
                                <option value="High">High Severity</option>
                                <option value="Medium">Medium Severity</option>
                                <option value="Low">Low Severity</option>
                            </select>
                            <textarea 
                                placeholder="Description or repair instructions..." 
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mb-3 outline-none focus:border-cyan-500 resize-none h-20"
                                value={newPinForm.desc} onChange={e => setNewPinForm({...newPinForm, desc: e.target.value})}
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setNewPinLoc(null)} className="flex-1 py-2 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors">Cancel</button>
                                <button onClick={saveManualPin} className="flex-1 py-2 bg-cyan-600 text-white text-xs font-bold rounded-lg hover:bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all">Save Pin</button>
                            </div>
                        </div>
                    )}

                    {!newPinLoc && geolocatedFaults.length === 0 ? (
                        <div className="text-center p-8 border border-dashed border-slate-700/50 rounded-xl bg-slate-800/30">
                            <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">No spatial faults detected.</p>
                        </div>
                    ) : (
                        geolocatedFaults.map((fault, idx) => {
                            const isSelected = selectedFault === fault;
                            let borderClass = 'border-slate-700/50 hover:border-slate-600';
                            if (isSelected) {
                                if (fault.isManual) borderClass = 'border-cyan-500/50 bg-cyan-500/10';
                                else if (fault.severity.toLowerCase() === 'critical') borderClass = 'border-red-500/50 bg-red-500/10';
                                else if (fault.severity.toLowerCase() === 'high') borderClass = 'border-orange-500/50 bg-orange-500/10';
                                else borderClass = 'border-yellow-500/50 bg-yellow-500/10';
                            }

                            return (
                                <button 
                                    key={idx}
                                    onClick={() => setSelectedFault(fault)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${borderClass} ${!isSelected ? 'bg-slate-800/40 hover:bg-slate-800/80' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {getSeverityIcon(fault.severity, fault.isManual)}
                                            <span className="text-sm font-bold text-slate-200">{fault.label || 'Detected Issue'}</span>
                                        </div>
                                        {fault.isManual && (
                                            <span className="text-[9px] font-black uppercase tracking-wider bg-slate-700 text-slate-300 px-2 py-0.5 rounded ml-2">Manual</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                        {fault.description}
                                    </p>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Area: Geospatial Map */}
            <div className={`flex-1 relative bg-slate-950 z-0 ${isDropMode ? 'cursor-crosshair' : ''}`}>
                <MapContainer 
                    center={mapCenter} 
                    zoom={18} 
                    className="w-full h-full"
                    zoomControl={false}
                >
                    {/* Fullscreen Toggle */}
                    <div className="absolute top-6 left-6 z-[400]">
                        <button 
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="bg-slate-900/80 backdrop-blur-xl p-3 rounded-xl border border-slate-700/50 shadow-2xl hover:bg-slate-800 transition-colors flex items-center justify-center group"
                            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                        >
                            {isFullscreen ? <Minimize2 className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" /> : <Maximize2 className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" />}
                        </button>
                    </div>

                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="&copy; Esri"
                        maxZoom={20}
                        className="opacity-80 contrast-125 saturate-50"
                    />
                    
                    <MapController selectedLocation={selectedFault?.geolocation || newPinLoc || null} />
                    <MapEvents onMapClick={handleMapClick} isDropMode={isDropMode} />

                    {/* AI Heatmap Overlay */}
                    {showHeatmap && (
                        <>
                            <Rectangle bounds={heatmapBounds[0] as any} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }}>
                                <Tooltip sticky className="custom-dark-popup">Zone A: Grading 100%</Tooltip>
                            </Rectangle>
                            <Rectangle bounds={heatmapBounds[1] as any} pathOptions={{ color: '#eab308', fillColor: '#eab308', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }}>
                                <Tooltip sticky className="custom-dark-popup">Zone B: Trenching 60%</Tooltip>
                            </Rectangle>
                            <Rectangle bounds={heatmapBounds[2] as any} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }}>
                                <Tooltip sticky className="custom-dark-popup">Zone C: Delayed (Piling)</Tooltip>
                            </Rectangle>
                        </>
                    )}

                    {/* Drone Orthomosaic Overlay Mock */}
                    {showDroneOverlay && (
                        <Rectangle bounds={droneBounds as any} pathOptions={{ color: '#3b82f6', fillColor: 'transparent', weight: 3, dashArray: '10, 10' }}>
                            <Tooltip permanent direction="top" className="custom-dark-popup border-blue-500 text-blue-400 bg-slate-900/90 backdrop-blur-md font-black">ACTIVE DRONE SCAN AREA</Tooltip>
                        </Rectangle>
                    )}

                    {geolocatedFaults.map((fault, idx) => (
                        <Marker 
                            key={`marker-${idx}`}
                            position={[fault.geolocation.lat, fault.geolocation.lng]}
                            icon={createGlowingIcon(fault.severity, fault.isManual)}
                            eventHandlers={{
                                click: () => setSelectedFault(fault)
                            }}
                        >
                            <Popup className="custom-dark-popup">
                                <div className="p-2 min-w-[200px]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`p-1.5 rounded-lg ${fault.isManual ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {fault.isManual ? <MapPin className="w-4 h-4"/> : <ShieldAlert className="w-4 h-4"/>}
                                        </div>
                                        <h4 className="font-bold text-slate-200 text-sm">{fault.label || 'Issue'}</h4>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-3">{fault.description}</p>
                                    <div className="flex justify-between items-center border-t border-slate-700/50 pt-2">
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                            fault.severity.toLowerCase() === 'critical' ? 'bg-red-500/20 text-red-400' :
                                            fault.severity.toLowerCase() === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                            fault.severity.toLowerCase() === 'medium' && fault.isManual ? 'bg-cyan-500/20 text-cyan-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {fault.severity}
                                        </span>
                                        <button className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider">Assign Task</button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Pending Manual Pin */}
                    {newPinLoc && (
                        <Marker position={[newPinLoc.lat, newPinLoc.lng]} icon={createGlowingIcon('Medium', true)} />
                    )}
                </MapContainer>

                {/* Floating HUD Layer Controls */}
                <div className="absolute top-6 right-6 z-[400] flex flex-col gap-3 w-64">
                    <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-700/50 shadow-2xl">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-400" />
                            Command Layers
                        </h3>
                        
                        <div className="space-y-3">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
                                    <BoxSelect className="w-4 h-4 text-blue-500" /> Drone Overlay
                                </span>
                                <div className={`w-8 h-4 rounded-full transition-colors relative ${showDroneOverlay ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${showDroneOverlay ? 'left-4.5' : 'left-0.5'}`} style={{ left: showDroneOverlay ? '18px' : '2px' }}></div>
                                </div>
                                <input type="checkbox" className="hidden" checked={showDroneOverlay} onChange={() => setShowDroneOverlay(!showDroneOverlay)} />
                            </label>

                            <label className="flex items-center justify-between cursor-pointer group">
                                <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
                                    <Target className="w-4 h-4 text-emerald-500" /> AI Progress Grid
                                </span>
                                <div className={`w-8 h-4 rounded-full transition-colors relative ${showHeatmap ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${showHeatmap ? 'left-4.5' : 'left-0.5'}`} style={{ left: showHeatmap ? '18px' : '2px' }}></div>
                                </div>
                                <input type="checkbox" className="hidden" checked={showHeatmap} onChange={() => setShowHeatmap(!showHeatmap)} />
                            </label>
                        </div>
                    </div>
                    
                    {isDropMode && (
                        <div className="bg-cyan-900/90 backdrop-blur-xl border border-cyan-500/50 p-3 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 animate-pulse">
                            <Crosshair className="w-5 h-5 text-cyan-400" />
                            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Select Location</span>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
