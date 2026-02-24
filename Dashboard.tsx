import React, { useEffect, useState } from 'react';
import { Industry, InspectionReport } from '../types';
import {
  Activity,
  AlertTriangle,
  Zap,
  ShieldCheck,
  TowerControl,
  MapPin,
  ChevronRight,
  LogOut,
  Globe,
  Battery,
  Clock,
  Search,
  Filter
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useAuth } from '../src/context/AuthContext';
import { useCountry } from '../src/context/CountryContext';

import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Heading, Text } from '../src/stitch/components';

interface DashboardProps {
  onNewReport: (industry: Industry) => void;
  onViewReport: (report: InspectionReport) => void;
  isArchiveView?: boolean;
}

const operationalData = [
  { time: '06:00', load: 12 },
  { time: '08:00', load: 35 },
  { time: '10:00', load: 78 },
  { time: '12:00', load: 85 },
  { time: '14:00', load: 62 },
  { time: '16:00', load: 45 },
];

const activeDrones = [
  { id: 'AX-04', country: 'MX', status: 'In Mission', battery: 74, signal: 98, location: 'Sector 4', task: 'Thermal Scan' },
  { id: 'AX-09', country: 'US', status: 'Returning', battery: 12, signal: 85, location: 'Transit', task: 'Low Battery' },
  { id: 'AX-11', country: 'US', status: 'Standby', battery: 100, signal: 100, location: 'Base', task: 'Ready' },
  { id: 'AX-12', country: 'MX', status: 'Standby', battery: 92, signal: 100, location: 'Base', task: 'Ready' },
];

