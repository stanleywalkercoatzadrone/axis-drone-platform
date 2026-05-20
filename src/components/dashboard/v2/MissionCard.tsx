import React, { useState, useEffect } from 'react';
import { CloudLightning, MapPin, Calendar, Download, Upload, FileText, Cloud, Wind, Sun, ChevronRight, Loader2, FolderUp, CheckSquare, Grid3X3 } from 'lucide-react';
import apiClient from '../../../services/apiClient';
import PilotProtocolsPanel from './PilotProtocolsPanel';
import LBDDocumentGrid from '@components/LBDDocumentGrid';
import { weatherCodeLabel, weatherCodeEmoji, uvLabel, STATUS_COLORS, HourlySlot } from './weatherHelpers';

export interface AssignedMission {
    id: string;
    title?: string;
    type: string;
    status: string;
    date?: string;
    due_date?: string;
    site_name?: string;
    project_name?: string;
    location?: string;
    industry_key?: string;
    sites?: { name?: string; location?: string };
}

export interface WeatherData {
    temperature?: number;
    feels_like?: number;
    humidity?: number;
    dew_point?: number;
    wind_speed?: number;
    wind_gusts?: number;
    wind_direction?: string;
    wind_bearing?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    visibility_mi?: number;
    uv_index?: number;
    pressure_hpa?: number;
    solar_radiation?: number;
    flight_status?: 'GO' | 'CAUTION' | 'NO_GO';
    flight_reasons?: string[];
    // Legacy fallbacks
    conditions?: string;
    irradiance_ghi?: number;
}

