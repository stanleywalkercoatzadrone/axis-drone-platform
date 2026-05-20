import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { UserAccount, UserRole } from '../types';

interface AuthContextType {
    user: UserAccount | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (userData: UserAccount, token: string, refreshToken: string) => void;
    logout: () => void;
    updateUser: (userData: UserAccount) => void;
    syncProfile: () => Promise<UserAccount | undefined>;
    hasPermission: (permission: string) => boolean;
    hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// sessionStorage is cleared automatically when the browser window/tab is closed,
// requiring a new login on every fresh window open.
const getStoredUser = (): UserAccount | null => {
    try {
        const raw = sessionStorage.getItem('skylens_current_user');
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};
const getStoredToken = (): string | null => sessionStorage.getItem('skylens_token');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Synchronous init — user and token are read from sessionStorage BEFORE first render
    const [user, setUser] = useState<UserAccount | null>(getStoredUser);
    const [token, setToken] = useState<string | null>(getStoredToken);
    // Start as true so the app waits for session validation before rendering protected routes
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedToken = sessionStorage.getItem('skylens_token');
        if (!storedToken) {
            // No token in sessionStorage — not logged in, show login immediately
            setIsLoading(false);
            return;
        }

        // Token exists — silently validate it against the server (refreshes user data)
        const validateSession = async () => {
            try {
                const response = await apiClient.get('/auth/me');
                if (response.data.success) {
                    const userData = response.data.data;
                    setUser(userData);
                    sessionStorage.setItem('skylens_current_user', JSON.stringify(userData));
                }
            } catch (error: any) {
                // Only wipe session on a definitive 401 — don't log out on network glitches
                const status = error?.response?.status;
                if (status === 401) {
                    sessionStorage.removeItem('skylens_token');
                    sessionStorage.removeItem('skylens_refresh_token');
                    sessionStorage.removeItem('skylens_current_user');
                    setToken(null);
                    setUser(null);
                }
            } finally {
                setIsLoading(false);
            }
        };

        validateSession();
    }, []);

    const login = (userData: UserAccount, newToken: string, newRefreshToken: string) => {
        sessionStorage.setItem('skylens_token', newToken);
        sessionStorage.setItem('skylens_refresh_token', newRefreshToken);
        sessionStorage.setItem('skylens_current_user', JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        apiClient.post('/auth/logout').catch(() => { });
        sessionStorage.removeItem('skylens_token');
        sessionStorage.removeItem('skylens_refresh_token');
        sessionStorage.removeItem('skylens_current_user');
        setToken(null);
        setUser(null);
        window.location.href = '/login';
    };

    const updateUser = (userData: UserAccount) => {
        sessionStorage.setItem('skylens_current_user', JSON.stringify(userData));
        setUser(userData);
    };

    const syncProfile = async () => {
        try {
            const response = await apiClient.get('/auth/me');
            if (response.data.success) {
                updateUser(response.data.data);
                return response.data.data;
            }
        } catch (error) {
            console.error('Sync profile failed:', error);
            throw error;
        }
    };

    const hasPermission = (permission: string) => {
        if (!user) return false;
        if (user.role === UserRole.ADMIN || user.effectiveRoles?.includes('internal_admin')) return true;
        return user.permissions?.includes(permission as any) || false;
    };

    const hasRole = (role: string) => {
        if (!user) return false;
        if (user.role === role) return true;
        return user.effectiveRoles?.includes(role) || false;
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            // isAuthenticated is true when user is set — the HttpOnly cookie is the
            // real credential (JS cannot read it). Token in state is a fallback sync
            // indicator but must NOT gate access after a page refresh/new tab.
            isAuthenticated: !!user,
            login,
            logout,
            updateUser,
            syncProfile,
            hasPermission,
            hasRole
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
