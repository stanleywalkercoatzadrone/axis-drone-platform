import React from 'react';
import { useIndustry } from '../src/context/IndustryContext';
import { ChevronDown, Globe } from 'lucide-react';
import { IndustryKey } from '../src/config/industryConfig';

const IndustrySwitcher: React.FC = () => {
    const { currentIndustry, setIndustry, availableIndustries } = useIndustry();
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const activeIndustryName = availableIndustries.find(i => i.key === currentIndustry)?.name || 'General';

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors text-xs font-medium border border-slate-700/50"
            >
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>{activeIndustryName}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50">
                    <div className="px-3 py-2 border-b border-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Select Industry
                    </div>
                    {availableIndustries.map((industry) => (
                        <button
                            key={industry.key}
                            onClick={() => {
                                setIndustry(industry.key as IndustryKey);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between ${currentIndustry === industry.key ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-slate-600'
                                }`}
                        >
                            {industry.name}
                            {currentIndustry === industry.key && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IndustrySwitcher;
