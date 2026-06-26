import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Building2,
  FileUp,
  Search,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  Trash2,
  Globe,
  Phone,
  Mail,
  User,
  MapPin,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

/**
 * NewLeadModal – Popup voor het toevoegen van nieuwe leads.
 *
 * Twee opties:
 * 1. Handmatig toevoegen – bedrijfsnaam zoeken → adresgegevens auto-scrapen
 * 2. Document uploaden – drag & drop → Claude Sonnet scant en extraheert leads
 */
const NewLeadModal = ({ isOpen, onClose, onLeadCreated }) => {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'document'

  // ─── Manual entry state ─────────────────────────────
  const [companySearch, setCompanySearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichedData, setEnrichedData] = useState(null);
  const [manualForm, setManualForm] = useState({
    company_name: '',
    company_website: '',
    company_country: '',
    company_industry: '',
    kvk_number: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_mobile: '',
    contact_position: '',
    priority: 'cold',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [existingLeads, setExistingLeads] = useState([]); // Real-time dup check results

  // ─── Document upload state ──────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [detectedLeads, setDetectedLeads] = useState([]);
  const [leadImportStatus, setLeadImportStatus] = useState({}); // { index: 'importing'|'success'|'duplicate'|'error' }
  const [scanError, setScanError] = useState('');

  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('manual');
      resetManualForm();
      resetDocumentUpload();
    }
  }, [isOpen]);

  const resetManualForm = () => {
    setCompanySearch('');
    setSearchResults([]);
    setSelectedCompany(null);
    setEnrichedData(null);
    setManualForm({
      company_name: '', company_website: '', company_country: '',
      company_industry: '', kvk_number: '', contact_name: '',
      contact_email: '', contact_phone: '', contact_mobile: '',
      contact_position: '', priority: 'cold',
    });
    setSaveError('');
    setDuplicateWarning(null);
  };

  const resetDocumentUpload = () => {
    setUploadedFile(null);
    setDetectedLeads([]);
    setLeadImportStatus({});
    setScanError('');
  };

  // ─── Company Search (debounced) ─────────────────────
  const handleCompanySearch = (value) => {
    setCompanySearch(value);
    setSelectedCompany(null);
    setEnrichedData(null);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      // Real-time duplicate check — search ALL existing leads
      try {
        const token = sessionStorage.getItem('auth_token');
        const dupResp = await fetch(`/api/v1/leads/?search=${encodeURIComponent(value)}&page_size=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dupResp.ok) {
          const dupData = await dupResp.json();
          setExistingLeads(dupData.leads || []);
        }
      } catch {}

      try {
        const token = sessionStorage.getItem('auth_token');
        const resp = await fetch(`/api/v1/ai/company-lookup?query=${encodeURIComponent(value)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setSearchResults(data.results || []);
        } else {
          // Fallback: just set the typed name as an option
          setSearchResults([{
            company_name: value,
            address: '',
            kvk_number: '',
            website: '',
            source: 'manual',
          }]);
        }
      } catch (err) {
        // If endpoint doesn't exist yet, allow manual entry
        setSearchResults([{
          company_name: value,
          address: '',
          kvk_number: '',
          website: '',
          source: 'manual',
        }]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  // ─── Select company from search ─────────────────────
  const handleSelectCompany = async (company) => {
    setSelectedCompany(company);
    setSearchResults([]);
    setCompanySearch(company.company_name);

    // Pre-fill form with data from Google Places (or other source)
    setManualForm((prev) => ({
      ...prev,
      company_name: company.company_name || '',
      company_website: company.website || '',
      company_country: company.country || '',
      company_industry: company.industry || '',
      kvk_number: company.kvk_number || '',
      contact_phone: company.phone || '',
    }));

    // Auto-enrich: use place_id + website scraping + Claude
    if (company.company_name.length > 2) {
      setEnriching(true);
      try {
        const token = sessionStorage.getItem('auth_token');
        const resp = await fetch(`/api/v1/ai/company-enrich`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_name: company.company_name,
            website: company.website,
            place_id: company.place_id || null,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setEnrichedData(data);
          // Update form with enriched data (don't overwrite user-visible Google data)
          setManualForm((prev) => ({
            ...prev,
            company_website: data.website || prev.company_website,
            company_country: data.country || prev.company_country,
            company_industry: data.industry || prev.company_industry,
            kvk_number: data.kvk_number || prev.kvk_number,
            contact_phone: data.phone || prev.contact_phone,
            contact_email: (data.contact_emails && data.contact_emails.find(e => e && e.includes('@'))) || prev.contact_email,
          }));
        }
      } catch (err) {
        console.log('Enrichment not available:', err);
      } finally {
        setEnriching(false);
      }
    }
  };

  // ─── Save lead manually ─────────────────────────────
  const handleSaveLead = async () => {
    if (!manualForm.company_name.trim()) {
      setSaveError('Bedrijfsnaam is verplicht');
      return;
    }

    setSaving(true);
    setSaveError('');
    setDuplicateWarning(null);

    try {
      const token = sessionStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/leads/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(manualForm),
      });

      if (resp.status === 409) {
        const data = await resp.json();
        setDuplicateWarning(data.detail);
        setSaving(false);
        return;
      }

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || 'Opslaan mislukt');
      }

      const newLead = await resp.json();

      // If we have enriched data, trigger full AI enrichment
      if (newLead.id) {
        fetch(`/api/v1/ai/enrich-lead/${newLead.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {}); // Fire and forget
      }

      onLeadCreated?.(newLead);
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Er ging iets mis bij het opslaan');
    } finally {
      setSaving(false);
    }
  };

  // ─── Document drag & drop ───────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  }, []);

  const handleFileSelected = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/png',
      'image/jpeg',
      'text/csv',
    ];
    const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.csv'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      setScanError('Ongeldig bestandstype. Upload een PDF, Excel, CSV of afbeelding.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setScanError('Bestand is te groot (max 50MB).');
      return;
    }

    setUploadedFile(file);
    setScanError('');
    setDetectedLeads([]);
  };

  // ─── Scan document with Claude ──────────────────────
  const handleScanDocument = async () => {
    if (!uploadedFile) return;

    setScanning(true);
    setScanError('');
    setDetectedLeads([]);

    try {
      const token = sessionStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const resp = await fetch('/api/v1/ai/import-leads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || 'Scan mislukt');
      }

      const data = await resp.json();
      setDetectedLeads(data.detected_leads || []);
      setLeadImportStatus({});
    } catch (err) {
      setScanError(err.message || 'Er ging iets mis bij het scannen');
    } finally {
      setScanning(false);
    }
  };

  // ─── Import single lead from scan results ───────────
  const handleImportSingleLead = async (lead, index) => {
    setLeadImportStatus((prev) => ({ ...prev, [index]: 'importing' }));
    try {
      const token = sessionStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/leads/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: lead.company_name,
          contact_name: lead.contact_name,
          contact_email: lead.contact_email,
          contact_phone: lead.contact_phone,
          contact_mobile: lead.contact_mobile,
          contact_position: lead.contact_position,
          company_country: lead.company_country,
          company_website: lead.company_website,
          company_industry: lead.company_industry,
          kvk_number: lead.kvk_number,
          priority: 'cold',
        }),
      });

      if (resp.ok) {
        setLeadImportStatus((prev) => ({ ...prev, [index]: 'success' }));
        onLeadCreated?.({ imported: 1 });
      } else if (resp.status === 409) {
        setLeadImportStatus((prev) => ({ ...prev, [index]: 'duplicate' }));
      } else {
        setLeadImportStatus((prev) => ({ ...prev, [index]: 'error' }));
      }
    } catch (err) {
      setLeadImportStatus((prev) => ({ ...prev, [index]: 'error' }));
    }
  };

  // ─── Import all detected leads ─────────────────────
  const handleImportAllLeads = async () => {
    for (let i = 0; i < detectedLeads.length; i++) {
      if (!leadImportStatus[i] || leadImportStatus[i] === 'error') {
        await handleImportSingleLead(detectedLeads[i], i);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#f7f8fc' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{ backgroundColor: '#011745', borderColor: '#0a2d6b' }}
        >
          <div className="flex items-center gap-3">
            <Plus size={22} className="text-white" />
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
              Nieuwe Lead Toevoegen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: '#e8eaf2' }}>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold transition-all ${
              activeTab === 'manual'
                ? 'border-b-2 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            style={
              activeTab === 'manual'
                ? { borderColor: '#3d61a4', backgroundColor: '#3d61a4', color: 'white' }
                : {}
            }
          >
            <Building2 size={18} />
            Handmatig Toevoegen
          </button>
          <button
            onClick={() => setActiveTab('document')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold transition-all ${
              activeTab === 'document'
                ? 'border-b-2 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            style={
              activeTab === 'document'
                ? { borderColor: '#3d61a4', backgroundColor: '#3d61a4', color: 'white' }
                : {}
            }
          >
            <FileUp size={18} />
            Document Uploaden
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'manual' ? (
            <ManualEntryTab
              companySearch={companySearch}
              onCompanySearch={handleCompanySearch}
              searchResults={searchResults}
              searching={searching}
              selectedCompany={selectedCompany}
              onSelectCompany={handleSelectCompany}
              enriching={enriching}
              enrichedData={enrichedData}
              form={manualForm}
              onFormChange={(field, value) => setManualForm((prev) => ({ ...prev, [field]: value }))}
              saveError={saveError}
              duplicateWarning={duplicateWarning}
              existingLeads={existingLeads}
              saving={saving}
              onSave={handleSaveLead}
            />
          ) : (
            <DocumentUploadTab
              dragOver={dragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              fileInputRef={fileInputRef}
              onFileSelected={handleFileSelected}
              uploadedFile={uploadedFile}
              onRemoveFile={() => { setUploadedFile(null); setDetectedLeads([]); setScanError(''); setLeadImportStatus({}); }}
              scanning={scanning}
              onScan={handleScanDocument}
              detectedLeads={detectedLeads}
              leadImportStatus={leadImportStatus}
              onImportSingle={handleImportSingleLead}
              onImportAll={handleImportAllLeads}
              scanError={scanError}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// TAB 1: Handmatig toevoegen
// ═══════════════════════════════════════════════════════
const ManualEntryTab = ({
  companySearch, onCompanySearch, searchResults, searching,
  selectedCompany, onSelectCompany, enriching, enrichedData,
  form, onFormChange, saveError, duplicateWarning, existingLeads, saving, onSave,
}) => {
  return (
    <div className="space-y-5">
      {/* Existing leads duplicate warning */}
      {existingLeads?.length > 0 && companySearch.length > 1 && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-800">Mogelijke duplicaten gevonden</p>
          </div>
          <div className="space-y-1">
            {existingLeads.slice(0, 3).map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1.5">
                <span className="font-medium text-amber-900">{l.company_name || l.company}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  l.is_locked ? 'bg-[#011745] text-white' : 'bg-[#eef2fa] text-[#3d61a4]'
                }`}>{l.pipeline_stage || l._raw?.pipeline_stage || 'lead'} {l.is_locked || l._raw?.is_locked ? '🔒' : ''}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-700 mt-1.5">Controleer of dit al een bestaande lead is voor je verdergaat.</p>
        </div>
      )}
      {/* Company search */}
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#011745' }}>
          Bedrijfsnaam zoeken *
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={companySearch}
            onChange={(e) => onCompanySearch(e.target.value)}
            placeholder="Typ een bedrijfsnaam om te zoeken..."
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2"
            style={{ borderColor: '#cdd1e0', '--tw-ring-color': '#3d61a4' }}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={18} className="animate-spin" style={{ color: '#3d61a4' }} />
            </div>
          )}
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && !selectedCompany && (
          <div
            className="mt-1 rounded-lg border shadow-lg overflow-hidden max-h-72 overflow-y-auto"
            style={{ backgroundColor: 'white', borderColor: '#e8eaf2' }}
          >
            {searchResults.map((result, i) => (
              <button
                key={i}
                onClick={() => onSelectCompany(result)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b last:border-b-0 flex items-start gap-3"
                style={{ borderColor: '#f3f4f8' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: result.source === 'google_places' ? '#eef2fa' : '#f3f4f8' }}
                >
                  {result.source === 'google_places' ? (
                    <MapPin size={14} style={{ color: '#3d61a4' }} />
                  ) : (
                    <Building2 size={14} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#011745' }}>
                    {result.company_name}
                  </p>
                  {result.address && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{result.address}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {result.phone && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone size={10} /> {result.phone}
                      </span>
                    )}
                    {result.website && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Globe size={10} /> {result.website.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 30)}
                      </span>
                    )}
                  </div>
                  {result.source === 'google_places' && (
                    <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                      Google Maps
                    </span>
                  )}
                  {result.source === 'manual' && (
                    <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      Handmatig invoeren
                    </span>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-2" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Enrichment status */}
      {enriching && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ backgroundColor: '#eef2fa' }}
        >
          <Loader2 size={18} className="animate-spin" style={{ color: '#3d61a4' }} />
          <span className="text-sm font-medium" style={{ color: '#011745' }}>
            Bedrijfsinformatie ophalen van het internet...
          </span>
        </div>
      )}

      {enrichedData && !enriching && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg"
          style={{ backgroundColor: '#eef2fa' }}
        >
          <CheckCircle size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold" style={{ color: '#011745' }}>
              Bedrijfsgegevens gevonden en ingevuld
            </p>
            {(enrichedData.ai_description || enrichedData.description) && (
              <p className="text-gray-600 mt-1 text-xs leading-relaxed">
                {enrichedData.ai_description || enrichedData.description}
              </p>
            )}
            {enrichedData.fx_relevance && (
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: '#3d61a4' }}>
                <strong>FX Relevantie:</strong> {enrichedData.fx_relevance}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {enrichedData.google_maps_url && (
                <a
                  href={enrichedData.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded hover:underline"
                  style={{ backgroundColor: 'white', color: '#3d61a4' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={10} /> Google Maps
                </a>
              )}
              {enrichedData.linkedin_url && (
                <a
                  href={enrichedData.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded hover:underline"
                  style={{ backgroundColor: 'white', color: '#0a66c2' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={10} /> LinkedIn
                </a>
              )}
              {enrichedData.international_trade && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-green-50 text-green-700">
                  <Globe size={10} /> Internationaal actief
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">{duplicateWarning.message}</p>
            <p className="text-amber-600 mt-1">
              Bestaande lead ID: {duplicateWarning.existing_lead_id}
            </p>
          </div>
        </div>
      )}

      {/* Company details form */}
      {(selectedCompany || form.company_name) && (
        <>
          <div className="border-t pt-4" style={{ borderColor: '#e8eaf2' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#011745' }}>
              Bedrijfsgegevens
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                icon={Building2}
                label="Bedrijfsnaam"
                value={form.company_name}
                onChange={(v) => onFormChange('company_name', v)}
                required
              />
              <FormField
                icon={Globe}
                label="Website"
                value={form.company_website}
                onChange={(v) => onFormChange('company_website', v)}
                placeholder="https://..."
              />
              <FormField
                icon={MapPin}
                label="Land"
                value={form.company_country}
                onChange={(v) => onFormChange('company_country', v)}
              />
              <FormField
                label="Industrie"
                value={form.company_industry}
                onChange={(v) => onFormChange('company_industry', v)}
              />
              <FormField
                label="KVK Nummer"
                value={form.kvk_number}
                onChange={(v) => onFormChange('kvk_number', v)}
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prioriteit</label>
                <select
                  value={form.priority}
                  onChange={(e) => onFormChange('priority', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: '#cdd1e0', '--tw-ring-color': '#3d61a4' }}
                >
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: '#e8eaf2' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#011745' }}>
              Contactpersoon
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                icon={User}
                label="Naam"
                value={form.contact_name}
                onChange={(v) => onFormChange('contact_name', v)}
              />
              <FormField
                icon={Mail}
                label="E-mail"
                value={form.contact_email}
                onChange={(v) => onFormChange('contact_email', v)}
                type="email"
              />
              <FormField
                icon={Phone}
                label="Telefoon"
                value={form.contact_phone}
                onChange={(v) => onFormChange('contact_phone', v)}
                type="tel"
              />
              <FormField
                icon={Phone}
                label="Mobiel (06)"
                value={form.contact_mobile}
                onChange={(v) => onFormChange('contact_mobile', v)}
                type="tel"
                placeholder="06-12345678"
              />
              <FormField
                label="Functie"
                value={form.contact_position}
                onChange={(v) => onFormChange('contact_position', v)}
                className="col-span-2"
              />
            </div>
          </div>
        </>
      )}

      {/* Save error */}
      {saveError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={16} />
          {saveError}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving || !form.company_name.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
          style={{ backgroundColor: '#3d61a4' }}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Opslaan...
            </>
          ) : (
            <>
              <Plus size={16} />
              Lead Opslaan
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// TAB 2: Document uploaden
// ═══════════════════════════════════════════════════════
const DocumentUploadTab = ({
  dragOver, onDragOver, onDragLeave, onDrop,
  fileInputRef, onFileSelected, uploadedFile, onRemoveFile,
  scanning, onScan, detectedLeads, leadImportStatus,
  onImportSingle, onImportAll, scanError,
}) => {
  const successCount = Object.values(leadImportStatus).filter((s) => s === 'success').length;
  const allDone = detectedLeads.length > 0 && detectedLeads.every((_, i) => leadImportStatus[i] === 'success' || leadImportStatus[i] === 'duplicate');

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg"
        style={{ backgroundColor: '#eef2fa' }}
      >
        <FileUp size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#3d61a4' }} />
        <div className="text-sm" style={{ color: '#011745' }}>
          <p className="font-semibold">Claude AI Document Scanner</p>
          <p className="text-gray-600 mt-0.5">
            Upload een PDF, Excel, CSV of afbeelding. Claude Sonnet analyseert het document
            en extraheert automatisch alle lead-informatie.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      {!uploadedFile ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? 'scale-[1.02]' : ''
          }`}
          style={{
            borderColor: dragOver ? '#3d61a4' : '#cdd1e0',
            backgroundColor: dragOver ? '#eef2fa' : 'white',
          }}
        >
          <Upload size={40} className="mx-auto mb-3" style={{ color: dragOver ? '#3d61a4' : '#a4abbe' }} />
          <p className="text-sm font-semibold" style={{ color: '#011745' }}>
            Sleep een bestand hierheen
          </p>
          <p className="text-xs text-gray-400 mt-1">
            of klik om te bladeren
          </p>
          <p className="text-xs text-gray-400 mt-3">
            PDF, Excel (.xlsx), CSV, PNG, JPG — max 50MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
            onChange={(e) => e.target.files[0] && onFileSelected(e.target.files[0])}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Uploaded file card */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-lg border"
            style={{ backgroundColor: 'white', borderColor: '#e8eaf2' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#eef2fa' }}
              >
                <FileUp size={20} style={{ color: '#3d61a4' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#011745' }}>
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-gray-400">
                  {(uploadedFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!scanning && detectedLeads.length === 0 && (
                <button
                  onClick={onScan}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:shadow-md"
                  style={{ backgroundColor: '#3d61a4' }}
                >
                  <Search size={14} />
                  Scannen met Claude
                </button>
              )}
              <button
                onClick={onRemoveFile}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Scanning status */}
          {scanning && (
            <div
              className="flex items-center gap-3 px-4 py-4 rounded-lg"
              style={{ backgroundColor: '#eef2fa' }}
            >
              <Loader2 size={20} className="animate-spin" style={{ color: '#3d61a4' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#011745' }}>
                  Document wordt geanalyseerd door Claude...
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dit kan even duren afhankelijk van de grootte van het document
                </p>
              </div>
            </div>
          )}

          {/* Detected leads – individual cards with Voeg toe */}
          {detectedLeads.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: '#011745' }}>
                  {detectedLeads.length} bedrijf{detectedLeads.length !== 1 ? 'en' : ''} gevonden
                </h3>
                {detectedLeads.length > 1 && !allDone && (
                  <button
                    onClick={onImportAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all hover:shadow-md"
                    style={{ backgroundColor: '#3d61a4' }}
                  >
                    <Plus size={13} />
                    Alles toevoegen
                  </button>
                )}
                {allDone && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#16a34a' }}>
                    <CheckCircle size={14} />
                    Alle leads toegevoegd
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {detectedLeads.map((lead, i) => {
                  const status = leadImportStatus[i]; // undefined | 'importing' | 'success' | 'duplicate' | 'error'
                  return (
                    <div
                      key={i}
                      className="rounded-lg border overflow-hidden transition-all"
                      style={{
                        backgroundColor: status === 'success' ? '#f0fdf4' : status === 'duplicate' ? '#fffbeb' : 'white',
                        borderColor: status === 'success' ? '#86efac' : status === 'duplicate' ? '#fde68a' : '#e8eaf2',
                      }}
                    >
                      <div className="flex items-start justify-between px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: '#011745' }}>
                            {lead.company_name || 'Onbekend bedrijf'}
                          </p>

                          {/* Detail fields */}
                          <div className="mt-1.5 space-y-0.5">
                            {lead.kvk_number && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">KvK:</span> {lead.kvk_number}
                              </p>
                            )}
                            {lead.contact_name && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Contact:</span> {lead.contact_name}
                                {lead.contact_position ? ` — ${lead.contact_position}` : ''}
                              </p>
                            )}
                            {(lead.contact_email || lead.contact_phone) && (
                              <p className="text-xs text-gray-500">
                                {[lead.contact_email, lead.contact_phone].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {lead.company_website && (
                              <p className="text-xs text-gray-500 truncate">
                                <span className="font-medium text-gray-600">Web:</span> {lead.company_website}
                              </p>
                            )}
                            {lead.company_country && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Land:</span> {lead.company_country}
                              </p>
                            )}
                            {lead.company_industry && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Sector:</span> {lead.company_industry}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action button / status */}
                        <div className="flex-shrink-0 ml-3 mt-0.5">
                          {!status && (
                            <button
                              onClick={() => onImportSingle(lead, i)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all hover:shadow-md"
                              style={{ backgroundColor: '#3d61a4' }}
                            >
                              <Plus size={13} />
                              Voeg toe
                            </button>
                          )}
                          {status === 'importing' && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold" style={{ color: '#3d61a4' }}>
                              <Loader2 size={13} className="animate-spin" />
                              Bezig...
                            </div>
                          )}
                          {status === 'success' && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold" style={{ color: '#16a34a' }}>
                              <CheckCircle size={14} />
                              Toegevoegd
                            </div>
                          )}
                          {status === 'duplicate' && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold" style={{ color: '#d97706' }}>
                              <AlertCircle size={14} />
                              Bestaat al
                            </div>
                          )}
                          {status === 'error' && (
                            <button
                              onClick={() => onImportSingle(lead, i)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all"
                            >
                              <AlertCircle size={13} />
                              Opnieuw
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary bar */}
              {successCount > 0 && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 mt-3 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                >
                  <CheckCircle size={14} />
                  {successCount} van {detectedLeads.length} leads succesvol toegevoegd
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scan error */}
      {scanError && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {scanError}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// Shared form field component
// ═══════════════════════════════════════════════════════
const FormField = ({ icon: Icon, label, value, onChange, required, type = 'text', placeholder, className = '' }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon size={14} />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2`}
        style={{ borderColor: '#cdd1e0', '--tw-ring-color': '#3d61a4' }}
      />
    </div>
  </div>
);

export default NewLeadModal;
