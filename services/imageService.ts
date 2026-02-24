import apiClient from './apiClient';

export const imageService = {
    async uploadImage(reportId: string, file: File) {
        return this.uploadImages(reportId, [file]);
    },

    async uploadImages(reportId: string, files: File[]) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file); // Use 'files' plural to match backend
        });
        formData.append('reportId', reportId);

        const response = await apiClient.post('/images/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data.data;
    },

    async analyzeImage(imageId: string, industry: string, sensitivity: number = 50) {
        const response = await apiClient.post(`/images/${imageId}/analyze`, {
            industry,
            sensitivity
        });
        return response.data.data;
    },

    async updateAnnotations(imageId: string, annotations: any[]) {
        const response = await apiClient.put(`/images/${imageId}/annotations`, {
            annotations
        });
        return response.data.data;
    },

    async deleteImage(imageId: string) {
        await apiClient.delete(`/images/${imageId}`);
    }
};
