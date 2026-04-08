import React from 'react';
import { ReportSection, IndustryReportConfig } from '../config/industryReportSections';
import GenericIndustryReportGenerator from './GenericIndustryReportGenerator';

interface Props {
    section: ReportSection;
    industryConfig?: IndustryReportConfig;
    initialSiteName?: string;
    initialClientName?: string;
}

const ConstructionReportGenerator: React.FC<Props> = ({ section, industryConfig, initialSiteName, initialClientName }) => (
    <GenericIndustryReportGenerator
        section={section}
        industryLabel={industryConfig?.label ?? 'Construction'}
        colorHex={industryConfig?.colorHex ?? '#eab308'}
        initialSiteName={initialSiteName}
        initialClientName={initialClientName}
    />
);

export default ConstructionReportGenerator;
