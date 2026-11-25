import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  ListChecks,
  Bell,
  Star,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Check,
} from 'lucide-react';
import { Grievance, IssueStatus, NotificationItem, User } from '../types';
import { apiClient } from '../services/apiClient';
import PortalLayout, { SidebarNavItem } from '../components/PortalLayout';
import ComplaintTimeline from '../components/ComplaintTimeline';
import ReportPage from './ReportPage';

interface CitizenDashboardPageProps {
  user: User;
  grievances: Grievance[];
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

const CitizenDashboardPage: React.FC<CitizenDashboardPageProps> = ({
  user,
  grievances,
  onRefresh,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'complaints' | 'report' | 'notifications'>('overview');
  const [myComplaints, setMyComplaints] = useState<Grievance[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Grievance | null>(null);

  // Feedback state
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const loadCitizenData = async () => {
    setLoading(true);
    try {
      const [cRes, nRes] = await Promise.all([
        apiClient.getComplaints({ mine: 'true' }),
        apiClient.getNotifications(),
      ]);
      setMyComplaints(cRes.complaints);
      setNotifications(nRes.notifications);
    } catch (err) {
      console.error('Failed to load citizen dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCitizenData();
  }, [grievances.length]);

  const activeSelected = useMemo(() => {
    if (!selected) return myComplaints[0] || null;
    return myComplaints.find((c) => c.id === selected.id) || selected;
  }, [myComplaints, selected]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const resolvedCount = myComplaints.filter((c) => c.status === IssueStatus.RESOLVED).length;
  const pendingCount = myComplaints.filter((c) => c.status !== IssueStatus.RESOLVED && c.status !== 'Rejected').length;

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Dashboard Overview', icon: <LayoutDashboard size={17} /> },
    { id: 'complaints', label: 'My Complaints', icon: <ListChecks size={17} />, badge: myComplaints.length },
    { id: 'report', label: 'Report New Issue', icon: <FilePlus2 size={17} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={17} />, badge: unreadCount },
  ];

  const handleMarkRead = async (id: number) => {
    await apiClient.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await apiClient.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSelected) return;
    setSubmittingFeedback(true);
    setFeedbackSuccess(null);
    try {
      await apiClient.submitFeedback(activeSelected.id, rating, feedbackText);
      setFeedbackSuccess('Thank you! Your feedback has been recorded.');
      setFeedbackText('');
      await loadCitizenData();
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <PortalLayout
      portalTitle="Citizen Portal"
      portalSubtitle="Report public grievances, track real-time status, and provide resolution feedback"
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as any)}
      onLogout={onLogout}
    >
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">My Submitted Reports</p>
              <p className="text-3xl font-extrabold text-navy-900 mt-1">{myComplaints.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Active / In Progress</p>
              <p className="text-3xl font-extrabold text-amber-600 mt-1">{pendingCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Resolved Issues</p>
              <p className="text-3xl font-extrabold text-teal-600 mt-1">{resolvedCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Unread Updates</p>
              <p className="text-3xl font-extrabold text-navy-900 mt-1">{unreadCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-navy-900">Recent Submissions</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  + Report an Issue
                </button>
              </div>
              {loading ? (
                <div className="py-10 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading your complaints...
                </div>
              ) : myComplaints.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">
                  You haven't submitted any complaints yet. Click "Report an Issue" to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {myComplaints.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelected(c);
                        setActiveTab('complaints');
                      }}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-teal-400 bg-slate-50/70 hover:bg-white transition-all flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-navy-900">{c.id}</span>
                          <span className="text-xs text-slate-500">{c.category}</span>
                        </div>
                        <p className="text-sm font-bold text-navy-900">{c.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Currently with: {c.currentTier}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                          c.status === IssueStatus.RESOLVED
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === IssueStatus.ESCALATED
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-navy-900">Latest Notifications</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('notifications')}
                  className="text-xs font-bold text-teal-700 hover:underline"
                >
                  View All
                </button>
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">No notifications yet.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 4).map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-xl border text-xs ${
                        n.isRead ? 'bg-slate-50 border-slate-200' : 'bg-teal-50/60 border-teal-200'
                      }`}
                    >
                      <p className="font-bold text-navy-900">{n.title}</p>
                      <p className="text-slate-600 mt-1">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-base font-bold text-navy-900">Submitted Complaints ({myComplaints.length})</h2>
            {myComplaints.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                No complaints submitted yet.
              </div>
            ) : (
              myComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all ${
                    activeSelected?.id === c.id ? 'border-teal-600 ring-2 ring-teal-500/20' : 'border-slate-200 hover:border-teal-400'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-mono text-xs font-bold text-navy-900">{c.id}</span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-navy-900">
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-navy-900">{c.title}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                    <span>Priority: {c.priority}</span>
                    <span>{c.currentTier}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-7">
            {activeSelected ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-teal-700">
                      {activeSelected.id} • {activeSelected.dnaSignature}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {new Date(activeSelected.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-navy-900">{activeSelected.title}</h3>
                  <p className="text-sm text-slate-600 mt-2">{activeSelected.description}</p>
                </div>

                {activeSelected.image && (
                  <img
                    src={activeSelected.image}
                    alt={activeSelected.title}
                    className="w-full max-h-56 object-cover rounded-xl border border-slate-200"
                  />
                )}

                <ComplaintTimeline grievance={activeSelected} />

                {/* Feedback Form after Resolution */}
                {activeSelected.status === IssueStatus.RESOLVED && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-2">
                      <CheckCircle2 size={16} /> Resolution Feedback
                    </h4>
                    {activeSelected.rating ? (
                      <div className="text-xs text-emerald-800 space-y-1">
                        <p className="font-bold">You rated this resolution: {activeSelected.rating} / 5 Stars</p>
                        {activeSelected.feedback && <p>"{activeSelected.feedback}"</p>}
                      </div>
                    ) : (
                      <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-900">Your Rating:</span>
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setRating(num)}
                              className={`p-1 rounded-lg ${num <= rating ? 'text-amber-500' : 'text-slate-300'}`}
                            >
                              <Star size={18} fill={num <= rating ? 'currentColor' : 'none'} />
                            </button>
                          ))}
                        </div>
                        <textarea
                          rows={2}
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Share feedback on how this issue was resolved..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-200 text-xs outline-none"
                        />
                        {feedbackSuccess && <p className="text-xs font-bold text-emerald-700">{feedbackSuccess}</p>}
                        <button
                          type="submit"
                          disabled={submittingFeedback}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                Select a complaint to inspect its timeline and status.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'report' && (
        <ReportPage
          embedded
          onAdded={async () => {
            await onRefresh();
            await loadCitizenData();
          }}
          onDoneRedirect={() => setActiveTab('complaints')}
        />
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy-900">Status & Escalation Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-bold text-teal-700 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No notifications recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                    n.isRead ? 'bg-slate-50 border-slate-200' : 'bg-teal-50/70 border-teal-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {n.type === 'success' ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : n.type === 'warning' || n.type === 'alert' ? (
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <Clock size={18} className="text-teal-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-navy-900">{n.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-navy-900 hover:bg-slate-100 shrink-0 flex items-center gap-1"
                    >
                      <Check size={12} /> Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
};

export default CitizenDashboardPage;
