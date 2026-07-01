import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, AlertCircle, Shield, Clock, CheckCircle2, X, Save,
  Mail, FileText, AlertTriangle, ChevronDown, Search, Trash2
} from 'lucide-react';
import { api, BROKERS, BrokerPicker, DropZone, token, STATUS_COLORS, PRIORITY_COLORS } from './adminHelpers';

function EmailThreadCard({ email }) {
  const [expanded, setExpanded] = useState(false);
  const isOutbound = email.direction === 'outbound';
  const sender = email.from_email || '';
  const initial = sender.charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: isOutbound ? '#c7d7f0' : '#e8eaf2', backgroundColor: isOutbound ? '#f0f5ff' : '#fff' }}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:opacity-90 transition-all"
        onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: isOutbound ? '#3d61a4' : '#011745' }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold truncate" style={{ color: '#011745' }}>
              {isOutbound ? 'Jij' : sender}
            </p>
            <span className="text-[10px] flex-shrink-0" style={{ color: '#a4abbe' }}>
              {email.received_at
                ? new Date(email.received_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—'}
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: '#7b859e' }}>
            {isOutbound ? `Aan: ${email.to_email}` : `Van: ${sender}`}
          </p>
          {email.subject && (
            <p className="text-xs font-medium mt-0.5 truncate" style={{ color: '#3d61a4' }}>{email.subject}</p>
          )}
          {!expanded && email.snippet && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: '#566079' }}>{email.snippet}</p>
          )}
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          style={{ color: '#a4abbe' }} />
      </button>

      {expanded && email.body_html && (
        <div className="px-4 pb-4 border-t border-[#f3f4f8]">
          <div
            className="mt-3 text-xs rounded-lg p-3 overflow-auto max-h-72"
            style={{ backgroundColor: '#f7f8fc', color: '#252f4a', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: email.body_html }}
          />
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: Compliance Inbox
   ═══════════════════════════════════════════════════════════════ */

function ComplianceTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Slide-in case detail
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseEdit, setCaseEdit] = useState(null); // edited copy
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailTab, setDetailTab] = useState('details'); // 'details' | 'correspondentie'

  // Correspondentie tab state
  const [thread, setThread] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [replySending, setReplySending] = useState(false);

  // Create new case
  const [showCreate, setShowCreate] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [createForm, setCreateForm] = useState({ lead_id: null, lead_name: '', title: '', description: '', priority: 'normal', broker: null });
  const [creating, setCreating] = useState(false);
  const [createUploading, setCreateUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // files to attach after case creation

  const fetchCompliance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await api(`/api/v1/admin/compliance${params}`);
      setData(res);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchCompliance(); }, [fetchCompliance]);

  // Fetch clients for create form
  useEffect(() => {
    if (!showCreate) return;
    fetch(`/api/v1/leads/?page_size=200&pipeline_stage=client`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()).then(d => setClients(d.leads || [])).catch(() => {});
  }, [showCreate]);

  async function openCase(c) {
    setSelectedCase(c);
    setCaseEdit({ ...c });
    setDetailTab('details');
    setReplyText('');
    setReplyTo('');
    setThread([]);  // Clear previous thread so it doesn't flash when switching cases
  }

  async function fetchThread(caseId, latestInboundFrom) {
    setThreadLoading(true);
    try {
      const res = await api(`/api/v1/compliance/cases/${caseId}/thread`);
      const emails = res.emails || [];
      setThread(emails);
      // Auto-fill reply-to with the most recent inbound sender
      const inbound = [...emails].reverse().find(e => e.direction === 'inbound');
      if (inbound) {
        // Extract bare email from "Name <email>" format
        const match = inbound.from_email.match(/<(.+?)>/);
        setReplyTo(match ? match[1] : inbound.from_email);
      } else if (latestInboundFrom) {
        setReplyTo(latestInboundFrom);
      }
    } catch (err) { console.error('Thread load error:', err); }
    finally { setThreadLoading(false); }
  }

  async function sendReply() {
    if (!replyText.trim() || !replyTo.trim()) return;
    setReplySending(true);
    try {
      await api(`/api/v1/compliance/cases/${selectedCase.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText, to_email: replyTo }),
      });
      setReplyText('');
      await fetchThread(selectedCase.id);
    } catch (err) { alert('Fout bij verzenden: ' + err.message); }
    finally { setReplySending(false); }
  }

  async function saveCase() {
    setSaving(true);
    try {
      await api(`/api/v1/admin/compliance/${caseEdit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: caseEdit.title,
          description: caseEdit.description,
          status: caseEdit.status,
          priority: caseEdit.priority,
          broker: caseEdit.broker,
          resolution_notes: caseEdit.resolution_notes,
        }),
      });
      // Refresh the list and update selected
      await fetchCompliance();
      // Update local selected case
      setSelectedCase(prev => ({ ...prev, ...caseEdit }));
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setSaving(false); }
  }

  async function deleteCase(c) {
    // Uses the per-lead compliance DELETE endpoint (case + linked case-documents).
    if (!c || !c.lead_id) { alert('Kan case niet verwijderen: lead onbekend'); return; }
    if (!window.confirm('Weet je zeker dat je deze compliance case wilt verwijderen? Dit verwijdert ook de gekoppelde documentkoppelingen.')) return;
    setSaving(true);
    try {
      await api(`/api/v1/leads/${c.lead_id}/compliance/${c.id}`, { method: 'DELETE' });
      setSelectedCase(null);
      setCaseEdit(null);
      fetchCompliance();
    } catch (err) { alert('Verwijderen mislukt: ' + err.message); }
    finally { setSaving(false); }
  }

  async function uploadToCase(caseId, leadId, files) {
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch(`/api/v1/documents/upload?lead_id=${leadId}&category=compliance`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
          body: fd,
        });
        if (!uploadRes.ok) throw new Error('Upload mislukt');
        const uploaded = await uploadRes.json();
        await api(`/api/v1/leads/${leadId}/compliance/${caseId}/documents`, {
          method: 'POST',
          body: JSON.stringify({ document_id: uploaded.id }),
        });
      }
      // Refresh case detail
      const fresh = await api(`/api/v1/admin/compliance/${caseId}`);
      setSelectedCase(fresh);
      setCaseEdit(fresh);
      fetchCompliance();
    } catch (err) { alert('Fout bij uploaden: ' + err.message); }
    finally { setUploading(false); }
  }

  async function createCase() {
    if (!createForm.lead_id || !createForm.title.trim()) return;
    setCreating(true);
    try {
      const result = await api('/api/v1/admin/compliance', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: createForm.lead_id,
          title: createForm.title,
          description: createForm.description,
          priority: createForm.priority,
          broker: createForm.broker,
        }),
      });
      // Upload pending files
      if (pendingFiles.length > 0) {
        setCreateUploading(true);
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          const uploadRes = await fetch(`/api/v1/documents/upload?lead_id=${createForm.lead_id}&category=compliance`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` },
            body: fd,
          });
          if (uploadRes.ok) {
            const uploaded = await uploadRes.json();
            await api(`/api/v1/leads/${createForm.lead_id}/compliance/${result.id}/documents`, {
              method: 'POST',
              body: JSON.stringify({ document_id: uploaded.id }),
            });
          }
        }
        setCreateUploading(false);
      }
      setShowCreate(false);
      setCreateForm({ lead_id: null, lead_name: '', title: '', description: '', priority: 'normal', broker: null });
      setPendingFiles([]);
      setClientSearch('');
      fetchCompliance();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setCreating(false); setCreateUploading(false); }
  }

  const filteredClients = clients.filter(c =>
    (c.company_name || '').toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 8);

  const brokerLabel = (key) => BROKERS.find(b => b.key === key)?.label || key;

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div /> {/* Spacer */}
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all"
          style={{ backgroundColor: '#3d61a4' }}>
          <Plus size={16} /> Nieuwe Ticket
        </button>
      </div>

      {/* Status summary */}
      {data?.counts && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'open', icon: AlertTriangle, count: data.counts.open },
            { key: 'in_progress', icon: Clock, count: data.counts.in_progress },
            { key: 'resolved', icon: CheckCircle2, count: data.counts.resolved },
            { key: 'closed', icon: Shield, count: data.counts.closed },
          ].map(item => {
            const sc = STATUS_COLORS[item.key];
            return (
              <div key={item.key}
                onClick={() => setStatusFilter(statusFilter === item.key ? 'all' : item.key)}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm ${
                  statusFilter === item.key ? 'border-[#3d61a4] ring-1 ring-[#3d61a4]/20' : 'border-[#e8eaf2]'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <item.icon size={16} style={{ color: sc.text }} />
                  <span className="text-xs font-semibold" style={{ color: sc.text }}>{sc.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: '#011745' }}>{item.count}</p>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={20} /><span className="text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
        </div>
      ) : data?.cases?.length > 0 ? (
        <div className="bg-white rounded-xl border border-[#e8eaf2] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#f7f8fc' }}>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Case</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Klant</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Broker</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Prioriteit</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Aangemaakt</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Door</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Docs</th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map(c => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open;
                const pc = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.normal;
                return (
                  <tr key={c.id}
                    onClick={() => openCase(c)}
                    className="border-t border-[#f3f4f8] hover:bg-[#eef2fa] transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#011745' }}>{c.title}</p>
                        {c.description && (
                          <p className="text-xs mt-0.5 truncate max-w-[220px]" style={{ color: '#7b859e' }}>{c.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#011745' }}>
                          {(c.company_name || '?').charAt(0)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: '#011745' }}>{c.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.broker ? (
                        <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
                          style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>{brokerLabel(c.broker)}</span>
                      ) : <span className="text-xs" style={{ color: '#cdd1e0' }}>—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] px-2 py-1 rounded-full font-semibold"
                        style={{ backgroundColor: pc.bg, color: pc.text }}>{pc.label}</span>
                    </td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <select value={c.status}
                        onChange={e => { e.stopPropagation(); api(`/api/v1/admin/compliance/${c.id}`, { method: 'PUT', body: JSON.stringify({ status: e.target.value }) }).then(fetchCompliance); }}
                        className="text-[10px] font-semibold px-2 py-1 rounded-full border-0 cursor-pointer"
                        style={{ backgroundColor: sc.bg, color: sc.text }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Behandeling</option>
                        <option value="resolved">Opgelost</option>
                        <option value="closed">Gesloten</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs" style={{ color: '#7b859e' }}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs" style={{ color: '#7b859e' }}>{c.created_by_name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {c.document_count > 0 ? (
                        <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#3d61a4' }}>
                          <FileText size={12} /> {c.document_count}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#a4abbe' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-[#e8eaf2]">
          <Shield size={40} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
          <p className="font-semibold" style={{ color: '#011745' }}>Geen compliance cases</p>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>Maak een nieuwe ticket aan of cases worden aangemaakt vanuit de klantpagina</p>
        </div>
      )}

      {/* ═══ SLIDE-IN CASE DETAIL PANEL ═══ */}
      {selectedCase && caseEdit && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedCase(null)} />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            style={{ borderLeft: '1px solid #e8eaf2' }}>

            {/* Header */}
            <div className="px-6 pt-4 pb-0 border-b border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-semibold mb-0.5" style={{ color: '#a4abbe' }}>
                    {selectedCase.company_name}
                  </p>
                  <h3 className="text-base font-bold truncate" style={{ color: '#011745' }}>{selectedCase.title}</h3>
                </div>
                <button onClick={() => setSelectedCase(null)}
                  className="ml-3 p-2 rounded-lg hover:bg-[#e8eaf2] transition-colors flex-shrink-0">
                  <X size={18} style={{ color: '#566079' }} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                {[
                  { key: 'details', label: 'Details' },
                  { key: 'correspondentie', label: 'Correspondentie', badge: selectedCase.gmail_thread_id ? null : null },
                ].map(tab => (
                  <button key={tab.key}
                    onClick={() => {
                      setDetailTab(tab.key);
                      if (tab.key === 'correspondentie' && thread.length === 0) {
                        fetchThread(selectedCase.id);
                      }
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                      detailTab === tab.key
                        ? 'border-[#3d61a4] text-[#3d61a4] bg-white'
                        : 'border-transparent text-[#7b859e] hover:text-[#566079]'
                    }`}>
                    {tab.label}
                    {tab.key === 'correspondentie' && selectedCase.gmail_thread_id && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                        style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                        <Mail size={9} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab: Details ── */}
            {detailTab === 'details' && (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Titel</label>
                    <input type="text" value={caseEdit.title}
                      onChange={e => setCaseEdit({ ...caseEdit, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                      style={{ color: '#011745' }} />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Omschrijving</label>
                    <textarea value={caseEdit.description || ''}
                      onChange={e => setCaseEdit({ ...caseEdit, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                      style={{ color: '#011745' }} />
                  </div>

                  {/* Status + Priority row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Status</label>
                      <select value={caseEdit.status}
                        onChange={e => setCaseEdit({ ...caseEdit, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                        style={{ color: '#011745' }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Behandeling</option>
                        <option value="resolved">Opgelost</option>
                        <option value="closed">Gesloten</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Prioriteit</label>
                      <select value={caseEdit.priority}
                        onChange={e => setCaseEdit({ ...caseEdit, priority: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                        style={{ color: '#011745' }}>
                        <option value="low">Laag</option>
                        <option value="normal">Normaal</option>
                        <option value="high">Hoog</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Broker */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Broker / Kanaal</label>
                    <BrokerPicker value={caseEdit.broker} onChange={v => setCaseEdit({ ...caseEdit, broker: v })} />
                  </div>

                  {/* Resolution notes */}
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Oplossingsnotities</label>
                    <textarea value={caseEdit.resolution_notes || ''}
                      onChange={e => setCaseEdit({ ...caseEdit, resolution_notes: e.target.value })}
                      rows={2}
                      placeholder="Noteer hoe de case is opgelost..."
                      className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                      style={{ color: '#011745' }} />
                  </div>

                  {/* Documents */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Documenten</label>
                    <DropZone onFiles={files => uploadToCase(selectedCase.id, selectedCase.lead_id, files)} uploading={uploading} />
                    {selectedCase.documents?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedCase.documents.map(doc => (
                          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#e8eaf2]"
                            style={{ backgroundColor: '#f7f8fc' }}>
                            <FileText size={14} style={{ color: '#3d61a4' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: '#011745' }}>{doc.original_filename}</p>
                              <p className="text-[10px]" style={{ color: '#a4abbe' }}>
                                {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                                {doc.created_at && <> · {new Date(doc.created_at).toLocaleDateString('nl-NL')}</>}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Meta info */}
                  <div className="pt-2 border-t border-[#f3f4f8]">
                    <div className="flex items-center justify-between text-xs" style={{ color: '#a4abbe' }}>
                      <span>Aangemaakt door: <span className="font-medium">{selectedCase.created_by_name || '—'}</span></span>
                      <span>{selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleDateString('nl-NL') : '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer — details tab */}
                <div className="px-6 py-4 border-t border-[#e8eaf2] flex items-center justify-between gap-3"
                  style={{ backgroundColor: '#f7f8fc' }}>
                  <button onClick={() => deleteCase(selectedCase)} disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                    <Trash2 size={14} /> Verwijderen
                  </button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedCase(null)}
                      className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#7b859e' }}>
                      Annuleer
                    </button>
                    <button onClick={saveCase} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                      style={{ backgroundColor: '#3d61a4' }}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Opslaan
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: Correspondentie ── */}
            {detailTab === 'correspondentie' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={28} className="animate-spin" style={{ color: '#3d61a4' }} />
                    </div>
                  ) : !selectedCase.gmail_thread_id ? (
                    <div className="text-center py-12">
                      <Mail size={36} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
                      <p className="text-sm font-semibold" style={{ color: '#566079' }}>Geen e-mailthread gekoppeld</p>
                      <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>
                        Deze case heeft geen Gmail thread ID. Koppel eerst een e-mail via de Compliance Inbox.
                      </p>
                    </div>
                  ) : thread.length === 0 ? (
                    <div className="text-center py-12">
                      <Mail size={36} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
                      <p className="text-sm font-semibold" style={{ color: '#566079' }}>Geen e-mails gevonden</p>
                      <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>De thread bevat nog geen gesynchroniseerde e-mails.</p>
                    </div>
                  ) : (
                    thread.map(email => <EmailThreadCard key={email.id} email={email} />)
                  )}
                </div>

                {/* Reply composer */}
                {selectedCase.gmail_thread_id && (
                  <div className="border-t border-[#e8eaf2] p-4 space-y-3" style={{ backgroundColor: '#f7f8fc' }}>
                    <div>
                      <label className="text-[10px] uppercase font-semibold block mb-1" style={{ color: '#a4abbe' }}>Antwoord naar</label>
                      <input type="email" value={replyTo}
                        onChange={e => setReplyTo(e.target.value)}
                        placeholder="email@voorbeeld.com"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4]"
                        style={{ color: '#011745' }} />
                    </div>
                    <div>
                      <textarea value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={4}
                        placeholder="Typ uw antwoord..."
                        className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                        style={{ color: '#011745', backgroundColor: '#fff' }} />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={sendReply}
                        disabled={replySending || !replyText.trim() || !replyTo.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
                        style={{ backgroundColor: '#3d61a4' }}>
                        {replySending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        Versturen
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ═══ CREATE TICKET MODAL ═══ */}
      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaf2] sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold" style={{ color: '#011745' }}>Nieuwe Compliance Ticket</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-[#f3f4f8] transition-colors">
                <X size={18} style={{ color: '#566079' }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Client selector */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Klant *</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
                  <input type="text" placeholder="Zoek klant..."
                    value={createForm.lead_id ? createForm.lead_name : clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setCreateForm({ ...createForm, lead_id: null, lead_name: '' });
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                    style={{ color: '#011745' }} />
                </div>
                {!createForm.lead_id && clientSearch && filteredClients.length > 0 && (
                  <div className="mt-1 border border-[#e8eaf2] rounded-lg overflow-hidden shadow-sm">
                    {filteredClients.map(cl => (
                      <button key={cl.id} type="button"
                        onClick={() => {
                          setCreateForm({ ...createForm, lead_id: cl.id, lead_name: cl.company_name });
                          setClientSearch('');
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#eef2fa] transition-colors border-b border-[#f3f4f8] last:border-0 flex items-center gap-2">
                        <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: '#011745' }}>
                          {(cl.company_name || '?').charAt(0)}
                        </div>
                        <span style={{ color: '#011745' }}>{cl.company_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {createForm.lead_id && (
                  <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#eef2fa' }}>
                    <CheckCircle2 size={14} style={{ color: '#3d61a4' }} />
                    <span className="text-sm font-medium" style={{ color: '#3d61a4' }}>{createForm.lead_name}</span>
                    <button onClick={() => setCreateForm({ ...createForm, lead_id: null, lead_name: '' })}
                      className="ml-auto text-xs" style={{ color: '#a4abbe' }}>✕</button>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Titel *</label>
                <input type="text" value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Korte omschrijving van het verzoek..."
                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7b859e' }}>Notities / Verzoek</label>
                <textarea value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  placeholder="Gedetailleerde beschrijving..."
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

              {/* Document drop zone */}
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: '#7b859e' }}>Documenten toevoegen</label>
                <DropZone onFiles={files => setPendingFiles(prev => [...prev, ...files])} uploading={createUploading} />
                {pendingFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ backgroundColor: '#f7f8fc', border: '1px solid #e8eaf2' }}>
                        <FileText size={12} style={{ color: '#3d61a4' }} />
                        <span className="text-xs flex-1 truncate" style={{ color: '#566079' }}>{f.name}</span>
                        <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-xs" style={{ color: '#a4abbe' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8eaf2] flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#7b859e' }}>
                Annuleer
              </button>
              <button onClick={createCase}
                disabled={creating || !createForm.lead_id || !createForm.title.trim()}
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
   MAIN: Admin Page with Tabs
   ═══════════════════════════════════════════════════════════════ */

export default ComplianceTab;
