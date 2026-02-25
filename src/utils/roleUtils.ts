/**
 * Role Normalization Utilities (Frontend)
 * 
 * Mirrors backend role normalization to ensure consistent role handling
 * across the entire application stack.
 */

import { UserAccount } from '../../types';

/**
 * Normalize a role string to standard format
 * @param roleString - Raw role string from API/token
 * @returns Normalized role or null if invalid
 */
export function normalizeRole(roleString: string | undefined | null): string | null {
    if (!roleString) return null;

    // Convert to lowercase and replace slashes/spaces with underscores
    const normalized = roleString.toLowerCase().replace(/[\/\s-]/g, '_');

    // Map variants to standard roles
    if (['admin', 'administrator'].includes(normalized)) {
        return 'admin';
    }

    if (['pilot_technician', 'pilot', 'technician'].includes(normalized)) {
        return 'pilot_technician';
    }

    if (['client', 'client_user', 'customer'].includes(normalized)) {
        return 'client';
    }

    // Default all other legacy roles to in-house personnel to restrict access
    return 'in_house_personnel';
}

/**
 * Check if user has admin role
 * @param user - User object with role property
 * @returns true if user is admin
 */
export function isAdmin(user: UserAccount | null | undefined): boolean {
    return normalizeRole(user?.role) === 'admin';
}

/**
 * Check if user has pilot_technician role
 * @param user - User object with role property
 * @returns true if user is pilot/technician
 */
export function isPilot(user: UserAccount | null | undefined): boolean {
    return normalizeRole(user?.role) === 'pilot_technician';
}

/**
 * Check if user has client role
 * @param user - User object with role property
 * @returns true if user is client
 */
export function isClient(user: UserAccount | null | undefined): boolean {
    return normalizeRole(user?.role) === 'client';
}

/**
 * Check if user has in-house personnel role
 * @param user - User object with role property
 * @returns true if user is in-house personnel
 */
export function isInHouse(user: UserAccount | null | undefined): boolean {
    return normalizeRole(user?.role) === 'in_house_personnel';
}

/**
 * Check if user has any of the specified roles
 * @param user - User object with role property
 * @param roles - Array of role strings to check
 * @returns true if user has any of the roles
 */
export function hasAnyRole(user: UserAccount | null | undefined, roles: string[]): boolean {
    const userRole = normalizeRole(user?.role);
    return roles.some(role => normalizeRole(role) === userRole);
}

/**
 * Get display name for a role
 * @param role - Role string
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: string | undefined | null): string {
    const normalized = normalizeRole(role);

    const displayNames: Record<string, string> = {
        'admin': 'Administrator',
        'pilot_technician': 'Pilot/Technician',
        'client': 'Client',
        'in_house_personnel': 'In-House Personnel'
    };

    return displayNames[normalized || ''] || normalized || 'Unknown';
}
