import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, TrendingUp, Phone, Clock, Building2, Target, ClipboardCheck,
  Loader2, RefreshCw, AlertCircle, DollarSign, BarChart3,
  Trophy, Star, LayoutGrid, List, Flame
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';

const token = () => sessionStorage.getItem('auth_token');

async function api(path) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatCurrency(val) {
  if (!val) return '€ 0';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}u ${m}m`;
  return `${m}m`;
}

const RANK_CONFIG = [
  { medal: '🥇', bg: 'from-yellow-50 to-amber-50', border: 'border-amber-200', badge: 'bg-amber-400 text-white' },
  { medal: '🥈', bg: 'from-gray-50 to-slate-50',   border: 'border-slate-200', badge: 'bg-slate-400 text-white' },
  { medal: '🥉', bg: 'from-orange-50 to-red-50',   border: 'border-orange-200', badge: 'bg-orange-400 text-white' },
];

function detectFlashes(prev, next) {
  const flashes = {};
  if (!prev || !next) return flashes;
  const prevMap = Object.fromEntries(prev.map(u => [u.id, u]));
  for (const u of next) {
    const p = prevMap[u.id];
    if (!p) continue;
    const fields = ['call_count','leads_count','prospects_count','hot_prospects_count','onboarding_count','clients_count','score','pipeline_revenue','client_revenue'];
    for (const f of fields) {
      if ((u[f] || 0) > (p[f] || 0)) {
        if (!flashes[u.id]) flashes[u.id] = new Set();
        flashes[u.id].add(f);
      }
    }
  }
  return flashes;
}

function ScoreBar({ score, maxScore }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-[#e8eaf2] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3d61a4, #5a7fc2)' }} />
      </div>
      <span className="text-[10px] font-bold text-[#7b859e] w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Redesigned CardsView — Revenue domineert ──────────────────────────────────
function CardsView({ users, flashes, weights }) {
  const maxScore = Math.max(...users.map(u => u.score), 1);
  return (
    <div className="space-y-4">
      {users.map(u => {
        const rankCfg = RANK_CONFIG[u.rank - 1];
        const flashSet = flashes[u.id];
        const totalRevenue = (u.pipeline_revenue || 0) + (u.onboarding_revenue || 0) + (u.client_revenue || 0);

        return (
          <div key={u.id} className={`rounded-2xl border overflow-hidden shadow-sm bg-gradient-to-r ${rankCfg?.bg || 'from-white to-white'} ${rankCfg?.border || 'border-[#e8eaf2]'}`}>

            {/* ── Header: naam + score ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#f3f4f8]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-[#011745] flex items-center justify-center text-white font-bold text-sm">
                    {u.full_name?.charAt(0).toUpperCase()}
                  </div>
                  {u.rank <= 3 && <span className="absolute -top-1 -right-1 text-base leading-none">{rankCfg.medal}</span>}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#011745] text-sm">{u.full_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${rankCfg?.badge || 'bg-[#e8eaf2] text-[#566079]'}`}>#{u.rank}</span>
                  </div>
                  <p className="text-[11px] text-[#7b859e]">{u.email}</p>
                </div>
              </div>
              <div className="text-right min-w-28">
                <p className="text-[10px] text-[#7b859e] uppercase font-semibold">Score</p>
                <p className={`text-xl font-black transition-colors ${flashSet?.has('score') ? 'text-green-600' : 'text-[#3d61a4]'}`}>
                  {flashSet?.has('score') && <span className="text-green-500">↑</span>}
                  {u.score.toLocaleString('nl-NL')} <span className="text-xs font-normal">pts</span>
                </p>
                <ScoreBar score={u.score} maxScore={maxScore} />
              </div>
            </div>

            {/* ── REVENUE — grootste sectie ── */}
            <div className="px-5 py-4 border-b border-[#f3f4f8]" style={{ background: 'linear-gradient(135deg, #011745 0%, #0a2d6b 100%)' }}>
              <p className="text-[10px] uppercase font-bold text-[rgba(255,255,255,0.5)] tracking-wider mb-3">Revenue</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-[rgba(255,255,255,0.55)] uppercase font-semibold mb-1">Pipeline</p>
                  <p className={`text-2xl font-black ${flashSet?.has('pipeline_revenue') ? 'text-green-300' : 'text-white'}`}
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.5px' }}>
                    {flashSet?.has('pipeline_revenue') && <span className="text-green-400">↑</span>}
                    {formatCurrency(u.pipeline_revenue || 0)}
                  </p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.4)] mt-0.5">Prospect fase</p>
                </div>
                <div>
                  <p className="text-[10px] text-[rgba(255,255,255,0.55)] uppercase font-semibold mb-1">Onboarding</p>
                  <p className="text-2xl font-black text-[#5a7fc2]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.5px' }}>
                    {formatCurrency(u.onboarding_revenue || 0)}
                  </p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.4)] mt-0.5">In behandeling</p>
                </div>
                <div>
                  <p className="text-[10px] text-[rgba(255,255,255,0.55)] uppercase font-semibold mb-1">Client / jr</p>
                  <p className={`text-2xl font-black ${flashSet?.has('client_revenue') ? 'text-green-300' : 'text-[#7dd3a8]'}`}
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.5px' }}>
                    {flashSet?.has('client_revenue') && <span className="text-green-400">↑</span>}
                    {formatCurrency(u.client_revenue || 0)}
                  </p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.4)] mt-0.5">Actieve klanten</p>
                </div>
              </div>
              {/* Revenue bar */}
              {totalRevenue > 0 && (
                <div className="flex h-1.5 rounded-full overflow-hidden mt-4 gap-0.5">
                  {(u.pipeline_revenue||0) > 0    && <div style={{ flex: u.pipeline_revenue, background: '#3d61a4' }} className="rounded-l-full" />}
                  {(u.onboarding_revenue||0) > 0  && <div style={{ flex: u.onboarding_revenue, background: '#5a7fc2' }} />}
                  {(u.client_revenue||0) > 0      && <div style={{ flex: u.client_revenue, background: '#7dd3a8' }} className="rounded-r-full" />}
                </div>
              )}
            </div>

            {/* ── PROSPECTS — tweede prioriteit ── */}
            <div className="grid grid-cols-2 gap-0 border-b border-[#f3f4f8]">
              <div className={`px-5 py-3 border-r border-[#f3f4f8] ${flashSet?.has('hot_prospects_count') ? 'bg-red-50' : 'bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Flame size={13} color="#ef4444" />
                  <p className="text-[10px] uppercase font-semibold text-[#ef4444]">Hot Prospects</p>
                </div>
                <p className={`text-3xl font-black ${flashSet?.has('hot_prospects_count') ? 'text-red-600' : 'text-[#011745]'}`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {flashSet?.has('hot_prospects_count') && <span className="text-green-500">↑</span>}
                  {u.hot_prospects_count || 0}
                </p>
              </div>
              <div className={`px-5 py-3 ${flashSet?.has('prospects_count') ? 'bg-blue-50' : 'bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Target size={13} color="#3d61a4" />
                  <p className="text-[10px] uppercase font-semibold text-[#3d61a4]">Totaal Prospects</p>
                </div>
                <p className={`text-3xl font-black ${flashSet?.has('prospects_count') ? 'text-blue-600' : 'text-[#011745]'}`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {flashSet?.has('prospects_count') && <span className="text-green-500">↑</span>}
                  {u.prospects_count || 0}
                </p>
              </div>
            </div>

            {/* ── Secundaire stats — klein ── */}
            <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-[#f7f8fc]">
              <div className="text-center">
                <p className="text-[9px] uppercase font-semibold text-[#a4abbe] mb-0.5">Onboarding</p>
                <p className="text-base font-bold text-[#566079]">{u.onboarding_count || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase font-semibold text-[#a4abbe] mb-0.5">Clients</p>
                <p className="text-base font-bold text-[#566079]">{u.clients_count || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase font-semibold text-[#a4abbe] mb-0.5">Leads</p>
                <p className="text-base font-bold text-[#566079]">{u.leads_count || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase font-semibold text-[#a4abbe] mb-0.5">Calls / {formatDuration(u.total_call_duration_seconds)}</p>
                <p className="text-base font-bold text-[#566079]">{u.call_count || 0}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Bar chart view ────────────────────────────────────────────────────────────
function ChartView({ users }) {
  const [metric, setMetric] = useState('pipeline_revenue');
  const metrics = [
    { key: 'pipeline_revenue',  label: 'Pipeline Revenue',  color: '#3d61a4' },
    { key: 'client_revenue',    label: 'Client Rev./jr',    color: '#16a34a' },
    { key: 'onboarding_revenue',label: 'Onboarding Rev.',   color: '#f59e0b' },
    { key: 'hot_prospects_count',label:'Hot Prospects',     color: '#ef4444' },
    { key: 'prospects_count',   label: 'Prospects',         color: '#5a7fc2' },
    { key: 'score',             label: 'Score',             color: '#011745' },
    { key: 'call_count',        label: 'Calls',             color: '#566079' },
    { key: 'clients_count',     label: 'Clients',           color: '#0a2d6b' },
  ];
  const selected = metrics.find(m => m.key === metric);
  const isRevenue = metric.includes('revenue');
  const chartData = users.map(u => ({
    name: u.full_name.split(' ')[0],
    fullName: u.full_name,
    value: u[metric] || 0,
    rank: u.rank,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-[#e8eaf2] shadow-lg p-3 text-xs">
        <p className="font-bold text-[#011745] mb-1">{payload[0].payload.fullName}</p>
        <p className="text-[#3d61a4]">{selected.label}: <b>{isRevenue ? formatCurrency(payload[0].value) : payload[0].value.toLocaleString('nl-NL')}</b></p>
        <p className="text-[#7b859e]">Rank #{payload[0].payload.rank}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6">
      <div className="flex flex-wrap gap-2 mb-6">
        {metrics.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${metric === m.key ? 'text-white shadow-sm' : 'bg-[#f3f4f8] text-[#7b859e] hover:bg-[#e8eaf2]'}`}
            style={metric === m.key ? { backgroundColor: m.color } : {}}>
            {m.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} barSize={44}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f8" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#566079' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#a4abbe' }} axisLine={false} tickLine={false}
            tickFormatter={v => isRevenue ? `€${(v/1000).toFixed(0)}k` : v} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[8,8,0,0]} fill={selected.color}
            label={{ position: 'top', fontSize: 11, fill: '#566079',
              formatter: v => isRevenue ? formatCurrency(v) : v.toLocaleString('nl-NL') }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Radar view ────────────────────────────────────────────────────────────────
function RadarView({ users }) {
  const fields = [
    { subject: 'Pipeline Rev.',  key: 'pipeline_revenue' },
    { subject: 'Client Rev.',    key: 'client_revenue' },
    { subject: 'Hot Prospects',  key: 'hot_prospects_count' },
    { subject: 'Prospects',      key: 'prospects_count' },
    { subject: 'Clients',        key: 'clients_count' },
    { subject: 'Calls',          key: 'call_count' },
  ];
  const radarData = fields.map(row => {
    const point = { subject: row.subject };
    const max = Math.max(...users.map(u => u[row.key] || 0), 1);
    users.forEach(u => { point[u.full_name] = Math.round(((u[row.key] || 0) / max) * 100); });
    return point;
  });
  const COLORS = ['#3d61a4','#ef4444','#166534','#566079','#5a7fc2'];
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm p-6">
      <p className="text-xs font-semibold text-[#7b859e] uppercase tracking-wider mb-4">Vergelijking (relatief per categorie)</p>
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#e8eaf2" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#566079' }} />
          <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fontSize: 10, fill: '#a4abbe' }} tickCount={4} />
          {users.map((u, i) => (
            <Radar key={u.id} name={u.full_name.split(' ')[0]} dataKey={u.full_name}
              stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.13} strokeWidth={2} />
          ))}
          <Legend iconType="circle" iconSize={8}
            formatter={v => <span style={{ fontSize: 11, color: '#566079' }}>{v}</span>} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Leaderboard tabel ─────────────────────────────────────────────────────────
function LeaderboardView({ users }) {
  const maxScore = Math.max(...users.map(u => u.score), 1);
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#f3f4f8]">
            {['#','Naam','Pipeline Rev.','Client Rev./jr','🔥 Hot','Prospects','Score','Calls'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#7b859e] uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const rankCfg = RANK_CONFIG[u.rank - 1];
            return (
              <tr key={u.id} className="border-b border-[#f7f8fc] hover:bg-[#f7f8fc] transition-colors">
                <td className="px-4 py-3"><span className="text-lg">{rankCfg?.medal || `#${u.rank}`}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#011745] flex items-center justify-center text-white font-bold text-xs">
                      {u.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-[#011745]">{u.full_name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-bold text-[#3d61a4]">{formatCurrency(u.pipeline_revenue)}</td>
                <td className="px-4 py-3 text-sm font-bold text-green-600">{formatCurrency(u.client_revenue)}</td>
                <td className="px-4 py-3 text-sm font-bold text-red-500">{u.hot_prospects_count || 0}</td>
                <td className="px-4 py-3 text-sm text-[#566079]">{u.prospects_count}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-black text-[#3d61a4]">{u.score.toLocaleString('nl-NL')}</p>
                  <div className="w-20 h-1 bg-[#e8eaf2] rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#3d61a4] rounded-full" style={{ width: `${Math.round((u.score/maxScore)*100)}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#566079]">{u.call_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SalesDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [flashes, setFlashes] = useState({});
  const prevDataRef = useRef(null);
  const flashTimers = useRef({});

  const isAdmin = ['admin_pay','admin_trade'].includes(user?.role) || user?.is_teamleader;

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await api('/api/v1/users/sales-dashboard');
      if (prevDataRef.current) {
        const newFlashes = detectFlashes(prevDataRef.current.users, result.users);
        if (Object.keys(newFlashes).length > 0) {
          setFlashes(f => ({ ...f, ...Object.fromEntries(Object.entries(newFlashes).map(([k,v]) => [k, new Set([...(f[k] || []), ...v])])) }));
          Object.keys(newFlashes).forEach(uid => {
            if (flashTimers.current[uid]) clearTimeout(flashTimers.current[uid]);
            flashTimers.current[uid] = setTimeout(() => {
              setFlashes(f => { const n = { ...f }; delete n[uid]; return n; });
            }, 2500);
          });
        }
      }
      prevDataRef.current = result;
      setData(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(true), 30000);
    return () => { clearInterval(iv); Object.values(flashTimers.current).forEach(clearTimeout); };
  }, [fetchData]);

  const VIEW_BUTTONS = [
    { key: 'cards', icon: LayoutGrid, label: 'Kaarten' },
    { key: 'table', icon: List,       label: 'Ranking' },
    { key: 'bar',   icon: BarChart3,  label: 'Grafiek' },
    { key: 'radar', icon: Star,       label: 'Radar' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fc] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#011745]">Sales Dashboard</h1>
          <p className="text-sm text-[#7b859e] mt-0.5">
            {data ? `${data.total} sales gebruiker${data.total !== 1 ? 's' : ''} • live refresh elke 30s` : 'Pipeline overzicht'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-[#e8eaf2] rounded-xl p-1 gap-1">
            {VIEW_BUTTONS.map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === v.key ? 'bg-[#011745] text-white' : 'text-[#7b859e] hover:bg-[#f3f4f8]'
                }`}>
                <v.icon size={13}/> {v.label}
              </button>
            ))}
          </div>
          {isAdmin && <a href="/admin" className="text-xs text-[#3d61a4] hover:underline">+ Gebruikers beheren</a>}
          <button onClick={() => fetchData()} disabled={loading}
            className="p-2 rounded-lg hover:bg-[#eef2fa] text-[#3d61a4] transition-colors">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#3d61a4]" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={() => fetchData()} className="px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm">Opnieuw</button>
        </div>
      ) : !data?.users?.length ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Users size={40} className="text-[#cdd1e0]" />
          <p className="font-semibold text-[#011745]">Geen sales gebruikers op dashboard</p>
          <p className="text-sm text-[#7b859e] text-center max-w-xs">Ga naar Admin en klik "+ Dashboard" bij een sales user.</p>
          {isAdmin && <a href="/admin" className="mt-2 px-4 py-2 bg-[#011745] text-white rounded-lg text-sm font-medium">Naar Admin</a>}
        </div>
      ) : (
        <>
          {/* ── Top summary: Revenue domineert ── */}
          <div className="mb-5">
            {/* Twee grote revenue kaarten bovenaan */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              {[
                {
                  label: 'Totale Pipeline Revenue',
                  value: formatCurrency(data.users.reduce((s,u)=>s+(u.pipeline_revenue||0)+(u.onboarding_revenue||0),0)),
                  sub: 'Prospects + onboarding fase',
                  icon: TrendingUp,
                  accent: '#3d61a4',
                },
                {
                  label: 'Client Revenue / jaar',
                  value: formatCurrency(data.users.reduce((s,u)=>s+(u.client_revenue||0),0)),
                  sub: 'Actieve klanten',
                  icon: DollarSign,
                  accent: '#16a34a',
                },
              ].map(item => (
                <div key={item.label} className="rounded-2xl overflow-hidden shadow-sm border border-[#e8eaf2]"
                  style={{ background: 'linear-gradient(135deg, #011745 0%, #0a2d6b 100%)' }}>
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <item.icon size={16} style={{ color: item.accent }} />
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.label}</p>
                    </div>
                    <p className="font-black text-white mb-1"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 36, letterSpacing: '-1px', lineHeight: 1 }}>
                      {item.value}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Drie secundaire kaarten: Hot Prospects, Totaal Prospects, Calls */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 border border-[#fecaca] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Flame size={15} color="#ef4444" />
                  <p className="text-xs font-semibold text-[#ef4444] uppercase">Hot Prospects</p>
                </div>
                <p className="text-3xl font-black text-[#011745]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {data.users.reduce((s,u)=>s+(u.hot_prospects_count||0),0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#e8eaf2] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={15} color="#3d61a4" />
                  <p className="text-xs font-semibold text-[#3d61a4] uppercase">Totaal Prospects</p>
                </div>
                <p className="text-3xl font-black text-[#011745]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {data.users.reduce((s,u)=>s+(u.prospects_count||0),0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#e8eaf2] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Phone size={15} color="#7b859e" />
                  <p className="text-xs font-semibold text-[#7b859e] uppercase">Totaal Calls</p>
                </div>
                <p className="text-3xl font-black text-[#011745]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {data.users.reduce((s,u)=>s+(u.call_count||0),0)}
                </p>
              </div>
            </div>
          </div>

          {viewMode === 'cards' && <CardsView users={data.users} flashes={flashes} weights={data.weights} />}
          {viewMode === 'bar'   && <ChartView users={data.users} />}
          {viewMode === 'radar' && <RadarView users={data.users} />}
          {viewMode === 'table' && <LeaderboardView users={data.users} />}
        </>
      )}
    </div>
  );
}
