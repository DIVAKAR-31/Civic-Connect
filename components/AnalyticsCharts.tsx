import React from 'react';
import { BarChart3, TrendingUp, Award, Layers } from 'lucide-react';
import { AnalyticsData } from '../types';

interface AnalyticsChartsProps {
  analytics: AnalyticsData | null;
  scope: 'all' | 'live' | 'sample';
  onScopeChange: (s: 'all' | 'live' | 'sample') => void;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ analytics, scope, onScopeChange }) => {
  if (!analytics) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Loading analytics telemetry...
      </div>
    );
  }

  const maxCat = Math.max(1, ...analytics.byCategory.map((c) => c.count));
  const maxMonth = Math.max(
    1,
    ...analytics.monthlyStats.flatMap((m) => [m.submitted, m.resolved])
  );

  return (
    <div className="space-y-6">
      {/* Live vs Sample Data Scope Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-navy-900">
            Data Provenance & Transparency
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Live DB Reports: <strong className="text-teal-700">{analytics.counts.live}</strong> • Seeded Sample Cases:{' '}
            <strong className="text-slate-700">{analytics.counts.sample}</strong>
          </p>
        </div>
        <div className="inline-flex bg-slate-100 p-1 rounded-xl">
          {(
            [
              { id: 'all', label: `All (${analytics.counts.live + analytics.counts.sample})` },
              { id: 'live', label: `Live Only (${analytics.counts.live})` },
              { id: 'sample', label: `Sample Only (${analytics.counts.sample})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onScopeChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scope === tab.id
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category-wise Complaint Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <BarChart3 size={18} className="text-teal-600" /> Category-wise Complaints
              </h3>
              <p className="text-xs text-slate-500">Distribution across municipal issue types</p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {scope === 'live' ? 'Live Data' : scope === 'sample' ? 'Sample Data' : 'Combined'}
            </span>
          </div>

          {analytics.byCategory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No complaints in this dataset yet. Submit a new complaint to populate live charts.
            </div>
          ) : (
            <div className="space-y-3.5">
              {analytics.byCategory.slice(0, 7).map((item) => {
                const pct = Math.round((item.count / maxCat) * 100);
                return (
                  <div key={item.category}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-700">{item.category}</span>
                      <span className="text-navy-900">{item.count}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-navy-800 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly Complaint Statistics & Resolution Trends */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-teal-600" /> Monthly Stats & Resolution Trend
              </h3>
              <p className="text-xs text-slate-500">Submitted vs. resolved over the last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-navy-900">
                <span className="w-2.5 h-2.5 rounded-sm bg-navy-800 inline-block" /> Submitted
              </span>
              <span className="flex items-center gap-1.5 text-teal-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> Resolved
              </span>
            </div>
          </div>

          <div className="h-52 flex items-end justify-between gap-3 pt-4 border-b border-slate-100 pb-2">
            {analytics.monthlyStats.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1.5 h-40">
                  <div
                    className="w-4 sm:w-5 bg-navy-800 rounded-t-md transition-all duration-500 relative group"
                    style={{ height: `${m.submitted > 0 ? Math.max((m.submitted / maxMonth) * 100, 12) : 4}%` }}
                    title={`Submitted: ${m.submitted}`}
                  >
                    {m.submitted > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-navy-900">
                        {m.submitted}
                      </span>
                    )}
                  </div>
                  <div
                    className="w-4 sm:w-5 bg-teal-500 rounded-t-md transition-all duration-500 relative group"
                    style={{ height: `${m.resolved > 0 ? Math.max((m.resolved / maxMonth) * 100, 12) : 4}%` }}
                    title={`Resolved: ${m.resolved}`}
                  >
                    {m.resolved > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-teal-700">
                        {m.resolved}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Authority-wise Performance */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Award size={18} className="text-teal-600" /> Authority-wise Performance & Workload
            </h3>
            <p className="text-xs text-slate-500">
              Hierarchical resolution efficiency across Village/City President, Taluk Officer & District Collector
            </p>
          </div>
          <Layers size={18} className="text-slate-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analytics.authorityPerformance.map((ap) => (
            <div key={ap.tier} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-navy-900">{ap.tier}</span>
                <span className="text-xs font-extrabold text-teal-700">{ap.resolutionRate}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(ap.resolutionRate, ap.total > 0 ? 5 : 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Assigned: <strong className="text-slate-800">{ap.total}</strong></span>
                <span>Resolved: <strong className="text-emerald-700">{ap.resolved}</strong></span>
                <span>Open: <strong className="text-amber-700">{ap.pending}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
