import React from 'react';
import ReportWizard from './report-wizard/ReportWizard';
import { Industry, InspectionReport } from '../types';

interface ReportCreatorProps {
  initialIndustry: Industry | null;
  viewingReport?: InspectionReport | null;
  onBack?: () => void;
}

// Wrapper to maintain backward compatibility with routing
const ReportCreator: React.FC<ReportCreatorProps> = ({ initialIndustry, viewingReport, onBack }) => {
  const handleBack = () => {
    if (onBack) onBack();
  };

  return (
    <ReportWizard onBack={handleBack} />
  );
};

export default ReportCreator;
