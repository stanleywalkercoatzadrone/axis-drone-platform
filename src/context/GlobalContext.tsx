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
    hideSidebarTitles: boolean;
    hiddenSections: Record<string, boolean>;
    hiddenItems: Record<string, boolean>;
}

export interface GlobalContextType extends GlobalState {
    setIndustry: (industry: Industry) => void;
    setClient: (clientId: string | null) => void;
    setSite: (siteId: string | null) => void;
    setCountry: (countryId: string | null) => void;
    setDateRange: (range: DateRange) => void;
    toggleSidebar: () => void;
    setHideSidebarTitles: (hide: boolean) => void;
    toggleSectionVisibility: (sectionKey: string) => void;
    toggleItemVisibility: (itemKey: string) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    const { mission, setMission } = useMission();

    // System-level state
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [hideSidebarTitles, setHideSidebarTitles] = useState(() => localStorage.getItem('hide_sidebar_titles') === 'true');
    const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('hidden_sidebar_sections');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const [hiddenItems, setHiddenItems] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('hidden_sidebar_items');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

    const setIndustry = useCallback((industry: Industry) =>
        setMission(m => ({ ...m, industry })), [setMission]);

    const setClient = useCallback((clientId: string | null) =>
        setMission(m => ({ ...m, client: clientId })), [setMission]);

    const setSite = useCallback((siteId: string | null) =>
        setMission(m => ({ ...m, site: siteId })), [setMission]);

    const setCountry = useCallback((countryId: string | null) =>
        setMission(m => ({ ...m, country: countryId })), [setMission]);

    const toggleSectionVisibility = useCallback((sectionKey: string) => {
        setHiddenSections(prev => {
            const next = { ...prev, [sectionKey]: !prev[sectionKey] };
            localStorage.setItem('hidden_sidebar_sections', JSON.stringify(next));
            return next;
        });
    }, []);

    const toggleItemVisibility = useCallback((itemKey: string) => {
        setHiddenItems(prev => {
            const next = { ...prev, [itemKey]: !prev[itemKey] };
            localStorage.setItem('hidden_sidebar_items', JSON.stringify(next));
            return next;
        });
    }, []);

    const value = useMemo(() => ({
        selectedIndustry: (mission.industry as Industry) || 'Solar',
        selectedClientId: mission.client,
        selectedSiteId: mission.site,
        activeCountryId: mission.country,
        dateRange,
        isSidebarOpen,
        hideSidebarTitles,
        hiddenSections,
        hiddenItems,
        setIndustry,
        setClient,
        setSite,
        setCountry,
        setDateRange,
        toggleSidebar,
        setHideSidebarTitles,
        toggleSectionVisibility,
        toggleItemVisibility
    }), [mission, dateRange, isSidebarOpen, hideSidebarTitles, hiddenSections, hiddenItems, setIndustry, setClient, setSite, setCountry, toggleSidebar, toggleSectionVisibility, toggleItemVisibility]);


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
