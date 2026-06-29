import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Plus, Shield, ShieldCheck, Star, Loader2, RefreshCw,
  AlertCircle, Settings, Trash2, ArrowRightLeft, X, Check,
  Mail, Clock, UserCheck, UserX, ClipboardCheck, FileText,
  GripVertical, ToggleLeft, ToggleRight, ChevronDown, Edit3, Save,
  DollarSign, TrendingUp, BarChart3, Building2, AlertTriangle,
  ArrowUpRight, CreditCard, CheckCircle2, Upload, ExternalLink, Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const BROKERS = [
  { key: 'ibanfirst', label: 'IbanFirst', color: '#3d61a4' },
  { key: 'corpay',    label: 'Corpay',    color: '#0a2d6b' },
  { key: 'ebury',     label: 'Ebury',     color: '#011745' },
  { key: 'trade_finance', label: 'Trade Finance', color: '#166534' },
];

function BrokerPicker({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BROKERS.map(b => (
        <button
          key={b.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === b.key ? null : b.key)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all disabled:opacity-50"
          style={value === b.key
            ? { backgroundColor: b.color, borderColor: b.color, color: '#fff' }
            : { backgroundColor: '#f7f8fc', borderColor: '#e8eaf2', color: '#566079' }
          }
        >
          {b.label}
        </button>
      ))}
      {value && (
        <button type="button" onClick={() => onChange(null)} disabled={disabled}
          className="px-2 py-1.5 rounded-lg text-xs border-2 border-dashed border-[#e8eaf2] text-[#a4abbe] hover:border-red-300 hover:text-red-400 transition-all">
          ✕ Wis
        </button>
      )}
    </div>
  );
}

