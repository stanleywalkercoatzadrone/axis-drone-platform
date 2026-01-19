
import React, { useState, useEffect } from 'react';
import {
    Building2,
    Search,
    MapPin,
    Filter,
    Plus,
    MoreHorizontal,
    TowerControl,
    Zap,
    Home,
    Calendar,
    Activity,
    Upload,
    FileSpreadsheet,
    Layout,
    Globe
} from 'lucide-react';
import { Asset, AssetCategory, Site } from '../types';
import apiClient from '../src/services/apiClient';

const AssetTracker: React.FC = () => {
    const [sites, setSites] = useState<Site[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<AssetCategory | 'All'>('All');
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    useEffect(() => {
        fetchSites();
    }, []);

    useEffect(() => {
        if (selectedSiteId) {
            fetchAssets(selectedSiteId);
        } else {
            setAssets([]);
        }
    }, [selectedSiteId]);

    const fetchSites = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/assets/sites');
            const fetchedSites = response.data.data;
            setSites(fetchedSites || []);

            if (fetchedSites && fetchedSites.length > 0 && !selectedSiteId) {
                setSelectedSiteId(fetchedSites[0].id);
            }
        } catch (err: any) {
            console.error('Error fetching sites:', err);
            setError('Failed to load sites');
        } finally {
            setLoading(false);
        }
    };

    const fetchAssets = async (siteId: string) => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/assets?site_id=${siteId}`);
            setAssets(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching assets:', err);
            setError('Failed to load assets');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedSiteId) return;

        // Simulate generic file parsing
        // In a real app we'd use 'xlsx' or 'papaparse' here
        setTimeout(() => {
            const newAsset: Asset = {
                id: `IMP-${Math.floor(Math.random() * 1000)}`,
                siteId: selectedSiteId,
                name: file.name.split('.')[0],
                category: file.name.endsWith('.kml') ? AssetCategory.FLIGHT_MISSION : AssetCategory.UTILITY,
                location: 'Imported Location',
                status: 'Active',
                lastInspectionDate: new Date().toISOString(),
                metadata: { sourceFile: file.name }
            };
            setAssets(prev => [newAsset, ...prev]);
            setIsImportModalOpen(false);
            alert(`Successfully imported ${file.name}`);
        }, 1000);
    };

    const filteredAssets = assets.filter(asset => {
        const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeCategory === 'All' || asset.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const getCategoryIcon = (category: AssetCategory) => {
        switch (category) {
            case AssetCategory.LBD: return <Activity className="w-4 h-4 text-blue-500" />;
            case AssetCategory.FLIGHT_MISSION: return <MapPin className="w-4 h-4 text-emerald-500" />;
            case AssetCategory.CELL_TOWER: return <TowerControl className="w-4 h-4 text-purple-500" />;
            case AssetCategory.PROPERTY: return <Building2 className="w-4 h-4 text-amber-500" />;
            case AssetCategory.ROOF: return <Home className="w-4 h-4 text-indigo-500" />;
            case AssetCategory.UTILITY: return <Zap className="w-4 h-4 text-yellow-500" />;
            default: return <Building2 className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <div className="flex h-full gap-6 animate-in fade-in duration-500">
            {/* Site Sidebar */}
            <div className="w-64 shrink-0 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900">Sites / Missions</h3>
                        <button className="text-slate-400 hover:text-blue-600 transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto">
                        {loading && sites.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">Loading sites...</div>
                        ) : sites.map(site => (
                            <button
                                key={site.id}
                                onClick={() => setSelectedSiteId(site.id)}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${selectedSiteId === site.id
                                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 p-1.5 rounded-md ${selectedSiteId === site.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium truncate ${selectedSiteId === site.id ? 'text-blue-900' : 'text-slate-900'}`}>{site.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">{site.location}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                <div className="flex items-end justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Asset Management</h2>
                        <p className="text-sm text-slate-500">
                            Viewing assets for <span className="font-medium text-slate-900">{sites.find(s => s.id === selectedSiteId)?.name || '...'}</span>.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                            <Upload className="w-4 h-4" /> Import Data
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                            <Plus className="w-4 h-4" /> Add Asset
                        </button>
                    </div>
                </div>

                {isImportModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Import Assets</h3>
                            <p className="text-sm text-slate-500 mb-6">Upload a CSV/Excel spreadsheet or KML file to bulk create assets.</p>

                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer relative">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls,.kml"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="mx-auto w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
                                <p className="text-xs text-slate-500 mt-1">Supports .CSC, .XLSX, and .KML</p>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Tabs */}
                <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide shrink-0">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCategory === 'All'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        All Assets
                    </button>
                    {Object.values(AssetCategory).map((category) => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCategory === category
                                ? 'bg-white text-blue-600 border border-blue-200 shadow-sm ring-2 ring-blue-500/20'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {getCategoryIcon(category)}
                            {category}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                    {/* Filters */}
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center gap-4 shrink-0">
                        <div className="relative w-96">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search assets by name, ID, or location..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            <Filter className="w-4 h-4" /> Filters
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Asset Name</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Inspection</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Loading assets for site...</td>
                                    </tr>
                                ) : filteredAssets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    {getCategoryIcon(asset.category)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{asset.name}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{asset.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                {asset.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-sm text-slate-600">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                {asset.location}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${asset.status === 'Active'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : asset.status === 'Maintenance'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${asset.status === 'Active' ? 'bg-emerald-500' : asset.status === 'Maintenance' ? 'bg-amber-500' : 'bg-slate-400'
                                                    }`} />
                                                {asset.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                {asset.lastInspectionDate ? new Date(asset.lastInspectionDate).toLocaleDateString() : '—'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {!loading && filteredAssets.length === 0 && (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Search className="w-5 h-5 text-slate-400" />
                                </div>
                                <h3 className="text-sm font-medium text-slate-900">No assets found</h3>
                                <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search query.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetTracker;
