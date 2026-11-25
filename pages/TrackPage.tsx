import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  Download,
  Map as MapIcon,
  List,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  ThumbsUp,
  Clock,
  Cpu,
} from 'lucide-react';
import { Grievance, IssueStatus } from '../types';
import { downloadService } from '../services/downloadService';
import LiveTrackingMap from '../components/LiveTrackingMap';
import ComplaintTimeline from '../components/ComplaintTimeline';

interface TrackPageProps {
  grievances: Grievance[];
  onUpvote?: (id: string) => void;
}

const TrackPage: React.FC<TrackPageProps> = ({ grievances, onUpvote }) => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('id') || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedIssue, setSelectedIssue] = useState<Grievance | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);

  useEffect(() => {
    const queryId = searchParams.get('id');
    if (queryId && grievances.length > 0) {
      const found = grievances.find((g) => g.id.toLowerCase() === queryId.toLowerCase());
      if (found) setSelectedIssue(found);
    }
  }, [searchParams, grievances]);

  // Keep selectedIssue synchronized with updated grievances list
  const activeSelected = useMemo(() => {
    if (!selectedIssue) return null;
    return grievances.find((g) => g.id === selectedIssue.id) || selectedIssue;
  }, [grievances, selectedIssue]);

  const filteredGrievances = useMemo(() => {
    return grievances.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      return (
        g.id.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.dnaSignature.toLowerCase().includes(q) ||
        (g.location.area || '').toLowerCase().includes(q) ||
        (g.location.district || '').toLowerCase().includes(q)
      );
    });
  }, [grievances, searchTerm, statusFilter]);

  const handleExport = async (type: 'pdf' | 'excel' | 'snapshot') => {
    if (!activeSelected) return;
    setExportingType(type);
    try {
      if (type === 'pdf') {
        await downloadService.exportGrievancePDF(activeSelected, 'Public Audit Viewer');
      } else if (type === 'excel') {
        downloadService.exportGrievancesExcel([activeSelected], `CivicConnect_${activeSelected.id}.xlsx`);
      } else if (type === 'snapshot') {
        await downloadService.captureSnapshot('audit-card-root', `Snapshot_${activeSelected.id}.png`);
      }
    } catch (error) {
      console.error('Export failed', error);
    } finally {
      setExportingType(null);
      setShowExportModal(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20 animate-fadeIn">
      {/* Export Modal */}
      {showExportModal && activeSelected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
          <div className="bg-white rounded-3xl p-7 max-w-md w-full relative z-10 shadow-2xl animate-slideUp">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-navy-900">Export Complaint Record</h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                disabled={!!exportingType}
                className="w-full p-4 bg-slate-50 hover:bg-teal-50 border border-slate-200 rounded-2xl flex items-center gap-4 transition-colors"
              >
                {exportingType === 'pdf' ? <Loader2 className="animate-spin text-teal-600" /> : <FileText className="text-teal-600" />}
                <div className="text-left">
                  <p className="text-sm font-bold text-navy-900">PDF Audit Report</p>
                  <p className="text-xs text-slate-500">Formatted official record & timeline</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleExport('excel')}
                disabled={!!exportingType}
                className="w-full p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-2xl flex items-center gap-4 transition-colors"
              >
                {exportingType === 'excel' ? <Loader2 className="animate-spin text-emerald-600" /> : <FileSpreadsheet className="text-emerald-600" />}
                <div className="text-left">
                  <p className="text-sm font-bold text-navy-900">Excel Spreadsheet (.xlsx)</p>
                  <p className="text-xs text-slate-500">Structured complaint fields</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleExport('snapshot')}
                disabled={!!exportingType}
                className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-2xl flex items-center gap-4 transition-colors"
              >
                {exportingType === 'snapshot' ? <Loader2 className="animate-spin text-indigo-600" /> : <ImageIcon className="text-indigo-600" />}
                <div className="text-left">
                  <p className="text-sm font-bold text-navy-900">PNG Snapshot</p>
                  <p className="text-xs text-slate-500">Shareable audit card image</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-10 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
                Public Transparency Feed
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-1">
                Track Civic Complaints
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Search by Tracking ID (e.g., CC-1001), location, or DNA signature to inspect live workflow timelines.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="text"
                  placeholder="Search ID, title, area..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium outline-none"
              >
                <option value="all">All Statuses</option>
                <option value={IssueStatus.SUBMITTED}>Submitted</option>
                <option value={IssueStatus.IN_PROGRESS}>In Progress</option>
                <option value={IssueStatus.ESCALATED}>Escalated</option>
                <option value={IssueStatus.RESOLVED}>Resolved</option>
              </select>
              <div className="inline-flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                    viewMode === 'list' ? 'bg-navy-900 text-white' : 'text-slate-600'
                  }`}
                >
                  <List size={15} /> List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                    viewMode === 'map' ? 'bg-navy-900 text-white' : 'text-slate-600'
                  }`}
                >
                  <MapIcon size={15} /> Map
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6">
          {viewMode === 'map' ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-3 shadow-sm">
              <LiveTrackingMap
                mode="viewer"
                grievances={filteredGrievances}
                selectedGrievanceId={activeSelected?.id}
                focusLocation={activeSelected?.location}
                onGrievanceClick={(g) => setSelectedIssue(g)}
                className="h-[580px]"
              />
            </div>
          ) : filteredGrievances.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-sm text-slate-500">
              No complaints match your search filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGrievances.map((g) => {
                const selected = activeSelected?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedIssue(g)}
                    className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all ${
                      selected
                        ? 'border-teal-600 ring-2 ring-teal-500/20 shadow-md'
                        : 'border-slate-200 hover:border-teal-400 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-navy-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {g.id}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">{g.category}</span>
                        {g.isSample ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Sample
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                            Live
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          g.status === IssueStatus.RESOLVED
                            ? 'bg-emerald-100 text-emerald-800'
                            : g.status === IssueStatus.ESCALATED
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-navy-900 mb-1">{g.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-3">{g.description}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-teal-600" />
                        {g.location.area || g.location.district}
                      </span>
                      <span>
                        Tier: <strong className="text-navy-900">{g.currentTier}</strong>
                      </span>
                      <span>
                        Priority: <strong className="text-navy-900">{g.priority}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail & Visual Timeline */}
        <div className="lg:col-span-6">
          {activeSelected ? (
            <div id="audit-card-root" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm sticky top-24 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-extrabold text-teal-700">{activeSelected.id}</span>
                    <span className="text-xs text-slate-400">• {activeSelected.dnaSignature}</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-navy-900">{activeSelected.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-300"
                    title="Export Record"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIssue(null)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700"
                    aria-label="Close details"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {activeSelected.image && (
                <img
                  src={activeSelected.image}
                  alt={activeSelected.title}
                  className="w-full max-h-60 object-cover rounded-2xl border border-slate-200"
                />
              )}

              <p className="text-sm text-slate-700 leading-relaxed">{activeSelected.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">Location</span>
                  <strong className="text-navy-900">
                    {activeSelected.location.address || `${activeSelected.location.area}, ${activeSelected.location.district}`}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">Department</span>
                  <strong className="text-navy-900">{activeSelected.assignedDepartment || 'Municipal'}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">SLA Deadline</span>
                  <strong className="text-navy-900 flex items-center gap-1">
                    <Clock size={12} className="text-teal-600" />
                    {activeSelected.slaDeadline ? new Date(activeSelected.slaDeadline).toLocaleDateString() : '7 Days'}
                  </strong>
                </div>
              </div>

              {activeSelected.aiSummary && (
                <div className="bg-navy-900 text-white rounded-2xl p-4 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-300 flex items-center gap-1.5">
                      <Cpu size={14} /> AI Complaint Summary
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">
                      {activeSelected.aiMode === 'live-ai' ? 'Live Gemini AI' : 'Demo AI Mode'}
                    </span>
                  </div>
                  <p className="text-slate-200">{activeSelected.aiSummary}</p>
                </div>
              )}

              <ComplaintTimeline grievance={activeSelected} />

              <div className="pt-2 flex items-center justify-between gap-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onUpvote?.(activeSelected.id)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                    activeSelected.votedByMe
                      ? 'bg-navy-900 text-white'
                      : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                  }`}
                >
                  <ThumbsUp size={15} /> Support / Upvote Issue ({activeSelected.upvotes})
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-navy-900 text-white rounded-3xl p-10 text-center sticky top-24">
              <MapPin size={44} className="text-teal-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Select a Complaint to Inspect</h3>
              <p className="text-sm text-slate-300 max-w-sm mx-auto">
                Click any complaint on the left or on the interactive map to view its visual workflow timeline, AI
                triage summary, and authority remarks.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackPage;
