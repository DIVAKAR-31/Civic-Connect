import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  Home,
  FileText,
  Search,
  LayoutDashboard,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  PhoneCall,
  Building2,
  Info,
} from 'lucide-react';

import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ReportPage from './pages/ReportPage';
import TrackPage from './pages/TrackPage';
import AdminPage from './pages/AdminPage';
import AuthorityPortalPage from './pages/AuthorityPortalPage';
import CitizenDashboardPage from './pages/CitizenDashboardPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import CitizenLoginPage from './pages/CitizenLoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import GlobalAIChatbot from './components/GlobalAIChatbot';
import { AnalyticsData, Grievance, User } from './types';
import { apiClient, clearSession, getAuthToken, getSavedUser } from './services/apiClient';

const PublicNavbar: React.FC<{ user: User | null; onLogout: () => void }> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const portalPath =
    user?.role === 'admin' ? '/admin' : user?.role === 'authority' ? '/authority' : '/citizen';

  const navLinks = [
    { name: 'Home', path: '/', icon: <Home size={16} /> },
    { name: 'Track', path: '/track', icon: <Search size={16} /> },
    { name: 'About', path: '/about', icon: <Info size={16} /> },
    { name: 'Contact', path: '/contact', icon: <PhoneCall size={16} /> },
    ...(user?.role === 'citizen' ? [{ name: 'Report Issue', path: '/report', icon: <FileText size={16} /> }] : []),
    ...(user ? [{ name: 'My Portal', path: portalPath, icon: <LayoutDashboard size={16} /> }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" onClick={() => setIsOpen(false)} className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-navy-900 rounded-xl flex items-center justify-center text-teal-400 shadow-sm">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="font-extrabold text-lg text-navy-900 tracking-tight leading-none block">
              Civic<span className="text-teal-600">Connect</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Public Oversight
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname === link.path
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
              }`}
            >
              {link.icon}
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                to={portalPath}
                className="px-3.5 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-teal-600 transition-colors"
              >
                <Building2 size={14} /> {user.name || user.email}
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors"
                title="Sign Out"
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-teal-600 text-white text-xs font-bold transition-colors shadow-sm"
            >
              Portal Sign In
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 rounded-xl border border-slate-200 text-navy-900"
          aria-label="Toggle Menu"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold ${
                location.pathname === link.path ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
              }`}
            >
              {link.icon}
              {link.name}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-100">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="w-full py-3 rounded-xl bg-red-50 text-red-700 font-bold text-sm"
              >
                Sign Out ({user.email})
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center py-3 rounded-xl bg-navy-900 text-white font-bold text-sm"
              >
                Portal Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

const AppShell: React.FC = () => {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(() => getSavedUser());
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsScope, setAnalyticsScope] = useState<'all' | 'live' | 'sample'>('all');

  const loadData = useCallback(async (scope: 'all' | 'live' | 'sample' = analyticsScope) => {
    try {
      const [cRes, aRes] = await Promise.all([
        apiClient.getComplaints(),
        apiClient.getAnalytics(scope),
      ]);
      setGrievances(cRes.complaints);
      setAnalytics(aRes);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  }, [analyticsScope]);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      apiClient
        .me()
        .then((res) => setCurrentUser(res.user))
        .catch(() => {
          clearSession();
          setCurrentUser(null);
        });
    }
  }, []);

  useEffect(() => {
    loadData(analyticsScope);
  }, [analyticsScope, loadData]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    loadData(analyticsScope);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  const handleUpvote = async (id: string) => {
    try {
      await apiClient.upvoteComplaint(id);
      await loadData(analyticsScope);
    } catch (err) {
      console.error('Upvote error', err);
    }
  };

  const isPortalRoute =
    (location.pathname.startsWith('/citizen') && currentUser?.role === 'citizen') ||
    (location.pathname.startsWith('/admin') && currentUser?.role === 'admin') ||
    (location.pathname.startsWith('/authority') &&
      (currentUser?.role === 'authority' || currentUser?.role === 'admin'));

  return (
    <div className="flex flex-col min-h-screen">
      {!isPortalRoute && <PublicNavbar user={currentUser} onLogout={handleLogout} />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage grievances={grievances} user={currentUser} analytics={analytics} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/track" element={<TrackPage grievances={grievances} onUpvote={handleUpvote} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/citizen" element={<CitizenLoginPage onLogin={handleLogin} />} />
          <Route path="/login/admin" element={<AdminLoginPage onLogin={handleLogin} defaultPortal="admin" />} />
          <Route path="/login/authority" element={<AdminLoginPage onLogin={handleLogin} defaultPortal="authority" />} />

          <Route
            path="/report"
            element={
              currentUser?.role === 'citizen' ? (
                <ReportPage onAdded={() => loadData(analyticsScope)} />
              ) : (
                <Navigate to="/login/citizen" replace />
              )
            }
          />
          <Route
            path="/citizen"
            element={
              currentUser?.role === 'citizen' ? (
                <CitizenDashboardPage
                  user={currentUser}
                  grievances={grievances}
                  onRefresh={() => loadData(analyticsScope)}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/login/citizen" replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              currentUser?.role === 'admin' ? (
                <AdminPage
                  user={currentUser}
                  grievances={grievances}
                  analytics={analytics}
                  analyticsScope={analyticsScope}
                  onScopeChange={setAnalyticsScope}
                  onRefresh={() => loadData(analyticsScope)}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/login/admin" replace />
              )
            }
          />
          <Route
            path="/authority"
            element={
              currentUser?.role === 'authority' || currentUser?.role === 'admin' ? (
                <AuthorityPortalPage
                  user={currentUser}
                  grievances={grievances}
                  analytics={analytics}
                  analyticsScope={analyticsScope}
                  onScopeChange={setAnalyticsScope}
                  onRefresh={() => loadData(analyticsScope)}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/login/authority" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <GlobalAIChatbot />
    </div>
  );
};

const App: React.FC = () => (
  <Router>
    <AppShell />
  </Router>
);

export default App;
