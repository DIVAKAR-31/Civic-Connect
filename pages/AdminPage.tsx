import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  FileText,
  Zap,
  History,
  Cpu,
  Map as MapIcon,
} from 'lucide-react';
import {
  AdminAIAnalysis,
  AnalyticsData,
  EscalationLevel,
  Grievance,
  IssuePriority,
  IssueStatus,
  User,
} from '../types';
import { apiClient } from '../services/apiClient';
import { aiService } from '../services/geminiService';
import { downloadService } from '../services/downloadService';
import PortalLayout, { SidebarNavItem } from '../components/PortalLayout';
import AnalyticsCharts from '../components/AnalyticsCharts';
import ComplaintTimeline from '../components/ComplaintTimeline';
import LiveTrackingMap from '../components/LiveTrackingMap';

interface AdminPageProps {
  user: User;
  grievances: Grievance[];
  analytics: AnalyticsData | null;
  analyticsScope: 'all' | 'live' | 'sample';
  onScopeChange: (s: 'all' | 'live' | 'sample') => void;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

const DEPARTMENTS = [
  'Public Works & Roads',
  'Sanitation & Solid Waste',
  'Electrical & Street Lighting',
  'Water Supply & Sewerage',
  'Stormwater & Drainage',
  'Public Health & Veterinary',
  'Urban Planning & Enforcement',
  'General Municipal Administration',
];

const AdminPage: React.FC<AdminPageProps> = ({
  user,
  grievances,
  analytics,
  analyticsScope,
  onScopeChange,
  onRefresh,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'complaints' | 'map' | 'unresolved'>('analytics');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editDept, setEditDept] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const [aiScan, setAiScan] = useState<AdminAIAnalysis | null>(null);
  const [scanningAi, setScanningAi] = useState(false);

  const selectedCase = useMemo(
    () => grievances.find((g) => g.id === selectedId) || grievances[0] || null,
    [grievances, selectedId]
  );

  useEffect(() => {
    if (selectedCase) {
      setEditPriority(selectedCase.priority);
      setEditStatus(selectedCase.status);
      setEditTier(selectedCase.currentTier);
      setEditDept(selectedCase.assignedDepartment || DEPARTMENTS[0]);
      setAiScan(null);
    }
  }, [selectedCase?.id]);

  const stats = useMemo(() => {
    const total = grievances.length;
    const pending = grievances.filter((g) => g.status === IssueStatus.SUBMITTED || g.status === IssueStatus.ESCALATED).length;
    const inProgress = grievances.filter((g) => g.status === IssueStatus.IN_PROGRESS).length;
    const resolved = grievances.filter((g) => g.status === IssueStatus.RESOLVED).length;
    const overdue = grievances.filter(
      (g) => g.status !== IssueStatus.RESOLVED && g.status !== IssueStatus.REJECTED && g.slaDeadline && new Date(g.slaDeadline).getTime() < Date.now()
    ).length;
    return { total, pending, inProgress, resolved, overdue };
  }, [grievances]);

  const filtered = useMemo(() => {
    return grievances.filter((g) => {
      if (activeTab === 'unresolved' && (g.status === IssueStatus.RESOLVED || g.status === IssueStatus.REJECTED)) {
        return false;
      }
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && g.priority !== priorityFilter) return false;
      if (tierFilter !== 'all' && g.currentTier !== tierFilter) return false;
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      return (
        g.id.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        (g.location.district || '').toLowerCase().includes(q) ||
        (g.location.area || '').toLowerCase().includes(q)
      );
    });
  }, [grievances, activeTab, statusFilter, priorityFilter, tierFilter, searchTerm]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSaving(true);
    try {
      await apiClient.adminUpdateComplaint(selectedCase.id, {
        priority: editPriority,
        status: editStatus,
        currentTier: editTier,
        assignedDepartment: editDept,
        remarks: remarks.trim() || undefined,
      });
      setRemarks('');
      setFeedbackBanner(`Updated ${selectedCase.id} and notified citizen.`);
      setTimeout(() => setFeedbackBanner(null), 4000);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunAiScan = async () => {
    if (!selectedCase) return;
    setScanningAi(true);
    try {
      const res = await aiService.analyzeCaseForAdmin(selectedCase.id);
      setAiScan(res);
    } catch (err: any) {
      alert(err.message || 'AI risk scan failed.');
    } finally {
      setScanningAi(false);
    }
  };

  const handleAutoEscalate = async () => {
    try {
      const res = await apiClient.autoEscalateOverdue();
      setFeedbackBanner(
        res.escalatedCount > 0
          ? `Auto-escalated ${res.escalatedCount} overdue complaint(s) to the next authority tier.`
          : 'No overdue complaints required escalation.'
      );
      setTimeout(() => setFeedbackBanner(null), 4500);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Auto-escalation failed.');
    }
  };

  const navItems: SidebarNavItem[] = [
    { id: 'analytics', label: 'Analytics & KPIs', icon: <LayoutDashboard size={17} /> },
    { id: 'complaints', label: 'All Complaints', icon: <ClipboardList size={17} />, badge: stats.total },
    { id: 'map', label: 'Complaints Map', icon: <MapIcon size={17} />, badge: grievances.length },
    { id: 'unresolved', label: 'Unresolved & SLA', icon: <AlertTriangle size={17} />, badge: stats.overdue },
  ];

  const isOverdue = (g: Grievance) =>
    g.status !== IssueStatus.RESOLVED &&
    g.status !== IssueStatus.REJECTED &&
    g.slaDeadline &&
    new Date(g.slaDeadline).getTime() < Date.now();

  return (
    <PortalLayout
      portalTitle="Admin Portal"
      portalSubtitle="System-wide complaint oversight, priority control, authority routing & audit logs"
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as any)}
      onLogout={onLogout}
    >
      {feedbackBanner && (
        <div className="mb-5 p-4 rounded-2xl bg-navy-900 text-white text-xs font-bold flex items-center justify-between shadow-md">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400" /> {feedbackBanner}
          </span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Total Complaints</p>
          <p className="text-2xl font-extrabold text-navy-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Pending / Escalated</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">In Progress</p>
          <p className="text-2xl font-extrabold text-sky-600 mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Resolved</p>
          <p className="text-2xl font-extrabold text-teal-600 mt-1">{stats.resolved}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold text-slate-500">Overdue SLA</p>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{stats.overdue}</p>
        </div>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-navy-900">Municipal Analytics & Oversight</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAutoEscalate}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Zap size={14} /> Run SLA Auto-Escalation
              </button>
              <button
                type="button"
                onClick={() => downloadService.exportGrievancesExcel(grievances, 'CivicConnect_Admin_Report.xlsx')}
                className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>
          </div>
          <AnalyticsCharts analytics={analytics} scope={analyticsScope} onScopeChange={onScopeChange} />
        </div>
      )}

      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-navy-900">Geospatial Complaint Map (OpenStreetMap)</h2>
              <p className="text-xs text-slate-500">
                Click any marker to inspect details or switch to All Complaints to update priority & routing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('complaints')}
              className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-teal-600 text-white text-xs font-bold"
            >
              Manage Selected Case
            </button>
          </div>
          <LiveTrackingMap
            mode="viewer"
            grievances={grievances}
            selectedGrievanceId={selectedCase?.id}
            focusLocation={selectedCase?.location}
            onGrievanceClick={(g) => setSelectedId(g.id)}
            className="h-[520px]"
          />
        </div>
      )}

      {(activeTab === 'complaints' || activeTab === 'unresolved') && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row gap-3 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ID, title, category, district, area..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-teal-600"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTab === 'complaints' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                >
                  <option value="all">All Statuses</option>
                  <option value={IssueStatus.SUBMITTED}>Submitted</option>
                  <option value={IssueStatus.IN_PROGRESS}>In Progress</option>
                  <option value={IssueStatus.ESCALATED}>Escalated</option>
                  <option value={IssueStatus.RESOLVED}>Resolved</option>
                  <option value={IssueStatus.REJECTED}>Rejected</option>
                </select>
              )}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
              >
                <option value="all">All Priorities</option>
                <option value={IssuePriority.LOW}>Low</option>
                <option value={IssuePriority.MEDIUM}>Medium</option>
                <option value={IssuePriority.HIGH}>High</option>
                <option value={IssuePriority.CRITICAL}>Critical</option>
              </select>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
              >
                <option value="all">All Authority Tiers</option>
                <option value={EscalationLevel.VILLAGE_PRESIDENT}>Village / City President</option>
                <option value={EscalationLevel.TALUK_OFFICE}>Taluk Officer</option>
                <option value={EscalationLevel.DISTRICT_COLLECTOR}>District Collector</option>
              </select>
            </div>
          </div>

          {/* List + Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                  No matching complaints found.
                </div>
              ) : (
                filtered.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all ${
                      selectedCase?.id === g.id
                        ? 'border-teal-600 ring-2 ring-teal-500/20 shadow-md'
                        : 'border-slate-200 hover:border-teal-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-navy-900">{g.id}</span>
                      <div className="flex items-center gap-1.5">
                        {isOverdue(g) && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                            SLA OVERDUE
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            g.priority === 'Critical'
                              ? 'bg-rose-600 text-white'
                              : g.priority === 'High'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {g.priority}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-navy-900">{g.title}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 mt-2">
                      <span>{g.location.district || g.location.area}</span>
                      <span>{g.currentTier}</span>
                      <span className="font-semibold text-teal-700">{g.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="lg:col-span-7">
              {selectedCase ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-teal-700">
                        {selectedCase.id} • {selectedCase.dnaSignature}
                      </span>
                      <h3 className="text-xl font-extrabold text-navy-900 mt-0.5">{selectedCase.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Reported by: <strong>{selectedCase.citizenName || 'Citizen'}</strong> •{' '}
                        {new Date(selectedCase.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleRunAiScan}
                        disabled={scanningAi}
                        className="px-3 py-2 rounded-xl bg-navy-900 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        {scanningAi ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                        AI Risk Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadService.exportGrievancePDF(selectedCase, user.email)}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5"
                      >
                        <FileText size={14} /> PDF
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {selectedCase.description}
                  </p>

                  {selectedCase.image && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1.5">Uploaded Photo Evidence</p>
                      <img
                        src={selectedCase.image}
                        alt={selectedCase.title}
                        className="w-full max-h-56 object-cover rounded-xl border border-slate-200"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                      <MapPin size={15} className="text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-400 block">Location & Coordinates</span>
                        <strong className="text-navy-900 block">
                          {selectedCase.location.address} ({selectedCase.location.village || selectedCase.location.area},{' '}
                          {selectedCase.location.district})
                        </strong>
                        <span className="font-mono text-[11px] text-teal-700">
                          {selectedCase.location.latitude.toFixed(5)}, {selectedCase.location.longitude.toFixed(5)}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                      <Clock size={15} className="text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-400 block">SLA Deadline</span>
                        <strong className={isOverdue(selectedCase) ? 'text-rose-600' : 'text-navy-900'}>
                          {selectedCase.slaDeadline
                            ? new Date(selectedCase.slaDeadline).toLocaleString()
                            : 'Not set'}
                          {isOverdue(selectedCase) ? ' (OVERDUE)' : ''}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <LiveTrackingMap
                    mode="viewer"
                    grievances={[selectedCase]}
                    selectedGrievanceId={selectedCase.id}
                    focusLocation={selectedCase.location}
                    className="h-[220px]"
                  />

                  {aiScan && (
                    <div className="p-4 rounded-2xl bg-navy-900 text-white text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-300">SLA Risk & Complexity Assessment</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px]">{aiScan.modeLabel}</span>
                      </div>
                      <p className="text-slate-200">{aiScan.priorityJustification}</p>
                      <div className="flex gap-4 text-[11px] pt-1">
                        <span>Risk Score: <strong className="text-rose-300">{aiScan.riskScore}%</strong></span>
                        <span>Complexity: <strong className="text-teal-300">{aiScan.resourceComplexity}</strong></span>
                        <span>SLA Status: <strong className="uppercase">{aiScan.slaStatus}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Admin Controls: Priority, Authority Tier, Department, Status */}
                  <form onSubmit={handleSaveChanges} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                      Admin Assignment & Status Controls
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Priority</label>
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold"
                        >
                          <option value={IssuePriority.LOW}>Low</option>
                          <option value={IssuePriority.MEDIUM}>Medium</option>
                          <option value={IssuePriority.HIGH}>High</option>
                          <option value={IssuePriority.CRITICAL}>Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold"
                        >
                          <option value={IssueStatus.SUBMITTED}>Submitted</option>
                          <option value={IssueStatus.IN_PROGRESS}>In Progress</option>
                          <option value={IssueStatus.ESCALATED}>Escalated</option>
                          <option value={IssueStatus.RESOLVED}>Resolved</option>
                          <option value={IssueStatus.REJECTED}>Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Assign Authority Tier</label>
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold"
                        >
                          <option value={EscalationLevel.VILLAGE_PRESIDENT}>Village / City President</option>
                          <option value={EscalationLevel.TALUK_OFFICE}>Taluk Officer</option>
                          <option value={EscalationLevel.DISTRICT_COLLECTOR}>District Collector</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
                        <select
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold"
                        >
                          {DEPARTMENTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Admin Audit Remark</label>
                      <input
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Add official note for citizen & authority audit log..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3 bg-navy-900 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      Apply Updates & Notify Citizen
                    </button>
                  </form>

                  <div className="pt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-3">
                      <History size={14} className="text-teal-600" /> Complaint History & Audit Logs
                    </div>
                    <ComplaintTimeline grievance={selectedCase} />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
                  Select a complaint from the list to inspect and manage.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default AdminPage;