const MissionCard: React.FC<{
    mission: AssignedMission;
    onDailyReport: () => void;
    onViewReports: () => void;
}> = ({ mission, onDailyReport, onViewReports }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [hourly, setHourly] = useState<HourlySlot[]>([]);
    const [weatherLocation, setWeatherLocation] = useState<{ city?: string; state?: string } | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [isGridCollapsed, setIsGridCollapsed] = useState(true);
    const [assignments, setAssignments] = useState<any[] | null>(null);

    useEffect(() => {
        setWeatherLoading(true);
        apiClient.get(`/pilot/secure/missions/${mission.id}/weather`)
            .then(r => {
                if (r.data.success) {
                    setWeather(r.data.weather || null);
                    setHourly(r.data.hourly || []);
                    setWeatherLocation(r.data.location || null);
                }
            })
            .catch(() => { })
            .finally(() => setWeatherLoading(false));
    }, [mission.id]);

    useEffect(() => {
        if (!expanded || assignments !== null) return;
        apiClient.get(`/pilot/secure/missions/${mission.id}/assignments`)
            .then(r => setAssignments(r.data.data || []))
            .catch(() => setAssignments([]));
    }, [expanded, mission.id]);

    const handleKMLDownload = async () => {
        try {
            const token = sessionStorage.getItem('skylens_token');
            const response = await fetch(`/api/pilot/secure/missions/${mission.id}/kml`, {
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: 'KML download failed' }));
                return alert(errData.message || 'KML download failed');
            }
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('json')) {
                // Backend returned a redirect URL
                const data = await response.json();
                if (data.downloadUrl) {
                    window.open(data.downloadUrl, '_blank');
                } else {
                    alert(data.message || 'KML file not available for this mission.');
                }
            } else {
                // Backend is streaming the file directly — save it as a blob download
                const blob = await response.blob();
                const disposition = response.headers.get('content-disposition') || '';
                const nameMatch = disposition.match(/filename="(.+?)"/);
                const fileName = nameMatch ? decodeURIComponent(nameMatch[1]) : `mission-kml-${mission.id.split('-')[0]}.kml`;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            alert('KML download failed: ' + (e?.message || 'Unknown error'));
        }
    };

    const handleParamsDownload = async () => {
        try {
            const res = await apiClient.get(`/pilot/secure/missions/${mission.id}/parameters`);
            if (res.data.success) {
                const { operationalBrief: ob, flightParameters: fp, kmlFiles } = res.data;
                const lines = [
                    `AXIS PILOT SYSTEM — MISSION OPERATIONAL BRIEF`,
                    `===============================================`,
                    `Generated: ${new Date().toLocaleString()}`,
                    ``,
                    `MISSION DETAILS`,
                    `--------------`,
                    `Mission:       ${ob?.missionName || 'N/A'}`,
                    `Type:          ${ob?.type || 'N/A'}`,
                    `Status:        ${ob?.status || 'N/A'}`,
                    `Site:          ${ob?.siteName || 'N/A'}`,
                    `Location:      ${ob?.locationCity || 'N/A'}`,
                    `Date:          ${ob?.missionDate || 'N/A'}`,
                    `Days On-Site:  ${ob?.daysOnSite || 'N/A'}`,
                    `Industry:      ${ob?.industryType || 'N/A'}`,
                    `Notes:         ${ob?.operationalNotes || 'None'}`,
                    ``,
                    `FLIGHT PARAMETERS`,
                    `-----------------`,
                ];
                if (fp) {
                    if (fp.flightAltitudeMeters) lines.push(`Altitude:         ${fp.flightAltitudeMeters}m`);
                    if (fp.missionAreaAcres)     lines.push(`Mission Area:     ${fp.missionAreaAcres} acres`);
                    if (fp.waypointCount)        lines.push(`Waypoints:        ${fp.waypointCount}`);
                    if (fp.overlapPercent)       lines.push(`Overlap:          ${fp.overlapPercent}%`);
                    if (fp.safetyNotes)          lines.push(`Safety Notes:     ${fp.safetyNotes}`);
                    if (fp.onSiteContact)        lines.push(`On-Site Contact:  ${fp.onSiteContact}`);
                    if (fp.additionalParams)     lines.push(`Additional:       ${JSON.stringify(fp.additionalParams)}`);
                } else {
                    lines.push(`No flight parameters on file.`);
                }
                if (kmlFiles?.length > 0) {
                    lines.push(``, `ATTACHED KML FILES`, `------------------`);
                    kmlFiles.forEach((f: any) => lines.push(`• ${f.name} (${((f.size || 0) / 1024).toFixed(1)} KB)`));
                }
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mission-params-${mission.id.split('-')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Parameters download failed');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            Array.from(files).forEach(f => formData.append('files', f));
            const res = await apiClient.post(
                `/pilot/secure/missions/${mission.id}/upload`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            if (res.data.success) {
                alert(`${res.data.files?.filter((f: any) => f.success).length || 0} file(s) uploaded successfully`);
            }
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const siteName = mission.site_name || mission.sites?.name || 'Unknown Site';
    const location = mission.location || mission.sites?.location || '';
    const cityOnly = location.split(',')[0]?.trim();
    const statusColor = STATUS_COLORS[mission.status] || STATUS_COLORS['on_hold'];

    return (
        <div className={`bg-slate-900/60 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgba(99,102,241,0.1)] group ${expanded ? 'border-indigo-500/50 shadow-[0_8px_30px_rgba(99,102,241,0.15)]' : 'border-slate-800 hover:border-indigo-500/30'}`}>
            {/* Mission header */}
            <div
                className="px-6 py-5 cursor-pointer bg-gradient-to-r from-slate-900/80 to-slate-900/40 hover:from-slate-800/80 hover:to-slate-800/40 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${statusColor} group-hover:shadow-[0_0_10px_rgba(currentColor,0.2)] transition-shadow`}>
                                {mission.status.replace('_', ' ')}
                            </span>
                            {mission.industry_key && (
                                <span className="text-[10px] text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg uppercase tracking-widest font-bold">{mission.industry_key}</span>
                            )}
                        </div>
                        {/* Project / site name — shown as primary context */}
                        {(mission.project_name || siteName) && (
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.15em] mb-1 group-hover:text-indigo-300 transition-colors">
                                📁 {mission.project_name || siteName}
                            </p>
                        )}
                        <h3 className="font-black text-white text-lg leading-tight truncate group-hover:text-indigo-50 transition-colors">
                            {mission.title || siteName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-xs font-medium">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400/70" />
                            <span>{cityOnly || location || 'Location not set'}</span>
                        </div>
                        {(mission.date || mission.due_date) && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-slate-400 text-xs font-medium">
                                <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400/70" />
                                <span>{mission.date || mission.due_date}</span>
                            </div>
                        )}
                    </div>

                    {/* Weather snapshot — header strip */}
                    <div className="flex-shrink-0 text-right min-w-[90px]">
                        {weatherLoading ? (
                            <div className="flex items-center gap-1.5 justify-end text-xs font-bold text-slate-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" /> fetching...
                            </div>
                        ) : weather ? (
                            <div className="text-xs text-slate-400 space-y-1">
                                {/* Flight status badge */}
                                {weather.flight_status && (
                                    <div className={`text-[10px] font-black px-2.5 py-1 rounded-lg text-center mb-1.5 uppercase tracking-widest border shadow-sm ${
                                        weather.flight_status === 'GO'      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        weather.flight_status === 'CAUTION' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                                               'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                        {weather.flight_status === 'GO' ? '✅ GO' : weather.flight_status === 'CAUTION' ? '⚠️ CAUTION' : '🚫 NO-GO'}
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 justify-end">
                                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-slate-200 font-black">{weather.temperature}°F</span>
                                </div>
                                <div className="flex items-center gap-1.5 justify-end">
                                    <Wind className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="font-bold">{weather.wind_speed} mph</span>
                                    {weather.wind_gusts ? <span className="text-slate-500">↑{weather.wind_gusts}</span> : null}
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 text-right font-bold">
                                <Cloud className="w-5 h-5 mx-auto mb-1 opacity-40" />
                                No coords
                            </div>
                        )}
                        <div className={`w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center mx-auto mt-3 transition-transform duration-300 ${expanded ? 'rotate-90 bg-indigo-500/20 text-indigo-400' : 'text-slate-400 group-hover:bg-slate-700 group-hover:text-white'}`}>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded: Weather Panel + Mission Actions */}
            <div className={`grid transition-all duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="border-t border-slate-800 bg-slate-900/60 p-6 space-y-6">
                        {/* Expanded: Full Weather Panel — always shown */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <CloudLightning className="w-3.5 h-3.5" />
                                    Live Weather at Site
                                </h4>
                                {weatherLocation?.city && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg uppercase tracking-wider">
                                        📍 {weatherLocation.city}{weatherLocation.state ? `, ${weatherLocation.state}` : ''}
                                    </span>
                                )}
                            </div>

                            {/* Loading state */}
                            {weatherLoading && (
                                <div className="flex items-center justify-center gap-3 py-10 bg-slate-800/30 rounded-2xl border border-slate-700/50 text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Fetching live telemetry...</span>
                                </div>
                            )}

                            {/* No coordinates / no data */}
                            {!weatherLoading && !weather && (
                                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl px-6 py-8 text-center backdrop-blur-sm">
                                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Cloud className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-black text-slate-200">No GPS coordinates on this mission</p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">Ask your admin to add latitude/longitude to the deployment to enable live weather.</p>
                                </div>
                            )}

                            {/* Full weather panel */}
                            {!weatherLoading && weather && (
                                <>
                                {/* Flight Status Banner */}
                                {weather.flight_status && (
                                    <div className={`rounded-2xl px-5 py-4 border flex items-start gap-4 shadow-lg ${
                                        weather.flight_status === 'GO'     ? 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5' :
                                        weather.flight_status === 'CAUTION'? 'bg-amber-500/10 border-amber-500/20 shadow-amber-500/5'   :
                                                                              'bg-red-500/10 border-red-500/20 shadow-red-500/5'
                                    }`}>
                                        <span className="text-3xl leading-none flex-shrink-0 drop-shadow-md">
                                            {weather.flight_status === 'GO' ? '✅' : weather.flight_status === 'CAUTION' ? '⚠️' : '🚫'}
                                        </span>
                                        <div>
                                            <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                                                weather.flight_status === 'GO' ? 'text-emerald-400' :
                                                weather.flight_status === 'CAUTION' ? 'text-amber-400' : 'text-red-400'
                                            }`}>
                                                {weather.flight_status === 'GO' ? 'GO — Conditions Favorable for Flight' :
                                                 weather.flight_status === 'CAUTION' ? 'CAUTION — Review Conditions Before Flying' :
                                                 'NO-GO — Unsafe Flight Conditions'}
                                            </p>
                                            {(weather.flight_reasons || []).map((r, i) => (
                                                <p key={i} className="text-[11px] mt-0.5 text-slate-300 font-medium flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-500"></span>{r}</p>
                                            ))}
                                            {weather.flight_status === 'GO' && (
                                                <p className="text-[10px] mt-2 text-emerald-500/70 font-bold uppercase tracking-widest">All monitored conditions within FAA Part 107 limits</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Hero: Temp + Condition */}
                                <div className="bg-gradient-to-br from-indigo-900/60 to-slate-900 border border-indigo-500/20 rounded-2xl px-6 py-5 text-white flex items-center justify-between shadow-lg shadow-indigo-500/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-end gap-3">
                                            <span className="text-5xl font-black tracking-tighter">{weather.temperature ?? '—'}°F</span>
                                            <span className="text-indigo-300 text-sm mb-1.5 font-bold">Feels {weather.feels_like ?? '—'}°</span>
                                        </div>
                                        <p className="text-indigo-100 text-sm font-bold mt-1 flex items-center gap-2">
                                            <span className="text-xl">{weatherCodeEmoji(weather.weather_code)}</span> {weatherCodeLabel(weather.weather_code)}
                                        </p>
                                    </div>
                                    <div className="text-right relative z-10">
                                        <p className="text-4xl drop-shadow-lg">{weatherCodeEmoji(weather.weather_code)}</p>
                                        <p className="text-[10px] text-indigo-300 mt-2 uppercase tracking-widest font-black">Live Conditions</p>
                                    </div>
                                </div>

                                {/* 8-tile Detail Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Wind */}
                                    <div className="col-span-2 bg-slate-800/40 border border-blue-500/20 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Wind className="w-3 h-3"/> Wind</p>
                                        <p className="text-xl font-black text-white">{weather.wind_speed ?? '—'} <span className="text-xs font-bold text-slate-400">mph</span></p>
                                        <p className="text-xs text-slate-300 mt-1 font-medium">
                                            Gusts <span className="text-white font-bold">{weather.wind_gusts ?? '—'} mph</span>
                                            {weather.wind_direction ? ` · ${weather.wind_direction}` : ''}
                                            {weather.wind_bearing !== undefined ? ` (${weather.wind_bearing}°)` : ''}
                                        </p>
                                    </div>
                                    {/* Humidity */}
                                    <div className="bg-slate-800/40 border border-cyan-500/20 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-1.5">💧 Humidity</p>
                                        <p className="text-xl font-black text-white">{weather.humidity ?? '—'}<span className="text-xs font-bold text-slate-400">%</span></p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Dew {weather.dew_point ?? '—'}°F</p>
                                    </div>
                                    {/* UV */}
                                    <div className="bg-slate-800/40 border border-amber-500/20 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-1.5">☀️ UV Index</p>
                                        <p className={`text-xl font-black ${uvLabel(weather.uv_index ?? 0).color}`}>{weather.uv_index ?? '—'}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{uvLabel(weather.uv_index ?? 0).label}</p>
                                    </div>
                                    {/* Cloud Cover */}
                                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">☁️ Cloud Cover</p>
                                        <p className="text-xl font-black text-white">{weather.cloud_cover ?? '—'}<span className="text-xs font-bold text-slate-400">%</span></p>
                                        <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-400 rounded-full" style={{ width: `${weather.cloud_cover ?? 0}%` }} />
                                        </div>
                                    </div>
                                    {/* Visibility */}
                                    <div className="bg-slate-800/40 border border-emerald-500/20 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1.5">👁 Visibility</p>
                                        <p className={`text-xl font-black ${
                                            (weather.visibility_mi ?? 10) < 3 ? 'text-red-400' :
                                            (weather.visibility_mi ?? 10) < 5 ? 'text-amber-400' : 'text-white'
                                        }`}>{weather.visibility_mi ?? '—'} <span className="text-xs font-bold text-slate-400">mi</span></p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Min 3 mi (FAA)</p>
                                    </div>
                                    {/* Precipitation */}
                                    <div className="bg-slate-800/40 border border-indigo-500/20 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1.5">🌧 Precip</p>
                                        <p className={`text-xl font-black ${ (weather.precipitation ?? 0) > 0 ? 'text-indigo-300' : 'text-white'}`}>
                                            {weather.precipitation ?? 0} <span className="text-xs font-bold text-slate-400">mm</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{(weather.precipitation ?? 0) > 0 ? 'Active' : 'None'}</p>
                                    </div>
                                    {/* Pressure */}
                                    <div className="bg-slate-800/40 border border-violet-500/20 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-violet-400 font-black uppercase tracking-widest mb-1.5">🧭 Pressure</p>
                                        <p className="text-xl font-black text-white">{weather.pressure_hpa ?? '—'}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">hPa</p>
                                    </div>
                                    {/* Solar */}
                                    <div className="bg-slate-800/40 border border-yellow-500/20 rounded-2xl px-4 py-4 backdrop-blur-md">
                                        <p className="text-[10px] text-yellow-400 font-black uppercase tracking-widest mb-1.5">⚡ Solar</p>
                                        <p className="text-xl font-black text-white">{weather.solar_radiation ?? '—'}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">W/m²</p>
                                    </div>
                                </div>

                                {/* 6-Hour Hourly Forecast */}
                                {hourly.length > 0 && (
                                    <div className="pt-2">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">6-Hour Forecast</p>
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                            {hourly.map((h, i) => (
                                                <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl px-2 py-3 text-center hover:bg-slate-700/40 transition-colors">
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                                                        {new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}
                                                    </p>
                                                    <p className="text-2xl my-2 drop-shadow-md">{weatherCodeEmoji(h.code)}</p>
                                                    <p className="text-sm font-black text-white">{h.temp}°</p>
                                                    <p className="text-[9px] text-blue-400 font-bold mt-1 uppercase tracking-wider">💨 {h.wind}</p>
                                                    {h.precip_prob > 0 && (
                                                        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">🌧 {h.precip_prob}%</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                </>
                            )}
                        </div>
                        {/* Assigned Work — Block Grid (replaces static LBD list) */}
                        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
                            <div 
                                className="flex items-center justify-between p-4 bg-slate-800/40 cursor-pointer hover:bg-slate-800/60 transition-colors border-b border-slate-800"
                                onClick={() => setIsGridCollapsed(!isGridCollapsed)}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                        <Grid3X3 className="w-4 h-4 text-orange-400" />
                                    </div>
                                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Block Grid</h4>
                                </div>
                                <button className="text-[10px] uppercase font-black tracking-widest text-slate-500 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition-colors">
                                    {isGridCollapsed ? 'Expand' : 'Collapse'}
                                </button>
                            </div>
                            {!isGridCollapsed && (
                                <div className="p-5">
                                    <LBDDocumentGrid
                                        deploymentId={mission.id}
                                        userRole="pilot_technician"
                                    />
                                </div>
                            )}
                        </div>
                        {/* Operational Protocols */}
                        <PilotProtocolsPanel missionId={mission.id} />

                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Mission Actions</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Download KML */}
                                <button
                                    onClick={handleKMLDownload}
                                    className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-wider hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Download KML
                                </button>

                                {/* Download Parameters */}
                                <button
                                    onClick={handleParamsDownload}
                                    className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-black uppercase tracking-wider hover:bg-violet-500/20 hover:border-violet-400/50 transition-all shadow-sm"
                                >
                                    <FileText className="w-4 h-4" />
                                    Parameters
                                </button>

                                {/* Upload Flight Data */}
                                <div className="flex flex-col gap-3">
                                    <label className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-all shadow-sm ${uploading ? 'opacity-60' : ''}`}>
                                        <Upload className="w-4 h-4" />
                                        {uploading ? 'Uploading...' : 'Upload Files'}
                                        <input
                                            type="file" multiple className="hidden"
                                            disabled={uploading}
                                            accept=".jpg,.jpeg,.png,.webp,.tiff,.heic,.mp4,.mov,.kml,.kmz,.zip,.csv,.xls,.xlsx,.pdf,.las,.laz"
                                            onChange={handleUpload}
                                        />
                                    </label>
                                    <label className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-all shadow-sm ${uploading ? 'opacity-60' : ''}`}>
                                        <FolderUp className="w-4 h-4" />
                                        {uploading ? 'Uploading...' : 'Upload Folder'}
                                        <input
                                            type="file" {...({ webkitdirectory: "", directory: "" } as any)} className="hidden"
                                            disabled={uploading}
                                            onChange={handleUpload}
                                        />
                                    </label>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {/* Daily Report */}
                                    <button
                                        onClick={onDailyReport}
                                        className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider hover:bg-amber-500/20 hover:border-amber-400/50 transition-all shadow-sm"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Daily Report
                                    </button>
                                    
                                    {/* View Submitted Reports */}
                                    <button
                                        onClick={onViewReports}
                                        className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-black uppercase tracking-wider hover:bg-indigo-500/20 hover:border-indigo-400/50 transition-all shadow-sm"
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                        Past Reports
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MissionCard;