const Dashboard: React.FC<DashboardProps> = ({ onNewReport, onViewReport, isArchiveView }) => {
  const { logout, user } = useAuth();
  const { activeCountryId, activeCountry } = useCountry();

  const [savedReports, setSavedReports] = useState<InspectionReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const reports = JSON.parse(localStorage.getItem('skylens_reports') || '[]');
    setSavedReports(reports);
  }, [isArchiveView]);

  // Country Filtering Logic
  const filteredDrones = activeCountryId
    ? activeDrones.filter(d => d.country === activeCountryId || !d.country)
    : activeDrones;

  const filteredSavedReports = activeCountryId
    ? savedReports.filter(r => r.countryId === activeCountryId || !r.countryId)
    : savedReports;

  const totalIssues = filteredSavedReports.reduce((acc, rep) => {
    return acc + rep.images.reduce((imgAcc, img) => imgAcc + img.annotations.length, 0);
  }, 0);

  const filteredReports = filteredSavedReports.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatCard = ({ label, value, trend, trendGood, icon: Icon }: any) => (
    <Card variant="glass" className="hover:shadow-cyan-900/20 transition-all group border-slate-800/50">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-800/80 rounded-lg group-hover:bg-cyan-900/30 transition-colors">
          <Icon className="w-5 h-5 text-cyan-400" />
        </div>
        {trend && (
          <Badge variant={trendGood ? "success" : "destructive"} className="text-[10px] py-0 px-2">
            {trend}
          </Badge>
        )}
      </div>
      <div>
        <Heading level={3} className="text-2xl font-bold text-white tracking-tight">{value}</Heading>
        <Text variant="small" className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{label}</Text>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 font-sans text-slate-200 animate-in fade-in duration-500">

      {!isArchiveView && (
        <>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Heading level={2} className="text-white">Mission Control</Heading>
                {activeCountry && (
                  <Badge variant="secondary" className="flex items-center gap-1.5 uppercase tracking-tight">
                    <Globe className="w-3 h-3" />
                    {activeCountry.name} Active
                  </Badge>
                )}
              </div>
              <Text className="text-slate-400 font-medium">Real-time operational status and fleet telemetry.</Text>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center gap-2 border-slate-700 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Missions" value={filteredDrones.filter(d => d.status === 'In Mission').length.toString()} trend="+12%" trendGood={true} icon={Activity} />
            <StatCard label="Anomalies Found" value={totalIssues} trend="+5%" trendGood={false} icon={AlertTriangle} />
            <StatCard label="Fleet Efficiency" value="94%" trend="+2.4%" trendGood={true} icon={Zap} />
            <StatCard label="Data Ingested" value="1.2TB" trend="Today" trendGood={true} icon={Clock} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-slate-800 overflow-hidden bg-slate-900/50">
              <CardHeader className="px-6 py-4 border-b border-slate-800 flex flex-row justify-between items-center bg-slate-900/80">
                <CardTitle className="text-sm font-semibold text-white">Active Fleet {activeCountryId ? `(${activeCountryId})` : ''}</CardTitle>
                <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-400/30">Live Telemetry</Badge>
              </CardHeader>
              <div className="divide-y divide-slate-800/50">
                {filteredDrones.map(drone => (
                  <div key={drone.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${drone.status === 'In Mission' ? 'bg-emerald-500 animate-pulse' : drone.status === 'Returning' ? 'bg-amber-500' : 'bg-slate-600'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <Text variant="small" className="font-semibold text-white">{drone.id}</Text>
                          {drone.country && <Badge variant="secondary" className="text-[9px] py-0 px-1">{drone.country}</Badge>}
                        </div>
                        <Text variant="small" className="text-[11px] text-slate-500">{drone.task}</Text>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {drone.location}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-400 w-24">
                        <Battery className={`w-3.5 h-3.5 ${drone.battery < 20 ? 'text-red-500' : 'text-slate-500'}`} />
                        <div className={`h-full rounded-full ${drone.battery < 20 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${drone.battery}%` }} />
                        <span className="text-[10px]">{drone.battery}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="glass" className="border-slate-700 p-6 flex flex-col justify-between bg-gradient-to-br from-slate-900 to-slate-800">
              <div>
                <Heading level={4} className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Initialize Inspection</Heading>
                <div className="space-y-3">
                  {[
                    { id: Industry.SOLAR, label: 'Solar Array', icon: Zap },
                    { id: Industry.UTILITIES, label: 'Grid Infrastructure', icon: TowerControl },
                    { id: Industry.INSURANCE, label: 'Property Audit', icon: ShieldCheck },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onNewReport(item.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-700/50 rounded-md text-slate-400 group-hover:text-cyan-400 transition-colors">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <Text variant="small" className="font-medium text-slate-200 group-hover:text-white">{item.label}</Text>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <Text variant="small" className="text-[10px] font-bold text-slate-500 mb-4 uppercase tracking-widest text-center">Ingest Performance</Text>
                <div className="h-20 w-full opacity-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={operationalData}>
                      <defs>
                        <linearGradient id="colorLoadStats" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="load" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorLoadStats)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      <Card className="border-slate-800 overflow-hidden bg-slate-900/40">
        <CardHeader className="px-6 py-4 border-b border-slate-800 flex flex-row justify-between items-center gap-4 bg-slate-900/80">
          <div>
            <CardTitle className="text-sm font-semibold text-white">Inspection Data</CardTitle>
            <Text variant="small" className="text-[11px] text-slate-500 mt-0.5">Showing {filteredReports.length} records</Text>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Filter inspections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:bg-slate-800 w-64 transition-all"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 border-slate-700 p-0">
              <Filter className="w-4 h-4 text-slate-400" />
            </Button>
          </div>
        </CardHeader>

        {filteredReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Industry</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredReports.map((report) => {
                  const issueCount = report.images.reduce((acc, img) => acc + img.annotations.length, 0);
                  return (
                    <tr key={report.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-3">
                        <Text variant="small" className="font-medium text-white">{report.title}</Text>
                        <Text variant="small" className="text-[10px] text-slate-500 font-mono">{report.id.split('-').pop()}</Text>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                            {report.client.substring(0, 2).toUpperCase()}
                          </div>
                          <Text variant="small" className="text-slate-400">{report.client}</Text>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                          {report.industry}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        {issueCount > 0 ? (
                          <Badge variant="warning" className="gap-1.5 px-2 py-0 border-none bg-amber-950/30 text-amber-500">
                            <span className="w-1 h-1 rounded-full bg-amber-500" />
                            {issueCount} Anomalies
                          </Badge>
                        ) : (
                          <Badge variant="success" className="gap-1.5 px-2 py-0 border-none bg-emerald-950/30 text-emerald-500">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Review Clear
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <Text variant="small" className="text-slate-500">{new Date(report.date).toLocaleDateString()}</Text>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewReport(report)}
                          className="text-cyan-500 hover:text-cyan-400 hover:bg-cyan-900/20 px-2 py-1 h-auto"
                        >
                          View Analysis
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center bg-slate-900/20">
            <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-700">
              <Search className="w-5 h-5 text-slate-500" />
            </div>
            <Heading level={4} className="text-white">No inspections found</Heading>
            <Text variant="small" className="text-slate-500 mt-1">Adjust your filters or initialize a new inspection.</Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
