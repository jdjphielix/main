import React, { useState, useEffect } from 'react';
import {
  X, Phone, Video, Clock, Building2, User, Check, Loader2, Calendar,
  AlertCircle, ChevronRight
} from 'lucide-react';

export default function CallbacksPopup({ isOpen, onClose, onOpenAgenda }) {
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  const getToken = () => sessionStorage.getItem('auth_token');

  useEffect(() => {
    if (isOpen) {
      fetchCallbacks();
    }
  }, [isOpen]);

  async function fetchCallbacks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/callbacks/?today_only=true', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Kon callbacks niet ophalen');
      const data = await res.json();
      setCallbacks(data.callbacks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(callbackId) {
    setCompletingId(callbackId);
    try {
      const res = await fetch(`/api/v1/callbacks/${callbackId}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Kon callback niet afronden');
      // Remove from list
      setCallbacks(prev => prev.filter(cb => cb.id !== callbackId));
    } catch (err) {
      alert(err.message);
    } finally {
      setCompletingId(null);
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-popup w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e8eaf2] flex items-center justify-between"
          style={{ backgroundColor: '#f7f8fc' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#eef2fa' }}>
              <Calendar size={20} style={{ color: '#3d61a4' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#011745' }}>
                Callbacks Vandaag
              </h2>
              <p className="text-xs" style={{ color: '#7b859e' }}>
                {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAgenda && (
              <button
                onClick={() => { onClose(); setTimeout(() => onOpenAgenda(), 100); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#e8eaf2]"
                style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}
                title="Open callback agenda"
              >
                <Calendar size={14} />
                Agenda
              </button>
            )}
            <button onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#e8eaf2] transition-colors"
              style={{ color: '#7b859e' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: '#3d61a4' }} />
              <p className="text-sm" style={{ color: '#7b859e' }}>Callbacks laden...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle size={28} style={{ color: '#df2f4a' }} />
              <p className="text-sm" style={{ color: '#df2f4a' }}>{error}</p>
              <button onClick={fetchCallbacks}
                className="text-sm font-medium px-4 py-2 rounded-lg"
                style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}>
                Opnieuw proberen
              </button>
            </div>
          ) : callbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#eef2fa' }}>
                <Check size={28} style={{ color: '#3d61a4' }} />
              </div>
              <p className="text-base font-semibold" style={{ color: '#011745' }}>
                Geen callbacks vandaag
              </p>
              <p className="text-sm text-center" style={{ color: '#7b859e' }}>
                Er zijn geen callbacks gepland voor vandaag. Geniet van een rustige dag!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {callbacks.map((cb) => {
                const overdue = isOverdue(cb.scheduled_at);
                const leadName = cb.lead?.company_name || `Lead #${cb.lead_id}`;
                const contactName = cb.lead?.contact_name;
                const contactPhone = cb.lead?.contact_mobile || cb.lead?.contact_phone;
                const isCall = cb.callback_type === 'call';

                return (
                  <div key={cb.id}
                    className="rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                    style={{
                      borderColor: overdue ? '#fecaca' : '#e8eaf2',
                      backgroundColor: overdue ? '#fef2f2' : '#fff',
                    }}>
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isCall ? '#eef2fa' : '#f0fdf4',
                          }}>
                          {isCall
                            ? <Phone size={16} style={{ color: '#3d61a4' }} />
                            : <Video size={16} style={{ color: '#16a34a' }} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate" style={{ color: '#011745' }}>
                              {leadName}
                            </span>
                            {overdue && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 flex-shrink-0">
                                TE LAAT
                              </span>
                            )}
                          </div>
                          {contactName && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: '#566079' }}>
                              <User size={11} className="inline mr-1" />
                              {contactName}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs font-medium flex items-center gap-1"
                              style={{ color: overdue ? '#dc2626' : '#3d61a4' }}>
                              <Clock size={12} />
                              {formatTime(cb.scheduled_at)}
                            </span>
                            {contactPhone && (
                              <a href={`tel:${contactPhone}`}
                                className="text-xs font-medium flex items-center gap-1 hover:underline"
                                style={{ color: '#3d61a4' }}>
                                <Phone size={11} />
                                {contactPhone}
                              </a>
                            )}
                          </div>
                          {cb.internal_note && (
                            <p className="text-xs mt-2 p-2 rounded-lg" style={{ backgroundColor: '#f7f8fc', color: '#566079' }}>
                              {cb.internal_note}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: complete button */}
                      <button
                        onClick={() => handleComplete(cb.id)}
                        disabled={completingId === cb.id}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{
                          backgroundColor: completingId === cb.id ? '#e8eaf2' : '#eef2fa',
                          color: '#3d61a4',
                        }}
                        title="Markeer als afgerond"
                      >
                        {completingId === cb.id
                          ? <Loader2 size={16} className="animate-spin" />
                          : <Check size={16} />
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && callbacks.length > 0 && (
          <div className="px-6 py-3 border-t border-[#e8eaf2] flex items-center justify-between"
            style={{ backgroundColor: '#f7f8fc' }}>
            <span className="text-xs" style={{ color: '#7b859e' }}>
              {callbacks.length} callback{callbacks.length !== 1 ? 's' : ''} vandaag
            </span>
            <span className="text-xs font-medium" style={{ color: '#3d61a4' }}>
              Klik ✓ om af te ronden
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
