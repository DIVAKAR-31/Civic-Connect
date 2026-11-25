import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ShieldCheck, LogOut, Home } from 'lucide-react';
import { User } from '../types';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface PortalLayoutProps {
  portalTitle: string;
  portalSubtitle: string;
  user: User;
  navItems: SidebarNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  portalTitle,
  portalSubtitle,
  user,
  navItems,
  activeTab,
  onTabChange,
  onLogout,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarBody = () => (
    <div className="flex flex-col h-full bg-navy-900 text-white">
      <div className="p-6 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block leading-none">
              Civic<span className="text-teal-400">Connect</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">GovTech OS</span>
          </div>
        </Link>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400">{portalTitle}</p>
          <p className="text-xs font-semibold text-white truncate mt-0.5">{user.name || user.email}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {user.authorityTier || user.adminLevel || (user.role === 'citizen' ? 'Verified Citizen' : 'System Admin')}
            {user.district ? ` • ${user.district}` : ''}
          </p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onTabChange(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </span>
              {item.badge !== undefined && Number(item.badge) > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Link
          to="/"
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all"
        >
          <Home size={17} /> Public Landing Page
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all"
        >
          <LogOut size={17} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 sticky top-0 h-screen">
        <SidebarBody />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-300 hover:text-white p-1"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <SidebarBody />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-navy-900 hover:bg-slate-50"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-navy-900 leading-tight">{portalTitle}</h1>
              <p className="text-xs text-slate-500">{portalSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              {user.authorityTier || user.adminLevel || 'Citizen Session'}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PortalLayout;
