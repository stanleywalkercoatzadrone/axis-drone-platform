import React, { useState, useEffect } from 'react';
import { Globe, Check, X, Loader } from 'lucide-react';
import { Country, Region } from '../types';

interface RegionConfigProps {
    apiClient: any;
}

const RegionConfig: React.FC<RegionConfigProps> = ({ apiClient }) => {
    const [regions, setRegions] = useState<Region[]>([]);
    const [countries, setCountries] = useState<Country[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [regionsRes, countriesRes] = await Promise.all([
                apiClient.get('/regions/regions'),
                apiClient.get('/regions/countries')
            ]);
            setRegions(regionsRes.data);
            setCountries(countriesRes.data);
        } catch (error) {
            console.error('Failed to fetch config data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (country: Country) => {
        if (country.isoCode === 'US') {
            alert('The United States is the default region and cannot be disabled.');
            return;
        }

        const newStatus = country.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
        setTogglingId(country.id);

        try {
            await apiClient.patch(`/regions/countries/${country.id}/status`, { status: newStatus });
            // Update local state
            setCountries(prev => prev.map(c =>
                c.id === country.id ? { ...c, status: newStatus } : c
            ));
        } catch (error) {
            console.error('Failed to toggle status:', error);
            alert('Failed to update country status');
        } finally {
            setTogglingId(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading configuration...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <Globe className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Regions & Countries</h2>
                    <p className="text-sm text-slate-500">Manage available operating regions.</p>
                </div>
            </div>

            <div className="space-y-6">
                {regions.map(region => (
                    <div key={region.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-900">{region.name}</h3>
                            <span className="text-xs font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded-full">
                                {region.status}
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {countries.filter(c => c.regionId === region.id).map(country => (
                                <div key={country.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="font-medium text-slate-900 w-8">{country.isoCode}</div>
                                        <div>
                                            <div className="font-medium text-slate-900">{country.name}</div>
                                            <div className="text-xs text-slate-500 flex gap-2">
                                                <span>{country.currency}</span>
                                                <span>•</span>
                                                <span>{country.unitsOfMeasurement}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {country.status === 'ENABLED' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                Live
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                Disabled
                                            </span>
                                        )}

                                        <button
                                            onClick={() => handleToggleStatus(country)}
                                            disabled={togglingId === country.id || country.isoCode === 'US'}
                                            className={`
                                                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                                                ${country.status === 'ENABLED' ? 'bg-blue-600' : 'bg-slate-200'}
                                                ${(togglingId === country.id || country.isoCode === 'US') ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            <span
                                                className={`
                                                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                    ${country.status === 'ENABLED' ? 'translate-x-5' : 'translate-x-0'}
                                                `}
                                            />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RegionConfig;
