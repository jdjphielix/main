import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Loader2, Building2, User, Phone, Mail, Globe,
  AlertCircle, X, Download, TrendingUp, CreditCard, FileText,
  ExternalLink, BarChart3, DollarSign, ArrowUpRight, ArrowDownRight,
  Activity, MessageSquare, Calendar, Star, Shield, Link2, ClipboardCheck,
  CheckCircle2, Clock, ChevronDown, ChevronUp, Plus, Trash2, Edit3,
  Save, AlertTriangle, Upload, PhoneCall, StickyNote, MailOpen, Zap, Truck
} from 'lucide-react';

import EmailThreadsPanel from '../components/leads/EmailThreadsPanel';
import ContactFamilyPopup from '../components/leads/ContactFamilyPopup';
import { useAuth } from '../contexts/AuthContext';

const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatCurrency(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(val);
}

const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'TRY', 'ZAR', 'BRL', 'MXN', 'CNY', 'HKD', 'SGD', 'INR', 'THB'];

const STATUS_COLORS = {
  open: { bg: '#fef3c7', text: '#92400e', label: 'Open' },
  in_progress: { bg: '#eef2fa', text: '#3d61a4', label: 'In Behandeling' },
  resolved: { bg: '#f0fdf4', text: '#16a34a', label: 'Opgelost' },
  closed: { bg: '#f3f4f8', text: '#566079', label: 'Gesloten' },
};

const PRIORITY_COLORS = {
  low: { bg: '#f3f4f8', text: '#7b859e', label: 'Laag' },
  normal: { bg: '#eef2fa', text: '#3d61a4', label: 'Normaal' },
  high: { bg: '#fef3c7', text: '#92400e', label: 'Hoog' },
  urgent: { bg: '#fef2f2', text: '#dc2626', label: 'Urgent' },
};

const BROKERS = [
  { key: 'ibanfirst', label: 'IbanFirst', color: '#3d61a4' },
  { key: 'corpay',    label: 'Corpay',    color: '#0a2d6b' },
  { key: 'ebury',     label: 'Ebury',     color: '#011745' },
  { key: 'trade_finance', label: 'Trade Finance', color: '#166534' },
];

function BrokerPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BROKERS.map(b => (
        <button key={b.key} type="button"
          onClick={() => onChange(value === b.key ? null : b.key)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all"
          style={value === b.key
            ? { backgroundColor: b.color, borderColor: b.color, color: '#fff' }
            : { backgroundColor: '#f7f8fc', borderColor: '#e8eaf2', color: '#566079' }
          }>
          {b.label}
        </button>
      ))}
      {value && (
        <button type="button" onClick={() => onChange(null)}
          className="px-2 py-1.5 rounded-lg text-xs border-2 border-dashed border-[#e8eaf2] text-[#a4abbe] hover:border-red-300 hover:text-red-400 transition-all">
          ✕ Wis
        </button>
      )}
    </div>
  );
}

