import React from 'react';
import { ReportSection, IndustryReportConfig } from '../config/industryReportSections';
import GenericIndustryReportGenerator from './GenericIndustryReportGenerator';

interface Props {
    section: ReportSection;
    industryConfig?: IndustryReportConfig;
    initialSiteName?: string;
    initialClientName?: string;
}

const TelecomReportGenerator: React.FC<Props> = ({ section, industryConfig, initialSiteName, initialClientName }) => (
    <GenericIndustryReportGenerator
        section={section}
        industryLabel={industryConfig?.label ?? 'Telecom'}
        colorHex={industryConfig?.colorHex ?? '#8b5cf6'}
        initialSiteName={initialSiteName}
        initialClientName={initialClientName}
    />
);

export default TelecomReportGenerator;
