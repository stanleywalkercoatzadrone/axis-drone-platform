export interface OrthoJob {
    id: string;
    missionId?: string;
    name?: string;
    status?: 'queued' | 'processing' | 'completed' | 'failed' | string;
    progress?: number;
    createdAt?: string;
    fileCount?: number;
}
