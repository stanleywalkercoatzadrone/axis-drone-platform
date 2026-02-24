import React, { useEffect, useState } from 'react';
import apiClient from '../src/services/apiClient'; // Adapted from '../api'
import { useCountry } from '../src/context/CountryContext'; // Adapted from '../contexts/CountryContext'

interface MissionClientSelectorProps {
    missionId: string;
    initialClientId?: string;
    onUpdate?: (clientId: string) => void;
}

const MissionClientSelector: React.FC<MissionClientSelectorProps> = ({ missionId, initialClientId, onUpdate }) => {
    const { activeCountryId } = useCountry();
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState(initialClientId || '');

    useEffect(() => {
        async function fetchClients() {
            try {
                // If activeCountryId is present, we filter by it.
                // The backend controller now supports ?countryId=...
                const url = activeCountryId ? `/clients?countryId=${activeCountryId}` : '/clients';
                const res = await apiClient.get(url);
                setClients(res.data.data || []);
            } catch (err) {
                console.error('Failed to fetch clients', err);
            }
        }
        fetchClients();
    }, [activeCountryId]);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const clientId = e.target.value;
        setSelectedClient(clientId);

        try {
            // Using the route implied by the user's snippet.
            // Ensure this route exists on the backend, or use the standard update endpoint.
            // Standard update: PUT /deployments/:id { clientId }
            await apiClient.post(`/deployments/${missionId}/link-client`, { clientId });
            if (onUpdate) onUpdate(clientId);
        } catch (err) {
            console.error('Failed to link mission to client', err);
            // Fallback for standard update if specific route doesn't exist
            try {
                await apiClient.put(`/deployments/${missionId}`, { clientId });
                if (onUpdate) onUpdate(clientId);
            } catch (fallbackErr) {
                console.error('Failed to link mission to client (fallback)', fallbackErr);
                alert('Unable to link mission to client.');
            }
        }
    };

    return (
        <div className="mission-client-selector flex flex-col gap-1 rounded bg-[#007ACC] p-2">
            <label htmlFor="clientSelect" className="text-xs font-bold text-white uppercase tracking-wider">Client</label>
            <select
                id="clientSelect"
                value={selectedClient}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#005A99] rounded text-sm text-white focus:ring-2 focus:ring-white/20 outline-none"
                style={{ backgroundColor: '#007ACC' }}
            >
                <option value="" className="bg-white text-slate-900">Select a client</option>
                {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-white text-slate-900">
                        {c.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default MissionClientSelector;
