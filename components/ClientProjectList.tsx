import React, { useState, useEffect } from 'react';
import { LayoutGrid, Plus, Search, MapPin, ExternalLink, Calendar, MoreVertical } from 'lucide-react';
import apiClient from '../src/services/apiClient';
import { useIndustry } from '../src/context/IndustryContext';
import ProjectForm from './ProjectForm';

interface Project {
    id: string;
    name: string;
    client: string;
    location: string;
    status: string;
    created_at: string;
}

interface ClientProjectListProps {
    clientId: string;
    clientName: string;
}

const ClientProjectList: React.FC<ClientProjectListProps> = ({ clientId, clientName }) => {
    const { tLabel } = useIndustry();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddingProject, setIsAddingProject] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, [clientId]);

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            // Existing endpoint returns all sites, we filter for now
            // Future: Backend could support ?client_id=
            const response = await apiClient.get('/assets/sites');
            if (response.data.status === 'success') {
                const allSites = response.data.data;
                const clientSites = allSites.filter((s: any) => s.client_id === clientId);
                setProjects(clientSites);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={`Search ${tLabel('project')}s...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <button
                    onClick={() => setIsAddingProject(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    Add {tLabel('project')}
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                    <LayoutGrid className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No {tLabel('project')}s found</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
                        {searchTerm ? 'Try adjusting your search terms' : `Get started by adding the first ${tLabel('project').toLowerCase()} for this client.`}
                    </p>
                    {!searchTerm && (
                        <button
                            onClick={() => setIsAddingProject(true)}
                            className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                            Create {tLabel('project')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProjects.map((project) => (
                        <div key={project.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all group">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600">
                                        <LayoutGrid className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{project.name}</h4>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                            <MapPin className="w-3 h-3" />
                                            {project.location || 'No location set'}
                                        </div>
                                    </div>
                                </div>
                                <button className="p-1 hover:bg-slate-100 rounded-md text-slate-400">
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600' :
                                        project.status === 'Completed' ? 'bg-blue-50 text-blue-600' :
                                            'bg-slate-100 text-slate-600'
                                    }`}>
                                    {project.status}
                                </span>
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(project.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAddingProject && (
                <ProjectForm
                    clientId={clientId}
                    clientName={clientName}
                    onClose={() => setIsAddingProject(false)}
                    onSuccess={() => {
                        setIsAddingProject(false);
                        fetchProjects();
                    }}
                />
            )}
        </div>
    );
};

export default ClientProjectList;
