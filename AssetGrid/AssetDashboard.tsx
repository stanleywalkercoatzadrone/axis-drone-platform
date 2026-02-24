import React, { useState, useEffect } from 'react';
import { Globe, Plus, LayoutGrid } from 'lucide-react';
import apiClient from '../../src/services/apiClient';
import { Site } from '../../types';
import AssetGrid from './AssetGrid';
import { useParams } from 'react-router-dom';

const AssetDashboard: React.FC = () => {
    // Optional params if we use routing later
    const { siteId: paramSiteId } = useParams<{ siteId: string }>();

    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(paramSiteId || null);
    const [loadingSites, setLoadingSites] = useState(true);

    useEffect(() => {
        fetchSites();
    }, []);

    useEffect(() => {
        if (paramSiteId) setSelectedSiteId(paramSiteId);
    }, [paramSiteId]);

    const fetchSites = async () => {
        try {
            setLoadingSites(true);
            const response = await apiClient.get('/assets/sites');
            const fetched = response.data.data;
            setSites(fetched || []);

            // Default select first site if none selected
            if (fetched && fetched.length > 0 && !selectedSiteId && !paramSiteId) {
                setSelectedSiteId(fetched[0].id);
            }
        } catch (error) {
            console.error('Error fetching sites:', error);
        } finally {
            setLoadingSites(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
            {/* Site Sidebar */}
            <div className="w-64 shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/50">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Sites</h3>
                    <button className="text-slate-400 hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loadingSites && sites.length === 0 ? (
                        <div className="p-4 text-xs text-center text-slate-500">Loading sites...</div>
                    ) : sites.map(site => (
                        <button
                            key={site.id}
                            onClick={() => setSelectedSiteId(site.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all group ${selectedSiteId === site.id
                                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-sm'
                                    : 'bg-transparent border-transparent hover:bg-slate-800 hover:border-slate-700'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 p-1.5 rounded-md ${selectedSiteId === site.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'
                                    }`}>
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className={`text-sm font-medium truncate ${selectedSiteId === site.id ? 'text-indigo-100' : 'text-slate-300'
                                        }`}>{site.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{site.location}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Grid Area */}
            <div className="flex-1 bg-slate-950 relative">
                {selectedSiteId ? (
                    // We render AssetGrid directly. If it expects URL params, we might need to modify it 
                    // or pass props. My AssetGrid implementation uses useParams.
                    // I should Modify AssetGrid to accept optional prop `siteId` override!
                    // I will check AssetGrid implementation.
                    // It uses `const { siteId } = useParams();` 
                    // I should change logic to `const effectiveSiteId = props.siteId || siteId`.

                    // For now, I can Wrap it with a Router context or Pass Prop.
                    // Passing prop is cleaner.
                    <AssetGridWrapper siteId={selectedSiteId} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
                        <p>Select a site to view assets</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetDashboard;

// Tiny wrapper to inject prop if needed, or pass prop to AssetGrid
import AssetGridComponent from './AssetGrid';

const AssetGridWrapper: React.FC<{ siteId: string }> = ({ siteId }) => {
    // We need to modify AssetGrid to accept props, 
    // OR we can't use it as is if it strictly relies on useParams.
    // I will use Replace to Modify AssetGrid to accept props.
    return <AssetGridComponent siteIdOverride={siteId} />;
};

