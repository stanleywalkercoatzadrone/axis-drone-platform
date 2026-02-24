import apiClient from './apiClient';

export const userService = {
    async getUsers() {
        const response = await apiClient.get('/users');
        return response.data.data;
    },

    async createUser(data: any) {
        const response = await apiClient.post('/users', data);
        return response.data.data;
    },

    async batchCreateUsers(users: any[]) {
        const response = await apiClient.post('/users/batch', { users });
        return response.data.data;
    },

    async updateUser(id: string, data: any) {
        const response = await apiClient.put(`/users/${id}`, data);
        return response.data.data;
    },

    async deleteUser(id: string) {
        await apiClient.delete(`/users/${id}`);
    }
};
