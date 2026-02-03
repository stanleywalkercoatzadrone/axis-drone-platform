export type IndustryKey = 'solar' | 'insurance' | 'construction' | 'utilities' | 'telecom' | 'default';

export interface IndustryLabels {
    client: string;
    project: string;
    mission: string;
    asset: string;
    workItem: string;
    report: string;
    stakeholder: string;
    dashboardTitle: string;
}

export const INDUSTRY_CONFIG: Record<IndustryKey, { name: string; labels: IndustryLabels }> = {
    solar: {
        name: 'Solar',
        labels: {
            client: 'Portfolio',
            project: 'Site',
            mission: 'Inspection',
            asset: 'Solar Asset',
            workItem: 'Checklist Item',
            report: 'Inspection Report',
            stakeholder: 'Site Contact',
            dashboardTitle: 'Solar Operations'
        }
    },
    insurance: {
        name: 'Insurance',
        labels: {
            client: 'Carrier',
            project: 'Claim',
            mission: 'Adjuster Visit',
            asset: 'Property Item',
            workItem: 'Action Item',
            report: 'Claim Report',
            stakeholder: 'Claimant',
            dashboardTitle: 'Claims Dashboard'
        }
    },
    construction: {
        name: 'Construction',
        labels: {
            client: 'Developer',
            project: 'Job',
            mission: 'Progress Capture',
            asset: 'Equipment',
            workItem: 'Punch List Item',
            report: 'Progress Report',
            stakeholder: 'Project Team',
            dashboardTitle: 'Site Progress'
        }
    },
    utilities: {
        name: 'Utilities',
        labels: {
            client: 'Utility',
            project: 'Program',
            mission: 'Asset Inspection',
            asset: 'Grid Asset',
            workItem: 'Work Order',
            report: 'Audit Report',
            stakeholder: 'Utility Contact',
            dashboardTitle: 'Grid Monitoring'
        }
    },
    telecom: {
        name: 'Telecom',
        labels: {
            client: 'Tower Co',
            project: 'Site',
            mission: 'Tower Inspection',
            asset: 'Antenna',
            workItem: 'Ticket',
            report: 'Tower Audit',
            stakeholder: 'Site Contact',
            dashboardTitle: 'Tower Operations'
        }
    },
    default: {
        name: 'General',
        labels: {
            client: 'Client',
            project: 'Project',
            mission: 'Mission',
            asset: 'Asset',
            workItem: 'Task',
            report: 'Report',
            stakeholder: 'Stakeholder',
            dashboardTitle: 'Dashboard'
        }
    }
};

export const getIndustryLabels = (key: string | null | undefined): IndustryLabels => {
    const industryKey = (key as IndustryKey) || 'default';
    return INDUSTRY_CONFIG[industryKey]?.labels || INDUSTRY_CONFIG.default.labels;
};
