import React, { useState, useEffect, useCallback, useRef } from 'react';

const sanitize = (html) => {
  if (typeof window !== 'undefined' && window.DOMPurify) {
    return window.DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
  }
  return html || '';
};

import {
  X, Phone, Mail, MapPin, Globe, Lock, Unlock, Clock, Send, Plus,
  Download, Trash2, MessageSquare, FileText, RefreshCw, Zap,
  CheckCircle, AlertCircle, Loader2, Calendar, ArrowRight,
  ExternalLink, Smartphone, Upload, ChevronDown, ChevronUp, Star,
  MessageCircle, Share2, Edit3,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CallTimer from './CallTimer';

const statusColors = {
  New: '#3d61a4', Contacted: '#579bfc', Callback: '#ff5ac4',
  Interested: '#00c875', 'Not Interested': '#ff642e',
  Snoozed: '#a4abbe', Archived: '#7b859e', Converted: '#037f4c',
};
const statusLabels = {
  New: 'Nieuw', Contacted: 'Gecontacteerd', Callback: 'Terugbellen',
  Interested: 'Geïnteresseerd', 'Not Interested': 'Niet geïnteresseerd',
  Snoozed: 'Gesnoozed', Archived: 'Gearchiveerd', Converted: 'Geconverteerd',
};

/** Deterministic color per partner name — consistent per string */
function partnerColor(name) {
  if (!name) return { bg: '#e8eaf2', text: '#566079', dot: '#a4abbe' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return {
    bg:   `hsl(${hue}, 60%, 92%)`,
    text: `hsl(${hue}, 55%, 28%)`,
    dot:  `hsl(${hue}, 70%, 45%)`,
  };
}

/** Get auth token from session storage */
const getToken = () => sessionStorage.getItem('auth_token');

/** Generic API helper */
async function api(url, options = {}) {
  const token = getToken();
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.detail || `API error ${resp.status}`);
  }
  return resp.json();
}

