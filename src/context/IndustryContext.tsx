import React, { createContext, useContext, useState, useEffect } from 'react';
import { INDUSTRY_CONFIG, getIndustryLabels, IndustryKey, IndustryLabels } from '../config/industryConfig';

interface IndustryContextType {
    currentIndustry: IndustryKey | null;
    setIndustry: (key: IndustryKey) => void;
    labels: IndustryLabels;
    tLabel: (key: keyof IndustryLabels) => string;
    availableIndustries: { key: IndustryKey; name: string }[];
}

const IndustryContext = createContext<IndustryContextType | undefined>(undefined);

export const IndustryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentIndustry, setCurrentIndustry] = useState<IndustryKey | null>(null);

    useEffect(() => {
        const storedIndustry = localStorage.getItem('axis_selected_industry');
        if (storedIndustry && INDUSTRY_CONFIG[storedIndustry as IndustryKey]) {
            setCurrentIndustry(storedIndustry as IndustryKey);
        } else {
            // Default to null (Global View) or a specific default if desired
            setCurrentIndustry('default');
        }
    }, []);

    const setIndustry = (key: IndustryKey) => {
        setCurrentIndustry(key);
        localStorage.setItem('axis_selected_industry', key);
        // Optionally trigger a refresh or event here if needed
    };

    const labels = getIndustryLabels(currentIndustry);

    const tLabel = (key: keyof IndustryLabels) => {
        return labels[key] || key;
    };

    const availableIndustries = Object.keys(INDUSTRY_CONFIG).map((key) => ({
        key: key as IndustryKey,
        name: INDUSTRY_CONFIG[key as IndustryKey].name,
    }));

    return (
        <IndustryContext.Provider
            value={{
                currentIndustry,
                setIndustry,
                labels,
                tLabel,
                availableIndustries,
            }}
        >
            {children}
        </IndustryContext.Provider>
    );
};

export const useIndustry = () => {
    const context = useContext(IndustryContext);
    if (context === undefined) {
        throw new Error('useIndustry must be used within an IndustryProvider');
    }
    return context;
};
