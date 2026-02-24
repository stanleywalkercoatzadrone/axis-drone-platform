import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { UserAccount, UserRole } from '../../types';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserAccount | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('skylens_token');
            const storedUser = localStorage.getItem('skylens_current_user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));

                // Valid and sync with backend
                try {
                    const response = await apiClient.get('/auth/me');
                    if (response.data.success) {
                        const userData = response.data.data;
                        setUser(userData);
                        localStorage.setItem('skylens_current_user', JSON.stringify(userData));
                    }
                } catch (error) {
                    console.error('Session validation failed:', error);
                    // Don't auto-logout here to handle offline scenarios gracefully
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = (userData: UserAccount, newToken: string, newRefreshToken: string) => {
        localStorage.setItem('skylens_token', newToken);
        localStorage.setItem('skylens_refresh_token', newRefreshToken);
        localStorage.setItem('skylens_current_user', JSON.stringify(userData));

        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('skylens_token');
        localStorage.removeItem('skylens_refresh_token');
        localStorage.removeItem('skylens_current_user');

        setToken(null);
        setUser(null);
        apiClient.post('/auth/logout').catch(() => { }); // Fire and forget
        window.location.href = '/';
    };

    const updateUser = (userData: UserAccount) => {
        localStorage.setItem('skylens_current_user', JSON.stringify(userData));
        setUser(userData);
    }

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
            isAuthenticated: !!user && !!token,
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
