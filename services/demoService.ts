import { UserAccount, UserRole, InspectionReport, Industry, ReportTheme, Severity } from '../../types';

export const initializeDemoSession = async (): Promise<UserAccount> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const demoUser: UserAccount = {
                id: 'demo-user',
                email: 'demo@axis.ai',
                fullName: 'Demo Principal',
                companyName: 'Axis Global',
                title: 'Lead Systems Architect',
                role: UserRole.ADMIN,
                driveLinked: true,
                driveFolder: 'Axis_Demo_Vault',
                googleEmail: 'demo.admin@google.com',
                accessToken: 'DEMO_TOKEN_UNRESTRICTED',
                createdAt: new Date().toISOString()
            };

            // Seed Demo Report
            const demoReport: InspectionReport = {
                id: 'rep-demo-001',
                rootId: 'root-demo-001',
                version: 1,
                history: [{
                    version: 1,
                    timestamp: new Date().toISOString(),
                    author: 'Axis AI Core',
                    summary: 'Initial Automated Audit',
                    data: {}
                }],
                title: 'Solar Field Alpha - Unit 4 Inspection',
                client: 'CleanGrid Energy',
                date: new Date().toLocaleDateString(),
                industry: Industry.SOLAR,
                theme: ReportTheme.TECHNICAL,
                branding: {
                    companyName: 'CleanGrid',
                    primaryColor: '#f59e0b'
                },
                images: [{
                    id: 'img-demo-001',
                    url: '/demo-solar.png',
                    annotations: [{
                        id: 'anno-demo-001',
                        label: 'Cell Micro-Fracture',
                        description: 'Thermal anomaly detected on panel center. Likely caused by impact or thermal stress. Performance degradation: 12%.',
                        severity: Severity.HIGH,
                        confidence: 0.94,
                        x: 43,
                        y: 40,
                        width: 15,
                        height: 20,
                        type: 'box',
                        source: 'ai',
                        color: '#ef4444'
                    }],
                    summary: 'Visual inspection reveals localized micro-fracturing on the center-right quadrant. Thermal overlay indicates localized hot-spotting exceeding 85°C.'
                }],
                config: {
                    showExecutiveSummary: true,
                    showSiteIntelligence: true,
                    showStrategicAssessment: true,
                    showCostAnalysis: true,
                    showDetailedImagery: true,
                    showAuditTrail: true
                },
                status: 'DRAFT',
                approvalStatus: 'Pending Review',
                summary: 'Critical hot-spotting detected on panel PF-42. Potential fire risk if left unaddressed. Replacement recommended.',
                recommendations: [
                    'Immediate bypass of string to prevent further damage.',
                    'Physical replacement of panel PF-42.',
                    'Secondary drone pass under peak solar load to verify string health.'
                ],
                strategicAssessment: {
                    reasoning: 'The detected micro-fracture is atypical for this site age and suggests mechanical impact. Failure to replace will lead to string-wide efficiency losses.',
                    longTermRisks: ['Arc flash potential', 'Accelerated delamination'],
                    operationalPriorities: ['Isolate String B', 'Inspect neighboring panels'],
                    correctiveProtocols: [{
                        issueType: 'Cell Micro-Fracture',
                        procedure: ['Disconnect panel connectors', 'Remove mounting hardware', 'Install new OEM panel'],
                        requiredHardware: ['OEM PV Module', 'MC4 Connectors'],
                        safetyProtocol: 'Arc-flash rated PPE required.'
                    }]
                }
            };

            const existingReports = JSON.parse(localStorage.getItem('skylens_reports') || '[]');
            if (!existingReports.find((r: any) => r.id === demoReport.id)) {
                localStorage.setItem('skylens_reports', JSON.stringify([demoReport, ...existingReports]));
            }

            resolve(demoUser);
        }, 800);
    });
};
