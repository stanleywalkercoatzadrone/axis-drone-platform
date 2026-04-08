import React from 'react';
import ReportWizard from './report-wizard/ReportWizard';
import { Industry, InspectionReport } from '../types';
import { useIndustry } from '../src/context/IndustryContext';

interface ReportCreatorProps {
  initialIndustry?: Industry | null;
  viewingReport?: InspectionReport | null;
  onBack?: () => void;
}

// Map IndustryKey → Industry enum
const INDUSTRY_KEY_TO_ENUM: Record<string, Industry> = {
  solar: Industry.SOLAR,
  insurance: Industry.INSURANCE,
  utilities: Industry.UTILITIES,
  telecom: Industry.TELECOM,
  construction: Industry.CONSTRUCTION,
};

// Wrapper to maintain backward compatibility with routing
const ReportCreator: React.FC<ReportCreatorProps> = ({ initialIndustry, viewingReport, onBack }) => {
  const { currentIndustry } = useIndustry();

  // Resolve effective industry: use the explicit prop first (for viewing saved reports),
  // then fall back to the active IndustryContext, then Solar as the last resort.
  const effectiveIndustry: Industry =
    initialIndustry ||
    (currentIndustry && INDUSTRY_KEY_TO_ENUM[currentIndustry]) ||
    Industry.SOLAR;

  const handleBack = () => {
    if (onBack) onBack();
  };

  return (
    <ReportWizard
      onBack={handleBack}
      initialIndustry={effectiveIndustry}
      viewingReport={viewingReport}
    />
  );
};

export default ReportCreator;
