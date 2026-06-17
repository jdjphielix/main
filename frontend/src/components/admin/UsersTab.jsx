import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Star, Loader2, AlertCircle, Trash2, ArrowRightLeft, X,
  UserCheck, UserX
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api, ROLE_LABELS, ROLE_COLORS } from './adminHelpers';

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

      {/* Dev: Test User Switcher */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="text-sm font-bold mb-3" style={{ color: '#92400e' }}>Test Login (dev only)</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Sales', email: 'sales.test@taperpay.com' },
            { label: 'Extern', email: 'extern.test@taperpay.com' },
            { label: 'Accountmanager', email: 'am.test@taperpay.com' },
            { label: 'Teamleider', email: 'teamleider.test@taperpay.com' },
          ].map(u => (
            <button key={u.email}
              onClick={async () => {
                const r = await fetch(`/api/v1/auth/dev/login?email=${u.email}`, { method: 'POST' });
                const d = await r.json();
                if (d.access_token) { sessionStorage.setItem('auth_token', d.access_token); window.location.reload(); }
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-amber-300 bg-white hover:bg-amber-100 transition-colors"
              style={{ color: '#92400e' }}>{u.label}
            </button>
          ))}
          <button
            onClick={async () => {
              const r = await fetch('/api/v1/auth/dev/login?email=jp@taperpay.com', { method: 'POST' });
              const d = await r.json();
              if (d.access_token) { sessionStorage.setItem('auth_token', d.access_token); window.location.reload(); }
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#3d61a4] bg-[#eef2fa] hover:bg-[#dce5f6]"
            style={{ color: '#3d61a4' }}>Terug als Joost
          </button>
        </div>
      </div>
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: Onboarding Vereisten
   ═══════════════════════════════════════════════════════════════ */

export default UsersTab;
