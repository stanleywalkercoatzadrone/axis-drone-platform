import React from 'react';
import { useGlobalContext, Industry } from '../../context/GlobalContext';
import { ChevronDown, Search, Bell, Calendar } from 'lucide-react';

export const ContextBar: React.FC = () => {
    const {
        selectedIndustry,
        setIndustry,
        selectedClientId,
        dateRange
    } = useGlobalContext();

    const industries: Industry[] = ['Solar', 'Telecom', 'Insurance', 'Construction', 'Utility'];

    return (
        <div className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 shadow-sm h-16 flex items-center justify-between px-6 transition-colors duration-200">
            {/* Left: Context Switchers */}
            <div className="flex items-center space-x-4">
                {/* Industry Switcher */}
                <div className="relative group">
                    <button className="flex items-center space-x-2 text-slate-200 hover:text-white transition-colors py-2">
                        <span className="font-semibold text-sm uppercase tracking-wider text-slate-400">Industry</span>
                        <span className="font-bold text-lg">{selectedIndustry}</span>
                        <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                    </button>

                    {/* Dropdown */}
                    <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 transform origin-top-left">
                        {industries.map((ind) => (
                            <button
                                key={ind}
                                onClick={() => setIndustry(ind)}
                                className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${selectedIndustry === ind ? 'text-cyan-400 bg-slate-700/50' : 'text-slate-300'
                                    }`}
                            >
                                {ind}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-6 w-px bg-slate-700 mx-2"></div>

                {/* Client Selector (Mock) */}
                <button className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
                    <span className="text-sm font-medium">{selectedClientId ? 'Client A' : 'Select Client'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
            </div>

            {/* Right: Tools */}
            <div className="flex items-center space-x-6">
                {/* Global Search */}
                <div className="relative hidden md:block">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search sites, assets..."
                        className="bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-md focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 block w-64 pl-10 p-2 placeholder-slate-600 transition-all focus:w-80"
                    />
                </div>

                <div className="h-6 w-px bg-slate-700"></div>

                {/* Date Range */}
                <button className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 transition-colors">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Last 30 Days</span>
                </button>

                {/* Notifications */}
                <button className="relative text-slate-400 hover:text-cyan-400 transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-slate-900 bg-red-500 transform translate-x-1/4 -translate-y-1/4"></span>
                </button>
            </div>
        </div>
    );
};
