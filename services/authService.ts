import apiClient from './apiClient';

export const authService = {
    async register(data: { email: string; password: string; fullName: string; companyName?: string; title?: string }) {
        const response = await apiClient.post('/auth/register', data);
        const { user, token, refreshToken } = response.data.data;

        sessionStorage.setItem('skylens_token', token);
        sessionStorage.setItem('skylens_refresh_token', refreshToken);
        sessionStorage.setItem('skylens_current_user', JSON.stringify(user));

        return user;
    },

    async login(email: string, password: string) {
        const response = await apiClient.post('/auth/login', { email, password });
        const { user, token, refreshToken } = response.data.data;

        sessionStorage.setItem('skylens_token', token);
        sessionStorage.setItem('skylens_refresh_token', refreshToken);
        sessionStorage.setItem('skylens_current_user', JSON.stringify(user));

        return user;
    },

    async logout() {
        try {
            await apiClient.post('/auth/logout');
        } finally {
            sessionStorage.removeItem('skylens_token');
            sessionStorage.removeItem('skylens_refresh_token');
            sessionStorage.removeItem('skylens_current_user');
        }
    },

    async getMe() {
        const response = await apiClient.get('/auth/me');
        const user = response.data.data;
        sessionStorage.setItem('skylens_current_user', JSON.stringify(user));
        return user;
    },

    getCurrentUser() {
        const userStr = sessionStorage.getItem('skylens_current_user');
        return userStr ? JSON.parse(userStr) : null;
    },

    isAuthenticated() {
        return !!sessionStorage.getItem('skylens_token');
    }
};
