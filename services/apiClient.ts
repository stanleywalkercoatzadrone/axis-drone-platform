import axios from 'axios';

const API_URL = '/api';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('skylens_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors and token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('skylens_refresh_token');
            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
                    const { token, refreshToken: newRefreshToken } = response.data.data;
                    localStorage.setItem('skylens_token', token);
                    if (newRefreshToken) localStorage.setItem('skylens_refresh_token', newRefreshToken);

                    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                } catch (refreshError) {
                    console.error('Refresh token expired or invalid', refreshError);
                }
            }

            // If no refresh token or refresh failed, clear everything and redirect
            localStorage.removeItem('skylens_token');
            localStorage.removeItem('skylens_refresh_token');
            localStorage.removeItem('skylens_current_user');

            // Public routes that should NOT force a redirect to login if a background call fails
            const PUBLIC_ROUTES = ['/invoice/', '/onboarding/', '/set-password/'];
            const isPublicRoute = PUBLIC_ROUTES.some(route => window.location.pathname.startsWith(route));

            if (window.location.pathname !== '/' && !isPublicRoute) {
                window.location.href = '/';
            }
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default apiClient;
