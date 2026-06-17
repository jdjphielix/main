import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle, TrendingUp, X, Loader2, AlertTriangle } from 'lucide-react';

const token = () => sessionStorage.getItem('auth_token');
const api = (url, opts = {}) => fetch(url, { headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

function formatVolume(v) {
  if (!v) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatRate(r) {
  return r?.toFixed(4) ?? '—';
}

const STATUS_STYLES = {
  active:    { bg: '#eef2fa', text: '#3d61a4', label: 'Actief' },
  triggered: { bg: '#f0fdf4', text: '#16a34a', label: 'Getriggerd' },
  cancelled: { bg: '#f7f8fc', text: '#a4abbe', label: 'Geannuleerd' },
};

export default function LimitOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newOrder, setNewOrder] = useState({ lead_id: '', currency_pair: '', rate: '', volume: '' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const data = await api(`/api/v1/limit-orders/${params}`);
      setOrders(data.limit_orders || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
    api('/api/v1/leads/?pipeline_stage=client&page_size=200').then(d => setClients(d.leads || [])).catch(() => {});
  }, [fetchOrders]);

  async function handleCreate() {
    if (!newOrder.lead_id || !newOrder.currency_pair || !newOrder.rate) return;
    setSaving(true);
    try {
      const rawVol = newOrder.volume;
      let volume = null;
      if (rawVol) {
        const num = parseFloat(rawVol);
        if (!isNaN(num)) {
          const upper = rawVol.toUpperCase();
          volume = upper.includes('M') ? num * 1_000_000 : upper.includes('K') ? num * 1_000 : num;
        }
      }
      const payload = {
        lead_id: parseInt(newOrder.lead_id),
        currency_pair: newOrder.currency_pair.toUpperCase().replace(/[^A-Z]/g, ''),
        rate: parseFloat(newOrder.rate),
        volume,
      };
      await api('/api/v1/limit-orders/', { method: 'POST', body: JSON.stringify(payload) });
      setShowNew(false);
      setNewOrder({ lead_id: '', currency_pair: '', rate: '', volume: '' });
      fetchOrders();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function handleTrigger(id) {
    setActionLoading(id);
    try {
      await api(`/api/v1/limit-orders/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'triggered' }) });
      fetchOrders();
    } catch (err) { alert(err.message); }
    finally { setActionLoading(null); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Limit order verwijderen?')) return;
    setActionLoading(`del_${id}`);
    try {
      await api(`/api/v1/limit-orders/${id}`, { method: 'DELETE' });
      fetchOrders();
    } catch (err) { alert(err.message); }
    finally { setActionLoading(null); }
  }

  // Group by currency pair
  const grouped = orders.reduce((acc, o) => {
    const key = o.currency_pair;
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  return (
    <div style={{ backgroundColor: '#f7f8fc', minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-[#e8eaf2]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#011745', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Limit Orders
            </h1>
            <p className="text-sm mt-1" style={{ color: '#7b859e' }}>
              Prijsniveaus en alerts per klant. Gesorteerd op koers binnen valutapaar.
            </p>
          </div>
          <button onClick={() => setShowNew(v => !v)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: '#011745' }}>
            <Plus size={16} /> Nieuw
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-4">
          {[['active','Actief'], ['triggered','Getriggerd'], ['all','Alle']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: statusFilter === v ? '#011745' : '#f7f8fc',
                color: statusFilter === v ? 'white' : '#566079',
                border: `1px solid ${statusFilter === v ? '#011745' : '#e8eaf2'}`,
              }}>{l}</button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        {/* New order form */}
        {showNew && (
          <div className="mb-6 bg-white rounded-2xl border border-[#e8eaf2] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: '#011745' }}>Nieuw limit order</h3>
              <button onClick={() => setShowNew(false)}><X size={16} style={{ color: '#a4abbe' }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-[#566079] mb-1 block">Klant *</label>
                <select value={newOrder.lead_id} onChange={e => setNewOrder(p => ({ ...p, lead_id: e.target.value }))}
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]">
                  <option value="">— Selecteer klant —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#566079] mb-1 block">Valutapaar * (bijv. EURUSD)</label>
                <input value={newOrder.currency_pair} onChange={e => setNewOrder(p => ({ ...p, currency_pair: e.target.value }))}
                  placeholder="EURUSD"
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#566079] mb-1 block">Koers *</label>
                <input type="number" step="0.0001" value={newOrder.rate} onChange={e => setNewOrder(p => ({ ...p, rate: e.target.value }))}
                  placeholder="1.1700"
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#566079] mb-1 block">Volume (optioneel, bijv. 500K)</label>
                <input value={newOrder.volume} onChange={e => setNewOrder(p => ({ ...p, volume: e.target.value }))}
                  placeholder="500K"
                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={saving || !newOrder.lead_id || !newOrder.currency_pair || !newOrder.rate}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40"
                style={{ backgroundColor: '#3d61a4' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Aanmaken
              </button>
              <button onClick={() => setShowNew(false)}
                className="px-5 py-2 rounded-xl text-sm font-medium border border-[#e8eaf2] text-[#566079]">
                Annuleren
              </button>
            </div>
          </div>
        )}

        {/* Orders table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: '#3d61a4' }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16" style={{ color: '#a4abbe' }}>
            <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Geen limit orders</p>
            <p className="text-xs mt-1">Maak een nieuw limit order aan via de knop rechtsboven</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([pair, pairOrders]) => (
              <div key={pair}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="px-3 py-1 rounded-lg text-xs font-bold tracking-wider"
                    style={{ backgroundColor: '#011745', color: '#eef2fa', fontFamily: 'JetBrains Mono, monospace' }}>
                    {pair.slice(0,3)}/{pair.slice(3)}
                  </div>
                  <div className="h-px flex-1" style={{ backgroundColor: '#e8eaf2' }} />
                  <span className="text-xs" style={{ color: '#a4abbe' }}>{pairOrders.length} order{pairOrders.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-white rounded-xl border border-[#e8eaf2] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#f7f8fc' }}>
                        {['Koers', 'Volume', 'Klant', 'Status', 'Aangemaakt door', 'Acties'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#566079' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pairOrders.sort((a,b) => a.rate - b.rate).map(o => {
                        const st = STATUS_STYLES[o.status] || STATUS_STYLES.active;
                        return (
                          <tr key={o.id} className="border-t border-[#f7f8fc] hover:bg-[#fafbff]">
                            <td className="px-4 py-3 font-mono font-bold text-base" style={{ color: '#011745' }}>
                              {formatRate(o.rate)}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm" style={{ color: '#3d61a4' }}>
                              {formatVolume(o.volume)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium" style={{ color: '#011745' }}>{o.company_name || `Lead #${o.lead_id}`}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: st.bg, color: st.text }}>
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#7b859e' }}>
                              {o.created_by_name || '—'}
                              {o.created_at && (
                                <div style={{ color: '#a4abbe' }}>{new Date(o.created_at).toLocaleDateString('nl-NL')}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {o.status === 'active' && (
                                  <button onClick={() => handleTrigger(o.id)} disabled={actionLoading === o.id}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-green-50"
                                    style={{ color: '#16a34a' }} title="Markeer als getriggerd">
                                    {actionLoading === o.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                  </button>
                                )}
                                <button onClick={() => handleDelete(o.id)} disabled={actionLoading === `del_${o.id}`}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-[#cdd1e0] hover:text-red-400" title="Verwijder">
                                  {actionLoading === `del_${o.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
