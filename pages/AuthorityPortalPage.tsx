import React, { useState, useMemo } from 'react';
import {
  Building2,
  ClipboardCheck,
  Clock,
  ArrowUpCircle,
  CheckCircle2,
  BarChart3,
  AlertTriangle,
  MapPin,
  Loader2,
  ShieldAlert,
  Map as MapIcon,
} from 'lucide-react';
import { AnalyticsData, EscalationLevel, Grievance, IssueStatus, User } from '../types';
import { apiClient } from '../services/apiClient';
import PortalLayout, { SidebarNavItem } from '../components/PortalLayout';
import ComplaintTimeline from '../components/ComplaintTimeline';
import AnalyticsCharts from '../components/AnalyticsCharts';
import LiveTrackingMap from '../components/LiveTrackingMap';

interface AuthorityPortalPageProps {
  user: User;
  grievances: Grievance[];
  analytics: AnalyticsData | null;
  analyticsScope: 'all' | 'live' | 'sample';
  onScopeChange: (s: 'all' | 'live' | 'sample') => void;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

const AuthorityPortalPage: React.FC<AuthorityPortalPageProps> = ({
  user,
  grievances,
  analytics,
  analyticsScope,
  onScopeChange,
  onRefresh,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'assigned' | 'sla' | 'map' | 'analytics'>('assigned');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [acting, setActing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const myTier = (user.authorityTier || user.adminLevel || EscalationLevel.VILLAGE_PRESIDENT) as string;

  // Filter complaints assigned to this authority's tier (and jurisdiction if specified)
  const tierComplaints = useMemo(() => {
    return grievances.filter((g) => {
      if (user.role === 'admin') return true;
      if (g.currentTier !== myTier) return false;
      if (myTier === EscalationLevel.DISTRICT_COLLECTOR && user.district) {
        return !g.location.district || g.location.district.toLowerCase() === user.district.toLowerCase();
      }
      if (myTier === EscalationLevel.TALUK_OFFICE && user.taluk) {
        return !g.location.taluk || g.location.taluk.toLowerCase() === user.taluk.toLowerCase();
      }
      return true;
    });
  }, [grievances, user, myTier]);

  const overdueList = useMemo(() => {
    return tierComplaints.filter(
      (g) =>
        g.status !== IssueStatus.RESOLVED &&
        g.status !== IssueStatus.REJECTED &&
        g.slaDeadline &&
        new Date(g.slaDeadline).getTime() < Date.now()
    );
  }, [tierComplaints]);

  const activeList = activeTab === 'sla' ? overdueList : tierComplaints;
  const selectedCase = useMemo(
    () => activeList.find((g) => g.id === selectedId) || activeList[0] || null,
    [activeList, selectedId]
  );

  const formatSlaCountdown = (deadline?: string, status?: string) => {
    if (status === IssueStatus.RESOLVED) return 'Resolved';
    if (!deadline) return '7d SLA';
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff < 0) {
      const hrs = Math.abs(Math.floor(diff / 3600000));
      return `OVERDUE by ${hrs}h`;
    }
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    return `${days}d ${hrs}h left`;
  };

  const handleAction = async (actionType: 'progress' | 'resolve' | 'escalate') => {
    if (!selectedCase) return;
    setActing(true);
    try {
      await apiClient.authorityAction(selectedCase.id, {
        actionType,
        status: actionType === 'progress' ? IssueStatus.IN_PROGRESS : undefined,
        remarks: remarks.trim() || undefined,
      });
      setRemarks('');
      setBanner(
        actionType === 'escalate'
          ? `Complaint ${selectedCase.id} escalated to next authority tier.`
          : actionType === 'resolve'
          ? `Complaint ${selectedCase.id} marked Resolved & citizen notified.`
          : `Progress updated for ${selectedCase.id}.`
      );
      setTimeout(() => setBanner(null), 4000);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  const navItems: SidebarNavItem[] = [
    { id: 'assigned', label: 'Assigned Queue', icon: <ClipboardCheck size={17} />, badge: tierComplaints.length },
    { id: 'sla', label: 'SLA Deadlines', icon: <Clock size={17} />, badge: overdueList.length },
    { id: 'map', label: 'Jurisdiction Map', icon: <MapIcon size={17} />, badge: tierComplaints.length },
    { id: 'analytics', label: 'Performance Stats', icon: <BarChart3 size={17} /> },
  ];

  const isHighestTier = myTier === EscalationLevel.DISTRICT_COLLECTOR;

  return (
    <PortalLayout
      portalTitle="Government Authority Portal"
      portalSubtitle={`Hierarchical Tier: ${myTier}${user.district ? ` • ${user.district}` : ''}`}
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as any)}
      onLogout={onLogout}
    >
      {banner && (
        <div className="mb-5 p-4 rounded-2xl bg-navy-900 text-white text-xs font-bold flex items-center gap-2 shadow-md">
          <CheckCircle2 size={16} className="text-teal-400" /> {banner}
        </div>
      )}

      {/* Hierarchy Indicator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          Government Oversight Hierarchy
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            EscalationLevel.VILLAGE_PRESIDENT,
            EscalationLevel.TALUK_OFFICE,
            EscalationLevel.DISTRICT_COLLECTOR,
          ].map((tier, idx) => {
            const active = tier === myTier;
            return (
              <div
                key={tier}
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  active ? 'bg-navy-900 text-white border-navy-900' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    active ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  T{idx + 1}
                </div>
                <div>
                  <p className="text-xs font-bold">{tier}</p>
                  <p className={`text-[10px] ${active ? 'text-teal-300' : 'text-slate-400'}`}>
                    {active ? 'Active Authority Node' : 'Hierarchy Tier'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <AnalyticsCharts analytics={analytics} scope={analyticsScope} onScopeChange={onScopeChange} />
      ) : activeTab === 'map' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-navy-900">Jurisdiction Complaint Locations (OpenStreetMap)</h2>
              <p className="text-xs text-slate-500">
                Inspect pinned locations for complaints assigned to {myTier}. Click a marker to select it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('assigned')}
              className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-teal-600 text-white text-xs font-bold"
            >
              Open Assigned Queue
            </button>
          </div>
          <LiveTrackingMap
            mode="viewer"
            grievances={tierComplaints}
            selectedGrievanceId={selectedCase?.id}
            focusLocation={selectedCase?.location}
            onGrievanceClick={(g) => setSelectedId(g.id)}
            className="h-[500px]"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-base font-bold text-navy-900">
              {activeTab === 'sla' ? `Overdue SLA Queue (${activeList.length})` : `Assigned Complaints (${activeList.length})`}
            </h2>
            {activeList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                No complaints currently in this queue.
              </div>
            ) : (
              activeList.map((g) => {
                const slaLabel = formatSlaCountdown(g.slaDeadline, g.status);
                const overdue = slaLabel.startsWith('OVERDUE');
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all ${
                      selectedCase?.id === g.id
                        ? 'border-teal-600 ring-2 ring-teal-500/20 shadow-md'
                        : 'border-slate-200 hover:border-teal-400'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-mono text-xs font-bold text-navy-900">{g.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          overdue
                            ? 'bg-rose-100 text-rose-700'
                            : g.status === IssueStatus.RESOLVED
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-teal-50 text-teal-800'
                        }`}
                      >
                        {slaLabel}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-navy-900">{g.title}</p>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-2">
                      <span>{g.category}</span>
                      <span>Priority: <strong>{g.priority}</strong></span>
                      <span>{g.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="lg:col-span-7">
            {selectedCase ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-teal-700">
                      {selectedCase.id} • {selectedCase.assignedDepartment || selectedCase.category}
                    </span>
                    <h3 className="text-xl font-extrabold text-navy-900 mt-0.5">{selectedCase.title}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-navy-900 text-xs font-bold">
                    {selectedCase.status}
                  </span>
                </div>

                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {selectedCase.description}
                </p>

                {selectedCase.image && (
                  <img
                    src={selectedCase.image}
                    alt={selectedCase.title}
                    className="w-full max-h-56 object-cover rounded-xl border border-slate-200"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block">Site Location & Coordinates</span>
                    <strong className="text-navy-900 flex items-center gap-1 mt-0.5">
                      <MapPin size={13} className="text-teal-600 shrink-0" />
                      {selectedCase.location.address || selectedCase.location.area}
                    </strong>
                    <span className="font-mono text-[11px] text-teal-700 block mt-0.5">
                      {selectedCase.location.latitude.toFixed(5)}, {selectedCase.location.longitude.toFixed(5)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block">SLA Status</span>
                    <strong className="text-navy-900 block mt-0.5">
                      {formatSlaCountdown(selectedCase.slaDeadline, selectedCase.status)}
                    </strong>
                  </div>
                </div>

                <LiveTrackingMap
                  mode="viewer"
                  grievances={[selectedCase]}
                  selectedGrievanceId={selectedCase.id}
                  focusLocation={selectedCase.location}
                  className="h-[220px]"
                />

                {/* Authority Actions */}
                {selectedCase.status !== IssueStatus.RESOLVED && selectedCase.status !== IssueStatus.REJECTED ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900 flex items-center gap-2">
                      <Building2 size={14} className="text-teal-600" /> Authority Action & Remarks
                    </h4>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter field inspection notes, action taken, or escalation reason..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-teal-600"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => handleAction('progress')}
                        className="py-3 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        {acting && <Loader2 size={14} className="animate-spin" />}
                        Update Progress
                      </button>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => handleAction('resolve')}
                        className="py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={15} /> Mark Resolved
                      </button>
                      {!isHighestTier ? (
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => handleAction('escalate')}
                          className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <ArrowUpCircle size={15} /> Escalate Next Tier
                        </button>
                      ) : (
                        <div className="py-3 px-4 rounded-xl bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center gap-1">
                          <ShieldAlert size={14} /> Top Authority Tier
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={15} /> Case closed ({selectedCase.status}). Review full timeline below.
                  </div>
                )}

                <ComplaintTimeline grievance={selectedCase} />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
                Select a complaint to update progress, resolve, or escalate.
              </div>
            )}
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default AuthorityPortalPage;
