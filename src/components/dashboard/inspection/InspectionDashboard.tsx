import React from 'react';

export function InspectionDashboard() {
    return (
        <div className="w-full h-full bg-slate-900 text-white p-6 space-y-6">
            <header className="border-b border-slate-800 pb-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">
                    Axis Solar Inspection Report
                </h1>
                <p className="text-slate-400 text-sm mt-1">Powered by CoatzadroneUSA Enterprise Standards</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Executive Summary Card */}
                <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold mb-4">Executive Summary</h2>
                    <p className="text-slate-300">
                        Analysis has completed across the selected aerial mission. Standard compliance checks against NEC (NFPA 70) and IEC 62446 have been automatically evaluated by the Axis Solar AI Engine.
                    </p>
                </div>

                {/* Score Card */}
                <div className="bg-slate-800 border fill-red-500 border-red-500/30 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                       <span className="bg-red-500/20 text-red-500 text-xs px-2 py-1 rounded">CRITICAL</span>
                    </div>
                    <div className="text-5xl font-black text-rose-500 mb-2 mt-4">84/100</div>
                    <div className="text-slate-400 font-medium">Site Health Score</div>
                </div>
            </div>

            {/* Findings */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 min-h-[400px]">
                <h2 className="text-xl font-bold mb-6">Thermal & Compliance Breakdown</h2>
                <div className="text-slate-500 text-center mt-20">
                    <p>Select an analysis dataset to populate compliance diagnostics...</p>
                </div>
            </div>
        </div>
    );
}
