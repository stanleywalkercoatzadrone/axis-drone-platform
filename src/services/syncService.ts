import apiClient from './apiClient';

export const syncService = {
    async syncToVault(reportId: string) {
        const response = await apiClient.post('/sync/vault', { reportId });
        return response.data.data;
    },

    async getSyncLogs(reportId: string) {
        const response = await apiClient.get(`/sync/logs/${reportId}`);
        return response.data.data;
    }
};
