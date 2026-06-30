import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users, Phone, TrendingUp, Target, Activity, AlertCircle, CheckCircle2,
  X, RefreshCw, Loader2, Clock, Building2, ArrowRight, Plus, Trash2,
  ChevronDown, ChevronUp, Settings, UserCircle, BarChart3, Edit3, Save
} from 'lucide-react';

const token = () => sessionStorage.getItem('auth_token');

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ─── Detail Modal ─── */
const DetailModal = ({ isOpen, onClose, title, children, wide }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-popup ${wide ? 'max-w-4xl' : 'max-w-2xl'} w-full max-h-[80vh] overflow-hidden flex flex-col`}>
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#e8eaf2]" style={{ backgroundColor: '#011745' }}>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white rounded-lg p-2 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
};

/* ─── Target Type Labels ─── */
const TARGET_TYPE_LABELS = {
  calls_per_week: 'Calls per week',
  conversions: 'Conversies',
  pipeline_value: 'Pipeline waarde',
  leads_called: 'Leads gebeld',
  clients_won: 'Clients gewonnen',
  revenue: 'Omzet',
};

const TARGET_TYPES = [
  { value: 'calls_per_week', label: 'Calls per week' },
  { value: 'conversions', label: 'Conversies' },
  { value: 'pipeline_value', label: 'Pipeline waarde' },
  { value: 'leads_called', label: 'Leads gebeld' },
  { value: 'clients_won', label: 'Clients gewonnen' },
  { value: 'revenue', label: 'Omzet' },
];

const PERIOD_LABELS = { daily: 'Dagelijks', weekly: 'Wekelijks', monthly: 'Maandelijks' };
const PERIODS = [
  { value: 'daily', label: 'Dagelijks' },
  { value: 'weekly', label: 'Wekelijks' },
  { value: 'monthly', label: 'Maandelijks' },
];

/* ─── Admin Targets Tab ─── */
const AdminTargetsTab = ({ isAdmin }) => {
  const [salesUsers, setSalesUsers] = useState([]);
  const [allTargets, setAllTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ user_id: '', target_type: 'calls_per_week', target_value: '', period: 'weekly' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, targetsRes] = await Promise.allSettled([
        api('/api/v1/dashboard/sales-users'),
        api('/api/v1/dashboard/targets/all'),
      ]);
      if (usersRes.status === 'fulfilled') setSalesUsers(usersRes.value.users || []);
      if (targetsRes.status === 'fulfilled') setAllTargets(targetsRes.value.targets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.target_value) return;
    setSaving(true);
    try {
      await api('/api/v1/dashboard/targets', {
        method: 'POST',
        body: JSON.stringify({
          user_id: form.user_id ? parseInt(form.user_id) : null,
          target_type: form.target_type,
          target_value: parseInt(form.target_value),
          period: form.period,
        }),
      });
      setShowForm(false);
      setForm({ user_id: '', target_type: 'calls_per_week', target_value: '', period: 'weekly' });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api(`/api/v1/dashboard/targets/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isAdmin) return null;
  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: '#3d61a4' }} /></div>;

  const activeTargets = allTargets.filter(t => t.is_active);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e8eaf2]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#011745' }}>
          <Settings size={20} /> Targets Beheer
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: '#3d61a4' }}
        >
          <Plus size={16} /> Nieuwe Target
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 p-4 rounded-xl border border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#566079' }}>Medewerker</label>
              <select
                value={form.user_id}
                onChange={e => setForm({ ...form, user_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm"
              >
                <option value="">Team-breed</option>
                {salesUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#566079' }}>Type</label>
              <select
                value={form.target_type}
                onChange={e => setForm({ ...form, target_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm"
              >
                {TARGET_TYPES.map(tt => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#566079' }}>Doelwaarde</label>
              <input
                type="number"
                value={form.target_value}
                onChange={e => setForm({ ...form, target_value: e.target.value })}
                placeholder="bijv. 50"
                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#566079' }}>Periode</label>
              <select
                value={form.period}
                onChange={e => setForm({ ...form, period: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm"
              >
                {PERIODS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-[#cdd1e0]" style={{ color: '#566079' }}>
              Annuleren
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.target_value}
              className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: '#011745' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Opslaan'}
            </button>
          </div>
        </div>
      )}

      {/* Targets table */}
      {activeTargets.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: '#a4abbe' }}>Nog geen targets ingesteld</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8eaf2]">
                <th className="text-left py-3 px-2 font-semibold" style={{ color: '#566079' }}>Medewerker</th>
                <th className="text-left py-3 px-2 font-semibold" style={{ color: '#566079' }}>Type</th>
                <th className="text-left py-3 px-2 font-semibold" style={{ color: '#566079' }}>Doel</th>
                <th className="text-left py-3 px-2 font-semibold" style={{ color: '#566079' }}>Periode</th>
                <th className="text-right py-3 px-2 font-semibold" style={{ color: '#566079' }}></th>
              </tr>
            </thead>
            <tbody>
              {activeTargets.map(t => (
                <tr key={t.id} className="border-b border-[#f3f4f8] hover:bg-[#f7f8fc]">
                  <td className="py-3 px-2 font-medium" style={{ color: '#011745' }}>
                    {t.user_name}
                  </td>
                  <td className="py-3 px-2" style={{ color: '#566079' }}>
                    {TARGET_TYPE_LABELS[t.target_type] || t.target_type}
                  </td>
                  <td className="py-3 px-2 font-bold" style={{ color: '#3d61a4' }}>
                    {t.target_value}
                  </td>
                  <td className="py-3 px-2" style={{ color: '#7b859e' }}>
                    {PERIOD_LABELS[t.period] || t.period}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


/* ─── Team Breakdown Modal ─── */
const TeamBreakdownContent = () => {
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api('/api/v1/dashboard/targets/team-breakdown').then(res => {
      setBreakdown(res.breakdown || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: '#3d61a4' }} /></div>;

  if (breakdown.length === 0) return <p className="text-center py-8" style={{ color: '#a4abbe' }}>Geen sales medewerkers gevonden</p>;

  return (
    <div className="space-y-3">
      {breakdown.map(user => (
        <div key={user.user_id} className="border border-[#e8eaf2] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === user.user_id ? null : user.user_id)}
            className="w-full p-4 flex items-center justify-between hover:bg-[#f7f8fc] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#3d61a4' }}>
                {user.user_name.charAt(0)}
              </div>
              <span className="font-semibold" style={{ color: '#011745' }}>{user.user_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                {user.targets.length} targets
              </span>
              {expanded === user.user_id ? <ChevronUp size={16} style={{ color: '#7b859e' }} /> : <ChevronDown size={16} style={{ color: '#7b859e' }} />}
            </div>
          </button>
          {expanded === user.user_id && (
            <div className="px-4 pb-4 space-y-3">
              {user.targets.length === 0 ? (
                <p className="text-xs" style={{ color: '#a4abbe' }}>Geen targets</p>
              ) : (
                user.targets.map(t => (
                  <div key={t.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: '#566079' }}>
                        {TARGET_TYPE_LABELS[t.target_type] || t.target_type}
                      </span>
                      <span className="text-sm font-bold" style={{ color: t.percentage >= 100 ? '#22c55e' : '#3d61a4' }}>
                        {t.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-[#f3f4f8] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(t.percentage, 100)}%`, backgroundColor: t.percentage >= 100 ? '#22c55e' : '#3d61a4' }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>{t.progress}/{t.target_value} • {PERIOD_LABELS[t.period] || t.period}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};


/* ─── Main Dashboard ─── */
const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeModal, setActiveModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, targets (admin only)

  // Real data state
  const [kpis, setKpis] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [activities, setActivities] = useState([]);
  const [targets, setTargets] = useState([]);
  const [dailyList, setDailyList] = useState([]);
  const [callbacks, setCallbacks] = useState([]);

  const isAdmin = user?.role === 'admin_pay' || user?.role === 'admin_trade';
  const isTeamleader = user?.is_teamleader || user?.role === 'teamleader';
  const isLeadership = isAdmin || isTeamleader;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, pipeRes, actRes, targetRes, dailyRes, cbRes] = await Promise.allSettled([
        api('/api/v1/dashboard/kpis?period=today'),
        api('/api/v1/dashboard/pipeline'),
        api('/api/v1/dashboard/activity-feed?page_size=10'),
        api('/api/v1/dashboard/targets'),
        api('/api/v1/dashboard/my-daily-list'),
        api('/api/v1/callbacks/?today_only=true'),
      ]);
      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value);
      if (pipeRes.status === 'fulfilled') setPipeline(pipeRes.value.pipeline || []);
      if (actRes.status === 'fulfilled') setActivities(actRes.value.activities || []);
      if (targetRes.status === 'fulfilled') setTargets(targetRes.value.targets || []);
      if (dailyRes.status === 'fulfilled') setDailyList(dailyRes.value.calls || []);
      if (cbRes.status === 'fulfilled') setCallbacks(cbRes.value.callbacks || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derive KPI cards from real data
  const totalPipeline = pipeline.reduce((sum, s) => sum + s.count, 0);
  const kpiCards = [
    {
      title: isLeadership ? 'Totaal Leads' : 'Mijn Leads',
      value: kpis?.leads_assigned ?? '—',
      icon: Users,
      bg: '#3d61a4',
      detail: `${kpis?.by_stage?.lead ?? 0} in lead fase`,
      action: () => navigate('/leads'),
    },
    {
      title: isLeadership ? 'Calls Team' : 'Mijn Calls',
      value: kpis?.calls ?? '—',
      icon: Phone,
      bg: '#5a7fc2',
      detail: `${kpis?.contacted ?? 0} contacten bereikt`,
      action: () => setActiveModal('calls'),
    },
    {
      title: isLeadership ? 'Pipeline Team' : 'Mijn Pipeline',
      value: totalPipeline,
      icon: TrendingUp,
      bg: '#0a2d6b',
      detail: `${pipeline.length} fases`,
      action: () => setActiveModal('pipeline'),
    },
    {
      title: 'Conversieratio',
      value: kpis?.conversion_rate != null ? `${kpis.conversion_rate}%` : '—',
      icon: Target,
      bg: '#011745',
      detail: `${kpis?.converted ?? 0} van ${kpis?.contacted ?? 0} geconverteerd`,
      action: () => setActiveModal('conversion'),
    },
  ];

  const stageLabels = {
    lead: 'Leads',
    prospect: 'Prospects',
    onboarding_sales: 'Onboarding Sales',
    onboarding_backoffice: 'Onboarding Backoffice',
    client: 'Clients',
  };

  const actionLabels = {
    created_lead: 'Lead aangemaakt',
    updated: 'Bijgewerkt',
    created_callback: 'Callback ingepland',
    completed_callback: 'Callback afgerond',
    moved_to_prospect: 'Naar Prospect verplaatst',
    moved_to_onboarding: 'Naar Onboarding verplaatst',
    activated_taperpay: 'TaperPay geactiveerd',
    activated_tapertrade: 'TaperTrade geactiveerd',
    called: 'Gebeld',
    locked: 'Vergrendeld',
    unlocked: 'Ontgrendeld',
    snoozed: 'Gesnoozed',
  };

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Zojuist';
    if (mins < 60) return `${mins} min geleden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} uur geleden`;
    return `${Math.floor(hours / 24)} dagen geleden`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-2">
      {/* Welcome + Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#011745', fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
            Goedemorgen, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>
            {isLeadership ? 'Team dashboard overzicht' : 'Jouw persoonlijk dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex rounded-lg border border-[#e8eaf2] overflow-hidden mr-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'overview' ? 'text-white' : ''}`}
                style={activeTab === 'overview' ? { backgroundColor: '#011745', color: 'white' } : { color: '#566079' }}
              >
                <BarChart3 size={14} className="inline mr-1.5" style={{ marginTop: '-2px' }} />
                Overzicht
              </button>
              <button
                onClick={() => setActiveTab('targets')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'targets' ? 'text-white' : ''}`}
                style={activeTab === 'targets' ? { backgroundColor: '#011745', color: 'white' } : { color: '#566079' }}
              >
                <Settings size={14} className="inline mr-1.5" style={{ marginTop: '-2px' }} />
                Targets Beheer
              </button>
            </div>
          )}
          <button onClick={fetchAll} className="p-2.5 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }}>
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Admin Targets Tab */}
      {activeTab === 'targets' && isAdmin ? (
        <AdminTargetsTab isAdmin={isAdmin} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiCards.map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <div key={idx} onClick={kpi.action}
                  className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all border border-[#e8eaf2] cursor-pointer hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl text-white" style={{ backgroundColor: kpi.bg }}>
                      <Icon size={24} />
                    </div>
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#7b859e' }}>{kpi.title}</p>
                  <p className="text-3xl font-bold mb-2" style={{ color: '#011745', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {kpi.value}
                  </p>
                  <p className="text-xs font-medium" style={{ color: '#3d61a4' }}>{kpi.detail}</p>
                </div>
              );
            })}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline Funnel */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-[#e8eaf2]">
              <h2 className="text-xl font-bold mb-6" style={{ color: '#011745' }}>Sales Funnel</h2>
              {pipeline.length === 0 ? (
                <p className="text-sm" style={{ color: '#7b859e' }}>Geen pipeline data beschikbaar</p>
              ) : (
                <div className="space-y-4">
                  {pipeline.map((item, idx) => {
                    const maxCount = Math.max(...pipeline.map(p => p.count), 1);
                    const pct = Math.round((item.count / maxCount) * 100);
                    const colors = ['#3d61a4', '#5a7fc2', '#0a2d6b', '#011745', '#7b859e'];
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm" style={{ color: '#566079' }}>
                            {stageLabels[item.stage] || item.stage}
                          </span>
                          <span className="text-sm font-bold" style={{ color: '#3d61a4' }}>
                            {item.count}
                          </span>
                        </div>
                        <div className="w-full bg-[#f3f4f8] rounded-full h-3 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: colors[idx % colors.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Callbacks + Daily List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e8eaf2]">
              <h2 className="text-xl font-bold mb-4" style={{ color: '#011745' }}>Vandaag</h2>

              {/* Callbacks */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#566079' }}>
                  <Clock size={14} /> Callbacks ({callbacks.length})
                </h3>
                {callbacks.length === 0 ? (
                  <p className="text-xs" style={{ color: '#a4abbe' }}>Geen callbacks vandaag</p>
                ) : (
                  <div className="space-y-2">
                    {callbacks.slice(0, 5).map(cb => (
                      <div key={cb.id} className="p-2.5 rounded-lg border border-[#e8eaf2] flex items-center gap-2">
                        <Phone size={12} style={{ color: '#3d61a4' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: '#011745' }}>
                            {cb.lead?.company_name || `Lead #${cb.lead_id}`}
                          </p>
                          <p className="text-[10px]" style={{ color: '#7b859e' }}>
                            {cb.scheduled_at ? new Date(cb.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily list */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#566079' }}>
                  <Users size={14} /> Bellijst ({dailyList.length})
                </h3>
                {dailyList.length === 0 ? (
                  <p className="text-xs" style={{ color: '#a4abbe' }}>Bellijst is leeg</p>
                ) : (
                  <div className="space-y-2">
                    {dailyList.slice(0, 5).map(item => (
                      <div key={item.id} className="p-2.5 rounded-lg border border-[#e8eaf2] flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.is_called ? 'bg-green-400' : 'bg-[#a4abbe]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: '#011745' }}>{item.company_name}</p>
                          <p className="text-[10px]" style={{ color: '#7b859e' }}>{item.contact_name}</p>
                        </div>
                        {item.contact_mobile && (
                          <a href={`tel:${item.contact_mobile}`} className="text-[10px] font-medium" style={{ color: '#3d61a4' }}>
                            <Phone size={11} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed + Targets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-[#e8eaf2]">
              <h2 className="text-xl font-bold mb-6" style={{ color: '#011745' }}>Recente Activiteiten</h2>
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle size={32} style={{ color: '#cdd1e0' }} className="mb-3" />
                  <p style={{ color: '#7b859e' }}>Geen recente activiteiten</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-3 pb-3 border-b border-[#f3f4f8] last:border-b-0">
                      <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: '#eef2fa' }}>
                        <Activity size={16} style={{ color: '#3d61a4' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#011745' }}>
                          {actionLabels[act.action] || act.action}
                          {act.lead && (
                            <span style={{ color: '#3d61a4' }}> — {act.lead.company_name}</span>
                          )}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#7b859e' }}>
                          {act.user_name} • {timeAgo(act.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Targets */}
            <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #011745, #3d61a4)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {isLeadership ? 'Team Targets' : 'Mijn Targets'}
                </h2>
                {isLeadership && (
                  <button
                    onClick={() => setActiveModal('team-breakdown')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    Breakdown
                  </button>
                )}
              </div>
              {targets.length === 0 ? (
                <p className="text-sm opacity-80">
                  {isAdmin ? 'Geen targets ingesteld. Ga naar Targets Beheer om targets in te stellen.' : 'Geen targets ingesteld.'}
                </p>
              ) : (
                <div className="space-y-6">
                  {targets.map((t, idx) => (
                    <div key={t.id || idx}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium opacity-90">
                          {TARGET_TYPE_LABELS[t.target_type] || t.target_type}
                        </span>
                        <span className="text-sm font-bold">{t.percentage}%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(t.percentage, 100)}%`, backgroundColor: t.percentage >= 100 ? '#22c55e' : 'white' }}
                        />
                      </div>
                      <p className="text-xs opacity-70 mt-1">
                        {t.progress}/{t.target_value} • {PERIOD_LABELS[t.period] || t.period}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Stats */}
              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="mb-4">
                  <p className="text-sm opacity-70 mb-1">Volgende Callback</p>
                  {callbacks.length > 0 ? (
                    <p className="text-sm font-semibold">
                      {new Date(callbacks[0].scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {callbacks[0].lead?.company_name || 'Onbekend'}
                    </p>
                  ) : (
                    <p className="text-sm opacity-60">Geen callbacks</p>
                  )}
                </div>
                <div>
                  <p className="text-sm opacity-70 mb-1">Bellijst Status</p>
                  <p className="text-sm font-semibold">
                    {dailyList.filter(d => d.is_called).length}/{dailyList.length} gebeld
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pipeline Detail Modal */}
      <DetailModal isOpen={activeModal === 'pipeline'} onClose={() => setActiveModal(null)} title="Pipeline Overzicht">
        <div className="space-y-6">
          {pipeline.map((item, idx) => (
            <div key={idx} className="border border-[#e8eaf2] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold" style={{ color: '#011745' }}>{stageLabels[item.stage] || item.stage}</h3>
                <span className="text-2xl font-bold" style={{ color: '#3d61a4' }}>{item.count}</span>
              </div>
            </div>
          ))}
          <div className="border-t border-[#e8eaf2] pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold" style={{ color: '#011745' }}>Totaal</h3>
              <span className="text-2xl font-bold" style={{ color: '#011745' }}>{totalPipeline}</span>
            </div>
          </div>
        </div>
      </DetailModal>

      {/* Conversion Modal */}
      <DetailModal isOpen={activeModal === 'conversion'} onClose={() => setActiveModal(null)} title="Conversie Details">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#eef2fa' }}>
              <p className="text-sm" style={{ color: '#7b859e' }}>Gecontacteerd</p>
              <p className="text-3xl font-bold" style={{ color: '#011745' }}>{kpis?.contacted ?? 0}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#eef2fa' }}>
              <p className="text-sm" style={{ color: '#7b859e' }}>Geconverteerd</p>
              <p className="text-3xl font-bold" style={{ color: '#3d61a4' }}>{kpis?.converted ?? 0}</p>
            </div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#011745' }}>
            <p className="text-sm text-white/70">Conversieratio</p>
            <p className="text-4xl font-bold text-white">{kpis?.conversion_rate ?? 0}%</p>
          </div>
        </div>
      </DetailModal>

      {/* Calls Modal */}
      <DetailModal isOpen={activeModal === 'calls'} onClose={() => setActiveModal(null)} title="Calls Vandaag">
        <div className="text-center py-8">
          <p className="text-5xl font-bold mb-2" style={{ color: '#3d61a4' }}>{kpis?.calls ?? 0}</p>
          <p className="text-sm" style={{ color: '#7b859e' }}>calls gemaakt vandaag</p>
          <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#eef2fa' }}>
            <p className="text-sm" style={{ color: '#566079' }}>
              {kpis?.contacted ?? 0} contacten bereikt van {kpis?.leads_assigned ?? 0} {isLeadership ? 'team leads' : 'leads'}
            </p>
          </div>
        </div>
      </DetailModal>

      {/* Team Breakdown Modal */}
      <DetailModal isOpen={activeModal === 'team-breakdown'} onClose={() => setActiveModal(null)} title="Team Targets Breakdown" wide>
        <TeamBreakdownContent />
      </DetailModal>
    </div>
  );
};

export default DashboardPage;
