import apiClient from './apiClient';

/**
 * AI Service for Frontend
 * Interacts with backend AI analysis endpoints
 */
export const aiAnalysisService = {
    /**
     * Analyze an inspection report
     * @param {string} reportId
     * @param {object} data - { industry, client, images, metadata }
     */
    analyzeInspection: async (reportId: string, data: any) => {
        return apiClient.post('/v1/analyze/report', { reportId, ...data });
    },

    /**
     * Analyze an image for anomalies
     * @param {string} imageUrl
     * @param {object} data - { industry, context }
     */
    analyzeImage: async (imageUrl: string, data: any) => {
        return apiClient.post('/v1/analyze/image', { imageUrl, ...data });
    },

    /**
     * Validate mission readiness
     * @param {string} deploymentId
     * @param {object} data - { assets, personnel, weather, regulations }
     */
    validateMissionReadiness: async (deploymentId: string, data: any) => {
        return apiClient.post('/v1/analyze/mission', { deploymentId, ...data });
    },

    /**
     * Get daily operational summary
     * @param {string} date - YYYY-MM-DD
     */
    getDailySummary: async (date: string) => {
        return apiClient.get(`/v1/analyze/daily-summary?date=${date}`);
    },

    /**
     * Get AI system health
     */
    getHealth: async () => {
        return apiClient.get('/v1/health');
    }
};
