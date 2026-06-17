import React from 'react';
import { TrendingUp, DollarSign } from 'lucide-react';
import { fmtCurrency } from './onboardingHelpers';

function RevenueForecastWidget({ revenuePotential }) {
  let rows = [];
  if (Array.isArray(revenuePotential)) {
    rows = revenuePotential;
  } else if (typeof revenuePotential === 'string') {
    try { rows = JSON.parse(revenuePotential); } catch { rows = []; }
  }
  if (!rows || rows.length === 0) return null;

  const fmt = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const fmtPctVal = (v) => `${parseFloat(v || 0).toFixed(2)}%`;

  const totalRevenue = rows.reduce((sum, r) => {
    const vol = Number(r.volume) || 0;
    const margin = Number(r.margin_pct || r.margin) || 0;
    return sum + vol * (margin / 100);
  }, 0);

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#eef2fa', border: '1px solid #d0daf0' }}>
      <h4 className="text-xs font-semibold uppercase mb-3 flex items-center gap-1.5" style={{ color: '#3d61a4' }}>
        <TrendingUp size={12} /> Revenue Potentie (uit lead fase)
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: '#3d61a4' }}>
              <th className="text-left pb-2 font-semibold">Valutapaar</th>
              <th className="text-right pb-2 font-semibold">Volume (€)</th>
              <th className="text-right pb-2 font-semibold">Marge%</th>
              <th className="text-right pb-2 font-semibold">Revenue (€)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d0daf0]">
            {rows.map((r, i) => {
              const vol = Number(r.volume) || 0;
              const margin = Number(r.margin_pct || r.margin) || 0;
              const revenue = vol * (margin / 100);
              const pairLabel = r.currency_pair === 'Anders' ? (r.custom_pair || 'Anders') : (r.currency_pair || '—');
              return (
                <tr key={r.id || i}>
                  <td className="py-1.5 font-medium" style={{ color: '#011745' }}>{pairLabel}</td>
                  <td className="py-1.5 text-right" style={{ color: '#566079' }}>{fmt(vol)}</td>
                  <td className="py-1.5 text-right" style={{ color: '#566079' }}>{fmtPctVal(margin)}</td>
                  <td className="py-1.5 text-right font-semibold" style={{ color: '#011745' }}>{fmt(revenue)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #3d61a4' }}>
              <td className="pt-2 font-bold text-xs" style={{ color: '#3d61a4' }}>Totaal</td>
              <td colSpan={2} />
              <td className="pt-2 text-right font-bold" style={{ color: '#3d61a4' }}>{fmt(totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


/* ─── KYC Info Tab ─── */

export default RevenueForecastWidget;
