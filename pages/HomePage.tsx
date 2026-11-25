import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  Construction,
  Trash2,
  Lightbulb,
  Droplets,
  Waves,
  ShieldCheck,
  BrainCircuit,
  Clock,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Layers,
  BellRing,
  Building2,
  Phone,
  Mail,
  BarChart3,
  Gavel,
} from 'lucide-react';
import { AnalyticsData, Grievance, User } from '../types';

interface HomePageProps {
  grievances?: Grievance[];
  user?: User | null;
  analytics?: AnalyticsData | null;
}

const HomePage: React.FC<HomePageProps> = ({ user, analytics }) => {
  const categories = [
    {
      name: 'Potholes & Damaged Roads',
      icon: <Construction size={24} />,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      desc: 'Report dangerous craters, broken asphalt, and damaged footpaths.',
    },
    {
      name: 'Garbage Accumulation',
      icon: <Trash2 size={24} />,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      desc: 'Flag uncollected waste, overflowing bins, and illegal dumping.',
    },
    {
      name: 'Broken Streetlights',
      icon: <Lightbulb size={24} />,
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      desc: 'Illuminate dark corridors, flickering lamps, and exposed wiring.',
    },
    {
      name: 'Water Leakage',
      icon: <Droplets size={24} />,
      color: 'bg-sky-50 text-sky-700 border-sky-200',
      desc: 'Stop clean water wastage from burst pipes and supply contamination.',
    },
    {
      name: 'Drainage Problems',
      icon: <Waves size={24} />,
      color: 'bg-teal-50 text-teal-700 border-teal-200',
      desc: 'Clear clogged stormwater drains, water logging, and open manholes.',
    },
    {
      name: 'Sanitation Issues',
      icon: <ShieldCheck size={24} />,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      desc: 'Escalate sewage overflows, public toilet upkeep, and vector hazards.',
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Citizen Reports Issue',
      desc: 'Upload site photos, describe the problem, and capture GPS or enter your address manually.',
    },
    {
      num: '02',
      title: 'AI Triage & Priority',
      desc: 'Our AI engine classifies the issue, detects duplicates, assigns Low–Critical priority, and suggests the right department.',
    },
    {
      num: '03',
      title: 'Tiered SLA Escalation',
      desc: 'Routed to Village/City President first. Unresolved SLA breaches escalate to Taluk Officer and District Collector.',
    },
    {
      num: '04',
      title: 'Resolution & Feedback',
      desc: 'Track every audit milestone visually, receive instant notifications, and rate the resolution quality.',
    },
  ];

  const features = [
    {
      icon: <BrainCircuit size={22} className="text-teal-600" />,
      title: 'AI Complaint Intelligence',
      desc: 'Automated categorization, severity scoring, duplicate detection, and department routing with explicit live/demo transparency.',
    },
    {
      icon: <Layers size={22} className="text-teal-600" />,
      title: '3-Tier Authority Governance',
      desc: 'Structured accountability chain across Village/City President, Taluk Officer, and District Collector.',
    },
    {
      icon: <Clock size={22} className="text-teal-600" />,
      title: 'SLA Deadlines & Auto-Escalation',
      desc: 'Every complaint carries a priority-based SLA timer so urgent civic hazards never stall in silence.',
    },
    {
      icon: <MapPin size={22} className="text-teal-600" />,
      title: 'Live Geospatial Oversight',
      desc: 'Interactive Leaflet map pinpointing active, escalated, and resolved civic complaints across districts.',
    },
    {
      icon: <BellRing size={22} className="text-teal-600" />,
      title: 'Real-Time Notifications',
      desc: 'Citizens receive automatic status updates whenever priority, assignment, or resolution remarks change.',
    },
    {
      icon: <BarChart3 size={22} className="text-teal-600" />,
      title: 'Audit Logs & Analytics',
      desc: 'Full chronological history, PDF/Excel audit exports, and live vs. sample analytics charts.',
    },
  ];

  const summary = analytics?.summary || { total: 0, pending: 0, resolved: 0, highPriority: 0 };
  const liveCount = analytics?.counts.live ?? 0;
  const sampleCount = analytics?.counts.sample ?? 0;

  return (
    <div className="bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-teal-300 text-xs font-semibold">
                <ShieldCheck size={14} /> AI-Driven Public Grievance & Municipal Oversight
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08]">
                Your City. Your Voice.{' '}
                <span className="text-teal-400 block sm:inline">Your Responsibility.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                CivicConnect bridges citizens and government authorities with AI-assisted complaint triage,
                transparent SLA timelines, and accountable escalation from local wards up to the District Collector.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  to={user?.role === 'citizen' ? '/report' : user ? (user.role === 'admin' ? '/admin' : '/authority') : '/login/citizen'}
                  className="inline-flex items-center gap-2.5 bg-teal-600 hover:bg-teal-500 text-white px-7 py-4 rounded-xl font-bold text-sm shadow-lg shadow-teal-900/40 transition-all"
                >
                  <FileText size={18} />
                  {user?.role === 'admin'
                    ? 'Open Admin Portal'
                    : user?.role === 'authority'
                    ? 'Open Authority Portal'
                    : 'Report an Issue'}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/track"
                  className="inline-flex items-center gap-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white px-7 py-4 rounded-xl font-bold text-sm transition-all"
                >
                  <Search size={18} /> Track Complaint Status
                </Link>
              </div>
            </div>

            {/* Hero Overview Card */}
            <div className="lg:col-span-5">
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-300">
                      Platform Oversight Snapshot
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {liveCount} Live DB + {sampleCount} Sample Records
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-bold">
                    SLA Monitored
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-400">Total Complaints</p>
                    <p className="text-3xl font-extrabold text-white mt-1">{summary.total}</p>
                  </div>
                  <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-400">Resolved</p>
                    <p className="text-3xl font-extrabold text-teal-400 mt-1">{summary.resolved}</p>
                  </div>
                  <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-400">Pending / Active</p>
                    <p className="text-3xl font-extrabold text-amber-300 mt-1">{summary.pending}</p>
                  </div>
                  <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-400">High & Critical</p>
                    <p className="text-3xl font-extrabold text-rose-400 mt-1">{summary.highPriority}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                  <Link
                    to="/login/citizen"
                    className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-semibold transition-colors"
                  >
                    Citizen Portal
                  </Link>
                  <Link
                    to="/login/admin"
                    className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-semibold transition-colors"
                  >
                    Admin Portal
                  </Link>
                  <Link
                    to="/login/authority"
                    className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-semibold transition-colors"
                  >
                    Authority Portal
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">End-to-End Workflow</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-2">How CivicConnect Works</h2>
          <p className="text-slate-600 mt-3 text-sm sm:text-base">
            From citizen reporting to multi-tier government resolution, every step is timestamped and auditable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div
              key={s.num}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-teal-300 transition-all"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-navy-900 text-teal-400 font-extrabold text-sm mb-4">
                {s.num}
              </span>
              <h3 className="text-lg font-bold text-navy-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Civic Issue Categories */}
      <section className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Public Issue Categories</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-2">
                Report Issues That Matter
              </h2>
            </div>
            <Link
              to={user?.role === 'citizen' ? '/report' : '/login/citizen'}
              className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-teal-800"
            >
              Submit a Grievance <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={user?.role === 'citizen' ? '/report' : '/login/citizen'}
                className="group bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-teal-400 p-6 transition-all hover:shadow-lg"
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${cat.color}`}>
                  {cat.icon}
                </div>
                <h3 className="text-lg font-bold text-navy-900 group-hover:text-teal-700 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{cat.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Platform Capabilities</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-2">
            Built for Modern Municipal Governance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="text-base font-bold text-navy-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Transparency & Accountability Section */}
      <section className="bg-navy-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-5">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
                Transparency & Accountability
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">
                Zero Lost Complaints. Clear SLA Escalation Chain.
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Every complaint is assigned a unique Tracking ID and cryptographic-style DNA reference, tracked across
                three government tiers with timestamped remarks and public audit feeds.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  'Tier 1: Village / City President handles initial field verification and action.',
                  'Tier 2: Taluk Officer intervenes automatically or manually when SLA deadlines breach.',
                  'Tier 3: District Collector provides executive oversight for critical unresolved hazards.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-200">
                    <CheckCircle2 size={18} className="text-teal-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  tier: 'Tier 1',
                  role: 'Village / City President',
                  sla: '24h – 72h',
                  icon: <Building2 size={22} className="text-teal-400" />,
                },
                {
                  tier: 'Tier 2',
                  role: 'Taluk Officer',
                  sla: 'Escalation Desk',
                  icon: <Layers size={22} className="text-teal-400" />,
                },
                {
                  tier: 'Tier 3',
                  role: 'District Collector',
                  sla: 'Final Oversight',
                  icon: <Gavel size={22} className="text-teal-400" />,
                },
              ].map((t) => (
                <div key={t.tier} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                    {t.icon}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">{t.tier}</span>
                    <h3 className="text-base font-bold text-white mt-1">{t.role}</h3>
                    <p className="text-xs text-slate-400 mt-1">{t.sla}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 text-slate-300 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5 text-white">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <span className="font-bold text-lg">
                  Civic<span className="text-teal-400">Connect</span>
                </span>
              </div>
              <p className="text-sm text-slate-400 max-w-md">
                AI-Driven Public Grievance & Municipal Oversight Platform. Empowering citizens and government authorities
                to resolve civic issues faster and transparently.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Portals & Links</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/login/citizen" className="hover:text-teal-400 transition-colors">Citizen Portal</Link></li>
                <li><Link to="/login/admin" className="hover:text-teal-400 transition-colors">Admin Portal</Link></li>
                <li><Link to="/login/authority" className="hover:text-teal-400 transition-colors">Government Authority Portal</Link></li>
                <li><Link to="/track" className="hover:text-teal-400 transition-colors">Track Complaints</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Contact Information</h4>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Mail size={15} className="text-teal-400" /> support@civicconnect.gov.in
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={15} className="text-teal-400" /> Toll-Free Helpline: 1912 / 1800-425-0191
                </li>
                <li className="flex items-center gap-2">
                  <MapPin size={15} className="text-teal-400" /> Municipal Oversight HQ, Chennai & Madurai
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} CivicConnect Public Grievance Platform.</p>
            <Link to="/contact" className="text-teal-400 hover:underline">
              Contact Municipal Support Desk
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
