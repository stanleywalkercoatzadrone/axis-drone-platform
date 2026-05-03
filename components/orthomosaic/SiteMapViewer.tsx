import React from 'react';
import { Map, Navigation } from 'lucide-react';

export const SiteMapViewer: React.FC<{ jobId?: string }> = ({ jobId }) => {
    return (
        <div className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden bg-slate-950">
            <div className="absolute inset-0 opacity-40" style={{
                backgroundImage:
                    'linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
            }} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.18),transparent_55%)]" />
            <div className="relative rounded-lg border border-white/10 bg-slate-900/85 px-6 py-5 text-center shadow-2xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300">
                    <Map className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Site Map Viewer</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-400">
                    Orthomosaic map layers will render here when a processed map source is attached.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-500">
                    <Navigation className="h-3.5 w-3.5" />
                    {jobId || 'No job selected'}
                </div>
            </div>
        </div>
    );
};
