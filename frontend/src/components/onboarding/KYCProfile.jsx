import React, { useState } from 'react';
import {
  Building2, Globe, Mail, Phone, Shield, CheckCircle2, AlertCircle,
  Loader2, Edit3, X, Save, ExternalLink, ChevronDown
} from 'lucide-react';
import { token } from './onboardingHelpers';

function KYCProfile({ lead, prospectData, onBrokerChange }) {
  const [open, setOpen] = useState(true);
  const [savingBroker, setSavingBroker] = useState(false);
  const pd = prospectData?.prospect_data || prospectData;
  const currencies = pd?.currencies || [];

  const BROKERS = [
    { value: 'ibanfirst', label: 'IBanFirst',      color: '#3d61a4', bg: '#eef2fa' },
    { value: 'corpay',    label: 'Corpay',          color: '#0a2d6b', bg: '#e8eaf2' },
    { value: 'ebury',     label: 'Ebury',           color: '#166534', bg: '#dcfce7' },
    { value: 'alt21',     label: 'Alt21',           color: '#92400e', bg: '#fef3c7' },
  ];

  async function handleBrokerChange(newBroker) {
    setSavingBroker(true);
    try {
      await api(`/api/v1/prospects/${lead.id}/prospect-data`, {
        method: 'PUT',
        body: JSON.stringify({ selected_broker: newBroker || null }),
      });
      if (onBrokerChange) onBrokerChange(newBroker);
    } catch (e) { console.error('Broker save failed:', e); }
    finally { setSavingBroker(false); }
  }

  return (
    <div className="mb-6">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left mb-3">
        <Shield size={16} style={{ color: '#011745' }} />
        <h3 className="font-semibold" style={{ color: '#011745' }}>KYC Profiel & Financiële Data</h3>
        {open ? <ChevronUp size={14} style={{ color: '#7b859e' }} /> : <ChevronDown size={14} style={{ color: '#7b859e' }} />}
      </button>

      {open && (
        <div className="space-y-4">
          {/* Company info */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#f7f8fc' }}>
            <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Bedrijfsinformatie</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span style={{ color: '#a4abbe' }}>Bedrijf:</span> <span style={{ color: '#011745' }} className="font-medium">{lead.company_name}</span></div>
              <div><span style={{ color: '#a4abbe' }}>Land:</span> <span style={{ color: '#011745' }}>{lead.company_country || '—'}</span></div>
              <div><span style={{ color: '#a4abbe' }}>Sector:</span> <span style={{ color: '#011745' }}>{lead.company_industry || '—'}</span></div>
              <div><span style={{ color: '#a4abbe' }}>Omvang:</span> <span style={{ color: '#011745' }}>{lead.company_size || '—'}</span></div>
              <div><span style={{ color: '#a4abbe' }}>KvK:</span> <span style={{ color: '#011745' }}>{lead.kvk_number || '—'}</span></div>
              <div><span style={{ color: '#a4abbe' }}>Website:</span> <span style={{ color: '#011745' }}>{lead.company_website || '—'}</span></div>
            </div>
          </div>

          {/* Products & broker */}
          {pd && (
            <div className="rounded-xl p-4" style={{ backgroundColor: '#f7f8fc' }}>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Producten & Broker</h4>
              <div className="flex gap-2 mb-3 flex-wrap">
                {pd.taperpay_active && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#eef2fa] text-[#3d61a4]">TaperPay Actief</span>
                )}
                {pd.tapertrade_active && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#fef3c7] text-[#92400e]">TaperTrade Actief</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium" style={{ color: '#566079' }}>Broker selectie:</label>
                  {savingBroker && <Loader2 size={12} className="animate-spin" style={{ color: '#3d61a4' }} />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {BROKERS.map(b => {
                    const isSelected = pd.selected_broker === b.value;
                    return (
                      <button
                        key={b.value}
                        type="button"
                        disabled={savingBroker}
                        onClick={() => handleBrokerChange(isSelected ? null : b.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all disabled:opacity-50"
                        style={isSelected
                          ? { backgroundColor: b.color, borderColor: b.color, color: '#fff' }
                          : { backgroundColor: b.bg, borderColor: b.bg, color: b.color }
                        }>
                        {b.label}
                      </button>
                    );
                  })}
                  {pd.selected_broker && (
                    <button
                      type="button"
                      disabled={savingBroker}
                      onClick={() => handleBrokerChange(null)}
                      className="px-2 py-1.5 rounded-lg text-xs border-2 border-dashed border-[#e8eaf2] text-[#a4abbe] hover:border-red-300 hover:text-red-400 transition-all disabled:opacity-50">
                      ✕ Wis
                    </button>
                  )}
                </div>
              </div>
              {pd.strategy_notes && (
                <p className="text-xs mt-1" style={{ color: '#566079' }}>{pd.strategy_notes}</p>
              )}
            </div>
          )}

          {/* FX Volumes */}
          {pd && (pd.fx_estimated_volume || pd.tf_estimated_volume) && (
            <div className="rounded-xl p-4" style={{ backgroundColor: '#f7f8fc' }}>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Volumes & Revenue</h4>
              <div className="grid grid-cols-2 gap-4">
                {pd.fx_estimated_volume > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-[#e8eaf2]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign size={12} style={{ color: '#3d61a4' }} />
                      <span className="text-[10px] font-semibold uppercase" style={{ color: '#3d61a4' }}>FX</span>
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#011745' }}>{fmtCurrency(pd.fx_estimated_volume)}</p>
                    <p className="text-[10px]" style={{ color: '#7b859e' }}>Marge: {fmtPct(pd.fx_estimated_margin_pct)} = {fmtCurrency(pd.fx_estimated_revenue)}</p>
                  </div>
                )}
                {pd.tf_estimated_volume > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-[#e8eaf2]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp size={12} style={{ color: '#92400e' }} />
                      <span className="text-[10px] font-semibold uppercase" style={{ color: '#92400e' }}>Trade Finance</span>
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#011745' }}>{fmtCurrency(pd.tf_estimated_volume)}</p>
                    <p className="text-[10px]" style={{ color: '#7b859e' }}>Marge: {fmtPct(pd.tf_estimated_margin_pct)} = {fmtCurrency(pd.tf_estimated_revenue)}</p>
                  </div>
                )}
              </div>
              {pd.tapertrade_active && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {pd.tf_debtor_finance && <span className="text-[10px] px-2 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">Debtor Finance</span>}
                  {pd.tf_portfolio_finance && <span className="text-[10px] px-2 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">Portfolio Finance</span>}
                  {pd.tf_voorraad_finance && <span className="text-[10px] px-2 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">Voorraad Finance</span>}
                  {pd.tf_total_financing_need > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#f3f4f8] text-[#566079]">Totaal: {fmtCurrency(pd.tf_total_financing_need)}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Currencies & Countries */}
          {currencies.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: '#f7f8fc' }}>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Valuta & Landen</h4>
              <div className="grid grid-cols-2 gap-2">
                {['buying_currency', 'selling_currency', 'incoming_country', 'outgoing_country'].map(type => {
                  const items = currencies.filter(c => c.currency_type === type);
                  if (items.length === 0) return null;
                  const typeLabels = {
                    buying_currency: 'Koop valuta',
                    selling_currency: 'Verkoop valuta',
                    incoming_country: 'Inkomend land',
                    outgoing_country: 'Uitgaand land',
                  };
                  return (
                    <div key={type} className="bg-white rounded-lg p-2.5 border border-[#e8eaf2]">
                      <span className="text-[10px] font-semibold uppercase block mb-1" style={{ color: '#7b859e' }}>
                        {typeLabels[type]}
                      </span>
                      {items.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs py-0.5">
                          <span className="font-semibold" style={{ color: '#011745' }}>{c.value}</span>
                          {c.volume && <span style={{ color: '#7b859e' }}>{fmtCurrency(c.volume)}</span>}
                          {c.notes && <span className="text-[10px] truncate ml-1" style={{ color: '#a4abbe' }}>({c.notes})</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact info */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#f7f8fc' }}>
            <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Contactpersoon</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span style={{ color: '#a4abbe' }}>Naam:</span> <span style={{ color: '#011745' }} className="font-medium">{lead.contact_name || '—'}</span></div>
              <div><span style={{ color: '#a4abbe' }}>Functie:</span> <span style={{ color: '#011745' }}>{lead.contact_position || '—'}</span></div>
              <div><span style={{ color: '#a4abbe' }}>Email:</span> <span style={{ color: '#011745' }}>{lead.contact_email || '—'}</span></div>
              <div><span style={{ color: '#a4abbe' }}>Telefoon:</span> <span style={{ color: '#011745' }}>{lead.contact_phone || lead.contact_mobile || '—'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Main Onboarding Page ─── */

export default KYCProfile;