function DropZone({ onFiles, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
        dragging ? 'border-[#3d61a4] bg-[#eef2fa]' : 'border-[#cdd1e0] hover:border-[#3d61a4] hover:bg-[#f7f8fc]'
      }`}
    >
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); }} />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin" style={{ color: '#3d61a4' }} />
          <p className="text-xs" style={{ color: '#7b859e' }}>Uploaden...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload size={20} style={{ color: dragging ? '#3d61a4' : '#a4abbe' }} />
          <p className="text-xs font-medium" style={{ color: dragging ? '#3d61a4' : '#7b859e' }}>
            Sleep bestanden hiernaartoe of klik om te selecteren
          </p>
          <p className="text-[10px]" style={{ color: '#a4abbe' }}>PDF, Word, Excel, afbeeldingen (max 50MB)</p>
        </div>
      )}
    </div>
  );
}

const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatCurrency(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

const ROLE_LABELS = {
  admin_pay: 'Admin Pay',
  admin_trade: 'Admin Trade',
  teamleader: 'Teamleider',
  sales: 'Sales',
  backoffice: 'Backoffice',
  finance: 'Finance',
  extern: 'Extern',
};

const ROLE_COLORS = {
  admin_pay: { bg: '#0a2d6b', text: '#fff' },
  admin_trade: { bg: '#0a2d6b', text: '#fff' },
  teamleader: { bg: '#3d61a4', text: '#fff' },
  sales: { bg: '#eef2fa', text: '#3d61a4' },
  backoffice: { bg: '#f0fdf4', text: '#16a34a' },
  finance: { bg: '#fef3c7', text: '#92400e' },
  extern: { bg: '#f3f4f8', text: '#566079' },
};

const STATUS_COLORS = {
  open: { bg: '#fef3c7', text: '#92400e', label: 'Open' },
  in_progress: { bg: '#eef2fa', text: '#3d61a4', label: 'In Behandeling' },
  waiting_response: { bg: '#fef9c3', text: '#a16207', label: 'Wacht op reactie' },
  with_broker: { bg: '#ede9fe', text: '#6d28d9', label: 'Met broker' },
  resolved: { bg: '#f0fdf4', text: '#16a34a', label: 'Opgelost' },
  closed: { bg: '#f3f4f8', text: '#566079', label: 'Gesloten' },
};

const PRIORITY_COLORS = {
  low: { bg: '#f3f4f8', text: '#7b859e', label: 'Laag' },
  normal: { bg: '#eef2fa', text: '#3d61a4', label: 'Normaal' },
  high: { bg: '#fef3c7', text: '#92400e', label: 'Hoog' },
  urgent: { bg: '#fef2f2', text: '#dc2626', label: 'Urgent' },
};


/* ═══════════════════════════════════════════════════════════════
   TAB: Gebruikers
   ═══════════════════════════════════════════════════════════════ */
function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'sales' });
  const [adding, setAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [reassignModal, setReassignModal] = useState(null);
  const [reassignTarget, setReassignTarget] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/v1/users/');
      setUsers(data.users || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAddUser() {
    if (!newUser.email || !newUser.full_name) return;
    setAdding(true);
    try {
      await api('/api/v1/users/', { method: 'POST', body: JSON.stringify(newUser) });
      setNewUser({ email: '', full_name: '', role: 'sales' });
      setShowAddUser(false);
      fetchUsers();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setAdding(false); }
  }

  async function handleChangeRole(userId, newRole) {
    setActionLoading(userId);
    try {
      await api(`/api/v1/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
      fetchUsers();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setActionLoading(null); }
  }

  async function handleToggleTeamleader(userId, current) {
    setActionLoading(userId);
    try {
      await api(`/api/v1/users/${userId}/teamleader`, { method: 'PUT', body: JSON.stringify({ is_teamleader: !current }) });
      fetchUsers();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setActionLoading(null); }
  }

  async function handleDeactivate(userId) {
    const userName = users.find(u => u.id === userId)?.full_name || 'deze gebruiker';
    const activeUsers = users.filter(u => u.id !== userId && u.status === 'active');

    // Show a prompt for reassignment
    const reassignTo = activeUsers.length > 0
      ? window.prompt(
          `Deactiveer ${userName}?\n\nVoer het ID in van de gebruiker aan wie leads worden overgedragen, of laat leeg om over te slaan:\n\n${activeUsers.map(u => `${u.id}: ${u.full_name}`).join('\n')}`
        )
      : null;

    if (!window.confirm(`Deactiveer ${userName}? Dit kan niet ongedaan worden gemaakt.`)) return;

    setActionLoading(userId);
    try {
      const url = reassignTo && !isNaN(parseInt(reassignTo))
        ? `/api/v1/users/${userId}?reassign_to_id=${parseInt(reassignTo)}`
        : `/api/v1/users/${userId}`;
      const result = await api(url, { method: 'DELETE' });
      if (result.leads_reassigned > 0) {
        alert(`✓ Gebruiker gedeactiveerd. ${result.leads_reassigned} leads overgedragen.`);
      }
      fetchUsers();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setActionLoading(null); }
  }

  async function handleActivate(userId) {
    setActionLoading(userId);
    try {
      await api(`/api/v1/users/${userId}/activate`, { method: 'POST' });
      fetchUsers();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setActionLoading(null); }
  }

  async function handleAssignTeamleader(userId, teamLeaderId) {
    setActionLoading(`tl_${userId}`);
    try {
      await api(`/api/v1/users/${userId}/assign-teamleader`, {
        method: 'PUT',
        body: JSON.stringify({ team_leader_id: teamLeaderId ? parseInt(teamLeaderId) : null }),
      });
      fetchUsers();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setActionLoading(null); }
  }

  async function handleToggleSalesDashboard(userId, current) {
    setActionLoading(`dash_${userId}`);
    try {
      await api(`/api/v1/users/${userId}/sales-dashboard`, {
        method: 'PUT',
        body: JSON.stringify({ show_on_sales_dashboard: !current }),
      });
      fetchUsers();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setActionLoading(null); }
  }

  async function handleReassign() {
    if (!reassignModal || !reassignTarget) return;
    setActionLoading(reassignModal);
    try {
      const result = await api(`/api/v1/users/${reassignModal}/reassign`, {
        method: 'POST', body: JSON.stringify({ new_assigned_user_id: parseInt(reassignTarget) }),
      });
      alert(`${result.leads_reassigned} leads overgedragen`);
      setReassignModal(null);
      setReassignTarget('');
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setActionLoading(null); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAddUser(!showAddUser)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:shadow-lg"
          style={{ backgroundColor: '#3d61a4' }}>
          <Plus size={18} /> Gebruiker Toevoegen
        </button>
      </div>

      {showAddUser && (
        <div className="bg-white rounded-xl border border-[#e8eaf2] p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: '#011745' }}>Nieuwe Gebruiker</h3>
            <button onClick={() => setShowAddUser(false)} className="p-1 rounded-lg hover:bg-[#f3f4f8]">
              <X size={18} style={{ color: '#7b859e' }} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Volledige naam</label>
              <input type="text" value={newUser.full_name}
                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Jan Jansen"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                style={{ color: '#011745' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>E-mail</label>
              <input type="email" value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="jan@taperpay.com"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                style={{ color: '#011745' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Rol</label>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                style={{ color: '#011745' }}>
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleAddUser} disabled={adding || !newUser.email || !newUser.full_name}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-40"
              style={{ backgroundColor: '#3d61a4' }}>
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Toevoegen
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle size={20} /><span className="text-sm">{error}</span>
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e8eaf2] overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#f7f8fc' }}>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Gebruiker</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Rol</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>⭐ TL-vlag</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Team van</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Laatst Ingelogd</th>
                <th className="text-right px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.sales;
                const isCurrentUser = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-t border-[#f3f4f8] hover:bg-[#f7f8fc] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: '#3d61a4' }}>
                          {(u.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#011745' }}>
                            {u.full_name} {isCurrentUser && <span className="text-xs" style={{ color: '#3d61a4' }}>(jij)</span>}
                          </p>
                          <p className="text-xs" style={{ color: '#7b859e' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select value={u.role} disabled={isCurrentUser || actionLoading === u.id}
                        onChange={e => handleChangeRole(u.id, e.target.value)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer"
                        style={{ backgroundColor: rc.bg, color: rc.text }}>
                        {Object.entries(ROLE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {u.status === 'active' ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleTeamleader(u.id, u.is_teamleader)} disabled={actionLoading === u.id}
                        className={`p-1.5 rounded-lg transition-colors ${u.is_teamleader ? 'text-yellow-500 bg-yellow-50' : 'text-[#a4abbe] hover:bg-[#f3f4f8]'}`}>
                        <Star size={16} fill={u.is_teamleader ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_teamleader ? (
                        <span className="text-xs text-[#a4abbe] italic">Is teamleider</span>
                      ) : (
                        (() => {
                          const teamleaders = users.filter(tl => (tl.is_teamleader || tl.role === 'teamleader') && tl.status === 'active');
                          return (
                            <select
                              value={u.team_leader_id || ''}
                              disabled={actionLoading === `tl_${u.id}`}
                              onChange={e => handleAssignTeamleader(u.id, e.target.value || null)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-[#e8eaf2] bg-white focus:outline-none focus:border-[#3d61a4] disabled:opacity-40 cursor-pointer"
                              style={{ color: u.team_leader_id ? '#011745' : '#a4abbe', minWidth: '130px' }}
                            >
                              <option value="">— Geen team —</option>
                              {teamleaders.length === 0 && (
                                <option disabled value="">Eerst ⭐ markeren</option>
                              )}
                              {teamleaders.map(tl => (
                                <option key={tl.id} value={tl.id}>{tl.full_name}</option>
                              ))}
                            </select>
                          );
                        })()
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs" style={{ color: '#7b859e' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nog niet ingelogd'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Sales dashboard toggle */}
                        <button
                          onClick={() => handleToggleSalesDashboard(u.id, u.show_on_sales_dashboard)}
                          disabled={actionLoading === `dash_${u.id}`}
                          title={u.show_on_sales_dashboard ? 'Verwijder van sales dashboard' : 'Voeg toe aan sales dashboard'}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50 ${
                            u.show_on_sales_dashboard
                              ? 'bg-[#011745] text-white'
                              : 'bg-[#f3f4f8] text-[#7b859e] hover:bg-[#eef2fa] hover:text-[#3d61a4]'
                          }`}
                        >
                          {actionLoading === `dash_${u.id}`
                            ? '...'
                            : u.show_on_sales_dashboard ? '📊 Op dashboard' : '+ Dashboard'
                          }
                        </button>
                        <button onClick={() => { setReassignModal(u.id); setReassignTarget(''); }}
                          className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }} title="Leads overdragen">
                          <ArrowRightLeft size={16} />
                        </button>
                        {!isCurrentUser && u.status === 'active' && (
                          <button onClick={() => handleDeactivate(u.id)} disabled={actionLoading === u.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="Deactiveer">
                            <UserX size={16} />
                          </button>
                        )}
                        {!isCurrentUser && u.status !== 'active' && (
                          <button onClick={() => handleActivate(u.id)} disabled={actionLoading === u.id}
                            className="p-1.5 rounded-lg hover:bg-green-50 transition-colors" style={{ color: '#16a34a' }} title="Activeer">
                            <UserCheck size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reassignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#011745' }}>Leads Overdragen</h3>
            <p className="text-sm mb-4" style={{ color: '#7b859e' }}>
              Alle leads van {users.find(u => u.id === reassignModal)?.full_name} overdragen naar:
            </p>
            <select value={reassignTarget} onChange={e => setReassignTarget(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm mb-4" style={{ color: '#011745' }}>
              <option value="">Selecteer gebruiker...</option>
              {users.filter(u => u.id !== reassignModal && u.status === 'active').map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReassignModal(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#7b859e' }}>Annuleer</button>
              <button onClick={handleReassign} disabled={!reassignTarget || actionLoading === reassignModal}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ backgroundColor: '#3d61a4' }}>
                {actionLoading === reassignModal ? <Loader2 size={16} className="animate-spin" /> : 'Overdragen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: Onboarding Vereisten
   ═══════════════════════════════════════════════════════════════ */
function RequirementsTab() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productFilter, setProductFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', product_type: 'taperpay', is_required: true, sort_order: 1 });
  const [saving, setSaving] = useState(false);

  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/v1/admin/onboarding-requirements');
      setRequirements(data.requirements || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequirements(); }, [fetchRequirements]);

  const filtered = productFilter === 'all'
    ? requirements
    : requirements.filter(r => r.product_type === productFilter);

  const payCount = requirements.filter(r => r.product_type === 'taperpay' && r.is_active).length;
  const tradeCount = requirements.filter(r => r.product_type === 'tapertrade' && r.is_active).length;

  function startEdit(req) {
    setEditingId(req.id);
    setFormData({ name: req.name, description: req.description || '', product_type: req.product_type, is_required: req.is_required, sort_order: req.sort_order });
    setShowAdd(false);
  }

  function startAdd() {
    setEditingId(null);
    const maxOrder = filtered.length > 0 ? Math.max(...filtered.map(r => r.sort_order)) + 1 : 1;
    setFormData({ name: '', description: '', product_type: productFilter === 'all' ? 'taperpay' : productFilter, is_required: true, sort_order: maxOrder });
    setShowAdd(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api(`/api/v1/admin/onboarding-requirements/${editingId}`, { method: 'PUT', body: JSON.stringify(formData) });
      } else {
        await api('/api/v1/admin/onboarding-requirements', { method: 'POST', body: JSON.stringify(formData) });
      }
      setEditingId(null);
      setShowAdd(false);
      fetchRequirements();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(req) {
    try {
      if (req.is_active) {
        await api(`/api/v1/admin/onboarding-requirements/${req.id}`, { method: 'DELETE' });
      } else {
        await api(`/api/v1/admin/onboarding-requirements/${req.id}`, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
      }
      fetchRequirements();
    } catch (err) { alert('Fout: ' + err.message); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1">
          {[
            { key: 'all', label: `Alle (${requirements.filter(r => r.is_active).length})` },
            { key: 'taperpay', label: `TaperPay (${payCount})` },
            { key: 'tapertrade', label: `TaperTrade (${tradeCount})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setProductFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${productFilter === tab.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              style={{ color: productFilter === tab.key ? '#3d61a4' : '#7b859e' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:shadow-lg"
          style={{ backgroundColor: '#3d61a4' }}>
          <Plus size={18} /> Vereiste Toevoegen
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertCircle size={20} /><span className="text-sm">{error}</span>
        </div>
      )}

      {(showAdd || editingId) && (
        <div className="bg-white rounded-xl border-2 border-[#3d61a4]/30 p-5 mb-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3" style={{ color: '#011745' }}>
            {editingId ? 'Vereiste Bewerken' : 'Nieuwe Vereiste'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Naam *</label>
              <input type="text" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="KvK Uittreksel / Certificate of Incorporation"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                style={{ color: '#011745' }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Product</label>
                <select value={formData.product_type} onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }}>
                  <option value="taperpay">TaperPay</option>
                  <option value="tapertrade">TaperTrade</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Volgorde</label>
                <input type="number" value={formData.sort_order}
                  onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.is_required}
                    onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                    className="rounded" />
                  <span className="text-xs font-medium" style={{ color: '#566079' }}>Verplicht</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Omschrijving</label>
            <input type="text" value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Officieel uittreksel van de Kamer van Koophandel of equivalent"
              className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
              style={{ color: '#011745' }} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setEditingId(null); }}
              className="px-4 py-2 rounded-lg text-sm" style={{ color: '#7b859e' }}>Annuleer</button>
            <button onClick={handleSave} disabled={saving || !formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: '#3d61a4' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingId ? 'Opslaan' : 'Toevoegen'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck size={40} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
          <p className="font-semibold" style={{ color: '#011745' }}>Geen vereisten gevonden</p>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>Voeg een nieuwe onboarding vereiste toe</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <div key={req.id}
              className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-all ${
                !req.is_active ? 'opacity-50 border-[#e8eaf2]' : 'border-[#e8eaf2] hover:border-[#3d61a4]/30'
              }`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                {req.sort_order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold truncate" style={{ color: '#011745' }}>{req.name}</h4>
                  {req.is_required && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-semibold flex-shrink-0">VERPLICHT</span>
                  )}
                </div>
                {req.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#7b859e' }}>{req.description}</p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${
                req.product_type === 'taperpay' ? 'bg-[#eef2fa] text-[#3d61a4]' : 'bg-[#fef3c7] text-[#92400e]'
              }`}>
                {req.product_type === 'taperpay' ? 'TaperPay' : 'TaperTrade'}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(req)}
                  className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }} title="Bewerken">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => handleToggleActive(req)}
                  className="p-1.5 rounded-lg hover:bg-[#f3f4f8] transition-colors" title={req.is_active ? 'Deactiveren' : 'Activeren'}>
                  {req.is_active ? (
                    <ToggleRight size={18} className="text-green-500" />
                  ) : (
                    <ToggleLeft size={18} style={{ color: '#a4abbe' }} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: P&L Management
   ═══════════════════════════════════════════════════════════════ */
function PnLTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPnL = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/api/v1/admin/pnl');
      setData(res);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPnL(); }, [fetchPnL]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 text-red-600 rounded-xl p-4 flex items-center gap-3">
      <AlertCircle size={20} /><span className="text-sm">{error}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#e8eaf2] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#eef2fa' }}>
              <DollarSign size={20} style={{ color: '#3d61a4' }} />
            </div>
            <p className="text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Totale Omzet / Jaar</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#011745' }}>{formatCurrency(data?.total_revenue)}</p>
          <p className="text-xs mt-1" style={{ color: '#7b859e' }}>Som van volume x marge alle klanten</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8eaf2] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
              <TrendingUp size={20} style={{ color: '#16a34a' }} />
            </div>
            <p className="text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Totaal Volume / Jaar</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#011745' }}>{formatCurrency(data?.total_volume)}</p>
          <p className="text-xs mt-1" style={{ color: '#7b859e' }}>Alle currency pairs gecombineerd</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8eaf2] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fef3c7' }}>
              <Building2 size={20} style={{ color: '#92400e' }} />
            </div>
            <p className="text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Klanten met Forecast</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#011745' }}>{data?.client_count || 0}</p>
          <p className="text-xs mt-1" style={{ color: '#7b859e' }}>Klanten met actieve forecasting</p>
        </div>
      </div>

      {/* Currency Pair Breakdown */}
      {data?.currency_pairs?.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e8eaf2] shadow-sm">
          <div className="px-6 py-4 border-b border-[#e8eaf2]">
            <h3 className="text-sm font-bold" style={{ color: '#011745' }}>Omzet per Currency Pair</h3>
          </div>
          <div className="divide-y divide-[#f3f4f8]">
            {data.currency_pairs.map((pair, i) => (
              <div key={pair.pair} className="px-6 py-3 flex items-center justify-between hover:bg-[#f7f8fc] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold w-8 text-center" style={{ color: '#a4abbe' }}>{i + 1}</span>
                  <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                    {pair.pair}
                  </span>
                  <span className="text-xs" style={{ color: '#7b859e' }}>{pair.client_count} klant{pair.client_count !== 1 ? 'en' : ''}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs" style={{ color: '#7b859e' }}>Volume</p>
                    <p className="text-sm font-semibold" style={{ color: '#011745' }}>{formatCurrency(pair.total_volume)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: '#7b859e' }}>Omzet</p>
                    <p className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatCurrency(pair.total_revenue)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Client Breakdown */}
      {data?.clients?.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e8eaf2] shadow-sm">
          <div className="px-6 py-4 border-b border-[#e8eaf2]">
            <h3 className="text-sm font-bold" style={{ color: '#011745' }}>Omzet per Klant</h3>
          </div>
          <div className="divide-y divide-[#f3f4f8]">
            {data.clients.map((client, i) => (
              <div key={client.lead_id} className="px-6 py-4 hover:bg-[#f7f8fc] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: '#011745' }}>
                      {(client.company_name || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#011745' }}>{client.company_name}</p>
                      <p className="text-xs" style={{ color: '#7b859e' }}>
                        {client.currency_pairs.length} currency pair{client.currency_pairs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#7b859e' }}>Volume</p>
                      <p className="text-sm font-semibold" style={{ color: '#011745' }}>{formatCurrency(client.total_volume)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#7b859e' }}>Omzet</p>
                      <p className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatCurrency(client.total_revenue)}</p>
                    </div>
                  </div>
                </div>
                {/* Currency pair detail */}
                <div className="ml-11 space-y-1">
                  {client.currency_pairs.map(cp => (
                    <div key={cp.id} className="flex items-center justify-between text-xs py-1">
                      <span className="font-medium" style={{ color: '#3d61a4' }}>{cp.buy_currency}/{cp.sell_currency}</span>
                      <div className="flex items-center gap-4">
                        <span style={{ color: '#7b859e' }}>Vol: {formatCurrency(cp.volume_per_year)}</span>
                        <span style={{ color: '#7b859e' }}>Marge: {formatCurrency(cp.margin_per_year)}</span>
                        <span className="font-semibold" style={{ color: '#16a34a' }}>{formatCurrency(cp.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!data?.clients || data.clients.length === 0) && (
        <div className="text-center py-16 bg-white rounded-xl border border-[#e8eaf2]">
          <DollarSign size={40} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
          <p className="font-semibold" style={{ color: '#011745' }}>Nog geen P&L data</p>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>Voeg forecasting data toe bij klanten om hier de omzet te zien</p>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   EMAIL THREAD CARD (compliance correspondentie)
   ═══════════════════════════════════════════════════════════════ */
function EmailThreadCard({ email }) {
  const [expanded, setExpanded] = useState(false);
  const isOutbound = email.direction === 'outbound';
  const sender = email.from_email || '';
  const initial = sender.charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: isOutbound ? '#c7d7f0' : '#e8eaf2', backgroundColor: isOutbound ? '#f0f5ff' : '#fff' }}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:opacity-90 transition-all"
        onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: isOutbound ? '#3d61a4' : '#011745' }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold truncate" style={{ color: '#011745' }}>
              {isOutbound ? 'Jij' : sender}
            </p>
            <span className="text-[10px] flex-shrink-0" style={{ color: '#a4abbe' }}>
              {email.received_at
                ? new Date(email.received_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—'}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: '#7b859e' }}>
            {isOutbound ? `Aan: ${email.to_email}` : `Van: ${sender}`}
          </p>
          {email.subject && (
            <p className="text-xs font-medium mt-0.5 truncate" style={{ color: '#3d61a4' }}>{email.subject}</p>
          )}
          {!expanded && email.snippet && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: '#566079' }}>{email.snippet}</p>
          )}
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          style={{ color: '#a4abbe' }} />
      </button>

      {expanded && email.body_html && (
        <div className="px-4 pb-4 border-t border-[#f3f4f8]">
          <div
            className="mt-3 text-xs rounded-lg p-3 overflow-auto max-h-72"
            style={{ backgroundColor: '#f7f8fc', color: '#252f4a', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: email.body_html }}
          />
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: Compliance Inbox
   ═══════════════════════════════════════════════════════════════ */
function ComplianceInboxTab() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ignoredIds, setIgnoredIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('compliance_inbox_ignored') || '[]'); }
    catch { return []; }
  });

  // Create-from-email form state
  const [createFromEmail, setCreateFromEmail] = useState(null); // the email being turned into a ticket
  const [createForm, setCreateForm] = useState({ title: '', description: '', priority: 'normal', broker: null, lead_id: null });
  const [creating, setCreating] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const fetchProposed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/api/v1/compliance/proposed');
      setEmails(res.emails || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProposed(); }, [fetchProposed]);

  function ignoreEmail(id) {
    const next = [...ignoredIds, id];
    setIgnoredIds(next);
    localStorage.setItem('compliance_inbox_ignored', JSON.stringify(next));
  }

  function openCreateForm(email) {
    setCreateFromEmail(email);
    setCreateForm({
      title: email.subject || 'Compliance Request',
      description: email.snippet || '',
      priority: 'normal',
      broker: null,
      lead_id: email.lead_id,
    });
  }

  async function submitCreateCase() {
    if (!createFromEmail || !createForm.title.trim()) return;
    setCreating(true);
    try {
      await api('/api/v1/compliance/cases/from-email', {
        method: 'POST',
        body: JSON.stringify({
          email_id: createFromEmail.id,
          title: createForm.title,
          description: createForm.description,
          priority: createForm.priority,
          broker: createForm.broker,
          lead_id: createForm.lead_id,
        }),
      });
      setCreateFromEmail(null);
      fetchProposed();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setCreating(false); }
  }

  const visible = emails.filter(e => !ignoredIds.includes(e.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: '#011745' }}>Compliance Inbox</h2>
          <p className="text-xs mt-0.5" style={{ color: '#7b859e' }}>
            Inkomende e-mails met compliance-gerelateerde inhoud uit de afgelopen 30 dagen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setScanLoading(true);
              try {
                await fetch('/api/v1/compliance/scan-inbox', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token()}` }
                });
                fetchProposed(); // refresh the list
              } catch (e) { console.error(e); }
              finally { setScanLoading(false); }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#3d61a4', color: 'white' }}>
            {scanLoading ? <span className="animate-spin inline-block">⟳</span> : '⟳'} Scan inbox
          </button>
          <button onClick={fetchProposed}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e8eaf2] hover:bg-[#f7f8fc] transition-all"
            style={{ color: '#566079' }}>
            <RefreshCw size={13} /> Vernieuwen
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} /><span className="text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[#e8eaf2]">
          <Mail size={40} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
          <p className="font-semibold" style={{ color: '#011745' }}>Geen voorgestelde e-mails</p>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>Er zijn geen nieuwe compliance-gerelateerde e-mails gevonden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(email => (
            <div key={email.id} className="bg-white rounded-xl border border-[#e8eaf2] p-4 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: '#011745' }}>
                  {(email.lead_name || email.from_email || '?').charAt(0).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-semibold truncate" style={{ color: '#011745' }}>
                      {email.lead_name || '—'}
                    </p>
                    <span className="text-[10px] flex-shrink-0" style={{ color: '#a4abbe' }}>
                      {email.received_at ? new Date(email.received_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: '#566079' }}>
                    {email.from_email}
                  </p>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#3d61a4' }}>
                    {email.subject}
                  </p>
                  {email.snippet && (
                    <p className="text-xs line-clamp-2" style={{ color: '#7b859e' }}>
                      {email.snippet}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[#f3f4f8]">
                <button onClick={() => ignoreEmail(email.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e8eaf2] hover:border-red-200 hover:text-red-400 transition-all"
                  style={{ color: '#a4abbe' }}>
                  Negeren
                </button>
                <button onClick={() => openCreateForm(email)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#3d61a4' }}>
                  <Plus size={12} /> Aanmaken als ticket
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create-from-email modal */}
      {createFromEmail && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCreateFromEmail(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaf2] sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold" style={{ color: '#011745' }}>Ticket aanmaken</h3>
              <button onClick={() => setCreateFromEmail(null)} className="p-2 rounded-lg hover:bg-[#f3f4f8] transition-colors">
                <X size={18} style={{ color: '#566079' }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Email info */}
              <div className="p-3 rounded-xl border border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: '#a4abbe' }}>E-mail bron</p>
                <p className="text-xs font-medium" style={{ color: '#011745' }}>{createFromEmail.from_email}</p>
                <p className="text-xs mt-0.5 italic" style={{ color: '#7b859e' }}>{createFromEmail.subject}</p>
              </div>

              {/* Klant */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Klant</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#eef2fa' }}>
                  <CheckCircle2 size={14} style={{ color: '#3d61a4' }} />
                  <span className="text-sm font-medium" style={{ color: '#3d61a4' }}>{createFromEmail.lead_name || `Lead #${createFromEmail.lead_id}`}</span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Titel *</label>
                <input type="text" value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Notities</label>
                <textarea value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                  style={{ color: '#011745' }} />
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Prioriteit</label>
                <select value={createForm.priority}
                  onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }}>
                  <option value="low">Laag</option>
                  <option value="normal">Normaal</option>
                  <option value="high">Hoog</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Broker */}
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Broker / Kanaal</label>
                <BrokerPicker value={createForm.broker} onChange={v => setCreateForm({ ...createForm, broker: v })} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8eaf2] flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setCreateFromEmail(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#7b859e' }}>
                Annuleer
              </button>
              <button onClick={submitCreateCase}
                disabled={creating || !createForm.title.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#3d61a4' }}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Aanmaken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: Compliance Overzicht
   ═══════════════════════════════════════════════════════════════ */
function ComplianceTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Slide-in case detail
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseEdit, setCaseEdit] = useState(null); // edited copy
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailTab, setDetailTab] = useState('details'); // 'details' | 'correspondentie'

  // Correspondentie tab state
  const [thread, setThread] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [replySending, setReplySending] = useState(false);

  // Create new case
  const [showCreate, setShowCreate] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [createForm, setCreateForm] = useState({ lead_id: null, lead_name: '', title: '', description: '', priority: 'normal', broker: null });
  const [creating, setCreating] = useState(false);
  const [createUploading, setCreateUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // files to attach after case creation

  const fetchCompliance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await api(`/api/v1/admin/compliance${params}`);
      setData(res);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchCompliance(); }, [fetchCompliance]);

  // Fetch clients for create form
  useEffect(() => {
    if (!showCreate) return;
    fetch(`/api/v1/leads/?page_size=200&pipeline_stage=client`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()).then(d => setClients(d.leads || [])).catch(() => {});
  }, [showCreate]);

  async function openCase(c) {
    setSelectedCase(c);
    setCaseEdit({ ...c });
    setDetailTab('details');
    setReplyText('');
    setReplyTo('');
    setThread([]);  // Clear previous thread so it doesn't flash when switching cases
  }

  async function fetchThread(caseId, latestInboundFrom) {
    setThreadLoading(true);
    try {
      const res = await api(`/api/v1/compliance/cases/${caseId}/thread`);
      const emails = res.emails || [];
      setThread(emails);
      // Auto-fill reply-to with the most recent inbound sender
      const inbound = [...emails].reverse().find(e => e.direction === 'inbound');
      if (inbound) {
        // Extract bare email from "Name <email>" format
        const match = inbound.from_email.match(/<(.+?)>/);
        setReplyTo(match ? match[1] : inbound.from_email);
      } else if (latestInboundFrom) {
        setReplyTo(latestInboundFrom);
      }
    } catch (err) { console.error('Thread load error:', err); }
    finally { setThreadLoading(false); }
  }

  async function sendReply() {
    if (!replyText.trim() || !replyTo.trim()) return;
    setReplySending(true);
    try {
      await api(`/api/v1/compliance/cases/${selectedCase.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText, to_email: replyTo }),
      });
      setReplyText('');
      await fetchThread(selectedCase.id);
    } catch (err) { alert('Fout bij verzenden: ' + err.message); }
    finally { setReplySending(false); }
  }

  async function saveCase() {
    setSaving(true);
    try {
      await api(`/api/v1/admin/compliance/${caseEdit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: caseEdit.title,
          description: caseEdit.description,
          status: caseEdit.status,
          priority: caseEdit.priority,
          broker: caseEdit.broker,
          resolution_notes: caseEdit.resolution_notes,
        }),
      });
      // Refresh the list and update selected
      await fetchCompliance();
      // Update local selected case
      setSelectedCase(prev => ({ ...prev, ...caseEdit }));
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setSaving(false); }
  }

  async function deleteCase() {
    if (!caseEdit?.id) return;
    if (!window.confirm('Weet je zeker dat je deze ticket definitief wilt verwijderen?')) return;
    setSaving(true);
    try {
      await api(`/api/v1/admin/compliance/${caseEdit.id}`, { method: 'DELETE' });
      setSelectedCase(null);
      await fetchCompliance();
    } catch (err) { alert('Verwijderen mislukt: ' + err.message); }
    finally { setSaving(false); }
  }

  async function uploadToCase(caseId, leadId, files) {
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch(`/api/v1/documents/upload?lead_id=${leadId}&category=compliance`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
          body: fd,
        });
        if (!uploadRes.ok) throw new Error('Upload mislukt');
        const uploaded = await uploadRes.json();
        await api(`/api/v1/leads/${leadId}/compliance/${caseId}/documents`, {
          method: 'POST',
          body: JSON.stringify({ document_id: uploaded.id }),
        });
      }
      // Refresh case detail
      const fresh = await api(`/api/v1/admin/compliance/${caseId}`);
      setSelectedCase(fresh);
      setCaseEdit(fresh);
      fetchCompliance();
    } catch (err) { alert('Fout bij uploaden: ' + err.message); }
    finally { setUploading(false); }
  }

  async function createCase() {
    if (!createForm.lead_id || !createForm.title.trim()) return;
    setCreating(true);
    try {
      const result = await api('/api/v1/admin/compliance', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: createForm.lead_id,
          title: createForm.title,
          description: createForm.description,
          priority: createForm.priority,
          broker: createForm.broker,
        }),
      });
      // Upload pending files
      if (pendingFiles.length > 0) {
        setCreateUploading(true);
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          const uploadRes = await fetch(`/api/v1/documents/upload?lead_id=${createForm.lead_id}&category=compliance`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` },
            body: fd,
          });
          if (uploadRes.ok) {
            const uploaded = await uploadRes.json();
            await api(`/api/v1/leads/${createForm.lead_id}/compliance/${result.id}/documents`, {
              method: 'POST',
              body: JSON.stringify({ document_id: uploaded.id }),
            });
          }
        }
        setCreateUploading(false);
      }
      setShowCreate(false);
      setCreateForm({ lead_id: null, lead_name: '', title: '', description: '', priority: 'normal', broker: null });
      setPendingFiles([]);
      setClientSearch('');
      fetchCompliance();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setCreating(false); setCreateUploading(false); }
  }

  const filteredClients = clients.filter(c =>
    (c.company_name || '').toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 8);

  const brokerLabel = (key) => BROKERS.find(b => b.key === key)?.label || key;

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div /> {/* Spacer */}
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all"
          style={{ backgroundColor: '#3d61a4' }}>
          <Plus size={16} /> Nieuwe Ticket
        </button>
      </div>

      {/* Status summary */}
      {data?.counts && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'open', icon: AlertTriangle, count: data.counts.open },
            { key: 'in_progress', icon: Clock, count: data.counts.in_progress },
            { key: 'resolved', icon: CheckCircle2, count: data.counts.resolved },
            { key: 'closed', icon: Shield, count: data.counts.closed },
          ].map(item => {
            const sc = STATUS_COLORS[item.key];
            return (
              <div key={item.key}
                onClick={() => setStatusFilter(statusFilter === item.key ? 'all' : item.key)}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm ${
                  statusFilter === item.key ? 'border-[#3d61a4] ring-1 ring-[#3d61a4]/20' : 'border-[#e8eaf2]'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <item.icon size={16} style={{ color: sc.text }} />
                  <span className="text-xs font-semibold" style={{ color: sc.text }}>{sc.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: '#011745' }}>{item.count}</p>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={20} /><span className="text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
        </div>
      ) : data?.cases?.length > 0 ? (
        <div className="bg-white rounded-xl border border-[#e8eaf2] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#f7f8fc' }}>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Case</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Klant</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Broker</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Prioriteit</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Aangemaakt</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Door</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Docs</th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map(c => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open;
                const pc = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.normal;
                return (
                  <tr key={c.id}
                    onClick={() => openCase(c)}
                    className="border-t border-[#f3f4f8] hover:bg-[#eef2fa] transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#011745' }}>{c.title}</p>
                        {c.description && (
                          <p className="text-xs mt-0.5 truncate max-w-[220px]" style={{ color: '#7b859e' }}>{c.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#011745' }}>
                          {(c.company_name || '?').charAt(0)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: '#011745' }}>{c.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.broker ? (
                        <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
                          style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>{brokerLabel(c.broker)}</span>
                      ) : <span className="text-xs" style={{ color: '#cdd1e0' }}>—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
                        style={{ backgroundColor: pc.bg, color: pc.text }}>{pc.label}</span>
                    </td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <select value={c.status}
                        onChange={e => { e.stopPropagation(); api(`/api/v1/admin/compliance/${c.id}`, { method: 'PUT', body: JSON.stringify({ status: e.target.value }) }).then(fetchCompliance); }}
                        className="text-[10px] font-semibold px-2 py-1 rounded-full border-0 cursor-pointer"
                        style={{ backgroundColor: sc.bg, color: sc.text }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Behandeling</option>
                        <option value="waiting_response">Wacht op reactie</option>
                        <option value="with_broker">Met broker</option>
                        <option value="resolved">Opgelost</option>
                        <option value="closed">Gesloten</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs" style={{ color: '#7b859e' }}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs" style={{ color: '#7b859e' }}>{c.created_by_name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {c.document_count > 0 ? (
                        <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#3d61a4' }}>
                          <FileText size={12} /> {c.document_count}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#a4abbe' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-[#e8eaf2]">
          <Shield size={40} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
          <p className="font-semibold" style={{ color: '#011745' }}>Geen compliance cases</p>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>Maak een nieuwe ticket aan of cases worden aangemaakt vanuit de klantpagina</p>
        </div>
      )}

      {/* ═══ SLIDE-IN CASE DETAIL PANEL ═══ */}
      {selectedCase && caseEdit && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedCase(null)} />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            style={{ borderLeft: '1px solid #e8eaf2' }}>

            {/* Header */}
            <div className="px-6 pt-4 pb-0 border-b border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-semibold mb-0.5" style={{ color: '#a4abbe' }}>
                    {selectedCase.company_name}
                  </p>
                  <h3 className="text-base font-bold truncate" style={{ color: '#011745' }}>{selectedCase.title}</h3>
                </div>
                <button onClick={() => setSelectedCase(null)}
                  className="ml-3 p-2 rounded-lg hover:bg-[#e8eaf2] transition-colors flex-shrink-0">
                  <X size={18} style={{ color: '#566079' }} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                {[
                  { key: 'details', label: 'Details' },
                  { key: 'correspondentie', label: 'Correspondentie', badge: selectedCase.gmail_thread_id ? null : null },
                ].map(tab => (
                  <button key={tab.key}
                    onClick={() => {
                      setDetailTab(tab.key);
                      if (tab.key === 'correspondentie' && thread.length === 0) {
                        fetchThread(selectedCase.id);
                      }
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                      detailTab === tab.key
                        ? 'border-[#3d61a4] text-[#3d61a4] bg-white'
                        : 'border-transparent text-[#7b859e] hover:text-[#566079]'
                    }`}>
                    {tab.label}
                    {tab.key === 'correspondentie' && selectedCase.gmail_thread_id && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                        style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                        <Mail size={9} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab: Details ── */}
            {detailTab === 'details' && (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Titel</label>
                    <input type="text" value={caseEdit.title}
                      onChange={e => setCaseEdit({ ...caseEdit, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                      style={{ color: '#011745' }} />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Omschrijving</label>
                    <textarea value={caseEdit.description || ''}
                      onChange={e => setCaseEdit({ ...caseEdit, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                      style={{ color: '#011745' }} />
                  </div>

                  {/* Status + Priority row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Status</label>
                      <select value={caseEdit.status}
                        onChange={e => setCaseEdit({ ...caseEdit, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                        style={{ color: '#011745' }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Behandeling</option>
                        <option value="waiting_response">Wacht op reactie</option>
                        <option value="with_broker">Met broker</option>
                        <option value="resolved">Opgelost</option>
                        <option value="closed">Gesloten</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Prioriteit</label>
                      <select value={caseEdit.priority}
                        onChange={e => setCaseEdit({ ...caseEdit, priority: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                        style={{ color: '#011745' }}>
                        <option value="low">Laag</option>
                        <option value="normal">Normaal</option>
                        <option value="high">Hoog</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Broker */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Broker / Kanaal</label>
                    <BrokerPicker value={caseEdit.broker} onChange={v => setCaseEdit({ ...caseEdit, broker: v })} />
                  </div>

                  {/* Resolution notes */}
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Oplossingsnotities</label>
                    <textarea value={caseEdit.resolution_notes || ''}
                      onChange={e => setCaseEdit({ ...caseEdit, resolution_notes: e.target.value })}
                      rows={2}
                      placeholder="Noteer hoe de case is opgelost..."
                      className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                      style={{ color: '#011745' }} />
                  </div>

                  {/* Documents */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Documenten</label>
                    <DropZone onFiles={files => uploadToCase(selectedCase.id, selectedCase.lead_id, files)} uploading={uploading} />
                    {selectedCase.documents?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedCase.documents.map(doc => (
                          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#e8eaf2]"
                            style={{ backgroundColor: '#f7f8fc' }}>
                            <FileText size={14} style={{ color: '#3d61a4' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: '#011745' }}>{doc.original_filename}</p>
                              <p className="text-[10px]" style={{ color: '#a4abbe' }}>
                                {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                                {doc.created_at && <> · {new Date(doc.created_at).toLocaleDateString('nl-NL')}</>}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Meta info */}
                  <div className="pt-2 border-t border-[#f3f4f8]">
                    <div className="flex items-center justify-between text-xs" style={{ color: '#a4abbe' }}>
                      <span>Aangemaakt door: <span className="font-medium">{selectedCase.created_by_name || '—'}</span></span>
                      <span>{selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleDateString('nl-NL') : '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer — details tab */}
                <div className="px-6 py-4 border-t border-[#e8eaf2] flex items-center justify-between gap-3"
                  style={{ backgroundColor: '#f7f8fc' }}>
                  <button onClick={deleteCase} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}>
                    <Trash2 size={14} /> Verwijder
                  </button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedCase(null)}
                      className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#7b859e' }}>
                      Annuleer
                    </button>
                    <button onClick={saveCase} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                      style={{ backgroundColor: '#3d61a4' }}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Opslaan
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: Correspondentie ── */}
            {detailTab === 'correspondentie' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={28} className="animate-spin" style={{ color: '#3d61a4' }} />
                    </div>
                  ) : !selectedCase.gmail_thread_id ? (
                    <div className="text-center py-12">
                      <Mail size={36} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
                      <p className="text-sm font-semibold" style={{ color: '#566079' }}>Geen e-mailthread gekoppeld</p>
                      <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>
                        Deze case heeft geen Gmail thread ID. Koppel eerst een e-mail via de Compliance Inbox.
                      </p>
                    </div>
                  ) : thread.length === 0 ? (
                    <div className="text-center py-12">
                      <Mail size={36} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
                      <p className="text-sm font-semibold" style={{ color: '#566079' }}>Geen e-mails gevonden</p>
                      <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>De thread bevat nog geen gesynchroniseerde e-mails.</p>
                    </div>
                  ) : (
                    thread.map(email => <EmailThreadCard key={email.id} email={email} />)
                  )}
                </div>

                {/* Reply composer */}
                {selectedCase.gmail_thread_id && (
                  <div className="border-t border-[#e8eaf2] p-4 space-y-3" style={{ backgroundColor: '#f7f8fc' }}>
                    <div>
                      <label className="text-[10px] uppercase font-semibold block mb-1" style={{ color: '#a4abbe' }}>Antwoord naar</label>
                      <input type="email" value={replyTo}
                        onChange={e => setReplyTo(e.target.value)}
                        placeholder="email@voorbeeld.com"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4]"
                        style={{ color: '#011745' }} />
                    </div>
                    <div>
                      <textarea value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={4}
                        placeholder="Typ uw antwoord..."
                        className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                        style={{ color: '#011745', backgroundColor: '#fff' }} />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={sendReply}
                        disabled={replySending || !replyText.trim() || !replyTo.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
                        style={{ backgroundColor: '#3d61a4' }}>
                        {replySending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        Versturen
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ═══ CREATE TICKET MODAL ═══ */}
      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaf2] sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold" style={{ color: '#011745' }}>Nieuwe Compliance Ticket</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-[#f3f4f8] transition-colors">
                <X size={18} style={{ color: '#566079' }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Client selector */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Klant *</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
                  <input type="text" placeholder="Zoek klant..."
                    value={createForm.lead_id ? createForm.lead_name : clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setCreateForm({ ...createForm, lead_id: null, lead_name: '' });
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                    style={{ color: '#011745' }} />
                </div>
                {!createForm.lead_id && clientSearch && filteredClients.length > 0 && (
                  <div className="mt-1 border border-[#e8eaf2] rounded-lg overflow-hidden shadow-sm">
                    {filteredClients.map(cl => (
                      <button key={cl.id} type="button"
                        onClick={() => {
                          setCreateForm({ ...createForm, lead_id: cl.id, lead_name: cl.company_name });
                          setClientSearch('');
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#eef2fa] transition-colors border-b border-[#f3f4f8] last:border-0 flex items-center gap-2">
                        <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: '#011745' }}>
                          {(cl.company_name || '?').charAt(0)}
                        </div>
                        <span style={{ color: '#011745' }}>{cl.company_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {createForm.lead_id && (
                  <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#eef2fa' }}>
                    <CheckCircle2 size={14} style={{ color: '#3d61a4' }} />
                    <span className="text-sm font-medium" style={{ color: '#3d61a4' }}>{createForm.lead_name}</span>
                    <button onClick={() => setCreateForm({ ...createForm, lead_id: null, lead_name: '' })}
                      className="ml-auto text-xs" style={{ color: '#a4abbe' }}>✕</button>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Titel *</label>
                <input type="text" value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Korte omschrijving van het verzoek..."
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Notities / Verzoek</label>
                <textarea value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  placeholder="Gedetailleerde beschrijving..."
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                  style={{ color: '#011745' }} />
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Prioriteit</label>
                <select value={createForm.priority}
                  onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }}>
                  <option value="low">Laag</option>
                  <option value="normal">Normaal</option>
                  <option value="high">Hoog</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Broker */}
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Broker / Kanaal</label>
                <BrokerPicker value={createForm.broker} onChange={v => setCreateForm({ ...createForm, broker: v })} />
              </div>

              {/* Document drop zone */}
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Documenten toevoegen</label>
                <DropZone onFiles={files => setPendingFiles(prev => [...prev, ...files])} uploading={createUploading} />
                {pendingFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ backgroundColor: '#f7f8fc', border: '1px solid #e8eaf2' }}>
                        <FileText size={12} style={{ color: '#3d61a4' }} />
                        <span className="text-xs flex-1 truncate" style={{ color: '#566079' }}>{f.name}</span>
                        <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-xs" style={{ color: '#a4abbe' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8eaf2] flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#7b859e' }}>
                Annuleer
              </button>
              <button onClick={createCase}
                disabled={creating || !createForm.lead_id || !createForm.title.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#3d61a4' }}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Aanmaken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MAIN: Admin Page with Tabs
   ═══════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { key: 'users', label: 'Gebruikers', icon: Users },
    { key: 'requirements', label: 'Onboarding Vereisten', icon: ClipboardCheck },
    { key: 'pnl', label: 'P&L Management', icon: DollarSign },
    { key: 'compliance', label: 'Compliance', icon: Shield },
    { key: 'compliance_inbox', label: 'Compliance Inbox', icon: Mail },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#f7f8fc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8eaf2] px-8 py-5">
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#011745' }}>Admin</h1>
        <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                }`}
                style={{ color: activeTab === tab.key ? '#3d61a4' : '#7b859e' }}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'requirements' && <RequirementsTab />}
        {activeTab === 'pnl' && <PnLTab />}
        {activeTab === 'compliance' && <ComplianceTab />}
        {activeTab === 'compliance_inbox' && <ComplianceInboxTab />}
      </div>
    </div>
  );
}
