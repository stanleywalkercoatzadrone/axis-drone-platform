import React, { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { orthoApi } from './api';
import type { OrthoJob } from './types';

interface ProcessingJobsProps {
    missionId?: string;
    onViewMap?: (jobId: string) => void;
    onViewUpload?: (job: OrthoJob) => void;
}

export const ProcessingJobs: React.FC<ProcessingJobsProps> = ({ missionId, onViewMap, onViewUpload }) => {
    const [jobs, setJobs] = useState<OrthoJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        orthoApi.listJobs(missionId).then(next => {
            if (mounted) setJobs(next);
        }).finally(() => {
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, [missionId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading processing jobs...
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
                <AlertCircle className="mb-3 h-6 w-6" />
                <p className="text-sm font-semibold text-slate-400">No orthomosaic jobs found</p>
                <p className="mt-1 text-xs">Upload GeoTIFF or map output files to start tracking this mission.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {jobs.map(job => (
                <div key={job.id} className="rounded-lg border border-white/10 bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{job.name || job.id}</p>
                            <p className="text-xs text-slate-500">
                                {job.fileCount || 0} files · {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'No date'}
                            </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">
                            {job.status || 'queued'}
                        </span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-slate-800">
                        <div className="h-1.5 rounded-full bg-sky-400" style={{ width: `${job.progress ?? 0}%` }} />
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => onViewUpload?.(job)} className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">
                            Details
                        </button>
                        <button type="button" onClick={() => onViewMap?.(job.id)} className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/25">
                            <ExternalLink className="h-3 w-3" />
                            Map
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
