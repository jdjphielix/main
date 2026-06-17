import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Target, Settings, Loader2, RefreshCw, AlertCircle,
  TrendingUp, Building2, Plus, Trash2, Edit3, Check, X,
  BarChart2, Flame
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';

const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const TARGET_TYPE_LABELS = {
  calls_per_week: 'Calls per week',
  conversions: 'Conversies',
  pipeline_value: 'Pipeline waarde (€)',
  leads_called: 'Leads gebeld',
  clients_won: 'Clients gewonnen',
  revenue: 'Omzet (€)',
};

const TARGET_TYPES = Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const PERIODS = [
  { value: 'daily', label: 'Dagelijks' },
  { value: 'weekly', label: 'Wekelijks' },
  { value: 'monthly', label: 'Maandelijks' },
];



// ── Targets per gebruiker ────────────────────────────────────────────────────
function TargetsSection() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ target_type: 'calls_per_week', target_value: '', period: 'weekly' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Use /dashboard/sales-users — accessible to both admin and teamleader (not admin-only)
    api('/api/v1/dashboard/sales-users').then(d => {
      const salesUsers = d.users || [];
      setUsers(salesUsers);
      if (salesUsers.length > 0) setSelectedUser(salesUsers[0]);
    }).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setLoading(true);
    api(`/api/v1/dashboard/targets?user_id=${selectedUser.id}`)
      .then(d => setTargets(d.targets || []))
      .catch(() => setTargets([]))
      .finally(() => setLoading(false));
  }, [selectedUser?.id]);

  const handleAddTarget = async () => {
    if (!form.target_value || !selectedUser) return;
    setSaving(true);
    try {
      await api('/api/v1/dashboard/targets', {
        method: 'POST',
        body: JSON.stringify({ ...form, target_value: parseInt(form.target_value, 10), user_id: selectedUser.id }),
      });
      setShowAdd(false);
      setForm({ target_type: 'calls_per_week', target_value: '', period: 'weekly' });
      const d = await api(`/api/v1/dashboard/targets?user_id=${selectedUser.id}`);
      setTargets(d.targets || []);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteTarget = async (id) => {
    if (!window.confirm('Target verwijderen?')) return;
    try {
      await api(`/api/v1/dashboard/targets/${id}`, { method: 'DELETE' });
      setTargets(t => t.filter(x => x.id !== id));
    } catch (e) { setError(e.message); }
  };

  const handleManualAchievement = async (targetId, userId) => {
    try {
      await api(`/api/v1/dashboard/targets/${targetId}/achievement`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, amount: 1 }),
      });
      // Refresh targets to show updated progress
      const d = await api(`/api/v1/dashboard/targets?user_id=${selectedUser.id}`);
      setTargets(d.targets || []);
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-[#011745] flex items-center gap-2">
            <Target size={16} className="text-[#3d61a4]" /> Targets per medewerker
          </h2>
          <p className="text-xs text-[#7b859e] mt-0.5">Stel individuele doelstellingen in</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-[#3d61a4] hover:bg-[#0a2d6b] transition-colors">
          <Plus size={14}/> Nieuw target
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {/* User selector */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {users.map(u => (
          <button key={u.id} onClick={() => setSelectedUser(u)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
              selectedUser?.id === u.id ? 'bg-[#011745] text-white border-[#011745]' : 'bg-[#f7f8fc] text-[#566079] border-[#e8eaf2] hover:border-[#3d61a4]'
            }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedUser?.id === u.id ? 'bg-white/20' : 'bg-[#011745] text-white'}`}>
              {u.full_name?.charAt(0).toUpperCase()}
            </div>
            {u.full_name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-5 p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
          <p className="text-xs font-semibold text-[#566079] uppercase tracking-wider">
            Nieuw target voor {selectedUser?.full_name}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#a4abbe] mb-1">Type</label>
              <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4]">
                {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#a4abbe] mb-1">Periode</label>
              <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4]">
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#a4abbe] mb-1">Doelwaarde</label>
              <input type="number" min="0" value={form.target_value}
                onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
                placeholder="bv. 20"
                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddTarget} disabled={!form.target_value || saving}
              className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#0a2d6b] transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Target opslaan'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm hover:bg-[#cdd1e0] transition-colors">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Targets list */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-[#3d61a4]" /></div>
      ) : targets.length === 0 ? (
        <div className="text-center py-8 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2]">
          <Target size={28} className="mx-auto mb-2 text-[#cdd1e0]" />
          <p className="text-sm text-[#7b859e]">Geen targets ingesteld voor {selectedUser?.full_name}</p>
          <p className="text-xs text-[#a4abbe] mt-1">Klik op "+ Nieuw target" om er een toe te voegen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {targets.map(t => (
            <div key={t.id} className="flex items-center justify-between p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#3d61a4]/10 flex items-center justify-center">
                  <Target size={14} className="text-[#3d61a4]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#011745]">{TARGET_TYPE_LABELS[t.target_type] || t.target_type}</p>
                  <p className="text-xs text-[#7b859e]">{PERIODS.find(p => p.value === t.period)?.label || t.period}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-black text-[#3d61a4]">{t.target_value.toLocaleString('nl-NL')}</p>
                  {t.progress !== undefined && (
                    <p className="text-xs text-[#7b859e]">nu: {t.progress}</p>
                  )}
                </div>
                {t.progress !== undefined && (
                  <div className="w-16">
                    <div className="h-1.5 bg-[#e8eaf2] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3d61a4] rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((t.progress / t.target_value) * 100))}%` }} />
                    </div>
                    <p className="text-[10px] text-[#a4abbe] text-center mt-0.5">
                      {Math.min(100, Math.round((t.progress / t.target_value) * 100))}%
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleManualAchievement(t.id, selectedUser?.id)}
                  className="w-7 h-7 rounded-full bg-[#3d61a4] hover:bg-[#0a2d6b] text-white flex items-center justify-center text-sm font-bold transition-colors"
                  title="Registreer behaalde deal"
                >
                  +
                </button>
                <button onClick={() => handleDeleteTarget(t.id)}
                  className="p-1.5 text-[#cdd1e0] hover:text-red-400 transition-colors rounded-lg">
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mijn Team sectie ─────────────────────────────────────────────────────────
function fmt(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

const STAGE_CONFIG = [
  { key: 'leads_count',      label: 'Leads',      revKey: null,                color: '#3d61a4', bg: '#eef2fa' },
  { key: 'prospects_count',  label: 'Prospects',  revKey: 'pipeline_revenue',  color: '#92400e', bg: '#fef3c7' },
  { key: 'onboarding_count', label: 'Onboarding', revKey: 'onboarding_revenue',color: '#166534', bg: '#f0fdf4' },
  { key: 'clients_count',    label: 'Clients',    revKey: 'client_revenue',    color: '#011745', bg: '#f3f4f8' },
];

function MijnTeamSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    setLoading(true);
    api('/api/v1/users/my-team')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-8 flex justify-center">
      <Loader2 size={28} className="animate-spin text-[#3d61a4]" />
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6">
      <p className="text-sm text-red-500 flex items-center gap-2"><AlertCircle size={16}/> {error}</p>
    </div>
  );

  if (!data) return null;

  const { cumulative, members, total_members } = data;

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#011745] flex items-center gap-2">
            <Users size={16} className="text-[#3d61a4]" /> Mijn Team
          </h2>
          <p className="text-xs text-[#7b859e] mt-0.5">{total_members} medewerker{total_members !== 1 ? 's' : ''} · cumulatieve pipeline</p>
        </div>
        <button onClick={() => api('/api/v1/users/my-team').then(setData).catch(() => {})}
          className="p-2 rounded-lg hover:bg-[#f3f4f8] transition-colors text-[#a4abbe] hover:text-[#3d61a4]">
          <RefreshCw size={15}/>
        </button>
      </div>

      {total_members === 0 ? (
        <div className="text-center py-10 bg-[#f7f8fc] rounded-xl border border-dashed border-[#cdd1e0]">
          <Users size={32} className="mx-auto mb-2 text-[#cdd1e0]" />
          <p className="text-sm font-medium text-[#7b859e]">Nog geen teamleden toegewezen</p>
          <p className="text-xs text-[#a4abbe] mt-1">Wijs medewerkers toe via Admin → Gebruikers → kolom "Team van"</p>
        </div>
      ) : (
        <>
          {/* Cumulative stats grid */}
          <div className="grid grid-cols-4 gap-3">
            {STAGE_CONFIG.map(s => (
              <div key={s.key} className="rounded-xl p-4 border border-[#e8eaf2]" style={{ backgroundColor: s.bg }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: s.color }}>{s.label}</p>
                <p className="text-3xl font-black" style={{ color: s.color }}>{cumulative[s.key]}</p>
                {s.revKey && cumulative[s.revKey] > 0 && (
                  <p className="text-xs font-medium mt-1" style={{ color: s.color + 'aa' }}>
                    {fmt(cumulative[s.revKey])}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Revenue totals bar */}
          <div className="flex gap-4 p-3 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] text-xs">
            <div className="flex-1 text-center">
              <p className="text-[#a4abbe] mb-0.5">Pipeline rev.</p>
              <p className="font-bold text-[#92400e]">{fmt(cumulative.pipeline_revenue)}</p>
            </div>
            <div className="w-px bg-[#e8eaf2]"/>
            <div className="flex-1 text-center">
              <p className="text-[#a4abbe] mb-0.5">Onboarding rev.</p>
              <p className="font-bold text-[#166534]">{fmt(cumulative.onboarding_revenue)}</p>
            </div>
            <div className="w-px bg-[#e8eaf2]"/>
            <div className="flex-1 text-center">
              <p className="text-[#a4abbe] mb-0.5">Client rev.</p>
              <p className="font-bold text-[#011745]">{fmt(cumulative.client_revenue)}</p>
            </div>
            <div className="w-px bg-[#e8eaf2]"/>
            <div className="flex-1 text-center">
              <p className="text-[#a4abbe] mb-0.5">Calls totaal</p>
              <p className="font-bold text-[#3d61a4]">{cumulative.call_count}</p>
            </div>
          </div>

          {/* Per-user table */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#a4abbe]">Breakdown per medewerker</p>
            {members.map(m => {
              const isExpanded = expandedUser === m.id;
              return (
                <div key={m.id} className="border border-[#e8eaf2] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : m.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#f7f8fc] transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#3d61a4] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {m.full_name.charAt(0).toUpperCase()}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#011745] truncate">{m.full_name}</p>
                      <p className="text-xs text-[#7b859e]">{m.role} · {m.call_count} calls</p>
                    </div>
                    {/* Stage counts inline */}
                    <div className="flex gap-3 text-center">
                      {STAGE_CONFIG.map(s => (
                        <div key={s.key} className="min-w-[36px]">
                          <p className="text-[10px] font-medium" style={{ color: s.color }}>{s.label}</p>
                          <p className="text-base font-black" style={{ color: s.color }}>{m[s.key]}</p>
                        </div>
                      ))}
                    </div>
                    {/* Revenue summary */}
                    <div className="text-right min-w-[90px]">
                      <p className="text-[10px] text-[#a4abbe]">totale pipeline</p>
                      <p className="text-sm font-bold text-[#3d61a4]">
                        {fmt((m.pipeline_revenue||0) + (m.onboarding_revenue||0) + (m.client_revenue||0))}
                      </p>
                    </div>
                    <Check size={14} className={`transition-transform text-[#a4abbe] ${isExpanded ? 'rotate-180' : ''}`} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}/>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#e8eaf2] px-5 py-4 bg-[#f7f8fc] grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-[#a4abbe] mb-1">Pipeline revenue (prospects)</p>
                        <p className="font-bold text-[#92400e]">{fmt(m.pipeline_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#a4abbe] mb-1">Onboarding revenue</p>
                        <p className="font-bold text-[#166534]">{fmt(m.onboarding_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#a4abbe] mb-1">Client revenue (jaarlijks)</p>
                        <p className="font-bold text-[#011745]">{fmt(m.client_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#a4abbe] mb-1">Leads in pipeline</p>
                        <p className="font-bold text-[#3d61a4]">{m.leads_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#a4abbe] mb-1">Prospects</p>
                        <p className="font-bold text-[#3d61a4]">{m.prospects_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#a4abbe] mb-1">Onboarding</p>
                        <p className="font-bold text-[#3d61a4]">{m.onboarding_count}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Revenue Forecast Section ─────────────────────────────────────────────────
const fmtEur = (v) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

const FORECAST_STAGES = [
  { key: 'prospect_revenue',   label: 'Prospect',   color: '#92400e', bg: '#fef3c7', barColor: '#d97706' },
  { key: 'onboarding_revenue', label: 'Onboarding', color: '#166534', bg: '#f0fdf4', barColor: '#16a34a' },
  { key: 'client_revenue',     label: 'Client',     color: '#011745', bg: '#eef2fa', barColor: '#011745' },
];

function RevenueForecastSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api('/api/v1/users/team-revenue-forecast')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-8 flex justify-center">
      <Loader2 size={28} className="animate-spin text-[#3d61a4]" />
    </div>
  );
  if (error) return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6">
      <p className="text-sm text-red-500 flex items-center gap-2"><AlertCircle size={16}/> {error}</p>
    </div>
  );
  if (!data) return null;

  const { members, totals } = data;

  // Prepare recharts data
  const chartData = members.map(m => ({
    name: m.full_name.split(' ')[0],
    Prospect: m.prospect_revenue,
    Onboarding: m.onboarding_revenue,
    Client: m.client_revenue,
  }));

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#011745] flex items-center gap-2">
            <BarChart2 size={16} className="text-[#3d61a4]" /> Revenue Forecast
          </h2>
          <p className="text-xs text-[#7b859e] mt-0.5">
            Verwachte omzet per medewerker · FX + TF samen
          </p>
        </div>
        <button onClick={load}
          className="p-2 rounded-lg hover:bg-[#f3f4f8] transition-colors text-[#a4abbe] hover:text-[#3d61a4]">
          <RefreshCw size={15}/>
        </button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-10 bg-[#f7f8fc] rounded-xl border border-dashed border-[#cdd1e0]">
          <BarChart2 size={32} className="mx-auto mb-2 text-[#cdd1e0]" />
          <p className="text-sm font-medium text-[#7b859e]">Nog geen teamleden met revenue data</p>
          <p className="text-xs text-[#a4abbe] mt-1">Wijs medewerkers toe aan dit team om forecast te zien</p>
        </div>
      ) : (
        <>
          {/* Totals bar */}
          <div className="grid grid-cols-4 gap-3">
            {FORECAST_STAGES.map(s => (
              <div key={s.key} className="rounded-xl p-4 border border-[#e8eaf2]" style={{ backgroundColor: s.bg }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: s.color }}>{s.label}</p>
                <p className="text-xl font-black" style={{ color: s.color }}>{fmtEur(totals[s.key])}</p>
              </div>
            ))}
            <div className="rounded-xl p-4 border border-[#3d61a4] bg-[#eef2fa]">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-[#3d61a4]">Totaal</p>
              <p className="text-xl font-black text-[#011745]">{fmtEur(totals.total_revenue)}</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] p-4">
            <p className="text-xs font-semibold text-[#a4abbe] uppercase tracking-wider mb-4">
              Revenue per medewerker (gestapeld)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaf2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#566079' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => v >= 1000 ? `€${(v/1000).toFixed(0)}k` : `€${v}`}
                  tick={{ fontSize: 11, fill: '#a4abbe' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, name) => [fmtEur(value), name]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e8eaf2', fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Prospect"   stackId="a" fill="#d97706" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Onboarding" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Client"     stackId="a" fill="#011745" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-user table */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#a4abbe]">Detail per medewerker</p>
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#a4abbe]">
              <span>Naam</span>
              <span className="text-center w-16">Leads</span>
              <span className="text-center w-16">Prosp.</span>
              <span className="text-center w-16">Onb.</span>
              <span className="text-center w-16">Clients</span>
              <span className="text-right w-28">Pipeline rev.</span>
            </div>

            {members.map(m => (
              <div key={m.user_id} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2]">
                {/* Name + stage revenues */}
                <div>
                  <p className="text-sm font-semibold text-[#011745]">{m.full_name}</p>
                  <div className="flex gap-3 mt-0.5">
                    {FORECAST_STAGES.map(s => (
                      <span key={s.key} className="text-[10px] font-medium" style={{ color: s.color }}>
                        {s.label.slice(0,3)}: {fmtEur(m[s.key])}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-sm font-bold text-[#3d61a4] text-center w-16">{m.leads_count}</span>
                <span className="text-sm font-bold text-center w-16" style={{ color: '#92400e' }}>{m.prospects_count}</span>
                <span className="text-sm font-bold text-center w-16" style={{ color: '#166534' }}>{m.onboarding_count}</span>
                <span className="text-sm font-bold text-center w-16" style={{ color: '#011745' }}>{m.clients_count}</span>
                <span className="text-sm font-black text-right w-28" style={{ color: '#3d61a4' }}>{fmtEur(m.total_revenue)}</span>
              </div>
            ))}

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 bg-[#011745] rounded-xl">
              <div>
                <p className="text-sm font-bold text-white">Team totaal</p>
                <div className="flex gap-3 mt-0.5">
                  {FORECAST_STAGES.map(s => (
                    <span key={s.key} className="text-[10px] font-medium text-white/70">
                      {s.label.slice(0,3)}: {fmtEur(totals[s.key])}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-sm font-bold text-white text-center w-16">
                {members.reduce((acc, m) => acc + m.leads_count, 0)}
              </span>
              <span className="text-sm font-bold text-amber-300 text-center w-16">
                {members.reduce((acc, m) => acc + m.prospects_count, 0)}
              </span>
              <span className="text-sm font-bold text-green-300 text-center w-16">
                {members.reduce((acc, m) => acc + m.onboarding_count, 0)}
              </span>
              <span className="text-sm font-bold text-[#5a7fc2] text-center w-16">
                {members.reduce((acc, m) => acc + m.clients_count, 0)}
              </span>
              <span className="text-base font-black text-white text-right w-28">{fmtEur(totals.total_revenue)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Hot Prospects Section ────────────────────────────────────────────────────
function HotProspectsSection() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api('/api/v1/dashboard/hot-prospects')
      .then(d => setData(d.hot_prospects || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Sort by total_revenue desc
  const sorted = [...data].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));

  const totalFx = data.reduce((s, p) => s + (p.fx_estimated_revenue || 0), 0);
  const totalTf = data.reduce((s, p) => s + (p.tf_estimated_revenue || 0), 0);
  const totalAll = data.reduce((s, p) => s + (p.total_revenue || 0), 0);

  // Leeftijd kleur: < 7d groen, 7-21d oranje, > 21d rood
  function hotAgeColor(setAt) {
    if (!setAt) return '#a4abbe';
    const days = Math.floor((Date.now() - new Date(setAt).getTime()) / 86400000);
    if (days < 7) return '#166534';
    if (days <= 21) return '#d97706';
    return '#dc2626';
  }

  function hotAgeBg(setAt) {
    if (!setAt) return '#f3f4f8';
    const days = Math.floor((Date.now() - new Date(setAt).getTime()) / 86400000);
    if (days < 7) return '#f0fdf4';
    if (days <= 21) return '#fef3c7';
    return '#fef2f2';
  }

  function hotAgeLabel(setAt) {
    if (!setAt) return '—';
    const days = Math.floor((Date.now() - new Date(setAt).getTime()) / 86400000);
    if (days === 0) return 'Vandaag';
    if (days === 1) return '1 dag';
    return `${days} dagen`;
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-8 flex justify-center">
      <Loader2 size={28} className="animate-spin text-[#3d61a4]" />
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6">
      <p className="text-sm text-red-500 flex items-center gap-2"><AlertCircle size={16}/> {error}</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#011745] flex items-center gap-2">
            <Flame size={16} className="text-orange-500" /> Hot Prospects
          </h2>
          <p className="text-xs text-[#7b859e] mt-0.5">
            {data.length} hot prospect{data.length !== 1 ? 's' : ''} · gesorteerd op revenue
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); api('/api/v1/dashboard/hot-prospects').then(d => setData(d.hot_prospects || [])).catch(e => setError(e.message)).finally(() => setLoading(false)); }}
          className="p-2 rounded-lg hover:bg-[#f3f4f8] transition-colors text-[#a4abbe] hover:text-[#3d61a4]"
        >
          <RefreshCw size={15}/>
        </button>
      </div>

      {/* Total pipeline banner */}
      {data.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
          <Flame size={24} className="text-orange-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-0.5">Totale hot pipeline</p>
            <p className="text-2xl font-black text-orange-600">{fmtEur(totalAll)}</p>
          </div>
          <div className="text-right text-xs text-orange-600 space-y-0.5">
            <p>FX: <span className="font-bold">{fmtEur(totalFx)}</span></p>
            <p>TF: <span className="font-bold">{fmtEur(totalTf)}</span></p>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="text-center py-10 bg-[#f7f8fc] rounded-xl border border-dashed border-[#cdd1e0]">
          <Flame size={32} className="mx-auto mb-2 text-[#cdd1e0]" />
          <p className="text-sm font-medium text-[#7b859e]">Geen hot prospects</p>
          <p className="text-xs text-[#a4abbe] mt-1">Markeer prospects als hot via het vlamicoon in de prospects lijst</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#a4abbe]">
            <span>Bedrijf</span>
            <span>Sales owner</span>
            <span className="text-right">FX rev.</span>
            <span className="text-right">TF rev.</span>
            <span className="text-right">Totaal</span>
            <span className="text-right">Hot sinds</span>
          </div>

          {/* Rows */}
          {sorted.map(p => (
            <button
              key={p.id}
              onClick={() => navigate('/prospects')}
              className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 items-center px-4 py-3 bg-[#f7f8fc] hover:bg-[#eef2fa] rounded-xl border border-[#e8eaf2] hover:border-[#3d61a4] transition-all text-left"
            >
              <span className="text-sm font-semibold text-[#011745] truncate">{p.company_name}</span>
              <span className="text-xs text-[#566079] truncate">{p.sales_owner_name || '—'}</span>
              <span className="text-sm font-bold text-right text-[#3d61a4]">{fmtEur(p.fx_estimated_revenue)}</span>
              <span className="text-sm font-bold text-right" style={{ color: '#92400e' }}>{fmtEur(p.tf_estimated_revenue)}</span>
              <span className="text-sm font-black text-right text-[#011745]">{fmtEur(p.total_revenue)}</span>
              <span className="text-right">
                <span
                  className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: hotAgeColor(p.hot_prospect_set_at), backgroundColor: hotAgeBg(p.hot_prospect_set_at) }}
                >
                  {hotAgeLabel(p.hot_prospect_set_at)}
                </span>
              </span>
            </button>
          ))}

          {/* Totals row */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 items-center px-4 py-3 bg-[#011745] rounded-xl mt-2">
            <span className="text-sm font-bold text-white">Totaal ({data.length})</span>
            <span></span>
            <span className="text-sm font-bold text-right text-[#5a7fc2]">{fmtEur(totalFx)}</span>
            <span className="text-sm font-bold text-right text-amber-300">{fmtEur(totalTf)}</span>
            <span className="text-base font-black text-right text-white">{fmtEur(totalAll)}</span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'team',     label: 'Mijn Team',        icon: Users },
  { id: 'forecast', label: 'Revenue Forecast',  icon: BarChart2 },
  { id: 'hot',      label: 'Hot Prospects',     icon: Flame },
  { id: 'targets',  label: 'Targets',           icon: Target },
];

export default function TeamManagementPage() {
  const { user } = useAuth();
  const isAllowed = user?.is_teamleader || ['admin_pay','admin_trade'].includes(user?.role);
  const [activeTab, setActiveTab] = useState('team');

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="mx-auto text-[#cdd1e0]" />
          <p className="font-semibold text-[#011745]">Geen toegang</p>
          <p className="text-sm text-[#7b859e]">Deze pagina is alleen voor teamleaders en admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#011745]">Team Management</h1>
        <p className="text-sm text-[#7b859e] mt-0.5">Teamprestaties, hot prospects en targets</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#e8eaf2] shadow-sm p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? 'bg-[#011745] text-white shadow-sm'
                  : 'text-[#566079] hover:text-[#011745] hover:bg-[#f3f4f8]'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'team'     && <MijnTeamSection />}
      {activeTab === 'forecast' && <RevenueForecastSection />}
      {activeTab === 'hot'      && <HotProspectsSection />}
      {activeTab === 'targets'  && <TargetsSection />}
    </div>
  );
}
