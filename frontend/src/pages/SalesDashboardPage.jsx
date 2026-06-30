import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, TrendingUp, Phone, Clock, Building2, Target, ClipboardCheck,
  Loader2, RefreshCw, AlertCircle, DollarSign, ArrowUpRight, BarChart3,
  Trophy, Star, LayoutGrid, List
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
  if (!val) return '€ 0';
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
    const fields = ['call_count','leads_count','prospects_count','onboarding_count','clients_count','score'];
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

function StatCell({ label, value, field, flashSet, icon: Icon, color }) {
  const isFlashing = flashSet?.has(field);
  return (
    <div className={`relative rounded-xl p-3 border transition-all duration-300 ${
      isFlashing ? 'border-green-300 bg-green-50 shadow-md' : 'bg-[#f7f8fc] border-[#e8eaf2]'
    }`}
      style={isFlashing ? { transform: 'scale(1.04)' } : {}}>
      {isFlashing && <div className="absolute inset-0 rounded-xl border-2 border-green-400 animate-pulse pointer-events-none" />}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase font-semibold text-[#7b859e]">{label}</p>
        {Icon && <Icon size={12} style={{ color: isFlashing ? '#16a34a' : color }} />}
      </div>
      <p className={`text-lg font-bold ${isFlashing ? 'text-green-700' : ''}`} style={isFlashing ? {} : { color: '#011745' }}>
        {isFlashing && <span className="text-green-500 mr-0.5">↑</span>}{value}
      </p>
    </div>
  );
}

// ── Cards view ────────────────────────────────────────────────────────────────
function CardsView({ users, flashes, weights }) {
  const maxScore = Math.max(...users.map(u => u.score), 1);
  return (
    <div className="space-y-4">
      {users.map(u => {
        const rankCfg = RANK_CONFIG[u.rank - 1];
        const flashSet = flashes[u.id];
        return (
          <div key={u.id} className={`rounded-2xl border overflow-hidden shadow-sm bg-gradient-to-r ${rankCfg?.bg || 'from-white to-white'} ${rankCfg?.border || 'border-[#e8eaf2]'}`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f8]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[#011745] flex items-center justify-center text-white font-bold text-sm">
                    {u.full_name?.charAt(0).toUpperCase()}
                  </div>
                  {u.rank <= 3 && <span className="absolute -top-1 -right-1 text-base leading-none">{rankCfg.medal}</span>}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#011745]">{u.full_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${rankCfg?.badge || 'bg-[#e8eaf2] text-[#566079]'}`}>#{u.rank}</span>
                  </div>
                  <p className="text-xs text-[#7b859e]">{u.email}</p>
                </div>
              </div>
              <div className="text-right min-w-32">
                <p className="text-xs text-[#7b859e]">Score</p>
                <p className={`text-2xl font-black transition-colors ${flashSet?.has('score') ? 'text-green-600' : 'text-[#3d61a4]'}`}>
                  {flashSet?.has('score') && <span className="text-green-500">↑</span>}
                  {u.score.toLocaleString('nl-NL')} <span className="text-sm font-normal">pts</span>
                </p>
                <ScoreBar score={u.score} maxScore={maxScore} />
              </div>
            </div>
            <div className="p-4 grid grid-cols-4 gap-3">
              <div className="col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1">
                <StatCell label="Leads" value={u.leads_count} field="leads_count" flashSet={flashSet} icon={Users} color="#3d61a4" />
                <StatCell label="Prospects" value={u.prospects_count} field="prospects_count" flashSet={flashSet} icon={Target} color="#92400e" />
                <StatCell label="Onboarding" value={u.onboarding_count} field="onboarding_count" flashSet={flashSet} icon={ClipboardCheck} color="#166534" />
                <StatCell label="Clients" value={u.clients_count} field="clients_count" flashSet={flashSet} icon={Building2} color="#011745" />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <StatCell label="Calls" value={u.call_count} field="call_count" flashSet={flashSet} icon={Phone} color="#566079" />
                <div className="bg-[#f7f8fc] rounded-xl p-3 border border-[#e8eaf2]">
                  <p className="text-[10px] uppercase font-semibold text-[#7b859e] mb-1">Beltijd</p>
                  <p className="text-lg font-bold text-[#011745]">{formatDuration(u.total_call_duration_seconds)}</p>
                </div>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-2">
                <div className="bg-[#f7f8fc] rounded-xl p-3 border border-[#e8eaf2]">
                  <p className="text-[10px] uppercase font-semibold text-[#7b859e] mb-1">Prospect</p>
                  <p className="text-sm font-bold text-[#3d61a4]">{formatCurrency(u.pipeline_revenue)}</p>
                </div>
                <div className="bg-[#f7f8fc] rounded-xl p-3 border border-[#e8eaf2]">
                  <p className="text-[10px] uppercase font-semibold text-[#7b859e] mb-1">Onboarding</p>
                  <p className="text-sm font-bold text-amber-600">{formatCurrency(u.onboarding_revenue)}</p>
                </div>
                <div className="bg-[#f7f8fc] rounded-xl p-3 border border-[#e8eaf2]">
                  <p className="text-[10px] uppercase font-semibold text-[#7b859e] mb-1">Client/jr</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(u.client_revenue)}</p>
                </div>
              </div>
            </div>
            {u.score > 0 && (
              <div className="px-4 pb-3">
                <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                  {u.call_count > 0       && <div className="bg-[#566079]" style={{ flex: u.call_count * (weights?.call_points||2) }} />}
                  {u.leads_count > 0      && <div className="bg-[#3d61a4]" style={{ flex: u.leads_count * (weights?.lead_points||1) }} />}
                  {u.prospects_count > 0  && <div className="bg-amber-400" style={{ flex: u.prospects_count * (weights?.prospect_points||10) }} />}
                  {u.onboarding_count > 0 && <div className="bg-orange-400" style={{ flex: u.onboarding_count * (weights?.onboarding_points||50) }} />}
                  {u.clients_count > 0    && <div className="bg-green-500" style={{ flex: u.clients_count * (weights?.client_points||100) }} />}
                </div>
                <div className="flex gap-3 mt-1 text-[9px] text-[#7b859e]">
                  {[['#566079','Calls'],['#3d61a4','Leads'],['bg-amber-400','Prospects'],['bg-orange-400','Onboarding'],['bg-green-500','Clients']].map(([c,l]) => (
                    <span key={l} className="flex items-center gap-0.5">
                      <span className="w-2 h-1 rounded-sm inline-block" style={c.startsWith('#') ? {backgroundColor:c} : {}} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Bar chart view ────────────────────────────────────────────────────────────
function ChartView({ users }) {
  const [metric, setMetric] = useState('score');
  const metrics = [
    { key: 'score',            label: 'Score',           color: '#3d61a4' },
    { key: 'call_count',       label: 'Calls',           color: '#566079' },
    { key: 'leads_count',      label: 'Leads',           color: '#3d61a4' },
    { key: 'prospects_count',  label: 'Prospects',       color: '#92400e' },
    { key: 'onboarding_count', label: 'Onboarding',      color: '#166534' },
    { key: 'clients_count',    label: 'Clients',         color: '#011745' },
    { key: 'pipeline_revenue', label: 'Pipeline Revenue',color: '#5a7fc2' },
    { key: 'client_revenue',   label: 'Client Rev./jr',  color: '#16a34a' },
  ];
  const selected = metrics.find(m => m.key === metric);
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
        <p className="text-[#3d61a4]">{selected.label}: <b>{metric.includes('revenue') ? formatCurrency(payload[0].value) : payload[0].value.toLocaleString('nl-NL')}</b></p>
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
            tickFormatter={v => metric.includes('revenue') ? `€${(v/1000).toFixed(0)}k` : v} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[8,8,0,0]} fill={selected.color}
            label={{ position: 'top', fontSize: 11, fill: '#566079',
              formatter: v => metric.includes('revenue') ? formatCurrency(v) : v.toLocaleString('nl-NL') }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Radar view ────────────────────────────────────────────────────────────────
function RadarView({ users }) {
  const fields = [
    { subject: 'Calls',      key: 'call_count' },
    { subject: 'Leads',      key: 'leads_count' },
    { subject: 'Prospects',  key: 'prospects_count' },
    { subject: 'Onboarding', key: 'onboarding_count' },
    { subject: 'Clients',    key: 'clients_count' },
  ];
  const radarData = fields.map(row => {
    const point = { subject: row.subject };
    const max = Math.max(...users.map(u => u[row.key] || 0), 1);
    users.forEach(u => { point[u.full_name] = Math.round(((u[row.key] || 0) / max) * 100); });
    return point;
  });
  const COLORS = ['#3d61a4','#92400e','#166534','#566079','#5a7fc2'];
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
            {['#','Naam','Score','Calls','Leads','Prospects','Onboarding','Clients','Pipeline'].map(h => (
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
                <td className="px-4 py-3">
                  <p className="text-sm font-black text-[#3d61a4]">{u.score.toLocaleString('nl-NL')}</p>
                  <div className="w-20 h-1 bg-[#e8eaf2] rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#3d61a4] rounded-full" style={{ width: `${Math.round((u.score/maxScore)*100)}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#566079]">{u.call_count}</td>
                <td className="px-4 py-3 text-sm text-[#566079]">{u.leads_count}</td>
                <td className="px-4 py-3 text-sm text-[#566079]">{u.prospects_count}</td>
                <td className="px-4 py-3 text-sm text-[#566079]">{u.onboarding_count}</td>
                <td className="px-4 py-3 text-sm text-[#566079]">{u.clients_count}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[#3d61a4]">{formatCurrency(u.pipeline_revenue + u.onboarding_revenue)}</td>
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
          <h1 className="text-2xl font-bold font-heading tracking-tight text-[#011745]">Sales Dashboard</h1>
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
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Totaal Score', value: data.users.reduce((s,u)=>s+u.score,0).toLocaleString('nl-NL')+' pts', icon: Trophy, color: '#3d61a4' },
              { label: 'Pipeline Revenue', value: formatCurrency(data.users.reduce((s,u)=>s+u.pipeline_revenue+u.onboarding_revenue,0)), icon: TrendingUp, color: '#92400e' },
              { label: 'Client Rev./jr', value: formatCurrency(data.users.reduce((s,u)=>s+u.client_revenue,0)), icon: DollarSign, color: '#166534' },
              { label: 'Totaal Calls', value: data.users.reduce((s,u)=>s+u.call_count,0).toString(), icon: Phone, color: '#566079' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl p-4 border border-[#e8eaf2] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon size={15} style={{ color: item.color }} />
                  <p className="text-xs font-semibold text-[#7b859e] uppercase">{item.label}</p>
                </div>
                <p className="text-xl font-bold text-[#011745]">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Weights legend */}
          {data.weights && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-[10px] font-semibold text-[#a4abbe] uppercase tracking-wider mr-1">Puntenwaardes:</span>
              {[
                { label:'Call',       val: data.weights.call_points,       color:'#566079' },
                { label:'Lead',       val: data.weights.lead_points,       color:'#3d61a4' },
                { label:'Prospect',   val: data.weights.prospect_points,   color:'#92400e' },
                { label:'Onboarding', val: data.weights.onboarding_points, color:'#166534' },
                { label:'Client',     val: data.weights.client_points,     color:'#011745' },
              ].map(w => (
                <span key={w.label} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: w.color }}>
                  {w.label} = {w.val}pt
                </span>
              ))}
              <a href="/team-management" className="text-[10px] text-[#3d61a4] hover:underline ml-2">⚙ Aanpassen</a>
            </div>
          )}

          {viewMode === 'cards' && <CardsView users={data.users} flashes={flashes} weights={data.weights} />}
          {viewMode === 'bar'   && <ChartView users={data.users} />}
          {viewMode === 'radar' && <RadarView users={data.users} />}
          {viewMode === 'table' && <LeaderboardView users={data.users} />}
        </>
      )}
    </div>
  );
}
