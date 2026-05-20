import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { useCountry } from '../context/CountryContext';
import { Globe, ChevronDown } from 'lucide-react';

export default function CountrySelector() {
    const { activeCountryId, setActiveCountryId, countries: contextCountries, loading } = useCountry();

    // Local fallback list — used only when the context data is unavailable.
    // Populated by a direct fetch so the dropdown is never empty due to a
    // context timing issue or session mismatch.
    const [fallbackCountries, setFallbackCountries] = useState<any[]>([]);

    useEffect(() => {
        // Only hit the API if the context is done loading and still returned nothing
        if (!loading && contextCountries.length === 0) {
            apiClient
                .get('/regions/countries', { params: { status: 'ENABLED' } })
                .then(res => setFallbackCountries(res.data.data || []))
                .catch(() => {}); // silently ignore — nothing to show
        }
    }, [loading, contextCountries.length]);

    // Prefer live context data; fall back to independently-fetched data
    const countries = contextCountries.length > 0 ? contextCountries : fallbackCountries;

    const regionOrder: Record<string, number> = {
        'North America': 1,
        'Central America': 2,
        'South America': 3,
        'Caribbean': 4,
        'Europe': 5,
        'Asia Pacific': 6,
    };

    const regions = [...new Set(countries.map(c => c.region_name || 'Other'))];
    const sortedRegions = [...regions].sort((a, b) => (regionOrder[a] || 99) - (regionOrder[b] || 99));

    function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        setActiveCountryId(e.target.value || null);
    }

    return (
        <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 ml-1">Country</span>
            <div className="relative">
                <select
                    id="countrySelect"
                    value={activeCountryId || ''}
                    onChange={handleChange}
                    className="appearance-none text-white text-sm rounded-md pl-8 pr-8 py-1.5 focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 outline-none cursor-pointer min-w-[160px] font-medium transition-shadow shadow-sm"
                    style={{ backgroundColor: '#007ACC', border: '1px solid #005A99' }}
                >
                    <option value="" className="text-slate-900 bg-white">All Countries</option>
                    {sortedRegions.map(region => (
                        <optgroup key={region} label={region} className="text-slate-900 bg-white font-bold">
                            {countries
                                .filter(c => (c.region_name || 'Other') === region)
                                .map(c => (
                                    <option key={c.id} value={c.id} className="text-slate-700 font-normal">
                                        {c.name}
                                    </option>
                                ))}
                        </optgroup>
                    ))}
                </select>
                <Globe className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none opacity-80" />
                <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none opacity-80" />
            </div>
        </div>
    );
}
