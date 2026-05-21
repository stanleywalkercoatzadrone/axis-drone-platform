import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

export interface MissionState {
    client: string | null;
    site: string | null;
    country: string | null;
    portfolio: string | null;
    industry: string | null;
}

// ── Active mission identity (separate from filter state) ──────────────────────
export interface ActiveMission {
    id: string | null;
    title: string | null;
    status: string | null;
}

interface MissionContextType {
    mission: MissionState;
    setMission: React.Dispatch<React.SetStateAction<MissionState>>;
    // Active mission context — persists platform-wide
    activeMission: ActiveMission;
    setActiveMission: (mission: Partial<ActiveMission> | null) => void;
    clearActiveMission: () => void;
}

const EMPTY_ACTIVE: ActiveMission = { id: null, title: null, status: null };

const MissionContext = createContext<MissionContextType | undefined>(undefined);

export const MissionProvider = ({ children }: { children: ReactNode }) => {
    const [mission, setMission] = useState<MissionState>({
        client: null,
        site: null,
        country: null,
        portfolio: null,
        industry: null,
    });

    const [activeMission, setActiveMissionState] = useState<ActiveMission>(() => {
        try {
            const saved = localStorage.getItem("axis-active-mission");
            if (saved) return { ...EMPTY_ACTIVE, ...JSON.parse(saved) };
        } catch {}
        return EMPTY_ACTIVE;
    });

    // Load saved filter state
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

    // Persist filter state
    useEffect(() => {
        localStorage.setItem("axis-mission", JSON.stringify(mission));
    }, [mission]);

    // Persist active mission
    useEffect(() => {
        localStorage.setItem("axis-active-mission", JSON.stringify(activeMission));
    }, [activeMission]);

    const setActiveMission = (update: Partial<ActiveMission> | null) => {
        if (update === null) {
            setActiveMissionState(EMPTY_ACTIVE);
        } else {
            setActiveMissionState(prev => ({ ...prev, ...update }));
        }
    };

    const clearActiveMission = () => setActiveMissionState(EMPTY_ACTIVE);

    const value = useMemo(() => ({
        mission, setMission,
        activeMission, setActiveMission, clearActiveMission,
    }), [mission, activeMission]);

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

