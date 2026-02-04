import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    dateRange: DateRange;
    isSidebarOpen: boolean;
}

export interface GlobalContextType extends GlobalState {
    setIndustry: (industry: Industry) => void;
    setClient: (clientId: string | null) => void;
    setSite: (siteId: string | null) => void;
    setDateRange: (range: DateRange) => void;
    toggleSidebar: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// Helper to persist state to URL
const updateUrlParams = (state: GlobalState) => {
    const params = new URLSearchParams(window.location.search);
    params.set('industry', state.selectedIndustry);
    if (state.selectedClientId) params.set('client', state.selectedClientId);
    else params.delete('client');

    if (state.selectedSiteId) params.set('site', state.selectedSiteId);
    else params.delete('site');

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
};

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    // Initialize from URL or LocalStorage
    const params = new URLSearchParams(window.location.search);

    const [selectedIndustry, setSelectedIndustry] = useState<Industry>(
        (params.get('industry') as Industry) || 'Solar'
    );
    const [selectedClientId, setSelectedClientId] = useState<string | null>(
        params.get('client') || null
    );
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
        params.get('site') || null
    );
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Sync to URL on change
    useEffect(() => {
        updateUrlParams({
            selectedIndustry,
            selectedClientId,
            selectedSiteId,
            dateRange,
            isSidebarOpen
        });

        // Also sync to localStorage for persistence across sessions
        localStorage.setItem('axis_context', JSON.stringify({
            industry: selectedIndustry,
            client: selectedClientId,
            site: selectedSiteId
        }));
    }, [selectedIndustry, selectedClientId, selectedSiteId]);

    const value = {
        selectedIndustry,
        selectedClientId,
        selectedSiteId,
        dateRange,
        isSidebarOpen,
        setIndustry: setSelectedIndustry,
        setClient: setSelectedClientId,
        setSite: setSelectedSiteId,
        setDateRange: setDateRange,
        toggleSidebar: () => setIsSidebarOpen(prev => !prev)
    };

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
