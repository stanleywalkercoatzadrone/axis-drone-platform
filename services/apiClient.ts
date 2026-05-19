import axios from 'axios';

const API_URL = '/api';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

// Request interceptor — reads token from sessionStorage (cleared on window close)
apiClient.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('skylens_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — handles 401 + token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = sessionStorage.getItem('skylens_refresh_token');
            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
                    const { token, refreshToken: newRefreshToken } = response.data.data;
                    sessionStorage.setItem('skylens_token', token);
                    if (newRefreshToken) sessionStorage.setItem('skylens_refresh_token', newRefreshToken);

                    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                } catch (refreshError) {
                    console.error('Refresh token expired or invalid', refreshError);
                }
            }

            // No refresh token or refresh failed — clear session and redirect to login
            sessionStorage.removeItem('skylens_token');
            sessionStorage.removeItem('skylens_refresh_token');
            sessionStorage.removeItem('skylens_current_user');

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
