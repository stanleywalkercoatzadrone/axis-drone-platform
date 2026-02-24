import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import { useMission } from './MissionContext';

// Types for our Global State
export type Industry = 'Solar' | 'Telecom' | 'Insurance' | 'Construction' | 'Utility';

export interface DateRange {
    start: Date | null;
    end: Date | null;
}

export interface GlobalState {
    selectedIndustry: Industry;
    selectedClientId: string | null;
    selectedSiteId: string | null;
    activeCountryId: string | null;
    dateRange: DateRange;
    isSidebarOpen: boolean;
}

export interface GlobalContextType extends GlobalState {
    setIndustry: (industry: Industry) => void;
    setClient: (clientId: string | null) => void;
    setSite: (siteId: string | null) => void;
    setCountry: (countryId: string | null) => void;
    setDateRange: (range: DateRange) => void;
    toggleSidebar: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    const { mission, setMission } = useMission();

    // System-level state
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

    const setIndustry = useCallback((industry: Industry) =>
        setMission(m => ({ ...m, industry })), [setMission]);

    const setClient = useCallback((clientId: string | null) =>
        setMission(m => ({ ...m, client: clientId })), [setMission]);

    const setSite = useCallback((siteId: string | null) =>
        setMission(m => ({ ...m, site: siteId })), [setMission]);

    const setCountry = useCallback((countryId: string | null) =>
        setMission(m => ({ ...m, country: countryId })), [setMission]);

    const value = useMemo(() => ({
        selectedIndustry: (mission.industry as Industry) || 'Solar',
        selectedClientId: mission.client,
        selectedSiteId: mission.site,
        activeCountryId: mission.country,
        dateRange,
        isSidebarOpen,
        setIndustry,
        setClient,
        setSite,
        setCountry,
        setDateRange,
        toggleSidebar
    }), [mission, dateRange, isSidebarOpen, setIndustry, setClient, setSite, setCountry, toggleSidebar]);

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobalContext = () => {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobalContext must be used within a GlobalProvider');
    }
    return context;
};
