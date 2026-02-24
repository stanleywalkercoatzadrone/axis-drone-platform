import React, { useState, useEffect, useRef } from 'react';
import { useGlobalContext } from '../src/context/GlobalContext';
import { ChevronDown, Building2 } from 'lucide-react';
import apiClient from '../src/services/apiClient';
import { useIndustry } from '../src/context/IndustryContext';

const PortfolioSelector: React.FC = () => {
    const { selectedClientId, setClient } = useGlobalContext();
    const { tLabel } = useIndustry();
    const [isOpen, setIsOpen] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const response = await apiClient.get('/clients');
                if (response.data.success) {
                    setClients(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching clients for selector:', error);
            }
        };
        fetchClients();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedClient = clients.find(c => c.id === selectedClientId);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors text-xs font-medium border border-slate-700/50 h-8"
            >
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="truncate max-w-[120px]">
                    {selectedClient ? selectedClient.name : `Select ${tLabel('client')}`}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50">
                    <div className="px-3 py-2 border-b border-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Select {tLabel('client')}
                    </div>
                    <button
                        onClick={() => {
                            setClient(null);
                            setIsOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between ${!selectedClientId ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-slate-600'
                            }`}
                    >
                        All {tLabel('client')}s
                        {!selectedClientId && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </button>
                    <div className="max-h-60 overflow-y-auto">
                        {clients.map((client) => (
                            <button
                                key={client.id}
                                onClick={() => {
                                    setClient(client.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between ${selectedClientId === client.id ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-slate-600'
                                    }`}
                            >
                                <span className="truncate">{client.name}</span>
                                {selectedClientId === client.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioSelector;
