import React from 'react';
import { useGlobalContext } from '../../context/GlobalContext';
import { Search, Bell, Calendar } from 'lucide-react';
import MissionSelectors from '../MissionSelectors';

export const ContextBar: React.FC = () => {
    return (
        <div className="flex md:flex sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-sm h-auto min-h-[4rem] items-center justify-between px-4 md:px-6 transition-colors duration-200 overflow-x-auto overflow-y-hidden no-scrollbar">
            {/* Left: Context Switchers */}
            <div className="flex items-center space-x-4 py-2 shrink-0">
                <MissionSelectors />
            </div>

            {/* Right: Tools */}
            <div className="hidden sm:flex items-center space-x-4 md:space-x-6 shrink-0 ml-4">
                {/* Global Search */}
                <div className="relative hidden md:block">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search sites, assets..."
                        className="bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-md focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 block w-48 md:w-64 pl-10 p-2 placeholder-slate-600 transition-all focus:w-64 md:focus:w-80"
                    />
                </div>

                <div className="hidden md:block h-6 w-px bg-slate-700"></div>

                {/* Date Range */}
                <button className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 transition-colors">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs md:text-sm whitespace-nowrap">Last 30 Days</span>
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
