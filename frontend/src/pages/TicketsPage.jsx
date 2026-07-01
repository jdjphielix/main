import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Ticket, AlertCircle, Clock, CheckCircle, XCircle, Filter, RefreshCw, Trash2, Edit3, X, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const token = () => sessionStorage.getItem('auth_token');
const api = (url, opts = {}) => fetch(url, {
  ...opts,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(opts.headers || {}) },
}).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)));

const STATUSES = {
  open:        { label: 'Open',           color: '#3d61a4', bg: '#eef2fa',  icon: Clock },
  in_progress: { label: 'In behandeling', color: '#d97706', bg: '#fffbeb',  icon: AlertCircle },
  pending:     { label: 'Pending',        color: '#0d9488', bg: '#f0fdfa',  icon: Clock },
  waiting:     { label: 'Wachten',        color: '#7c3aed', bg: '#f5f3ff',  icon: Clock },
  with_broker: { label: 'Met broker',     color: '#0891b2', bg: '#ecfeff',  icon: AlertCircle },
  resolved:    { label: 'Opgelost',       color: '#16a34a', bg: '#f0fdf4',  icon: CheckCircle },
  closed:      { label: 'Gesloten',       color: '#7b859e', bg: '#f3f4f8',  icon: XCircle },
};
const PRIORITIES = {
  low:    { label: 'Laag',    color: '#7b859e' },
  normal: { label: 'Normaal', color: '#3d61a4' },
  high:   { label: 'Hoog',    color: '#d97706' },
  urgent: { label: 'Urgent',  color: '#dc2626' },
};
const CATEGORIES = ['onboarding', 'client', 'fx', 'trade', 'compliance', 'other'];

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMine, setFilterMine] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', category: 'other', assigned_to_id: '' });
  const [saving, setSaving] = useState(false);

  const isAdmin = ['admin_pay', 'admin_trade'].includes(user?.role) || user?.is_teamleader;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterMine) params.set('my_tickets', 'true');
      const data = await api(`/api/v1/tickets/?${params}`);
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus, filterMine]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (isAdmin) {
      api('/api/v1/users/team').then(u => setAllUsers(u || [])).catch(() => {});
    }
  }, [isAdmin]);

  const createTicket = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api('/api/v1/tickets/', { method: 'POST', body: JSON.stringify({
        ...form, assigned_to_id: form.assigned_to_id || null
      }) });
      setForm({ title: '', description: '', priority: 'normal', category: 'other', assigned_to_id: '' });
      setShowCreate(false);
      fetchTickets();
    } catch (e) { alert('Aanmaken mislukt: ' + e.message); }
    finally { setSaving(false); }
  };

  const updateTicket = async (id, data) => {
    try {
      const updated = await api(`/api/v1/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
      return updated;
    } catch (e) { alert('Bijwerken mislukt: ' + e.message); }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm('Ticket definitief verwijderen?')) return;
    try {
      await api(`/api/v1/tickets/${id}`, { method: 'DELETE' });
      setTickets(prev => prev.filter(t => t.id !== id));
      setEditingTicket(null);
    } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
  };

  const openEdit = (ticket) => {
    setEditingTicket(ticket);
    setEditForm({
      title: ticket.title || '',
      description: ticket.description || '',
      status: ticket.status || 'open',
      priority: ticket.priority || 'normal',
      category: ticket.category || 'other',
      assigned_to_id: ticket.assigned_to_id || '',
      follow_up_date: ticket.follow_up_date ? ticket.follow_up_date.slice(0, 10) : '',
    });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const updated = await updateTicket(editingTicket.id, {
        ...editForm,
        assigned_to_id: editForm.assigned_to_id || null,
        follow_up_date: editForm.status === 'pending' ? (editForm.follow_up_date || null) : null,
      });
      if (updated) {
        setEditingTicket(prev => ({ ...prev, ...updated }));
      }
      setEditingTicket(null);
    } catch (e) { /* handled in updateTicket */ }
    finally { setSaving(false); }
  };

  const statusCounts = Object.keys(STATUSES).reduce((acc, s) => {
    acc[s] = tickets.filter(t => t.status === s).length;
    return acc;
  }, {});

  // Pending tickets sorted by opvolgdatum (tickets zonder datum onderaan)
  const pendingTickets = tickets
    .filter(t => t.status === 'pending')
    .sort((a, b) => {
      const da = a.follow_up_date || '9999-12-31';
      const db_ = b.follow_up_date || '9999-12-31';
      return da < db_ ? -1 : da > db_ ? 1 : 0;
    });

  return (
    <div className="flex flex-col h-full bg-[#f7f8fc] p-6 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#011745' }}>Tickets</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7b859e' }}>Interne tickets en taken</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTickets} className="p-2 rounded-lg border border-[#e8eaf2] hover:bg-white">
            <RefreshCw size={16} style={{ color: '#7b859e' }} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: '#3d61a4' }}>
            <Plus size={16} /> Nieuw ticket
          </button>
        </div>
      </div>

      {/* Status summary — 3 columns, 2 rows */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(STATUSES).map(([key, s]) => {
          const Icon = s.icon;
          return (
            <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
              className={`p-3 rounded-xl border text-left transition-all ${filterStatus === key ? 'border-2' : 'border-[#e8eaf2]'}`}
              style={{ backgroundColor: filterStatus === key ? s.bg : 'white', borderColor: filterStatus === key ? s.color : '#e8eaf2' }}>
              <div className="flex items-center gap-2 mb-0.5">
                <Icon size={12} style={{ color: s.color }} />
                <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: '#011745' }}>{statusCounts[key] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: '#566079' }}>
          <input type="checkbox" checked={filterMine} onChange={e => setFilterMine(e.target.checked)}
            className="accent-[#3d61a4] w-4 h-4" />
          Mijn tickets
        </label>
        {filterStatus && (
          <button onClick={() => setFilterStatus('')}
            className="text-xs px-2 py-1 rounded-lg bg-[#eef2fa] text-[#3d61a4]">
            Filter wissen
          </button>
        )}
      </div>

      {/* Pending — sorteert op opvolgdatum */}
      {!filterStatus && pendingTickets.length > 0 && (
        <div className="rounded-xl border border-[#ccdedd] p-4" style={{ backgroundColor: '#f0fdfa' }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} style={{ color: '#0d9488' }} />
            <h3 className="text-sm font-bold" style={{ color: '#0d9488' }}>Pending — opvolgen</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#0d9488', color: 'white' }}>{pendingTickets.length}</span>
          </div>
          <div className="space-y-1.5">
            {pendingTickets.map(t => {
              const canEdit = isAdmin || t.created_by_id === user?.id;
              const overdue = t.follow_up_date && t.follow_up_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
              return (
                <div key={t.id}
                  className={`flex items-center gap-3 bg-white rounded-lg border px-3 py-2 ${canEdit ? 'cursor-pointer hover:border-[#0d9488]' : ''}`}
                  style={{ borderColor: overdue ? '#dc2626' : '#d5e8e6' }}
                  onClick={() => canEdit && openEdit(t)}>
                  <span className="text-xs font-bold" style={{ color: '#a4abbe' }}>#{t.id}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: '#011745' }}>{t.title}</span>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: overdue ? '#dc2626' : '#0d9488' }}>
                    {t.follow_up_date ? new Date(t.follow_up_date).toLocaleDateString('nl-NL') : 'Geen datum'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticket list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-[#3d61a4]/30 border-t-[#3d61a4] rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <Ticket size={40} className="mx-auto mb-3" style={{ color: '#e8eaf2' }} />
            <p className="text-sm font-medium" style={{ color: '#566079' }}>Geen tickets gevonden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => {
              const s = STATUSES[ticket.status] || STATUSES.open;
              const p = PRIORITIES[ticket.priority] || PRIORITIES.normal;
              const SIcon = s.icon;
              const canEdit = isAdmin || ticket.created_by_id === user?.id;
              return (
                <div key={ticket.id}
                  className="bg-white rounded-xl border border-[#e8eaf2] p-4 hover:border-[#3d61a4] hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => canEdit && openEdit(ticket)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold" style={{ color: '#a4abbe' }}>#{ticket.id}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: p.color }}>{p.label}</span>
                        {ticket.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#f3f4f8]" style={{ color: '#566079' }}>{ticket.category}</span>
                        )}
                      </div>
                      <p className="font-semibold text-sm" style={{ color: '#011745' }}>{ticket.title}</p>
                      {ticket.description && (
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: '#7b859e' }}>{ticket.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {ticket.created_by_name && (
                          <span className="text-[11px]" style={{ color: '#a4abbe' }}>Door: {ticket.created_by_name}</span>
                        )}
                        {ticket.assigned_to_name && (
                          <span className="text-[11px]" style={{ color: '#3d61a4' }}>→ {ticket.assigned_to_name}</span>
                        )}
                        <span className="text-[11px]" style={{ color: '#a4abbe' }}>
                          {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('nl-NL') : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Quick status change */}
                      <select onClick={e => e.stopPropagation()}
                        value={ticket.status}
                        onChange={e => updateTicket(ticket.id, { status: e.target.value })}
                        className="text-xs border border-[#e8eaf2] rounded-lg px-2 py-1 focus:outline-none"
                        style={{ color: s.color, backgroundColor: s.bg }}>
                        {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      {canEdit && (
                        <button onClick={e => { e.stopPropagation(); openEdit(ticket); }}
                          className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors" title="Bewerken">
                          <Edit3 size={14} style={{ color: '#3d61a4' }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── EDIT MODAL ─── */}
      {editingTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaf2]">
              <h2 className="text-base font-bold" style={{ color: '#011745' }}>
                Ticket #{editingTicket.id} bewerken
              </h2>
              <button onClick={() => setEditingTicket(null)}
                className="p-1.5 rounded-lg hover:bg-[#f3f4f8]">
                <X size={18} style={{ color: '#7b859e' }} />
              </button>
            </div>
            {/* Modal body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#566079' }}>Titel *</label>
                <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#566079' }}>Beschrijving</label>
                <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#566079' }}>Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#566079' }}>Prioriteit</label>
                  <select value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#566079' }}>Categorie</label>
                <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {editForm.status === 'pending' && (
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#0d9488' }}>Opvolgdatum</label>
                  <input type="date" value={editForm.follow_up_date || ''}
                    onChange={e => setEditForm(p => ({ ...p, follow_up_date: e.target.value }))}
                    className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]" />
                  <p className="text-[11px] mt-1" style={{ color: '#a4abbe' }}>Wanneer dit pending ticket opnieuw opgepakt moet worden.</p>
                </div>
              )}
              {isAdmin && allUsers.length > 0 && (
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#566079' }}>Toegewezen aan</label>
                  <select value={editForm.assigned_to_id} onChange={e => setEditForm(p => ({ ...p, assigned_to_id: e.target.value }))}
                    className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value=''>Niet toegewezen</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                  </select>
                </div>
              )}
            </div>
            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e8eaf2]">
              <button onClick={() => deleteTicket(editingTicket.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={14} /> Verwijderen
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingTicket(null)}
                  className="px-4 py-2 rounded-lg text-sm border border-[#e8eaf2]">Annuleren</button>
                <button onClick={saveEdit} disabled={saving || !editForm.title?.trim()}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#3d61a4' }}>{saving ? 'Opslaan...' : 'Opslaan'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE MODAL ─── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold mb-4" style={{ color: '#011745' }}>Nieuw ticket aanmaken</h2>
            <div className="space-y-3">
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Titel *" className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Beschrijving (optioneel)" rows={3}
                className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                  className="border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {isAdmin && allUsers.length > 0 && (
                <select value={form.assigned_to_id} onChange={e => setForm(p => ({ ...p, assigned_to_id: e.target.value }))}
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value=''>Niet toegewezen</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={createTicket} disabled={saving || !form.title.trim()}
                className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#3d61a4' }}>{saving ? 'Aanmaken...' : 'Aanmaken'}</button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm border border-[#e8eaf2]">Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
