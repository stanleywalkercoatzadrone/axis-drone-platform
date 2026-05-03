import React from 'react';
import { Layers, Map, Upload } from 'lucide-react';
import UploadCenter from './UploadCenter';

const OrthomosaicView: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-slate-900 p-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300">
                        <Map className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Orthomosaic Processing</h2>
                        <p className="text-sm text-slate-400">Upload GeoTIFFs and processed site map deliverables for mission review.</p>
                    </div>
                </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <aside className="rounded-lg border border-white/10 bg-slate-900 p-5">
                    <Layers className="mb-3 h-5 w-5 text-emerald-400" />
                    <h3 className="font-semibold text-white">Processing Queue</h3>
                    <p className="mt-2 text-sm text-slate-500">
                        Orthomosaic jobs flow through the standard upload center until a dedicated processing service is configured.
                    </p>
                    <div className="mt-5 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
                        <Upload className="h-4 w-4" />
                        GeoTIFF, TIFF, JPG, PNG
                    </div>
                </aside>
                <UploadCenter />
            </div>
        </div>
    );
};

export default OrthomosaicView;
