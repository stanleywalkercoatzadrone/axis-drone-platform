import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../services/apiClient';

interface Country {
    id: string;
    name: string;
    iso_code: string;
    region_id: string;
    region_name: string;
    currency: string;
    units_of_measurement: string;
    aviation_authority: string;
    status: 'ENABLED' | 'DISABLED';
}

interface Region {
    id: string;
    name: string;
}

interface CountryContextType {
    activeCountryId: string | null;
    setActiveCountryId: (id: string | null) => void;
    activeCountry: Country | null;
    countries: Country[];
    regions: Region[];
    loading: boolean;
    refreshCountries: () => Promise<void>;
}

export const CountryContext = createContext<CountryContextType | undefined>(undefined);

export const CountryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeCountryId, setActiveCountryIdState] = useState<string | null>(() => {
        return localStorage.getItem('axis_active_country_id');
    });
    const [countries, setCountries] = useState<Country[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);

    const setActiveCountryId = (id: string | null) => {
        setActiveCountryIdState(id);
        if (id) {
            localStorage.setItem('axis_active_country_id', id);
        } else {
            localStorage.removeItem('axis_active_country_id');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [countriesRes, regionsRes] = await Promise.all([
                apiClient.get('/regions/countries?status=ENABLED'),
                apiClient.get('/regions')
            ]);

            if (countriesRes.data.success) {
                setCountries(countriesRes.data.data);
            }
            if (regionsRes.data.success) {
                setRegions(regionsRes.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch country context:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const activeCountry = countries.find(c => c.id === activeCountryId) || null;

    // Validation: If active country is no longer available (e.g. disabled), reset it
    // Only reset if we have successfully loaded a list of countries (length > 0)
    // This prevents clearing the preference if the API fails or returns empty temporarily
    useEffect(() => {
        if (!loading && activeCountryId && !activeCountry && countries.length > 0) {
            setActiveCountryId(null);
        }
    }, [loading, activeCountryId, activeCountry, countries.length]);

    return (
        <CountryContext.Provider value={{
            activeCountryId,
            setActiveCountryId,
            activeCountry,
            countries,
            regions,
            loading,
            refreshCountries: fetchData
        }}>
            {children}
        </CountryContext.Provider>
    );
};

export const useCountry = () => {
    const context = useContext(CountryContext);
    if (context === undefined) {
        throw new Error('useCountry must be used within a CountryProvider');
    }
    return context;
};


