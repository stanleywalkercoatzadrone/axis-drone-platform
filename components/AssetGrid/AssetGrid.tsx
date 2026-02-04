import React, { useState, useEffect } from 'react';
import {
    Search, Filter, MoreHorizontal, LayoutGrid, List, CheckCircle, Clock, AlertCircle, ChevronRight, User, RefreshCw
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import apiClient from '../../src/services/apiClient';
import { GridAsset } from '../../types';
import AssetDrawer from './AssetDrawer';

interface AssetGridProps {
    siteIdOverride?: string;
}

const AssetGrid: React.FC<AssetGridProps> = ({ siteIdOverride }) => {
    const { siteId: paramSiteId } = useParams<{ siteId: string }>();
    const siteId = siteIdOverride || paramSiteId;
    const [assets, setAssets] = useState<GridAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAsset, setSelectedAsset] = useState<GridAsset | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        if (siteId) {
            fetchAssets();
        }
    }, [siteId]);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/assets/sites/${siteId}/assets`);
            setAssets(response.data.data || []);
        } catch (error) {
            console.error('Error fetching assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssetClick = (asset: GridAsset) => {
        setSelectedAsset(asset);
        setIsDrawerOpen(true);
    };

    const handleUpdate = (updatedAsset: GridAsset) => {
        setAssets(prev => prev.map(a => a.id === updatedAsset.id ? updatedAsset : a));
        if (selectedAsset?.id === updatedAsset.id) {
            setSelectedAsset(updatedAsset);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'complete': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'in_progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'blocked': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'needs_review': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            default: return 'bg-slate-700/50 text-slate-400 border-slate-700';
        }
    };

    const filteredAssets = assets.filter(asset => {
        const matchesSearch = asset.assetKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-200">
            {/* Context Bar */}
            <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-indigo-400" />
                        Asset Grid
                    </h2>
                    <div className="h-4 w-px bg-slate-700" />
                    <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                        {assets.length} items
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchAssets()}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="p-4 flex gap-4 border-b border-slate-800/60">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50"
                    >
                        <option value="all">All Status</option>
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="complete">Complete</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4">
                {loading && assets.length === 0 ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredAssets.map(asset => (
                            <div
                                key={asset.id}
                                onClick={() => handleAssetClick(asset)}
                                className={`
                                    group relative bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer
                                    ${selectedAsset?.id === asset.id ? 'border-indigo-500 ring-1 ring-indigo-500/20' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${getStatusColor(asset.status)}`}>
                                        {asset.status.replace('_', ' ')}
                                    </div>
                                    <button className="text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </div>

                                <h3 className="text-slate-100 font-medium truncate mb-1">{asset.assetKey}</h3>
                                <p className="text-xs text-slate-500 mb-4 line-clamp-2 min-h-[2.5em]">
                                    {asset.description || 'No description provided'}
                                </p>

                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800">
                                    <div className="flex items-center gap-2">
                                        {asset.assignedToAvatar ? (
                                            <img src={asset.assignedToAvatar} alt="" className="w-5 h-5 rounded-full" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                                                <User className="w-3 h-3" />
                                            </div>
                                        )}
                                        <span className="text-xs text-slate-400 max-w-[80px] truncate">
                                            {asset.assignedToName || 'Unassigned'}
                                        </span>
                                    </div>

                                    {asset.plannedCount ? (
                                        <div className="text-xs font-mono text-slate-400">
                                            <span className={asset.completedCount >= asset.plannedCount ? 'text-emerald-400' : 'text-slate-300'}>
                                                {asset.completedCount}
                                            </span>
                                            <span className="text-slate-600 mx-0.5">/</span>
                                            <span>{asset.plannedCount}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-600 italic">No Target</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Drawer */}
            <AssetDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                asset={selectedAsset}
                onUpdate={handleUpdate}
            />
        </div>
    );
};

export default AssetGrid;
