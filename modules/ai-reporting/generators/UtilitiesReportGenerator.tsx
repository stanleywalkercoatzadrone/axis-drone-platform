import React from 'react';
import { ReportSection, IndustryReportConfig } from '../config/industryReportSections';
import GenericIndustryReportGenerator from './GenericIndustryReportGenerator';

interface Props {
    section: ReportSection;
    industryConfig?: IndustryReportConfig;
    initialSiteName?: string;
    initialClientName?: string;
    onShowArchive?: (search?: string) => void;
    missionId?: string;
}

const UtilitiesReportGenerator: React.FC<Props> = ({ section, industryConfig, initialSiteName, initialClientName, onShowArchive, missionId }) => (
    <GenericIndustryReportGenerator
        section={section}
        industryLabel={industryConfig?.label ?? 'Utilities'}
        colorHex={industryConfig?.colorHex ?? '#06b6d4'}
        initialSiteName={initialSiteName}
        initialClientName={initialClientName}
        onShowArchive={onShowArchive}
        missionId={missionId}
    />
);

export default UtilitiesReportGenerator;
