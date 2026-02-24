import apiClient from './apiClient';
import type { InspectionReport } from '../types';

export const reportService = {
    async getReports(filters?: { status?: string; industry?: string }) {
        const response = await apiClient.get('/reports', { params: filters });
        return response.data.data;
    },

    async getReport(id: string) {
        const response = await apiClient.get(`/reports/${id}`);
        return response.data.data;
    },

    async createReport(data: Partial<InspectionReport>) {
        const response = await apiClient.post('/reports', data);
        return response.data.data;
    },

    async updateReport(id: string, data: Partial<InspectionReport>) {
        const response = await apiClient.put(`/reports/${id}`, data);
        return response.data.data;
    },

    async finalizeReport(id: string) {
        const response = await apiClient.post(`/reports/${id}/finalize`);
        return response.data.data;
    },

    async deleteReport(id: string) {
        await apiClient.delete(`/reports/${id}`);
    }
};
