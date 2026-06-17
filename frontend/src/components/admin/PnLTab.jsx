import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, DollarSign, TrendingUp, Building2
} from 'lucide-react';
import { api, formatCurrency } from './adminHelpers';

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

export default PnLTab;