export default function LeadDetailPopup({ lead, onClose, onUpdate }) {
  const { user: authUser } = useAuth();
  const isAdminUser = ['admin_pay', 'admin_trade'].includes(authUser?.role);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState({});
  const [toast, setToast] = useState(null);

  // ─── Notes state ──────────────────────────────────
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // ─── Call log state ───────────────────────────────
  const [callLogs, setCallLogs] = useState([]);
  const [showCallTimer, setShowCallTimer] = useState(false);
  const [callLogsLoading, setCallLogsLoading] = useState(false);

  // ─── Documents state ──────────────────────────────
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // ─── Callbacks state ──────────────────────────────
  const [callbacks, setCallbacks] = useState([]);
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackNotes, setCallbackNotes] = useState('');
  const [callbackInvitedUsers, setCallbackInvitedUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [calendarConfirm, setCalendarConfirm] = useState(null); // 'added' | 'no_token' | null

  // ─── Communications state ─────────────────────────
  const [communications, setCommunications] = useState([]);
  const [newComm, setNewComm] = useState('');
  const [commsLoading, setCommsLoading] = useState(false);

  // ─── About state ──────────────────────────────────
  const [enrichment, setEnrichment] = useState(null);
  const [enriching, setEnriching] = useState(false);

  // ─── Editable fields state ────────────────────────
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  // ─── Snooze state ─────────────────────────────────
  const [showSnoozeForm, setShowSnoozeForm] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState('');
  const [snoozeReason, setSnoozeReason] = useState('');

  // ─── Contact methods state ────────────────────────
  const [contactMethods, setContactMethods] = useState([]);
  const [contactMethodsLoading, setContactMethodsLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });

  // ─── Conversation logs state ──────────────────────
  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [expandedConv, setExpandedConv] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);    // manual log
  const [showUploadForm, setShowUploadForm] = useState(false); // transcript upload
  const [showWAImport, setShowWAImport] = useState(false);     // whatsapp import
  const [convForm, setConvForm] = useState({
    type: 'phone', direction: 'outbound', contact_value: '',
    duration_seconds: '', outcome: '', summary: '', occurred_at: '',
  });
  const [transcriptFile, setTranscriptFile] = useState(null);
  const [waFile, setWaFile] = useState(null);
  const [convUploading, setConvUploading] = useState(false);

  // ─── Revenue Potentie state ───────────────────────
  const [revRows, setRevRows] = useState(() => {
    const saved = lead._raw?.revenue_potential || lead.revenue_potential;
    return Array.isArray(saved) && saved.length > 0
      ? saved
      : [{ id: Date.now(), currency_pair: 'EUR/USD', volume: '', margin_pct: '0.5', custom_pair: '' }];
  });
  const revSaveTimer = useRef(null);

  // ─── Trade Finance Revenue state ──────────────────
  const [tfRows, setTfRows] = useState(() => {
    const saved = lead._raw?.tf_revenue_potential || lead.tf_revenue_potential;
    return Array.isArray(saved) && saved.length > 0
      ? saved
      : [{ id: Date.now(), product: 'Factoring', bedrag: '', percentage: '1.5' }];
  });
  const tfSaveTimer = useRef(null);
  const [fxLocked, setFxLocked] = useState(() => !!(lead._raw?.revenue_potential_locked || lead.revenue_potential_locked));
  const [tfLocked, setTfLocked] = useState(() => !!(lead._raw?.tf_revenue_potential_locked || lead.tf_revenue_potential_locked));

  useEffect(() => {
    return () => {
      if (revSaveTimer.current) clearTimeout(revSaveTimer.current);
    };
  }, []);

  const transcriptInputRef = useRef(null);
  const waInputRef = useRef(null);

  // Get the raw lead ID (strip string prefix if needed)
  const leadId = lead._raw?.id || lead.id;

  // Show toast notification
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Save a single editable field
  const saveField = async (apiField, value) => {
    try {
      await api(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ [apiField]: value }),
      });
      showToast('Opgeslagen');
      if (onUpdate) onUpdate({ [apiField]: value });
    } catch (err) {
      showToast('Opslaan mislukt: ' + err.message, 'error');
    }
    setEditingField(null);
  };

  // Debounced auto-save for revenue potential rows
  const saveRevRows = useCallback((rows) => {
    if (revSaveTimer.current) clearTimeout(revSaveTimer.current);
    revSaveTimer.current = setTimeout(async () => {
      try {
        await api(`/api/v1/leads/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify({ revenue_potential: rows }),
        });
      } catch (err) {
        showToast('Opslaan mislukt: ' + err.message, 'error');
      }
    }, 800);
  }, [leadId]);

  // Debounced auto-save for Trade Finance revenue rows
  const saveTfRows = useCallback((rows) => {
    if (tfSaveTimer.current) clearTimeout(tfSaveTimer.current);
    tfSaveTimer.current = setTimeout(async () => {
      try {
        await api(`/api/v1/leads/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify({ tf_revenue_potential: rows }),
        });
      } catch (err) {
        showToast('Opslaan mislukt: ' + err.message, 'error');
      }
    }, 800);
  }, [leadId]);

  // Lock/save FX revenue section
  const saveLockFx = async () => {
    try {
      await api(`/api/v1/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ revenue_potential: revRows, revenue_potential_locked: true }) });
      setFxLocked(true);
      showToast('FX Revenue opgeslagen en vergrendeld');
    } catch (err) { showToast('Opslaan mislukt: ' + err.message, 'error'); }
  };
  const saveLockTf = async () => {
    try {
      await api(`/api/v1/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ tf_revenue_potential: tfRows, tf_revenue_potential_locked: true }) });
      setTfLocked(true);
      showToast('Trade Finance Revenue opgeslagen en vergrendeld');
    } catch (err) { showToast('Opslaan mislukt: ' + err.message, 'error'); }
  };

  // ─── Synced emails state ──────────────────────────
  const [syncedEmails, setSyncedEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailsSyncing, setEmailsSyncing] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState(null);

  const fetchSyncedEmails = async () => {
    setEmailsLoading(true);
    try {
      const data = await api(`/api/v1/leads/${leadId}/emails`);
      setSyncedEmails(Array.isArray(data) ? data : []);
    } catch {
      setSyncedEmails([]);
    }
    setEmailsLoading(false);
  };

  const syncGmail = async () => {
    setEmailsSyncing(true);
    try {
      const result = await api(`/api/v1/leads/${leadId}/sync-gmail`, { method: 'POST' });
      showToast(result.message || `${result.synced} e-mail(s) gesynchroniseerd`);
      await fetchSyncedEmails();
    } catch (err) {
      showToast('Sync mislukt: ' + err.message, 'error');
    }
    setEmailsSyncing(false);
  };

  // ─── Load tab data on tab switch ──────────────────
  useEffect(() => {
    if (activeTab === 'notes') fetchNotes();
    if (activeTab === 'calllog') fetchCallLogs();
    if (activeTab === 'documents') fetchDocuments();
    if (activeTab === 'about') fetchEnrichment();
    if (activeTab === 'communicatie') fetchCommunications();
    if (activeTab === 'contacten') fetchContactMethods();
    if (activeTab === 'gesprekken') fetchConversations();
    if (activeTab === 'emails') {
      // First show what's already in DB (fast), then auto-sync in background
      fetchSyncedEmails();
      syncGmail();
    }
  }, [activeTab]);

  // ─── Load active users for callback invite ────────
  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await api('/api/v1/users/?status=active');
        setAllUsers(data.users || []);
      } catch {
        // Not an admin? Fall back to empty list — invite dropdown just won't show
        setAllUsers([]);
      }
    }
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Notes API ────────────────────────────────────
  const fetchNotes = async () => {
    setNotesLoading(true);
    try {
      // Notes are stored via the communications/notes endpoint
      const data = await api(`/api/v1/leads/${leadId}`);
      // The lead detail endpoint returns notes via relationship
      setNotes((data.notes || []).map(n => ({
        id: n.id,
        text: n.content || n.text,
        date: new Date(n.created_at),
        user: n.user_name || 'Gebruiker',
      })));
    } catch {
      // If no notes endpoint, keep local state
      setNotes(lead.notes || []);
    }
    setNotesLoading(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setLoading(l => ({ ...l, addNote: true }));
    try {
      // POST note to the dedicated notes endpoint
      const saved = await api(`/api/v1/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: newNote }),
      });
      const note = {
        id: saved?.id || Date.now(),
        text: newNote,
        date: new Date(),
        user: 'Jij',
      };
      setNotes(prev => [note, ...prev]);
      setNewNote('');
      showToast('Notitie toegevoegd');
    } catch (err) {
      // Fallback: local only
      const note = { id: Date.now(), text: newNote, date: new Date(), user: 'Jij' };
      setNotes(prev => [note, ...prev]);
      setNewNote('');
    }
    setLoading(l => ({ ...l, addNote: false }));
  };

  // ─── Delete lead (soft-delete, admin only) ────────
  const handleDeleteLead = async () => {
    if (!window.confirm(`Lead "${lead.company}" permanent verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    try {
      await api(`/api/v1/leads/${leadId}`, { method: 'DELETE' });
      showToast('Lead verwijderd');
      setTimeout(() => { onClose(); if (onUpdate) onUpdate(); }, 500);
    } catch (err) {
      showToast('Verwijderen mislukt: ' + err.message, 'error');
    }
  };

  // ─── Note edit / delete ───────────────────────────
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Notitie verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${leadId}/notes/${noteId}`, { method: 'DELETE' });
      showToast('Notitie verwijderd');
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (onUpdate) onUpdate();
    } catch (err) { showToast('Fout: ' + err.message, 'error'); }
  };

  const handleEditNote = async (noteId) => {
    if (!editingNoteText.trim()) return;
    try {
      await api(`/api/v1/leads/${leadId}/notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editingNoteText }),
      });
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, text: editingNoteText } : n));
      setEditingNoteId(null);
      showToast('Notitie bijgewerkt');
      if (onUpdate) onUpdate();
    } catch (err) { showToast('Fout: ' + err.message, 'error'); }
  };

  // ─── Communications API ───────────────────────────
  const fetchCommunications = async () => {
    setCommsLoading(true);
    try {
      const data = await api(`/api/v1/leads/${leadId}/communications`);
      setCommunications(Array.isArray(data) ? data : []);
    } catch {
      setCommunications([]);
    }
    setCommsLoading(false);
  };

  const handleAddComm = async () => {
    if (!newComm.trim()) return;
    setLoading(l => ({ ...l, addComm: true }));
    try {
      await api(`/api/v1/leads/${leadId}/communications`, {
        method: 'POST',
        body: JSON.stringify({ content: newComm }),
      });
      setNewComm('');
      fetchCommunications();
      showToast('Communicatie gelogd');
    } catch (err) {
      showToast('Opslaan mislukt: ' + err.message, 'error');
    }
    setLoading(l => ({ ...l, addComm: false }));
  };

  // ─── Call Log API ─────────────────────────────────
  const fetchCallLogs = async () => {
    setCallLogsLoading(true);
    try {
      const data = await api(`/api/v1/leads/${leadId}`);
      setCallLogs((data.call_logs || []).map(c => ({
        id: c.id,
        date: new Date(c.created_at),
        duration: c.duration_seconds ? Math.round(c.duration_seconds / 60) : 0,
        notes: c.notes || '',
        outcome: c.outcome || '',
      })));
    } catch {
      setCallLogs([]);
    }
    setCallLogsLoading(false);
  };

  const handleCallLog = async (callData) => {
    try {
      // Update lead as called
      await api(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_called: true }),
      });
      showToast(`Gesprek gelogd: ${callData.duration}s`);
      onUpdate({ ...lead, called: true, lastCall: new Date() });
      fetchCallLogs();
    } catch (err) {
      showToast('Gesprek kon niet worden opgeslagen', 'error');
    }
    setShowCallTimer(false);
  };

  // ─── Documents API ────────────────────────────────
  const fetchDocuments = async () => {
    setDocsLoading(true);
    try {
      const data = await api(`/api/v1/documents/lead/${leadId}`);
      setDocuments((data.documents || data || []).map(d => ({
        id: d.id,
        name: d.original_filename || d.name,
        size: d.file_size ? (d.file_size / 1024).toFixed(1) : '?',
        date: new Date(d.created_at || d.uploaded_at),
        type: d.category || d.file_type || 'file',
        path: d.file_path,
      })));
    } catch {
      setDocuments([]);
    }
    setDocsLoading(false);
  };

  const handleFileUpload = async (files) => {
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('lead_id', leadId);
        formData.append('category', 'general');

        const token = getToken();
        const resp = await fetch('/api/v1/documents/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (resp.ok) {
          showToast(`${file.name} geüpload`);
          fetchDocuments();
        } else {
          showToast(`Upload mislukt: ${file.name}`, 'error');
        }
      } catch {
        showToast(`Upload mislukt: ${file.name}`, 'error');
      }
    }
  };

  // ─── Quick Actions (real API calls) ───────────────
  const handleToggleDailyList = async () => {
    setLoading(l => ({ ...l, dailyList: true }));
    try {
      if (lead.onDailyList) {
        await api(`/api/v1/leads/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify({ on_daily_list: false }),
        });
        onUpdate({ ...lead, onDailyList: false });
        showToast('Verwijderd van bellijst');
      } else {
        await api(`/api/v1/leads/${leadId}/to-daily-list`, { method: 'POST' });
        onUpdate({ ...lead, onDailyList: true });
        showToast('Toegevoegd aan bellijst');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(l => ({ ...l, dailyList: false }));
  };

  const handleLockLead = async () => {
    setLoading(l => ({ ...l, lock: true }));
    try {
      const isLocked = lead._raw?.is_locked;
      if (isLocked) {
        await api(`/api/v1/leads/${leadId}/unlock`, { method: 'POST' });
        onUpdate({ ...lead, _raw: { ...lead._raw, is_locked: false } });
        showToast('Lead ontgrendeld');
      } else {
        await api(`/api/v1/leads/${leadId}/lock`, { method: 'POST' });
        onUpdate({ ...lead, _raw: { ...lead._raw, is_locked: true } });
        showToast('Lead vergrendeld voor jou');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(l => ({ ...l, lock: false }));
  };

  const handleSnooze = async () => {
    if (!snoozeUntil) return;
    setLoading(l => ({ ...l, snooze: true }));
    try {
      await api(`/api/v1/leads/${leadId}/snooze`, {
        method: 'POST',
        body: JSON.stringify({
          until: new Date(snoozeUntil).toISOString(),
          reason: snoozeReason || null,
        }),
      });
      onUpdate({ ...lead, status: 'Snoozed' });
      showToast(`Gesnoozed tot ${new Date(snoozeUntil).toLocaleDateString('nl-NL')}`);
      setShowSnoozeForm(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(l => ({ ...l, snooze: false }));
  };

  const handleSendToProspect = async () => {
    if (!window.confirm('Weet je zeker dat je deze lead naar Prospect wilt verplaatsen?')) return;
    setLoading(l => ({ ...l, prospect: true }));
    try {
      await api(`/api/v1/leads/${leadId}/to-prospect`, { method: 'POST' });
      showToast('Lead verplaatst naar Prospects!');
      onUpdate({ ...lead, status: 'Converted' });
      setTimeout(onClose, 1500);
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(l => ({ ...l, prospect: false }));
  };

  // ─── Contact Methods API ──────────────────────────
  const fetchContactMethods = async () => {
    setContactMethodsLoading(true);
    try {
      const data = await api(`/api/v1/leads/${leadId}/contact-methods`);
      setContactMethods(Array.isArray(data) ? data : []);
    } catch {
      setContactMethods([]);
    }
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
        await api(`/api/v1/leads/${leadId}/contact-methods`, { method: 'POST', body: JSON.stringify(entry) });
      }
      showToast(`Contact toegevoegd${entries.length > 1 ? ` (${entries.length} velden)` : ''}`);
      setNewContact({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });
      setShowAddContact(false);
      fetchContactMethods();
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    }
  };

  const handleDeleteContactMethod = async (methodId) => {
    if (!window.confirm('Weet je zeker dat je dit wilt verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${leadId}/contact-methods/${methodId}`, { method: 'DELETE' });
      showToast('Verwijderd');
      fetchContactMethods();
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    }
  };

  const handleSetPrimary = async (methodId) => {
    try {
      await api(`/api/v1/leads/${leadId}/contact-methods/${methodId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_primary: true }),
      });
      fetchContactMethods();
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    }
  };

  // ─── Conversation Logs API ────────────────────────
  const fetchConversations = async () => {
    setConvsLoading(true);
    try {
      const data = await api(`/api/v1/leads/${leadId}/conversations`);
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    }
    setConvsLoading(false);
  };

  const handleLogConversation = async () => {
    try {
      await api(`/api/v1/leads/${leadId}/conversations`, {
        method: 'POST',
        body: JSON.stringify({
          ...convForm,
          duration_seconds: convForm.duration_seconds ? parseInt(convForm.duration_seconds) : null,
          occurred_at: convForm.occurred_at || new Date().toISOString(),
        }),
      });
      showToast('Gesprek gelogd');
      setShowLogForm(false);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchConversations();
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    }
  };

  const handleUploadTranscript = async () => {
    if (!transcriptFile) return;
    setConvUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', transcriptFile);
      formData.append('conv_type', convForm.type);
      formData.append('direction', convForm.direction);
      formData.append('contact_value', convForm.contact_value || '');
      formData.append('outcome', convForm.outcome || '');
      formData.append('summary', convForm.summary || '');
      formData.append('occurred_at', convForm.occurred_at || new Date().toISOString());
      if (convForm.duration_seconds) formData.append('duration_seconds', convForm.duration_seconds);

      const token = getToken();
      const resp = await fetch(`/api/v1/leads/${leadId}/conversations/upload-transcript`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) throw new Error((await resp.json()).detail || 'Upload mislukt');
      showToast('Transcript geüpload en samengevat door AI');
      setShowUploadForm(false);
      setTranscriptFile(null);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchConversations();
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    }
    setConvUploading(false);
  };

  const handleImportWhatsApp = async () => {
    if (!waFile) return;
    setConvUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', waFile);
      formData.append('contact_value', convForm.contact_value || '');
      formData.append('occurred_at', convForm.occurred_at || new Date().toISOString());

      const token = getToken();
      const resp = await fetch(`/api/v1/leads/${leadId}/conversations/whatsapp-import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) throw new Error((await resp.json()).detail || 'Import mislukt');
      showToast('WhatsApp-gesprek geïmporteerd en samengevat');
      setShowWAImport(false);
      setWaFile(null);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchConversations();
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    }
    setConvUploading(false);
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Gespreklog verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${leadId}/conversations/${convId}`, { method: 'DELETE' });
      showToast('Verwijderd');
      fetchConversations();
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    }
  };

  // ─── Callback scheduling ──────────────────────────
  const handleScheduleCallback = async () => {
    if (!callbackDate) return;
    setLoading(l => ({ ...l, callback: true }));
    setCalendarConfirm(null);
    try {
      const result = await api('/api/v1/callbacks/', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: parseInt(leadId),
          scheduled_at: new Date(callbackDate).toISOString(),
          callback_type: 'call',
          notes: callbackNotes || null,
          invited_user_ids: callbackInvitedUsers.length > 0 ? callbackInvitedUsers : null,
          add_to_calendar: true,
        }),
      });
      showToast('Terugbelafspraak ingepland');
      setShowCallbackForm(false);
      setCallbackDate('');
      setCallbackNotes('');
      setCallbackInvitedUsers([]);
      // Show calendar confirmation
      if (result?.google_event_id) {
        setCalendarConfirm('added');
      } else {
        setCalendarConfirm('no_token');
      }
      setTimeout(() => setCalendarConfirm(null), 5000);
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(l => ({ ...l, callback: false }));
  };

  // ─── AI Enrichment ────────────────────────────────
  const fetchEnrichment = async () => {
    if (enrichment) return; // Already loaded
    setEnriching(true);
    try {
      const data = await api(`/api/v1/leads/${leadId}`);
      // Parse company_description — may be JSON blob from AI enrichment
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
    } catch {
      setEnrichment({});
    }
    setEnriching(false);
  };

  const handleReEnrich = async () => {
    setEnriching(true);
    try {
      const data = await api(`/api/v1/ai/enrich-lead/${leadId}`, { method: 'POST' });
      showToast('Bedrijfsinfo verrijkt met AI');
      setEnrichment(null); // Force reload
      fetchEnrichment();
    } catch (err) {
      showToast('Verrijking mislukt: ' + err.message, 'error');
    }
    setEnriching(false);
  };

  const isLocked = lead._raw?.is_locked;

  // ─── Resizable panel ──────────────────────────────
  const POPUP_MIN = 480;
  const POPUP_MAX = 1200;
  const POPUP_DEFAULT = 680;
  const [popupWidth, setPopupWidth] = useState(() => {
    const saved = localStorage.getItem('taper_popup_width');
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= POPUP_MIN && parsed <= POPUP_MAX) return parsed;
    return POPUP_DEFAULT;
  });
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = popupWidth;

    const onMouseMove = (ev) => {
      if (!isResizing.current) return;
      const delta = startX.current - ev.clientX; // dragging left = wider
      const newWidth = Math.min(POPUP_MAX, Math.max(POPUP_MIN, startWidth.current + delta));
      setPopupWidth(newWidth);
    };

    const onMouseUp = (ev) => {
      isResizing.current = false;
      const delta = startX.current - ev.clientX;
      const newWidth = Math.min(POPUP_MAX, Math.max(POPUP_MIN, startWidth.current + delta));
      localStorage.setItem('taper_popup_width', String(newWidth));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <>
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Slide-in panel */}
      <div
        className="fixed right-0 top-0 bottom-0 bg-white shadow-2xl z-50 flex flex-col"
        style={{ width: `${popupWidth}px`, maxWidth: '100vw' }}
      >
        {/* Resize handle — left edge */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1.5 z-10 group"
          style={{ cursor: 'ew-resize' }}
          title="Sleep om te verbreden"
        >
          <div
            className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: '#3d61a4' }}
          />
        </div>
        {/* Toast */}
        {toast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-[#00c875] text-white'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="bg-white border-b border-[#e8eaf2] px-8 py-5 flex items-start justify-between flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[#011745]">{lead.company}</h1>
              <span
                className="px-3 py-1 rounded-full text-white text-xs font-medium"
                style={{ backgroundColor: statusColors[lead.status] || '#3d61a4' }}
              >
                {statusLabels[lead.status] || lead.status}
              </span>
              {isLocked && (
                <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-medium flex items-center gap-1">
                  <Lock size={12} /> Vergrendeld
                </span>
              )}
              {(lead.partnerName || lead._raw?.partner_name) && (() => {
                const pn = lead.partnerName || lead._raw?.partner_name;
                const pc = partnerColor(pn);
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: pc.bg, color: pc.text }}
                  >
                    <Share2 size={11} />
                    {pn}
                  </span>
                );
              })()}
            </div>
            <p className="text-[#7b859e] text-sm">{lead.country} • {lead.industry}</p>
          </div>
          <div className="flex items-center gap-1">
            {isAdminUser && (
              <button
                onClick={handleDeleteLead}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                style={{ color: '#dc2626' }}
                title="Lead verwijderen (admin)">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-[#f7f8fc] rounded-lg text-[#7b859e]">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-[#e8eaf2] px-8 flex gap-6 overflow-x-auto flex-shrink-0">
          {[
            { key: 'overview',     label: 'Overzicht' },
            { key: 'contacten',    label: 'Contacten' },
            { key: 'emails',       label: 'E-mails' },
            { key: 'gesprekken',   label: 'Gesprekken' },
            { key: 'notes',        label: 'Notities' },
            { key: 'documents',    label: 'Documenten' },
            { key: 'about',        label: 'Bedrijfsinfo' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3.5 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[#3d61a4] text-[#3d61a4]'
                  : 'border-transparent text-[#7b859e] hover:text-[#566079]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ═══ OVERVIEW ═══ */}
          {activeTab === 'overview' && (
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-8">
                {/* Company Info */}
                <div>
                  <h3 className="text-xs font-semibold text-[#566079] mb-3 uppercase tracking-wider">Bedrijf</h3>
                  <div className="space-y-3">
                    <EditableInfoRow label="Naam" value={lead.company} apiField="company_name"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Website" value={lead.website} apiField="company_website" icon={Globe}
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Land" value={lead.country} apiField="company_country" icon={MapPin}
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Industrie" value={lead.industry} apiField="company_industry"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow
                      label="Via Partner"
                      value={lead.partnerName || lead._raw?.partner_name || ''}
                      apiField="partner_name"
                      icon={Share2}
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField}
                    />
                    {/* Extra bedrijfsvelden */}
                    <EditableInfoRow label="BTW-nummer" value={lead._raw?.vat_number || ''} apiField="vat_number"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Klant IBAN" value={lead._raw?.client_iban || ''} apiField="client_iban"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Adres" value={lead._raw?.address_street || ''} apiField="address_street"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Stad" value={lead._raw?.address_city || ''} apiField="address_city"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Postcode" value={lead._raw?.address_postcode || ''} apiField="address_postcode"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                  </div>
                </div>
                {/* Contact Info */}
                <div>
                  <h3 className="text-xs font-semibold text-[#566079] mb-3 uppercase tracking-wider">Contact</h3>
                  <div className="space-y-3">
                    <EditableInfoRow label="Naam" value={lead.contactName} apiField="contact_name"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Functie" value={lead.position} apiField="contact_position"
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Email" value={lead.email} apiField="contact_email" icon={Mail}
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Telefoon" value={lead.phone} apiField="contact_phone" icon={Phone}
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} />
                    <EditableInfoRow label="Mobiel" value={lead.mobile} apiField="contact_mobile" icon={Phone}
                      editingField={editingField} setEditingField={setEditingField}
                      editValue={editValue} setEditValue={setEditValue} onSave={saveField} bold />
                    {/* Communicatievoorkeur */}
                    <div className="flex items-center justify-between py-2 border-b border-[#f7f8fc]">
                      <span className="text-xs font-medium" style={{ color: '#566079' }}>Voorkeur contact</span>
                      <select
                        value={lead._raw?.communication_preference || ''}
                        onChange={async (e) => { await saveField('communication_preference', e.target.value); }}
                        className="text-xs rounded-lg px-2 py-1 border focus:outline-none"
                        style={{ borderColor: '#e8eaf2', color: '#011745' }}>
                        <option value="">— Selecteer —</option>
                        <option value="email">E-mail</option>
                        <option value="phone">Telefoon</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Score */}
              <div className="bg-[#eef2fa] rounded-xl p-5 border border-[#5a7fc2]/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#011745]">AI Lead Score</h4>
                    <p className="text-xs text-[#7b859e]">Score op basis van bedrijfsprofiel</p>
                  </div>
                  <div className="text-4xl font-bold text-[#3d61a4]">{lead.score || '—'}</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-xs font-semibold text-[#566079] mb-3 uppercase tracking-wider">Acties</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href={`tel:${lead.mobile || lead.phone}`}
                    className="px-4 py-3 bg-[#00c875] hover:bg-[#037f4c] text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone size={16} /> Bel nu
                  </a>
                  <button
                    onClick={handleToggleDailyList}
                    disabled={loading.dailyList}
                    className="px-4 py-3 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading.dailyList ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                    {lead.onDailyList ? 'Van bellijst' : 'Op bellijst'}
                  </button>
                  <button
                    onClick={() => setShowCallbackForm(!showCallbackForm)}
                    className="px-4 py-3 bg-[#e8eaf2] hover:bg-[#cdd1e0] text-[#566079] rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Calendar size={16} /> Callback inplannen
                  </button>
                  <button
                    onClick={handleLockLead}
                    disabled={loading.lock}
                    className="px-4 py-3 bg-[#e8eaf2] hover:bg-[#cdd1e0] text-[#566079] rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading.lock ? <Loader2 size={16} className="animate-spin" /> : isLocked ? <Unlock size={16} /> : <Lock size={16} />}
                    {isLocked ? 'Ontgrendel' : 'Vergrendel'}
                  </button>
                  <button
                    onClick={() => setShowSnoozeForm(!showSnoozeForm)}
                    className="px-4 py-3 bg-[#e8eaf2] hover:bg-[#cdd1e0] text-[#566079] rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Clock size={16} /> Snooze
                  </button>
                  <button
                    onClick={handleSendToProspect}
                    disabled={loading.prospect}
                    className="px-4 py-3 bg-[#011745] hover:bg-[#0a2d6b] text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading.prospect ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    Naar Prospect
                  </button>
                </div>

                {/* Callback form */}
                {showCallbackForm && (
                  <div className="mt-3 p-4 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] space-y-3">
                    <input
                      type="datetime-local"
                      value={callbackDate}
                      onChange={e => setCallbackDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]"
                    />
                    <input
                      type="text"
                      value={callbackNotes}
                      onChange={e => setCallbackNotes(e.target.value)}
                      placeholder="Notities (optioneel)"
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]"
                    />
                    {/* Collega uitnodigen */}
                    {allUsers.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#566079' }}>
                          Collega uitnodigen (optioneel)
                        </label>
                        <select
                          multiple
                          value={callbackInvitedUsers.map(String)}
                          onChange={e => {
                            const selected = Array.from(e.target.selectedOptions, o => parseInt(o.value));
                            setCallbackInvitedUsers(selected);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                          style={{ minHeight: '72px' }}
                        >
                          {allUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({u.email})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] mt-1" style={{ color: '#a4abbe' }}>
                          Houd Ctrl/Cmd ingedrukt om meerdere collegas te selecteren
                        </p>
                      </div>
                    )}
                    <button
                      onClick={handleScheduleCallback}
                      disabled={!callbackDate || loading.callback}
                      className="w-full px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {loading.callback ? 'Inplannen...' : 'Callback Inplannen'}
                    </button>
                  </div>
                )}

                {/* Google Calendar bevestiging */}
                {calendarConfirm === 'added' && (
                  <div className="mt-2 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium"
                    style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                    <CheckCircle size={14} />
                    Toegevoegd aan Google Calendar
                  </div>
                )}
                {calendarConfirm === 'no_token' && (
                  <div className="mt-2 px-3 py-2 rounded-lg flex items-center gap-2 text-xs"
                    style={{ backgroundColor: '#eef2fa', color: '#3d61a4', border: '1px solid #cdd1e0' }}>
                    <Calendar size={14} />
                    Koppel Google account in je profiel voor calendar sync
                  </div>
                )}

                {/* Snooze form */}
                {showSnoozeForm && (
                  <div className="mt-3 p-4 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] space-y-3">
                    <input
                      type="date"
                      value={snoozeUntil}
                      onChange={e => setSnoozeUntil(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]"
                    />
                    <input
                      type="text"
                      value={snoozeReason}
                      onChange={e => setSnoozeReason(e.target.value)}
                      placeholder="Reden (optioneel)"
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]"
                    />
                    <button
                      onClick={handleSnooze}
                      disabled={!snoozeUntil || loading.snooze}
                      className="w-full px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {loading.snooze ? 'Snoozeo...' : 'Snooze'}
                    </button>
                  </div>
                )}
              </div>

              {/* ─── Revenue Potentie Widget ─── */}
              {(() => {
                const CURRENCY_PAIRS = [
                  'EUR/USD', 'EUR/GBP', 'EUR/CHF', 'EUR/DKK', 'EUR/SEK', 'EUR/NOK',
                  'EUR/PLN', 'USD/GBP', 'GBP/USD', 'USD/JPY', 'EUR/AED', 'EUR/CNY', 'Overig',
                ];

                const updateRow = (id, field, value) => {
                  const updated = revRows.map(r => r.id === id ? { ...r, [field]: value } : r);
                  setRevRows(updated);
                  saveRevRows(updated);
                };

                const addRow = () => {
                  const updated = [
                    ...revRows,
                    { id: Date.now(), currency_pair: 'EUR/USD', volume: '', margin_pct: '0.5', custom_pair: '' },
                  ];
                  setRevRows(updated);
                  saveRevRows(updated);
                };

                const removeRow = (id) => {
                  const updated = revRows.filter(r => r.id !== id);
                  const final = updated.length > 0
                    ? updated
                    : [{ id: Date.now(), currency_pair: 'EUR/USD', volume: '', margin_pct: '0.5', custom_pair: '' }];
                  setRevRows(final);
                  saveRevRows(final);
                };

                const calcRevenue = (row) => {
                  const v = parseFloat(row.volume) || 0;
                  const m = parseFloat(row.margin_pct) || 0;
                  return v * m / 100;
                };

                const totalRevenue = revRows.reduce((sum, r) => sum + calcRevenue(r), 0);

                const fmtEur = (n) => new Intl.NumberFormat('nl-NL', {
                  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
                }).format(n);

                return (
                  <div className="bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-3 bg-[#011745] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white tracking-wide">Revenue Potentie FX</h3>
                        {fxLocked && <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={9}/> Vergrendeld</span>}
                      </div>
                      {fxLocked
                        ? <button onClick={() => setFxLocked(false)} className="text-[11px] text-[#5a7fc2] hover:text-white transition-colors">Bewerken</button>
                        : <button onClick={saveLockFx} className="text-[11px] bg-[#3d61a4] hover:bg-[#5a7fc2] text-white px-3 py-1 rounded-lg font-medium transition-colors">Opslaan</button>
                      }
                    </div>

                    {/* Table */}
                    <div className="p-4 space-y-2" style={{ opacity: fxLocked ? 0.7 : 1, pointerEvents: fxLocked ? 'none' : 'auto' }}>
                      {/* Column headers */}
                      <div
                        className="grid gap-2 text-[10px] font-semibold text-[#a4abbe] uppercase tracking-wider px-1"
                        style={{ gridTemplateColumns: '2fr 2fr 1.5fr 1.5fr 28px' }}
                      >
                        <span>Valutapaar</span>
                        <span>Volume (€)</span>
                        <span>Marge %</span>
                        <span>Potentie</span>
                        <span></span>
                      </div>

                      {revRows.map((row) => {
                        const revenue = calcRevenue(row);
                        return (
                          <div
                            key={row.id}
                            className="grid gap-2 items-center"
                            style={{ gridTemplateColumns: '2fr 2fr 1.5fr 1.5fr 28px' }}
                          >
                            {/* Currency pair */}
                            <div>
                              {row.currency_pair === 'Overig' ? (
                                <div>
                                  <input
                                    type="text"
                                    value={row.custom_pair || ''}
                                    onChange={e => updateRow(row.id, 'custom_pair', e.target.value)}
                                    placeholder="bijv. CHF/NOK"
                                    className="w-full px-2 py-1.5 rounded-lg border border-[#cdd1e0] text-xs focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                                  />
                                  <button
                                    onClick={() => updateRow(row.id, 'currency_pair', 'EUR/USD')}
                                    className="text-[10px] text-[#3d61a4] hover:underline mt-0.5 ml-1"
                                  >
                                    terug
                                  </button>
                                </div>
                              ) : (
                                <select
                                  value={row.currency_pair}
                                  onChange={e => updateRow(row.id, 'currency_pair', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg border border-[#cdd1e0] text-xs focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                                >
                                  {CURRENCY_PAIRS.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {/* Volume */}
                            <input
                              type="number"
                              value={row.volume}
                              onChange={e => updateRow(row.id, 'volume', e.target.value)}
                              placeholder="0"
                              min="0"
                              className="w-full px-2 py-1.5 rounded-lg border border-[#cdd1e0] text-xs focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                            />

                            {/* Margin % */}
                            <div className="relative">
                              <input
                                type="number"
                                value={row.margin_pct}
                                onChange={e => updateRow(row.id, 'margin_pct', e.target.value)}
                                placeholder="0.5"
                                step="0.1"
                                min="0"
                                className="w-full pl-2 pr-5 py-1.5 rounded-lg border border-[#cdd1e0] text-xs focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#a4abbe]">%</span>
                            </div>

                            {/* Revenue (readonly) */}
                            <div className="px-2 py-1.5 rounded-lg bg-[#eef2fa] border border-[#5a7fc2]/20 text-xs font-semibold text-[#3d61a4] text-right">
                              {revenue > 0 ? fmtEur(revenue) : '—'}
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => removeRow(row.id)}
                              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#a4abbe] hover:text-[#ff642e] hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}

                      {/* Add row */}
                      <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#3d61a4] hover:text-[#0a2d6b] mt-1 px-1"
                      >
                        <Plus size={13} /> Rij toevoegen
                      </button>
                    </div>

                    {/* Total */}
                    <div className="px-5 py-3 bg-[#eef2fa] border-t border-[#5a7fc2]/20 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Totale Revenue Potentie</span>
                      <span className="text-lg font-bold text-[#011745]">
                        {totalRevenue > 0 ? fmtEur(totalRevenue) : '—'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* ═══ TRADE FINANCE REVENUE POTENTIE ═══ */}
              <div className="mt-4">
              {(() => {
                const TF_PRODUCTS = ['Factoring','Portfolio-gebaseerde lening','Structured Commodity Finance','Debtor Finance (Non-Recourse)','Overig'];
                const updateTfRow = (id, field, value) => { const updated = tfRows.map(r => r.id === id ? { ...r, [field]: value } : r); setTfRows(updated); saveTfRows(updated); };
                const addTfRow = () => { const updated = [...tfRows, { id: Date.now(), product: 'Factoring', bedrag: '', percentage: '1.5' }]; setTfRows(updated); saveTfRows(updated); };
                const removeTfRow = (id) => { const updated = tfRows.filter(r => r.id !== id); const final = updated.length > 0 ? updated : [{ id: Date.now(), product: 'Factoring', bedrag: '', percentage: '1.5' }]; setTfRows(final); saveTfRows(final); };
                const calcTf = (row) => (parseFloat(row.bedrag)||0) * (parseFloat(row.percentage)||0) / 100;
                const totalTf = tfRows.reduce((sum, r) => sum + calcTf(r), 0);
                const fmtE = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
                return (
                  <div className="bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] overflow-hidden">
                    <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: '#14532d' }}>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white tracking-wide">Revenue Potentie Trade Finance</h3>
                        {tfLocked && <span className="text-[10px] bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={9}/> Vergrendeld</span>}
                      </div>
                      {tfLocked
                        ? <button onClick={() => setTfLocked(false)} className="text-[11px] text-green-300 hover:text-white transition-colors">Bewerken</button>
                        : <button onClick={saveLockTf} className="text-[11px] bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-lg font-medium transition-colors">Opslaan</button>
                      }
                    </div>
                    <div className="p-4 space-y-2" style={{ opacity: tfLocked ? 0.7 : 1, pointerEvents: tfLocked ? 'none' : 'auto' }}>
                      <div className="grid gap-2 text-[10px] font-semibold text-[#a4abbe] uppercase tracking-wider px-1" style={{ gridTemplateColumns: '2.5fr 1.5fr 1.5fr 1.5fr 28px' }}>
                        <span>Product</span><span>Financieringsbehoefte</span><span>Marge %</span><span>Potentie</span><span></span>
                      </div>
                      {tfRows.map((row) => {
                        const rev = calcTf(row);
                        return (
                          <div key={row.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '2.5fr 1.5fr 1.5fr 1.5fr 28px' }}>
                            <select value={row.product} onChange={e => updateTfRow(row.id, 'product', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-[#cdd1e0] text-xs focus:outline-none bg-white">
                              {TF_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="number" value={row.bedrag} onChange={e => updateTfRow(row.id, 'bedrag', e.target.value)} onBlur={() => saveTfRows(tfRows)}
                              placeholder="0" min="0" className="w-full px-2 py-1.5 rounded-lg border border-[#cdd1e0] text-xs focus:outline-none bg-white" />
                            <div className="relative">
                              <input type="number" value={row.percentage} onChange={e => updateTfRow(row.id, 'percentage', e.target.value)} onBlur={() => saveTfRows(tfRows)}
                                placeholder="1.5" step="0.1" min="0" className="w-full pl-2 pr-5 py-1.5 rounded-lg border border-[#cdd1e0] text-xs focus:outline-none bg-white" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#a4abbe]">%</span>
                            </div>
                            <div className="px-2 py-1.5 rounded-lg text-xs font-semibold text-right" style={{ backgroundColor: '#f0fdf4', border: '1px solid rgba(20,83,45,0.2)', color: '#14532d' }}>
                              {rev > 0 ? fmtE(rev) : '—'}
                            </div>
                            <button onClick={() => removeTfRow(row.id)} className="flex items-center justify-center w-7 h-7 rounded-lg text-[#a4abbe] hover:text-[#ff642e] hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                      <button onClick={addTfRow} className="flex items-center gap-1.5 text-xs font-medium mt-1 px-1" style={{ color: '#14532d' }}>
                        <Plus size={13} /> Rij toevoegen
                      </button>
                    </div>
                    <div className="px-5 py-3 border-t flex items-center justify-between" style={{ backgroundColor: '#f0fdf4', borderColor: 'rgba(20,83,45,0.2)' }}>
                      <span className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Totale Revenue Potentie TF</span>
                      <span className="text-lg font-bold" style={{ color: '#14532d' }}>{totalTf > 0 ? fmtE(totalTf) : '—'}</span>
                    </div>
                  </div>
                );
              })()}
              </div>

            </div>
          )}

          {/* ═══ CONTACTEN ═══ */}
          {activeTab === 'contacten' && (
            <div className="p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Contactmethoden</h3>
                <button
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#3d61a4] hover:text-[#0a2d6b]"
                >
                  <Plus size={16} /> Toevoegen
                </button>
              </div>

              {/* Primair contact (ingevuld bij aanmaak) */}
              {(lead.contact_name || lead.contactName || lead._raw?.contact_name || lead.contact_email || lead.email || lead.contact_phone || lead.phone) && (
                <div className="bg-[#eef2fa] rounded-xl border border-[#3d61a4]/20 p-4 mb-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#3d61a4] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {(lead.contact_name || lead.contactName || lead._raw?.contact_name) ? (lead.contact_name || lead.contactName || lead._raw?.contact_name).charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-[#011745]">{lead.contact_name || lead.contactName || lead._raw?.contact_name || 'Onbekend'}</span>
                      {lead.contact_position && (
                        <span className="ml-2 text-xs text-[#566079]">{lead.contact_position}</span>
                      )}
                    </div>
                    <span className="ml-auto text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Star size={9} className="fill-amber-500" /> Primair
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-10">
                    {(lead.contact_email || lead.email || lead._raw?.contact_email) && (
                      <div className="flex items-center gap-2">
                        <span className="text-base">✉</span>
                        <a href={`mailto:${lead.contact_email || lead.email || lead._raw?.contact_email}`} className="text-sm text-[#3d61a4] hover:underline truncate">{lead.contact_email || lead.email || lead._raw?.contact_email}</a>
                      </div>
                    )}
                    {(lead.contact_phone || lead.phone || lead._raw?.contact_phone) && (
                      <div className="flex items-center gap-2">
                        <span className="text-base">📞</span>
                        <a href={`tel:${lead.contact_phone || lead.phone || lead._raw?.contact_phone}`} className="text-sm text-[#566079] hover:underline">{lead.contact_phone || lead.phone || lead._raw?.contact_phone}</a>
                      </div>
                    )}
                    {(lead.contact_mobile || lead.mobile || lead._raw?.contact_mobile) && (lead.contact_mobile || lead.mobile || lead._raw?.contact_mobile) !== (lead.contact_phone || lead.phone) && (
                      <div className="flex items-center gap-2">
                        <span className="text-base">📱</span>
                        <a href={`tel:${lead.contact_mobile || lead.mobile || lead._raw?.contact_mobile}`} className="text-sm text-[#566079] hover:underline">{lead.contact_mobile || lead.mobile || lead._raw?.contact_mobile}</a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Add contact form */}
              {showAddContact && (
                <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                  <p className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Nieuw contact</p>

                  {/* Naam */}
                  <div>
                    <label className="block text-xs text-[#a4abbe] mb-1">Naam</label>
                    <input
                      type="text"
                      value={newContact.name}
                      onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))}
                      placeholder="Sam de Vries"
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                    />
                  </div>

                  {/* Email + Mobiel naast elkaar */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-[#a4abbe] mb-1">✉ E-mail</label>
                      <input
                        type="email"
                        value={newContact.email}
                        onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))}
                        placeholder="sam@bedrijf.nl"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a4abbe] mb-1">📱 Mobiel</label>
                      <input
                        type="tel"
                        value={newContact.mobile}
                        onChange={e => setNewContact(c => ({ ...c, mobile: e.target.value }))}
                        placeholder="+31 6 12345678"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                      />
                    </div>
                  </div>

                  {/* WhatsApp (optioneel) */}
                  <div>
                    <label className="block text-xs text-[#a4abbe] mb-1">💬 WhatsApp <span className="text-[10px]">(optioneel)</span></label>
                    <input
                      type="tel"
                      value={newContact.whatsapp}
                      onChange={e => setNewContact(c => ({ ...c, whatsapp: e.target.value }))}
                      placeholder="+31 6 12345678"
                      className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white"
                    />
                  </div>

                  {/* Primair */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newContact.isPrimary}
                      onChange={e => setNewContact(c => ({ ...c, isPrimary: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm text-[#566079]">Primair contact</span>
                  </label>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleAddContactMethod}
                      disabled={!newContact.email.trim() && !newContact.mobile.trim() && !newContact.whatsapp.trim()}
                      className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#0a2d6b] transition-colors"
                    >
                      Contact opslaan
                    </button>
                    <button
                      onClick={() => { setShowAddContact(false); setNewContact({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false }); }}
                      className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm hover:bg-[#cdd1e0] transition-colors"
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              )}

              {contactMethodsLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-[#3d61a4]" /></div>
              ) : contactMethods.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm text-[#7b859e]">Nog geen contacten toegevoegd.</p>
                  <p className="text-xs text-[#a4abbe]">Klik op "+ Toevoegen" om een contactpersoon toe te voegen.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group by label (name) — contacts with same label = same person */}
                  {(() => {
                    const groups = {};
                    contactMethods.forEach(m => {
                      const key = m.label || '__unlabeled__';
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(m);
                    });
                    return Object.entries(groups).map(([name, methods]) => (
                      <div key={name} className="bg-white rounded-xl border border-[#e8eaf2] p-4">
                        {/* Contact name header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#eef2fa] flex items-center justify-center text-[#3d61a4] font-semibold text-sm">
                              {name !== '__unlabeled__' ? name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="text-sm font-semibold text-[#011745]">
                              {name !== '__unlabeled__' ? name : 'Onbekend'}
                            </span>
                            {methods.some(m => m.is_primary) && (
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <Star size={9} className="fill-amber-500" /> Primair
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Contact fields */}
                        <div className="space-y-2">
                          {methods.map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-2 pl-10">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base flex-shrink-0">
                                  {m.type === 'email' ? '✉' : m.type === 'phone' ? '📱' : '💬'}
                                </span>
                                <span className="text-sm text-[#566079] truncate">{m.value}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!m.is_primary && (
                                  <button
                                    onClick={() => handleSetPrimary(m.id)}
                                    className="text-[10px] text-[#a4abbe] hover:text-[#3d61a4] px-1"
                                  >
                                    primair
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteContactMethod(m.id)}
                                  className="text-[#cdd1e0] hover:text-red-500 p-1 rounded transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
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

          {/* ═══ GESPREKKEN (unified conversation log) ═══ */}
          {activeTab === 'gesprekken' && (
            <div className="p-8 space-y-5">
              {/* Action bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setShowLogForm(!showLogForm); setShowUploadForm(false); setShowWAImport(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium hover:bg-[#0a2d6b]"
                >
                  <Plus size={15} /> Log gesprek
                </button>
                <button
                  onClick={() => { setShowUploadForm(!showUploadForm); setShowLogForm(false); setShowWAImport(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm font-medium hover:bg-[#cdd1e0]"
                >
                  <Upload size={15} /> Transcript uploaden
                </button>
                <button
                  onClick={() => { setShowWAImport(!showWAImport); setShowLogForm(false); setShowUploadForm(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm font-medium hover:bg-[#cdd1e0]"
                >
                  <MessageCircle size={15} /> WhatsApp import
                </button>
              </div>

              {/* Manual log form */}
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
                      <input type="text" value={convForm.contact_value}
                        onChange={e => setConvForm(f => ({ ...f, contact_value: e.target.value }))}
                        placeholder="+31 6 12345678"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Resultaat</label>
                      <select value={convForm.outcome} onChange={e => setConvForm(f => ({ ...f, outcome: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5">
                        <option value="">— selecteer —</option>
                        <option value="answered">Opgenomen</option>
                        <option value="no_answer">Niet opgenomen</option>
                        <option value="voicemail">Voicemail</option>
                        <option value="busy">Bezet</option>
                        <option value="callback">Terugbellen</option>
                        <option value="interested">Geïnteresseerd</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Duur (sec)</label>
                      <input type="number" value={convForm.duration_seconds}
                        onChange={e => setConvForm(f => ({ ...f, duration_seconds: e.target.value }))}
                        placeholder="bijv. 180"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Datum/tijd</label>
                      <input type="datetime-local" value={convForm.occurred_at}
                        onChange={e => setConvForm(f => ({ ...f, occurred_at: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                  </div>
                  <textarea value={convForm.summary}
                    onChange={e => setConvForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="Korte samenvatting van het gesprek..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
                  <div className="flex gap-2">
                    <button onClick={handleLogConversation}
                      className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium">
                      Opslaan
                    </button>
                    <button onClick={() => setShowLogForm(false)}
                      className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm">
                      Annuleren
                    </button>
                  </div>
                </div>
              )}

              {/* Transcript upload form */}
              {showUploadForm && (
                <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                  <p className="text-xs font-semibold text-[#566079] uppercase">Transcript uploaden (AI samenvatting)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Type</label>
                      <select value={convForm.type} onChange={e => setConvForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5">
                        <option value="phone">📞 Telefoon</option>
                        <option value="email">✉ Email</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Nummer/Email</label>
                      <input type="text" value={convForm.contact_value}
                        onChange={e => setConvForm(f => ({ ...f, contact_value: e.target.value }))}
                        placeholder="+31 6 12345678"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Resultaat</label>
                      <select value={convForm.outcome} onChange={e => setConvForm(f => ({ ...f, outcome: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5">
                        <option value="">— selecteer —</option>
                        <option value="answered">Opgenomen</option>
                        <option value="interested">Geïnteresseerd</option>
                        <option value="callback">Terugbellen</option>
                        <option value="no_answer">Niet opgenomen</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Datum/tijd</label>
                      <input type="datetime-local" value={convForm.occurred_at}
                        onChange={e => setConvForm(f => ({ ...f, occurred_at: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                  </div>
                  {/* File drop zone */}
                  <div
                    onClick={() => transcriptInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setTranscriptFile(f); }}
                    onDragOver={e => e.preventDefault()}
                    className="border-2 border-dashed border-[#a4abbe] rounded-xl p-6 text-center cursor-pointer hover:border-[#3d61a4] hover:bg-[#eef2fa] transition-all"
                  >
                    <input ref={transcriptInputRef} type="file" className="hidden"
                      accept=".txt,.pdf,.docx"
                      onChange={e => setTranscriptFile(e.target.files[0])} />
                    <Upload size={28} className="mx-auto mb-2 text-[#a4abbe]" />
                    {transcriptFile
                      ? <p className="text-sm font-medium text-[#3d61a4]">{transcriptFile.name}</p>
                      : <p className="text-sm text-[#566079]">Sleep bestand of klik — .txt, .pdf, .docx</p>
                    }
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUploadTranscript}
                      disabled={!transcriptFile || convUploading}
                      className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {convUploading ? <><Loader2 size={14} className="animate-spin" /> Verwerken...</> : 'Uploaden & Samenvatten'}
                    </button>
                    <button onClick={() => { setShowUploadForm(false); setTranscriptFile(null); }}
                      className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm">
                      Annuleren
                    </button>
                  </div>
                </div>
              )}

              {/* WhatsApp import form */}
              {showWAImport && (
                <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                  <p className="text-xs font-semibold text-[#566079] uppercase">WhatsApp chat importeren</p>
                  <p className="text-xs text-[#7b859e]">Export je WhatsApp gesprek: Chat → ··· → Meer → Exporteer chat → Zonder media. Upload het .txt bestand hier.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">WhatsApp nummer</label>
                      <input type="text" value={convForm.contact_value}
                        onChange={e => setConvForm(f => ({ ...f, contact_value: e.target.value }))}
                        placeholder="+31 6 12345678"
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a4abbe] uppercase">Datum gesprek</label>
                      <input type="datetime-local" value={convForm.occurred_at}
                        onChange={e => setConvForm(f => ({ ...f, occurred_at: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm mt-0.5" />
                    </div>
                  </div>
                  <div
                    onClick={() => waInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setWaFile(f); }}
                    onDragOver={e => e.preventDefault()}
                    className="border-2 border-dashed border-[#a4abbe] rounded-xl p-6 text-center cursor-pointer hover:border-[#3d61a4] hover:bg-[#eef2fa] transition-all"
                  >
                    <input ref={waInputRef} type="file" className="hidden"
                      accept=".txt"
                      onChange={e => setWaFile(e.target.files[0])} />
                    <MessageCircle size={28} className="mx-auto mb-2 text-[#a4abbe]" />
                    {waFile
                      ? <p className="text-sm font-medium text-[#3d61a4]">{waFile.name}</p>
                      : <p className="text-sm text-[#566079]">Sleep WhatsApp export (.txt) of klik</p>
                    }
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleImportWhatsApp}
                      disabled={!waFile || convUploading}
                      className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {convUploading ? <><Loader2 size={14} className="animate-spin" /> Importeren...</> : 'Importeren & Samenvatten'}
                    </button>
                    <button onClick={() => { setShowWAImport(false); setWaFile(null); }}
                      className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm">
                      Annuleren
                    </button>
                  </div>
                </div>
              )}

              {/* Conversations list */}
              {convsLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-[#3d61a4]" /></div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-[#a4abbe] py-4">Nog geen gesprekken gelogd.</p>
              ) : (
                <div className="space-y-3">
                  {conversations.map(conv => {
                    const isExpanded = expandedConv === conv.id;
                    const typeIcon = conv.type === 'phone' ? '📞' : conv.type === 'whatsapp' ? '💬' : '✉';
                    const dirLabel = conv.direction === 'inbound' ? '↙ inkomend' : '↗ uitgaand';
                    const durationMin = conv.duration_seconds ? Math.round(conv.duration_seconds / 60) : null;
                    return (
                      <div key={conv.id} className="bg-white rounded-xl border border-[#e8eaf2] overflow-hidden">
                        <div
                          className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[#f7f8fc]"
                          onClick={() => setExpandedConv(isExpanded ? null : conv.id)}
                        >
                          <span className="text-xl mt-0.5">{typeIcon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[#011745] capitalize">{conv.type}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eef2fa] text-[#3d61a4]">{dirLabel}</span>
                              {conv.outcome && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f8fc] text-[#566079] border border-[#e8eaf2]">{conv.outcome}</span>
                              )}
                              {durationMin && (
                                <span className="text-[10px] text-[#7b859e]">{durationMin} min</span>
                              )}
                            </div>
                            <p className="text-xs text-[#7b859e] mt-0.5">
                              {new Date(conv.occurred_at).toLocaleString('nl-NL')}
                              {conv.user_name && ` • ${conv.user_name}`}
                              {conv.contact_value && ` • ${conv.contact_value}`}
                            </p>
                            {conv.ai_summary && !isExpanded && (
                              <p className="text-xs text-[#566079] mt-1.5 line-clamp-2">{conv.ai_summary}</p>
                            )}
                            {conv.summary && !conv.ai_summary && !isExpanded && (
                              <p className="text-xs text-[#566079] mt-1.5 line-clamp-2">{conv.summary}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                              className="p-1.5 rounded text-[#a4abbe] hover:text-red-500 hover:bg-red-50"
                            >
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
                                <p className="text-[10px] font-semibold text-[#566079] uppercase tracking-wider mb-1.5">
                                  Transcript {conv.transcript_filename ? `(${conv.transcript_filename})` : ''}
                                </p>
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

          {/* ═══ E-MAILS (synced via Gmail) ═══ */}
          {activeTab === 'emails' && (
            <div className="p-8 space-y-5">
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
                    {emailsSyncing ? (
                      <><Loader2 size={12} className="animate-spin" /> Synchroniseren...</>
                    ) : (
                      <><RefreshCw size={12} /> Gmail Sync</>
                    )}
                  </button>
                </div>
              </div>

              {/* Auto-sync status banner */}
              <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${
                emailsSyncing
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-[#eef2fa] border-[#3d61a4]/20'
              }`}>
                {emailsSyncing
                  ? <Loader2 size={14} className="text-amber-500 animate-spin flex-shrink-0" />
                  : <Mail size={14} className="text-[#3d61a4] flex-shrink-0" />
                }
                <p className={`text-[11px] ${emailsSyncing ? 'text-amber-700' : 'text-[#566079]'}`}>
                  {emailsSyncing
                    ? 'Gmail wordt automatisch gesynchroniseerd op de achtergrond — e-mails van alle betrokken gebruikers worden opgehaald…'
                    : 'E-mails worden automatisch gesynchroniseerd bij elke opening. De backend synct ook elke 30 minuten. E-mails van alle medewerkers die met deze lead gewerkt hebben zijn zichtbaar.'
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
                <div className="space-y-2">
                  {syncedEmails.map(email => {
                    const isExpanded = expandedEmail === email.id;
                    const isInbound = email.direction === 'inbound';
                    const senderLabel = isInbound ? email.from_email : email.to_email;
                    const senderInitial = (senderLabel || '?').charAt(0).toUpperCase();
                    const dateStr = email.received_at
                      ? new Date(email.received_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div key={email.id} className={`rounded-xl border overflow-hidden transition-all ${isExpanded ? 'border-[#3d61a4] shadow-md' : 'border-[#e8eaf2] hover:border-[#3d61a4]/40 hover:shadow-sm'}`}>
                        {/* Header — always visible, full click area */}
                        <button
                          onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
                          className="w-full text-left bg-white px-5 py-4"
                        >
                          <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isInbound ? 'bg-[#eef2fa] text-[#3d61a4]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                              {senderInitial}
                            </div>
                            {/* Main info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${isInbound ? 'bg-[#eef2fa] text-[#3d61a4]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                                  {isInbound ? '↙ Ontvangen' : '↗ Verzonden'}
                                </span>
                                <span className="text-[11px] text-[#a4abbe] truncate">{senderLabel}</span>
                              </div>
                              <p className="text-sm font-semibold text-[#011745] truncate">
                                {email.subject || '(geen onderwerp)'}
                              </p>
                              {!isExpanded && email.snippet && (
                                <p className="text-xs text-[#7b859e] mt-0.5 truncate">{email.snippet}</p>
                              )}
                            </div>
                            {/* Date + chevron */}
                            <div className="flex-shrink-0 flex items-center gap-2 text-right">
                              <span className="text-[11px] text-[#a4abbe]">{dateStr}</span>
                              {isExpanded
                                ? <ChevronUp size={15} className="text-[#3d61a4]" />
                                : <ChevronDown size={15} className="text-[#a4abbe]" />
                              }
                            </div>
                          </div>
                        </button>

                        {/* Expanded body */}
                        {isExpanded && (
                          <div className="border-t border-[#e8eaf2] bg-[#f7f8fc]">
                            {/* Meta strip */}
                            <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 border-b border-[#e8eaf2]">
                              <span className="text-[11px] text-[#566079]"><span className="text-[#a4abbe] mr-1">Van:</span>{email.from_email}</span>
                              <span className="text-[11px] text-[#566079]"><span className="text-[#a4abbe] mr-1">Aan:</span>{email.to_email}</span>
                              <span className="text-[11px] text-[#566079]"><span className="text-[#a4abbe] mr-1">Datum:</span>{dateStr}</span>
                            </div>
                            {/* Body */}
                            <div className="px-5 py-4">
                              {email.body_html ? (
                                <div
                                  className="text-sm text-[#252f4a] leading-relaxed bg-white rounded-lg p-4 max-h-96 overflow-y-auto border border-[#e8eaf2]"
                                  dangerouslySetInnerHTML={{ __html: sanitize(email.body_html) }}
                                />
                              ) : email.snippet ? (
                                <p className="text-sm text-[#566079] bg-white rounded-lg p-4 border border-[#e8eaf2]">{email.snippet}</p>
                              ) : (
                                <p className="text-sm text-[#a4abbe] italic">Geen berichttekst beschikbaar.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ CALL LOG ═══ */}
          {activeTab === 'calllog' && (
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">
                  Gesprekshistorie
                </h3>
                <span className="text-xs text-[#7b859e]">
                  {lead.callCount || 0} gesprekken totaal
                </span>
              </div>

              {callLogsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#3d61a4]" />
                </div>
              ) : callLogs.length > 0 ? (
                <div className="space-y-3">
                  {callLogs.map(call => (
                    <div key={call.id} className="bg-[#f7f8fc] rounded-lg p-4 border border-[#e8eaf2]">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium text-[#011745]">
                          {call.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        {call.duration > 0 && (
                          <span className="text-xs bg-[#00c875] text-white px-2 py-0.5 rounded">
                            {call.duration} min
                          </span>
                        )}
                      </div>
                      {call.outcome && <p className="text-xs text-[#7b859e]">Resultaat: {call.outcome}</p>}
                      {call.notes && <p className="text-xs text-[#566079] mt-1">{call.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#7b859e] text-sm py-4">Nog geen gesprekken gelogd</p>
              )}

              {/* Last call info from lead */}
              {lead.lastCall && callLogs.length === 0 && (
                <div className="bg-[#f7f8fc] rounded-lg p-4 border border-[#e8eaf2]">
                  <p className="text-sm font-medium text-[#011745]">Laatste gesprek</p>
                  <p className="text-xs text-[#7b859e]">
                    {lead.lastCall.toLocaleDateString('nl-NL')}
                  </p>
                </div>
              )}

              {showCallTimer ? (
                <CallTimer onLogCall={handleCallLog} onCancel={() => setShowCallTimer(false)} />
              ) : (
                <button
                  onClick={() => setShowCallTimer(true)}
                  className="w-full px-4 py-3 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Phone size={18} /> Start Gesprek Timer
                </button>
              )}

              {/* ─── Communicatie Log ─── */}
              <div className="border-t border-[#e8eaf2] pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#566079] uppercase tracking-wider">Communicatie Log</h3>
                <div className="space-y-3">
                  <textarea
                    value={newComm}
                    onChange={e => setNewComm(e.target.value)}
                    placeholder="Log een communicatie (telefoongesprek, email, meeting, etc.)..."
                    className="w-full px-4 py-3 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none focus:ring-2 focus:ring-[#eef2fa] text-[#566079] placeholder-[#a4abbe] resize-none h-24"
                  />
                  <button
                    onClick={handleAddComm}
                    disabled={!newComm.trim() || loading.addComm}
                    className="px-4 py-2 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {loading.addComm ? 'Opslaan...' : 'Communicatie Loggen'}
                  </button>
                </div>
                {commsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-[#3d61a4]" />
                  </div>
                ) : communications.length > 0 ? (
                  <div className="space-y-3">
                    {communications.map(comm => (
                      <div key={comm.id} className="bg-[#f7f8fc] rounded-lg p-4 border border-[#e8eaf2]">
                        <p className="text-sm text-[#011745]">{comm.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-[#a4abbe]">
                            {comm.created_at ? new Date(comm.created_at).toLocaleString('nl-NL') : ''}
                          </p>
                          {comm.user_name && <span className="text-xs text-[#7b859e]">• {comm.user_name}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#7b859e] text-sm">Nog geen communicatie gelogd</p>
                )}
              </div>
            </div>
          )}

          {/* ═══ NOTES ═══ */}
          {activeTab === 'notes' && (
            <div className="p-8 space-y-6">
              {/* Add Note */}
              <div className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Schrijf een notitie..."
                  className="w-full px-4 py-3 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none focus:ring-2 focus:ring-[#eef2fa] text-[#566079] placeholder-[#a4abbe] resize-none h-24"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || loading.addNote}
                  className="px-4 py-2 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {loading.addNote ? 'Opslaan...' : 'Notitie Toevoegen'}
                </button>
              </div>

              {/* Notes list */}
              {notesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#3d61a4]" />
                </div>
              ) : notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.id} className="bg-[#f7f8fc] rounded-lg p-4 border border-[#e8eaf2]">
                      <div className="flex items-start justify-between gap-2">
                        {editingNoteId === note.id ? (
                          <textarea
                            value={editingNoteText}
                            onChange={e => setEditingNoteText(e.target.value)}
                            className="flex-1 text-sm p-2 rounded-lg border border-[#e8eaf2] focus:outline-none focus:border-[#3d61a4] resize-none"
                            rows={3}
                          />
                        ) : (
                          <p className="flex-1 text-sm" style={{ color: '#566079', whiteSpace: 'pre-wrap' }}>{note.text}</p>
                        )}
                        <div className="flex gap-1 flex-shrink-0">
                          {editingNoteId === note.id ? (
                            <>
                              <button onClick={() => handleEditNote(note.id)}
                                className="p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                                style={{ color: '#16a34a' }}>
                                <CheckCircle size={14} />
                              </button>
                              <button onClick={() => setEditingNoteId(null)}
                                className="p-1.5 rounded-lg hover:bg-[#f7f8fc] transition-colors"
                                style={{ color: '#a4abbe' }}>
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }}
                                className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors"
                                style={{ color: '#3d61a4' }}>
                                <Edit3 size={13} />
                              </button>
                              <button onClick={() => handleDeleteNote(note.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-[#cdd1e0] hover:text-red-400">
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-[#a4abbe]">
                          {note.date instanceof Date ? note.date.toLocaleDateString('nl-NL') : note.date}
                        </p>
                        {note.user && <span className="text-xs text-[#7b859e]">• {note.user}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#7b859e] text-sm">Nog geen notities</p>
              )}
            </div>
          )}

          {/* ═══ COMMUNICATIE (merged into Gesprekken) ═══ */}
          {false && (
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <textarea
                  value={newComm}
                  onChange={e => setNewComm(e.target.value)}
                  placeholder="Log een communicatie (telefoongesprek, email, meeting, etc.)..."
                  className="w-full px-4 py-3 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none focus:ring-2 focus:ring-[#eef2fa] text-[#566079] placeholder-[#a4abbe] resize-none h-24"
                />
                <button
                  onClick={handleAddComm}
                  disabled={!newComm.trim() || loading.addComm}
                  className="px-4 py-2 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {loading.addComm ? 'Opslaan...' : 'Communicatie Loggen'}
                </button>
              </div>

              {commsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#3d61a4]" />
                </div>
              ) : communications.length > 0 ? (
                <div className="space-y-3">
                  {communications.map(comm => (
                    <div key={comm.id} className="bg-[#f7f8fc] rounded-lg p-4 border border-[#e8eaf2]">
                      <p className="text-sm text-[#011745]">{comm.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-[#a4abbe]">
                          {comm.created_at ? new Date(comm.created_at).toLocaleString('nl-NL') : ''}
                        </p>
                        {comm.user_name && <span className="text-xs text-[#7b859e]">• {comm.user_name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#7b859e] text-sm">Nog geen communicatie gelogd</p>
              )}
            </div>
          )}

          {/* ═══ DOCUMENTS ═══ */}
          {activeTab === 'documents' && (
            <div className="p-8 space-y-6">
              <div
                onDrop={e => { e.preventDefault(); handleFileUpload(Array.from(e.dataTransfer.files)); }}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-[#a4abbe] rounded-xl p-8 text-center hover:border-[#3d61a4] hover:bg-[#eef2fa] transition-all cursor-pointer"
              >
                <input
                  type="file"
                  multiple
                  onChange={e => handleFileUpload(Array.from(e.target.files))}
                  className="hidden"
                  id="doc-upload"
                />
                <label htmlFor="doc-upload" className="cursor-pointer block">
                  <FileText size={36} className="mx-auto mb-3 text-[#a4abbe]" />
                  <p className="text-[#566079] font-medium text-sm">Sleep bestanden hierheen of klik om te uploaden</p>
                  <p className="text-xs text-[#a4abbe] mt-1">PDF, Word, Excel, afbeeldingen</p>
                </label>
              </div>

              {docsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#3d61a4]" />
                </div>
              ) : documents.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">
                    Bestanden ({documents.length})
                  </h3>
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2]">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-[#3d61a4]" />
                        <div>
                          <p className="text-sm font-medium text-[#011745]">{doc.name}</p>
                          <p className="text-xs text-[#a4abbe]">
                            {doc.size} KB • {doc.date instanceof Date ? doc.date.toLocaleDateString('nl-NL') : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#7b859e] text-sm">Nog geen documenten geüpload</p>
              )}
            </div>
          )}

          {/* ═══ ABOUT / COMPANY INFO ═══ */}
          {activeTab === 'about' && (
            <div className="p-8 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Bedrijfsinformatie</h3>
                <button
                  onClick={handleReEnrich}
                  disabled={enriching}
                  className="flex items-center gap-2 text-[#3d61a4] hover:text-[#0a2d6b] font-medium text-sm disabled:opacity-50"
                >
                  {enriching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Verrijk met AI
                </button>
              </div>

              {enriching && !enrichment ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={28} className="animate-spin text-[#3d61a4]" />
                  <p className="text-sm text-[#566079]">Bedrijfsdata ophalen via website & AI...</p>
                </div>
              ) : !enrichment || (!enrichment.description && !enrichment.fit_score) ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#eef2fa] flex items-center justify-center mx-auto">
                    <Zap size={22} className="text-[#3d61a4]" />
                  </div>
                  <p className="text-sm text-[#566079]">Nog geen bedrijfsanalyse beschikbaar.</p>
                  <p className="text-xs text-[#a4abbe]">Klik op "Verrijk met AI" om een volledig bedrijfsprofiel op te halen.</p>
                </div>
              ) : (
                <>
                  {/* Taper Fit Score */}
                  {enrichment.fit_score != null && (
                    <div className="rounded-xl p-4 flex items-start gap-4" style={{
                      background: enrichment.fit_score >= 7
                        ? 'linear-gradient(135deg, #011745 0%, #0a2d6b 100%)'
                        : enrichment.fit_score >= 4
                        ? 'linear-gradient(135deg, #78350f 0%, #b45309 100%)'
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

                  {/* Description */}
                  {enrichment.description && (
                    <div className="bg-[#f7f8fc] rounded-xl p-4 border border-[#e8eaf2]">
                      <p className="text-xs font-semibold uppercase text-[#7b859e] mb-2">Over het bedrijf</p>
                      <p className="text-sm text-[#566079] leading-relaxed">{enrichment.description}</p>
                    </div>
                  )}

                  {/* Key stats grid */}
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

                  {/* Links */}
                  <div className="space-y-2">
                    {enrichment.website && (
                      <a href={enrichment.website.startsWith('http') ? enrichment.website : `https://${enrichment.website}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2] hover:border-[#3d61a4] transition-colors group">
                        <span className="text-xs text-[#7b859e]">Website</span>
                        <span className="text-sm text-[#3d61a4] font-medium flex items-center gap-1 group-hover:underline">
                          {enrichment.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink size={11} />
                        </span>
                      </a>
                    )}
                    {enrichment.linkedin && (
                      <a href={enrichment.linkedin.startsWith('http') ? enrichment.linkedin : `https://${enrichment.linkedin}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2] hover:border-[#3d61a4] transition-colors group">
                        <span className="text-xs text-[#7b859e]">LinkedIn</span>
                        <span className="text-sm text-[#3d61a4] font-medium flex items-center gap-1 group-hover:underline">
                          LinkedIn profiel <ExternalLink size={11} />
                        </span>
                      </a>
                    )}
                  </div>

                  {/* International trade + countries */}
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

                  {/* FX Relevance */}
                  {enrichment.fx_relevance && (
                    <div className="p-4 rounded-xl bg-[#eef2fa] border border-[#c7d4ef]">
                      <p className="text-[10px] font-semibold uppercase text-[#3d61a4] mb-1">FX / Betalingsbehoefte</p>
                      <p className="text-sm text-[#566079]">{enrichment.fx_relevance}</p>
                    </div>
                  )}

                  {/* Pain Points */}
                  {enrichment.pain_points?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#7b859e] mb-2">Financiële pijnpunten</p>
                      <div className="space-y-1.5">
                        {enrichment.pain_points.map((pp, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-[#566079]">
                            <span className="text-amber-500 mt-0.5 flex-shrink-0">⚡</span>
                            <span>{pp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products / Services */}
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

                  {/* Business Segments */}
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

                  {/* Timestamp */}
                  {enrichment.enriched_at && (
                    <p className="text-[10px] text-[#a4abbe] text-right">
                      Verrijkt op {new Date(enrichment.enriched_at).toLocaleString('nl-NL')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Pipeline timestamps — altijd zichtbaar als kleine metadata */}
        {(lead._raw?.prospect_since || lead._raw?.client_since_date || lead._raw?.first_contacted_at) && (
          <div className="px-8 py-3 border-t border-[#f7f8fc]" style={{ backgroundColor: '#fafafa' }}>
            <div className="flex gap-6 flex-wrap">
              {lead._raw?.first_contacted_at && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a4abbe' }}>Eerste contact</p>
                  <p className="text-xs font-medium" style={{ color: '#566079' }}>{new Date(lead._raw.first_contacted_at).toLocaleDateString('nl-NL')}</p>
                </div>
              )}
              {lead._raw?.prospect_since && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a4abbe' }}>Prospect sinds</p>
                  <p className="text-xs font-medium" style={{ color: '#566079' }}>{new Date(lead._raw.prospect_since).toLocaleDateString('nl-NL')}</p>
                </div>
              )}
              {lead._raw?.client_since_date && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a4abbe' }}>Klant sinds</p>
                  <p className="text-xs font-semibold" style={{ color: '#3d61a4' }}>{new Date(lead._raw.client_since_date).toLocaleDateString('nl-NL')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Shared UI components ──────────────────────────
function EditableInfoRow({ label, value, apiField, icon: Icon, bold, editingField, setEditingField, editValue, setEditValue, onSave }) {
  const isEditing = editingField === apiField;

  if (isEditing) {
    return (
      <div>
        <p className="text-[10px] text-[#a4abbe] uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSave(apiField, editValue);
              if (e.key === 'Escape') setEditingField(null);
            }}
            autoFocus
            className="flex-1 text-sm px-2 py-1 border border-[#3d61a4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3d61a4]"
            style={{ color: '#011745' }}
          />
          <button onClick={() => onSave(apiField, editValue)}
            className="p-1 rounded text-white" style={{ backgroundColor: '#3d61a4' }}>
            <CheckCircle size={14} />
          </button>
          <button onClick={() => setEditingField(null)}
            className="p-1 rounded text-[#7b859e] hover:bg-[#f3f4f8]">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group cursor-pointer" onClick={() => { setEditingField(apiField); setEditValue(value || ''); }}>
      <p className="text-[10px] text-[#a4abbe] uppercase tracking-wider mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-[#3d61a4]" />}
        <span className={`text-sm ${bold ? 'font-semibold' : ''}`} style={{ color: '#011745' }}>
          {value || <span className="text-[#cdd1e0] italic">Klik om in te vullen</span>}
        </span>
        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[#3d61a4] ml-auto transition-opacity">bewerken</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, link, icon: Icon, bold }) {
  if (!value) return null;
  const content = (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-[#3d61a4]" />}
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
  return (
    <div>
      <p className="text-[10px] text-[#a4abbe] uppercase tracking-wider mb-0.5">{label}</p>
      {link ? (
        <a href={link} target={link.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
           className="text-[#3d61a4] hover:underline text-sm">{content}</a>
      ) : (
        <p className="text-[#011745] text-sm">{content}</p>
      )}
    </div>
  );
}

function DetailRow({ label, value, link }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-[#e8eaf2]">
      <span className="text-[#7b859e]">{label}</span>
      {link ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
           className="text-[#3d61a4] hover:underline font-medium flex items-center gap-1">
          {value.replace(/^https?:\/\//, '').substring(0, 35)}
          <ExternalLink size={12} />
        </a>
      ) : (
        <span className="text-[#011745] font-medium">{value}</span>
      )}
    </div>
  );
}
