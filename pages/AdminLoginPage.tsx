import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Shield, Building2, AlertCircle, KeyRound } from 'lucide-react';
import { User as UserType } from '../types';
import { apiClient, setSession } from '../services/apiClient';

interface AdminLoginPageProps {
  onLogin: (user: UserType) => void;
  defaultPortal?: 'admin' | 'authority';
}

const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLogin, defaultPortal = 'authority' }) => {
  const navigate = useNavigate();
  const [portal, setPortal] = useState<'admin' | 'authority'>(defaultPortal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const DEMO_ACCOUNTS = {
    admin: [
      { label: 'Municipal System Admin', email: 'admin@civic.gov', pass: 'admin123', badge: 'Full System Control' },
    ],
    authority: [
      {
        label: 'Tier 1: Village / City President',
        email: 'president.royapettah@tn.gov',
        pass: 'PresRoy@2026',
        badge: 'Royapettah, Chennai',
      },
      {
        label: 'Tier 1: Village President (Demo)',
        email: 'president@civicconnect.gov.in',
        pass: 'President@123',
        badge: 'Chennai',
      },
      {
        label: 'Tier 2: Taluk Officer',
        email: 'taluk.madurai@tn.gov',
        pass: 'TalukMad@2026',
        badge: 'Madurai East Taluk',
      },
      {
        label: 'Tier 3: District Collector',
        email: 'collector.coimbatore@tn.gov',
        pass: 'Coimb@2026',
        badge: 'Coimbatore District',
      },
    ],
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.login({ email: email.trim(), password, portal });
      setSession(res.token, res.user);
      onLogin(res.user);
      navigate(res.user.role === 'admin' ? '/admin' : '/authority');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-navy-950 text-white flex items-center justify-center p-6 py-12 animate-fadeIn">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Login Card */}
        <div className="lg:col-span-6 bg-navy-900 border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="flex bg-navy-950 p-1 rounded-xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => {
                setPortal('admin');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                portal === 'admin' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield size={15} /> Admin Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setPortal('authority');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                portal === 'authority' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={15} /> Authority Portal
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">
            {portal === 'admin' ? 'System Admin Sign In' : 'Government Authority Sign In'}
          </h1>
          <p className="text-xs text-slate-400 mb-6">
            {portal === 'admin'
              ? 'Manage priorities, assign departments & authorities, and audit all complaints.'
              : 'Hierarchical access for Village/City Presidents, Taluk Officers, and District Collectors.'}
          </p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-400/30 text-red-200 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Email ID</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="email"
                  required
                  placeholder={portal === 'admin' ? 'admin@civic.gov' : 'officer@tn.gov'}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-navy-950 border border-white/15 focus:border-teal-500 outline-none text-sm text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-navy-950 border border-white/15 focus:border-teal-500 outline-none text-sm text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
              {loading ? 'Verifying Credentials...' : `Enter ${portal === 'admin' ? 'Admin' : 'Authority'} Portal`}
            </button>
          </form>
        </div>

        {/* Demo Credentials Panel */}
        <div className="lg:col-span-6 bg-white text-slate-900 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Demo Credentials ({portal === 'admin' ? 'Admin' : 'Hierarchical Authorities'})
            </span>
            <h2 className="text-xl font-extrabold text-navy-900 mt-1 mb-2">Quick-Fill Evaluator Access</h2>
            <p className="text-xs text-slate-500 mb-5">
              Click any official profile below to fill the login form immediately.
            </p>

            <div className="space-y-3">
              {DEMO_ACCOUNTS[portal].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.pass);
                    setError(null);
                  }}
                  className="w-full text-left p-4 rounded-2xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-400 transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-navy-900">{acc.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{acc.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-full bg-navy-900 text-teal-300 text-[10px] font-bold">
                      {acc.badge}
                    </span>
                    <p className="text-[11px] font-mono text-slate-600 mt-1">{acc.pass}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
            <strong className="text-navy-900">Role Separation:</strong> System Admins manage priority, routing, and
            global oversight, while Government Authorities execute field progress, remarks, resolution, and SLA
            escalation.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
