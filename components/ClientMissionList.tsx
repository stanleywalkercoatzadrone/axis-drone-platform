import React, { useState, useEffect } from 'react';
import { Plane, Search, MapPin, Calendar, Clock, ChevronRight } from 'lucide-react';
import apiClient from '../src/services/apiClient';
import { useIndustry } from '../src/context/IndustryContext';
import { Deployment, DeploymentStatus } from '../types';

interface ClientMissionListProps {
    clientId: string;
}

const ClientMissionList: React.FC<ClientMissionListProps> = ({ clientId }) => {
    const { tLabel, currentIndustry } = useIndustry();
    const [missions, setMissions] = useState<Deployment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMissions();
    }, [clientId]);

    const fetchMissions = async () => {
        setIsLoading(true);
        try {
            const url = currentIndustry ? `/deployments?clientId=${clientId}&industryKey=${currentIndustry}` : `/deployments?clientId=${clientId}`;
            const response = await apiClient.get(url);
            if (response.data.success) {
                setMissions(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching client missions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredMissions = missions.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.siteName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyles = (status: DeploymentStatus) => {
        switch (status) {
            case DeploymentStatus.ACTIVE:
                return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case DeploymentStatus.SCHEDULED:
                return 'bg-blue-50 text-blue-600 border-blue-100';
            case DeploymentStatus.REVIEW:
                return 'bg-amber-50 text-amber-600 border-amber-100';
            case DeploymentStatus.COMPLETED:
                return 'bg-slate-50 text-slate-600 border-slate-100';
            default:
                return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search missions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredMissions.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                    <Plane className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No missions found</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
                        {searchTerm ? 'Try adjusting your search terms' : 'No flight missions have been scheduled for this client yet.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {filteredMissions.map((mission) => (
                            <div key={mission.id} className="p-4 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${getStatusStyles(mission.status)}`}>
                                            <Plane className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">{mission.title}</h4>
                                            <div className="flex items-center gap-4 mt-1">
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <MapPin className="w-3 h-3" />
                                                    {mission.siteName}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(mission.date).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Clock className="w-3 h-3" />
                                                    {mission.daysOnSite || 1} days
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusStyles(mission.status)}`}>
                                            {mission.status}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientMissionList;
