import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

export interface MissionState {
    client: string | null;
    site: string | null;
    country: string | null;
    portfolio: string | null;
    industry: string | null;
}

interface MissionContextType {
    mission: MissionState;
    setMission: React.Dispatch<React.SetStateAction<MissionState>>;
}

const MissionContext = createContext<MissionContextType | undefined>(undefined);

export const MissionProvider = ({ children }: { children: ReactNode }) => {
    const [mission, setMission] = useState<MissionState>({
        client: null,
        site: null,
        country: null,
        portfolio: null,
        industry: null,
    });

    // Load saved state
    useEffect(() => {
        const saved = localStorage.getItem("axis-mission");
        if (saved) {
            try {
                setMission(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse axis-mission from localStorage", e);
            }
        }
    }, []);

    // Persist state
    useEffect(() => {
        localStorage.setItem("axis-mission", JSON.stringify(mission));
    }, [mission]);

    const value = useMemo(() => ({ mission, setMission }), [mission, setMission]);

    return (
        <MissionContext.Provider value={value}>
            {children}
        </MissionContext.Provider>
    );
};

export const useMission = () => {
    const context = useContext(MissionContext);
    if (context === undefined) {
        throw new Error("useMission must be used within a MissionProvider");
    }
    return context;
};
