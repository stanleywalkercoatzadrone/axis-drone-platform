/**
 * Construction Report Generator — stub with "Coming Soon" state.
 * Fully scaffolded for future build-out.
 */
import React from 'react';
import { HardHat, Wrench, Sparkles } from 'lucide-react';
import { ReportSection } from '../config/industryReportSections';

interface Props { section: ReportSection; }

const ConstructionReportGenerator: React.FC<Props> = ({ section }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8 py-16">
        <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6"
            style={{ background: section.accentHex + '18', border: `1px solid ${section.accentHex}30` }}
        >
            {section.icon}
        </div>
        <div
            className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: section.accentHex + '18', color: section.accentHex, border: `1px solid ${section.accentHex}30` }}
        >
            <Sparkles className="w-3.5 h-3.5" /> Coming Soon
        </div>
        <h2 className="text-2xl font-black text-white mb-3">{section.title}</h2>
        <p className="text-slate-400 max-w-md mb-6">{section.description}</p>
        <p className="text-slate-500 text-sm">
            The Construction AI report generator is in development. <br />
            Solar and Insurance generators are available now.
        </p>
    </div>
);

export default ConstructionReportGenerator;
