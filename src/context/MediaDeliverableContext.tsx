/**
 * MediaDeliverableContext.tsx
 *
 * Shared context for the "Media & Deliverables" nav group.
 * Allows any tab (Uploads, Orthomosaic, Media Gallery, Reports,
 * BESS, Solar Intelligence) to navigate to another tab while
 * passing pre-loaded state (active solar site, active ortho job).
 *
 * Usage:
 *   const { navigateToTab, activeSolarSiteId } = useMediaDeliverable();
 *   navigateToTab('orthomosaic', { orthoJobId: 'abc-123' });
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

export type MediaNavKey =
  | 'uploads'
  | 'orthomosaic'
  | 'media'
  | 'reports'
  | 'bess'
  | 'solar-intelligence';

export interface MediaDeliverableContextType {
  /** The solar site currently in focus (set when cross-navigating from Solar Intelligence) */
  activeSolarSiteId: string | null;
  activeSolarSiteName: string | null;
  /** The orthomosaic job currently in focus (set when cross-navigating from Solar Dashboard) */
  activeOrthoJobId: string | null;
  /**
   * Navigate to a Media-Deliverables tab and optionally update context values.
   * Calls the parent AppShell's setActiveNav under the hood.
   */
  navigateToTab: (
    tab: MediaNavKey,
    ctx?: {
      solarSiteId?: string | null;
      solarSiteName?: string | null;
      orthoJobId?: string | null;
    }
  ) => void;
  /** Directly update the active solar site without navigating */
  setActiveSolarSite: (id: string | null, name: string | null) => void;
  /** Directly update the active ortho job without navigating */
  setActiveOrthoJobId: (id: string | null) => void;
}

const defaultCtx: MediaDeliverableContextType = {
  activeSolarSiteId: null,
  activeSolarSiteName: null,
  activeOrthoJobId: null,
  navigateToTab: () => {},
  setActiveSolarSite: () => {},
  setActiveOrthoJobId: () => {},
};

const MediaDeliverableContext =
  createContext<MediaDeliverableContextType>(defaultCtx);

export interface MediaDeliverableProviderProps {
  children: React.ReactNode;
  /** Called by navigateToTab — should switch the top-level nav tab */
  onNavigate: (tab: MediaNavKey) => void;
}

export const MediaDeliverableProvider: React.FC<
  MediaDeliverableProviderProps
> = ({ children, onNavigate }) => {
  const [activeSolarSiteId, setActiveSolarSiteId] = useState<string | null>(null);
  const [activeSolarSiteName, setActiveSolarSiteName] = useState<string | null>(null);
  const [activeOrthoJobId, setActiveOrthoJobIdState] = useState<string | null>(null);

  const setActiveSolarSite = useCallback(
    (id: string | null, name: string | null) => {
      setActiveSolarSiteId(id);
      setActiveSolarSiteName(name);
    },
    []
  );

  const setActiveOrthoJobId = useCallback((id: string | null) => {
    setActiveOrthoJobIdState(id);
  }, []);

  const navigateToTab = useCallback(
    (
      tab: MediaNavKey,
      ctx?: {
        solarSiteId?: string | null;
        solarSiteName?: string | null;
        orthoJobId?: string | null;
      }
    ) => {
      if (ctx?.solarSiteId !== undefined) setActiveSolarSiteId(ctx.solarSiteId);
      if (ctx?.solarSiteName !== undefined) setActiveSolarSiteName(ctx.solarSiteName);
      if (ctx?.orthoJobId !== undefined) setActiveOrthoJobIdState(ctx.orthoJobId);
      onNavigate(tab);
    },
    [onNavigate]
  );

  return (
    <MediaDeliverableContext.Provider
      value={{
        activeSolarSiteId,
        activeSolarSiteName,
        activeOrthoJobId,
        navigateToTab,
        setActiveSolarSite,
        setActiveOrthoJobId,
      }}
    >
      {children}
    </MediaDeliverableContext.Provider>
  );
};

export const useMediaDeliverable = (): MediaDeliverableContextType =>
  useContext(MediaDeliverableContext);
