import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Building2, ChevronRight, ShieldCheck } from 'lucide-react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const portals = [
    {
      title: 'Citizen Portal',
      desc: 'Report civic issues with photos & location, track complaint timelines, receive updates, and rate resolutions.',
      path: '/login/citizen',
      icon: <User size={28} />,
      badge: 'Public Access',
      cardClass: 'bg-white border-slate-200 hover:border-teal-500 text-navy-900',
      iconClass: 'bg-teal-600 text-white',
      ctaClass: 'text-teal-700',
      cta: 'Citizen Sign In / Register',
    },
    {
      title: 'Admin Portal',
      desc: 'Monitor all grievances, view analytics, adjust priority levels, assign departments & authorities, and inspect audit logs.',
      path: '/login/admin',
      icon: <Shield size={28} />,
      badge: 'System Oversight',
      cardClass: 'bg-navy-900 border-navy-800 hover:border-teal-400 text-white',
      iconClass: 'bg-teal-500 text-white',
      ctaClass: 'text-teal-300',
      cta: 'Admin Login',
    },
    {
      title: 'Government Authority Portal',
      desc: 'Hierarchical workflow for Village/City Presidents, Taluk Officers, and District Collectors with SLA escalation.',
      path: '/login/authority',
      icon: <Building2 size={28} />,
      badge: '3-Tier Officials',
      cardClass: 'bg-white border-slate-200 hover:border-navy-700 text-navy-900',
      iconClass: 'bg-navy-900 text-teal-400',
      ctaClass: 'text-navy-900',
      cta: 'Authority Login',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50 flex items-center justify-center p-6 py-16 animate-fadeIn">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-navy-900 text-teal-300 rounded-full text-xs font-semibold mb-4">
            <ShieldCheck size={14} /> Role-Based Secure Access
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-navy-900 tracking-tight">
            Select Your CivicConnect Portal
          </h1>
          <p className="text-slate-600 mt-3 text-base max-w-2xl mx-auto">
            Choose the Citizen, Municipal Admin, or Hierarchical Government Authority portal to continue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => navigate(p.path)}
              className={`group rounded-3xl p-8 text-left border-2 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between ${p.cardClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${p.iconClass}`}>
                    {p.icon}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">{p.badge}</span>
                </div>
                <h2 className="text-2xl font-bold mb-3">{p.title}</h2>
                <p className="text-sm opacity-80 leading-relaxed mb-8">{p.desc}</p>
              </div>
              <div className={`flex items-center gap-2 text-sm font-bold ${p.ctaClass}`}>
                {p.cta} <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
