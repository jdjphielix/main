import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Target, ClipboardCheck, Building2,
  MessageSquare, Settings, ChevronLeft, Moon, Sun, BarChart3,
  UsersRound, TrendingUp, Ticket, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { hasAccess } from '../../config/permissions';

const ALL_NAV_ITEMS = [
  { path: '/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/leads',            icon: Users,           label: 'Leads' },
  { path: '/prospects',        icon: Target,          label: 'Prospects' },
  { path: '/onboarding',       icon: ClipboardCheck,  label: 'Onboarding' },
  { path: '/clients',          icon: Building2,       label: 'Clients' },
  { path: '/sales-clients',    icon: Building2,       label: 'Sales Clients' },
  { path: '/chat',             icon: MessageSquare,   label: 'Chat' },
  { path: '/tickets',          icon: Ticket,          label: 'Tickets' },
  { path: '/sales-dashboard',  icon: BarChart3,       label: 'Sales Dashboard' },
  { path: '/team-management',  icon: UsersRound,      label: 'Team Management' },
  { path: '/team-onboarding',  icon: ClipboardList,   label: 'Team Onboarding' },
  { path: '/admin',            icon: Settings,        label: 'Admin' },
  { path: '/tekst-instructie', icon: MessageSquare,   label: 'Tekst Instructie' },
  { path: '/limit-orders',     icon: TrendingUp,      label: 'Limit Orders' },
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const visibleItems = ALL_NAV_ITEMS.filter(item => hasAccess(user, item.path));

  return (
    <aside
      className={`${isOpen ? 'w-72' : 'w-20'} bg-navy dark:bg-gray-950 text-white transition-all duration-300 ease-in-out flex flex-col border-r border-blue-light/20`}
    >
      {/* Logo */}
      <div
        className={`flex-shrink-0 flex items-center justify-between dark:bg-gray-800 ${isOpen ? 'h-28 px-5' : 'h-20 px-3'}`}
        style={{ background: '#011745', borderBottom: '1px solid rgba(61,97,164,0.35)', boxShadow: 'inset 0 -2px 0 0 #3d61a4' }}
      >
        {isOpen && (
          <div style={{ padding: '6px 10px', borderRadius: '10px', border: '1.5px solid rgba(61,97,164,0.18)', boxShadow: '0 0 0 3px rgba(61,97,164,0.07), 0 2px 8px rgba(1,23,69,0.08)', background: 'white', display: 'flex', alignItems: 'center' }}>
            <img src="/branding/Logos/Taper - Logo - Horizontaal - V3.png" alt="Taper Logo" className="h-16 w-auto object-contain" />
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg transition-colors ml-auto flex-shrink-0 hover:bg-white/10"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft size={20} className={`transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`} style={{ color: '#a4abbe' }} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto py-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive ? 'bg-taper-blue text-white shadow-card' : 'text-blue-pale hover:bg-navy-mid'
                } ${!isOpen && 'justify-center'}`
              }
            >
              <Icon size={20} className="flex-shrink-0" />
              {isOpen && <span className="font-medium text-sm">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-blue-light/20 p-3 space-y-2">
        <button
          onClick={toggleDarkMode}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-pale hover:bg-navy-mid transition-colors ${!isOpen && 'justify-center'}`}
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? <Sun size={20} className="flex-shrink-0" /> : <Moon size={20} className="flex-shrink-0" />}
          {isOpen && <span className="font-medium text-sm">{isDarkMode ? 'Light' : 'Dark'}</span>}
        </button>

        {user?.email?.includes('.test@') && (
          <button
            onClick={async () => {
              const r = await fetch('/api/v1/auth/dev/login?email=jp@taperpay.com', { method: 'POST' });
              const d = await r.json();
              if (d.access_token) { sessionStorage.setItem('auth_token', d.access_token); window.location.reload(); }
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors mt-2 ${!isOpen && 'justify-center'}`}
          >
            <span className="text-sm font-bold text-white">↵</span>
            {isOpen && <span className="text-sm font-semibold text-white truncate">Terug naar admin</span>}
          </button>
        )}

        {isOpen && user && (
          <div className="bg-navy-mid rounded-xl p-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-taper-blue flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  : user.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.full_name}</p>
                <p className="text-xs text-blue-pale capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
