import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Calendar, Users, FileText, MessageSquare, Clock, Check, Loader2, ToggleLeft, ToggleRight, ArrowRight, Phone, PhoneCall, MapPin, UserPlus, Mail, Video, Star, Trash2, Upload, ChevronDown, ChevronUp, MessageCircle, RefreshCw, Zap, ExternalLink } from 'lucide-react';
import CurrencySelector from './CurrencySelector';
import RevenueCard from './RevenueCard';
import DocumentUpload from '../common/DocumentUpload';
import ProductLinesSection from '../common/ProductLinesSection';
import { useAuth } from '../../contexts/AuthContext';

const API = '/api/v1';
const token = () => sessionStorage.getItem('auth_token');

export default function ProspectDetailPopup({ prospect, onClose, onUpdate, onToggleCallList }) {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [taperPayActive, setTaperPayActive] = useState(prospect.taperPayActive);
  const [taperTradeActive, setTaperTradeActive] = useState(prospect.taperTradeActive);
  const [fxDetails, setFxDetails] = useState(prospect.fxDetails || { currencies: [], margin: 0.025, volume: 0 });
  const [tfDetails, setTfDetails] = useState(prospect.tfDetails || {
    debtorFinance: false,
    portfolioBasedFinance: false,
    voorraadFinancing: false,
    totalFacilityAmount: 0,
    additionalInfo: '',
    margin: 0.02,
    volume: 0,
  });
  const [notes, setNotes] = useState(prospect.notes || []);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Inline editing state
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');

  const saveField = async (field, value) => {
    try {
      const tok = sessionStorage.getItem('auth_token');
      await fetch(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ [field]: value }),
      });
      if (onUpdate) onUpdate({ [field]: value });
    } catch(e) { console.error('Save failed', e); }
  };


  // Callback state
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackNote, setCallbackNote] = useState('');
  const [callbackAttendee, setCallbackAttendee] = useState('');
  const [callbackSaving, setCallbackSaving] = useState(false);
  const [callbackMsg, setCallbackMsg] = useState(null);

  // Meeting state
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingNote, setMeetingNote] = useState('');
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [meetingMsg, setMeetingMsg] = useState(null);

  // Invite state (shared by callback & meeting)
  const [callbackExternEmail, setCallbackExternEmail] = useState('');
  const [meetingExternEmail, setMeetingExternEmail] = useState('');
  const [meetingType, setMeetingType] = useState('physical'); // physical | video
  const [mapQuery, setMapQuery] = useState('');

  // Confirmation popup for calendar invites that will actually send e-mail.
  // Holds { kind, payload, recipients: [emails], inviteText } or null.
  const [inviteConfirm, setInviteConfirm] = useState(null);
  const [inviteSending, setInviteSending] = useState(false);

  // Communications state
  const [communications, setCommunications] = useState([]);
  const [newComm, setNewComm] = useState('');
  const [addingComm, setAddingComm] = useState(false);

  // Moving to onboarding
  const [movingToOnboarding, setMovingToOnboarding] = useState(false);
  const [salesOwnerId, setSalesOwnerId] = useState(prospect?.salesOwnerId || null);
  const [salesOwnerName, setSalesOwnerName] = useState(prospect?.salesOwnerName || null);
  const [ownerLoading, setOwnerLoading] = useState(false);

  // Contact methods state
  const [contactMethods, setContactMethods] = useState([]);
  const [contactMethodsLoading, setContactMethodsLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });

  // Conversation logs state
  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [expandedConv, setExpandedConv] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [prospectDocs, setProspectDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showWAImport, setShowWAImport] = useState(false);
  const [convForm, setConvForm] = useState({
    type: 'phone', direction: 'outbound', contact_value: '',
    duration_seconds: '', outcome: '', summary: '', occurred_at: '',
  });
  const [transcriptFile, setTranscriptFile] = useState(null);
  const [waFile, setWaFile] = useState(null);
  const [convUploading, setConvUploading] = useState(false);
  const transcriptInputRef = useRef(null);
  const waInputRef = useRef(null);

  // Enrichment state
  const [enrichment, setEnrichment] = useState(null);
  const [enriching, setEnriching] = useState(false);

  const fetchEnrichment = async () => {
    if (enrichment) return;
    setEnriching(true);
    try {
      const res = await fetch(`${API}/leads/${leadId}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      let parsed = {};
      const raw = data.company_description || '';
      if (raw) {
        let cleaned = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/g, '').trim();
        try { parsed = JSON.parse(cleaned); } catch { parsed = { description: raw }; }
      }
      setEnrichment({
        description:          parsed.description || '',
        industry:             parsed.industry || data.company_industry || '',
        company_size:         parsed.company_size || data.company_size || '',
        founding_year:        parsed.founding_year || null,
        headquarters:         parsed.headquarters || '',
        annual_revenue_estimate: parsed.annual_revenue_estimate || parsed.estimated_revenue || '',
        kvk:                  parsed.kvk_number || data.kvk_number || '',
        international_trade:  parsed.international_trade ?? null,
        trade_countries:      parsed.trade_countries || [],
        products_services:    parsed.products_services || [],
        fx_relevance:         parsed.fx_relevance || '',
        pain_points:          parsed.pain_points || [],
        business_segments:    parsed.business_segments || [],
        fit_score:            parsed.fit_score ?? null,
        fit_reason:           parsed.fit_reason || '',
        taper_fit_products:   parsed.taper_fit_products || [],
        linkedin:             parsed.linkedin_url || data.linkedin_url || '',
        website:              parsed.website || data.company_website || '',
        country:              data.company_country || '',
        phone:                parsed.phone || '',
        enriched_at:          parsed.enriched_at || data.updated_at,
      });
    } catch { setEnrichment({}); }
    setEnriching(false);
  };

  const handleReEnrich = async () => {
    setEnriching(true);
    try {
      await fetch(`${API}/ai/enrich-lead/${leadId}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      setEnrichment(null);
      await fetchEnrichment();
    } catch (e) { console.error('Enrichment failed:', e); }
    setEnriching(false);
  };

  // Team members for dropdowns
  const [teamMembers, setTeamMembers] = useState([]);

  // Fetch team members
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await fetch(`${API}/users/team`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) setTeamMembers(await res.json());
      } catch (e) { console.error('Failed to fetch team:', e); }
    };
    fetchTeam();
  }, []);

  // Lead ID for API calls
  const leadId = prospect._raw?.id || prospect.id;

  const fetchProspectDocs = async () => {
    if (!leadId) return;
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/v1/documents/lead/${leadId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProspectDocs(data.documents || data || []);
      }
    } catch (e) { console.error('Docs fetch failed', e); }
    finally { setDocsLoading(false); }
  };

  const uploadProspectDoc = async (file) => {
    if (!file || !leadId) return;
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams({ lead_id: leadId, category: 'prospect' });
    try {
      const res = await fetch(`/api/v1/documents/upload?${params}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });
      if (res.ok) { fetchProspectDocs(); }
      else { alert('Upload mislukt'); }
    } catch (e) { alert('Upload fout: ' + e.message); }
  };

  const deleteProspectDoc = async (docId) => {
    if (!window.confirm('Document verwijderen?')) return;
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) { setProspectDocs(prev => prev.filter(d => d.id !== docId)); }
    } catch (e) { console.error('Delete failed', e); }
  };

  React.useEffect(() => { fetchProspectDocs(); }, [leadId]);

  // Fetch communications
  useEffect(() => {
    const fetchComms = async () => {
      try {
        const res = await fetch(`${API}/leads/${leadId}/communications`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) setCommunications(await res.json());
      } catch (e) { console.error('Failed to fetch communications:', e); }
    };
    if (leadId) fetchComms();
  }, [leadId]);

  const handleAddComm = async () => {
    if (!newComm.trim()) return;
    setAddingComm(true);
    try {
      const res = await fetch(`${API}/leads/${leadId}/communications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComm }),
      });
      if (res.ok) {
        setNewComm('');
        const commsRes = await fetch(`${API}/leads/${leadId}/communications`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (commsRes.ok) setCommunications(await commsRes.json());
      }
    } catch (e) { console.error('Failed to add communication:', e); }
    setAddingComm(false);
  };

  /* ─── Contact Methods, Conversations & Emails (shared with lead) ─── */
  const [syncedEmails, setSyncedEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailsSyncing, setEmailsSyncing] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState(null);

  const fetchSyncedEmails = () => {
    setEmailsLoading(true);
    fetch(`${API}/leads/${leadId}/emails`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSyncedEmails(Array.isArray(data) ? data : []); setEmailsLoading(false); })
      .catch(() => { setSyncedEmails([]); setEmailsLoading(false); });
  };

  const syncGmail = async () => {
    setEmailsSyncing(true);
    try {
      const resp = await fetch(`${API}/leads/${leadId}/sync-gmail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.detail || 'Sync mislukt');
      fetchSyncedEmails();
    } catch (err) {
      console.error('Gmail sync error:', err.message);
    }
    setEmailsSyncing(false);
  };

  useEffect(() => {
    if (activeTab === 'contacten') fetchContactMethods();
    if (activeTab === 'gesprekken') fetchConversations();
    if (activeTab === 'bedrijfsinfo') fetchEnrichment();
    if (activeTab === 'emails') {
      fetchSyncedEmails();
      syncGmail();
    }
  }, [activeTab]);

  const apiFetch = async (url, options = {}) => {
    const resp = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      throw new Error(d.detail || `API error ${resp.status}`);
    }
    return resp.json();
  };

  const fetchContactMethods = async () => {
    setContactMethodsLoading(true);
    try {
      const data = await apiFetch(`${API}/leads/${leadId}/contact-methods`);
      setContactMethods(Array.isArray(data) ? data : []);
    } catch { setContactMethods([]); }
    setContactMethodsLoading(false);
  };

  const handleAddContactMethod = async () => {
    const { name, email, mobile, whatsapp, isPrimary } = newContact;
    if (!email.trim() && !mobile.trim() && !whatsapp.trim()) return;
    try {
      const entries = [];
      if (email.trim())    entries.push({ type: 'email',    value: email.trim(),    label: name.trim() || null, is_primary: isPrimary });
      if (mobile.trim())   entries.push({ type: 'phone',    value: mobile.trim(),   label: name.trim() || null, is_primary: isPrimary });
      if (whatsapp.trim()) entries.push({ type: 'whatsapp', value: whatsapp.trim(), label: name.trim() || null, is_primary: false });
      for (const entry of entries) {
        await apiFetch(`${API}/leads/${leadId}/contact-methods`, { method: 'POST', body: JSON.stringify(entry) });
      }
      setNewContact({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });
      setShowAddContact(false);
      fetchContactMethods();
    } catch (e) { console.error(e); }
  };

  const handleDeleteContactMethod = async (methodId) => {
    if (!window.confirm('Verwijderen?')) return;
    try { await apiFetch(`${API}/leads/${leadId}/contact-methods/${methodId}`, { method: 'DELETE' }); fetchContactMethods(); }
    catch (e) { console.error(e); }
  };

  const handleSetPrimary = async (methodId) => {
    try { await apiFetch(`${API}/leads/${leadId}/contact-methods/${methodId}`, { method: 'PUT', body: JSON.stringify({ is_primary: true }) }); fetchContactMethods(); }
    catch (e) { console.error(e); }
  };

  const fetchConversations = async () => {
    setConvsLoading(true);
    try {
      const data = await apiFetch(`${API}/leads/${leadId}/conversations`);
      setConversations(Array.isArray(data) ? data : []);
    } catch { setConversations([]); }
    setConvsLoading(false);
  };

  const handleLogConversation = async () => {
    try {
      await apiFetch(`${API}/leads/${leadId}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ ...convForm, duration_seconds: convForm.duration_seconds ? parseInt(convForm.duration_seconds) : null, occurred_at: convForm.occurred_at || new Date().toISOString() }),
      });
      setShowLogForm(false);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchConversations();
    } catch (e) { console.error(e); }
  };

  const handleUploadTranscript = async () => {
    if (!transcriptFile) return;
    setConvUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', transcriptFile);
      fd.append('conv_type', convForm.type);
      fd.append('direction', convForm.direction);
      fd.append('contact_value', convForm.contact_value || '');
      fd.append('outcome', convForm.outcome || '');
      fd.append('summary', convForm.summary || '');
      fd.append('occurred_at', convForm.occurred_at || new Date().toISOString());
      if (convForm.duration_seconds) fd.append('duration_seconds', convForm.duration_seconds);
      const resp = await fetch(`${API}/leads/${leadId}/conversations/upload-transcript`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd,
      });
      if (!resp.ok) throw new Error('Upload mislukt');
      setShowUploadForm(false); setTranscriptFile(null);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchConversations();
    } catch (e) { console.error(e); }
    setConvUploading(false);
  };

  const handleImportWhatsApp = async () => {
    if (!waFile) return;
    setConvUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', waFile);
      fd.append('contact_value', convForm.contact_value || '');
      fd.append('occurred_at', convForm.occurred_at || new Date().toISOString());
      const resp = await fetch(`${API}/leads/${leadId}/conversations/whatsapp-import`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd,
      });
      if (!resp.ok) throw new Error('Import mislukt');
      setShowWAImport(false); setWaFile(null);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchConversations();
    } catch (e) { console.error(e); }
    setConvUploading(false);
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Gespreklog verwijderen?')) return;
    try { await apiFetch(`${API}/leads/${leadId}/conversations/${convId}`, { method: 'DELETE' }); fetchConversations(); }
    catch (e) { console.error(e); }
  };

  /* ─── Toggle TaperPay/TaperTrade ─── */
  const handleToggleTaperPay = async () => {
    const newState = !taperPayActive;
    setTaperPayActive(newState);
    if (newState) {
      setActiveTab('taperPay');
      // Activate on backend
      try {
        await fetch(`${API}/prospects/${leadId}/activate-taperpay`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}` },
        });
      } catch (e) { console.error('Activate TaperPay failed:', e); }
    } else {
      if (activeTab === 'taperPay') setActiveTab('general');
      // Deactivate on backend
      try {
        await fetch(`${API}/prospects/${leadId}/prospect-data`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taperpay_active: false }),
        });
      } catch (e) { console.error('Deactivate TaperPay failed:', e); }
    }
  };

  const handleToggleTaperTrade = async () => {
    const newState = !taperTradeActive;
    setTaperTradeActive(newState);
    if (newState) {
      setActiveTab('taperTrade');
      try {
        await fetch(`${API}/prospects/${leadId}/activate-tapertrade`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}` },
        });
      } catch (e) { console.error('Activate TaperTrade failed:', e); }
    } else {
      if (activeTab === 'taperTrade') setActiveTab('general');
      try {
        await fetch(`${API}/prospects/${leadId}/prospect-data`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tapertrade_active: false }),
        });
      } catch (e) { console.error('Deactivate TaperTrade failed:', e); }
    }
  };

  /* ─── Helper: resolve internal attendee name for the invite text ─── */
  const attendeeName = (id) => {
    const tm = teamMembers.find((t) => String(t.id) === String(id));
    return tm ? tm.full_name : null;
  };

  const teamMemberEmail = (id) => {
    const tm = teamMembers.find((t) => String(t.id) === String(id));
    return tm ? tm.email : null;
  };

  /* ─── Save Callback ─── */
  // If there are invitees (external e-mail and/or internal attendee) we FIRST
  // show a confirmation popup — only after "Verzend uitnodiging" is an e-mail sent.
  const handleSaveCallback = async () => {
    if (!callbackDate) return;
    const externEmail = (callbackExternEmail || '').trim();
    const internIds = callbackAttendee ? [parseInt(callbackAttendee)] : [];
    const hasInvitees = !!externEmail || internIds.length > 0;

    if (hasInvitees) {
      const recipients = [];
      if (externEmail) recipients.push(externEmail);
      internIds.forEach((id) => { const e = teamMemberEmail(id); if (e) recipients.push(e); });
      const _company = prospect._raw?.company_name || prospect.company || prospect.companyName || 'ons';
      const defaultText = `Beste,\n\nBij deze een uitnodiging voor een telefonisch gesprek met ${_company} op ${new Date(callbackDate).toLocaleString('nl-NL')}.\n\n${callbackNote || ''}\n\nMet vriendelijke groet`;
      setInviteConfirm({
        kind: 'call',
        recipients,
        inviteText: defaultText,
        payload: {
          lead_id: parseInt(leadId),
          scheduled_at: new Date(callbackDate).toISOString(),
          callback_type: 'call',
          internal_attendees: internIds,
          invited_user_ids: internIds,
          external_attendees: externEmail ? [externEmail] : [],
        },
      });
      return;
    }

    // No invitees: just save, no e-mail.
    setCallbackSaving(true);
    setCallbackMsg(null);
    try {
      const res = await fetch(`${API}/callbacks/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: parseInt(leadId),
          scheduled_at: new Date(callbackDate).toISOString(),
          callback_type: 'call',
          internal_attendees: internIds,
          internal_note: callbackNote || '',
          add_to_calendar: false,
        }),
      });
      if (res.ok) {
        setCallbackMsg({ type: 'success', text: 'Callback ingepland!' });
        setCallbackDate('');
        setCallbackNote('');
        setCallbackAttendee('');
        setCallbackExternEmail('');
      } else {
        const err = await res.json().catch(() => ({}));
        setCallbackMsg({ type: 'error', text: err.detail || 'Fout bij opslaan' });
      }
    } catch (e) {
      setCallbackMsg({ type: 'error', text: 'Netwerk fout' });
    } finally {
      setCallbackSaving(false);
    }
  };

  /* ─── Save Meeting ─── */
  const handleSaveMeeting = async () => {
    if (!meetingDate) return;
    const externEmail = (meetingExternEmail || '').trim();
    const internIds = callbackAttendee ? [parseInt(callbackAttendee)] : [];
    const hasInvitees = !!externEmail || internIds.length > 0;

    if (hasInvitees) {
      const recipients = [];
      if (externEmail) recipients.push(externEmail);
      internIds.forEach((id) => { const e = teamMemberEmail(id); if (e) recipients.push(e); });
      const defaultText = `Beste,\n\nBij deze een uitnodiging voor een meeting met ${prospect.companyName || prospect.company_name || 'ons'} op ${new Date(meetingDate).toLocaleString('nl-NL')}.\n${meetingLocation ? `\nLocatie/link: ${meetingLocation}` : ''}\n\n${meetingNote || ''}\n\nMet vriendelijke groet`;
      setInviteConfirm({
        kind: 'meeting',
        recipients,
        inviteText: defaultText,
        payload: {
          lead_id: parseInt(leadId),
          scheduled_at: new Date(meetingDate).toISOString(),
          callback_type: 'meeting',
          external_note: meetingLocation || '',
          internal_attendees: internIds,
          invited_user_ids: internIds,
          external_attendees: externEmail ? [externEmail] : [],
        },
      });
      return;
    }

    // No invitees: just save, no e-mail.
    setMeetingSaving(true);
    setMeetingMsg(null);
    try {
      const res = await fetch(`${API}/callbacks/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: parseInt(leadId),
          scheduled_at: new Date(meetingDate).toISOString(),
          callback_type: 'meeting',
          internal_note: meetingNote || '',
          external_note: meetingLocation || '',
          add_to_calendar: false,
        }),
      });
      if (res.ok) {
        setMeetingMsg({ type: 'success', text: 'Meeting ingepland!' });
        setMeetingDate('');
        setMeetingLocation('');
        setMeetingNote('');
      } else {
        const err = await res.json().catch(() => ({}));
        setMeetingMsg({ type: 'error', text: err.detail || 'Fout bij opslaan' });
      }
    } catch (e) {
      setMeetingMsg({ type: 'error', text: 'Netwerk fout' });
    } finally {
      setMeetingSaving(false);
    }
  };

  /* ─── Confirmed send: this ACTUALLY sends the e-mail invite ─── */
  const confirmSendInvite = async () => {
    if (!inviteConfirm) return;
    setInviteSending(true);
    try {
      const res = await fetch(`${API}/callbacks/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...inviteConfirm.payload,
          add_to_calendar: true,
          internal_note: inviteConfirm.inviteText || '',
        }),
      });
      const setMsg = inviteConfirm.kind === 'meeting' ? setMeetingMsg : setCallbackMsg;
      if (res.ok) {
        setMsg({ type: 'success', text: 'Uitnodiging verzonden!' });
        if (inviteConfirm.kind === 'meeting') {
          setMeetingDate(''); setMeetingLocation(''); setMeetingNote(''); setMeetingExternEmail('');
        } else {
          setCallbackDate(''); setCallbackNote(''); setCallbackAttendee(''); setCallbackExternEmail('');
        }
        setInviteConfirm(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ type: 'error', text: err.detail || 'Fout bij verzenden' });
      }
    } catch (e) {
      const setMsg = inviteConfirm.kind === 'meeting' ? setMeetingMsg : setCallbackMsg;
      setMsg({ type: 'error', text: 'Netwerk fout' });
    } finally {
      setInviteSending(false);
    }
  };

  /* ─── Assign / Release prospect ─── */
  const handleAssignProspect = async () => {
    setOwnerLoading(true);
    try {
      const res = await fetch(`${API}/prospects/${leadId}/assign-prospect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSalesOwnerId(data.sales_owner_id);
        setSalesOwnerName(data.sales_owner_name);
        setSaveMsg({ type: 'success', text: 'Prospect vergrendeld naar jouw lijst' });
      } else {
        setSaveMsg({ type: 'error', text: 'Fout bij vergrendelen' });
      }
    } catch { setSaveMsg({ type: 'error', text: 'Netwerk fout' }); }
    setOwnerLoading(false);
  };

  const handleReleaseProspect = async () => {
    setOwnerLoading(true);
    try {
      const res = await fetch(`${API}/prospects/${leadId}/release-prospect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        setSalesOwnerId(null);
        setSalesOwnerName(null);
        setSaveMsg({ type: 'success', text: 'Prospect vrijgegeven naar algemene lijst' });
      } else {
        setSaveMsg({ type: 'error', text: 'Fout bij vrijgeven' });
      }
    } catch { setSaveMsg({ type: 'error', text: 'Netwerk fout' }); }
    setOwnerLoading(false);
  };

  /* ─── Move to Onboarding ─── */
  const handleMoveToOnboarding = async () => {
    setMovingToOnboarding(true);
    try {
      const res = await fetch(`${API}/prospects/${leadId}/to-onboarding`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        onUpdate({
          ...prospect,
          status: 'Onboarding',
          taperPayActive,
          taperTradeActive,
          fxDetails: taperPayActive ? fxDetails : null,
          tfDetails: taperTradeActive ? tfDetails : null,
        });
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Kon niet verplaatsen naar onboarding');
      }
    } catch (e) {
      alert('Netwerk fout bij verplaatsen naar onboarding');
    } finally {
      setMovingToOnboarding(false);
    }
  };

  /* ─── Save all prospect data ─── */
  const handleSaveAll = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      // Forecasting (volumes + margins) now lives in ProductLinesSection, which
      // saves itself. Here we only persist activation status and the TF product
      // type flags / free-text info — NOT the deprecated fx/tf single estimates.
      const payload = {};
      payload.taperpay_active = !!taperPayActive;
      if (taperTradeActive) {
        payload.tapertrade_active = true;
        payload.tf_debtor_finance = tfDetails.debtorFinance || false;
        payload.tf_portfolio_finance = tfDetails.portfolioBasedFinance || false;
        payload.tf_voorraad_finance = tfDetails.voorraadFinancing || false;
        payload.tf_additional_info = tfDetails.additionalInfo || '';
      } else {
        payload.tapertrade_active = false;
      }

      const res = await fetch(`${API}/prospects/${leadId}/prospect-data`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveMsg({ type: 'success', text: 'Opgeslagen!' });
        onUpdate({
          ...prospect,
          taperPayActive,
          taperTradeActive,
          fxDetails: taperPayActive ? fxDetails : null,
          tfDetails: taperTradeActive ? tfDetails : null,
        });
        setTimeout(() => setSaveMsg(null), 2000);
      } else {
        setSaveMsg({ type: 'error', text: 'Opslaan mislukt' });
      }
    } catch (e) {
      setSaveMsg({ type: 'error', text: 'Netwerk fout' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCurrencies = (currencies) => {
    setFxDetails({ ...fxDetails, currencies });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#e8eaf2] px-8 py-6 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-xl font-bold text-[#011745]">{prospect.company}</h2>
            <p className="text-sm text-[#7b859e] mt-1">{prospect.contactName} • {prospect.position}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Bellijst toggle */}
            {onToggleCallList && (
              <button
                onClick={() => onToggleCallList(prospect.id, prospect.onCallList)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  prospect.onCallList
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-[#f7f8fc] text-[#7b859e] border border-[#e8eaf2] hover:border-[#3d61a4] hover:text-[#3d61a4]'
                }`}
                title={prospect.onCallList ? 'Verwijder van bellijst' : 'Zet op bellijst'}
              >
                <PhoneCall size={14} />
                {prospect.onCallList ? 'Op Bellijst' : 'Op Bellijst Zetten'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-[#011745]"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Product Toggle Buttons — always visible under header */}
        <div className="sticky top-[88px] bg-white border-b border-[#e8eaf2] px-8 py-3 z-10">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-[#7b859e] uppercase tracking-wide">Producten:</span>

            {/* TaperPay toggle */}
            <button
              onClick={handleToggleTaperPay}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                taperPayActive
                  ? 'bg-[#3d61a4] text-white shadow-md'
                  : 'bg-[#f7f8fc] text-[#7b859e] border border-[#e8eaf2] hover:border-[#3d61a4] hover:text-[#3d61a4]'
              }`}
            >
              {taperPayActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              TaperPay
            </button>

            {/* TaperTrade toggle */}
            <button
              onClick={handleToggleTaperTrade}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                taperTradeActive
                  ? 'bg-[#0a2d6b] text-white shadow-md'
                  : 'bg-[#f7f8fc] text-[#7b859e] border border-[#e8eaf2] hover:border-[#0a2d6b] hover:text-[#0a2d6b]'
              }`}
            >
              {taperTradeActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              TaperTrade
            </button>

            {/* Assign / Release prospect */}
            {(() => {
              const isAdmin = authUser && (
                ['admin_pay', 'admin_trade'].includes(authUser.role) || authUser.is_teamleader
              );
              const isOwner = authUser && salesOwnerId === authUser.id;
              if (salesOwnerId && (isOwner || isAdmin)) {
                return (
                  <button
                    onClick={handleReleaseProspect}
                    disabled={ownerLoading}
                    title={`Eigenaar: ${salesOwnerName || ''} — klik om vrij te geven`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#eef2fa] text-[#3d61a4] border border-[#3d61a4] rounded-lg text-sm font-medium hover:bg-[#3d61a4] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {'🔒'} {salesOwnerName ? salesOwnerName.split(' ')[0] : 'Mijn'} → Vrijgeven
                  </button>
                );
              }
              if (!salesOwnerId) {
                return (
                  <button
                    onClick={handleAssignProspect}
                    disabled={ownerLoading}
                    title="Vergrendel naar jouw prospects"
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#f3f4f8] text-[#566079] border border-[#cdd1e0] rounded-lg text-sm font-medium hover:bg-[#eef2fa] hover:text-[#3d61a4] hover:border-[#3d61a4] transition-colors disabled:opacity-50"
                  >
                    {'🔓'} Vergrendel
                  </button>
                );
              }
              return null;
            })()}
            {/* Move to Onboarding button — right aligned */}
            {(taperPayActive || taperTradeActive) && (
              <button
                onClick={handleMoveToOnboarding}
                disabled={movingToOnboarding}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {movingToOnboarding ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Naar Onboarding
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-[144px] bg-white border-b border-[#e8eaf2] px-8 z-10">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'text-[#3d61a4] border-[#3d61a4]'
                  : 'text-[#7b859e] border-transparent hover:text-[#011745]'
              }`}
            >
              Algemeen
            </button>
            {taperPayActive && (
              <button
                onClick={() => setActiveTab('taperPay')}
                className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'taperPay'
                    ? 'text-[#3d61a4] border-[#3d61a4]'
                    : 'text-[#7b859e] border-transparent hover:text-[#011745]'
                }`}
              >
                TaperPay
              </button>
            )}
            {taperTradeActive && (
              <button
                onClick={() => setActiveTab('taperTrade')}
                className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'taperTrade'
                    ? 'text-[#3d61a4] border-[#3d61a4]'
                    : 'text-[#7b859e] border-transparent hover:text-[#011745]'
                }`}
              >
                TaperTrade
              </button>
            )}
            <button
              onClick={() => setActiveTab('contacten')}
              className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'contacten'
                  ? 'text-[#3d61a4] border-[#3d61a4]'
                  : 'text-[#7b859e] border-transparent hover:text-[#011745]'
              }`}
            >
              Contacten
            </button>
            <button
              onClick={() => setActiveTab('gesprekken')}
              className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'gesprekken'
                  ? 'text-[#3d61a4] border-[#3d61a4]'
                  : 'text-[#7b859e] border-transparent hover:text-[#011745]'
              }`}
            >
              Gesprekken
            </button>
            <button
              onClick={() => setActiveTab('emails')}
              className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'emails'
                  ? 'text-[#3d61a4] border-[#3d61a4]'
                  : 'text-[#7b859e] border-transparent hover:text-[#011745]'
              }`}
            >
              E-mails
            </button>
            <button
              onClick={() => setActiveTab('communicatie')}
              className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'communicatie'
                  ? 'text-[#3d61a4] border-[#3d61a4]'
                  : 'text-[#7b859e] border-transparent hover:text-[#011745]'
              }`}
            >
              Communicatie
            </button>
            <button
              onClick={() => setActiveTab('bedrijfsinfo')}
              className={`py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'bedrijfsinfo'
                  ? 'text-[#3d61a4] border-[#3d61a4]'
                  : 'text-[#7b859e] border-transparent hover:text-[#011745]'
              }`}
            >
              Bedrijfsinfo
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* ─── Algemeen Tab ─── */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Company Info - Inline Editable */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#011745] mb-2">Bedrijf</label>
                  {editing === 'company_name' ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onBlur={() => { saveField('company_name', editVal); setEditing(null); }}
                      onKeyDown={e => e.key === 'Enter' && (saveField('company_name', editVal), setEditing(null))}
                      className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                  ) : (
                    <span onClick={() => { setEditing('company_name'); setEditVal(prospect._raw?.company_name || prospect.company || ''); }}
                      className="text-[#566079] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                      {prospect._raw?.company_name || prospect.company || '—'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#011745] mb-2">Website</label>
                  {editing === 'company_website' ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onBlur={() => { saveField('company_website', editVal); setEditing(null); }}
                      onKeyDown={e => e.key === 'Enter' && (saveField('company_website', editVal), setEditing(null))}
                      className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                  ) : (
                    <span onClick={() => { setEditing('company_website'); setEditVal(prospect._raw?.company_website || prospect.website || ''); }}
                      className="text-[#566079] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                      {prospect._raw?.company_website || prospect.website || '—'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#011745] mb-2">Land</label>
                  {editing === 'company_country' ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onBlur={() => { saveField('company_country', editVal); setEditing(null); }}
                      onKeyDown={e => e.key === 'Enter' && (saveField('company_country', editVal), setEditing(null))}
                      className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                  ) : (
                    <span onClick={() => { setEditing('company_country'); setEditVal(prospect._raw?.company_country || prospect.country || ''); }}
                      className="text-[#566079] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                      {prospect._raw?.company_country || prospect.country || '—'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#011745] mb-2">Industrie</label>
                  {editing === 'company_industry' ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onBlur={() => { saveField('company_industry', editVal); setEditing(null); }}
                      onKeyDown={e => e.key === 'Enter' && (saveField('company_industry', editVal), setEditing(null))}
                      className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                  ) : (
                    <span onClick={() => { setEditing('company_industry'); setEditVal(prospect._raw?.company_industry || prospect.industry || ''); }}
                      className="text-[#566079] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                      {prospect._raw?.company_industry || prospect.industry || '—'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#011745] mb-2">KVK</label>
                  {editing === 'kvk_number' ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      onBlur={() => { saveField('kvk_number', editVal); setEditing(null); }}
                      onKeyDown={e => e.key === 'Enter' && (saveField('kvk_number', editVal), setEditing(null))}
                      className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                  ) : (
                    <span onClick={() => { setEditing('kvk_number'); setEditVal(prospect._raw?.kvk_number || ''); }}
                      className="text-[#566079] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                      {prospect._raw?.kvk_number || '—'}
                    </span>
                  )}
                </div>
                {prospect.broker && (
                  <div>
                    <label className="block text-sm font-semibold text-[#011745] mb-2">Broker</label>
                    <p className="text-[#566079]">{prospect.broker}</p>
                  </div>
                )}
              </div>
              {/* Contact Info - Inline Editable */}
              <div className="border-t border-[#e8eaf2] pt-6">
                <h3 className="font-semibold text-[#011745] mb-4">Contactpersoon</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#566079] mb-1">Naam</label>
                    {editing === 'contact_name' ? (
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onBlur={() => { saveField('contact_name', editVal); setEditing(null); }}
                        onKeyDown={e => e.key === 'Enter' && (saveField('contact_name', editVal), setEditing(null))}
                        className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                    ) : (
                      <span onClick={() => { setEditing('contact_name'); setEditVal(prospect._raw?.contact_name || prospect.contactName || ''); }}
                        className="text-[#011745] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                        {prospect._raw?.contact_name || prospect.contactName || '—'}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#566079] mb-1">Functie</label>
                    {editing === 'contact_position' ? (
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onBlur={() => { saveField('contact_position', editVal); setEditing(null); }}
                        onKeyDown={e => e.key === 'Enter' && (saveField('contact_position', editVal), setEditing(null))}
                        className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                    ) : (
                      <span onClick={() => { setEditing('contact_position'); setEditVal(prospect._raw?.contact_position || prospect.position || ''); }}
                        className="text-[#011745] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                        {prospect._raw?.contact_position || prospect.position || '—'}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#566079] mb-1">E-mail</label>
                    {editing === 'contact_email' ? (
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onBlur={() => { saveField('contact_email', editVal); setEditing(null); }}
                        onKeyDown={e => e.key === 'Enter' && (saveField('contact_email', editVal), setEditing(null))}
                        className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                    ) : (
                      <span onClick={() => { setEditing('contact_email'); setEditVal(prospect._raw?.contact_email || prospect.email || ''); }}
                        className="text-[#011745] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                        {prospect._raw?.contact_email || prospect.email || '—'}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#566079] mb-1">Telefoon</label>
                    {editing === 'contact_phone' ? (
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onBlur={() => { saveField('contact_phone', editVal); setEditing(null); }}
                        onKeyDown={e => e.key === 'Enter' && (saveField('contact_phone', editVal), setEditing(null))}
                        className="border rounded px-2 py-1 text-sm w-full border-[#3d61a4] outline-none" />
                    ) : (
                      <span onClick={() => { setEditing('contact_phone'); setEditVal(prospect._raw?.contact_phone || prospect.phone || ''); }}
                        className="text-[#011745] cursor-pointer hover:bg-blue-50 px-1 rounded block min-h-[1.5rem]">
                        {prospect._raw?.contact_phone || prospect.phone || '—'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* ═══ SCHEDULING SECTION ═══ */}
              <div className="border-t border-[#e8eaf2] pt-6 space-y-6">
                <h3 className="font-semibold text-[#011745] flex items-center gap-2">
                  <Calendar size={18} style={{ color: '#3d61a4' }} />
                  Afspraken Plannen
                </h3>

                <div className="grid grid-cols-2 gap-5">
                  {/* ─── Plan Callback Card ─── */}
                  <div className="rounded-xl border border-[#e8eaf2] bg-white overflow-hidden">
                    <div className="px-5 py-3 bg-[#eef2fa] border-b border-[#e8eaf2] flex items-center gap-2">
                      <Phone size={15} style={{ color: '#3d61a4' }} />
                      <span className="text-sm font-semibold" style={{ color: '#011745' }}>Plan Callback</span>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Date & time */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5">Datum & Tijd</label>
                        <input
                          type="datetime-local"
                          value={callbackDate}
                          onChange={(e) => setCallbackDate(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        />
                      </div>

                      {/* Invite intern */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5 flex items-center gap-1">
                          <UserPlus size={11} /> Invite Intern
                        </label>
                        <select
                          value={callbackAttendee}
                          onChange={(e) => setCallbackAttendee(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        >
                          <option value="">Selecteer teamlid...</option>
                          {teamMembers.map((tm) => (
                            <option key={tm.id} value={tm.id}>{tm.full_name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Invite extern */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5 flex items-center gap-1">
                          <Mail size={11} /> Invite Extern
                        </label>
                        <input
                          type="email"
                          value={callbackExternEmail}
                          onChange={(e) => setCallbackExternEmail(e.target.value)}
                          placeholder={prospect.email || 'email@bedrijf.nl'}
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        />
                      </div>

                      {/* Note */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5">Notitie</label>
                        <input
                          type="text"
                          value={callbackNote}
                          onChange={(e) => setCallbackNote(e.target.value)}
                          placeholder="Interne notitie..."
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        />
                      </div>

                      {/* Submit */}
                      <button
                        onClick={handleSaveCallback}
                        disabled={!callbackDate || callbackSaving}
                        className="w-full px-4 py-2.5 bg-[#3d61a4] text-white rounded-lg font-medium text-sm hover:bg-[#0a2d6b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {callbackSaving ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                        Callback Inplannen
                      </button>
                      {callbackMsg && (
                        <p className={`text-xs font-medium text-center ${callbackMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {callbackMsg.text}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ─── Plan Meeting Card ─── */}
                  <div className="rounded-xl border border-[#e8eaf2] bg-white overflow-hidden">
                    <div className="px-5 py-3 bg-[#eef2fa] border-b border-[#e8eaf2] flex items-center gap-2">
                      <Users size={15} style={{ color: '#3d61a4' }} />
                      <span className="text-sm font-semibold" style={{ color: '#011745' }}>Plan Meeting</span>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Meeting type toggle */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5">Type</label>
                        <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1">
                          <button onClick={() => setMeetingType('physical')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              meetingType === 'physical' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                            }`}
                            style={{ color: meetingType === 'physical' ? '#3d61a4' : '#7b859e' }}>
                            <MapPin size={12} /> Fysiek
                          </button>
                          <button onClick={() => setMeetingType('video')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              meetingType === 'video' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                            }`}
                            style={{ color: meetingType === 'video' ? '#3d61a4' : '#7b859e' }}>
                            <Video size={12} /> Video Call
                          </button>
                        </div>
                      </div>

                      {/* Date & time */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5">Datum & Tijd</label>
                        <input
                          type="datetime-local"
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        />
                      </div>

                      {/* Location (physical) or Video link */}
                      {meetingType === 'physical' ? (
                        <div>
                          <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5 flex items-center gap-1">
                            <MapPin size={11} /> Locatie
                          </label>
                          <input
                            type="text"
                            value={meetingLocation}
                            onChange={(e) => { setMeetingLocation(e.target.value); setMapQuery(e.target.value); }}
                            placeholder="Adres invoeren..."
                            className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                            style={{ color: '#011745' }}
                          />
                          {/* Google Maps embed */}
                          {meetingLocation && meetingLocation.length > 3 && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-[#e8eaf2]" style={{ height: '160px' }}>
                              <iframe
                                title="Meeting locatie"
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(meetingLocation)}`}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5 flex items-center gap-1">
                            <Video size={11} /> Video Link
                          </label>
                          <input
                            type="url"
                            value={meetingLocation}
                            onChange={(e) => setMeetingLocation(e.target.value)}
                            placeholder="https://meet.google.com/..."
                            className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                            style={{ color: '#011745' }}
                          />
                        </div>
                      )}

                      {/* Invite intern */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5 flex items-center gap-1">
                          <UserPlus size={11} /> Invite Intern
                        </label>
                        <select
                          value={callbackAttendee}
                          onChange={(e) => setCallbackAttendee(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        >
                          <option value="">Selecteer teamlid...</option>
                          {teamMembers.map((tm) => (
                            <option key={tm.id} value={tm.id}>{tm.full_name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Invite extern */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5 flex items-center gap-1">
                          <Mail size={11} /> Invite Extern
                        </label>
                        <input
                          type="email"
                          value={meetingExternEmail}
                          onChange={(e) => setMeetingExternEmail(e.target.value)}
                          placeholder={prospect.email || 'email@bedrijf.nl'}
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        />
                      </div>

                      {/* Note */}
                      <div>
                        <label className="block text-xs font-medium text-[#7b859e] uppercase mb-1.5">Notitie</label>
                        <input
                          type="text"
                          value={meetingNote}
                          onChange={(e) => setMeetingNote(e.target.value)}
                          placeholder="Meeting notitie..."
                          className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none"
                          style={{ color: '#011745' }}
                        />
                      </div>

                      {/* Submit */}
                      <button
                        onClick={handleSaveMeeting}
                        disabled={!meetingDate || meetingSaving}
                        className="w-full px-4 py-2.5 bg-[#3d61a4] text-white rounded-lg font-medium text-sm hover:bg-[#0a2d6b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {meetingSaving ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                        Meeting Inplannen
                      </button>
                      {meetingMsg && (
                        <p className={`text-xs font-medium text-center ${meetingMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {meetingMsg.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── TaperPay Tab ─── */}
          {activeTab === 'taperPay' && taperPayActive && (
            <div className="space-y-6">
              {/* Currency Pairs */}
              <div>
                <h3 className="font-semibold text-[#011745] mb-4">Valutaparen</h3>
                <CurrencySelector
                  entries={fxDetails.currencies || []}
                  onChange={handleUpdateCurrencies}
                  type="country"
                />
              </div>

              {/* Documents */}
              <div className="border-t border-[#e8eaf2] pt-6">
                <h3 className="font-semibold text-[#011745] mb-4">Documenten</h3>
                <div className="space-y-2">
                  {docsLoading ? (
                    <p className="text-xs text-[#a4abbe]">Laden...</p>
                  ) : prospectDocs.length === 0 ? (
                    <p className="text-sm text-[#a4abbe]">Nog geen documenten geüpload</p>
                  ) : (
                    prospectDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2]">
                        <FileText size={14} style={{ color: '#3d61a4' }} />
                        <span className="text-sm flex-1 truncate" style={{ color: '#011745' }}>{doc.original_filename}</span>
                        <span className="text-xs" style={{ color: '#a4abbe' }}>{doc.file_size ? (doc.file_size/1024).toFixed(0) + ' KB' : ''}</span>
                        <button onClick={() => deleteProspectDoc(doc.id)}
                          className="p-1 rounded hover:bg-red-50 transition-colors">
                          <Trash2 size={12} style={{ color: '#dc2626' }} />
                        </button>
                      </div>
                    ))
                  )}
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-[#e8eaf2] hover:border-[#3d61a4] transition-colors mt-2">
                    <Upload size={14} style={{ color: '#3d61a4' }} />
                    <span className="text-sm" style={{ color: '#3d61a4' }}>Document uploaden</span>
                    <input type="file" className="hidden" onChange={e => { if (e.target.files[0]) uploadProspectDoc(e.target.files[0]); e.target.value=''; }} />
                  </label>
                </div>
              </div>

              {/* Strategy */}
              <div className="border-t border-[#e8eaf2] pt-6">
                <label className="block text-sm font-semibold text-[#011745] mb-2">Strategie / Exposure</label>
                <textarea
                  placeholder="Beschrijf FX strategie en exposure..."
                  className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none h-24"
                />
              </div>

              {/* Multi-product regels (volumes + revenue) */}
              <ProductLinesSection leadId={leadId} product="taperpay" accent="#3d61a4" />
            </div>
          )}

          {/* ─── TaperTrade Tab ─── */}
          {activeTab === 'taperTrade' && taperTradeActive && (
            <div className="space-y-6">
              {/* Product Selection */}
              <div>
                <h3 className="font-semibold text-[#011745] mb-4">Trade Finance Producten</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-[#f7f8fc] rounded-lg cursor-pointer hover:bg-[#eef2fa]">
                    <input
                      type="checkbox"
                      checked={tfDetails.debtorFinance || false}
                      onChange={(e) => setTfDetails({ ...tfDetails, debtorFinance: e.target.checked })}
                      className="rounded"
                    />
                    <div>
                      <p className="font-medium text-[#011745]">Debtor Finance</p>
                      <p className="text-xs text-[#7b859e]">Non-recourse financiering van debiteurenportefeuille</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-[#f7f8fc] rounded-lg cursor-pointer hover:bg-[#eef2fa]">
                    <input
                      type="checkbox"
                      checked={tfDetails.portfolioBasedFinance || false}
                      onChange={(e) => setTfDetails({ ...tfDetails, portfolioBasedFinance: e.target.checked })}
                      className="rounded"
                    />
                    <div>
                      <p className="font-medium text-[#011745]">Portfolio Based Finance</p>
                      <p className="text-xs text-[#7b859e]">Revolving credit facility op debiteurenportefeuille</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-[#f7f8fc] rounded-lg cursor-pointer hover:bg-[#eef2fa]">
                    <input
                      type="checkbox"
                      checked={tfDetails.voorraadFinancing || false}
                      onChange={(e) => setTfDetails({ ...tfDetails, voorraadFinancing: e.target.checked })}
                      className="rounded"
                    />
                    <div>
                      <p className="font-medium text-[#011745]">Voorraadfinanciering</p>
                      <p className="text-xs text-[#7b859e]">Goods-in-transit financiering</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Additional Info */}
              <div className="border-t border-[#e8eaf2] pt-6">
                <label className="block text-sm font-semibold text-[#011745] mb-2">Aanvullende Informatie</label>
                <textarea
                  value={tfDetails.additionalInfo || ''}
                  onChange={(e) => setTfDetails({ ...tfDetails, additionalInfo: e.target.value })}
                  placeholder="Specifieke vereisten, voorkeuren, beperkingen..."
                  className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none h-20"
                />
              </div>

              {/* Documents */}
              <div className="border-t border-[#e8eaf2] pt-6">
                <h3 className="font-semibold text-[#011745] mb-4">Documenten</h3>
                <div className="space-y-2">
                  {docsLoading ? (
                    <p className="text-xs text-[#a4abbe]">Laden...</p>
                  ) : prospectDocs.length === 0 ? (
                    <p className="text-sm text-[#a4abbe]">Nog geen documenten geüpload</p>
                  ) : (
                    prospectDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2]">
                        <FileText size={14} style={{ color: '#3d61a4' }} />
                        <span className="text-sm flex-1 truncate" style={{ color: '#011745' }}>{doc.original_filename}</span>
                        <span className="text-xs" style={{ color: '#a4abbe' }}>{doc.file_size ? (doc.file_size/1024).toFixed(0) + ' KB' : ''}</span>
                        <button onClick={() => deleteProspectDoc(doc.id)}
                          className="p-1 rounded hover:bg-red-50 transition-colors">
                          <Trash2 size={12} style={{ color: '#dc2626' }} />
                        </button>
                      </div>
                    ))
                  )}
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-[#e8eaf2] hover:border-[#3d61a4] transition-colors mt-2">
                    <Upload size={14} style={{ color: '#3d61a4' }} />
                    <span className="text-sm" style={{ color: '#3d61a4' }}>Document uploaden</span>
                    <input type="file" className="hidden" onChange={e => { if (e.target.files[0]) uploadProspectDoc(e.target.files[0]); e.target.value=''; }} />
                  </label>
                </div>
              </div>

              {/* Multi-product regels (volumes + revenue) */}
              <ProductLinesSection leadId={leadId} product="tapertrade" accent="#16a34a" />
            </div>
          )}

          {/* ─── Contacten Tab ─── */}
          {activeTab === 'contacten' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Contactmethoden</h3>
                <button onClick={() => setShowAddContact(!showAddContact)}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#3d61a4] hover:text-[#0a2d6b]">
                  <Plus size={16} /> Toevoegen
                </button>
              </div>
              {showAddContact && (
                <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                  <p className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Nieuw contact</p>
                  <div>
                    <label className="block text-xs text-[#a4abbe] mb-1">Naam</label>
                    <input type="text" value={newContact.name} onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))}
                      placeholder="Sam de Vries"
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-[#a4abbe] mb-1">✉ E-mail</label>
                      <input type="email" value={newContact.email} onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))}
                        placeholder="sam@bedrijf.nl"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a4abbe] mb-1">📱 Mobiel</label>
                      <input type="tel" value={newContact.mobile} onChange={e => setNewContact(c => ({ ...c, mobile: e.target.value }))}
                        placeholder="+31 6 12345678"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#a4abbe] mb-1">💬 WhatsApp <span className="text-[10px]">(optioneel)</span></label>
                    <input type="tel" value={newContact.whatsapp} onChange={e => setNewContact(c => ({ ...c, whatsapp: e.target.value }))}
                      placeholder="+31 6 12345678"
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newContact.isPrimary} onChange={e => setNewContact(c => ({ ...c, isPrimary: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-[#566079]">Primair contact</span>
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleAddContactMethod}
                      disabled={!newContact.email.trim() && !newContact.mobile.trim() && !newContact.whatsapp.trim()}
                      className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#0a2d6b]">Contact opslaan</button>
                    <button onClick={() => { setShowAddContact(false); setNewContact({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false }); }}
                      className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm">Annuleren</button>
                  </div>
                </div>
              )}
              {contactMethodsLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-[#3d61a4]" /></div>
              ) : contactMethods.length === 0 ? (
                <p className="text-sm text-[#a4abbe] py-4">Nog geen contacten toegevoegd.</p>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const groups = {};
                    contactMethods.forEach(m => { const k = m.label || '__unlabeled__'; if (!groups[k]) groups[k] = []; groups[k].push(m); });
                    return Object.entries(groups).map(([name, methods]) => (
                      <div key={name} className="bg-white rounded-xl border border-[#e8eaf2] p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full bg-[#eef2fa] flex items-center justify-center text-[#3d61a4] font-semibold text-sm">
                            {name !== '__unlabeled__' ? name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <span className="text-sm font-semibold text-[#011745]">{name !== '__unlabeled__' ? name : 'Onbekend'}</span>
                          {methods.some(m => m.is_primary) && (
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Star size={9} className="fill-amber-500" /> Primair
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {methods.map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-2 pl-10">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base flex-shrink-0">{m.type === 'email' ? '✉' : m.type === 'phone' ? '📱' : '💬'}</span>
                                <span className="text-sm text-[#566079] truncate">{m.value}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!m.is_primary && <button onClick={() => handleSetPrimary(m.id)} className="text-[10px] text-[#a4abbe] hover:text-[#3d61a4] px-1">primair</button>}
                                <button onClick={() => handleDeleteContactMethod(m.id)} className="text-[#cdd1e0] hover:text-red-500 p-1 rounded"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ─── Gesprekken Tab ─── */}
          {activeTab === 'gesprekken' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setShowLogForm(!showLogForm); setShowUploadForm(false); setShowWAImport(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium hover:bg-[#0a2d6b]">
                  <Plus size={15} /> Log gesprek
                </button>
                <button onClick={() => { setShowUploadForm(!showUploadForm); setShowLogForm(false); setShowWAImport(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm font-medium hover:bg-[#cdd1e0]">
                  <Upload size={15} /> Transcript
                </button>
                <button onClick={() => { setShowWAImport(!showWAImport); setShowLogForm(false); setShowUploadForm(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm font-medium hover:bg-[#cdd1e0]">
                  <MessageCircle size={15} /> WhatsApp
                </button>
              </div>
              {showLogForm && (
                <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                  <p className="text-xs font-semibold text-[#566079] uppercase">Gesprek loggen</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Type</label>
                      <select value={convForm.type} onChange={e => setConvForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5">
                        <option value="phone">📞 Telefoon</option>
                        <option value="email">✉ Email</option>
                        <option value="whatsapp">💬 WhatsApp</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Richting</label>
                      <select value={convForm.direction} onChange={e => setConvForm(f => ({ ...f, direction: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5">
                        <option value="outbound">Uitgaand</option>
                        <option value="inbound">Inkomend</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Nummer/Email</label>
                      <input type="text" value={convForm.contact_value} onChange={e => setConvForm(f => ({ ...f, contact_value: e.target.value }))}
                        placeholder="+31 6 12345678" className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Resultaat</label>
                      <select value={convForm.outcome} onChange={e => setConvForm(f => ({ ...f, outcome: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5">
                        <option value="">— selecteer —</option>
                        <option value="answered">Opgenomen</option>
                        <option value="no_answer">Niet opgenomen</option>
                        <option value="voicemail">Voicemail</option>
                        <option value="interested">Geïnteresseerd</option>
                        <option value="callback">Terugbellen</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Duur (sec)</label>
                      <input type="number" value={convForm.duration_seconds} onChange={e => setConvForm(f => ({ ...f, duration_seconds: e.target.value }))}
                        placeholder="bijv. 180" className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Datum/tijd</label>
                      <input type="datetime-local" value={convForm.occurred_at} onChange={e => setConvForm(f => ({ ...f, occurred_at: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                  </div>
                  <textarea value={convForm.summary} onChange={e => setConvForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="Korte samenvatting..." rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
                  <div className="flex gap-2">
                    <button onClick={handleLogConversation} className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium">Opslaan</button>
                    <button onClick={() => setShowLogForm(false)} className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm">Annuleren</button>
                  </div>
                </div>
              )}
              {showUploadForm && (
                <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                  <p className="text-xs font-semibold text-[#566079] uppercase">Transcript uploaden</p>
                  <div
                    onClick={() => transcriptInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setTranscriptFile(f); }}
                    onDragOver={e => e.preventDefault()}
                    className="border-2 border-dashed border-[#a4abbe] rounded-xl p-6 text-center cursor-pointer hover:border-[#3d61a4] hover:bg-[#eef2fa] transition-all">
                    <input ref={transcriptInputRef} type="file" className="hidden" accept=".txt,.pdf,.docx" onChange={e => setTranscriptFile(e.target.files[0])} />
                    <Upload size={28} className="mx-auto mb-2 text-[#a4abbe]" />
                    {transcriptFile ? <p className="text-sm font-medium text-[#3d61a4]">{transcriptFile.name}</p>
                      : <p className="text-sm text-[#566079]">Sleep bestand of klik (.txt, .pdf, .docx)</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUploadTranscript} disabled={!transcriptFile || convUploading}
                      className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {convUploading ? <><Loader2 size={14} className="animate-spin" /> Verwerken...</> : 'Uploaden & Samenvatten'}
                    </button>
                    <button onClick={() => { setShowUploadForm(false); setTranscriptFile(null); }}
                      className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm">Annuleren</button>
                  </div>
                </div>
              )}
              {showWAImport && (
                <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                  <p className="text-xs font-semibold text-[#566079] uppercase">WhatsApp chat importeren</p>
                  <div
                    onClick={() => waInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setWaFile(f); }}
                    onDragOver={e => e.preventDefault()}
                    className="border-2 border-dashed border-[#a4abbe] rounded-xl p-6 text-center cursor-pointer hover:border-[#3d61a4] hover:bg-[#eef2fa] transition-all">
                    <input ref={waInputRef} type="file" className="hidden" accept=".txt" onChange={e => setWaFile(e.target.files[0])} />
                    <MessageCircle size={28} className="mx-auto mb-2 text-[#a4abbe]" />
                    {waFile ? <p className="text-sm font-medium text-[#3d61a4]">{waFile.name}</p>
                      : <p className="text-sm text-[#566079]">WhatsApp export (.txt)</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleImportWhatsApp} disabled={!waFile || convUploading}
                      className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {convUploading ? <><Loader2 size={14} className="animate-spin" /> Importeren...</> : 'Importeren & Samenvatten'}
                    </button>
                    <button onClick={() => { setShowWAImport(false); setWaFile(null); }}
                      className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm">Annuleren</button>
                  </div>
                </div>
              )}
              {convsLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-[#3d61a4]" /></div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-[#a4abbe] py-4">Nog geen gesprekken gelogd.</p>
              ) : (
                <div className="space-y-3">
                  {conversations.map(conv => {
                    const isExpanded = expandedConv === conv.id;
                    const typeIcon = conv.type === 'phone' ? '📞' : conv.type === 'whatsapp' ? '💬' : '✉';
                    const durationMin = conv.duration_seconds ? Math.round(conv.duration_seconds / 60) : null;
                    return (
                      <div key={conv.id} className="bg-white rounded-xl border border-[#e8eaf2] overflow-hidden">
                        <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[#f7f8fc]"
                          onClick={() => setExpandedConv(isExpanded ? null : conv.id)}>
                          <span className="text-xl mt-0.5">{typeIcon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[#011745] capitalize">{conv.type}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eef2fa] text-[#3d61a4]">
                                {conv.direction === 'inbound' ? '↙ inkomend' : '↗ uitgaand'}
                              </span>
                              {conv.outcome && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f8fc] text-[#566079] border border-[#e8eaf2]">{conv.outcome}</span>}
                              {durationMin && <span className="text-[10px] text-[#7b859e]">{durationMin} min</span>}
                            </div>
                            <p className="text-xs text-[#7b859e] mt-0.5">
                              {new Date(conv.occurred_at).toLocaleString('nl-NL')}
                              {conv.user_name && ` • ${conv.user_name}`}
                              {conv.contact_value && ` • ${conv.contact_value}`}
                            </p>
                            {(conv.ai_summary || conv.summary) && !isExpanded && (
                              <p className="text-xs text-[#566079] mt-1.5 line-clamp-2">{conv.ai_summary || conv.summary}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={e => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                              className="p-1.5 rounded text-[#a4abbe] hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                            {isExpanded ? <ChevronUp size={16} className="text-[#7b859e]" /> : <ChevronDown size={16} className="text-[#7b859e]" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-[#e8eaf2] p-4 space-y-3 bg-[#f7f8fc]">
                            {conv.ai_summary && (
                              <div>
                                <p className="text-[10px] font-semibold text-[#3d61a4] uppercase tracking-wider mb-1.5">🤖 AI Samenvatting</p>
                                <p className="text-xs text-[#566079] whitespace-pre-wrap leading-relaxed">{conv.ai_summary}</p>
                              </div>
                            )}
                            {conv.summary && (
                              <div>
                                <p className="text-[10px] font-semibold text-[#566079] uppercase tracking-wider mb-1.5">Handmatige samenvatting</p>
                                <p className="text-xs text-[#566079] whitespace-pre-wrap leading-relaxed">{conv.summary}</p>
                              </div>
                            )}
                            {conv.transcript_text && (
                              <div>
                                <p className="text-[10px] font-semibold text-[#566079] uppercase tracking-wider mb-1.5">Transcript</p>
                                <pre className="text-xs text-[#566079] whitespace-pre-wrap bg-white rounded-lg p-3 border border-[#e8eaf2] max-h-60 overflow-y-auto font-mono leading-relaxed">
                                  {conv.transcript_text}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── E-mails Tab ─── */}
          {activeTab === 'emails' && (
            <div className="space-y-5 p-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">
                  Gesynchroniseerde E-mails
                  {syncedEmails.length > 0 && (
                    <span className="ml-2 bg-[#eef2fa] text-[#3d61a4] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                      {syncedEmails.length}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchSyncedEmails}
                    disabled={emailsLoading}
                    className="text-xs text-[#566079] hover:text-[#3d61a4] flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={emailsLoading ? 'animate-spin' : ''} />
                    Vernieuwen
                  </button>
                  <button
                    onClick={syncGmail}
                    disabled={emailsSyncing}
                    className="flex items-center gap-1.5 text-xs bg-[#011745] text-white px-3 py-1.5 rounded-lg hover:bg-[#0a2d6b] transition-colors disabled:opacity-60"
                  >
                    {emailsSyncing
                      ? <><Loader2 size={12} className="animate-spin" /> Synchroniseren...</>
                      : <><RefreshCw size={12} /> Gmail Sync</>}
                  </button>
                </div>
              </div>

              <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${
                emailsSyncing ? 'bg-amber-50 border-amber-200' : 'bg-[#eef2fa] border-[#3d61a4]/20'
              }`}>
                {emailsSyncing
                  ? <Loader2 size={14} className="text-amber-500 animate-spin flex-shrink-0" />
                  : <Mail size={14} className="text-[#3d61a4] flex-shrink-0" />
                }
                <p className={`text-[11px] ${emailsSyncing ? 'text-amber-700' : 'text-[#566079]'}`}>
                  {emailsSyncing
                    ? 'Gmail wordt automatisch gesynchroniseerd — e-mails van alle betrokken gebruikers worden opgehaald…'
                    : 'E-mails worden automatisch gesynchroniseerd bij elke opening en elke 30 min via de backend. Inclusief e-mails van alle medewerkers die aan dit dossier gewerkt hebben.'
                  }
                </p>
              </div>

              {emailsLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-[#3d61a4]" /></div>
              ) : syncedEmails.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 bg-[#eef2fa] rounded-full flex items-center justify-center mx-auto">
                    <Mail size={22} className="text-[#3d61a4]" />
                  </div>
                  <p className="text-sm font-medium text-[#252f4a]">Nog geen e-mails gesynchroniseerd</p>
                  <p className="text-xs text-[#7b859e]">Klik op "Gmail Sync" om e-mails op te halen</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {syncedEmails.map(email => (
                    <div key={email.id} className="bg-white rounded-xl border border-[#e8eaf2] overflow-hidden hover:border-[#5a7fc2] transition-colors">
                      <button
                        onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                        className="w-full text-left p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#011745] truncate">{email.subject || '(geen onderwerp)'}</p>
                            <p className="text-xs text-[#7b859e] mt-0.5">
                              {email.direction === 'inbound' ? '↙ Van: ' : '↗ Naar: '}
                              <span className="text-[#566079]">{email.direction === 'inbound' ? email.from_email : email.to_email}</span>
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              email.direction === 'inbound' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {email.direction === 'inbound' ? 'Ontvangen' : 'Verzonden'}
                            </span>
                            <span className="text-[10px] text-[#a4abbe]">
                              {email.received_at ? new Date(email.received_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </span>
                            {expandedEmail === email.id ? <ChevronUp size={14} className="text-[#a4abbe]" /> : <ChevronDown size={14} className="text-[#a4abbe]" />}
                          </div>
                        </div>
                        {expandedEmail !== email.id && email.snippet && (
                          <p className="text-xs text-[#7b859e] mt-2 line-clamp-2">{email.snippet}</p>
                        )}
                      </button>
                      {expandedEmail === email.id && (
                        <div className="border-t border-[#e8eaf2] px-4 py-4">
                          <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
                            <div><span className="text-[#a4abbe]">Van: </span><span className="text-[#566079]">{email.from_email}</span></div>
                            <div><span className="text-[#a4abbe]">Aan: </span><span className="text-[#566079]">{email.to_email}</span></div>
                            <div><span className="text-[#a4abbe]">Datum: </span><span className="text-[#566079]">{email.received_at ? new Date(email.received_at).toLocaleString('nl-NL') : '—'}</span></div>
                          </div>
                          {email.body_html ? (
                            <div className="text-xs text-[#252f4a] leading-relaxed bg-[#f7f8fc] rounded-lg p-3 max-h-64 overflow-y-auto"
                              dangerouslySetInnerHTML={{ __html: email.body_html }} />
                          ) : email.snippet ? (
                            <p className="text-xs text-[#566079] bg-[#f7f8fc] rounded-lg p-3">{email.snippet}</p>
                          ) : (
                            <p className="text-xs text-[#a4abbe] italic">Geen berichttekst beschikbaar.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Notes & Activity Tab ─── */}
          {activeTab === 'communicatie' && (
            <div className="space-y-6">
              {/* Add communication */}
              <div>
                <h3 className="font-semibold text-[#011745] mb-4 flex items-center gap-2">
                  <MessageSquare size={18} />
                  Communicatie Log
                </h3>
                <div className="space-y-3">
                  <textarea
                    value={newComm}
                    onChange={e => setNewComm(e.target.value)}
                    placeholder="Log een communicatie (telefoongesprek, email, meeting, etc.)..."
                    className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none h-20"
                  />
                  <button
                    onClick={handleAddComm}
                    disabled={addingComm || !newComm.trim()}
                    className="px-4 py-2 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {addingComm ? 'Opslaan...' : 'Communicatie Loggen'}
                  </button>
                </div>
              </div>

              {/* Communications list */}
              <div className="space-y-3">
                {(Array.isArray(communications) ? communications : []).length > 0 ? communications.map((comm, i) => (
                  <div key={comm.id || i} className="bg-[#f7f8fc] rounded-lg p-4 border border-[#e8eaf2]">
                    <p className="text-sm text-[#566079]">{comm.content}</p>
                    <p className="text-xs text-[#a4abbe] mt-2">
                      {comm.user_name && <span className="font-medium">{comm.user_name} — </span>}
                      {comm.created_at && new Date(comm.created_at).toLocaleString('nl-NL')}
                    </p>
                  </div>
                )) : (
                  <div className="bg-[#f7f8fc] rounded-lg p-4 text-center text-[#7b859e] text-sm">
                    Nog geen communicatie gelogd
                  </div>
                )}
              </div>

              {/* Notes (preserved from prospect phase) */}
              {(notes || []).length > 0 && (
                <div className="border-t border-[#e8eaf2] pt-6">
                  <h3 className="font-semibold text-[#011745] mb-4 flex items-center gap-2">
                    <FileText size={18} />
                    Notities
                  </h3>
                  <div className="space-y-3">
                    {notes.map((note, idx) => (
                      <div key={note.id || idx} className="bg-[#f7f8fc] rounded-lg p-4">
                        <p className="text-[#566079]">{note.text || note.content}</p>
                        <p className="text-xs text-[#a4abbe] mt-2">
                          {note.date ? (typeof note.date === 'string' ? note.date : note.date.toLocaleDateString('nl-NL')) : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ─── Bedrijfsinfo Tab ─── */}
          {activeTab === 'bedrijfsinfo' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Bedrijfsinformatie</h3>
                <button onClick={handleReEnrich} disabled={enriching}
                  className="flex items-center gap-2 text-[#3d61a4] hover:text-[#0a2d6b] font-medium text-sm disabled:opacity-50">
                  {enriching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Verrijk met AI
                </button>
              </div>
              {enriching && !enrichment ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={28} className="animate-spin text-[#3d61a4]" />
                  <p className="text-sm text-[#566079]">Bedrijfsdata ophalen via website & AI...</p>
                </div>
              ) : !enrichment || (!enrichment.description && enrichment.fit_score == null) ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#eef2fa] flex items-center justify-center mx-auto">
                    <Zap size={22} className="text-[#3d61a4]" />
                  </div>
                  <p className="text-sm text-[#566079]">Nog geen bedrijfsanalyse beschikbaar.</p>
                  <p className="text-xs text-[#a4abbe]">Klik op "Verrijk met AI" om een volledig bedrijfsprofiel op te halen.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrichment.fit_score != null && (
                    <div className="rounded-xl p-4 flex items-start gap-4" style={{
                      background: enrichment.fit_score >= 7 ? 'linear-gradient(135deg, #011745 0%, #0a2d6b 100%)'
                        : enrichment.fit_score >= 4 ? 'linear-gradient(135deg, #78350f 0%, #b45309 100%)'
                        : 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)'
                    }}>
                      <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center bg-white/15 flex-shrink-0">
                        <span className="text-2xl font-bold text-white leading-none">{enrichment.fit_score}</span>
                        <span className="text-[9px] text-white/70 font-medium">/10</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-0.5">Taper Fit Score</p>
                        <p className="text-sm text-white font-medium leading-snug">{enrichment.fit_reason || '—'}</p>
                        {enrichment.taper_fit_products?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {enrichment.taper_fit_products.map((p, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">{p}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {enrichment.description && (
                    <div className="bg-[#f7f8fc] rounded-xl p-4 border border-[#e8eaf2]">
                      <p className="text-xs font-semibold uppercase text-[#7b859e] mb-2">Over het bedrijf</p>
                      <p className="text-sm text-[#566079] leading-relaxed">{enrichment.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Industrie', enrichment.industry],
                      ['Bedrijfsgrootte', enrichment.company_size],
                      ['Opgericht', enrichment.founding_year],
                      ['Hoofdkantoor', enrichment.headquarters],
                      ['Geschatte omzet', enrichment.annual_revenue_estimate],
                      ['KVK', enrichment.kvk],
                      ['Land', enrichment.country],
                      ['Telefoon', enrichment.phone],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <div key={label} className="p-3 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2]">
                        <p className="text-[10px] font-semibold uppercase text-[#a4abbe] mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-[#011745] truncate">{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {enrichment.website && (
                      <a href={enrichment.website.startsWith('http') ? enrichment.website : `https://${enrichment.website}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2] hover:border-[#3d61a4] transition-colors group">
                        <span className="text-xs text-[#7b859e]">Website</span>
                        <span className="text-sm text-[#3d61a4] font-medium flex items-center gap-1 group-hover:underline">
                          {enrichment.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} <ExternalLink size={11} />
                        </span>
                      </a>
                    )}
                    {enrichment.linkedin && (
                      <a href={enrichment.linkedin.startsWith('http') ? enrichment.linkedin : `https://${enrichment.linkedin}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2] hover:border-[#3d61a4] transition-colors group">
                        <span className="text-xs text-[#7b859e]">LinkedIn</span>
                        <span className="text-sm text-[#3d61a4] font-medium flex items-center gap-1 group-hover:underline">LinkedIn profiel <ExternalLink size={11} /></span>
                      </a>
                    )}
                  </div>
                  {enrichment.international_trade != null && (
                    <div className="p-4 rounded-xl border border-[#e8eaf2] bg-[#f7f8fc]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${enrichment.international_trade ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <p className="text-xs font-semibold text-[#566079]">
                          {enrichment.international_trade ? 'Internationaal actief' : 'Voornamelijk lokaal'}
                        </p>
                      </div>
                      {enrichment.trade_countries?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {enrichment.trade_countries.map((c, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-[#e8eaf2] text-[#566079]">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {enrichment.fx_relevance && (
                    <div className="p-4 rounded-xl bg-[#eef2fa] border border-[#c7d4ef]">
                      <p className="text-[10px] font-semibold uppercase text-[#3d61a4] mb-1">FX / Betalingsbehoefte</p>
                      <p className="text-sm text-[#566079]">{enrichment.fx_relevance}</p>
                    </div>
                  )}
                  {enrichment.pain_points?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#7b859e] mb-2">Financiële pijnpunten</p>
                      {enrichment.pain_points.map((pp, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-[#566079] mb-1.5">
                          <span className="text-amber-500 mt-0.5 flex-shrink-0">⚡</span><span>{pp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {enrichment.products_services?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#7b859e] mb-2">Producten & Diensten</p>
                      <div className="flex flex-wrap gap-1.5">
                        {enrichment.products_services.map((s, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2] text-[#566079]">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {enrichment.business_segments?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#7b859e] mb-2">Zakelijke segmenten</p>
                      <div className="flex flex-wrap gap-1.5">
                        {enrichment.business_segments.map((seg, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-[#eef2fa] text-[#3d61a4] font-medium">{seg}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {enrichment.enriched_at && (
                    <p className="text-[10px] text-[#a4abbe] text-right">
                      Verrijkt op {new Date(enrichment.enriched_at).toLocaleString('nl-NL')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-[#f7f8fc] border-t border-[#e8eaf2] px-8 py-4 flex gap-3 justify-between items-center rounded-b-3xl">
          <div>
            {saveMsg && (
              <span className={`text-sm font-medium ${saveMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {saveMsg.text}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#566079] hover:bg-white rounded-lg font-medium text-sm transition-colors border border-[#e8eaf2]"
            >
              Annuleren
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 bg-[#3d61a4] text-white rounded-lg font-medium text-sm hover:bg-[#0a2d6b] transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Opslaan
            </button>
          </div>
        </div>
      </div>

      {/* ─── Bevestigingspopup vóór het versturen van een calendar-uitnodiging (verstuurt ECHTE e-mail) ─── */}
      {inviteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !inviteSending && setInviteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: '#7a1f1f' }}>
              <Mail size={20} style={{ color: '#fff' }} />
              <div>
                <h3 className="text-base font-bold text-white">Waarschuwing — e-mail versturen</h3>
                <p className="text-xs" style={{ color: '#f3c9c9' }}>
                  Deze actie verstuurt een echte uitnodiging via Google Calendar
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-auto">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#7b859e' }}>Ontvangers</label>
                <div className="flex flex-wrap gap-2">
                  {(inviteConfirm.recipients || []).length === 0 ? (
                    <span className="text-sm" style={{ color: '#566079' }}>(interne genodigden)</span>
                  ) : (
                    inviteConfirm.recipients.map((r, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                        {r}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#7b859e' }}>Uitnodigingstekst (aanpasbaar)</label>
                <textarea
                  value={inviteConfirm.inviteText}
                  onChange={(e) => setInviteConfirm((c) => ({ ...c, inviteText: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2.5 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm focus:border-[#3d61a4] focus:outline-none resize-none"
                  style={{ color: '#011745' }}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e8eaf2] flex justify-end gap-3">
              <button
                onClick={() => setInviteConfirm(null)}
                disabled={inviteSending}
                className="px-4 py-2 text-[#566079] hover:bg-[#f7f8fc] rounded-lg font-medium text-sm transition-colors border border-[#e8eaf2] disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                onClick={confirmSendInvite}
                disabled={inviteSending}
                className="px-5 py-2 text-white rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: '#7a1f1f' }}
              >
                {inviteSending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Verzend uitnodiging
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