function DropZone({ onFiles, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = Array.from(e.dataTransfer.files); if (f.length) onFiles(f); }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
        dragging ? 'border-[#3d61a4] bg-[#eef2fa]' : 'border-[#cdd1e0] hover:border-[#3d61a4] hover:bg-[#f7f8fc]'
      }`}>
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); }} />
      {uploading ? (
        <div className="flex flex-col items-center gap-1.5">
          <Loader2 size={18} className="animate-spin" style={{ color: '#3d61a4' }} />
          <p className="text-xs" style={{ color: '#7b859e' }}>Uploaden...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <Upload size={18} style={{ color: dragging ? '#3d61a4' : '#a4abbe' }} />
          <p className="text-xs font-medium" style={{ color: dragging ? '#3d61a4' : '#7b859e' }}>
            Sleep of klik om documenten toe te voegen
          </p>
        </div>
      )}
    </div>
  );
}


export default function ClientsPage({ myClientsOnly = false }) {
  const { user: currentUser } = useAuth();
  const isDealer = ['admin_pay', 'admin_trade', 'dealer', 'accountmanager'].includes(currentUser?.role) || currentUser?.is_teamleader;
  const isAccountManagerRole = currentUser?.role === 'accountmanager' && !currentUser?.is_teamleader;
  const [amListTab, setAmListTab] = useState('alle'); // 'alle' | 'mijn' for accountmanager
  const [allUsers, setAllUsers] = useState([]);
  const [changingSalesOwner, setChangingSalesOwner] = useState(false);
  const [accountManagers, setAccountManagers] = useState([]);
  const [filterAccountManager, setFilterAccountManager] = useState('');
  const [assigningAM, setAssigningAM] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [prospectDetails, setProspectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [communications, setCommunications] = useState([]);
  const [commText, setCommText] = useState('');
  const [addingComm, setAddingComm] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [detailTab, setDetailTab] = useState('overview');
  const [clientEnrichment, setClientEnrichment] = useState(null);
  const [clientEnriching, setClientEnriching] = useState(false);
  const [documents, setDocuments] = useState([]);

  // Forecasting state
  const [forecasting, setForecasting] = useState(null);
  const [showAddForecast, setShowAddForecast] = useState(false);
  const [forecastForm, setForecastForm] = useState({
    buy_currency: 'EUR', sell_currency: 'USD',
    volume_per_year: '', spot_margin_pct: '', hedging_pct: '', hedging_margin_pct: '', notes: ''
  });
  const [savingForecast, setSavingForecast] = useState(false);
  const [editingForecastId, setEditingForecastId] = useState(null);

  // Individual deals state
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [dealForm, setDealForm] = useState({
    buy_currency: 'EUR', sell_currency: 'USD', deal_date: new Date().toISOString().split('T')[0],
    volume: '', deal_type: 'spot', margin_pct: '', forecasting_item_id: '', notes: ''
  });
  const [savingDeal, setSavingDeal] = useState(false);

  // Compliance state
  const [complianceCases, setComplianceCases] = useState(null);
  const [showAddCompliance, setShowAddCompliance] = useState(false);
  const [complianceForm, setComplianceForm] = useState({ title: '', description: '', priority: 'normal', broker: null });
  const [compliancePendingFiles, setCompliancePendingFiles] = useState([]);
  const [complianceUploading, setComplianceUploading] = useState(false);
  const [savingCompliance, setSavingCompliance] = useState(false);

  // Account plan state
  const [accountPlan, setAccountPlan] = useState('');
  const [savingAccountPlan, setSavingAccountPlan] = useState(false);

  // Correspondentie state
  const [correspondence, setCorrespondence] = useState(null);
  const [corrFilter, setCorrFilter] = useState('all');
  const [gmailSyncing, setGmailSyncing] = useState(false);

  const syncGmailForClient = async () => {
    if (!selectedClient) return;
    setGmailSyncing(true);
    try {
      const resp = await fetch(`/api/v1/leads/${selectedClient.id}/sync-gmail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.detail || 'Sync mislukt');
      // Refresh correspondentie
      const corrResp = await fetch(`/api/v1/leads/${selectedClient.id}/correspondentie`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (corrResp.ok) setCorrespondence(await corrResp.json());
    } catch (err) {
      console.error('Gmail sync error:', err.message);
    }
    setGmailSyncing(false);
  };

  // Gesprekken state
  const [detailConversations, setDetailConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [expandedConv, setExpandedConv] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [convForm, setConvForm] = useState({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });

  // Contacten state
  const [detailContactMethods, setDetailContactMethods] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });
  const [familyPopup, setFamilyPopup] = useState(null); // { leadId, contactName }

  // TaperPay / TaperTrade edit state
  const [editingPricing, setEditingPricing] = useState(null); // 'taperpay' | 'tapertrade' | null
  const [pricingEdits, setPricingEdits] = useState({});
  const [savingPricing, setSavingPricing] = useState(false);

  async function savePricingEdits() {
    if (!selectedClient) return;
    setSavingPricing(true);
    try {
      // Convert string inputs to numbers where needed
      const payload = {};
      Object.entries(pricingEdits).forEach(([k, v]) => {
        payload[k] = v === '' ? null : isNaN(Number(v)) ? v : Number(v);
      });
      const res = await api(`/api/v1/prospects/${selectedClient.id}/prospect-data`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      // Refresh prospect details
      const updated = await fetch(`/api/v1/prospects/${selectedClient.id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (updated.ok) setProspectDetails(await updated.json());
      setEditingPricing(null);
    } catch (err) { alert('Opslaan mislukt: ' + err.message); }
    finally { setSavingPricing(false); }
  }

  // Toggle TaperPay / TaperTrade product activation
  async function toggleProduct(field, value) {
    if (!selectedClient) return;
    try {
      const res = await api(`/api/v1/prospects/${selectedClient.id}/prospect-data`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value }),
      });
      const updated = await fetch(`/api/v1/prospects/${selectedClient.id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (updated.ok) setProspectDetails(await updated.json());
    } catch (err) { alert('Opslaan mislukt: ' + err.message); }
  }

  // Save account plan
  async function saveAccountPlan() {
    if (!selectedClient) return;
    setSavingAccountPlan(true);
    try {
      await api(`/api/v1/prospects/${selectedClient.id}/prospect-data`, {
        method: 'PUT',
        body: JSON.stringify({ account_plan: accountPlan }),
      });
      const updated = await fetch(`/api/v1/prospects/${selectedClient.id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (updated.ok) setProspectDetails(await updated.json());
    } catch (err) { alert('Opslaan mislukt: ' + err.message); }
    finally { setSavingAccountPlan(false); }
  }

  // Bedrijfsinfo edit state
  const [editingClientInfo, setEditingClientInfo] = useState(false);
  const [clientInfoEdits, setClientInfoEdits] = useState({});

  // pd must be declared BEFORE the useEffect that depends on it (avoids TDZ in production build)
  const pd = prospectDetails?.prospect_data;

  // Sync accountPlan from prospect data
  useEffect(() => {
    if (pd) setAccountPlan(pd.account_plan || '');
  }, [pd]);

  // Load account managers
  useEffect(() => {
    fetch('/api/v1/users/team', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(users => setAccountManagers((users || []).filter(u => u.role === 'accountmanager')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isDealer) return;
    fetch('/api/v1/users/team', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isDealer]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page_size: '200', pipeline_stage: 'client' });
      if (searchQuery) params.set('search', searchQuery);
      if (myClientsOnly) params.set('my_clients', 'true');
      if (isAccountManagerRole) params.set("account_manager_id", String(currentUser.id));
      if (filterAccountManager) params.set('account_manager_id', filterAccountManager);
      const res = await fetch(`/api/v1/leads/?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClients(data.leads || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, myClientsOnly, filterAccountManager, amListTab, isAccountManagerRole]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Fetch all details when a client is selected
  useEffect(() => {
    if (!selectedClient) {
      setProspectDetails(null); setNotes([]); setCommunications([]); setDocuments([]);
      setForecasting(null); setComplianceCases(null); setCorrespondence(null);
      setDetailConversations([]); setExpandedConv(null);
      setDetailTab('overview');
      return;
    }
    (async () => {
      setLoadingDetails(true);
      try {
        const [pdRes, notesRes, commRes, docsRes, fcRes, compRes, corrRes] = await Promise.allSettled([
          fetch(`/api/v1/prospects/${selectedClient.id}`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/leads/${selectedClient.id}/notes`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/leads/${selectedClient.id}/communications`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/documents/lead/${selectedClient.id}`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/leads/${selectedClient.id}/forecasting`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/leads/${selectedClient.id}/compliance`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/leads/${selectedClient.id}/correspondentie`, { headers: { Authorization: `Bearer ${token()}` } }),
        ]);
        if (pdRes.status === 'fulfilled' && pdRes.value.ok) setProspectDetails(await pdRes.value.json());
        else setProspectDetails(null);
        if (notesRes.status === 'fulfilled' && notesRes.value.ok) {
          const n = await notesRes.value.json();
          setNotes(Array.isArray(n) ? n : []);
        } else setNotes([]);
        if (commRes.status === 'fulfilled' && commRes.value.ok) setCommunications(await commRes.value.json());
        else setCommunications([]);
        if (docsRes.status === 'fulfilled' && docsRes.value.ok) {
          const dd = await docsRes.value.json();
          setDocuments(dd.documents || []);
        } else setDocuments([]);
        if (fcRes.status === 'fulfilled' && fcRes.value.ok) setForecasting(await fcRes.value.json());
        else setForecasting(null);
        if (compRes.status === 'fulfilled' && compRes.value.ok) setComplianceCases(await compRes.value.json());
        else setComplianceCases(null);
        if (corrRes.status === 'fulfilled' && corrRes.value.ok) setCorrespondence(await corrRes.value.json());
        else setCorrespondence(null);
      } catch {
        setProspectDetails(null); setNotes([]); setCommunications([]); setDocuments([]);
        setForecasting(null); setComplianceCases(null); setCorrespondence(null);
      }
      finally { setLoadingDetails(false); }
    })();
  }, [selectedClient?.id]);

  // Reset enrichment when client changes
  useEffect(() => {
    setClientEnrichment(null);
  }, [selectedClient?.id]);

  const fetchClientEnrichment = async () => {
    if (!selectedClient || clientEnrichment) return;
    setClientEnriching(true);
    try {
      const res = await fetch(`/api/v1/leads/${selectedClient.id}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      let parsed = {};
      const raw = data.company_description || '';
      if (raw) {
        let cleaned = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/g, '').trim();
        try { parsed = JSON.parse(cleaned); } catch { parsed = { description: raw }; }
      }
      setClientEnrichment({
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
    } catch { setClientEnrichment({}); }
    setClientEnriching(false);
  };

  const handleClientReEnrich = async () => {
    if (!selectedClient) return;
    setClientEnriching(true);
    try {
      await fetch(`/api/v1/ai/enrich-lead/${selectedClient.id}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      setClientEnrichment(null);
      await fetchClientEnrichment();
    } catch (e) { console.error('Enrichment failed:', e); }
    setClientEnriching(false);
  };

  // Fetch contacten / gesprekken when tab or client changes
  const fetchClientContactMethods = useCallback(async (clientId) => {
    if (!clientId) return;
    try {
      const r = await fetch(`/api/v1/leads/${clientId}/contact-methods`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = r.ok ? await r.json() : [];
      setDetailContactMethods(Array.isArray(d) ? d : []);
    } catch { setDetailContactMethods([]); }
  }, []);

  const fetchClientConversations = useCallback(async (clientId) => {
    if (!clientId) return;
    setConvsLoading(true);
    try {
      const r = await fetch(`/api/v1/leads/${clientId}/conversations`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = r.ok ? await r.json() : [];
      setDetailConversations(Array.isArray(d) ? d : []);
    } catch { setDetailConversations([]); }
    setConvsLoading(false);
  }, []);

  useEffect(() => {
    if (detailTab === 'bedrijfsinfo' && selectedClient) fetchClientEnrichment();
    if (detailTab === 'gesprekken' && selectedClient) fetchClientConversations(selectedClient.id);
    if (detailTab === 'contacten' && selectedClient) fetchClientContactMethods(selectedClient.id);
  }, [detailTab, selectedClient?.id]);

  // Contact CRUD
  const handleAddClientContact = async () => {
    const { name, email, mobile, whatsapp, isPrimary } = newContact;
    if (!email.trim() && !mobile.trim() && !whatsapp.trim()) return;
    try {
      const entries = [];
      if (email.trim())    entries.push({ type: 'email',    value: email.trim(),    label: name.trim() || null, is_primary: isPrimary });
      if (mobile.trim())   entries.push({ type: 'phone',    value: mobile.trim(),   label: name.trim() || null, is_primary: isPrimary });
      if (whatsapp.trim()) entries.push({ type: 'whatsapp', value: whatsapp.trim(), label: name.trim() || null, is_primary: false });
      for (const entry of entries) {
        await api(`/api/v1/leads/${selectedClient.id}/contact-methods`, { method: 'POST', body: JSON.stringify(entry) });
      }
      setNewContact({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });
      setShowAddContact(false);
      fetchClientContactMethods(selectedClient.id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteClientContact = async (methodId) => {
    if (!window.confirm('Contact verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${selectedClient.id}/contact-methods/${methodId}`, { method: 'DELETE' });
      fetchClientContactMethods(selectedClient.id);
    } catch (err) { console.error(err); }
  };

  const handleSetPrimaryClientContact = async (methodId) => {
    try {
      await api(`/api/v1/leads/${selectedClient.id}/contact-methods/${methodId}`, { method: 'PUT', body: JSON.stringify({ is_primary: true }) });
      fetchClientContactMethods(selectedClient.id);
    } catch (err) { console.error(err); }
  };

  // Conversation CRUD
  const handleLogClientConversation = async () => {
    try {
      await api(`/api/v1/leads/${selectedClient.id}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ ...convForm, duration_seconds: convForm.duration_seconds ? parseInt(convForm.duration_seconds) : null, occurred_at: convForm.occurred_at || new Date().toISOString() }),
      });
      setShowLogForm(false);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchClientConversations(selectedClient.id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteClientConversation = async (convId) => {
    if (!window.confirm('Gespreklog verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${selectedClient.id}/conversations/${convId}`, { method: 'DELETE' });
      fetchClientConversations(selectedClient.id);
    } catch (err) { console.error(err); }
  };

  async function addNote() {
    if (!noteText.trim() || !selectedClient) return;
    setAddingNote(true);
    try {
      await api(`/api/v1/leads/${selectedClient.id}/notes`, { method: 'POST', body: JSON.stringify({ content: noteText }) });
      setNoteText('');
      const res = await fetch(`/api/v1/leads/${selectedClient.id}/notes`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setNotes(await res.json());
    } catch (err) { console.error('Note save failed:', err); }
    finally { setAddingNote(false); }
  }

  async function addCommunication() {
    if (!commText.trim() || !selectedClient) return;
    setAddingComm(true);
    try {
      await api(`/api/v1/leads/${selectedClient.id}/communications`, { method: 'POST', body: JSON.stringify({ content: commText }) });
      setCommText('');
      const res = await fetch(`/api/v1/leads/${selectedClient.id}/communications`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setCommunications(await res.json());
    } catch (err) { console.error('Communication save failed:', err); }
    finally { setAddingComm(false); }
  }

  // Forecasting CRUD
  const refreshForecasting = async () => {
    if (!selectedClient) return;
    const res = await fetch(`/api/v1/leads/${selectedClient.id}/forecasting`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setForecasting(await res.json());
  };

  async function saveForecastItem() {
    if (!forecastForm.buy_currency || !forecastForm.sell_currency) return;
    setSavingForecast(true);
    try {
      const vol = parseFloat(forecastForm.volume_per_year) || 0;
      const spotM = parseFloat(forecastForm.spot_margin_pct) || 0;
      const hedgePct = parseFloat(forecastForm.hedging_pct) || 0;
      const hedgeM = parseFloat(forecastForm.hedging_margin_pct) || 0;
      const body = {
        buy_currency: forecastForm.buy_currency,
        sell_currency: forecastForm.sell_currency,
        volume_per_year: vol,
        spot_margin_pct: spotM,
        hedging_pct: hedgePct / 100,  // form shows 0–100, DB stores 0–1 decimal
        hedging_margin_pct: hedgeM,
        notes: forecastForm.notes,
      };
      if (editingForecastId) {
        await api(`/api/v1/leads/${selectedClient.id}/forecasting/${editingForecastId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api(`/api/v1/leads/${selectedClient.id}/forecasting`, { method: 'POST', body: JSON.stringify(body) });
      }
      await refreshForecasting();
      setShowAddForecast(false);
      setEditingForecastId(null);
      setForecastForm({ buy_currency: 'EUR', sell_currency: 'USD', volume_per_year: '', spot_margin_pct: '', hedging_pct: '', hedging_margin_pct: '', notes: '' });
    } catch (err) { console.error('Forecast save failed:', err); }
    finally { setSavingForecast(false); }
  }

  async function deleteForecastItem(itemId) {
    if (!window.confirm('Weet je zeker dat je dit currency pair wilt verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${selectedClient.id}/forecasting/${itemId}`, { method: 'DELETE' });
      await refreshForecasting();
    } catch (err) { console.error('Delete failed:', err); }
  }

  async function saveDeal() {
    if (!dealForm.buy_currency || !dealForm.sell_currency || !dealForm.volume || !dealForm.deal_date) return;
    setSavingDeal(true);
    try {
      const body = {
        buy_currency: dealForm.buy_currency,
        sell_currency: dealForm.sell_currency,
        deal_date: dealForm.deal_date,
        volume: parseFloat(dealForm.volume) || 0,
        deal_type: dealForm.deal_type,
        margin_pct: parseFloat(dealForm.margin_pct) || 0,
        forecasting_item_id: dealForm.forecasting_item_id ? parseInt(dealForm.forecasting_item_id) : null,
        notes: dealForm.notes,
      };
      await api(`/api/v1/leads/${selectedClient.id}/deals`, { method: 'POST', body: JSON.stringify(body) });
      await refreshForecasting();
      setShowAddDeal(false);
      setDealForm({ buy_currency: 'EUR', sell_currency: 'USD', deal_date: new Date().toISOString().split('T')[0], volume: '', deal_type: 'spot', margin_pct: '', forecasting_item_id: '', notes: '' });
    } catch (err) { console.error('Deal save failed:', err); }
    finally { setSavingDeal(false); }
  }

  async function deleteDeal(dealId) {
    if (!window.confirm('Deal verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${selectedClient.id}/deals/${dealId}`, { method: 'DELETE' });
      await refreshForecasting();
    } catch (err) { console.error('Delete deal failed:', err); }
  }

  function startEditForecast(item) {
    setEditingForecastId(item.id);
    setForecastForm({
      buy_currency: item.buy_currency,
      sell_currency: item.sell_currency,
      volume_per_year: item.volume_per_year || '',
      spot_margin_pct: item.spot_margin_pct || '',
      hedging_pct: (item.hedging_pct * 100) || '',  // store as %, show as %
      hedging_margin_pct: item.hedging_margin_pct || '',
      notes: item.notes || '',
    });
    setShowAddForecast(true);
  }

  // Compliance CRUD
  async function saveComplianceCase() {
    if (!complianceForm.title.trim()) return;
    setSavingCompliance(true);
    try {
      const newCase = await api(`/api/v1/leads/${selectedClient.id}/compliance`, {
        method: 'POST',
        body: JSON.stringify({ ...complianceForm }),
      });
      // Upload pending files
      if (compliancePendingFiles.length > 0) {
        setComplianceUploading(true);
        for (const file of compliancePendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          const uploadRes = await fetch(`/api/v1/documents/upload?lead_id=${selectedClient.id}&category=compliance`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` },
            body: fd,
          });
          if (uploadRes.ok) {
            const uploaded = await uploadRes.json();
            await api(`/api/v1/leads/${selectedClient.id}/compliance/${newCase.id}/documents`, {
              method: 'POST',
              body: JSON.stringify({ document_id: uploaded.id }),
            });
          }
        }
        setComplianceUploading(false);
      }
      // Also create a linked ticket in the ticket system so it shows up in /tickets
      await api(`/api/v1/tickets/`, {
        method: 'POST',
        body: JSON.stringify({
          title: complianceForm.title,
          description: complianceForm.description || '',
          priority: complianceForm.priority || 'normal',
          category: 'compliance',
          related_lead_id: selectedClient.id,
        }),
      });
      const res = await fetch(`/api/v1/leads/${selectedClient.id}/compliance`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setComplianceCases(await res.json());
      setShowAddCompliance(false);
      setComplianceForm({ title: '', description: '', priority: 'normal', broker: null });
      setCompliancePendingFiles([]);
    } catch (err) { console.error('Compliance save failed:', err); }
    finally { setSavingCompliance(false); setComplianceUploading(false); }
  }

  async function updateComplianceStatus(caseId, newStatus) {
    try {
      await api(`/api/v1/leads/${selectedClient.id}/compliance/${caseId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      const res = await fetch(`/api/v1/leads/${selectedClient.id}/compliance`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setComplianceCases(await res.json());
    } catch (err) { console.error('Status update failed:', err); }
  }

  // Upload document for compliance case
  async function uploadComplianceDoc(caseId, file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const uploadRes = await fetch(`/api/v1/documents/upload?lead_id=${selectedClient.id}&category=compliance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });
      if (uploadRes.ok) {
        const doc = await uploadRes.json();
        await api(`/api/v1/leads/${selectedClient.id}/compliance/${caseId}/documents`, {
          method: 'POST',
          body: JSON.stringify({ document_id: doc.id }),
        });
        // Refresh compliance
        const res = await fetch(`/api/v1/leads/${selectedClient.id}/compliance`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) setComplianceCases(await res.json());
      }
    } catch (err) { console.error('Upload failed:', err); }
  }

  async function handleAssignAccountManager(managerId) {
    if (!selectedClient) return;
    setAssigningAM(true);
    try {
      await api(`/api/v1/leads/${selectedClient.id}/assign-account-manager`, {
        method: 'POST',
        body: JSON.stringify({ account_manager_id: managerId || null }),
      });
      setClients(prev => prev.map(c => c.id === selectedClient.id
        ? { ...c, accountManagerId: managerId || null,
            accountManagerName: accountManagers.find(u => u.id == managerId)?.full_name || null }
        : c));
      setSelectedClient(prev => prev ? { ...prev, accountManagerId: managerId || null,
        accountManagerName: accountManagers.find(u => u.id == managerId)?.full_name || null } : null);
    } catch (err) { alert('Opslaan mislukt: ' + err.message); }
    finally { setAssigningAM(false); }
  }

  async function handleChangeSalesOwner(newUserId) {
    if (!selectedClient) return;
    setChangingSalesOwner(true);
    try {
      await api(`/api/v1/leads/${selectedClient.id}/assign-sales-user`, {
        method: 'PUT',
        body: JSON.stringify({ sales_owner_id: newUserId ? parseInt(newUserId) : null }),
      });
      fetchClients();
      // Update selectedClient optimistically
      const newOwner = allUsers.find(u => u.id === parseInt(newUserId));
      setSelectedClient(prev => ({
        ...prev,
        sales_owner_id: newUserId ? parseInt(newUserId) : null,
        sales_owner_name: newOwner?.full_name || null,
      }));
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setChangingSalesOwner(false); }
  }

  const handleExport = () => {
    const csv = [
      ['Bedrijf', 'Contact', 'Functie', 'Email', 'Telefoon', 'Land', 'Industrie', 'Website', 'KVK'].join(','),
      ...clients.map(c =>
        [c.company_name, c.contact_name, c.contact_position, c.contact_email, c.contact_phone,
          c.company_country, c.company_industry, c.company_website, c.kvk_number]
          .map(v => `"${(v || '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taper_clients_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const handleExportClient = () => {
    if (!selectedClient) return;
    const c = selectedClient;
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: 'Taper Backoffice',

      bedrijf: {
        naam: c.company_name,
        website: c.company_website,
        land: c.company_country,
        industrie: c.company_industry,
        omvang: c.company_size,
        kvk: c.kvk_number,
        linkedin: c.linkedin_url,
        beschrijving: (() => {
          try { return JSON.parse(c.company_description)?.description || c.company_description; }
          catch { return c.company_description; }
        })(),
      },

      contact: {
        naam: c.contact_name,
        functie: c.contact_position,
        email: c.contact_email,
        telefoon: c.contact_phone,
        mobiel: c.contact_mobile,
      },

      pipeline: {
        stage: c.pipeline_stage,
        status: c.status,
        prioriteit: c.priority,
        salesOwner: c.sales_owner_name,
        accountManagerId: c.account_manager_id || null,
        accountManagerName: c.account_manager_name || null,
        aangemaakt: c.created_at,
      },

      producten: pd ? {
        taperPayActief: pd.taperpay_active,
        taperTradeActief: pd.tapertrade_active,
        broker: pd.selected_broker,
      } : null,

      valutaEnLanden: pd?.currencies?.length > 0 ? {
        kooptValuta: pd.currencies.filter(x => x.currency_type === 'buying_currency').map(x => ({ valuta: x.value, volume: x.volume, notities: x.notes })),
        verkooptValuta: pd.currencies.filter(x => x.currency_type === 'selling_currency').map(x => ({ valuta: x.value, volume: x.volume, notities: x.notes })),
        inkomendVanuit: pd.currencies.filter(x => x.currency_type === 'incoming_country').map(x => ({ land: x.value, volume: x.volume })),
        uitgaandNaar: pd.currencies.filter(x => x.currency_type === 'outgoing_country').map(x => ({ land: x.value, volume: x.volume })),
      } : null,

      pricing: pd ? {
        fxSpotSpread: pd.fx_spot_spread_pct != null ? `${(pd.fx_spot_spread_pct * 100).toFixed(3)}%` : null,
        fxForwardMarge: pd.fx_forward_margin_pct != null ? `${(pd.fx_forward_margin_pct * 100).toFixed(3)}%` : null,
        creditLimiet: pd.credit_limit_eur,
        minDealGrootte: pd.min_deal_size_eur,
        tfRente: pd.tf_interest_rate_pct != null ? `${pd.tf_interest_rate_pct}%` : null,
        tfFee: pd.tf_fee_pct != null ? `${pd.tf_fee_pct}%` : null,
        tfAfsluitprovisie: pd.tf_closing_fee_pct != null ? `${pd.tf_closing_fee_pct}%` : null,
        betaaltermijn: pd.payment_terms_days ? `${pd.payment_terms_days} dagen` : null,
        pricingNotities: pd.pricing_notes,
      } : null,

      kyc: pd ? {
        status: pd.kyc_status,
        risicoprofiel: pd.risk_profile,
        uboNaam: pd.ubo_name,
        uboNationaliteit: pd.ubo_nationality,
        juridischeEntiteit: pd.legal_entity_type,
        amlAkkoord: pd.aml_cleared,
        notities: pd.kyc_notes,
      } : null,

      revenueVoorspelling: pd ? {
        fxVolumeJaar: pd.fx_estimated_volume,
        fxMarge: pd.fx_estimated_margin_pct != null ? `${pd.fx_estimated_margin_pct}%` : null,
        fxOmzet: pd.fx_estimated_revenue,
        tfVolume: pd.tf_estimated_volume,
        tfMarge: pd.tf_estimated_margin_pct != null ? `${pd.tf_estimated_margin_pct}%` : null,
        tfOmzet: pd.tf_estimated_revenue,
      } : null,

      forecastingCurrencyPairs: forecasting?.items?.map(item => ({
        paar: `${item.buy_currency}/${item.sell_currency}`,
        volumePerJaar: item.volume_per_year,
        spotMarge: item.spot_margin_pct != null ? `${(item.spot_margin_pct * 100).toFixed(3)}%` : null,
        hedgingPct: item.hedging_pct != null ? `${(item.hedging_pct * 100).toFixed(0)}%` : null,
        hedgingMarge: item.hedging_margin_pct != null ? `${(item.hedging_margin_pct * 100).toFixed(3)}%` : null,
        verwachteOmzet: item.total_revenue,
        geboektVolume: item.booked_volume,
        resterendVolume: item.remaining_volume,
        notities: item.notes,
      })) || [],

      geboekteDeals: (forecasting?.items || []).flatMap(i => (i._deals || []).map(d => ({
        paar: `${d.buy_currency}/${d.sell_currency}`,
        datum: d.deal_date,
        type: d.deal_type,
        volume: d.volume,
        marge: d.margin_pct != null ? `${(d.margin_pct * 100).toFixed(3)}%` : null,
        omzet: d.revenue,
        notities: d.notes,
      }))),

      strategie: pd?.strategy_notes || null,

      financiering: pd ? {
        debiteurenFinanciering: pd.tf_debtor_finance,
        portefeuilleFinanciering: pd.tf_portfolio_finance,
        voorraadFinanciering: pd.tf_voorraad_finance,
        totaalFinancieringsBehoefte: pd.tf_total_financing_need,
        aanvullendeInfo: pd.tf_additional_info,
      } : null,
    };

    // Remove null top-level keys for cleaner output
    Object.keys(exportData).forEach(k => { if (exportData[k] === null) delete exportData[k]; });

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taper_client_${c.company_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter correspondence
  const filteredTimeline = correspondence?.timeline?.filter(item => {
    if (corrFilter === 'all') return true;
    return item.type === corrFilter;
  }) || [];

  return (
    <div className="h-screen flex flex-col bg-[#f7f8fc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8eaf2] px-8 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#011745' }}>{myClientsOnly ? 'Mijn Clients' : 'Clients'}</h1>
            <p className="text-sm mt-1" style={{ color: '#7b859e' }}>
              {loading ? 'Laden...' : `${clients.length} actieve klanten`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1">
              <button onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}>
                <BarChart3 size={16} style={{ color: viewMode === 'grid' ? '#3d61a4' : '#a4abbe' }} />
              </button>
              <button onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}>
                <Activity size={16} style={{ color: viewMode === 'list' ? '#3d61a4' : '#a4abbe' }} />
              </button>
            </div>
            <button onClick={handleExport}
              className="p-2.5 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#7b859e' }} title="Export CSV">
              <Download size={20} />
            </button>
            <button onClick={fetchClients} disabled={loading}
              className="p-2.5 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
            </button>
          </div>
        </div>
        {isAccountManagerRole && (
          <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1 w-fit mb-1">
            <button onClick={() => setAmListTab('alle')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${amListTab === 'alle' ? 'bg-white text-[#3d61a4] shadow-sm' : 'text-[#7b859e] hover:text-[#3d61a4]'}`}>
              Alle clients
            </button>
            <button onClick={() => setAmListTab('mijn')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${amListTab === 'mijn' ? 'bg-white text-[#3d61a4] shadow-sm' : 'text-[#7b859e] hover:text-[#3d61a4]'}`}>
              Mijn clients
            </button>
          </div>
        )}
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
          <input type="text" placeholder="Zoek klanten op naam, contact of email..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-sm"
            style={{ color: '#566079' }} />
        </div>
        {isDealer && accountManagers.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs font-medium" style={{ color: '#7b859e' }}>Filter accountmanager:</span>
            <select value={filterAccountManager} onChange={e => setFilterAccountManager(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#e8eaf2] text-xs bg-white focus:outline-none focus:border-[#3d61a4]"
              style={{ color: '#566079' }}>
              <option value="">Alle accountmanagers</option>
              {accountManagers.map(am => (
                <option key={am.id} value={am.id}>{am.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className={`${selectedClient ? 'w-[480px] flex-shrink-0' : 'w-full'} overflow-auto border-r border-[#e8eaf2]`}>
          {loading && clients.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle size={28} style={{ color: '#df2f4a' }} />
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={fetchClients} className="text-sm px-4 py-2 rounded-lg"
                style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}>Opnieuw</button>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
              <Building2 size={40} style={{ color: '#cdd1e0' }} />
              <p className="font-semibold" style={{ color: '#011745' }}>Nog geen klanten</p>
              <p className="text-sm text-center" style={{ color: '#7b859e' }}>
                Rond onboarding af om klanten hier te zien
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-4">
              <div className={`grid gap-3 ${selectedClient ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                {clients.map(client => (
                  <div key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className={`bg-white rounded-xl p-4 border cursor-pointer transition-all hover:shadow-lg ${
                      selectedClient?.id === client.id ? 'border-[#3d61a4] shadow-lg ring-1 ring-[#3d61a4]/20' : 'border-[#e8eaf2] hover:-translate-y-0.5'
                    }`}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                        style={{ backgroundColor: '#011745' }}>
                        {(client.company_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate" style={{ color: '#011745' }}>{client.company_name}</h3>
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#7b859e' }}>
                          {client.contact_name} {client.contact_position ? `— ${client.contact_position}` : ''}
                        </p>
                        {client.sales_owner_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                            {client.sales_owner_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {client.company_country && (
                        <div className="flex items-center gap-2">
                          <Globe size={11} style={{ color: '#a4abbe' }} />
                          <span className="text-xs" style={{ color: '#566079' }}>{client.company_country}</span>
                        </div>
                      )}
                      {client.company_industry && (
                        <div className="flex items-center gap-2">
                          <BarChart3 size={11} style={{ color: '#a4abbe' }} />
                          <span className="text-xs" style={{ color: '#566079' }}>{client.company_industry}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {client.contact_email && (
                        <a href={`mailto:${client.contact_email}`} onClick={e => e.stopPropagation()}
                          className="text-[10px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 transition-colors hover:bg-[#eef2fa]"
                          style={{ backgroundColor: '#f7f8fc', color: '#3d61a4' }}>
                          <Mail size={9} /> Email
                        </a>
                      )}
                      {(client.contact_phone || client.contact_mobile) && (
                        <a href={`tel:${client.contact_mobile || client.contact_phone}`} onClick={e => e.stopPropagation()}
                          className="text-[10px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 transition-colors hover:bg-[#f0fdf4]"
                          style={{ backgroundColor: '#f7f8fc', color: '#16a34a' }}>
                          <Phone size={9} /> Bellen
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold" style={{ color: '#7b859e' }}>
                    <th className="pb-3 pl-3">Bedrijf</th>
                    <th className="pb-3">Contact</th>
                    <th className="pb-3">Land</th>
                    <th className="pb-3">Industrie</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(client => (
                    <tr key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`cursor-pointer border-b border-[#f3f4f8] transition-colors hover:bg-[#f7f8fc] ${
                        selectedClient?.id === client.id ? 'bg-[#eef2fa]' : ''
                      }`}>
                      <td className="py-3 pl-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: '#011745' }}>
                            {(client.company_name || '?').charAt(0)}
                          </div>
                          <span className="text-sm font-medium" style={{ color: '#011745' }}>{client.company_name}</span>
                          {client.sales_owner_name && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1"
                              style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                              {client.sales_owner_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-sm" style={{ color: '#566079' }}>{client.contact_name}</td>
                      <td className="py-3 text-sm" style={{ color: '#566079' }}>{client.company_country || '—'}</td>
                      <td className="py-3 text-sm" style={{ color: '#566079' }}>{client.company_industry || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedClient && (
          <div className="flex-1 bg-white overflow-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: '#011745' }}>
                    {(selectedClient.company_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: '#011745' }}>{selectedClient.company_name}</h2>
                    <p className="text-sm" style={{ color: '#7b859e' }}>
                      Klant sinds {selectedClient.updated_at ? new Date(selectedClient.updated_at).toLocaleDateString('nl-NL') : '—'}
                    </p>
                    {isDealer ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: '#7b859e' }}>Sales eigenaar:</span>
                        <select
                          value={selectedClient.sales_owner_id || ''}
                          onChange={e => handleChangeSalesOwner(e.target.value)}
                          disabled={changingSalesOwner}
                          className="text-xs rounded-lg px-2 py-1 border focus:outline-none focus:ring-1"
                          style={{ borderColor: '#e8eaf2', color: '#3d61a4', fontWeight: 600, backgroundColor: '#eef2fa' }}>
                          <option value="">— Niet toegewezen —</option>
                          {allUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                          ))}
                        </select>
                        {changingSalesOwner && <span className="text-[10px]" style={{ color: '#a4abbe' }}>Opslaan...</span>}
                      </div>
                    ) : selectedClient.sales_owner_name ? (
                      <p className="text-xs mt-0.5" style={{ color: '#3d61a4' }}>
                        Sales eigenaar: <span className="font-semibold">{selectedClient.sales_owner_name}</span>
                      </p>
                    ) : null}
                    {/* Account Manager */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: '#7b859e' }}>Accountmanager:</span>
                      {isDealer ? (
                        <select
                          value={selectedClient.accountManagerId || ''}
                          onChange={e => handleAssignAccountManager(e.target.value)}
                          disabled={assigningAM}
                          className="text-xs rounded-lg px-2 py-1 border focus:outline-none focus:ring-1"
                          style={{ borderColor: '#e8eaf2', color: '#f59e0b', fontWeight: 600, backgroundColor: '#fffbeb' }}>
                          <option value=''>— Niet toegewezen —</option>
                          {accountManagers.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                          ))}
                        </select>
                      ) : selectedClient.accountManagerName ? (
                        <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>{selectedClient.accountManagerName}</span>
                      ) : <span className="text-xs" style={{ color: '#a4abbe' }}>—</span>}
                      {assigningAM && <span className="text-[10px]" style={{ color: '#a4abbe' }}>Opslaan...</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedClient(null)} className="p-2 rounded-lg hover:bg-[#f3f4f8]">
                  <X size={18} style={{ color: '#7b859e' }} />
                </button>
              </div>

              {/* Products & revenue summary */}
              {!loadingDetails && pd && (
                <div className="flex gap-3 mb-4">
                  {isDealer && (
                    <div className="w-full flex gap-3 mb-1">
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-[#e8eaf2] bg-white flex-1">
                        <input type="checkbox" checked={!!pd.taperpay_active}
                          onChange={e => toggleProduct('taperpay_active', e.target.checked)}
                          className="accent-[#3d61a4] w-4 h-4" />
                        <CreditCard size={12} style={{ color: '#3d61a4' }} />
                        <span className="text-xs font-semibold" style={{ color: '#3d61a4' }}>TaperPay Actief</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-[#e8eaf2] bg-white flex-1">
                        <input type="checkbox" checked={!!pd.tapertrade_active}
                          onChange={e => toggleProduct('tapertrade_active', e.target.checked)}
                          className="accent-[#16a34a] w-4 h-4" />
                        <TrendingUp size={12} style={{ color: '#16a34a' }} />
                        <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>TaperTrade Actief</span>
                      </label>
                    </div>
                  )}
                  {pd.taperpay_active && (
                    <div className="flex-1 p-3 rounded-xl border border-[#e8eaf2]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CreditCard size={12} style={{ color: '#3d61a4' }} />
                        <span className="text-[10px] font-bold" style={{ color: '#3d61a4' }}>TaperPay</span>
                      </div>
                      <p className="text-sm font-bold" style={{ color: '#011745' }}>{formatCurrency(pd.fx_estimated_volume)}</p>
                      {pd.fx_estimated_revenue > 0 && (
                        <p className="text-[10px] font-medium" style={{ color: '#16a34a' }}>
                          <ArrowUpRight size={9} className="inline" /> {formatCurrency(pd.fx_estimated_revenue)} rev
                        </p>
                      )}
                    </div>
                  )}
                  {pd.tapertrade_active && (
                    <div className="flex-1 p-3 rounded-xl border border-[#e8eaf2]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp size={12} style={{ color: '#16a34a' }} />
                        <span className="text-[10px] font-bold" style={{ color: '#16a34a' }}>TaperTrade</span>
                      </div>
                      <p className="text-sm font-bold" style={{ color: '#011745' }}>{formatCurrency(pd.tf_estimated_volume)}</p>
                      {pd.tf_estimated_revenue > 0 && (
                        <p className="text-[10px] font-medium" style={{ color: '#16a34a' }}>
                          <ArrowUpRight size={9} className="inline" /> {formatCurrency(pd.tf_estimated_revenue)} rev
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab navigation */}
              <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1 mb-5 overflow-x-auto">
                {[
                  { key: 'overview',        label: 'Overzicht',    icon: Building2 },
                  { key: 'contacten',       label: 'Contacten',    icon: Phone },
                  { key: 'correspondentie', label: 'E-mails',      icon: MailOpen },
                  { key: 'gesprekken',      label: 'Gesprekken',   icon: PhoneCall },
                  { key: 'communicatie',    label: 'Communicatie', icon: MessageSquare },
                  { key: 'documents',       label: 'Documenten',   icon: FileText },
                  { key: 'bedrijfsinfo',    label: 'Bedrijfsinfo', icon: Zap },
                  { key: 'taperpay',        label: 'TaperPay',     icon: CreditCard },
                  { key: 'tapertrade',      label: 'TaperTrade',   icon: Truck },
                  { key: 'forecasting',     label: 'Forecasting',  icon: TrendingUp },
                  { key: 'compliance',      label: 'Compliance',   icon: Shield },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      detailTab === tab.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                    }`}
                    style={{ color: detailTab === tab.key ? '#3d61a4' : '#7b859e' }}>
                    <tab.icon size={13} /> {tab.label}
                  </button>
                ))}
              </div>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin" style={{ color: '#3d61a4' }} />
                </div>
              ) : (
                <>
                  {/* ═══ OVERVIEW TAB ═══ */}
                  {detailTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Edit knop rechtsboven */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setEditingClientInfo(true);
                            setClientInfoEdits({
                              company_name: selectedClient?.company_name || '',
                              company_country: selectedClient?.company_country || '',
                              company_industry: selectedClient?.company_industry || '',
                              company_website: selectedClient?.company_website || '',
                              company_size: selectedClient?.company_size || '',
                              contact_name: selectedClient?.contact_name || '',
                              contact_email: selectedClient?.contact_email || '',
                              contact_phone: selectedClient?.contact_phone || '',
                              contact_mobile: selectedClient?.contact_mobile || '',
                              contact_position: selectedClient?.contact_position || '',
                            });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[#f7f8fc]"
                          style={{ borderColor: '#e8eaf2', color: '#566079' }}>
                          <Edit3 size={12} /> Bewerken
                        </button>
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Contactgegevens</h3>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#f7f8fc' }}>
                            <User size={14} style={{ color: '#3d61a4' }} />
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#011745' }}>{selectedClient.contact_name}</p>
                              <p className="text-xs" style={{ color: '#7b859e' }}>{selectedClient.contact_position || '—'}</p>
                            </div>
                          </div>
                          {selectedClient.contact_email && (
                            <a href={`mailto:${selectedClient.contact_email}`}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#eef2fa] transition-colors"
                              style={{ backgroundColor: '#f7f8fc' }}>
                              <Mail size={14} style={{ color: '#3d61a4' }} />
                              <span className="text-sm" style={{ color: '#3d61a4' }}>{selectedClient.contact_email}</span>
                            </a>
                          )}
                          {(selectedClient.contact_phone || selectedClient.contact_mobile) && (
                            <a href={`tel:${selectedClient.contact_mobile || selectedClient.contact_phone}`}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#eef2fa] transition-colors"
                              style={{ backgroundColor: '#f7f8fc' }}>
                              <Phone size={14} style={{ color: '#3d61a4' }} />
                              <span className="text-sm" style={{ color: '#3d61a4' }}>{selectedClient.contact_mobile || selectedClient.contact_phone}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Bedrijfsgegevens</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ['Land', selectedClient.company_country],
                            ['Industrie', selectedClient.company_industry],
                            ['Omvang', selectedClient.company_size],
                            ['KVK', selectedClient.kvk_number],
                            ['Website', selectedClient.company_website],
                            ['Broker', pd?.selected_broker?.toUpperCase()],
                            ['Sales Owner', selectedClient.sales_owner_name],
                          ].map(([label, val]) => (
                            <div key={label} className="p-2.5 rounded-lg" style={{ backgroundColor: '#f7f8fc' }}>
                              <p className="text-[10px] uppercase font-semibold" style={{ color: '#7b859e' }}>{label}</p>
                              <p className="text-xs font-medium" style={{ color: '#011745' }}>{val || '—'}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {selectedClient.company_description && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Beschrijving</h3>
                          <p className="text-sm leading-relaxed p-3 rounded-lg" style={{ backgroundColor: '#f7f8fc', color: '#566079' }}>
                            {selectedClient.company_description}
                          </p>
                        </div>
                      )}

                      <div>
                        <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Notities</h3>
                        <div className="flex gap-2 mb-2">
                          <input type="text" placeholder="Voeg een notitie toe..."
                            value={noteText} onChange={e => setNoteText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addNote()}
                            className="flex-1 px-3 py-2 rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-sm"
                            style={{ color: '#566079' }} />
                          <button onClick={addNote} disabled={addingNote || !noteText.trim()}
                            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                            style={{ backgroundColor: '#3d61a4' }}>
                            {addingNote ? <Loader2 size={14} className="animate-spin" /> : 'Opslaan'}
                          </button>
                        </div>
                        {Array.isArray(notes) && notes.length > 0 && (
                          <div className="space-y-1.5">
                            {notes.slice(0, 5).map((note, i) => (
                              <div key={note.id || i} className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#f7f8fc', color: '#566079' }}>
                                {note.content}
                                {note.created_at && (
                                  <p className="text-[10px] mt-1" style={{ color: '#a4abbe' }}>
                                    {note.user_name && <span className="font-medium">{note.user_name} — </span>}
                                    {new Date(note.created_at).toLocaleString('nl-NL')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ── Producten & Broker ── */}
                      {pd && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Producten & Broker</h3>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {pd.taperpay_active && <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#eef2fa] text-[#3d61a4]">✓ TaperPay Actief</span>}
                            {pd.tapertrade_active && <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-amber-700">✓ TaperTrade Actief</span>}
                            {pd.selected_broker && (() => {
                              const bColors = { ibanfirst: ['#eef2fa','#3d61a4'], corpay: ['#e8eaf2','#0a2d6b'], ebury: ['#dcfce7','#166534'], alt21: ['#fef3c7','#92400e'] };
                              const [bg, txt] = bColors[pd.selected_broker] || ['#f3f4f8','#566079'];
                              return <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: bg, color: txt }}>{pd.selected_broker.toUpperCase()}</span>;
                            })()}
                          </div>
                          {/* Pricing */}
                          {(pd.fx_spot_spread_pct || pd.fx_forward_margin_pct || pd.credit_limit_eur || pd.min_deal_size_eur) && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {[
                                ['Spot Spread', pd.fx_spot_spread_pct != null ? `${(pd.fx_spot_spread_pct*100).toFixed(3)}%` : null],
                                ['Forward Marge', pd.fx_forward_margin_pct != null ? `${(pd.fx_forward_margin_pct*100).toFixed(3)}%` : null],
                                ['Credit Limiet', pd.credit_limit_eur ? formatCurrency(pd.credit_limit_eur) : null],
                                ['Min. Deal', pd.min_deal_size_eur ? formatCurrency(pd.min_deal_size_eur) : null],
                                ['TF Rente', pd.tf_interest_rate_pct != null ? `${pd.tf_interest_rate_pct}%` : null],
                                ['TF Fee', pd.tf_fee_pct != null ? `${pd.tf_fee_pct}%` : null],
                                ['TF Afsluitprovisie', pd.tf_closing_fee_pct != null ? `${pd.tf_closing_fee_pct}%` : null],
                                ['Betaaltermijn', pd.payment_terms_days ? `${pd.payment_terms_days} dagen` : null],
                              ].filter(([,v]) => v).map(([label, val]) => (
                                <div key={label} className="p-2.5 rounded-lg bg-[#f7f8fc]">
                                  <p className="text-[10px] uppercase font-semibold text-[#7b859e]">{label}</p>
                                  <p className="text-xs font-medium text-[#011745]">{val}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* KYC */}
                          {(pd.kyc_status || pd.risk_profile || pd.ubo_name) && (
                            <div className="mt-2 p-3 rounded-lg bg-[#f7f8fc] space-y-1">
                              <p className="text-[10px] uppercase font-semibold text-[#7b859e] mb-1.5">KYC Status</p>
                              {[
                                ['Status', pd.kyc_status],
                                ['Risicoprofiel', pd.risk_profile],
                                ['UBO', pd.ubo_name],
                                ['Juridische entiteit', pd.legal_entity_type],
                              ].filter(([,v]) => v).map(([label, val]) => (
                                <div key={label} className="flex justify-between text-xs">
                                  <span className="text-[#7b859e]">{label}</span>
                                  <span className="font-medium text-[#011745]">{val}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Valuta & Landen ── */}
                      {pd?.currencies?.length > 0 && (() => {
                        const byType = pd.currencies.reduce((acc, c) => {
                          acc[c.currency_type] = acc[c.currency_type] || [];
                          acc[c.currency_type].push(c);
                          return acc;
                        }, {});
                        const typeLabels = {
                          buying_currency: { label: 'Koopt', color: '#3d61a4', bg: '#eef2fa' },
                          selling_currency: { label: 'Verkoopt', color: '#92400e', bg: '#fef3c7' },
                          incoming_country: { label: 'Inkomend vanuit', color: '#166534', bg: '#dcfce7' },
                          outgoing_country: { label: 'Uitgaand naar', color: '#0a2d6b', bg: '#e8eaf2' },
                        };
                        return (
                          <div>
                            <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Valuta & Landen</h3>
                            <div className="space-y-3">
                              {Object.entries(byType).map(([type, items]) => {
                                const { label, color, bg } = typeLabels[type] || { label: type, color: '#566079', bg: '#f3f4f8' };
                                return (
                                  <div key={type}>
                                    <p className="text-[10px] uppercase font-semibold mb-1.5" style={{ color: '#7b859e' }}>{label}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {items.map((c, i) => (
                                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: bg, color }}>
                                          <span>{c.value}</span>
                                          {c.volume && <span className="font-normal text-[10px] opacity-70">· {formatCurrency(c.volume)}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Strategie notities ── */}
                      {pd?.strategy_notes && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Strategie</h3>
                          <p className="text-sm leading-relaxed p-3 rounded-lg bg-[#f7f8fc] text-[#566079]">{pd.strategy_notes}</p>
                        </div>
                      )}

                      {/* ── Revenue Potentie (uit lead fase) ── */}
                      {(() => {
                        let rows = [];
                        const rp = selectedClient.revenue_potential;
                        if (Array.isArray(rp)) rows = rp;
                        else if (typeof rp === 'string') { try { rows = JSON.parse(rp); } catch { rows = []; } }
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
                            <h3 className="text-xs font-semibold uppercase mb-3 flex items-center gap-1.5" style={{ color: '#3d61a4' }}>
                              <TrendingUp size={12} /> Revenue Potentie (uit lead fase)
                            </h3>
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
                      })()}

                      {selectedClient.ai_score && (
                        <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #011745, #3d61a4)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white/80">AI Score</span>
                            <span className="text-2xl font-bold text-white">{Math.round(selectedClient.ai_score * 10)}/100</span>
                          </div>
                          {selectedClient.ai_score_reasons && (
                            <p className="text-xs text-white/60">
                              {typeof selectedClient.ai_score_reasons === 'string'
                                ? selectedClient.ai_score_reasons
                                : JSON.stringify(selectedClient.ai_score_reasons)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* ── Export knop ── */}
                      <div className="pt-2 border-t border-[#e8eaf2]">
                        <button onClick={() => handleExportClient()}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-[#011745] text-[#011745] hover:bg-[#011745] hover:text-white transition-all">
                          <Download size={15} /> Export Clientinformatie
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ═══ FORECASTING TAB ═══ */}
                  {detailTab === 'forecasting' && (() => {
                    const fmtPct = v => v ? `${(parseFloat(v)*100).toFixed(2)}%` : '—';
                    const DEAL_TYPES = { spot: 'Spot', fixed_forward: 'Fixed Forward', window_forward: 'Window Forward', dynamic_forward: 'Dynamic Forward' };
                    const allDeals = (forecasting?.items || []).flatMap(i => (i._deals || []));
                    return (
                    <div className="space-y-5">

                      {/* ── Summary bar ── */}
                      {forecasting?.items?.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 rounded-xl border border-[#e8eaf2] bg-[#f7f8fc]">
                            <p className="text-[10px] uppercase font-semibold text-[#7b859e]">Forecast Volume / Jaar</p>
                            <p className="text-base font-bold text-[#011745]">{formatCurrency(forecasting.total_volume)}</p>
                            {forecasting.total_booked_volume > 0 && (
                              <p className="text-[10px] text-[#16a34a] font-medium mt-0.5">
                                ✓ {formatCurrency(forecasting.total_booked_volume)} geboekt
                              </p>
                            )}
                          </div>
                          <div className="p-3 rounded-xl border border-[#e8eaf2] bg-[#f7f8fc]">
                            <p className="text-[10px] uppercase font-semibold text-[#7b859e]">Forecast Omzet / Jaar</p>
                            <p className="text-base font-bold text-[#16a34a]">{formatCurrency(forecasting.total_revenue)}</p>
                            {forecasting.total_booked_revenue > 0 && (
                              <p className="text-[10px] text-[#16a34a] font-medium mt-0.5">
                                ✓ {formatCurrency(forecasting.total_booked_revenue)} geboekt
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ══════════════════════════════════════════
                          SECTION 1 — ANNUAL VOLUME
                      ══════════════════════════════════════════ */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-xs font-bold uppercase text-[#011745]">1 — Annual Volume</h3>
                            <p className="text-[10px] text-[#a4abbe]">Verwacht jaarvolume per valutapaar incl. hedging split</p>
                          </div>
                          <button onClick={() => { setShowAddForecast(true); setEditingForecastId(null); setForecastForm({ buy_currency: 'EUR', sell_currency: 'USD', volume_per_year: '', spot_margin_pct: '', hedging_pct: '', hedging_margin_pct: '', notes: '' }); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium bg-[#3d61a4] hover:bg-[#0a2d6b]">
                            <Plus size={12} /> Pair toevoegen
                          </button>
                        </div>

                        {showAddForecast && (
                          <div className="bg-[#f7f8fc] rounded-xl border-2 border-[#3d61a4]/30 p-4 mb-3 space-y-3">
                            <h4 className="text-sm font-semibold text-[#011745]">{editingForecastId ? 'Pair bewerken' : 'Nieuw currency pair'}</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {[['buy_currency','BUY'],['sell_currency','SELL']].map(([f,lbl]) => (
                                <div key={f}>
                                  <label className="text-xs font-medium text-[#566079] block mb-1">{lbl} Currency</label>
                                  <select value={forecastForm[f]} onChange={e => setForecastForm({...forecastForm,[f]:e.target.value})}
                                    className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]">
                                    {COMMON_CURRENCIES.map(c => <option key={c}>{c}</option>)}
                                  </select>
                                </div>
                              ))}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-[#566079] block mb-1">Volume / jaar (EUR)</label>
                              <input type="number" value={forecastForm.volume_per_year}
                                onChange={e => setForecastForm({...forecastForm, volume_per_year: e.target.value})}
                                placeholder="1000000" className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                            </div>
                            <div className="p-3 rounded-lg bg-white border border-[#e8eaf2] space-y-2">
                              <p className="text-[10px] font-bold uppercase text-[#566079]">Spot (ongehedged deel)</p>
                              <div>
                                <label className="text-xs text-[#7b859e] block mb-1">Spot marge % <span className="text-[10px]">(bijv. 0.005 = 0.5%)</span></label>
                                <input type="number" step="0.0001" value={forecastForm.spot_margin_pct}
                                  onChange={e => setForecastForm({...forecastForm, spot_margin_pct: e.target.value})}
                                  placeholder="0.005" className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                              </div>
                            </div>
                            <div className="p-3 rounded-lg bg-white border border-[#e8eaf2] space-y-2">
                              <p className="text-[10px] font-bold uppercase text-[#566079]">Hedging (forward deel)</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-[#7b859e] block mb-1">Hedging % <span className="text-[10px]">(0–100)</span></label>
                                  <div className="relative">
                                    <input type="number" min="0" max="100" value={forecastForm.hedging_pct}
                                      onChange={e => setForecastForm({...forecastForm, hedging_pct: e.target.value})}
                                      placeholder="60" className="w-full px-2 py-1.5 pr-6 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#a4abbe]">%</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-[#7b859e] block mb-1">Hedge marge % <span className="text-[10px]">(bijv. 0.006)</span></label>
                                  <input type="number" step="0.0001" value={forecastForm.hedging_margin_pct}
                                    onChange={e => setForecastForm({...forecastForm, hedging_margin_pct: e.target.value})}
                                    placeholder="0.006" className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                                </div>
                              </div>
                            </div>
                            {/* Live preview */}
                            {forecastForm.volume_per_year && (
                              <div className="p-2 rounded-lg bg-[#eef2fa] text-xs">
                                {(() => {
                                  const vol = parseFloat(forecastForm.volume_per_year)||0;
                                  const hPct = (parseFloat(forecastForm.hedging_pct)||0)/100;
                                  const spotVol = vol*(1-hPct), hedgeVol = vol*hPct;
                                  const spotRev = spotVol*(parseFloat(forecastForm.spot_margin_pct)||0);
                                  const hedgeRev = hedgeVol*(parseFloat(forecastForm.hedging_margin_pct)||0);
                                  return <span className="text-[#3d61a4] font-medium">
                                    Spot {formatCurrency(spotVol)} × {fmtPct(forecastForm.spot_margin_pct)} = {formatCurrency(spotRev)} &nbsp;|&nbsp;
                                    Hedge {formatCurrency(hedgeVol)} × {fmtPct(forecastForm.hedging_margin_pct)} = {formatCurrency(hedgeRev)} &nbsp;→&nbsp;
                                    <strong>Totaal: {formatCurrency(spotRev+hedgeRev)}</strong>
                                  </span>;
                                })()}
                              </div>
                            )}
                            <input type="text" value={forecastForm.notes} onChange={e => setForecastForm({...forecastForm, notes: e.target.value})}
                              placeholder="Notities (optioneel)" className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                            <div className="flex gap-2 justify-end pt-1">
                              <button onClick={() => {setShowAddForecast(false); setEditingForecastId(null);}} className="px-3 py-1.5 rounded-lg text-sm text-[#7b859e]">Annuleer</button>
                              <button onClick={saveForecastItem} disabled={savingForecast}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium bg-[#3d61a4] disabled:opacity-40">
                                {savingForecast ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                {editingForecastId ? 'Opslaan' : 'Toevoegen'}
                              </button>
                            </div>
                          </div>
                        )}

                        {forecasting?.items?.length > 0 ? (
                          <div className="space-y-2">
                            {forecasting.items.map(item => (
                              <div key={item.id} className="bg-white rounded-xl border border-[#e8eaf2] p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">{item.buy_currency}</span>
                                    <ArrowUpRight size={12} className="text-[#a4abbe]" />
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">{item.sell_currency}</span>
                                    {item.booked_volume > 0 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                                        {formatCurrency(item.booked_volume)} geboekt
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => startEditForecast(item)} className="p-1 rounded hover:bg-[#eef2fa] text-[#3d61a4]"><Edit3 size={12} /></button>
                                    <button onClick={() => deleteForecastItem(item.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={12} /></button>
                                  </div>
                                </div>
                                {/* Volume + split */}
                                <div className="grid grid-cols-4 gap-2 text-[10px]">
                                  <div><p className="uppercase text-[#7b859e] font-semibold">Volume/jaar</p><p className="font-bold text-[#011745] text-xs">{formatCurrency(item.volume_per_year)}</p></div>
                                  <div><p className="uppercase text-[#7b859e] font-semibold">Spot ({fmtPct(item.spot_margin_pct)})</p><p className="font-bold text-[#011745] text-xs">{formatCurrency(item.spot_revenue)}</p></div>
                                  <div><p className="uppercase text-[#7b859e] font-semibold">Hedge {item.hedging_pct>0?`(${(item.hedging_pct*100).toFixed(0)}%)`:''}</p><p className="font-bold text-[#011745] text-xs">{formatCurrency(item.hedge_revenue)}</p></div>
                                  <div><p className="uppercase text-[#7b859e] font-semibold">Totaal omzet</p><p className="font-bold text-[#16a34a] text-xs">{formatCurrency(item.total_revenue)}</p></div>
                                </div>
                                {/* Progress bar: booked vs forecast */}
                                {item.volume_per_year > 0 && item.booked_volume > 0 && (
                                  <div className="mt-2">
                                    <div className="h-1.5 rounded-full bg-[#e8eaf2] overflow-hidden">
                                      <div className="h-full rounded-full bg-[#16a34a]" style={{ width: `${Math.min(100, (item.booked_volume/item.volume_per_year)*100).toFixed(0)}%` }} />
                                    </div>
                                    <p className="text-[10px] text-[#7b859e] mt-0.5">
                                      {((item.booked_volume/item.volume_per_year)*100).toFixed(0)}% geboekt · {formatCurrency(item.remaining_volume)} resterend
                                    </p>
                                  </div>
                                )}
                                {item.notes && <p className="text-[11px] text-[#7b859e] mt-1">{item.notes}</p>}
                              </div>
                            ))}
                          </div>
                        ) : !showAddForecast && (
                          <div className="text-center py-6 rounded-lg bg-[#f7f8fc]">
                            <TrendingUp size={22} className="mx-auto mb-1 text-[#cdd1e0]" />
                            <p className="text-sm text-[#7b859e]">Nog geen currency pairs</p>
                          </div>
                        )}
                      </div>

                      {/* ══════════════════════════════════════════
                          SECTION 2 — INDIVIDUAL DEALS
                      ══════════════════════════════════════════ */}
                      <div className="border-t border-[#e8eaf2] pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-xs font-bold uppercase text-[#011745]">2 — Individual Deals</h3>
                            <p className="text-[10px] text-[#a4abbe]">Losse geboekte transacties — worden afgehaald van het annual volume</p>
                          </div>
                          <button onClick={() => setShowAddDeal(true)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium bg-[#011745] hover:bg-[#0a2d6b]">
                            <Plus size={12} /> Deal toevoegen
                          </button>
                        </div>

                        {showAddDeal && (
                          <div className="bg-[#f7f8fc] rounded-xl border-2 border-[#011745]/20 p-4 mb-3 space-y-3">
                            <h4 className="text-sm font-semibold text-[#011745]">Nieuwe deal</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {[['buy_currency','BUY'],['sell_currency','SELL']].map(([f,lbl]) => (
                                <div key={f}>
                                  <label className="text-xs font-medium text-[#566079] block mb-1">{lbl}</label>
                                  <select value={dealForm[f]} onChange={e => setDealForm({...dealForm,[f]:e.target.value})}
                                    className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]">
                                    {COMMON_CURRENCIES.map(c => <option key={c}>{c}</option>)}
                                  </select>
                                </div>
                              ))}
                              <div>
                                <label className="text-xs font-medium text-[#566079] block mb-1">Datum</label>
                                <input type="date" value={dealForm.deal_date} onChange={e => setDealForm({...dealForm, deal_date: e.target.value})}
                                  className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-[#566079] block mb-1">Type</label>
                                <select value={dealForm.deal_type} onChange={e => setDealForm({...dealForm, deal_type: e.target.value})}
                                  className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]">
                                  {Object.entries(DEAL_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-[#566079] block mb-1">Volume (EUR)</label>
                                <input type="number" value={dealForm.volume} onChange={e => setDealForm({...dealForm, volume: e.target.value})}
                                  placeholder="500000" className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-[#566079] block mb-1">Marge % <span className="text-[10px]">(bijv. 0.005)</span></label>
                                <input type="number" step="0.0001" value={dealForm.margin_pct} onChange={e => setDealForm({...dealForm, margin_pct: e.target.value})}
                                  placeholder="0.005" className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-[#566079] block mb-1">Koppel aan currency pair <span className="text-[10px] text-[#a4abbe]">(optioneel)</span></label>
                              <select value={dealForm.forecasting_item_id} onChange={e => setDealForm({...dealForm, forecasting_item_id: e.target.value})}
                                className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]">
                                <option value="">— Niet gekoppeld —</option>
                                {(forecasting?.items||[]).map(i => <option key={i.id} value={i.id}>{i.buy_currency}/{i.sell_currency}</option>)}
                              </select>
                            </div>
                            {dealForm.volume && dealForm.margin_pct && (
                              <div className="p-2 rounded-lg bg-[#eef2fa] text-xs text-[#3d61a4] font-medium">
                                Omzet: {formatCurrency((parseFloat(dealForm.volume)||0)*(parseFloat(dealForm.margin_pct)||0))}
                              </div>
                            )}
                            <input type="text" value={dealForm.notes} onChange={e => setDealForm({...dealForm, notes: e.target.value})}
                              placeholder="Notities (optioneel)" className="w-full px-2 py-1.5 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4]" />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setShowAddDeal(false)} className="px-3 py-1.5 rounded-lg text-sm text-[#7b859e]">Annuleer</button>
                              <button onClick={saveDeal} disabled={savingDeal || !dealForm.volume || !dealForm.deal_date}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium bg-[#011745] disabled:opacity-40">
                                {savingDeal ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                Deal opslaan
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Deals list — grouped by linked pair */}
                        {(forecasting?.items||[]).some(i => i.booked_volume > 0) || forecasting?.unlinked_deals?.length > 0 ? (
                          <div className="space-y-2">
                            {(forecasting?.items||[]).filter(i => i.booked_volume > 0).map(item => (
                              <div key={item.id} className="rounded-xl border border-[#e8eaf2] overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#f7f8fc] border-b border-[#e8eaf2]">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">{item.buy_currency}/{item.sell_currency}</span>
                                  <span className="text-[10px] text-[#7b859e]">{formatCurrency(item.booked_volume)} geboekt van {formatCurrency(item.volume_per_year)}</span>
                                </div>
                                {(item._deals||[]).map(deal => (
                                  <div key={deal.id} className="flex items-center justify-between px-3 py-2 border-b border-[#f3f4f8] last:border-0 bg-white">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: deal.deal_type==='spot'?'#eef2fa':deal.deal_type.includes('forward')?'#fef3c7':'#f0fdf4', color: deal.deal_type==='spot'?'#3d61a4':deal.deal_type.includes('forward')?'#92400e':'#166534' }}>
                                        {DEAL_TYPES[deal.deal_type]||deal.deal_type}
                                      </span>
                                      <span className="text-xs font-medium text-[#011745]">{formatCurrency(deal.volume)}</span>
                                      <span className="text-xs text-[#7b859e]">@ {fmtPct(deal.margin_pct)}</span>
                                      <span className="text-xs text-[#16a34a] font-medium">= {formatCurrency(deal.revenue)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-[#a4abbe]">{deal.deal_date}</span>
                                      <button onClick={() => deleteDeal(deal.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : !showAddDeal && (
                          <div className="text-center py-5 rounded-lg bg-[#f7f8fc]">
                            <p className="text-sm text-[#7b859e]">Nog geen geboekte deals</p>
                            <p className="text-[10px] text-[#a4abbe] mt-0.5">Voeg individuele transacties toe om het resterende volume bij te houden</p>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  {/* ═══ ACCOUNT PLAN SECTION ═══ */}
                  {detailTab === 'forecasting' && (
                    <div className="mt-6 border-t border-[#f3f4f8] pt-6">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Account Plan</h3>
                        <button onClick={saveAccountPlan} disabled={savingAccountPlan}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                          style={{ backgroundColor: '#3d61a4' }}>
                          {savingAccountPlan ? 'Opslaan...' : 'Opslaan'}
                        </button>
                      </div>
                      <textarea
                        value={accountPlan}
                        onChange={e => setAccountPlan(e.target.value)}
                        rows={8}
                        className="w-full border border-[#e8eaf2] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] resize-y"
                        placeholder="Schrijf hier het account plan voor deze klant... (strategie, doelen, acties, tijdlijn)"
                        style={{ color: '#011745', backgroundColor: '#f7f8fc' }}
                      />
                    </div>
                  )}

                  {/* ═══ COMPLIANCE TAB ═══ */}
                  {detailTab === 'compliance' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Compliance Cases</h3>
                        <button onClick={() => setShowAddCompliance(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                          style={{ backgroundColor: '#3d61a4' }}>
                          <Plus size={14} /> Nieuwe Case
                        </button>
                      </div>

                      {showAddCompliance && (
                        <div className="bg-white rounded-xl border-2 border-[#3d61a4]/30 p-4">
                          <h4 className="text-sm font-semibold mb-3" style={{ color: '#011745' }}>Nieuwe Compliance Case</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Titel *</label>
                              <input type="text" value={complianceForm.title}
                                onChange={e => setComplianceForm({ ...complianceForm, title: e.target.value })}
                                placeholder="Korte omschrijving van het verzoek..."
                                className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                                style={{ color: '#011745' }} />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Notities / Verzoek</label>
                              <textarea value={complianceForm.description}
                                onChange={e => setComplianceForm({ ...complianceForm, description: e.target.value })}
                                placeholder="Gedetailleerde beschrijving van het compliance verzoek..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4] resize-none"
                                style={{ color: '#011745' }} />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Prioriteit</label>
                              <select value={complianceForm.priority}
                                onChange={e => setComplianceForm({ ...complianceForm, priority: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                                style={{ color: '#011745' }}>
                                <option value="low">Laag</option>
                                <option value="normal">Normaal</option>
                                <option value="high">Hoog</option>
                                <option value="urgent">Urgent</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-2" style={{ color: '#566079' }}>Broker / Kanaal</label>
                              <BrokerPicker value={complianceForm.broker} onChange={v => setComplianceForm({ ...complianceForm, broker: v })} />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-2" style={{ color: '#566079' }}>Documenten</label>
                              <DropZone onFiles={files => setCompliancePendingFiles(prev => [...prev, ...files])} uploading={complianceUploading} />
                              {compliancePendingFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {compliancePendingFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                                      style={{ backgroundColor: '#f7f8fc', border: '1px solid #e8eaf2' }}>
                                      <FileText size={11} style={{ color: '#3d61a4' }} />
                                      <span className="text-xs flex-1 truncate" style={{ color: '#566079' }}>{f.name}</span>
                                      <button onClick={() => setCompliancePendingFiles(prev => prev.filter((_, j) => j !== i))}
                                        className="text-xs" style={{ color: '#a4abbe' }}>✕</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => { setShowAddCompliance(false); setCompliancePendingFiles([]); }}
                              className="px-3 py-1.5 rounded-lg text-sm" style={{ color: '#7b859e' }}>Annuleer</button>
                            <button onClick={saveComplianceCase} disabled={savingCompliance || complianceUploading || !complianceForm.title.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-40"
                              style={{ backgroundColor: '#3d61a4' }}>
                              {(savingCompliance || complianceUploading) ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              Aanmaken
                            </button>
                          </div>
                        </div>
                      )}

                      {complianceCases?.cases?.length > 0 ? (
                        <div className="space-y-2">
                          {complianceCases.cases.map(c => {
                            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open;
                            const pc = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.normal;
                            return (
                              <div key={c.id} className="bg-white rounded-xl border border-[#e8eaf2] p-4 hover:border-[#3d61a4]/30 transition-all">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <h4 className="text-sm font-semibold truncate" style={{ color: '#011745' }}>{c.title}</h4>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                                        style={{ backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                                        style={{ backgroundColor: pc.bg, color: pc.text }}>{pc.label}</span>
                                      {c.broker && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                                          style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                                          {BROKERS.find(b => b.key === c.broker)?.label || c.broker}
                                        </span>
                                      )}
                                    </div>
                                    {c.description && (
                                      <p className="text-xs line-clamp-2" style={{ color: '#566079' }}>{c.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-3 text-[10px]" style={{ color: '#a4abbe' }}>
                                    {c.created_by_name && <span>Door: {c.created_by_name}</span>}
                                    {c.created_at && <span>{new Date(c.created_at).toLocaleDateString('nl-NL')}</span>}
                                    {c.document_count > 0 && (
                                      <span className="flex items-center gap-0.5"><FileText size={10} /> {c.document_count}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {/* Upload document */}
                                    <label className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors cursor-pointer" style={{ color: '#3d61a4' }} title="Document uploaden">
                                      <Upload size={14} />
                                      <input type="file" className="hidden" onChange={e => {
                                        if (e.target.files[0]) uploadComplianceDoc(c.id, e.target.files[0]);
                                      }} />
                                    </label>
                                    {/* Status dropdown */}
                                    <select value={c.status}
                                      onChange={e => updateComplianceStatus(c.id, e.target.value)}
                                      className="text-[10px] font-semibold px-2 py-1 rounded border-0 cursor-pointer"
                                      style={{ backgroundColor: sc.bg, color: sc.text }}>
                                      <option value="open">Open</option>
                                      <option value="in_progress">In Behandeling</option>
                                      <option value="resolved">Opgelost</option>
                                      <option value="closed">Gesloten</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : !showAddCompliance && (
                        <div className="text-center py-8 rounded-lg" style={{ backgroundColor: '#f7f8fc' }}>
                          <Shield size={24} className="mx-auto mb-2" style={{ color: '#cdd1e0' }} />
                          <p className="text-sm" style={{ color: '#7b859e' }}>Geen compliance cases</p>
                          <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>Maak een nieuwe case aan voor compliance verzoeken</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ DOCUMENTS TAB ═══ */}
                  {detailTab === 'documents' && (
                    <div>
                      {documents.length > 0 ? (
                        <div className="space-y-2">
                          {documents.map(doc => (
                            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#e8eaf2] bg-[#f7f8fc]">
                              <FileText size={16} style={{ color: doc.approval_status === 'approved' ? '#16a34a' : doc.approval_status === 'rejected' ? '#dc2626' : '#3d61a4' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: '#011745' }}>{doc.original_filename}</p>
                                <p className="text-[10px]" style={{ color: '#a4abbe' }}>
                                  {(doc.file_size / 1024).toFixed(0)} KB
                                  {doc.created_at && <> &bull; {new Date(doc.created_at).toLocaleDateString('nl-NL')}</>}
                                </p>
                              </div>
                              {doc.approval_status === 'approved' && <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-green-100 text-green-700">GOED</span>}
                              {doc.approval_status === 'rejected' && <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">AFGEKEURD</span>}
                              {doc.ai_scan_status === 'scanned' && <CheckCircle2 size={14} className="text-green-500" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 rounded-lg" style={{ backgroundColor: '#f7f8fc' }}>
                          <FileText size={24} className="mx-auto mb-2" style={{ color: '#cdd1e0' }} />
                          <p className="text-sm" style={{ color: '#7b859e' }}>Geen documenten gevonden</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ CORRESPONDENTIE TAB ═══ */}
                  {detailTab === 'correspondentie' && (
                    <div>
                      <EmailThreadsPanel leadId={selectedClient?.id} />
                    </div>
                  )}

                  {/* ═══ CORRESPONDENTIE TAB (old — kept for reference, unreachable) ═══ */}
                  {false && detailTab === 'correspondentie_old' && (
                    <div className="space-y-4">
                      {/* Gmail Sync button */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#7b859e]">Volledige correspondentie-tijdlijn</p>
                        <button
                          onClick={syncGmailForClient}
                          disabled={gmailSyncing}
                          className="flex items-center gap-1.5 text-xs bg-[#011745] text-white px-3 py-1.5 rounded-lg hover:bg-[#0a2d6b] transition-colors disabled:opacity-60"
                        >
                          {gmailSyncing
                            ? <><span className="animate-spin inline-block">↻</span> Synchroniseren...</>
                            : <>↻ Gmail Sync</>}
                        </button>
                      </div>

                      {/* Counts */}
                      {correspondence?.counts && (
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { key: 'emails', icon: MailOpen, label: 'E-mails', count: correspondence.counts.emails },
                            { key: 'calls', icon: PhoneCall, label: 'Gesprekken', count: correspondence.counts.calls },
                            { key: 'communications', icon: MessageSquare, label: 'Berichten', count: correspondence.counts.communications },
                            { key: 'notes', icon: StickyNote, label: 'Notities', count: correspondence.counts.notes },
                          ].map(item => (
                            <div key={item.key} className="p-3 rounded-lg text-center" style={{ backgroundColor: '#f7f8fc' }}>
                              <item.icon size={14} className="mx-auto mb-1" style={{ color: '#3d61a4' }} />
                              <p className="text-lg font-bold" style={{ color: '#011745' }}>{item.count}</p>
                              <p className="text-[10px]" style={{ color: '#7b859e' }}>{item.label}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Filter */}
                      <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1">
                        {[
                          { key: 'all', label: 'Alles' },
                          { key: 'email', label: 'E-mails' },
                          { key: 'call', label: 'Gesprekken' },
                          { key: 'communication', label: 'Berichten' },
                          { key: 'note', label: 'Notities' },
                        ].map(f => (
                          <button key={f.key} onClick={() => setCorrFilter(f.key)}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              corrFilter === f.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                            }`}
                            style={{ color: corrFilter === f.key ? '#3d61a4' : '#7b859e' }}>
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {/* Timeline */}
                      {filteredTimeline.length > 0 ? (
                        <div className="space-y-2">
                          {filteredTimeline.map((item, i) => (
                            <div key={`${item.type}-${item.id}-${i}`} className="p-3 rounded-lg border border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
                              <div className="flex items-center gap-2 mb-1.5">
                                {item.type === 'email' && <MailOpen size={12} style={{ color: '#3d61a4' }} />}
                                {item.type === 'call' && <PhoneCall size={12} style={{ color: '#16a34a' }} />}
                                {item.type === 'communication' && <MessageSquare size={12} style={{ color: '#92400e' }} />}
                                {item.type === 'note' && <StickyNote size={12} style={{ color: '#7b859e' }} />}
                                <span className="text-[10px] font-semibold uppercase" style={{
                                  color: item.type === 'email' ? '#3d61a4' : item.type === 'call' ? '#16a34a' : item.type === 'communication' ? '#92400e' : '#7b859e'
                                }}>
                                  {item.type === 'email' ? 'E-mail' : item.type === 'call' ? 'Gesprek' : item.type === 'communication' ? 'Bericht' : 'Notitie'}
                                </span>
                                {item.direction && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                    item.direction === 'inbound' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                                  }`}>
                                    {item.direction === 'inbound' ? 'INKOMEND' : 'UITGAAND'}
                                  </span>
                                )}
                                <span className="text-[10px] ml-auto" style={{ color: '#a4abbe' }}>
                                  {item.date ? new Date(item.date).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>

                              {item.type === 'email' && (
                                <>
                                  <p className="text-sm font-medium" style={{ color: '#011745' }}>{item.subject || '(geen onderwerp)'}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#7b859e' }}>
                                    {item.from_email} → {item.to_email}
                                  </p>
                                  {item.snippet && <p className="text-xs mt-1 line-clamp-2" style={{ color: '#566079' }}>{item.snippet}</p>}
                                </>
                              )}

                              {item.type === 'call' && (
                                <>
                                  <div className="flex items-center gap-3 text-xs" style={{ color: '#566079' }}>
                                    <span>{item.phone_number}</span>
                                    {item.duration_seconds && <span>{Math.floor(item.duration_seconds / 60)}:{String(item.duration_seconds % 60).padStart(2, '0')}</span>}
                                    {item.outcome && (
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                        item.outcome === 'answered' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                      }`}>{item.outcome}</span>
                                    )}
                                  </div>
                                  {item.notes && <p className="text-xs mt-1" style={{ color: '#566079' }}>{item.notes}</p>}
                                  {item.user_name && <p className="text-[10px] mt-1" style={{ color: '#a4abbe' }}>{item.user_name}</p>}
                                </>
                              )}

                              {(item.type === 'communication' || item.type === 'note') && (
                                <>
                                  <p className="text-sm" style={{ color: '#566079' }}>{item.content}</p>
                                  {item.user_name && <p className="text-[10px] mt-1" style={{ color: '#a4abbe' }}>{item.user_name}</p>}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 rounded-lg" style={{ backgroundColor: '#f7f8fc' }}>
                          <MailOpen size={24} className="mx-auto mb-2" style={{ color: '#cdd1e0' }} />
                          <p className="text-sm" style={{ color: '#7b859e' }}>Geen correspondentie gevonden</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Gesprekken Tab ── */}
                  {detailTab === 'gesprekken' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Gesprekshistorie</h3>
                        <button onClick={() => setShowLogForm(v => !v)} className="flex items-center gap-1 text-sm font-medium text-[#3d61a4] hover:text-[#0a2d6b]">
                          <Plus size={15}/> Log gesprek
                        </button>
                      </div>

                      {showLogForm && (
                        <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                          <p className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Nieuw gesprek</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-[#a4abbe] mb-1">Type</label>
                              <select value={convForm.type} onChange={e => setConvForm(f => ({ ...f, type: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4]">
                                <option value="phone">📞 Telefoon</option>
                                <option value="whatsapp">💬 WhatsApp</option>
                                <option value="email">✉ E-mail</option>
                                <option value="meeting">🤝 Meeting</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-[#a4abbe] mb-1">Richting</label>
                              <select value={convForm.direction} onChange={e => setConvForm(f => ({ ...f, direction: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4]">
                                <option value="outbound">↗ Uitgaand</option>
                                <option value="inbound">↙ Inkomend</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-[#a4abbe] mb-1">Duur (minuten)</label>
                              <input type="number" placeholder="5" value={convForm.duration_seconds ? Math.round(convForm.duration_seconds / 60) : ''}
                                onChange={e => setConvForm(f => ({ ...f, duration_seconds: e.target.value ? String(parseInt(e.target.value) * 60) : '' }))}
                                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
                            </div>
                            <div>
                              <label className="block text-xs text-[#a4abbe] mb-1">Uitkomst</label>
                              <input type="text" placeholder="Terugbellen, demo gepland..." value={convForm.outcome}
                                onChange={e => setConvForm(f => ({ ...f, outcome: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-[#a4abbe] mb-1">Samenvatting</label>
                            <textarea rows={3} placeholder="Wat is er besproken?" value={convForm.summary}
                              onChange={e => setConvForm(f => ({ ...f, summary: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3d61a4] resize-none" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleLogClientConversation}
                              className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium hover:bg-[#0a2d6b] transition-colors">
                              Opslaan
                            </button>
                            <button onClick={() => { setShowLogForm(false); setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' }); }}
                              className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm hover:bg-[#cdd1e0] transition-colors">
                              Annuleren
                            </button>
                          </div>
                        </div>
                      )}

                      {convsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin w-6 h-6 border-2 border-[#3d61a4] border-t-transparent rounded-full"/>
                        </div>
                      ) : detailConversations.length === 0 ? (
                        <p className="text-sm text-[#a4abbe] py-4">Nog geen gesprekken gelogd.</p>
                      ) : (
                        <div className="space-y-3">
                          {detailConversations.map(conv => {
                            const isExpanded = expandedConv === conv.id;
                            const typeIcon = conv.type === 'phone' ? '📞' : conv.type === 'whatsapp' ? '💬' : '✉';
                            const durationMin = conv.duration_seconds ? Math.round(conv.duration_seconds / 60) : null;
                            return (
                              <div key={conv.id} className="bg-white rounded-xl border border-[#e8eaf2] overflow-hidden">
                                <div className="flex items-start gap-3 p-4">
                                  <span className="text-xl mt-0.5 cursor-pointer" onClick={() => setExpandedConv(isExpanded ? null : conv.id)}>{typeIcon}</span>
                                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedConv(isExpanded ? null : conv.id)}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-[#011745] capitalize">{conv.type}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eef2fa] text-[#3d61a4]">
                                        {conv.direction === 'inbound' ? '↙ inkomend' : '↗ uitgaand'}
                                      </span>
                                      {conv.outcome && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f8fc] text-[#566079] border border-[#e8eaf2]">{conv.outcome}</span>
                                      )}
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
                                    <button onClick={() => handleDeleteClientConversation(conv.id)} className="p-1 text-[#cdd1e0] hover:text-red-400 transition-colors rounded">
                                      <Trash2 size={13}/>
                                    </button>
                                    <span className="text-[#a4abbe] text-sm cursor-pointer" onClick={() => setExpandedConv(isExpanded ? null : conv.id)}>{isExpanded ? '▲' : '▼'}</span>
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="border-t border-[#e8eaf2] p-4 bg-[#f7f8fc] space-y-3">
                                    {conv.ai_summary && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-[#3d61a4] uppercase tracking-wider mb-1.5">🤖 AI Samenvatting</p>
                                        <p className="text-xs text-[#566079] whitespace-pre-wrap leading-relaxed">{conv.ai_summary}</p>
                                      </div>
                                    )}
                                    {conv.summary && (
                                      <div>
                                        <p className="text-[10px] font-semibold text-[#566079] uppercase tracking-wider mb-1.5">Samenvatting</p>
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

                  {/* ═══ COMMUNICATIE (INTERN) TAB ═══ */}
                  {detailTab === 'communicatie' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Interne Communicatie</h3>
                        <div className="flex gap-2 mb-3">
                          <input type="text" placeholder="Log een communicatie..."
                            value={commText} onChange={e => setCommText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCommunication()}
                            className="flex-1 px-3 py-2 rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-sm"
                            style={{ color: '#566079' }} />
                          <button onClick={addCommunication} disabled={addingComm || !commText.trim()}
                            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                            style={{ backgroundColor: '#3d61a4' }}>
                            {addingComm ? <Loader2 size={14} className="animate-spin" /> : 'Opslaan'}
                          </button>
                        </div>
                        {Array.isArray(communications) && communications.length > 0 ? (
                          <div className="space-y-2">
                            {communications.map((comm, i) => (
                              <div key={comm.id || i} className="p-3 rounded-lg border border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
                                <p className="text-sm" style={{ color: '#566079' }}>{comm.content}</p>
                                <p className="text-[10px] mt-1.5" style={{ color: '#a4abbe' }}>
                                  {comm.user_name && <span className="font-medium">{comm.user_name} — </span>}
                                  {comm.created_at && new Date(comm.created_at).toLocaleString('nl-NL')}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 rounded-lg" style={{ backgroundColor: '#f7f8fc' }}>
                            <MessageSquare size={24} className="mx-auto mb-2" style={{ color: '#cdd1e0' }} />
                            <p className="text-sm" style={{ color: '#7b859e' }}>Nog geen communicatie gelogd</p>
                          </div>
                        )}
                      </div>

                      {Array.isArray(notes) && notes.length > 0 && (
                        <div className="border-t border-[#e8eaf2] pt-4">
                          <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Notities</h4>
                          <div className="space-y-1.5">
                            {notes.map((note, i) => (
                              <div key={note.id || i} className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#f7f8fc', color: '#566079' }}>
                                {note.content}
                                {note.created_at && (
                                  <p className="text-[10px] mt-1" style={{ color: '#a4abbe' }}>
                                    {note.user_name && <span className="font-medium">{note.user_name} — </span>}
                                    {new Date(note.created_at).toLocaleString('nl-NL')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* ═══ CONTACTEN TAB ═══ */}
                  {detailTab === 'contacten' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Contactmethoden</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setFamilyPopup({ leadId: selectedClient.id, contactName: selectedClient.contact_name })}
                            className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg border border-[#e8eaf2] hover:bg-[#eef2fa] transition-colors"
                            style={{ color: '#3d61a4' }}>
                            Familie
                          </button>
                          <button onClick={() => setShowAddContact(v => !v)} className="flex items-center gap-1 text-sm font-medium text-[#3d61a4] hover:text-[#0a2d6b]">
                            <Plus size={15}/> Toevoegen
                          </button>
                        </div>
                      </div>

                      {showAddContact && (
                        <div className="p-4 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] space-y-3">
                          <p className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Nieuw contact</p>
                          <input type="text" placeholder="Naam (optioneel)" value={newContact.name}
                            onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-[#a4abbe] mb-1">✉ E-mail</label>
                              <input type="email" placeholder="naam@bedrijf.nl" value={newContact.email}
                                onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs text-[#a4abbe] mb-1">📱 Mobiel</label>
                              <input type="tel" placeholder="+31 6 12345678" value={newContact.mobile}
                                onChange={e => setNewContact(c => ({ ...c, mobile: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-[#a4abbe] mb-1">💬 WhatsApp <span className="text-[10px]">(optioneel)</span></label>
                            <input type="tel" placeholder="+31 6 12345678" value={newContact.whatsapp}
                              onChange={e => setNewContact(c => ({ ...c, whatsapp: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] bg-white" />
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={newContact.isPrimary} onChange={e => setNewContact(c => ({ ...c, isPrimary: e.target.checked }))} className="rounded" />
                            <span className="text-sm text-[#566079]">Primair contact</span>
                          </label>
                          <div className="flex gap-2">
                            <button onClick={handleAddClientContact}
                              disabled={!newContact.email.trim() && !newContact.mobile.trim() && !newContact.whatsapp.trim()}
                              className="flex-1 px-4 py-2 bg-[#3d61a4] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#0a2d6b] transition-colors">
                              Opslaan
                            </button>
                            <button onClick={() => { setShowAddContact(false); setNewContact({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false }); }}
                              className="px-4 py-2 bg-[#e8eaf2] text-[#566079] rounded-lg text-sm hover:bg-[#cdd1e0] transition-colors">
                              Annuleren
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Primary contact from lead — always shown if data exists */}
                      {(selectedClient?.contact_name || selectedClient?.contact_email || selectedClient?.contact_phone || selectedClient?.contact_mobile) && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-semibold text-[#a4abbe] uppercase tracking-wider">Primair contact</p>
                            <button
                              onClick={() => {
                                setEditingClientInfo(true);
                                setClientInfoEdits({
                                  company_name: selectedClient?.company_name || '',
                                  company_country: selectedClient?.company_country || '',
                                  company_industry: selectedClient?.company_industry || '',
                                  company_website: selectedClient?.company_website || '',
                                  company_size: selectedClient?.company_size || '',
                                  contact_name: selectedClient?.contact_name || '',
                                  contact_email: selectedClient?.contact_email || '',
                                  contact_phone: selectedClient?.contact_phone || '',
                                  contact_mobile: selectedClient?.contact_mobile || '',
                                  contact_position: selectedClient?.contact_position || '',
                                });
                              }}
                              className="flex items-center gap-1 text-[10px] font-medium transition-colors hover:text-[#011745]"
                              style={{ color: '#3d61a4' }}>
                              <Edit3 size={10} /> Bewerken
                            </button>
                          </div>
                          <div className="p-4 bg-[#eef2fa] rounded-xl border border-[#5a7fc2]/20">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: '#3d61a4' }}>
                                {(selectedClient.contact_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                {selectedClient.contact_name && (
                                  <p className="text-sm font-semibold text-[#011745]">{selectedClient.contact_name}</p>
                                )}
                                {selectedClient.contact_position && (
                                  <p className="text-xs text-[#566079]">{selectedClient.contact_position}</p>
                                )}
                                {selectedClient.contact_email && (
                                  <a href={`mailto:${selectedClient.contact_email}`} className="flex items-center gap-1.5 text-xs text-[#3d61a4] hover:underline">
                                    ✉ {selectedClient.contact_email}
                                  </a>
                                )}
                                {(selectedClient.contact_mobile || selectedClient.contact_phone) && (
                                  <a href={`tel:${selectedClient.contact_mobile || selectedClient.contact_phone}`} className="flex items-center gap-1.5 text-xs text-[#00c875] hover:underline">
                                    📱 {selectedClient.contact_mobile || selectedClient.contact_phone}
                                  </a>
                                )}
                              </div>
                              <span className="text-xs px-2 py-0.5 bg-white text-[#3d61a4] rounded-full font-medium border border-[#5a7fc2]/30">★ Primair</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Additional contact methods */}
                      {detailContactMethods.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-[#a4abbe] uppercase tracking-wider mb-2">Extra contacten</p>
                          <div className="space-y-2">
                            {detailContactMethods.map(m => (
                              <div key={m.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e8eaf2]">
                                <span className="text-base">{m.type === 'email' ? '✉' : m.type === 'phone' ? '📞' : '💬'}</span>
                                <div className="flex-1 min-w-0">
                                  {m.label && <p className="text-xs font-semibold text-[#011745]">{m.label}</p>}
                                  <p className="text-sm text-[#566079] truncate">{m.value}</p>
                                </div>
                                {m.is_primary && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">★ primair</span>}
                                {!m.is_primary && (
                                  <button onClick={() => handleSetPrimaryClientContact(m.id)} className="text-[10px] text-[#a4abbe] hover:text-amber-500 transition-colors">
                                    Primair
                                  </button>
                                )}
                                <button onClick={() => handleDeleteClientContact(m.id)} className="p-1 text-[#cdd1e0] hover:text-red-400 transition-colors rounded">
                                  <Trash2 size={14}/>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!selectedClient?.contact_name && !selectedClient?.contact_email && detailContactMethods.length === 0 && (
                        <div className="text-center py-6">
                          <p className="text-sm text-[#7b859e]">Nog geen contacten toegevoegd.</p>
                        </div>
                      )}

                      {familyPopup && (
                        <ContactFamilyPopup
                          leadId={familyPopup.leadId}
                          contactName={familyPopup.contactName}
                          onClose={() => setFamilyPopup(null)}
                        />
                      )}
                    </div>
                  )}

                  {/* ═══ TAPERPAY TAB ═══ */}
                  {detailTab === 'taperpay' && (
                    <div className="p-6 space-y-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#eef2fa' }}>
                            <CreditCard size={16} style={{ color: '#3d61a4' }} />
                          </div>
                          <h3 className="text-base font-bold" style={{ color: '#011745' }}>TaperPay — FX & Betalingen</h3>
                        </div>
                        {editingPricing === 'taperpay' ? (
                          <div className="flex gap-2">
                            <button onClick={savePricingEdits} disabled={savingPricing}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                              style={{ backgroundColor: '#3d61a4' }}>
                              {savingPricing ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Opslaan
                            </button>
                            <button onClick={() => setEditingPricing(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e8eaf2] text-[#566079]">
                              Annuleren
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => {
                            setEditingPricing('taperpay');
                            setPricingEdits({
                              taperpay_active: pd?.taperpay_active ?? false,
                              fx_spot_spread_pct: pd?.fx_spot_spread_pct ?? '',
                              fx_forward_margin_pct: pd?.fx_forward_margin_pct ?? '',
                              credit_limit_eur: pd?.credit_limit_eur ?? '',
                              min_deal_size_eur: pd?.min_deal_size_eur ?? '',
                              pricing_notes: pd?.pricing_notes ?? '',
                            });
                          }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[#f7f8fc]"
                            style={{ borderColor: '#e8eaf2', color: '#566079' }}>
                            <Edit3 size={12} /> Bewerken
                          </button>
                        )}
                      </div>

                      {editingPricing === 'taperpay' ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-[#e8eaf2] bg-[#f7f8fc]">
                              <input type="checkbox"
                                checked={!!pricingEdits.taperpay_active}
                                onChange={e => setPricingEdits(p => ({ ...p, taperpay_active: e.target.checked }))}
                                className="accent-[#3d61a4] w-4 h-4" />
                              <span className="text-sm font-medium" style={{ color: '#011745' }}>TaperPay Actief</span>
                              <span className="text-xs" style={{ color: '#7b859e' }}>Schakel in om TaperPay voor deze klant te activeren</span>
                            </label>
                          </div>
                          {[
                            { label: 'Spot Spread (%)', key: 'fx_spot_spread_pct', placeholder: '0.25' },
                            { label: 'Forward Margin (%)', key: 'fx_forward_margin_pct', placeholder: '0.35' },
                            { label: 'Credit Limit (€)', key: 'credit_limit_eur', placeholder: '500000' },
                            { label: 'Min. Deal Size (€)', key: 'min_deal_size_eur', placeholder: '10000' },
                          ].map(({ label, key, placeholder }) => (
                            <div key={key}>
                              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>{label}</label>
                              <input
                                type="number"
                                step="any"
                                value={pricingEdits[key] ?? ''}
                                onChange={e => setPricingEdits(p => ({ ...p, [key]: e.target.value }))}
                                placeholder={placeholder}
                                className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]"
                              />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Pricing Notities</label>
                            <textarea
                              value={pricingEdits.pricing_notes ?? ''}
                              onChange={e => setPricingEdits(p => ({ ...p, pricing_notes: e.target.value }))}
                              rows={3}
                              className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] resize-none"
                              placeholder="Notities over pricing..."
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: 'Spot Spread (%)', value: pd?.fx_spot_spread_pct != null ? `${pd.fx_spot_spread_pct}%` : '—' },
                              { label: 'Forward Margin (%)', value: pd?.fx_forward_margin_pct != null ? `${pd.fx_forward_margin_pct}%` : '—' },
                              { label: 'Credit Limit', value: pd?.credit_limit_eur != null ? `€${Number(pd.credit_limit_eur).toLocaleString('nl-NL')}` : '—' },
                              { label: 'Min. Deal Size', value: pd?.min_deal_size_eur != null ? `€${Number(pd.min_deal_size_eur).toLocaleString('nl-NL')}` : '—' },
                            ].map(({ label, value }) => (
                              <div key={label} className="p-4 rounded-xl border border-[#e8eaf2] bg-white">
                                <p className="text-xs font-medium mb-1" style={{ color: '#7b859e' }}>{label}</p>
                                <p className="text-lg font-bold" style={{ color: '#011745' }}>{value}</p>
                              </div>
                            ))}
                          </div>
                          {pd?.pricing_notes && (
                            <div className="p-4 rounded-xl border border-[#e8eaf2] bg-[#f7f8fc]">
                              <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Pricing Notities</p>
                              <p className="text-sm" style={{ color: '#566079' }}>{pd.pricing_notes}</p>
                            </div>
                          )}
                        </>
                      )}
                      {/* Revenue Potentie */}
                      {(() => {
                        const rows = selectedClient?.revenue_potential;
                        if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
                        const total = rows.reduce((s, r) => s + (parseFloat(r.revenue) || 0), 0);
                        return (
                          <div>
                            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#7b859e' }}>Revenue Potentie (uit lead fase)</p>
                            <div className="rounded-xl border border-[#e8eaf2] overflow-hidden">
                              <table className="w-full text-sm">
                                <thead><tr style={{ backgroundColor: '#f7f8fc' }}>
                                  {['Valutapaar', 'Volume (€)', 'Marge %', 'Revenue (€)'].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#566079' }}>{h}</th>
                                  ))}
                                </tr></thead>
                                <tbody>
                                  {rows.map((r, i) => (
                                    <tr key={i} className="border-t border-[#f7f8fc]">
                                      <td className="px-4 py-2 font-mono font-medium" style={{ color: '#011745' }}>{r.pair || '—'}</td>
                                      <td className="px-4 py-2" style={{ color: '#566079' }}>{r.volume ? `€${Number(r.volume).toLocaleString('nl-NL')}` : '—'}</td>
                                      <td className="px-4 py-2" style={{ color: '#566079' }}>{r.margin ? `${r.margin}%` : '—'}</td>
                                      <td className="px-4 py-2 font-semibold" style={{ color: '#3d61a4' }}>{r.revenue ? `€${Number(r.revenue).toLocaleString('nl-NL')}` : '—'}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t-2 border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
                                    <td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase" style={{ color: '#566079' }}>Totaal</td>
                                    <td className="px-4 py-2 font-bold" style={{ color: '#011745' }}>€{total.toLocaleString('nl-NL')}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Compliance & contract datums */}
                      {(pd?.contract_signed_date || pd?.cdd_next_review_date || pd?.pep_cleared != null) && (
                        <div>
                          <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#7b859e' }}>Compliance</p>
                          <div className="grid grid-cols-2 gap-3">
                            {pd?.contract_signed_date && (
                              <div className="p-3 rounded-xl border border-[#e8eaf2] bg-white">
                                <p className="text-xs font-medium mb-1" style={{ color: '#7b859e' }}>Contract getekend</p>
                                <p className="text-sm font-bold" style={{ color: '#011745' }}>{new Date(pd.contract_signed_date).toLocaleDateString('nl-NL')}</p>
                              </div>
                            )}
                            {pd?.cdd_next_review_date && (
                              <div className="p-3 rounded-xl border border-[#e8eaf2] bg-white">
                                <p className="text-xs font-medium mb-1" style={{ color: '#7b859e' }}>Volgende CDD review</p>
                                <p className="text-sm font-bold" style={{ color: new Date(pd.cdd_next_review_date) < new Date() ? '#dc2626' : '#011745' }}>
                                  {new Date(pd.cdd_next_review_date).toLocaleDateString('nl-NL')}
                                </p>
                              </div>
                            )}
                            <div className="p-3 rounded-xl border border-[#e8eaf2] bg-white flex items-center gap-2">
                              <span style={{ color: pd?.pep_cleared ? '#16a34a' : '#a4abbe', fontSize: 16 }}>{pd?.pep_cleared ? '✓' : '○'}</span>
                              <div>
                                <p className="text-xs font-medium" style={{ color: '#7b859e' }}>PEP screening</p>
                                <p className="text-xs font-bold" style={{ color: pd?.pep_cleared ? '#16a34a' : '#566079' }}>{pd?.pep_cleared ? 'Gecleard' : 'Niet gecleard'}</p>
                              </div>
                            </div>
                            <div className="p-3 rounded-xl border border-[#e8eaf2] bg-white flex items-center gap-2">
                              <span style={{ color: pd?.sanctions_cleared ? '#16a34a' : '#a4abbe', fontSize: 16 }}>{pd?.sanctions_cleared ? '✓' : '○'}</span>
                              <div>
                                <p className="text-xs font-medium" style={{ color: '#7b859e' }}>Sanctielijst check</p>
                                <p className="text-xs font-bold" style={{ color: pd?.sanctions_cleared ? '#16a34a' : '#566079' }}>{pd?.sanctions_cleared ? 'Gecleard' : 'Niet gecleard'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Broker integratie */}
                      {(pd?.broker_account_id || pd?.iban_issued_at) && (
                        <div>
                          <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#7b859e' }}>Broker koppeling</p>
                          <div className="grid grid-cols-2 gap-3">
                            {pd?.broker_account_id && (
                              <div className="p-3 rounded-xl border border-[#e8eaf2] bg-white">
                                <p className="text-xs font-medium mb-1" style={{ color: '#7b859e' }}>Broker account ID</p>
                                <p className="text-sm font-mono font-bold" style={{ color: '#011745' }}>{pd.broker_account_id}</p>
                              </div>
                            )}
                            {pd?.iban_issued_at && (
                              <div className="p-3 rounded-xl border border-[#e8eaf2] bg-white">
                                <p className="text-xs font-medium mb-1" style={{ color: '#7b859e' }}>IBAN uitgegeven</p>
                                <p className="text-sm font-bold" style={{ color: '#011745' }}>{new Date(pd.iban_issued_at).toLocaleDateString('nl-NL')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ TAPERTRADE TAB ═══ */}
                  {detailTab === 'tapertrade' && (
                    <div className="p-6 space-y-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
                            <Truck size={16} style={{ color: '#16a34a' }} />
                          </div>
                          <h3 className="text-base font-bold" style={{ color: '#011745' }}>TaperTrade — Trade Finance</h3>
                        </div>
                        {editingPricing === 'tapertrade' ? (
                          <div className="flex gap-2">
                            <button onClick={savePricingEdits} disabled={savingPricing}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                              style={{ backgroundColor: '#16a34a' }}>
                              {savingPricing ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Opslaan
                            </button>
                            <button onClick={() => setEditingPricing(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e8eaf2] text-[#566079]">
                              Annuleren
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => {
                            setEditingPricing('tapertrade');
                            setPricingEdits({
                              tf_interest_rate_pct: pd?.tf_interest_rate_pct ?? '',
                              tf_fee_pct: pd?.tf_fee_pct ?? '',
                              tf_closing_fee_pct: pd?.tf_closing_fee_pct ?? '',
                              payment_terms_days: pd?.payment_terms_days ?? '',
                              tapertrade_active: pd?.tapertrade_active ?? false,
                            });
                          }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[#f7f8fc]"
                            style={{ borderColor: '#e8eaf2', color: '#566079' }}>
                            <Edit3 size={12} /> Bewerken
                          </button>
                        )}
                      </div>

                      {editingPricing === 'tapertrade' ? (
                        <div className="space-y-4">
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-[#e8eaf2] bg-[#f7f8fc]">
                            <input
                              type="checkbox"
                              checked={!!pricingEdits.tapertrade_active}
                              onChange={e => setPricingEdits(p => ({ ...p, tapertrade_active: e.target.checked }))}
                              className="rounded"
                            />
                            <span className="text-sm font-medium" style={{ color: '#011745' }}>TaperTrade actief voor deze klant</span>
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: 'Rente (%)', key: 'tf_interest_rate_pct', placeholder: '6.5' },
                              { label: 'Arrangement Fee (%)', key: 'tf_fee_pct', placeholder: '1.0' },
                              { label: 'Afsluitprovisie (%)', key: 'tf_closing_fee_pct', placeholder: '0.5' },
                              { label: 'Betaaltermijn (dagen)', key: 'payment_terms_days', placeholder: '90' },
                            ].map(({ label, key, placeholder }) => (
                              <div key={key}>
                                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>{label}</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={pricingEdits[key] ?? ''}
                                  onChange={e => setPricingEdits(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder={placeholder}
                                  className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : pd?.tapertrade_active ? (
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Rente (%)', value: pd?.tf_interest_rate_pct != null ? `${pd.tf_interest_rate_pct}%` : '—' },
                            { label: 'Arrangement Fee (%)', value: pd?.tf_fee_pct != null ? `${pd.tf_fee_pct}%` : '—' },
                            { label: 'Afsluitprovisie (%)', value: pd?.tf_closing_fee_pct != null ? `${pd.tf_closing_fee_pct}%` : '—' },
                            { label: 'Betaaltermijn (dagen)', value: pd?.payment_terms_days != null ? `${pd.payment_terms_days} dagen` : '—' },
                          ].map(({ label, value }) => (
                            <div key={label} className="p-4 rounded-xl border border-[#e8eaf2] bg-white">
                              <p className="text-xs font-medium mb-1" style={{ color: '#7b859e' }}>{label}</p>
                              <p className="text-lg font-bold" style={{ color: '#011745' }}>{value}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <Truck size={32} className="mx-auto mb-3 opacity-30" style={{ color: '#a4abbe' }} />
                          <p className="text-sm font-medium" style={{ color: '#566079' }}>TaperTrade niet actief</p>
                          <p className="text-xs mt-1 mb-4" style={{ color: '#a4abbe' }}>Klik op "Bewerken" om TaperTrade te activeren voor deze klant</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ BEDRIJFSINFO TAB ═══ */}
                  {detailTab === 'bedrijfsinfo' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Bedrijfsinformatie</h3>
                        <div className="flex items-center gap-2">
                          <button onClick={handleClientReEnrich} disabled={clientEnriching}
                            className="flex items-center gap-2 text-[#3d61a4] hover:text-[#0a2d6b] font-medium text-xs disabled:opacity-50">
                            {clientEnriching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Verrijk met AI
                          </button>
                          <button
                            onClick={() => {
                              setEditingClientInfo(true);
                              setClientInfoEdits({
                                company_name: selectedClient?.company_name || '',
                                company_country: selectedClient?.company_country || '',
                                company_industry: selectedClient?.company_industry || '',
                                company_website: selectedClient?.company_website || '',
                                company_size: selectedClient?.company_size || '',
                                contact_name: selectedClient?.contact_name || '',
                                contact_email: selectedClient?.contact_email || '',
                                contact_phone: selectedClient?.contact_phone || '',
                                contact_mobile: selectedClient?.contact_mobile || '',
                                contact_position: selectedClient?.contact_position || '',
                              });
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[#f7f8fc]"
                            style={{ color: '#566079', borderColor: '#e8eaf2' }}>
                            ✏ Edit
                          </button>
                        </div>
                      </div>
                      {clientEnriching && !clientEnrichment ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                          <Loader2 size={24} className="animate-spin" style={{ color: '#3d61a4' }} />
                          <p className="text-sm" style={{ color: '#566079' }}>Bedrijfsdata ophalen via website & AI...</p>
                        </div>
                      ) : !clientEnrichment || (!clientEnrichment.description && clientEnrichment.fit_score == null) ? (
                        <div className="text-center py-8 space-y-2">
                          <div className="w-10 h-10 rounded-full bg-[#eef2fa] flex items-center justify-center mx-auto">
                            <Zap size={18} style={{ color: '#3d61a4' }} />
                          </div>
                          <p className="text-sm" style={{ color: '#566079' }}>Geen bedrijfsanalyse beschikbaar.</p>
                          <p className="text-xs" style={{ color: '#a4abbe' }}>Klik op "Verrijk met AI" om een volledig profiel op te halen.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {clientEnrichment.fit_score != null && (
                            <div className="rounded-xl p-4 flex items-start gap-3" style={{
                              background: clientEnrichment.fit_score >= 7 ? 'linear-gradient(135deg, #011745, #0a2d6b)'
                                : clientEnrichment.fit_score >= 4 ? 'linear-gradient(135deg, #78350f, #b45309)'
                                : 'linear-gradient(135deg, #7f1d1d, #b91c1c)'
                            }}>
                              <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-white/15 flex-shrink-0">
                                <span className="text-xl font-bold text-white leading-none">{clientEnrichment.fit_score}</span>
                                <span className="text-[9px] text-white/70">/10</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-0.5">Taper Fit Score</p>
                                <p className="text-sm text-white font-medium leading-snug">{clientEnrichment.fit_reason || '—'}</p>
                                {clientEnrichment.taper_fit_products?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {clientEnrichment.taper_fit_products.map((p, i) => (
                                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">{p}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {clientEnrichment.description && (
                            <div className="bg-[#f7f8fc] rounded-xl p-4 border border-[#e8eaf2]">
                              <p className="text-[10px] font-semibold uppercase text-[#7b859e] mb-1.5">Over het bedrijf</p>
                              <p className="text-sm leading-relaxed" style={{ color: '#566079' }}>{clientEnrichment.description}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ['Industrie', clientEnrichment.industry],
                              ['Bedrijfsgrootte', clientEnrichment.company_size],
                              ['Opgericht', clientEnrichment.founding_year],
                              ['Hoofdkantoor', clientEnrichment.headquarters],
                              ['Geschatte omzet', clientEnrichment.annual_revenue_estimate],
                              ['KVK', clientEnrichment.kvk],
                              ['Land', clientEnrichment.country],
                              ['Telefoon', clientEnrichment.phone],
                            ].filter(([, v]) => v).map(([label, val]) => (
                              <div key={label} className="p-2.5 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2]">
                                <p className="text-[10px] font-semibold uppercase text-[#a4abbe] mb-0.5">{label}</p>
                                <p className="text-xs font-medium text-[#011745] truncate">{val}</p>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5">
                            {clientEnrichment.website && (
                              <a href={clientEnrichment.website.startsWith('http') ? clientEnrichment.website : `https://${clientEnrichment.website}`}
                                target="_blank" rel="noreferrer"
                                className="flex items-center justify-between p-2.5 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2] hover:border-[#3d61a4] transition-colors group">
                                <span className="text-[11px] text-[#7b859e]">Website</span>
                                <span className="text-xs text-[#3d61a4] font-medium flex items-center gap-1 group-hover:underline">
                                  {clientEnrichment.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} <ExternalLink size={10} />
                                </span>
                              </a>
                            )}
                            {clientEnrichment.linkedin && (
                              <a href={clientEnrichment.linkedin.startsWith('http') ? clientEnrichment.linkedin : `https://${clientEnrichment.linkedin}`}
                                target="_blank" rel="noreferrer"
                                className="flex items-center justify-between p-2.5 rounded-lg bg-[#f7f8fc] border border-[#e8eaf2] hover:border-[#3d61a4] transition-colors group">
                                <span className="text-[11px] text-[#7b859e]">LinkedIn</span>
                                <span className="text-xs text-[#3d61a4] font-medium flex items-center gap-1 group-hover:underline">LinkedIn profiel <ExternalLink size={10} /></span>
                              </a>
                            )}
                          </div>
                          {clientEnrichment.fx_relevance && (
                            <div className="p-3 rounded-xl bg-[#eef2fa] border border-[#c7d4ef]">
                              <p className="text-[10px] font-semibold uppercase text-[#3d61a4] mb-1">FX / Betalingsbehoefte</p>
                              <p className="text-sm" style={{ color: '#566079' }}>{clientEnrichment.fx_relevance}</p>
                            </div>
                          )}
                          {clientEnrichment.pain_points?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-[#7b859e] mb-1.5">Financiële pijnpunten</p>
                              {clientEnrichment.pain_points.map((pp, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-[#566079] mb-1">
                                  <span className="text-amber-500 flex-shrink-0">⚡</span><span>{pp}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {clientEnrichment.business_segments?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-[#7b859e] mb-1.5">Zakelijke segmenten</p>
                              <div className="flex flex-wrap gap-1">
                                {clientEnrichment.business_segments.map((seg, i) => (
                                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-lg bg-[#eef2fa] text-[#3d61a4] font-medium">{seg}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {clientEnrichment.enriched_at && (
                            <p className="text-[10px] text-[#a4abbe] text-right">
                              Verrijkt op {new Date(clientEnrichment.enriched_at).toLocaleString('nl-NL')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ BEDRIJFSINFO EDIT MODAL ═══ */}
      {editingClientInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-bold text-[#011745] mb-6">Bedrijfsinfo bewerken</h2>
            <div className="space-y-4">
              {[
                ['Bedrijfsnaam', 'company_name'],
                ['Website', 'company_website'],
                ['Land', 'company_country'],
                ['Industrie', 'company_industry'],
                ['Bedrijfsgrootte', 'company_size'],
                ['Contactpersoon', 'contact_name'],
                ['Functie', 'contact_position'],
                ['Email', 'contact_email'],
                ['Telefoon', 'contact_phone'],
                ['Mobiel', 'contact_mobile'],
              ].map(([label, field]) => (
                <div key={field}>
                  <label className="text-xs font-medium text-[#566079] mb-1 block">{label}</label>
                  <input
                    value={clientInfoEdits[field] || ''}
                    onChange={e => setClientInfoEdits(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full border border-[#e8eaf2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  try {
                    const t = sessionStorage.getItem('auth_token');
                    await fetch(`/api/v1/leads/${selectedClient.id}`, {
                      method: 'PUT',
                      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify(clientInfoEdits),
                    });
                    setEditingClientInfo(false);
                    if (typeof fetchClients === 'function') fetchClients();
                  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-white font-medium text-sm"
                style={{ backgroundColor: '#011745' }}>
                Opslaan
              </button>
              <button
                onClick={() => setEditingClientInfo(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm border border-[#e8eaf2] text-[#566079]">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
