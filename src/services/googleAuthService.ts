import apiClient from './apiClient';

export const googleAuthService = {
    async getAuthUrl() {
        const response = await apiClient.get('/auth/google');
        return response.data.data.authUrl;
    },

    async linkGoogleDrive(code: string) {
        const response = await apiClient.post('/auth/google/link', { code });
        const user = response.data.data;
        localStorage.setItem('skylens_current_user', JSON.stringify(user));
        return user;
    },

    async unlinkGoogleDrive() {
        const response = await apiClient.post('/auth/google/unlink');
        const user = response.data.data;
        localStorage.setItem('skylens_current_user', JSON.stringify(user));
        return user;
    },

    initiateGoogleAuth(onSuccess?: (user: any) => void) {
        // Open Google OAuth in popup
        const width = 500;
        const height = 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        this.getAuthUrl().then(authUrl => {
            const popup = window.open(
                authUrl,
                'Google Drive Authorization',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            // Listen for OAuth callback
            const checkPopup = setInterval(() => {
                try {
                    if (popup && popup.closed) {
                        clearInterval(checkPopup);
                    }

                    if (popup && popup.location.href.includes('code=')) {
                        const url = new URL(popup.location.href);
                        const code = url.searchParams.get('code');
                        if (code) {
                            this.linkGoogleDrive(code).then((user) => {
                                if (onSuccess) onSuccess(user);
                            });
                            popup.close();
                            clearInterval(checkPopup);
                        }
                    }
                } catch (e) {
                    // Cross-origin error - expected until redirect
                }
            }, 500);
        });
    }
};
