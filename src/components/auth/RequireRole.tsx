import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { normalizeRole } from '../../utils/roleUtils';

interface RequireRoleProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

export const RequireRole: React.FC<RequireRoleProps> = ({ children, allowedRoles }) => {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    // Wait for session validation to complete before making auth decisions.
    // Without this, the component redirects to /auth while /auth/me is still in-flight.
    if (isLoading) {
        return null;
    }

    if (!isAuthenticated || !user) {
        // Redirect to login but save the attempted url
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Normalize the user's role (handles FIELD_OPERATOR → field_operator, etc.)
    const normalizedUserRole = normalizeRole(user.role);

    if (!normalizedUserRole || !allowedRoles.includes(normalizedUserRole)) {
        // Attempted to access a module off-limits to this role — bounce back
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default RequireRole;
