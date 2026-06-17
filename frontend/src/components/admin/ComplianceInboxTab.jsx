import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { api, token, BROKERS, BrokerPicker } from './adminHelpers';
import { CheckCircle2, X } from 'lucide-react';

function ComplianceInboxTab() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ignoredIds, setIgnoredIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('compliance_inbox_ignored') || '[]'); }
    catch { return []; }
  });

  // Create-from-email form state
  const [createFromEmail, setCreateFromEmail] = useState(null); // the email being turned into a ticket
  const [createForm, setCreateForm] = useState({ title: '', description: '', priority: 'normal', broker: null, lead_id: null });
  const [creating, setCreating] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const fetchProposed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/api/v1/compliance/proposed');
      setEmails(res.emails || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProposed(); }, [fetchProposed]);

  function ignoreEmail(id) {
    const next = [...ignoredIds, id];
    setIgnoredIds(next);
    localStorage.setItem('compliance_inbox_ignored', JSON.stringify(next));
  }

  function openCreateForm(email) {
    setCreateFromEmail(email);
    setCreateForm({
      title: email.subject || 'Compliance Request',
      description: email.snippet || '',
      priority: 'normal',
      broker: null,
      lead_id: email.lead_id,
    });
  }

  async function submitCreateCase() {
    if (!createFromEmail || !createForm.title.trim()) return;
    setCreating(true);
    try {
      await api('/api/v1/compliance/cases/from-email', {
        method: 'POST',
        body: JSON.stringify({
          email_id: createFromEmail.id,
          title: createForm.title,
          description: createForm.description,
          priority: createForm.priority,
          broker: createForm.broker,
          lead_id: createForm.lead_id,
        }),
      });
      setCreateFromEmail(null);
      fetchProposed();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setCreating(false); }
  }

  const visible = emails.filter(e => !ignoredIds.includes(e.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: '#011745' }}>Compliance Inbox</h2>
          <p className="text-xs mt-0.5" style={{ color: '#7b859e' }}>
            Inkomende e-mails met compliance-gerelateerde inhoud uit de afgelopen 30 dagen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setScanLoading(true);
              try {
                await fetch('/api/v1/compliance/scan-inbox', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token()}` }
                });
                fetchProposed(); // refresh the list
              } catch (e) { console.error(e); }
              finally { setScanLoading(false); }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#3d61a4', color: 'white' }}>
            {scanLoading ? <span className="animate-spin inline-block">⟳</span> : '⟳'} Scan inbox
          </button>
          <button onClick={fetchProposed}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e8eaf2] hover:bg-[#f7f8fc] transition-all"
            style={{ color: '#566079' }}>
            <RefreshCw size={13} /> Vernieuwen
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} /><span className="text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[#e8eaf2]">
          <Mail size={40} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
          <p className="font-semibold" style={{ color: '#011745' }}>Geen voorgestelde e-mails</p>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>Er zijn geen nieuwe compliance-gerelateerde e-mails gevonden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(email => (
            <div key={email.id} className="bg-white rounded-xl border border-[#e8eaf2] p-4 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: '#011745' }}>
                  {(email.lead_name || email.from_email || '?').charAt(0).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-semibold truncate" style={{ color: '#011745' }}>
                      {email.lead_name || '—'}
                    </p>
                    <span className="text-[10px] flex-shrink-0" style={{ color: '#a4abbe' }}>
                      {email.received_at ? new Date(email.received_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: '#566079' }}>
                    {email.from_email}
                  </p>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#3d61a4' }}>
                    {email.subject}
                  </p>
                  {email.snippet && (
                    <p className="text-xs line-clamp-2" style={{ color: '#7b859e' }}>
                      {email.snippet}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[#f3f4f8]">
                <button onClick={() => ignoreEmail(email.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e8eaf2] hover:border-red-200 hover:text-red-400 transition-all"
                  style={{ color: '#a4abbe' }}>
                  Negeren
                </button>
                <button onClick={() => openCreateForm(email)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#3d61a4' }}>
                  <Plus size={12} /> Aanmaken als ticket
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create-from-email modal */}
      {createFromEmail && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCreateFromEmail(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaf2] sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold" style={{ color: '#011745' }}>Ticket aanmaken</h3>
              <button onClick={() => setCreateFromEmail(null)} className="p-2 rounded-lg hover:bg-[#f3f4f8] transition-colors">
                <X size={18} style={{ color: '#566079' }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Email info */}
              <div className="p-3 rounded-xl border border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: '#a4abbe' }}>E-mail bron</p>
                <p className="text-xs font-medium" style={{ color: '#011745' }}>{createFromEmail.from_email}</p>
                <p className="text-xs mt-0.5 italic" style={{ color: '#7b859e' }}>{createFromEmail.subject}</p>
              </div>

              {/* Klant */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Klant</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#eef2fa' }}>
                  <CheckCircle2 size={14} style={{ color: '#3d61a4' }} />
                  <span className="text-sm font-medium" style={{ color: '#3d61a4' }}>{createFromEmail.lead_name || `Lead #${createFromEmail.lead_id}`}</span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Titel *</label>
                <input type="text" value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Notities</label>
                <textarea value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                  style={{ color: '#011745' }} />
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Prioriteit</label>
                <select value={createForm.priority}
                  onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }}>
                  <option value="low">Laag</option>
                  <option value="normal">Normaal</option>
                  <option value="high">Hoog</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Broker */}
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Broker / Kanaal</label>
                <BrokerPicker value={createForm.broker} onChange={v => setCreateForm({ ...createForm, broker: v })} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8eaf2] flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setCreateFromEmail(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#7b859e' }}>
                Annuleer
              </button>
              <button onClick={submitCreateCase}
                disabled={creating || !createForm.title.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#3d61a4' }}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Aanmaken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: Compliance Overzicht
   ═══════════════════════════════════════════════════════════════ */

export default ComplianceInboxTab;
