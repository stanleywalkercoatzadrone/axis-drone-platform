import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ClientNav from './ClientNav';
import ClientOverview from './overview/ClientOverview';
import ClientMissions from './missions/ClientMissions';
import ClientLBD from './lbd/ClientLBD';
import ClientDeliverables from './deliverables/ClientDeliverables';
import ClientMapViewer from './map/ClientMapViewer';
import ClientReports from './reports/ClientReports';

const ClientApp: React.FC = () => {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-900">
            <ClientNav />
            <main className="flex-1 overflow-y-auto w-full relative bg-slate-900">
                <div className="animate-in fade-in duration-500 slide-in-from-bottom-2 h-full">
                    <Routes>
                        <Route path="overview" element={<ClientOverview />} />
                        <Route path="missions" element={<ClientMissions />} />
                        <Route path="reports" element={<ClientReports />} />
                        <Route path="lbd" element={<ClientLBD />} />
                        <Route path="deliverables" element={<ClientDeliverables />} />
                        <Route path="map" element={<ClientMapViewer />} />
                        <Route path="*" element={<Navigate to="overview" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

export default ClientApp;
