import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Target,
  ClipboardCheck,
  Building2,
  MessageSquare,
  Settings,
  ChevronLeft,
  Moon,
  Sun,
  Globe,
  BarChart3,
  UsersRound,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const Sidebar = ({ isOpen, setIsOpen, mobileOpen = false, setMobileOpen = () => {} }) => {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'nl' ? 'en' : 'nl');
  };

  const navItems = [
    {
      path: '/dashboard',
      icon: LayoutDashboard,
      label: t('nav.dashboard', 'Dashboard'),
      disabled: false,
    },
    {
      path: '/leads',
      icon: Users,
      label: t('nav.leads', 'Leads'),
      disabled: false,
    },
    {
      path: '/prospects',
      icon: Target,
      label: t('nav.prospects', 'Prospects'),
      disabled: false,
    },
    {
      path: '/onboarding',
      icon: ClipboardCheck,
      label: t('nav.onboarding', 'Onboarding'),
      disabled: false,
    },
    {
      path: '/clients',
      icon: Building2,
      label: t('nav.clients', 'Clients'),
      disabled: false,
    },
    {
      path: '/chat',
      icon: MessageSquare,
      label: t('nav.chat', 'Chat'),
      disabled: false,
    },
  ];

  const isAdmin = ['admin_pay', 'admin_trade'].includes(user?.role);
  const isTeamleader = user?.is_teamleader || isAdmin;
  const isExtern = user?.role === 'extern';

  const salesItems = [
    {
      path: '/sales-clients',
      icon: Building2,
      label: 'Sales Clients',
      disabled: false,
      show: ['sales', 'extern', 'teamleader', 'admin_pay', 'admin_trade'].includes(user?.role),
    },
  ];

  const adminItems = [
    {
      path: '/sales-dashboard',
      icon: BarChart3,
      label: 'Sales Dashboard',
      disabled: false,
      show: true,  // visible to all users
    },
    {
      path: '/team-management',
      icon: UsersRound,
      label: 'Team Management',
      disabled: false,
      show: isTeamleader,
    },
    {
      path: '/admin',
      icon: Settings,
      label: t('nav.admin', 'Admin'),
      disabled: false,
      show: isAdmin || user?.is_teamleader,
    },
    {
      path: '/tekst-instructie',
      icon: MessageSquare,
      label: 'Tekst Instructie',
      disabled: false,
      show: isAdmin || user?.is_teamleader,
    },
    {
      path: '/limit-orders',
      icon: TrendingUp,
      label: 'Limit Orders',
      disabled: false,
      show: isAdmin || user?.is_teamleader,
    },
  ];

  // On mobile the sidebar is an off-canvas drawer at full width, so the
  // collapsed icon-only state (isOpen=false) should not hide labels there.
  // showExpanded reflects "show full content": desktop-expanded OR mobile-open.
  const showExpanded = isOpen || mobileOpen;

  // Filter navItems voor extern
  const filteredNavItems = isExtern
    ? navItems.filter(i => ['/leads', '/dashboard'].includes(i.path))
    : navItems;

  const allNavItems = isExtern
    ? [...filteredNavItems, ...salesItems.filter(item => item.show)]
    : [...navItems, ...salesItems.filter(item => item.show), ...adminItems.filter(item => item.show)];

  return (
    <aside
      className={`${
        isOpen ? 'w-72' : 'w-20'
      } bg-navy dark:bg-gray-950 text-white transition-all duration-300 ease-in-out flex flex-col border-r border-blue-light/20
      fixed inset-y-0 left-0 z-40 max-md:w-72 ${mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}
      md:static md:translate-x-0 md:z-auto`}
    >
      {/* Logo Section — luxe blauwe rand */}
      <div className={`flex-shrink-0 flex items-center justify-between dark:bg-gray-800 ${showExpanded ? 'h-28 px-5' : 'h-20 px-3'}`}
        style={{
          background: '#011745',
          borderBottom: '1px solid rgba(61,97,164,0.35)',
          boxShadow: 'inset 0 -2px 0 0 #3d61a4',
        }}>
        {showExpanded && (
          <div style={{
            padding: '6px 10px',
            borderRadius: '10px',
            border: '1.5px solid rgba(61,97,164,0.18)',
            boxShadow: '0 0 0 3px rgba(61,97,164,0.07), 0 2px 8px rgba(1,23,69,0.08)',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
          }}>
            <img
              src="/branding/Logos/Taper - Logo - Horizontaal - V3.png"
              alt="Taper Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
        )}
        {/* Desktop: collapse/expand. Mobile: close the off-canvas drawer. */}
        <button
          onClick={() => {
            if (mobileOpen) {
              setMobileOpen(false);
            } else {
              setIsOpen(!isOpen);
            }
          }}
          className="p-2 rounded-lg transition-colors ml-auto flex-shrink-0 hover:bg-white/10"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft
            size={20}
            className={`transition-transform duration-300 ${showExpanded ? '' : 'rotate-180'}`}
            style={{ color: '#a4abbe' }}
          />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isActive
                    ? 'bg-taper-blue text-white shadow-card'
                    : 'text-blue-pale hover:bg-navy-mid'
                } ${!showExpanded && 'justify-center'}`
              }
              onClick={(e) => {
                if (item.disabled) { e.preventDefault(); return; }
                setMobileOpen(false);
              }}
            >
              <Icon size={20} className="flex-shrink-0" />
              {showExpanded && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div className={`border-t border-blue-light/20 p-3 space-y-2`}>
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-pale hover:bg-navy-mid transition-colors ${
            !showExpanded && 'justify-center'
          }`}
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? (
            <Sun size={20} className="flex-shrink-0" />
          ) : (
            <Moon size={20} className="flex-shrink-0" />
          )}
          {showExpanded && (
            <span className="font-medium text-sm">
              {isDarkMode ? t('common.light', 'Light') : t('common.dark', 'Dark')}
            </span>
          )}
        </button>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-pale hover:bg-navy-mid transition-colors ${
            !showExpanded && 'justify-center'
          }`}
          aria-label="Toggle language"
        >
          <Globe size={20} className="flex-shrink-0" />
          {showExpanded && (
            <span className="font-medium text-sm">
              {i18n.language?.toUpperCase() || 'NL'}
            </span>
          )}
        </button>

        {/* User Profile Section */}
        {showExpanded && user && (
          <div className="bg-navy-mid rounded-xl p-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-taper-blue flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.full_name?.charAt(0).toUpperCase()
                )}
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
