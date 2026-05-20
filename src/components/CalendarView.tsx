import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MapPin, User, Calendar as CalendarIcon } from 'lucide-react';
import { Deployment, DeploymentStatus } from '../types';

interface PilotReport {
    id: string;
    date: string;
    is_incident?: boolean;
    incident_severity?: string;
    pilot_name?: string;
    technician_name?: string;
}

interface CalendarViewProps {
    deployments: Deployment[];
    onDeploymentClick?: (deployment: Deployment) => void;
    onDayClick?: (date: string) => void;
    pilotReports?: PilotReport[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ deployments, onDeploymentClick, onDayClick, pilotReports = [] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthStart = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
    const daysInMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(), [currentDate]);
    const startDayOfWeek = monthStart.getDay();

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const getDeploymentsForDay = (day: number) => {
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        targetDate.setHours(0, 0, 0, 0);
        return deployments.filter(d => {
            const [y, m, dayStr] = d.date.split('-').map(Number);
            const deployStart = new Date(y, m - 1, dayStr);
            const deployEnd = new Date(deployStart);
            deployEnd.setDate(deployStart.getDate() + (d.daysOnSite || 1) - 1);
            return targetDate >= deployStart && targetDate <= deployEnd;
        });
    };

    const getPilotReportsForDay = (day: number) => {
        const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
            .toLocaleDateString('en-CA');
        return pilotReports.filter(r => String(r.date).split('T')[0] === dateStr);
    };

    const getStatusColor = (status: DeploymentStatus) => {
        switch (status) {
            case DeploymentStatus.COMPLETED: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case DeploymentStatus.ACTIVE: return 'bg-blue-100 text-blue-800 border-blue-200';
            case DeploymentStatus.SCHEDULED: return 'bg-amber-100 text-amber-800 border-amber-200';
            case DeploymentStatus.CANCELLED: return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const renderDays = () => {
        const days = [];

        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="bg-slate-50/50 min-h-[120px] border-b border-r border-slate-200" />);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDeployments = getDeploymentsForDay(i);
            const dayReports = getPilotReportsForDay(i);
            const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toDateString();
            const dateString = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toLocaleDateString('en-CA');

            const hasIncident = dayReports.some(r => r.is_incident);
            const hasReport = dayReports.length > 0;

            days.push(
                <div
                    key={i}
                    onClick={() => onDayClick?.(dateString)}
                    className={`min-h-[120px] bg-white border-b border-r border-slate-200 p-2 group hover:bg-slate-50 transition-colors cursor-pointer ${isToday ? 'bg-blue-50/30' : ''}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>
                            {i}
                        </span>
                        <div className="flex items-center gap-1">
                            {hasIncident && (
                                <span title="Incident reported" className="w-2 h-2 rounded-full bg-red-500 ring-1 ring-red-300" />
                            )}
                            {hasReport && !hasIncident && (
                                <span title="Field report submitted" className="w-2 h-2 rounded-full bg-violet-400" />
                            )}
                            {dayDeployments.length > 0 && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                    {dayDeployments.length}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {dayDeployments.map(d => (
                            <div
                                key={d.id}
                                onClick={(e) => { e.stopPropagation(); onDeploymentClick?.(d); }}
                                className={`text-[10px] p-1.5 rounded border ${getStatusColor(d.status)} shadow-sm cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition-all`}
                            >
                                <div className="font-semibold truncate flex items-center gap-1">
                                    {d.status === DeploymentStatus.ACTIVE && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                    {d.title}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5 opacity-80">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{d.siteName}</span>
                                </div>
                                {d.technicianIds.length > 0 && (
                                    <div className="flex items-center gap-1 mt-0.5 opacity-75">
                                        <User className="w-3 h-3" />
                                        <span className="truncate">{d.technicianIds.length} Techs</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {hasReport && (
                            <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${hasIncident ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'}`}>
                                {hasIncident ? '⚠' : '🤖'} {dayReports.length} report{dayReports.length > 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return days;
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
            {/* Calendar Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all border border-transparent hover:border-slate-200">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-slate-500" />
                    {monthName}
                </h2>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all border border-transparent hover:border-slate-200">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Legend */}
            <div className="px-6 py-2 border-b border-slate-100 bg-slate-50/30 flex items-center gap-5 text-[10px] text-slate-500 font-medium">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Field Report</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Incident Reported</span>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 last:border-r-0">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 bg-slate-200 gap-px border-l border-t border-slate-200">
                {renderDays()}
            </div>
        </div>
    );
};

export default CalendarView;
