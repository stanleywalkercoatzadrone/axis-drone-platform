import apiClient from './apiClient';

export const systemService = {
    async getSettings() {
        const response = await apiClient.get('/system/settings');
        return response.data.data;
    },

    async updateSetting(key: string, value: string, encrypted: boolean = false) {
        const response = await apiClient.put('/system/settings', { key, value, encrypted });
        return response.data.data;
    },

    async linkMasterDrive(code: string) {
        const response = await apiClient.post('/system/master-drive/link', { code });
        return response.data;
    },

    async unlinkMasterDrive() {
        const response = await apiClient.post('/system/master-drive/unlink');
        return response.data;
    },

    async getMasterDriveAuthUrl() {
        const response = await apiClient.get('/auth/google');
        return response.data.data.authUrl;
    }
};
