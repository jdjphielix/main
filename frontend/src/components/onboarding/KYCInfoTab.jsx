import React, { useState } from 'react';
import {
  Shield, CheckCircle2, AlertCircle, Edit3, Save, X, Loader2,
  FileText, DollarSign, TrendingUp, BarChart3
} from 'lucide-react';
import { token, fmtCurrency, fmtPct } from './onboardingHelpers';
import RevenueForecastWidget from './RevenueForecastWidget';

function KYCInfoTab({ lead, prospectData, onUpdate }) {
  const pd = prospectData?.prospect_data || prospectData || {};
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  // Populate form when data loads
  useEffect(() => {
    setForm({
      kyc_status:           pd.kyc_status || 'pending',
      risk_profile:         pd.risk_profile || '',
      ubo_name:             pd.ubo_name || '',
      ubo_nationality:      pd.ubo_nationality || '',
      legal_entity_type:    pd.legal_entity_type || '',
      kyc_notes:            pd.kyc_notes || '',
      aml_cleared:          pd.aml_cleared || false,
      fx_spot_spread_pct:   pd.fx_spot_spread_pct ?? '',
      fx_forward_margin_pct:pd.fx_forward_margin_pct ?? '',
      credit_limit_eur:     pd.credit_limit_eur ?? '',
      min_deal_size_eur:    pd.min_deal_size_eur ?? '',
      tf_interest_rate_pct: pd.tf_interest_rate_pct ?? '',
      tf_fee_pct:           pd.tf_fee_pct ?? '',
      tf_closing_fee_pct:   pd.tf_closing_fee_pct ?? '',
      payment_terms_days:   pd.payment_terms_days ?? '',
      pricing_notes:        pd.pricing_notes || '',
    });
  }, [prospectData]);

  async function save() {
    setSaving(true);
    try {
      const body = { ...form };
      // Convert numeric strings
      ['fx_spot_spread_pct','fx_forward_margin_pct','credit_limit_eur','min_deal_size_eur',
       'tf_interest_rate_pct','tf_fee_pct','tf_closing_fee_pct','payment_terms_days'].forEach(k => {
        body[k] = body[k] !== '' ? parseFloat(body[k]) : null;
      });
      await api(`/api/v1/prospects/${lead.id}/prospect-data`, { method: 'PUT', body: JSON.stringify(body) });
      if (onUpdate) onUpdate(body);
      setEditing(false);
    } catch (e) { console.error('KYC save failed:', e); }
    finally { setSaving(false); }
  }

  const KYC_STATUSES = [
    { key: 'pending',     label: 'Wachten',      bg: '#f3f4f8', text: '#7b859e' },
    { key: 'in_progress', label: 'In Behandeling', bg: '#fef3c7', text: '#92400e' },
    { key: 'approved',    label: 'Goedgekeurd',  bg: '#f0fdf4', text: '#16a34a' },
    { key: 'rejected',    label: 'Afgekeurd',    bg: '#fef2f2', text: '#dc2626' },
  ];
  const kycSt = KYC_STATUSES.find(s => s.key === (editing ? form.kyc_status : pd.kyc_status)) || KYC_STATUSES[0];

  const RISK = [
    { key: 'low',    label: 'Laag',   bg: '#f0fdf4', text: '#16a34a' },
    { key: 'medium', label: 'Middel', bg: '#fef3c7', text: '#92400e' },
    { key: 'high',   label: 'Hoog',   bg: '#fef2f2', text: '#dc2626' },
  ];
  const riskVal = editing ? form.risk_profile : pd.risk_profile;
  const riskSt = RISK.find(r => r.key === riskVal);

  const fmtCurrency = v => v != null && v !== '' ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '—';
  const fmtPct = v => v != null && v !== '' ? `${parseFloat(v).toFixed(3)}%` : '—';
  const fmtDays = v => v != null && v !== '' ? `${v} dagen` : '—';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: '#011745' }} />
          <h3 className="font-semibold" style={{ color: '#011745' }}>KYC & Pricing Info</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: kycSt.bg, color: kycSt.text }}>{kycSt.label}</span>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e8eaf2] hover:border-[#3d61a4] transition-all"
            style={{ color: '#3d61a4' }}>
            <Edit3 size={12} /> Bewerken
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#7b859e' }}>Annuleer</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#3d61a4' }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Opslaan
            </button>
          </div>
        )}
      </div>

      {/* ═══ KYC / Compliance sectie ═══ */}
      <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: '#f7f8fc' }}>
        <h4 className="text-xs font-semibold uppercase flex items-center gap-1.5" style={{ color: '#7b859e' }}>
          <Shield size={12} /> KYC / Compliance
        </h4>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>KYC Status</label>
                <select value={form.kyc_status} onChange={e => setForm({ ...form, kyc_status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }}>
                  <option value="pending">Wachten</option>
                  <option value="in_progress">In Behandeling</option>
                  <option value="approved">Goedgekeurd</option>
                  <option value="rejected">Afgekeurd</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Risicoprofiel</label>
                <select value={form.risk_profile} onChange={e => setForm({ ...form, risk_profile: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }}>
                  <option value="">— Selecteer —</option>
                  <option value="low">Laag</option>
                  <option value="medium">Middel</option>
                  <option value="high">Hoog</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.aml_cleared}
                  onChange={e => setForm({ ...form, aml_cleared: e.target.checked })}
                  className="w-4 h-4 rounded border-[#e8eaf2] accent-[#3d61a4]" />
                <span className="text-sm font-medium" style={{ color: '#011745' }}>AML Cleared</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>UBO Naam</label>
                <input type="text" value={form.ubo_name} onChange={e => setForm({ ...form, ubo_name: e.target.value })}
                  placeholder="Volledige naam..." className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>UBO Nationaliteit</label>
                <input type="text" value={form.ubo_nationality} onChange={e => setForm({ ...form, ubo_nationality: e.target.value })}
                  placeholder="b.v. Dutch, German..." className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Rechtsvorm</label>
              <input type="text" value={form.legal_entity_type} onChange={e => setForm({ ...form, legal_entity_type: e.target.value })}
                placeholder="b.v. BV, NV, Ltd, GmbH..." className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4]"
                style={{ color: '#011745' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>KYC Notities</label>
              <textarea value={form.kyc_notes} onChange={e => setForm({ ...form, kyc_notes: e.target.value })}
                rows={3} placeholder="Relevante KYC aantekeningen..."
                className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4] resize-none"
                style={{ color: '#011745' }} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Risicoprofiel', value: riskSt ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: riskSt.bg, color: riskSt.text }}>{riskSt.label}</span> : '—' },
              { label: 'AML Cleared', value: pd.aml_cleared ? <span className="flex items-center gap-1 text-green-600 text-xs font-semibold"><Check size={12} /> Ja</span> : <span className="text-xs" style={{ color: '#a4abbe' }}>Nee</span> },
              { label: 'UBO Naam', value: pd.ubo_name || '—' },
              { label: 'UBO Nationaliteit', value: pd.ubo_nationality || '—' },
              { label: 'Rechtsvorm', value: pd.legal_entity_type || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg p-3 border border-[#e8eaf2]">
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#7b859e' }}>{label}</p>
                <div className="text-sm font-medium" style={{ color: '#011745' }}>{value}</div>
              </div>
            ))}
            {pd.kyc_notes && (
              <div className="col-span-2 bg-white rounded-lg p-3 border border-[#e8eaf2]">
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#7b859e' }}>KYC Notities</p>
                <p className="text-sm" style={{ color: '#566079' }}>{pd.kyc_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ FX Pricing sectie ═══ */}
      <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: '#f7f8fc' }}>
        <h4 className="text-xs font-semibold uppercase flex items-center gap-1.5" style={{ color: '#7b859e' }}>
          <Percent size={12} /> FX Pricing
        </h4>
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'fx_spot_spread_pct',    label: 'Spot Spread (%)',     placeholder: '0.250' },
              { key: 'fx_forward_margin_pct', label: 'Forward Margin (%)',  placeholder: '0.350' },
              { key: 'credit_limit_eur',      label: 'Credit Limit (EUR)',  placeholder: '500000' },
              { key: 'min_deal_size_eur',     label: 'Min. Deal Size (EUR)',placeholder: '10000' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>{label}</label>
                <input type="number" step="0.001" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder} className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Spot Spread',     value: fmtPct(pd.fx_spot_spread_pct) },
              { label: 'Forward Margin',  value: fmtPct(pd.fx_forward_margin_pct) },
              { label: 'Credit Limit',    value: fmtCurrency(pd.credit_limit_eur) },
              { label: 'Min. Deal Size',  value: fmtCurrency(pd.min_deal_size_eur) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg p-3 border border-[#e8eaf2]">
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#7b859e' }}>{label}</p>
                <p className="text-sm font-bold" style={{ color: '#011745' }}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Trade Finance Pricing sectie ═══ */}
      {(pd.tapertrade_active || editing) && (
        <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: '#f7f8fc' }}>
          <h4 className="text-xs font-semibold uppercase flex items-center gap-1.5" style={{ color: '#7b859e' }}>
            <Banknote size={12} /> Trade Finance Pricing
          </h4>
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'tf_interest_rate_pct', label: 'Rente (%)',             placeholder: '6.5' },
                { key: 'tf_fee_pct',           label: 'Arrangement Fee (%)', placeholder: '1.0' },
                { key: 'tf_closing_fee_pct',   label: 'Afsluitprovisie (%)', placeholder: '0.5' },
                { key: 'payment_terms_days',   label: 'Betaaltermijn (dagen)', placeholder: '90' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>{label}</label>
                  <input type="number" step="0.01" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4]"
                    style={{ color: '#011745' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Rente',            value: fmtPct(pd.tf_interest_rate_pct) },
                { label: 'Arrangement Fee', value: fmtPct(pd.tf_fee_pct) },
                { label: 'Afsluitprovisie', value: fmtPct(pd.tf_closing_fee_pct) },
                { label: 'Betaaltermijn',   value: fmtDays(pd.payment_terms_days) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-lg p-3 border border-[#e8eaf2]">
                  <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#7b859e' }}>{label}</p>
                  <p className="text-sm font-bold" style={{ color: '#011745' }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Pricing Notities ═══ */}
      <div className="rounded-xl p-4" style={{ backgroundColor: '#f7f8fc' }}>
        <h4 className="text-xs font-semibold uppercase mb-3 flex items-center gap-1.5" style={{ color: '#7b859e' }}>
          <FileText size={12} /> Prijsafspraken & Notities
        </h4>
        {editing ? (
          <textarea value={form.pricing_notes} onChange={e => setForm({ ...form, pricing_notes: e.target.value })}
            rows={4} placeholder="Noteer specifieke prijsafspraken, kortingen of bijzondere condities..."
            className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm bg-white focus:outline-none focus:border-[#3d61a4] resize-none"
            style={{ color: '#011745' }} />
        ) : (
          pd.pricing_notes ? (
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#566079' }}>{pd.pricing_notes}</p>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: '#a4abbe' }}>Nog geen prijsafspraken vastgelegd</p>
          )
        )}
      </div>

      {/* ═══ Revenue Potentie (uit lead fase) ═══ */}
      <RevenueForecastWidget revenuePotential={lead?.revenue_potential} />
    </div>
  );
}


/* ─── KYC Profile Section ─── */

export default KYCInfoTab;
