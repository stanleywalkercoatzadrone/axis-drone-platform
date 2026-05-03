import apiClient from '../../services/apiClient';
import type { OrthoJob } from './types';

export const orthoApi = {
    async listJobs(missionId?: string): Promise<OrthoJob[]> {
        try {
            const res = await apiClient.get('/pilot/upload-jobs', {
                params: { missionId, uploadType: 'orthomosaic', limit: 25 },
            });
            const rows = res.data?.jobs || res.data?.data || [];
            return rows.map((row: any) => ({
                id: row.id,
                missionId: row.mission_id || row.missionId,
                name: row.mission_folder || row.site_name || row.id,
                status: row.status || 'queued',
                progress: row.processed_count && row.file_count ? Math.round((row.processed_count / row.file_count) * 100) : undefined,
                createdAt: row.created_at || row.createdAt,
                fileCount: row.file_count || row.fileCount,
            }));
        } catch {
            return [];
        }
    },
};
