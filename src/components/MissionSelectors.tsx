import React from "react";
import { useMission } from "../context/MissionContext";
import { Globe, Building, MapPin, Briefcase, ChevronDown } from "lucide-react";

export default function MissionSelectors() {
    const { mission, setMission } = useMission();

    const handleSelect = (field: keyof typeof mission, value: string) => {
        setMission({ ...mission, [field]: value });
    };

    return (
        <div className="flex items-center gap-4 bg-slate-950/50 p-1 rounded-xl border border-slate-800 backdrop-blur-sm">
            {/* Country Selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group">
                <Globe className="w-4 h-4 text-blue-400" />
                <select
                    value={mission.country || ""}
                    onChange={(e) => handleSelect("country", e.target.value)}
                    className="bg-transparent text-xs font-bold uppercase tracking-wider text-slate-300 outline-none cursor-pointer appearance-none pr-6"
                >
                    <option value="" className="bg-slate-900">Global Region</option>
                    <option value="us" className="bg-slate-900">United States</option>
                    <option value="mx" className="bg-slate-900">Mexico</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 -ml-5 group-hover:text-blue-400 transition-colors pointer-events-none" />
            </div>

            <div className="w-px h-4 bg-slate-800" />

            {/* Client Selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group">
                <Building className="w-4 h-4 text-cyan-400" />
                <select
                    value={mission.client || ""}
                    onChange={(e) => handleSelect("client", e.target.value)}
                    className="bg-transparent text-xs font-bold uppercase tracking-wider text-slate-300 outline-none cursor-pointer appearance-none pr-6"
                >
                    <option value="" className="bg-slate-900">Select Client</option>
                    <option value="coatzadrone" className="bg-slate-900">CoatzaDrone</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 -ml-5 group-hover:text-cyan-400 transition-colors pointer-events-none" />
            </div>

            <div className="w-px h-4 bg-slate-800" />

            {/* Site Selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <select
                    value={mission.site || ""}
                    onChange={(e) => handleSelect("site", e.target.value)}
                    className="bg-transparent text-xs font-bold uppercase tracking-wider text-slate-300 outline-none cursor-pointer appearance-none pr-6"
                >
                    <option value="" className="bg-slate-900">Select Site</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 -ml-5 group-hover:text-emerald-400 transition-colors pointer-events-none" />
            </div>

            <div className="w-px h-4 bg-slate-800" />

            {/* Portfolio Selector */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group">
                <Briefcase className="w-4 h-4 text-purple-400" />
                <select
                    value={mission.portfolio || ""}
                    onChange={(e) => handleSelect("portfolio", e.target.value)}
                    className="bg-transparent text-xs font-bold uppercase tracking-wider text-slate-300 outline-none cursor-pointer appearance-none pr-6"
                >
                    <option value="" className="bg-slate-900">Portfolio</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 -ml-5 group-hover:text-purple-400 transition-colors pointer-events-none" />
            </div>
        </div>
    );
}
