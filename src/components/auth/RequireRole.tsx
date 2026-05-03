import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

interface RequireRoleProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

export const RequireRole: React.FC<RequireRoleProps> = ({ children, allowedRoles }) => {
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated || !user) {
        // Redirect to login but save the attempted url
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // Enforce role-based strict routing (e.g., Pilot Terminal V2)
    if (!allowedRoles.includes(user.role)) {
        // Attempted to explicitly access a module off-limits to current role mapping. Bounce them backwards.
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default RequireRole;
