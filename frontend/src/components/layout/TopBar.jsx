import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Search,
  Phone,
  Calendar,
  Bell,
  LogOut,
  User,
  ChevronDown,
  Check,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import NewLeadModal from '../leads/NewLeadModal';
import CallbacksPopup from '../callbacks/CallbacksPopup';
import CallbackAgendaPopup from '../callbacks/CallbackAgendaPopup';
import BellijstPopup from '../leads/BellijstPopup';

const TopBar = ({ sidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // State management
  const [notificationCount, setNotificationCount] = useState(3);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searched yet
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchContainerRef = useRef(null);
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [callbacksOpen, setCallbacksOpen] = useState(false);
  const [callbackAgendaOpen, setCallbackAgendaOpen] = useState(false);
  const [bellijstOpen, setBellijstOpen] = useState(false);
  const [birthdays, setBirthdays] = useState([]);
  const [birthdayPopupOpen, setBirthdayPopupOpen] = useState(false);

  // Refs for closing dropdowns on outside click
  const profileMenuRef = useRef(null);
  const notificationMenuRef = useRef(null);

  // Notifications from backend
  const [notifications, setNotifications] = useState([]);

  // Fetch real notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        if (!token) return;
        const res = await fetch('/api/v1/notifications/?page=1&page_size=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const notifs = (data.notifications || []).map(n => ({
            id: n.id,
            message: n.title || n.message,
            timestamp: n.created_at ? new Date(n.created_at).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '',
            read: n.is_read,
          }));
          setNotifications(notifs);
          setNotificationCount(notifs.filter(n => !n.read).length);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
    fetchNotifications();
  }, []);

  // Fetch today's birthdays on mount
  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        const tok = sessionStorage.getItem('auth_token');
        if (!tok) return;
        const res = await fetch('/api/v1/leads/birthdays/today', {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBirthdays(data.birthdays || []);
        }
      } catch (err) {
        console.error('Failed to fetch birthdays:', err);
      }
    };
    fetchBirthdays();
  }, []);

  // Live duplicate search
  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/leads/?search=${encodeURIComponent(q)}&page_size=8&all_stages=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.leads || data.items || []);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearch(q), 350);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    clearTimeout(searchDebounceRef.current);
  };

  const STAGE_LABELS = {
    lead: 'Lead',
    prospect: 'Prospect',
    onboarding_sales: 'Onboarding',
    onboarding_backoffice: 'Onboarding',
    client: 'Client',
  };
  const STAGE_COLORS = {
    lead: '#3d61a4',
    prospect: '#92400e',
    onboarding_sales: '#166534',
    onboarding_backoffice: '#166534',
    client: '#011745',
  };

  const quickActions = [
    {
      icon: Plus,
      label: 'Nieuwe Lead',
      action: 'new-lead',
      color: 'taper-blue',
    },
    {
      icon: Search,
      label: 'Zoeken',
      action: 'search',
      color: 'blue-light',
    },
    {
      icon: Phone,
      label: 'Mijn Bellijst',
      action: 'call-list',
      color: 'blue-light',
    },
    {
      icon: Calendar,
      label: 'Callbacks Vandaag',
      action: 'callbacks',
      color: 'blue-light',
    },
    {
      icon: Calendar,
      label: 'Callback Agenda',
      action: 'callback-agenda',
      color: 'blue-light',
    },
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickAction = (action) => {
    switch (action) {
      case 'new-lead':
        setNewLeadModalOpen(true);
        break;
      case 'search':
        // Toggle search input
        setSearchOpen(!searchOpen);
        setSearchQuery('');
        break;
      case 'call-list':
        setBellijstOpen(true);
        break;
      case 'callbacks':
        setCallbacksOpen(true);
        break;
      case 'callback-agenda':
        setCallbackAgendaOpen(true);
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = sessionStorage.getItem('auth_token');
      await fetch('/api/v1/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
    setNotifications(
      notifications.map((notif) => ({ ...notif, read: true }))
    );
    setNotificationCount(0);
  };

  const handleProfileNavigate = () => {
    navigate('/profile');
    setProfileMenuOpen(false);
  };

  return (
    <>
    <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 h-20 flex items-center px-8 justify-between shadow-sm">
      {/* Left Section: Quick Actions & Search */}
      <div className="flex items-center gap-3 flex-1">
        {!searchOpen ? (
          quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.action}
                onClick={() => handleQuickAction(action.action)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                  action.color === 'taper-blue'
                    ? 'bg-blue text-white hover:shadow-md'
                    : 'bg-blue-pale text-navy hover:bg-blue-light hover:text-white'
                }`}
                style={
                  action.color === 'taper-blue'
                    ? { backgroundColor: '#3d61a4' }
                    : {}
                }
              >
                <Icon size={18} />
                <span>{action.label}</span>
              </button>
            );
          })
        ) : (
          <div className="relative flex items-start gap-2 flex-1 max-w-xl" ref={searchContainerRef}>
            <div className="flex-1">
              {/* Search input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Zoek op bedrijfsnaam of KVK..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    autoFocus
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200"
                    style={{ '--tw-ring-color': '#3d61a4', borderColor: searchResults !== null ? (searchResults.length > 0 ? '#f59e0b' : '#16a34a') : '#e5e7eb' }}
                  />
                  {searchLoading && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                </div>
                <button
                  onClick={closeSearch}
                  className="px-3 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors text-sm"
                >
                  <X size={16}/>
                </button>
              </div>

              {/* Results dropdown */}
              {searchQuery.trim().length >= 2 && !searchLoading && searchResults !== null && (
                <div className="absolute top-full left-0 right-10 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  {searchResults.length > 0 ? (
                    <>
                      {/* Duplicate warning */}
                      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-amber-700">
                          ⚠ Potential duplicate — {searchResults.length} bestaand{searchResults.length !== 1 ? 'e' : ''} match{searchResults.length !== 1 ? 'es' : ''}
                        </p>
                      </div>
                      {searchResults.slice(0, 5).map(lead => {
                        const stageColor = STAGE_COLORS[lead.pipeline_stage] || '#566079';
                        return (
                          <div key={lead.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[#011745] truncate">{lead.company_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: stageColor + '18', color: stageColor }}>
                                    {STAGE_LABELS[lead.pipeline_stage] || lead.pipeline_stage}
                                  </span>
                                  {lead.assigned_user?.full_name && (
                                    <span className="text-xs text-gray-400">
                                      👤 {lead.assigned_user.full_name}
                                    </span>
                                  )}
                                  {lead.kvk_number && (
                                    <span className="text-xs text-gray-400">KVK: {lead.kvk_number}</span>
                                  )}
                                </div>
                              </div>
                              {lead.assigned_user?.email && (
                                <a
                                  href={`mailto:${lead.assigned_user.email}?subject=Lead: ${encodeURIComponent(lead.company_name)}`}
                                  onClick={closeSearch}
                                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                                  style={{ backgroundColor: '#3d61a4' }}
                                >
                                  Contact sales user <ArrowRight size={12}/>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {searchResults.length > 5 && (
                        <div className="px-4 py-2 text-xs text-gray-400 text-center bg-gray-50">
                          + {searchResults.length - 5} meer resultaten
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Good to go */}
                      <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                        <p className="text-sm font-semibold text-green-700">✓ Good to go — geen bestaande match gevonden</p>
                      </div>
                      <div className="px-4 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#011745]">"{searchQuery}"</p>
                          <p className="text-xs text-gray-400 mt-0.5">Niet gevonden in leads, prospects, onboarding of clients</p>
                        </div>
                        <button
                          onClick={() => {
                            closeSearch();
                            setNewLeadModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          <Plus size={15}/> Lead toevoegen
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Section: Notifications & Profile */}
      <div className="flex items-center gap-4">
        {/* Birthday badge */}
        {birthdays.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setBirthdayPopupOpen(v => !v)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-[#f7f8fc] text-sm font-medium"
              style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}>
              🎂 {birthdays.length} verjaardag{birthdays.length > 1 ? 'en' : ''}
            </button>
            {birthdayPopupOpen && (
              <div className="absolute top-12 right-0 z-50 bg-white border border-[#e8eaf2] rounded-2xl shadow-xl p-4 min-w-[280px]">
                <p className="text-xs font-bold text-[#011745] mb-3 uppercase tracking-wider">🎂 Verjaardagen vandaag</p>
                {birthdays.map((b, i) => (
                  <div key={i} className="py-2 border-b border-[#f7f8fc] last:border-0">
                    <p className="text-sm font-medium text-[#011745]">{b.name} {b.relation ? `(${b.relation})` : ''}</p>
                    {b.contact_name && <p className="text-xs text-[#566079]">Contact van {b.contact_name}</p>}
                    {b.lead_name && <p className="text-xs text-[#a4abbe]">{b.lead_name}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notification Bell */}
        <div className="relative" ref={notificationMenuRef}>
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {notificationCount > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
              {/* Header */}
              <div
                className="px-4 py-3 border-b border-gray-100 dark:border-gray-700"
                style={{ backgroundColor: '#f7f8fc' }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {'Meldingen'}
                  </h3>
                  {notificationCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-medium text-blue hover:text-navy transition-colors"
                      style={{ color: '#3d61a4' }}
                    >
                      {'Alles als gelezen'}
                    </button>
                  )}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                        !notification.read
                          ? 'bg-blue-pale dark:bg-gray-700/30'
                          : ''
                      }`}
                      style={
                        !notification.read
                          ? { backgroundColor: '#eef2fa' }
                          : {}
                      }
                    >
                      <div className="flex items-start gap-3">
                        {!notification.read && (
                          <div
                            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                            style={{ backgroundColor: '#3d61a4' }}
                          />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {notification.timestamp}
                          </p>
                        </div>
                        {notification.read && (
                          <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {'Geen meldingen'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 text-center">
                  <button
                    onClick={() => { navigate('/notifications'); setNotificationOpen(false); }}
                    className="text-xs font-medium text-blue hover:text-navy transition-colors"
                    style={{ color: '#3d61a4' }}
                  >
                    {'Alles weergeven'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: '#3d61a4' }}
            >
              {user?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {user?.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role}
              </p>
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${
                profileMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50">
              <button
                onClick={handleProfileNavigate}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200 transition-colors"
              >
                <User size={18} />
                <span className="text-sm font-medium">
                  {'Mijn Profiel'}
                </span>
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-2" />
              <button
                onClick={() => {
                  logout();
                  setProfileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-600 dark:text-red-400 transition-colors"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">
                  {'Uitloggen'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Callbacks Popup */}
    <CallbacksPopup
      isOpen={callbacksOpen}
      onClose={() => setCallbacksOpen(false)}
      onOpenAgenda={() => setCallbackAgendaOpen(true)}
    />

    {/* Callback Agenda Popup */}
    <CallbackAgendaPopup
      isOpen={callbackAgendaOpen}
      onClose={() => setCallbackAgendaOpen(false)}
      onOpenLead={(leadId) => {
        setCallbackAgendaOpen(false);
        navigate(`/leads?open=${leadId}`);
      }}
    />

    {/* Bellijst Popup */}
    <BellijstPopup
      isOpen={bellijstOpen}
      onClose={() => setBellijstOpen(false)}
    />

    {/* New Lead Modal */}
    <NewLeadModal
      isOpen={newLeadModalOpen}
      onClose={() => setNewLeadModalOpen(false)}
      onLeadCreated={(result) => {
        setNewLeadModalOpen(false);
        // Could trigger a refresh or navigate to the new lead
        if (result?.id) {
          navigate(`/leads`);
        }
      }}
    />
    </>
  );
};

export default TopBar;
