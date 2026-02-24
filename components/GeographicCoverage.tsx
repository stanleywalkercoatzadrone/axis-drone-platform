import React from 'react';

const GeographicCoverage: React.FC = () => {
    // Fallback data as requested
    const regions = [
        { region: 'North America', countries: ['USA', 'Canada', 'Mexico'] },
        { region: 'Europe', countries: ['UK', 'Germany', 'France'] },
        { region: 'Asia', countries: ['China', 'Japan', 'India'] },
    ];

    return (
        <div className="GeographicCoverage bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                <span className="bg-cyan-500/10 text-cyan-400 p-1.5 rounded mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 18z" clipRule="evenodd" />
                    </svg>
                </span>
                Global Coverage
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {regions.map((item) => (
                    <div key={item.region} className="bg-slate-950/50 rounded-lg p-4 border border-slate-800/50 hover:border-slate-700 transition-colors">
                        <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider border-b border-slate-800 pb-2">{item.region}</h3>
                        <ul className="space-y-1.5">
                            {item.countries.map((country) => (
                                <li key={country} className="text-slate-400 text-sm flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mr-2"></span>
                                    {country}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GeographicCoverage;
