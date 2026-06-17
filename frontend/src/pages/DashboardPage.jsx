import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp, Users, PhoneCall, Award, DollarSign, BarChart2,
  Flame, Clock, ChevronRight, X, RefreshCw, Activity,
  UserCheck, Star, Calendar
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TOKEN = () => sessionStorage.getItem('auth_token');

async function apiFetch(path) {
  const res = await fetch(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`/api/v1${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function fmt(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('nl-NL').format(n);
}

function fmtEur(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(n);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}u`;
  return `${Math.floor(diff / 86400)}d`;
}

// ─── Animated Counter ─────────────────────────────────────────────────────

function AnimatedNumber({ target, prefix = '', suffix = '', duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  const startTs = useRef(null);

  useEffect(() => {
    if (target == null || isNaN(target)) return;
    startTs.current = null;
    const to = Number(target);
    const step = (ts) => {
      if (!startTs.current) startTs.current = ts;
      const progress = Math.min((ts - startTs.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(to * ease));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return <span>{prefix}{fmt(display)}{suffix}</span>;
}

// ─── Detail Modal ────────────────────────────────────────────────────────

// ─── Modal label & value helpers ─────────────────────────────────────────

const FIELD_LABELS = {
  leads_assigned: 'Leads toegewezen',
  calls: 'Calls gedaan',
  by_stage: 'Verdeling per fase',
  conversion_rate: 'Conversieratio',
  total_pipeline: 'Totale pipeline',
  hot_prospects_total: 'Hot prospects waarde',
  avg_deal_size: 'Gemiddelde deal',
  period: 'Periode',
  Calls: 'Calls',
  Prospects: 'Prospects',
  Klanten: 'Klanten',
  Score: 'Score',
  Leads: 'Leads',
  Ratio: 'Ratio',
  // hidden — null means skip
  is_personal: null,
  user_id: null,
  id: null,
};

const STAGE_LABELS = {
  lead: 'Lead',
  prospect: 'Prospect',
  onboarding_sales: 'Onboarding sales',
  onboarding_backoffice: 'Onboarding backoffice',
  client: 'Klant',
};

const CURRENCY_FIELDS = new Set([
  'total_pipeline', 'hot_prospects_total', 'avg_deal_size',
  'pipeline_revenue', 'client_revenue', 'total',
]);
const PERCENT_FIELDS = new Set(['conversion_rate', 'Ratio']);

function fmtModalVal(key, value) {
  if (CURRENCY_FIELDS.has(key)) return fmtEur(value || 0);
  if (PERCENT_FIELDS.has(key)) return typeof value === 'number' ? `${Math.round(value)}%` : String(value ?? '—');
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nee';
  if (typeof value === 'number') return fmt(value);
  return value ?? '—';
}

function DetailModal({ title, data, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const renderEntry = (key, value) => {
    // Nested object — render as indented sub-section (e.g. by_stage)
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const label = FIELD_LABELS[key] !== undefined ? FIELD_LABELS[key] : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return (
        <div key={key} style={S.modalSectionRow}>
          <span style={S.modalSectionKey}>{label}</span>
          <div style={S.modalSubList}>
            {Object.entries(value).map(([sk, sv]) => {
              const stageLabel = STAGE_LABELS[sk] || sk.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const displayVal = sv !== null && typeof sv === 'object'
                ? (sv.total !== undefined ? fmtEur(sv.total) : Object.values(sv).map(String).join(', '))
                : String(fmtModalVal(sk, sv));
              return (
                <div key={sk} style={S.modalSubRow}>
                  <span style={S.modalSubKey}>{stageLabel}</span>
                  <span style={S.modalSubVal}>{displayVal}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    // Hidden field
    if (FIELD_LABELS[key] === null) return null;
    // Normal scalar field
    const label = FIELD_LABELS[key] !== undefined
      ? FIELD_LABELS[key]
      : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <div key={key} style={S.modalRow}>
        <span style={S.modalKey}>{label}</span>
        <span style={S.modalVal}>{String(fmtModalVal(key, value))}</span>
      </div>
    );
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>{title}</span>
          <button style={S.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={S.modalBody}>
          {data && typeof data === 'object' && !Array.isArray(data)
            ? Object.entries(data).map(([k, v]) => renderEntry(k, v))
            : <p style={{ color: '#7b859e' }}>{String(data ?? 'Geen data')}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent, prefix = '', suffix = '', onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        ...S.kpiCard,
        boxShadow: hov ? '0 8px 32px rgba(1,23,69,0.18)' : S.kpiCard.boxShadow,
        transform: hov ? 'translateY(-4px) scale(1.02)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      <div style={{ ...S.kpiAccent, background: accent }} />
      <div style={S.kpiIconWrap}><Icon size={20} color={accent} /></div>
      <div style={S.kpiValue}>
        <AnimatedNumber target={typeof value === 'number' ? value : 0} prefix={prefix} suffix={suffix} />
      </div>
      <div style={S.kpiLabel}>{label}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────

const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];

function LeaderboardCard({ entry, rank, isCurrentUser, onClick }) {
  const [hov, setHov] = useState(false);
  const medal = rank < 3 ? MEDAL[rank] : null;
  return (
    <div
      style={{
        ...S.lbRow,
        border: isCurrentUser
          ? '2px solid #3d61a4'
          : medal ? `2px solid ${medal}` : '1px solid #e8eaf2',
        boxShadow: hov ? '0 4px 16px rgba(1,23,69,0.12)' : 'none',
        transform: hov ? 'translateY(-2px)' : 'none',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      <div style={{ ...S.lbRank, color: medal || '#a4abbe' }}>
        {medal && <Star size={12} fill={medal} color={medal} style={{ marginRight: 2 }} />}
        #{rank + 1}
      </div>
      <div style={{ ...S.lbAvatar, background: isCurrentUser ? '#3d61a4' : '#0a2d6b' }}>
        {(entry.full_name || entry.name || 'U').substring(0, 2).toUpperCase()}
      </div>
      <div style={S.lbInfo}>
        <div style={S.lbName}>
          {entry.full_name || entry.name || 'Onbekend'}
          {isCurrentUser && <span style={S.youBadge}>Jij</span>}
        </div>
        <div style={S.lbBadges}>
          <span style={S.badge}>📞 {entry.calls ?? 0}</span>
          <span style={S.badge}>🎯 {entry.prospects ?? 0}</span>
          <span style={S.badge}>✅ {entry.clients ?? 0}</span>
        </div>
      </div>
      <div style={S.lbScore}>{fmt(entry.score ?? 0)}</div>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────

const ACTION_COLORS = {
  call: '#3d61a4', email: '#5a7fc2', note: '#7b859e',
  status_change: '#0a2d6b', won: '#16a34a', lost: '#dc2626', default: '#a4abbe',
};

const ACTION_LABELS = {
  created: 'aangemaakt', updated: 'bijgewerkt', deleted: 'verwijderd',
  call: 'gebeld', note: 'notitie', email: 'e-mail',
  status_change: 'status gewijzigd', won: 'gewonnen', lost: 'verloren',
  stage_change: 'fase gewijzigd', hot_set: 'hot prospect',
};
const ENTITY_LABELS = { lead: 'Lead', prospect: 'Prospect', client: 'Klant', user: 'Gebruiker' };

function getActivityText(item) {
  const action = item.action || item.action_type || '';
  const entity = item.entity_type || '';
  const lead = item.lead?.company_name;
  const actionLbl = ACTION_LABELS[action] || action;
  const entityLbl = ENTITY_LABELS[entity] || entity;
  if (lead) return `${lead} — ${actionLbl}`;
  if (entityLbl) return `${entityLbl} ${actionLbl}`;
  return actionLbl || 'Activiteit';
}

function ActivityFeed({ items }) {
  if (!items?.length) return <div style={S.empty}>Geen activiteit</div>;
  return (
    <div style={S.feedList}>
      {items.slice(0, 20).map((item, i) => {
        const actionKey = item.action || item.action_type || 'default';
        const color = ACTION_COLORS[actionKey] || ACTION_COLORS.default;
        return (
          <div key={i} style={S.feedItem}>
            <div style={{ ...S.feedDot, background: color }} />
            <div style={S.feedContent}>
              <span style={S.feedText}>{getActivityText(item)}</span>
              <span style={S.feedMeta}>
                {item.user_name && `${item.user_name} · `}{timeAgo(item.created_at)}
              </span>
            </div>
            <span style={{ ...S.feedBadge, background: color + '22', color }}>
              {ACTION_LABELS[actionKey] || actionKey}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Hot Prospects ────────────────────────────────────────────────────────

function HotProspects({ items, navigate }) {
  if (!items?.length) return <div style={S.empty}>Geen hot prospects</div>;
  return (
    <div>
      {items.map((p, i) => (
        <div key={i} style={S.hotItem} onClick={() => navigate('/prospects')}>
          <Flame size={14} color="#ef4444" style={{ flexShrink: 0 }} />
          <div style={S.hotInfo}>
            <div style={S.hotName}>{p.company_name || p.name}</div>
            <div style={S.hotSub}>{p.sales_owner_name} · {timeAgo(p.hot_prospect_set_at)} geleden</div>
          </div>
          <div style={S.hotRev}>
            {fmtEur((p.fx_estimated_revenue || 0) + (p.tf_estimated_revenue || 0))}
          </div>
          <ChevronRight size={14} color="#a4abbe" />
        </div>
      ))}
    </div>
  );
}

// ─── Revenue Pipeline ─────────────────────────────────────────────────────

function RevenuePipeline({ data }) {
  if (!data) return <div style={S.empty}>Laden…</div>;
  const bs = data.by_stage || {};
  const stages = [
    { label: 'Prospects', value: bs.prospect?.total || 0, color: '#5a7fc2' },
    { label: 'Onboarding', value: (bs.onboarding_sales?.total || 0) + (bs.onboarding_backoffice?.total || 0), color: '#3d61a4' },
    { label: 'Klanten', value: bs.client?.total || 0, color: '#011745' },
  ];
  const total = data.total_pipeline || stages.reduce((s, x) => s + (x.value || 0), 0);
  return (
    <div style={S.pipeWrap}>
      {stages.map((st, i) => (
        <div key={i} style={S.pipeStage}>
          <div style={{ ...S.pipeBar, background: st.color }}>
            <span style={S.pipeLabel}>{st.label}</span>
            <span style={S.pipeAmt}>{fmtEur(st.value || 0)}</span>
          </div>
          {i < stages.length - 1 && (
            <ChevronRight size={20} color="#cdd1e0" style={{ flexShrink: 0 }} />
          )}
        </div>
      ))}
      <div style={S.pipeTotal}>
        <span style={S.pipeTotalLbl}>Totaal</span>
        <span style={S.pipeTotalVal}>{fmtEur(total)}</span>
      </div>
      {(data.hot_prospects_total || 0) > 0 && (
        <div style={S.hotRevBadge}>🔥 {fmtEur(data.hot_prospects_total)} in hot prospects</div>
      )}
    </div>
  );
}

// ─── Today Panel ──────────────────────────────────────────────────────────

function TodayPanel({ callbacks, dailyList, navigate }) {
  const items = useMemo(() => {
    const cb = (callbacks || []).map((c) => ({ ...c, _type: 'callback' }));
    const dl = (dailyList || []).map((d) => ({ ...d, _type: 'daily' }));
    return [...cb, ...dl].slice(0, 12);
  }, [callbacks, dailyList]);

  if (!items.length) return <div style={S.empty}>Niets gepland voor vandaag</div>;
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={S.todayItem} onClick={() => navigate('/prospects')}>
          {item._type === 'callback'
            ? <PhoneCall size={13} color="#3d61a4" />
            : <Calendar size={13} color="#5a7fc2" />}
          <div style={S.todayInfo}>
            <span style={S.todayName}>{item.company_name || item.name || 'Prospect'}</span>
            {item.callback_time && (
              <span style={S.todayTime}>
                <Clock size={10} style={{ marginRight: 2 }} />{item.callback_time}
              </span>
            )}
          </div>
          <ChevronRight size={12} color="#cdd1e0" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState(user?.dashboard_period_pref || 'month');
  const [kpis, setKpis] = useState(null);
  const [activity, setActivity] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [hotProspects, setHotProspects] = useState([]);
  const [revenuePipeline, setRevenuePipeline] = useState(null);
  const [callbacks, setCallbacks] = useState([]);
  const [dailyList, setDailyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const isPrivileged = user?.is_superuser || ['admin_pay', 'admin_trade'].includes(user?.role);
  const isTeamlead = user?.is_teamleader || isPrivileged;
  const isSales = user?.role === 'sales' || isTeamlead;
  const isLimited = ['backoffice', 'finance', 'extern'].includes(user?.role) && !isPrivileged;

  const loadData = useCallback(async (p) => {
    setLoading(true);
    const [kpisR, actR, lbR, hotR, revR, cbR, dlR] = await Promise.allSettled([
      apiFetch(`/dashboard/kpis?period=${p}`),
      apiFetch('/dashboard/activity-feed'),
      apiFetch(`/dashboard/leaderboard?period=${p}`),
      apiFetch('/dashboard/hot-prospects'),
      apiFetch('/dashboard/revenue-pipeline'),
      apiFetch('/callbacks/?today_only=true'),
      apiFetch('/dashboard/my-daily-list'),
    ]);
    if (kpisR.status === 'fulfilled') setKpis(kpisR.value);
    if (actR.status === 'fulfilled') setActivity(actR.value?.activities || actR.value?.items || []);
    if (lbR.status === 'fulfilled') setLeaderboard(lbR.value?.leaderboard || lbR.value?.entries || []);
    if (hotR.status === 'fulfilled') setHotProspects(hotR.value?.hot_prospects || hotR.value?.items || []);
    if (revR.status === 'fulfilled') setRevenuePipeline(revR.value);
    if (cbR.status === 'fulfilled') setCallbacks(cbR.value?.callbacks || cbR.value?.items || cbR.value || []);
    if (dlR.status === 'fulfilled') setDailyList(dlR.value?.calls || dlR.value?.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(period);
    const interval = setInterval(() => loadData(period), 60000);
    return () => clearInterval(interval);
  }, [period, loadData]);

  const handlePeriod = useCallback(async (p) => {
    setPeriod(p);
    loadData(p);
    try { await apiPut('/dashboard/my-period', { period: p }); } catch (_) {}
  }, [loadData]);

  const convRate = useMemo(() => {
    return Math.round(kpis?.conversion_rate || 0);
  }, [kpis]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const name = user?.first_name || user?.full_name?.split(' ')[0] || 'daar';
    if (h < 12) return `Goedemorgen, ${name}`;
    if (h < 18) return `Goedemiddag, ${name}`;
    return `Goedenavond, ${name}`;
  }, [user]);

  const PERIODS = { today: 'Vandaag', week: 'Week', month: 'Maand' };

  return (
    <div style={S.page}>

      {/* Hero Header */}
      <div style={S.hero}>
        <div>
          <h1 style={S.heroGreeting}>{greeting}</h1>
          <p style={S.heroSub}>
            {isPrivileged ? 'Team-overzicht · ' : ''}
            {PERIODS[period]} · {new Date().toLocaleDateString('nl-NL', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </p>
        </div>
        <div style={S.heroRight}>
          <div style={S.periodSwitcher}>
            {Object.entries(PERIODS).map(([p, lbl]) => (
              <button
                key={p}
                style={{ ...S.pill, ...(period === p ? S.pillActive : {}) }}
                onClick={() => handlePeriod(p)}
              >
                {lbl}
              </button>
            ))}
          </div>
          <button
            style={S.refreshBtn}
            onClick={() => loadData(period)}
            title="Vernieuwen"
          >
            <RefreshCw
              size={16}
              color="#5a7fc2"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={S.content}>

        {/* KPI Row */}
        {!isLimited && (
          <div style={S.kpiRow}>
            <KpiCard icon={Users} label="Leads in pipeline" value={kpis?.leads_assigned}
              sub={`Nieuw: ${kpis?.new_leads_in_period ?? 0} (${PERIODS[period]})`} accent="#3d61a4"
              onClick={() => setModal({ title: 'Pipeline overzicht', data: {
                'Totaal in pipeline': kpis?.leads_assigned,
                [`Nieuw (${PERIODS[period]})`]: kpis?.new_leads_in_period ?? 0,
                'Verdeling per fase': kpis?.by_stage,
              }})} />
            <KpiCard icon={PhoneCall} label="Calls gedaan" value={kpis?.calls}
              sub={PERIODS[period]} accent="#5a7fc2"
              onClick={() => setModal({ title: 'Calls gedaan', data: {
                [`Calls (${PERIODS[period]})`]: kpis?.calls,
                'Gecontacteerd (totaal)': kpis?.contacted,
              }})} />
            <KpiCard icon={Award} label="Prospects" value={kpis?.by_stage?.prospect || 0}
              accent="#0a2d6b"
              onClick={() => setModal({ title: 'Prospects', data: {
                'Actieve prospects': kpis?.by_stage?.prospect || 0,
              }})} />
            <KpiCard icon={UserCheck} label="In onboarding" value={(kpis?.by_stage?.onboarding_sales || 0) + (kpis?.by_stage?.onboarding_backoffice || 0)}
              accent="#3d61a4"
              onClick={() => setModal({ title: 'In onboarding', data: {
                'Onboarding sales': kpis?.by_stage?.onboarding_sales || 0,
                'Onboarding backoffice': kpis?.by_stage?.onboarding_backoffice || 0,
                'Totaal in onboarding': (kpis?.by_stage?.onboarding_sales || 0) + (kpis?.by_stage?.onboarding_backoffice || 0),
              }})} />
            <KpiCard icon={DollarSign} label="Revenue pipeline" value={revenuePipeline?.total_pipeline || 0}
              prefix="€" accent="#011745"
              onClick={() => setModal({ title: 'Revenue pipeline', data: revenuePipeline })} />
            <KpiCard icon={TrendingUp} label="Conversieratio" value={convRate}
              suffix="%" accent="#5a7fc2"
              onClick={() => setModal({ title: 'Conversieratio', data: {
                Leads: kpis?.leads_assigned, Prospects: kpis?.by_stage?.prospect, Ratio: `${convRate}%`
              }})} />
          </div>
        )}

        {/* Main grid */}
        <div style={S.grid}>
          {/* Left column */}
          <div style={S.leftCol}>
            {isSales && (
              <div style={S.card}>
                <div style={S.cardHdr}>
                  <BarChart2 size={16} color="#3d61a4" />
                  <span style={S.cardTitle}>Revenue Pipeline</span>
                </div>
                <RevenuePipeline data={revenuePipeline} />
              </div>
            )}

            <div style={S.card}>
              <div style={S.cardHdr}>
                <Star size={16} color="#3d61a4" />
                <span style={S.cardTitle}>Leaderboard · {PERIODS[period]}</span>
              </div>
              {leaderboard.length === 0
                ? <div style={S.empty}>Geen data beschikbaar</div>
                : <div style={S.lbList}>
                    {leaderboard.map((entry, i) => (
                      <LeaderboardCard
                        key={entry.user_id || i}
                        entry={entry}
                        rank={i}
                        isCurrentUser={entry.user_id === user?.id}
                        onClick={() => setModal({
                          title: entry.full_name || entry.name,
                          data: { Calls: entry.calls, Prospects: entry.prospects,
                                  Klanten: entry.clients, Score: entry.score }
                        })}
                      />
                    ))}
                  </div>
              }
            </div>

            {isSales && (
              <div style={S.card}>
                <div style={S.cardHdr}>
                  <Flame size={16} color="#ef4444" />
                  <span style={S.cardTitle}>Hot Prospects</span>
                  {hotProspects.length > 0 && (
                    <span style={S.cardBadge}>{hotProspects.length}</span>
                  )}
                </div>
                <HotProspects items={hotProspects} navigate={navigate} />
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={S.rightCol}>
            <div style={S.card}>
              <div style={S.cardHdr}>
                <Activity size={16} color="#3d61a4" />
                <span style={S.cardTitle}>Activiteit</span>
              </div>
              <ActivityFeed items={activity} />
            </div>

            <div style={S.card}>
              <div style={S.cardHdr}>
                <Calendar size={16} color="#3d61a4" />
                <span style={S.cardTitle}>Vandaag</span>
                {(callbacks.length + dailyList.length) > 0 && (
                  <span style={S.cardBadge}>{callbacks.length + dailyList.length}</span>
                )}
              </div>
              <TodayPanel callbacks={callbacks} dailyList={dailyList} navigate={navigate} />
            </div>
          </div>
        </div>
      </div>

      {modal && <DetailModal title={modal.title} data={modal.data} onClose={() => setModal(null)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cdd1e0; border-radius: 4px; }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: "'Inter', -apple-system, sans-serif",
    background: '#f4f6fb',
    minHeight: '100vh',
    color: '#252f4a',
  },
  hero: {
    background: 'linear-gradient(135deg, #011745 0%, #0a2d6b 100%)',
    padding: '32px 32px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  heroGreeting: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 28, fontWeight: 800, color: '#f7f8fc',
    margin: 0, marginBottom: 4, letterSpacing: '-0.3px',
  },
  heroSub: { color: '#5a7fc2', fontSize: 14, margin: 0, fontWeight: 500 },
  heroRight: { display: 'flex', alignItems: 'center', gap: 12 },
  periodSwitcher: {
    display: 'flex', background: 'rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 3, gap: 2,
  },
  pill: {
    background: 'transparent', border: 'none', borderRadius: 8,
    padding: '6px 16px', fontSize: 13, fontWeight: 600,
    color: '#a4abbe', cursor: 'pointer', transition: 'all 0.2s ease',
    fontFamily: "'Inter', sans-serif",
  },
  pillActive: {
    background: '#3d61a4', color: '#f7f8fc',
    boxShadow: '0 2px 8px rgba(61,97,164,0.4)',
  },
  refreshBtn: {
    background: 'rgba(255,255,255,0.08)', border: 'none',
    borderRadius: 8, padding: 8, cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  },
  content: { padding: '28px 32px', maxWidth: 1600, margin: '0 auto' },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
    gap: 16, marginBottom: 28,
  },
  kpiCard: {
    background: '#fff', borderRadius: 14,
    padding: '20px 20px 16px', position: 'relative',
    overflow: 'hidden', boxShadow: '0 2px 8px rgba(1,23,69,0.07)',
    transition: 'all 0.25s ease', animation: 'fadeUp 0.4s ease both',
  },
  kpiAccent: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3, borderRadius: '14px 14px 0 0',
  },
  kpiIconWrap: { marginBottom: 10, marginTop: 4 },
  kpiValue: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 28, fontWeight: 800, color: '#011745',
    letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12, fontWeight: 600, color: '#7b859e',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2,
  },
  kpiSub: { fontSize: 11, color: '#a4abbe' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 20 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 20 },
  card: {
    background: '#fff', borderRadius: 14,
    boxShadow: '0 2px 8px rgba(1,23,69,0.07)',
    overflow: 'hidden', animation: 'fadeUp 0.5s ease both',
  },
  cardHdr: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '16px 20px', borderBottom: '1px solid #f3f4f8',
  },
  cardTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700, fontSize: 14, color: '#011745', flex: 1,
  },
  cardBadge: {
    background: '#eef2fa', color: '#3d61a4',
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
  },
  empty: { padding: '24px 20px', textAlign: 'center', color: '#a4abbe', fontSize: 13 },
  lbList: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  lbRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px', borderRadius: 10, background: '#f7f8fc',
  },
  lbRank: { fontSize: 12, fontWeight: 700, minWidth: 28, display: 'flex', alignItems: 'center' },
  lbAvatar: {
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
  },
  lbInfo: { flex: 1, minWidth: 0 },
  lbName: {
    fontSize: 13, fontWeight: 600, color: '#011745',
    display: 'flex', alignItems: 'center', gap: 6,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  youBadge: {
    fontSize: 10, fontWeight: 700, background: '#eef2fa',
    color: '#3d61a4', padding: '1px 6px', borderRadius: 4,
  },
  lbBadges: { display: 'flex', gap: 6, marginTop: 3 },
  badge: {
    fontSize: 10, background: '#f3f4f8', padding: '2px 6px',
    borderRadius: 4, color: '#566079', fontWeight: 500,
  },
  lbScore: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 800, fontSize: 16, color: '#011745',
  },
  feedList: { padding: '8px 0', maxHeight: 360, overflowY: 'auto' },
  feedItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 20px' },
  feedDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  feedContent: { flex: 1, minWidth: 0 },
  feedText: {
    fontSize: 13, color: '#252f4a', fontWeight: 500, display: 'block',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  feedMeta: { fontSize: 11, color: '#a4abbe', marginTop: 2, display: 'block' },
  feedBadge: {
    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.3px',
  },
  hotItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 20px', cursor: 'pointer',
    transition: 'background 0.15s', borderBottom: '1px solid #f3f4f8',
  },
  hotInfo: { flex: 1, minWidth: 0 },
  hotName: {
    fontSize: 13, fontWeight: 600, color: '#011745',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  hotSub: { fontSize: 11, color: '#a4abbe', marginTop: 1 },
  hotRev: { fontSize: 12, fontWeight: 700, color: '#3d61a4', whiteSpace: 'nowrap' },
  pipeWrap: {
    padding: '20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
  },
  pipeStage: { display: 'flex', alignItems: 'center', gap: 8 },
  pipeBar: {
    borderRadius: 8, padding: '10px 16px', display: 'flex',
    flexDirection: 'column', alignItems: 'center', minWidth: 95,
  },
  pipeLabel: {
    fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  pipeAmt: { fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 3 },
  pipeTotal: {
    marginLeft: 'auto', background: '#eef2fa', borderRadius: 10,
    padding: '10px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  pipeTotalLbl: {
    fontSize: 10, fontWeight: 600, color: '#7b859e',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  pipeTotalVal: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 20, fontWeight: 800, color: '#011745',
  },
  hotRevBadge: {
    width: '100%', marginTop: 8, background: '#fef2f2',
    color: '#ef4444', fontSize: 13, fontWeight: 600,
    padding: '8px 16px', borderRadius: 8, textAlign: 'center',
  },
  todayItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px',
    cursor: 'pointer', transition: 'background 0.15s', borderBottom: '1px solid #f3f4f8',
  },
  todayInfo: {
    flex: 1, display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', minWidth: 0,
  },
  todayName: {
    fontSize: 13, fontWeight: 600, color: '#252f4a',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  todayTime: {
    fontSize: 11, color: '#7b859e', display: 'flex',
    alignItems: 'center', whiteSpace: 'nowrap', marginLeft: 8,
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(1,23,69,0.55)',
    backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex',
    alignItems: 'center', justifyContent: 'center', animation: 'fadeUp 0.2s ease',
  },
  modalBox: {
    background: '#fff', borderRadius: 16, width: '90%', maxWidth: 480,
    boxShadow: '0 20px 60px rgba(1,23,69,0.3)', overflow: 'hidden',
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #011745, #0a2d6b)',
    padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700, fontSize: 16, color: '#f7f8fc',
  },
  modalClose: {
    background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6,
    padding: 4, cursor: 'pointer', color: '#f7f8fc', display: 'flex', alignItems: 'center',
  },
  modalBody: { padding: '20px 22px', maxHeight: 460, overflowY: 'auto' },
  modalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #f3f4f8', gap: 16,
  },
  modalKey: { fontSize: 13, fontWeight: 600, color: '#566079' },
  modalVal: { fontSize: 13, fontWeight: 600, color: '#011745', textAlign: 'right' },
  modalSectionRow: {
    padding: '10px 0 6px', borderBottom: '1px solid #f3f4f8',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  modalSectionKey: {
    fontSize: 13, fontWeight: 700, color: '#011745', marginBottom: 4,
  },
  modalSubList: {
    display: 'flex', flexDirection: 'column', gap: 3,
    paddingLeft: 8,
  },
  modalSubRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '4px 10px', background: '#f4f6fb', borderRadius: 6,
  },
  modalSubKey: { fontSize: 12, color: '#7b859e', fontWeight: 500 },
  modalSubVal: { fontSize: 12, color: '#3d61a4', fontWeight: 700 },
};
