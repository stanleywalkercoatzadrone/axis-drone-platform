import React from "react";
import { useMission } from "../context/MissionContext";
import { Globe, Building, MapPin, ChevronDown } from "lucide-react";

export default function MissionSelectors() {
    const { mission, setMission } = useMission();

    const handleSelect = (field: keyof typeof mission, value: string) => {
        setMission({ ...mission, [field]: value });
    };

    const selectClass =
        "bg-transparent text-white text-sm font-semibold outline-none cursor-pointer appearance-none min-w-[110px] pr-1";

    return (
        <div className="flex items-center gap-1">
            {/* Country */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all cursor-pointer group">
                <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <select
                    value={mission.country || ""}
                    onChange={(e) => handleSelect("country", e.target.value)}
                    className={selectClass}
                >
                    <option value="" className="bg-slate-800 text-white">Global Region</option>
                    <option value="us" className="bg-slate-800 text-white">United States</option>
                    <option value="mx" className="bg-slate-800 text-white">Mexico</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
            </div>

            <div className="w-px h-5 bg-slate-600 mx-1" />

            {/* Client */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all cursor-pointer group">
                <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <select
                    value={mission.client || ""}
                    onChange={(e) => handleSelect("client", e.target.value)}
                    className={selectClass}
                >
                    <option value="" className="bg-slate-800 text-white">All Clients</option>
                    <option value="coatzadrone" className="bg-slate-800 text-white">CoatzaDrone</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 transition-colors shrink-0" />
            </div>

            <div className="w-px h-5 bg-slate-600 mx-1" />

            {/* Site */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all cursor-pointer group">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <select
                    value={mission.site || ""}
                    onChange={(e) => handleSelect("site", e.target.value)}
                    className={selectClass}
                >
                    <option value="" className="bg-slate-800 text-white">All Sites</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0" />
            </div>
        </div>
    );
}
