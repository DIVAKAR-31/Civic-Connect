import React from 'react';
import { CheckCircle2, CircleDot, Clock, ShieldAlert, Cpu, FileCheck, UserCheck, ArrowUpRight } from 'lucide-react';
import { EscalationLevel, Grievance, IssueStatus } from '../types';

interface ComplaintTimelineProps {
  grievance: Grievance;
}

const WORKFLOW_STAGES = [
  { key: 'reported', label: 'Reported', sub: 'Citizen Submitted', icon: FileCheck },
  { key: 'ai', label: 'AI Triaged', sub: 'Priority & Dept', icon: Cpu },
  { key: 'village', label: 'Village / City President', sub: 'Tier 1 Review', icon: UserCheck },
  { key: 'taluk', label: 'Taluk Officer', sub: 'Tier 2 Escalation', icon: ArrowUpRight },
  { key: 'collector', label: 'District Collector', sub: 'Tier 3 Oversight', icon: ShieldAlert },
  { key: 'resolved', label: 'Resolved', sub: 'Citizen Notified', icon: CheckCircle2 },
];

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({ grievance }) => {
  const isResolved = grievance.status === IssueStatus.RESOLVED;
  const isRejected = grievance.status === IssueStatus.REJECTED;
  const tier = grievance.currentTier;

  const reachedIndex = (() => {
    if (isResolved) return 5;
    if (tier === EscalationLevel.DISTRICT_COLLECTOR) return 4;
    if (tier === EscalationLevel.TALUK_OFFICE) return 3;
    return 2; // Reported -> AI Triaged -> Village/City President
  })();

  return (
    <div className="space-y-6">
      {/* Horizontal / Responsive Visual Escalation Pipeline */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
            Resolution Workflow Timeline
          </h4>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isResolved
                ? 'bg-emerald-100 text-emerald-800'
                : isRejected
                ? 'bg-red-100 text-red-800'
                : grievance.status === IssueStatus.ESCALATED
                ? 'bg-amber-100 text-amber-800'
                : 'bg-teal-100 text-teal-800'
            }`}
          >
            {grievance.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {WORKFLOW_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const completed = idx < reachedIndex || (isResolved && idx === 5);
            const current = !isResolved && !isRejected && idx === reachedIndex;
            // Skip intermediate escalation tiers visually if resolved directly at Tier 1
            const bypassed =
              isResolved &&
              ((idx === 3 && tier === EscalationLevel.VILLAGE_PRESIDENT) ||
                (idx === 4 && tier !== EscalationLevel.DISTRICT_COLLECTOR));

            return (
              <div
                key={stage.key}
                className={`relative rounded-xl p-3 border transition-all ${
                  current
                    ? 'bg-navy-900 text-white border-navy-900 shadow-md'
                    : completed && !bypassed
                    ? 'bg-teal-50 border-teal-200 text-navy-900'
                    : bypassed
                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-70'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      current
                        ? 'bg-teal-500 text-white'
                        : completed && !bypassed
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <span className="text-[10px] font-bold opacity-75">0{idx + 1}</span>
                </div>
                <p className="text-xs font-bold leading-snug">{stage.label}</p>
                <p className={`text-[10px] mt-0.5 ${current ? 'text-teal-200' : 'text-slate-500'}`}>
                  {bypassed ? 'Not Needed' : stage.sub}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chronological Audit Trail */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Clock size={14} className="text-teal-600" /> Audit History & Authority Remarks
        </h4>
        <div className="relative pl-6 space-y-4">
          <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200" />
          {(grievance.resolveChain || []).map((ev, i) => {
            const isLast = i === grievance.resolveChain.length - 1;
            return (
              <div key={i} className="relative">
                <div
                  className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                    isLast ? 'bg-teal-600' : 'bg-navy-800'
                  }`}
                >
                  <CircleDot size={8} className="text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-navy-900">{ev.action}</span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {ev.remarks && <p className="text-xs text-slate-600 mb-1.5">{ev.remarks}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-teal-700">{ev.actor}</span>
                    {ev.tier && <span>• {ev.tier}</span>}
                    <span>• Status: {ev.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ComplaintTimeline;
