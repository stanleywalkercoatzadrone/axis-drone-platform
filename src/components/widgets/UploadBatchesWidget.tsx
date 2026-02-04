import React from 'react';
import { UploadCloud, CheckCircle2, RotateCw, XCircle } from 'lucide-react';

interface BatchItem {
    id: string;
    name: string;
    files: number;
    status: 'processing' | 'completed' | 'failed';
    progress: number;
    user: string;
    time: string;
}

export const UploadBatchesWidget: React.FC = () => {
    const batches: BatchItem[] = [
        { id: '1', name: 'Site FL-204 Inspection', files: 124, status: 'processing', progress: 65, user: 'John D.', time: '5m ago' },
        { id: '2', name: 'Tower A1 Supplemental', files: 12, status: 'completed', progress: 100, user: 'Sarah M.', time: '2h ago' },
        { id: '3', name: 'Utility Corridor B', files: 450, status: 'failed', progress: 45, user: 'Mike R.', time: '4h ago' },
        { id: '4', name: 'Roof Inspect - Sec 4', files: 89, status: 'completed', progress: 100, user: 'John D.', time: '1d ago' },
    ];

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-slate-400" />
                    Recent Uploads
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-800/50">
                    {batches.map((batch) => (
                        <div key={batch.id} className="px-6 py-4 hover:bg-slate-800/30 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-slate-200">{batch.name}</span>
                                {batch.status === 'processing' && (
                                    <div className="flex items-center gap-1.5 text-xs text-cyan-400">
                                        <RotateCw className="w-3 h-3 animate-spin" />
                                        {batch.progress}%
                                    </div>
                                )}
                                {batch.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                {batch.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`h-full rounded-full ${batch.status === 'failed' ? 'bg-red-500' :
                                            batch.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-500'
                                        }`}
                                    style={{ width: `${batch.progress}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                                <span>{batch.files} files • {batch.user}</span>
                                <span>{batch.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
