import React from 'react';
import { useGlobalContext } from '../../context/GlobalContext';
import { AlertTriangle, FileWarning, Clock, AlertOctagon } from 'lucide-react';

interface AttentionItem {
    id: string;
    type: 'SLA' | 'FAILURE' | 'MISSING' | 'DUPLICATE';
    title: string;
    subtitle: string;
    severity: 'critical' | 'high' | 'medium';
    time: string;
}

interface NeedsAttentionWidgetProps {
    countryId?: string;
}

export const NeedsAttentionWidget: React.FC<NeedsAttentionWidgetProps> = ({ countryId }) => {
    // const { activeCountryId } = useGlobalContext();

    // Mock Data - In real app, this comes from API based on GlobalContext
    // For now, we assume these are US items. If a specific country is selected (that isn't US/Global), specific items should load.
    // Since we don't have US ID hardcoded, we assume activeCountryId != null means "Non-Default Country".

    const allItems: AttentionItem[] = [
        { id: '1', type: 'SLA', title: 'Site FL-204 At Risk', subtitle: 'Processing delayed > 4h', severity: 'critical', time: '20m ago' },
        { id: '2', type: 'FAILURE', title: 'Batch #4092 Failed', subtitle: '3 files corrupted in upload', severity: 'high', time: '1h ago' },
        { id: '3', type: 'MISSING', title: 'Missing Telemetry', subtitle: 'Site TX-102 missing logs', severity: 'medium', time: '2h ago' },
        { id: '4', type: 'DUPLICATE', title: 'Duplicate Asset ID', subtitle: 'Tower A1 vs Tower A1-BIS', severity: 'medium', time: '4h ago' },
    ];

    // Simple mock filter: If country selected, show empty (or specific mock data if we had it)
    const items = countryId ? [] : allItems;

    const getIcon = (type: AttentionItem['type']) => {
        switch (type) {
            case 'SLA': return <Clock className="w-4 h-4 text-red-500" />;
            case 'FAILURE': return <AlertOctagon className="w-4 h-4 text-orange-500" />;
            case 'MISSING': return <FileWarning className="w-4 h-4 text-yellow-500" />;
            default: return <AlertTriangle className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    Needs Attention
                </h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded-full">Top 10</span>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-800/50">
                    {items.map((item) => (
                        <button key={item.id} className="w-full text-left px-6 py-4 hover:bg-slate-800/50 transition-colors flex items-start group">
                            <div className={`mt-1 p-2 rounded-lg shrink-0 ${item.severity === 'critical' ? 'bg-red-500/10' :
                                item.severity === 'high' ? 'bg-orange-500/10' : 'bg-slate-800'
                                }`}>
                                {getIcon(item.type)}
                            </div>
                            <div className="ml-4 flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors truncate">{item.title}</p>
                                    <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">{item.time}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{item.subtitle}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-6 py-3 bg-slate-950/30 border-t border-slate-800 text-center">
                <button className="text-xs font-medium text-slate-500 hover:text-cyan-400 transition-colors">View All Exceptions</button>
            </div>
        </div>
    );
};
