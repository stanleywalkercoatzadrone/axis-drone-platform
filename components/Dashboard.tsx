
import React, { useEffect, useState } from 'react';
import { Industry, InspectionReport } from '../types';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ShieldCheck,
  TowerControl,
  HardHat,
  Eye,
  Search,
  Filter,
  ArrowUpRight,
  Battery,
  Signal,
  Clock,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

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
  { id: 'AX-04', status: 'In Mission', battery: 74, signal: 98, location: 'Sector 4', task: 'Thermal Scan' },
  { id: 'AX-09', status: 'Returning', battery: 12, signal: 85, location: 'Transit', task: 'Low Battery' },
  { id: 'AX-11', status: 'Standby', battery: 100, signal: 100, location: 'Base', task: 'Ready' },
];

const Dashboard: React.FC<DashboardProps> = ({ onNewReport, onViewReport, isArchiveView }) => {
  const [savedReports, setSavedReports] = useState<InspectionReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const reports = JSON.parse(localStorage.getItem('skylens_reports') || '[]');
    setSavedReports(reports);
  }, [isArchiveView]);

  const totalIssues = savedReports.reduce((acc, rep) => {
    return acc + rep.images.reduce((imgAcc, img) => imgAcc + img.annotations.length, 0);
  }, 0);

  const filteredReports = savedReports.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatCard = ({ label, value, trend, trendGood, icon: Icon }: any) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-lg">
          <Icon className="w-5 h-5 text-slate-500" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${trendGood ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
            {trend} <ArrowUpRight className="w-3 h-3" />
          </div>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
        <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 font-sans text-slate-900 animate-in fade-in duration-500">

      {!isArchiveView && (
        <>
          <div className="flex items-end justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Mission Control</h2>
              <p className="text-sm text-slate-500">Real-time operational status and fleet telemetry.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Missions" value="3" trend="+12%" trendGood={true} icon={Activity} />
            <StatCard label="Anomalies Found" value={totalIssues} trend="+5%" trendGood={false} icon={AlertTriangle} />
            <StatCard label="Fleet Efficiency" value="94%" trend="+2.4%" trendGood={true} icon={Zap} />
            <StatCard label="Data Ingested" value="1.2TB" trend="Today" trendGood={true} icon={Clock} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Fleet Status */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-semibold text-slate-900">Active Fleet</h3>
                <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">Live Telemetry</span>
              </div>
              <div className="divide-y divide-slate-100">
                {activeDrones.map(drone => (
                  <div key={drone.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${drone.status === 'In Mission' ? 'bg-emerald-500 animate-pulse' : drone.status === 'Returning' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{drone.id}</p>
                        <p className="text-xs text-slate-500">{drone.task}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {drone.location}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 w-24">
                        <Battery className={`w-3.5 h-3.5 ${drone.battery < 20 ? 'text-red-500' : 'text-slate-400'}`} />
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${drone.battery < 20 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${drone.battery}%` }} />
                        </div>
                        <span>{drone.battery}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions / New Inspection */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Initialize Inspection</h3>
                <div className="space-y-2">
                  {[
                    { id: Industry.SOLAR, label: 'Solar Array', icon: Zap },
                    { id: Industry.UTILITIES, label: 'Grid Infrastructure', icon: TowerControl },
                    { id: Industry.INSURANCE, label: 'Property Audit', icon: ShieldCheck },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onNewReport(item.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-md text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-900 mb-2">Ingest Load</h4>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={operationalData}>
                      <defs>
                        <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="load" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Inspection Data</h3>
            <p className="text-xs text-slate-500 mt-0.5">Showing {filteredReports.length} records</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter inspections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white w-64 transition-all"
              />
            </div>
            <button className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filteredReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Industry</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const issueCount = report.images.reduce((acc, img) => acc + img.annotations.length, 0);
                  return (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-3">
                        <p className="text-sm font-medium text-slate-900">{report.title}</p>
                        <p className="text-xs text-slate-500 font-mono">{report.id.split('-').pop()}</p>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {report.client.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-600">{report.client}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                          {report.industry}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {issueCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {issueCount} Anomalies
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Review Clear
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-500">
                        {new Date(report.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => onViewReport(report)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Analysis
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">No inspections found</h3>
            <p className="text-xs text-slate-500 mt-1">Adjust your filters or initialize a new mission.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
