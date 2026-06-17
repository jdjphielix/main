import React, { useState, useEffect } from 'react';
import {
  X, Phone, Clock, Building2, User, Check, Loader2,
  AlertCircle, Trash2, GripVertical
} from 'lucide-react';

const STAGE_LABELS = {
  lead: { label: 'Lead', bg: '#eef2fa', color: '#3d61a4' },
  prospect: { label: 'Prospect', bg: '#fef3c7', color: '#92400e' },
  onboarding_sales: { label: 'Onboarding', bg: '#f0fdf4', color: '#16a34a' },
  onboarding_backoffice: { label: 'Onboarding BO', bg: '#f0fdf4', color: '#16a34a' },
  client: { label: 'Client', bg: '#f3f4f8', color: '#011745' },
};

export default function BellijstPopup({ isOpen, onClose }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDailyList();
    }
  }, [isOpen]);

  async function fetchDailyList() {
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/v1/leads/?is_on_daily_list=true&page_size=100&all_stages=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Kon bellijst niet ophalen');
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(leadId) {
    setRemovingId(leadId);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/leads/${leadId}/from-daily-list`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Kon niet verwijderen van bellijst');
      setLeads(prev => prev.filter(l => l.id !== leadId));
    } catch (err) {
      alert(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e8eaf2] flex items-center justify-between"
          style={{ backgroundColor: '#f7f8fc' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#eef2fa' }}>
              <Phone size={20} style={{ color: '#3d61a4' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#011745' }}>
                Mijn Bellijst
              </h2>
              <p className="text-xs" style={{ color: '#7b859e' }}>
                {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#e8eaf2] transition-colors"
            style={{ color: '#7b859e' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: '#3d61a4' }} />
              <p className="text-sm" style={{ color: '#7b859e' }}>Bellijst laden...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle size={28} style={{ color: '#df2f4a' }} />
              <p className="text-sm" style={{ color: '#df2f4a' }}>{error}</p>
              <button onClick={fetchDailyList}
                className="text-sm font-medium px-4 py-2 rounded-lg"
                style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}>
                Opnieuw proberen
              </button>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#eef2fa' }}>
                <Phone size={28} style={{ color: '#3d61a4' }} />
              </div>
              <p className="text-base font-semibold" style={{ color: '#011745' }}>
                Bellijst is leeg
              </p>
              <p className="text-sm text-center" style={{ color: '#7b859e' }}>
                Voeg leads toe aan je bellijst vanuit de Leads pagina.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead, index) => (
                <div key={lead.id}
                  className="rounded-xl border border-[#e8eaf2] p-4 transition-all hover:shadow-md hover:border-[#3d61a4]/30 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: position + info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#011745' }}>
                          {lead.company_name || `Lead #${lead.id}`}
                        </p>
                        {lead.contact_name && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#566079' }}>
                            <User size={11} className="inline mr-1" />
                            {lead.contact_name}
                            {lead.contact_position && ` — ${lead.contact_position}`}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {(lead.contact_mobile || lead.contact_phone) && (
                            <a href={`tel:${lead.contact_mobile || lead.contact_phone}`}
                              className="text-xs font-medium flex items-center gap-1 hover:underline"
                              style={{ color: '#3d61a4' }}
                              onClick={(e) => e.stopPropagation()}>
                              <Phone size={11} />
                              {lead.contact_mobile || lead.contact_phone}
                            </a>
                          )}
                          {lead.pipeline_stage && (() => {
                            const stage = STAGE_LABELS[lead.pipeline_stage] || { label: lead.pipeline_stage, bg: '#f3f4f8', color: '#566079' };
                            return (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: stage.bg, color: stage.color }}>
                                {stage.label}
                              </span>
                            );
                          })()}
                          {lead.status && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#f3f4f8', color: '#7b859e' }}>
                              {lead.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: call + remove buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(lead.contact_mobile || lead.contact_phone) && (
                        <a href={`tel:${lead.contact_mobile || lead.contact_phone}`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                          style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                          title="Bellen">
                          <Phone size={16} />
                        </a>
                      )}
                      <button
                        onClick={() => handleRemove(lead.id)}
                        disabled={removingId === lead.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{
                          backgroundColor: removingId === lead.id ? '#e8eaf2' : '#fef2f2',
                          color: '#dc2626',
                        }}
                        title="Verwijder van bellijst"
                      >
                        {removingId === lead.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && leads.length > 0 && (
          <div className="px-6 py-3 border-t border-[#e8eaf2] flex items-center justify-between"
            style={{ backgroundColor: '#f7f8fc' }}>
            <span className="text-xs" style={{ color: '#7b859e' }}>
              {leads.length} contact{leads.length !== 1 ? 'en' : ''} te bellen
            </span>
            <span className="text-xs font-medium" style={{ color: '#3d61a4' }}>
              Klik het telefoontje om te bellen
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
