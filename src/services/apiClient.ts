import axios from 'axios';

const API_URL = '/api';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true  // Required: sends HttpOnly cookies with every request
});

// Request interceptor: remove Content-Type for FormData so browser sets correct multipart boundary
apiClient.interceptors.request.use(
    (config) => {
        if (config.data instanceof FormData) {
            if (typeof (config.headers as any).delete === 'function') {
                (config.headers as any).delete('Content-Type');
            } else {
                delete (config.headers as any)['Content-Type'];
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: normalize common collection aliases and on 401 redirect to login
// Tokens are HttpOnly cookies managed by the server — no localStorage needed
apiClient.interceptors.response.use(
    (response) => {
        const payload = response.data;
        if (payload && typeof payload === 'object' && payload.success) {
            if (Array.isArray(payload.data)) {
                payload.items ??= payload.data;
                payload.jobs ??= payload.data;
            } else if (Array.isArray(payload.jobs) && payload.data === undefined) {
                payload.data = payload.jobs;
                payload.items ??= payload.jobs;
            } else if (Array.isArray(payload.items) && payload.data === undefined) {
                payload.data = payload.items;
                payload.jobs ??= payload.items;
            }
        }
        return response;
    },
    async (error) => {
        if (error.response?.status === 401) {
            const PUBLIC_ROUTES = ['/invoice/', '/onboarding/', '/set-password/'];
            const isPublicRoute = PUBLIC_ROUTES.some(r => window.location.pathname.startsWith(r));
            if (window.location.pathname !== '/' && !isPublicRoute) {
                // Clear any legacy localStorage tokens from before the HttpOnly cookie migration
                localStorage.removeItem('skylens_token');
                localStorage.removeItem('skylens_refresh_token');
                localStorage.removeItem('skylens_current_user');
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
