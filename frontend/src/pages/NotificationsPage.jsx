import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Filter, Loader2, AlertCircle, UserPlus, FileText, Phone, DollarSign, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = '/api/v1';
const token = () => sessionStorage.getItem('auth_token');

const ICON_MAP = {
  lead: UserPlus,
  prospect: ArrowRight,
  document: FileText,
  callback: Phone,
  deal: DollarSign,
  system: AlertCircle,
};

const TYPE_COLORS = {
  lead: { bg: '#eef2fa', text: '#3d61a4' },
  prospect: { bg: '#eef2fa', text: '#0a2d6b' },
  document: { bg: '#fef3c7', text: '#92400e' },
  callback: { bg: '#dcfce7', text: '#166534' },
  deal: { bg: '#dbeafe', text: '#1e40af' },
  system: { bg: '#f3f4f6', text: '#374151' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Zojuist';
  if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} dagen geleden`;
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const unreadOnly = filter === 'unread' ? '&unread_only=true' : '';
      const res = await fetch(`${API}/notifications/?page=${page}&page_size=${pageSize}${unreadOnly}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Notifications fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await fetch(`${API}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleClick = (notif) => {
    if (!notif.is_read) markAsRead(notif.id);
    // Navigate based on entity type
    if (notif.entity_type === 'lead' && notif.entity_id) {
      navigate('/leads');
    } else if (notif.entity_type === 'prospect' && notif.entity_id) {
      navigate('/prospects');
    } else if (notif.entity_type === 'document' && notif.entity_id) {
      navigate('/onboarding');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#eef2fa' }}>
            <Bell size={20} style={{ color: '#3d61a4' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#011745', fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
              Meldingen
            </h1>
            <p className="text-sm" style={{ color: '#566079' }}>
              {total} meldingen{unreadCount > 0 ? ` · ${unreadCount} ongelezen` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#e8eaf2' }}>
            <button
              onClick={() => { setFilter('all'); setPage(1); }}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: filter === 'all' ? '#3d61a4' : '#f7f8fc',
                color: filter === 'all' ? '#fff' : '#566079',
              }}
            >
              Alle
            </button>
            <button
              onClick={() => { setFilter('unread'); setPage(1); }}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: filter === 'unread' ? '#3d61a4' : '#f7f8fc',
                color: filter === 'unread' ? '#fff' : '#566079',
              }}
            >
              Ongelezen
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:shadow-sm"
              style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}
            >
              <CheckCheck size={16} />
              Alles gelezen
            </button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#fff', borderColor: '#e8eaf2' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: '#3d61a4' }} />
            <span className="ml-3 text-sm" style={{ color: '#566079' }}>Laden...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Bell size={48} style={{ color: '#cdd1e0' }} />
            <p className="mt-4 text-sm font-medium" style={{ color: '#566079' }}>
              {filter === 'unread' ? 'Geen ongelezen meldingen' : 'Geen meldingen'}
            </p>
          </div>
        ) : (
          notifications.map((notif, idx) => {
            const type = notif.notification_type || notif.entity_type || 'system';
            const Icon = ICON_MAP[type] || AlertCircle;
            const colors = TYPE_COLORS[type] || TYPE_COLORS.system;

            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className="flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-gray-50"
                style={{
                  backgroundColor: !notif.is_read ? '#f4f6fb' : '#fff',
                  borderBottom: idx < notifications.length - 1 ? '1px solid #e8eaf2' : 'none',
                }}
              >
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Icon size={18} style={{ color: colors.text }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: !notif.is_read ? '#011745' : '#3b4560' }}>
                    {notif.title}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: '#566079' }}>
                    {notif.message}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>
                    {timeAgo(notif.created_at)}
                  </p>
                </div>

                {/* Read indicator */}
                <div className="flex-shrink-0 mt-1">
                  {notif.is_read ? (
                    <Check size={16} style={{ color: '#a4abbe' }} />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3d61a4' }} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}
          >
            Vorige
          </button>
          <span className="text-sm px-3" style={{ color: '#566079' }}>
            Pagina {page} van {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}
          >
            Volgende
          </button>
        </div>
      )}
    </div>
  );
}
