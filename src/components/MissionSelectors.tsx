import React, { useState, useRef, useEffect } from "react";
import { useMission } from "../context/MissionContext";
import { Globe, Building, MapPin, ChevronDown } from "lucide-react";

interface DropdownOption {
    value: string;
    label: string;
}

interface SelectorDropdownProps {
    icon: React.ReactNode;
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    iconHoverClass: string;
}

function SelectorDropdown({ icon, value, options, onChange, iconHoverClass }: SelectorDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.value === value) ?? options[0];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all cursor-pointer group"
            >
                <span className={`shrink-0 transition-colors ${open ? iconHoverClass : ''}`}>{icon}</span>
                <span className="text-sm font-semibold text-white min-w-[90px] text-left">{selected.label}</span>
                <ChevronDown
                    className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-1 z-[200] min-w-[160px] bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors
                                ${opt.value === value
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function MissionSelectors() {
    const { mission, setMission } = useMission();

    const handleSelect = (field: keyof typeof mission, value: string) => {
        setMission({ ...mission, [field]: value });
    };

    return (
        <div className="flex items-center gap-1">
            <SelectorDropdown
                icon={<Globe className="w-3.5 h-3.5 text-blue-400" />}
                value={mission.country || ""}
                iconHoverClass="text-blue-400"
                options={[
                    { value: "", label: "Global Region" },
                    { value: "us", label: "United States" },
                    { value: "mx", label: "Mexico" },
                ]}
                onChange={v => handleSelect("country", v)}
            />

            <div className="w-px h-5 bg-slate-600 mx-1" />

            <SelectorDropdown
                icon={<Building className="w-3.5 h-3.5 text-cyan-400" />}
                value={mission.client || ""}
                iconHoverClass="text-cyan-400"
                options={[
                    { value: "", label: "All Clients" },
                    { value: "coatzadrone", label: "CoatzaDrone" },
                ]}
                onChange={v => handleSelect("client", v)}
            />

            <div className="w-px h-5 bg-slate-600 mx-1" />

            <SelectorDropdown
                icon={<MapPin className="w-3.5 h-3.5 text-emerald-400" />}
                value={mission.site || ""}
                iconHoverClass="text-emerald-400"
                options={[
                    { value: "", label: "All Sites" },
                ]}
                onChange={v => handleSelect("site", v)}
            />
        </div>
    );
}
