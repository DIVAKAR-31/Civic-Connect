import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, LogIn, User as UserIcon, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User as UserType } from '../types';
import { apiClient, setSession } from '../services/apiClient';

interface CitizenLoginPageProps {
  onLogin: (user: UserType) => void;
}

const CitizenLoginPage: React.FC<CitizenLoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [district, setDistrict] = useState('Chennai');

  const DEMO_CITIZENS = [
    { name: 'Citizen Demo', email: 'user@civic.gov', pass: 'password', location: 'Chennai' },
    { name: 'Rahul S.', email: 'rahul.citizen@civic.tn', pass: 'Citizen@2026', location: 'Chennai' },
    { name: 'Priya M.', email: 'priya.citizen@civic.tn', pass: 'Citizen@2026', location: 'Madurai' },
    { name: 'Arjun K.', email: 'arjun.citizen@civic.tn', pass: 'Citizen@2026', location: 'Coimbatore' },
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (mode === 'register' && name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await apiClient.register({ name: name.trim(), email: email.trim(), password, district });
        setSession(res.token, res.user);
        onLogin(res.user);
        navigate('/citizen');
      } else {
        const res = await apiClient.login({ email: email.trim(), password, portal: 'citizen' });
        setSession(res.token, res.user);
        onLogin(res.user);
        navigate('/citizen');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50 flex items-center justify-center p-6 py-12 animate-fadeIn">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: Citizen Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold mb-3">
              <UserIcon size={13} /> Citizen Portal
            </span>
            <h1 className="text-3xl font-extrabold text-navy-900">
              {mode === 'login' ? 'Citizen Sign In' : 'Create Citizen Account'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login'
                ? 'Access your dashboard, lodge new civic issues, and track resolutions.'
                : 'Register to submit complaints and receive live status notifications.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" /> {successMsg}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Ananya Sharma"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white outline-none text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">District / City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Chennai"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white outline-none text-sm"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="email"
                  required
                  placeholder="citizen@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white outline-none text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white outline-none text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-navy-900 hover:bg-teal-600 text-white rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
              {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In to Citizen Portal' : 'Register & Enter Portal'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="text-xs font-bold text-teal-700 hover:underline"
            >
              {mode === 'login' ? 'New Citizen? Create an account' : 'Already registered? Sign in instead'}
            </button>
          </div>
        </div>

        {/* Right: Quick Demo Accounts */}
        <div className="lg:col-span-5 bg-navy-900 text-white rounded-3xl p-8 flex flex-col justify-between shadow-xl">
          <div>
            <h2 className="text-lg font-bold mb-1">Demo Citizen Accounts</h2>
            <p className="text-xs text-slate-300 mb-5">
              Click any account below to auto-fill credentials for hackathon demonstration.
            </p>
            <div className="space-y-3">
              {DEMO_CITIZENS.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setEmail(c.email);
                    setPassword(c.pass);
                    setError(null);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-white">{c.name}</p>
                    <p className="text-xs text-slate-300">{c.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-300">
                    <MapPin size={12} /> {c.location}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300">
            <p className="font-bold text-teal-300 mb-1">Password Note</p>
            <p>
              `user@civic.gov` uses password <code className="text-white">password</code>. Other demo citizens use{' '}
              <code className="text-white">Citizen@2026</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenLoginPage;
