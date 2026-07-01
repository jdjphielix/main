import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Loader2, ChevronRight, CheckCircle2,
  Clock, Building2, User, Phone, Mail, Globe, FileText, AlertCircle,
  ArrowRight, ArrowLeft, X, ClipboardCheck, Upload, Calendar, Shield, CreditCard,
  Link2, Activity, MessageSquare, Star, MoreVertical, Eye, Download,
  Trash2, Zap, DollarSign, TrendingUp, MapPin, Flag, BarChart3,
  ExternalLink, ChevronDown, ChevronUp, UploadCloud, ThumbsUp, ThumbsDown,
  ShieldCheck, AlertTriangle, Banknote, Percent, Users, Edit3, Save, Check, Plus, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import EmailThreadsPanel from '../components/leads/EmailThreadsPanel';
import ProductLinesSection from '../components/common/ProductLinesSection';

const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ─── Format helpers ─── */
function fmtCurrency(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}
function fmtPct(val) { return val != null ? `${val}%` : '—'; }

/* ─── AI Scan Results Modal (for Sales) ─── */
function ScanResultsModal({ doc, onClose, onScanComplete }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(doc?.ai_scan_result || null);
  const [scanError, setScanError] = useState(null);

  if (!doc) return null;

  const hasResult = result && result.compliance_status;

  async function triggerScan() {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch(`/api/v1/ai/scan-document/${doc.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('auth_token')}` },
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const err = await res.json(); detail = err.detail || detail; } catch {}
        throw new Error(`Scan mislukt: ${detail}`);
      }
      const data = await res.json();
      const scanResult = data.scan_result || data;
      setResult(scanResult);
      if (onScanComplete) onScanComplete({ ...doc, ai_scan_status: 'scanned', ai_scan_result: scanResult });
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }

  // Auto-trigger scan if no results
  React.useEffect(() => {
    if (!hasResult && !scanning && !scanError) {
      triggerScan();
    }
  }, []);

  const status = result?.compliance_status || 'unknown';
  const statusConfig = {
    compliant: { label: 'GOEDGEKEURD', bg: '#dcfce7', color: '#166534', icon: '✓' },
    requires_clarification: { label: 'CONTROLE NODIG', bg: '#fef3c7', color: '#92400e', icon: '!' },
    needs_rejection: { label: 'AFGEKEURD', bg: '#fee2e2', color: '#991b1b', icon: '✗' },
    unknown: { label: 'ONBEKEND', bg: '#f3f4f6', color: '#374151', icon: '?' },
  };
  const cfg = statusConfig[status] || statusConfig.unknown;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#e8eaf2] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <Zap size={18} style={{ color: '#3d61a4' }} />
            <h3 className="font-bold" style={{ color: '#011745' }}>AI Document Scan</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f3f4f8]">
            <X size={18} style={{ color: '#7b859e' }} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Document info */}
          <div className="flex items-center gap-3">
            <FileText size={20} style={{ color: '#3d61a4' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#011745' }}>{doc.original_filename}</p>
              <p className="text-xs" style={{ color: '#a4abbe' }}>
                {(doc.file_size / 1024).toFixed(0)} KB
                {result?.document_type && <> &bull; Herkend als: <span className="font-medium text-[#566079]">{result.document_type}</span></>}
              </p>
            </div>
          </div>

          {/* Scanning state */}
          {scanning && (
            <div className="flex flex-col items-center py-10">
              <Loader2 size={32} className="animate-spin mb-3" style={{ color: '#3d61a4' }} />
              <p className="text-sm font-medium" style={{ color: '#011745' }}>Document wordt geanalyseerd...</p>
              <p className="text-xs mt-1" style={{ color: '#7b859e' }}>Dit kan even duren bij PDF-bestanden</p>
            </div>
          )}

          {/* Scan error */}
          {scanError && !scanning && (
            <div className="text-center py-8">
              <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
              <p className="text-sm font-medium text-red-700 mb-1">Scan mislukt</p>
              <p className="text-xs text-red-500 mb-4">{scanError}</p>
              <button onClick={triggerScan}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                style={{ backgroundColor: '#3d61a4' }}>
                Opnieuw proberen
              </button>
            </div>
          )}

          {/* Results */}
          {hasResult && !scanning && (
            <>
              {/* Requirement match indicator */}
              {result.matches_requirement !== undefined && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${result.matches_requirement ? 'bg-green-50' : 'bg-amber-50'}`}>
                  {result.matches_requirement ? (
                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                  )}
                  <p className={`text-xs font-medium ${result.matches_requirement ? 'text-green-700' : 'text-amber-700'}`}>
                    {result.matches_requirement
                      ? 'Document komt overeen met de vereiste'
                      : 'Document komt mogelijk niet overeen met de vereiste — controleer of dit het juiste document is'}
                  </p>
                </div>
              )}

              {/* Status badge */}
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: cfg.bg }}>
                <span className="text-2xl font-bold" style={{ color: cfg.color }}>{cfg.icon}</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
                  {result.summary && <p className="text-xs mt-0.5" style={{ color: cfg.color }}>{result.summary}</p>}
                </div>
              </div>

              {/* Required fields */}
              {result.required_fields && (
                <div>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Vereiste Velden</h4>
                  {result.required_fields.present?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium mb-1 text-green-600">Aanwezig:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.required_fields.present.map((f, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.required_fields.missing?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1 text-red-600">Ontbrekend:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.required_fields.missing.map((f, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Red flags */}
              {result.red_flags?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#991b1b' }}>Red Flags</h4>
                  <div className="space-y-1">
                    {result.red_flags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-50">
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">{flag}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Aanbevelingen</h4>
                  <div className="space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#eef2fa]">
                        <Star size={12} style={{ color: '#3d61a4' }} className="flex-shrink-0 mt-0.5" />
                        <p className="text-xs" style={{ color: '#3b4560' }}>{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-scan button */}
              <div className="pt-2 border-t border-[#e8eaf2]">
                <button onClick={triggerScan}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors"
                  style={{ color: '#3d61a4' }}>
                  <RefreshCw size={12} className="inline mr-1.5" />
                  Opnieuw scannen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Document Viewer Modal — scan summary + document preview (used everywhere) ─── */
function DocumentViewerModal({ doc, onClose, onScanComplete }) {
  const [blobUrl, setBlobUrl] = React.useState(null);
  const [loadingDoc, setLoadingDoc] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const [scanning, setScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState(null);
  const [scanError, setScanError] = React.useState(null);

  if (!doc) return null;
  const result = scanResult || doc.ai_scan_result || {};
  const hasResult = result && result.compliance_status;
  const status = result.compliance_status || 'unknown';
  const statusConfig = {
    compliant: { label: 'GOEDGEKEURD', bg: '#dcfce7', color: '#166534' },
    requires_clarification: { label: 'CONTROLE NODIG', bg: '#fef3c7', color: '#92400e' },
    needs_rejection: { label: 'AFGEKEURD', bg: '#fee2e2', color: '#991b1b' },
    unknown: { label: 'ONBEKEND', bg: '#f3f4f6', color: '#374151' },
  };
  const cfg = statusConfig[status] || statusConfig.unknown;
  const isPdf = (doc.original_filename || '').toLowerCase().endsWith('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.original_filename || '');

  // Fetch document with auth token and create blob URL
  React.useEffect(() => {
    if (!doc?.id) return;
    let revoked = false;
    setLoadingDoc(true);
    setLoadError(null);
    const token = sessionStorage.getItem('auth_token');
    fetch(`/api/v1/documents/${doc.id}/download`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (!revoked) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      })
      .catch(err => {
        if (!revoked) setLoadError(err.message);
      })
      .finally(() => {
        if (!revoked) setLoadingDoc(false);
      });
    return () => {
      revoked = true;
    };
  }, [doc?.id]);

  // Auto-trigger AI scan if no results yet
  async function triggerScan() {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch(`/api/v1/ai/scan-document/${doc.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('auth_token')}` },
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const err = await res.json(); detail = err.detail || detail; } catch {}
        throw new Error(`Scan mislukt: ${detail}`);
      }
      const data = await res.json();
      const sr = data.scan_result || data;
      setScanResult(sr);
      if (onScanComplete) onScanComplete({ ...doc, ai_scan_status: 'scanned', ai_scan_result: sr });
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }

  React.useEffect(() => {
    if (!hasResult && !scanning && !scanError) {
      triggerScan();
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaf2]">
          <div className="flex items-center gap-3">
            <Eye size={18} style={{ color: '#011745' }} />
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#011745' }}>{doc.original_filename}</h3>
              <p className="text-xs" style={{ color: '#a4abbe' }}>{(doc.file_size / 1024).toFixed(0)} KB</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
            {blobUrl && (
              <a href={blobUrl} download={doc.original_filename}
                className="p-2 rounded-lg hover:bg-[#eef2fa] transition-colors" title="Download">
                <Download size={16} style={{ color: '#3d61a4' }} />
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f3f4f8]">
              <X size={18} style={{ color: '#7b859e' }} />
            </button>
          </div>
        </div>

        {/* Content: side-by-side scan + document */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Scan summary */}
          <div className="w-[320px] border-r border-[#e8eaf2] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>AI Scan Resultaten</h4>
              {hasResult && !scanning && (
                <button onClick={triggerScan}
                  className="text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[#eef2fa] transition-colors flex items-center gap-1"
                  style={{ color: '#3d61a4' }}>
                  <RefreshCw size={10} /> Opnieuw
                </button>
              )}
            </div>

            {/* Scanning state */}
            {scanning && (
              <div className="flex flex-col items-center py-10">
                <Loader2 size={28} className="animate-spin mb-3" style={{ color: '#3d61a4' }} />
                <p className="text-xs font-medium" style={{ color: '#011745' }}>Document wordt geanalyseerd...</p>
                <p className="text-[10px] mt-1" style={{ color: '#7b859e' }}>Dit kan even duren bij PDF-bestanden</p>
              </div>
            )}

            {/* Scan error */}
            {scanError && !scanning && (
              <div className="text-center py-6">
                <AlertCircle size={24} className="mx-auto mb-2 text-red-400" />
                <p className="text-xs font-medium text-red-700 mb-1">Scan mislukt</p>
                <p className="text-[10px] text-red-500 mb-3">{scanError}</p>
                <button onClick={triggerScan}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                  style={{ backgroundColor: '#3d61a4' }}>
                  Opnieuw proberen
                </button>
              </div>
            )}

            {/* Results */}
            {hasResult && !scanning && (
              <>
                {result.document_type && (
                  <div className="p-3 rounded-lg bg-[#f7f8fc]">
                    <p className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: '#7b859e' }}>Document type</p>
                    <p className="text-xs font-medium" style={{ color: '#011745' }}>{result.document_type}</p>
                  </div>
                )}

                {result.matches_requirement !== undefined && (
                  <div className={`p-3 rounded-lg ${result.matches_requirement ? 'bg-green-50' : 'bg-amber-50'}`}>
                    <p className={`text-xs font-medium ${result.matches_requirement ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.matches_requirement ? '✓ Komt overeen met vereiste' : '⚠ Mogelijk niet het juiste document'}
                    </p>
                  </div>
                )}

                {result.summary && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: cfg.bg }}>
                    <p className="text-xs font-medium" style={{ color: cfg.color }}>{result.summary}</p>
                  </div>
                )}

                {result.required_fields?.present?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase mb-1 text-green-600">Aanwezig</p>
                    <div className="flex flex-wrap gap-1">
                      {result.required_fields.present.map((f, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {result.required_fields?.missing?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase mb-1 text-red-600">Ontbrekend</p>
                    <div className="flex flex-wrap gap-1">
                      {result.required_fields.missing.map((f, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {result.red_flags?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase mb-1 text-red-600">Red Flags</p>
                    {result.red_flags.map((flag, i) => (
                      <div key={i} className="text-xs p-2 mb-1 rounded bg-red-50 text-red-700">{flag}</div>
                    ))}
                  </div>
                )}

                {result.recommendations?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#3d61a4' }}>Aanbevelingen</p>
                    {result.recommendations.map((rec, i) => (
                      <div key={i} className="text-xs p-2 mb-1 rounded bg-[#eef2fa]" style={{ color: '#3b4560' }}>{rec}</div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* No results and not scanning */}
            {!hasResult && !scanning && !scanError && (
              <div className="text-center py-8">
                <Clock size={24} style={{ color: '#cdd1e0' }} className="mx-auto mb-2" />
                <p className="text-xs" style={{ color: '#7b859e' }}>Nog geen scan resultaten beschikbaar</p>
              </div>
            )}
          </div>

          {/* Right: Document preview */}
          <div className="flex-1 bg-[#f3f4f8] flex items-center justify-center overflow-auto">
            {loadingDoc ? (
              <div className="text-center p-8">
                <div className="w-8 h-8 border-2 border-[#3d61a4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs" style={{ color: '#7b859e' }}>Document laden...</p>
              </div>
            ) : loadError ? (
              <div className="text-center p-8">
                <FileText size={48} style={{ color: '#cdd1e0' }} className="mx-auto mb-3" />
                <p className="text-sm font-medium" style={{ color: '#991b1b' }}>Kan document niet laden</p>
                <p className="text-xs mt-1" style={{ color: '#7b859e' }}>{loadError}</p>
              </div>
            ) : isPdf && blobUrl ? (
              <iframe
                src={blobUrl}
                className="w-full h-full border-0"
                title="Document Preview"
              />
            ) : isImage && blobUrl ? (
              <img
                src={blobUrl}
                alt={doc.original_filename}
                className="max-w-full max-h-full object-contain"
              />
            ) : blobUrl ? (
              <div className="text-center p-8">
                <FileText size={48} style={{ color: '#cdd1e0' }} className="mx-auto mb-3" />
                <p className="text-sm font-medium" style={{ color: '#566079' }}>Preview niet beschikbaar voor dit bestandstype</p>
                <a href={blobUrl} download={doc.original_filename}
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#3d61a4' }}>
                  <Download size={14} /> Download Bestand
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── File upload per requirement ─── */
function FileDropZone({ leadId, requirementId, documents, onUploadDone, isBackoffice, onViewDoc }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanningId, setScanningId] = useState(null);
  const [scanResult, setScanResult] = useState(null); // for immediate display after upload (sales)
  const [reviewingDocId, setReviewingDocId] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const fileRef = useRef();

  const reqDocs = documents.filter(d => d.requirement_id === requirementId);

  async function uploadFile(file) {
    setUploading(true);
    setScanResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams({ lead_id: leadId, category: 'onboarding', requirement_id: requirementId });
      const res = await fetch(`/api/v1/documents/upload?${params}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const doc = await res.json();

      // Trigger AI scan
      setScanningId(doc.id);
      try {
        const scanRes = await fetch(`/api/v1/ai/scan-document/${doc.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          // Show scan result immediately for sales
          // scanData = { document_id, scan_result: {...}, status }
          if (!isBackoffice) {
            setScanResult({ ...doc, ai_scan_status: 'scanned', ai_scan_result: scanData.scan_result || scanData });
          }
        }
      } catch (e) { console.warn('AI scan failed (non-critical):', e); }
      setScanningId(null);

      onUploadDone();
    } catch (err) {
      alert('Upload fout: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  function getStatusBadge(doc) {
    if (doc.ai_scan_status !== 'scanned' || !doc.ai_scan_result) return null;
    const status = doc.ai_scan_result.compliance_status;
    const configs = {
      compliant: { label: 'OK', bg: 'bg-green-100', text: 'text-green-700' },
      requires_clarification: { label: 'CHECK', bg: 'bg-yellow-100', text: 'text-yellow-700' },
      needs_rejection: { label: 'ISSUE', bg: 'bg-red-100', text: 'text-red-700' },
    };
    const c = configs[status] || { label: '?', bg: 'bg-gray-100', text: 'text-gray-700' };
    return <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${c.bg} ${c.text}`}>{c.label}</span>;
  }

  async function handleReview(docId, status) {
    setReviewSaving(true);
    try {
      await api(`/api/v1/documents/${docId}/review`, {
        method: 'PUT',
        body: JSON.stringify({
          approval_status: status,
          rejection_reason: status === 'rejected' ? (reviewNote || 'Afgekeurd door backoffice') : null,
          backoffice_note: reviewNote || null,
        }),
      });
      setReviewingDocId(null);
      setReviewNote('');
      onUploadDone(); // refresh docs
    } catch (err) {
      alert('Review fout: ' + err.message);
    } finally {
      setReviewSaving(false);
    }
  }

  function handleDocClick(doc) {
    // Always open the viewer — the modal handles scan triggering
    if (onViewDoc) onViewDoc(doc);
  }

  async function handleDeleteDoc(e, docId) {
    e.stopPropagation();
    if (!window.confirm('Weet je zeker dat je dit document wilt verwijderen?')) return;
    try {
      await api(`/api/v1/documents/${docId}`, { method: 'DELETE' });
      onUploadDone(); // refresh
    } catch (err) {
      alert('Verwijderen mislukt: ' + err.message);
    }
  }

  return (
    <div className="mt-2">
      {/* Existing documents */}
      {reqDocs.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {reqDocs.map(doc => {
            const approvalBg = doc.approval_status === 'approved' ? 'bg-[#f0fdf4] border-green-200'
              : doc.approval_status === 'rejected' ? 'bg-red-50 border-red-200'
              : 'bg-[#f0fdf4] border-green-100';
            const isReviewing = reviewingDocId === doc.id;
            return (
              <div key={doc.id} className="space-y-1">
                <div
                  onClick={() => handleDocClick(doc)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:opacity-80 transition-colors ${approvalBg}`}>
                  <FileText size={14} className={doc.approval_status === 'rejected' ? 'text-red-500' : 'text-green-600'} />
                  <span className={`text-xs font-medium truncate flex-1 ${doc.approval_status === 'rejected' ? 'text-red-700' : 'text-green-700'}`}>
                    {doc.original_filename}
                  </span>
                  <span className="text-[10px] text-gray-400">{(doc.file_size / 1024).toFixed(0)} KB</span>

                  {/* Approval status badge */}
                  {doc.approval_status === 'approved' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-green-100 text-green-700">GOED</span>
                  )}
                  {doc.approval_status === 'rejected' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">AFGEKEURD</span>
                  )}

                  {/* AI scan status */}
                  {doc.ai_scan_status === 'scanned' ? (
                    <>
                      <CheckCircle2 size={12} className="text-green-500" />
                      {getStatusBadge(doc)}
                    </>
                  ) : doc.ai_scan_status === 'pending' || scanningId === doc.id ? (
                    <Loader2 size={12} className="animate-spin" style={{ color: '#3d61a4' }} />
                  ) : (
                    <Clock size={12} style={{ color: '#a4abbe' }} />
                  )}

                  {/* Delete button */}
                  <button
                    onClick={e => handleDeleteDoc(e, doc.id)}
                    className="p-1 rounded hover:bg-red-100 transition-colors ml-1"
                    title="Verwijderen"
                  >
                    <Trash2 size={12} className="text-red-400 hover:text-red-600" />
                  </button>

                  {/* Backoffice: review toggle button */}
                  {isBackoffice && (
                    <button onClick={e => { e.stopPropagation(); setReviewingDocId(isReviewing ? null : doc.id); setReviewNote(doc.rejection_reason || ''); }}
                      className="p-1 rounded hover:bg-blue-100 transition-colors" title="Beoordelen">
                      <Eye size={12} style={{ color: '#3d61a4' }} />
                    </button>
                  )}
                </div>

                {/* Backoffice review panel (inline) */}
                {isBackoffice && isReviewing && (
                  <div className="ml-2 p-3 rounded-lg border border-[#e8eaf2] bg-white space-y-2">
                    <textarea
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      placeholder="Notitie voor sales (optioneel bij goedkeuring, verplicht bij afkeuring)..."
                      className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-xs resize-none"
                      style={{ color: '#566079' }}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(doc.id, 'approved')} disabled={reviewSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#16a34a' }}>
                        {reviewSaving ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                        Goedkeuren
                      </button>
                      <button onClick={() => { if (!reviewNote.trim()) { alert('Vul een reden in bij afkeuring'); return; } handleReview(doc.id, 'rejected'); }} disabled={reviewSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#dc2626' }}>
                        {reviewSaving ? <Loader2 size={12} className="animate-spin" /> : <ThumbsDown size={12} />}
                        Afkeuren
                      </button>
                      <button onClick={() => { setReviewingDocId(null); setReviewNote(''); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#f3f4f8] transition-colors"
                        style={{ color: '#7b859e' }}>
                        Annuleren
                      </button>
                    </div>
                    {doc.rejection_reason && doc.approval_status === 'rejected' && (
                      <p className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-600">
                        Afkeur reden: {doc.rejection_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scan result just uploaded — show unified viewer */}
      {scanResult && !isBackoffice && (
        <DocumentViewerModal doc={scanResult} onClose={() => setScanResult(null)} onScanComplete={onUploadDone} />
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
          dragging ? 'border-[#3d61a4] bg-[#eef2fa]' : 'border-[#e8eaf2] hover:border-[#3d61a4]/40 hover:bg-[#f7f8fc]'
        }`}>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} />
        {uploading ? (
          <>
            <Loader2 size={14} className="animate-spin" style={{ color: '#3d61a4' }} />
            <span className="text-xs" style={{ color: '#3d61a4' }}>
              {scanningId ? 'AI scan loopt...' : 'Uploading...'}
            </span>
          </>
        ) : (
          <>
            <UploadCloud size={14} style={{ color: '#a4abbe' }} />
            <span className="text-xs" style={{ color: '#a4abbe' }}>
              {reqDocs.length > 0 ? 'Nieuw bestand uploaden' : 'Sleep bestand hierheen of klik'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}


/* ─── Revenue Forecast Widget (read-only, uit lead fase) ─── */
function RevenueForecastWidget({ revenuePotential }) {
  let rows = [];
  if (Array.isArray(revenuePotential)) {
    rows = revenuePotential;
  } else if (typeof revenuePotential === 'string') {
    try { rows = JSON.parse(revenuePotential); } catch { rows = []; }
  }
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
      <h4 className="text-xs font-semibold uppercase mb-3 flex items-center gap-1.5" style={{ color: '#3d61a4' }}>
        <TrendingUp size={12} /> Revenue Potentie (uit lead fase)
      </h4>
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
}


/* ─── KYC Info Tab ─── */
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

          {/* Forecasting — product lines (volume + marge → revenue) */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#f7f8fc' }}>
            <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Forecasting (volumes & revenue)</h4>
            {pd?.taperpay_active && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#3d61a4' }}>TaperPay</p>
                <ProductLinesSection leadId={lead.id} product="taperpay" accent="#3d61a4" />
              </div>
            )}
            {pd?.tapertrade_active && (
              <div>
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: '#16a34a' }}>TaperTrade</p>
                <ProductLinesSection leadId={lead.id} product="tapertrade" accent="#16a34a" />
                {(pd.tf_debtor_finance || pd.tf_portfolio_finance || pd.tf_voorraad_finance) && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {pd.tf_debtor_finance && <span className="text-[10px] px-2 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">Debtor Finance</span>}
                    {pd.tf_portfolio_finance && <span className="text-[10px] px-2 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">Portfolio Finance</span>}
                    {pd.tf_voorraad_finance && <span className="text-[10px] px-2 py-0.5 rounded bg-[#eef2fa] text-[#3d61a4]">Voorraad Finance</span>}
                  </div>
                )}
              </div>
            )}
            {!pd?.taperpay_active && !pd?.tapertrade_active && (
              <p className="text-xs" style={{ color: '#a4abbe' }}>Geen producten geactiveerd voor dit dossier.</p>
            )}
          </div>

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
export default function OnboardingPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);

  // Role-based access: sales users can only see sales tab, backoffice/admin see backoffice tab
  const userRole = user?.role || 'sales';
  const isBackofficeUser = ['admin_pay', 'admin_trade', 'backoffice', 'accountmanager'].includes(userRole) || user?.is_teamleader;
  const isSalesUser = ['sales', 'admin_pay', 'admin_trade', 'teamleader'].includes(userRole) || user?.is_teamleader;
  const canSeeBothTabs = isBackofficeUser && isSalesUser; // admins/teamleaders see both
  const defaultTab = isBackofficeUser && !isSalesUser ? 'backoffice' : 'sales';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [savingChecklist, setSavingChecklist] = useState(null);
  const [boReviewingReq, setBoReviewingReq] = useState(null); // reqId being reviewed in backoffice
  const [boReviewNote, setBoReviewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState([]);
  const [detailTab, setDetailTab] = useState('checklist'); // 'checklist' | 'prospect' | 'communicatie'
  const [communications, setCommunications] = useState([]);
  const [commText, setCommText] = useState('');
  const [addingComm, setAddingComm] = useState(false);

  // Terugsturen modal state
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [sendBackNote, setSendBackNote] = useState('');
  const [sendBackStatus, setSendBackStatus] = useState('needs_refactor');
  const [sendingBack, setSendingBack] = useState(false);

  // Conversations and contact methods for detail panel tabs
  const [detailConversations, setDetailConversations] = useState([]);
  const [detailContactMethods, setDetailContactMethods] = useState([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [expandedConv, setExpandedConv] = useState(null);

  // Contact methods CRUD state
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });

  // Conversations CRUD state
  const [showLogForm, setShowLogForm] = useState(false);
  const [convForm, setConvForm] = useState({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
  const [convUploading, setConvUploading] = useState(false);

  // Sales users list (for assignment)
  const [salesUsers, setSalesUsers] = useState([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Fetch sales users once
  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/v1/users/team');
        // All active users are selectable for assignment
        setSalesUsers((data || []).filter(u => u.status !== 'inactive'));
      } catch {}
    })();
  }, []);

  async function handleAssignSalesUser(leadId, salesOwnerId, dealerId) {
    setSavingAssignment(true);
    try {
      const body = {};
      if (salesOwnerId !== undefined) body.sales_owner_id = salesOwnerId || null;
      if (dealerId !== undefined) body.dealer_id = dealerId || null;
      await api(`/api/v1/leads/${leadId}/assign-sales-user`, { method: 'PUT', body: JSON.stringify(body) });
      // Refresh lead in list
      fetchLeads();
    } catch (err) { console.error('Assignment failed:', err); }
    finally { setSavingAssignment(false); }
  }

  async function handleAssignAccountManager(leadId, managerId) {
    setSavingAssignment(true);
    try {
      await api(`/api/v1/leads/${leadId}/assign-account-manager`, {
        method: 'POST',
        body: JSON.stringify({ account_manager_id: managerId || null }),
      });
      // Update selected lead locally
      setSelectedLead(prev => prev ? { ...prev, account_manager_id: managerId || null } : prev);
      fetchLeads();
    } catch (err) { console.error('AM assignment failed:', err); }
    finally { setSavingAssignment(false); }
  }

  // Dynamic requirements from backend
  const [requirements, setRequirements] = useState([]);
  // Documents for selected lead
  const [documents, setDocuments] = useState([]);
  // Prospect data for KYC profile
  const [prospectData, setProspectData] = useState(null);
  // Document viewer state (for backoffice document preview + scan)
  const [viewingDoc, setViewingDoc] = useState(null);

  // Fetch requirements from admin
  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/v1/admin/onboarding-requirements');
        setRequirements((data.requirements || []).filter(r => r.is_active));
      } catch (e) { console.error('Failed to load requirements:', e); }
    })();
  }, []);

  const payReqs = requirements.filter(r => r.product_type === 'taperpay');
  const tradeReqs = requirements.filter(r => r.product_type === 'tapertrade');

  // Build checklist: TaperPay requirements always, TaperTrade only if active for this prospect
  const getChecklist = () => {
    const base = [...payReqs];
    if (prospectData?.prospect_data?.tapertrade_active || prospectData?.tapertrade_active) {
      base.push(...tradeReqs);
    }
    return base;
  };

  function getProgress(lead, checklist) {
    const cl = lead?.onboarding_checklist || {};
    const done = checklist.filter(item => cl[`req_${item.id}`]).length;
    return { done, total: checklist.length, pct: checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0 };
  }

  // For list-view progress, use only TaperPay requirements as base
  // (TaperTrade only added when we know tapertrade_active for that specific lead)
  function getListProgress(lead) {
    const cl = lead?.onboarding_checklist || {};
    // Use only payReqs for list view — consistent baseline regardless of tapertrade
    const baseReqs = payReqs.length > 0 ? payReqs : requirements;
    const done = baseReqs.filter(item => cl[`req_${item.id}`]).length;
    return { done, total: baseReqs.length, pct: baseReqs.length > 0 ? Math.round((done / baseReqs.length) * 100) : 0 };
  }

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Sales/extern users only see their own onboarding leads
      const myClientsParam = (isSalesUser && !isBackofficeUser) ? '&my_clients=true' : '';
      const [salesRes, boRes] = await Promise.all([
        fetch(`/api/v1/leads/?page_size=200&pipeline_stage=onboarding_sales${myClientsParam}`, {
          headers: { Authorization: `Bearer ${token()}` },
        }),
        fetch(`/api/v1/leads/?page_size=200&pipeline_stage=onboarding_backoffice${myClientsParam}`, {
          headers: { Authorization: `Bearer ${token()}` },
        }),
      ]);

      let allLeads = [];
      if (salesRes.ok) {
        const d = await salesRes.json();
        allLeads = [...allLeads, ...(d.leads || []).map(l => ({ ...l, _phase: 'sales' }))];
      }
      if (boRes.ok) {
        const d = await boRes.json();
        allLeads = [...allLeads, ...(d.leads || []).map(l => ({ ...l, _phase: 'backoffice' }))];
      }

      setLeads(allLeads);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Fetch details when a lead is selected
  useEffect(() => {
    if (!selectedLead) { setNotes([]); setDocuments([]); setProspectData(null); setCommunications([]); setDetailTab('checklist'); return; }
    (async () => {
      try {
        const [notesRes, docsRes, pdRes, commRes] = await Promise.allSettled([
          fetch(`/api/v1/leads/${selectedLead.id}/notes`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/documents/lead/${selectedLead.id}?category=onboarding`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/prospects/${selectedLead.id}`, { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`/api/v1/leads/${selectedLead.id}/communications`, { headers: { Authorization: `Bearer ${token()}` } }),
        ]);
        if (notesRes.status === 'fulfilled' && notesRes.value.ok) {
          setNotes(await notesRes.value.json());
        } else { setNotes([]); }
        if (docsRes.status === 'fulfilled' && docsRes.value.ok) {
          const dd = await docsRes.value.json();
          setDocuments(dd.documents || []);
        } else { setDocuments([]); }
        if (pdRes.status === 'fulfilled' && pdRes.value.ok) {
          setProspectData(await pdRes.value.json());
        } else { setProspectData(null); }
        if (commRes.status === 'fulfilled' && commRes.value.ok) {
          setCommunications(await commRes.value.json());
        } else { setCommunications([]); }
      } catch { setNotes([]); setDocuments([]); setProspectData(null); setCommunications([]); }
    })();
  }, [selectedLead?.id]);

  // Herbruikbare fetch functies
  const fetchDetailContactMethods = useCallback(async (leadId) => {
    if (!leadId) return;
    try {
      const r = await fetch(`/api/v1/leads/${leadId}/contact-methods`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = r.ok ? await r.json() : [];
      setDetailContactMethods(Array.isArray(d) ? d : []);
    } catch { setDetailContactMethods([]); }
  }, []);

  const fetchDetailConversations = useCallback(async (leadId) => {
    if (!leadId) return;
    setConvsLoading(true);
    try {
      const r = await fetch(`/api/v1/leads/${leadId}/conversations`, { headers: { Authorization: `Bearer ${token()}` } });
      const d = r.ok ? await r.json() : [];
      setDetailConversations(Array.isArray(d) ? d : []);
    } catch { setDetailConversations([]); }
    setConvsLoading(false);
  }, []);

  // Load data for contacten / gesprekken tabs when tab or lead changes
  useEffect(() => {
    if (!selectedLead) return;
    if (detailTab === 'contacten') fetchDetailContactMethods(selectedLead.id);
    if (detailTab === 'gesprekken') fetchDetailConversations(selectedLead.id);
  }, [detailTab, selectedLead?.id]);

  // Contact CRUD handlers
  const handleAddContactMethod = async () => {
    const { name, email, mobile, whatsapp, isPrimary } = newContact;
    if (!email.trim() && !mobile.trim() && !whatsapp.trim()) return;
    try {
      const entries = [];
      if (email.trim())    entries.push({ type: 'email',    value: email.trim(),    label: name.trim() || null, is_primary: isPrimary });
      if (mobile.trim())   entries.push({ type: 'phone',    value: mobile.trim(),   label: name.trim() || null, is_primary: isPrimary });
      if (whatsapp.trim()) entries.push({ type: 'whatsapp', value: whatsapp.trim(), label: name.trim() || null, is_primary: false });
      for (const entry of entries) {
        await api(`/api/v1/leads/${selectedLead.id}/contact-methods`, { method: 'POST', body: JSON.stringify(entry) });
      }
      setNewContact({ name: '', email: '', mobile: '', whatsapp: '', isPrimary: false });
      setShowAddContact(false);
      fetchDetailContactMethods(selectedLead.id);
    } catch (err) { console.error('Contact toevoegen mislukt:', err); }
  };

  const handleDeleteContactMethod = async (methodId) => {
    if (!window.confirm('Contact verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${selectedLead.id}/contact-methods/${methodId}`, { method: 'DELETE' });
      fetchDetailContactMethods(selectedLead.id);
    } catch (err) { console.error(err); }
  };

  const handleSetPrimaryContact = async (methodId) => {
    try {
      await api(`/api/v1/leads/${selectedLead.id}/contact-methods/${methodId}`, { method: 'PUT', body: JSON.stringify({ is_primary: true }) });
      fetchDetailContactMethods(selectedLead.id);
    } catch (err) { console.error(err); }
  };

  // Conversation CRUD handlers
  const handleLogConversation = async () => {
    try {
      await api(`/api/v1/leads/${selectedLead.id}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ ...convForm, duration_seconds: convForm.duration_seconds ? parseInt(convForm.duration_seconds) : null, occurred_at: convForm.occurred_at || new Date().toISOString() }),
      });
      setShowLogForm(false);
      setConvForm({ type: 'phone', direction: 'outbound', contact_value: '', duration_seconds: '', outcome: '', summary: '', occurred_at: '' });
      fetchDetailConversations(selectedLead.id);
    } catch (err) { console.error('Gesprek loggen mislukt:', err); }
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Gespreklog verwijderen?')) return;
    try {
      await api(`/api/v1/leads/${selectedLead.id}/conversations/${convId}`, { method: 'DELETE' });
      fetchDetailConversations(selectedLead.id);
    } catch (err) { console.error(err); }
  };

  const salesLeads = leads.filter(l => l._phase === 'sales');
  const backofficeLeads = leads.filter(l => l._phase === 'backoffice');
  const displayLeads = activeTab === 'sales' ? salesLeads : backofficeLeads;
  const checklist = getChecklist();

  const filteredLeads = searchQuery
    ? displayLeads.filter(l =>
        (l.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : displayLeads;

  async function toggleChecklistItem(leadId, reqId, currentValue) {
    const key = `req_${reqId}`;
    setSavingChecklist(key);
    const lead = leads.find(l => l.id === leadId);
    const newChecklist = { ...(lead?.onboarding_checklist || {}), [key]: !currentValue };

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, onboarding_checklist: newChecklist } : l));
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => ({ ...prev, onboarding_checklist: newChecklist }));
    }

    try {
      await api(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ onboarding_checklist: newChecklist }),
      });
    } catch (err) {
      console.error('Checklist save failed:', err);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, onboarding_checklist: lead?.onboarding_checklist } : l));
    } finally {
      setSavingChecklist(null);
    }
  }

  async function approveAllChecklist(leadId) {
    const lead = leads.find(l => l.id === leadId);
    const cl = lead?.onboarding_checklist || {};
    const newChecklist = { ...cl };
    checklist.forEach(req => {
      newChecklist[`req_${req.id}_bo_status`] = 'approved';
      newChecklist[`req_${req.id}_bo_note`] = '';
    });
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, onboarding_checklist: newChecklist } : l));
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => ({ ...prev, onboarding_checklist: newChecklist }));
    }
    try {
      await api(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ onboarding_checklist: newChecklist }),
      });
    } catch (err) {
      console.error('Approve-all failed:', err);
    }
  }

  async function setBackofficeReview(leadId, reqId, status, note) {
    const lead = leads.find(l => l.id === leadId);
    const cl = lead?.onboarding_checklist || {};
    const newChecklist = { ...cl };
    // null status = reset to pending (remove the key)
    if (status === null) {
      delete newChecklist[`req_${reqId}_bo_status`];
      delete newChecklist[`req_${reqId}_bo_note`];
    } else {
      newChecklist[`req_${reqId}_bo_status`] = status;
      newChecklist[`req_${reqId}_bo_note`] = note || '';
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, onboarding_checklist: newChecklist } : l));
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => ({ ...prev, onboarding_checklist: newChecklist }));
    }
    try {
      await api(`/api/v1/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ onboarding_checklist: newChecklist }),
      });
    } catch (err) {
      console.error('Review save failed:', err);
    }
  }

  async function moveToBackoffice(leadId) {
    if (!window.confirm('Verplaats naar Onboarding Backoffice?')) return;
    try {
      await api(`/api/v1/leads/${leadId}/to-onboarding-backoffice`, { method: 'POST' });
      setSelectedLead(null);
      fetchLeads();
    } catch (err) { alert('Fout: ' + err.message); }
  }

  async function moveToClient(leadId) {
    if (!window.confirm('Verplaats naar Clients? Dit rondt de onboarding af.')) return;
    try {
      await api(`/api/v1/leads/${leadId}/to-client`, { method: 'POST' });
      setSelectedLead(null);
      fetchLeads();
    } catch (err) { alert('Fout: ' + err.message); }
  }

  async function sendBackToSales(leadId) {
    if (!window.confirm('Terugsturen naar Sales Onboarding? Sales ziet welke documenten zijn afgekeurd.')) return;
    try {
      await api(`/api/v1/documents/lead/${leadId}/send-back-to-sales`, { method: 'PUT' });
      setSelectedLead(null);
      fetchLeads();
    } catch (err) { alert('Fout: ' + err.message); }
  }

  async function addCommunication() {
    if (!commText.trim() || !selectedLead) return;
    setAddingComm(true);
    try {
      await api(`/api/v1/leads/${selectedLead.id}/communications`, { method: 'POST', body: JSON.stringify({ content: commText }) });
      setCommText('');
      const res = await fetch(`/api/v1/leads/${selectedLead.id}/communications`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setCommunications(await res.json());
    } catch (err) { console.error('Communication save failed:', err); }
    finally { setAddingComm(false); }
  }

  async function addNote() {
    if (!noteText.trim() || !selectedLead) return;
    setAddingNote(true);
    try {
      await api(`/api/v1/leads/${selectedLead.id}/notes`, { method: 'POST', body: JSON.stringify({ content: noteText }) });
      setNoteText('');
      const res = await fetch(`/api/v1/leads/${selectedLead.id}/notes`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setNotes(await res.json());
    } catch (err) { console.error('Note save failed:', err); }
    finally { setAddingNote(false); }
  }

  async function refreshDocuments() {
    if (!selectedLead) return;
    try {
      const res = await fetch(`/api/v1/documents/lead/${selectedLead.id}?category=onboarding`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const dd = await res.json();
        setDocuments(dd.documents || []);
      }
    } catch (e) { console.error('Doc refresh failed:', e); }
  }

  const progress = selectedLead ? getProgress(selectedLead, checklist) : null;

  return (
    <div className="h-screen flex flex-col bg-[#f7f8fc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8eaf2] px-8 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#011745' }}>Onboarding</h1>
            <p className="text-sm mt-1" style={{ color: '#7b859e' }}>
              {salesLeads.length} sales onboarding &bull; {backofficeLeads.length} backoffice onboarding
            </p>
          </div>
          <button onClick={fetchLeads} disabled={loading}
            className="p-2.5 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }}>
            {loading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1">
            {isSalesUser && (
              <button onClick={() => { setActiveTab('sales'); setSelectedLead(null); }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'sales' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                style={{ color: activeTab === 'sales' ? '#3d61a4' : '#7b859e' }}>
                Sales ({salesLeads.length})
              </button>
            )}
            {isBackofficeUser && (
              <button onClick={() => { setActiveTab('backoffice'); setSelectedLead(null); }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'backoffice' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                style={{ color: activeTab === 'backoffice' ? '#3d61a4' : '#7b859e' }}>
                Backoffice ({backofficeLeads.length})
              </button>
            )}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
            <input type="text" placeholder="Zoek op bedrijf of contact..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-sm"
              style={{ color: '#566079' }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className={`${selectedLead ? 'w-[400px] flex-shrink-0' : 'w-full'} overflow-auto border-r border-[#e8eaf2]`}>
          {loading && leads.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle size={28} style={{ color: '#df2f4a' }} />
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={fetchLeads} className="text-sm px-4 py-2 rounded-lg" style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}>Opnieuw</button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
              <ClipboardCheck size={40} style={{ color: '#cdd1e0' }} />
              <p className="font-semibold" style={{ color: '#011745' }}>
                Geen {activeTab === 'sales' ? 'sales' : 'backoffice'} onboarding items
              </p>
              <p className="text-sm text-center" style={{ color: '#7b859e' }}>
                {activeTab === 'sales'
                  ? 'Verplaats prospects naar onboarding via de Prospects pagina'
                  : 'Verplaats leads vanuit Sales Onboarding na het afronden van de sales checklist'}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {filteredLeads.map(lead => {
                const prog = getListProgress(lead);
                return (
                  <div key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`bg-white rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md ${
                      selectedLead?.id === lead.id ? 'border-[#3d61a4] shadow-md ring-1 ring-[#3d61a4]/20' : 'border-[#e8eaf2]'
                    }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-sm truncate" style={{ color: '#011745' }}>{lead.company_name}</h3>
                          {lead.revision_status && (
                            <span title={lead.revision_note || 'Teruggestuurd door backoffice'}
                              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold animate-pulse"
                              style={{ backgroundColor: lead.revision_status === 'rejected' ? '#dc2626' : '#f97316' }}>
                              !
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#7b859e' }}>
                          {lead.contact_name} {lead.contact_position ? `— ${lead.contact_position}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-bold ml-2 flex-shrink-0"
                        style={{ color: prog.pct === 100 ? '#16a34a' : '#3d61a4' }}>
                        {prog.pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#e8eaf2] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${prog.pct}%`, backgroundColor: prog.pct === 100 ? '#16a34a' : '#3d61a4' }} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px]" style={{ color: '#a4abbe' }}>{prog.done}/{prog.total} stappen</span>
                      <div className="flex items-center gap-2">
                        {lead.sales_owner_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#eef2fa] font-medium" style={{ color: '#3d61a4' }}>
                            {lead.sales_owner_name}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: '#a4abbe' }}>{lead.company_country}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedLead && (
          <div className="flex-1 bg-white overflow-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: '#011745' }}>
                    {(selectedLead.company_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: '#011745' }}>{selectedLead.company_name}</h2>
                    <p className="text-sm" style={{ color: '#7b859e' }}>
                      {selectedLead.contact_name} &bull; {selectedLead.contact_email || 'geen email'}
                    </p>
                    {selectedLead.sales_owner_name && (
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#3d61a4' }}>
                        <User size={10} /> Sales owner: <span className="font-semibold">{selectedLead.sales_owner_name}</span>
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg hover:bg-[#f3f4f8]">
                  <X size={18} style={{ color: '#7b859e' }} />
                </button>
              </div>

              {/* Overall progress */}
              <div className="rounded-xl p-4 mb-6" style={{ background: 'linear-gradient(135deg, #011745, #3d61a4)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white/80">
                    {activeTab === 'sales' ? 'Sales Onboarding' : 'Backoffice Onboarding'} Voortgang
                  </span>
                  <span className="text-2xl font-bold text-white">{progress.pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress.pct}%` }} />
                </div>
                <p className="text-xs text-white/60 mt-2">{progress.done} van {progress.total} stappen afgerond</p>
              </div>

              {/* Revision banner — shown when backoffice sent back with a note */}
              {selectedLead?.revision_status && (
                <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
                  <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Teruggestuurd door Backoffice — {
                        selectedLead.revision_status === 'needs_refactor' ? 'Aanvulling nodig' :
                        selectedLead.revision_status === 'needs_clarification' ? 'Toelichting gevraagd' : 'Afgewezen'
                      }
                    </p>
                    {selectedLead.revision_note && (
                      <p className="text-xs text-amber-700 mt-1">{selectedLead.revision_note}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Detail tabs */}
              <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1 mb-6">
                {[
                  { key: 'checklist',    label: 'Checklist',     icon: ClipboardCheck },
                  { key: 'contacten',    label: 'Contacten',     icon: Phone },
                  { key: 'emails',       label: 'E-mails',        icon: Mail },
                  { key: 'gesprekken',   label: 'Gesprekken',    icon: Activity },
                  { key: 'communicatie', label: 'Communicatie',  icon: MessageSquare },
                  { key: 'kyc',          label: 'KYC Info',      icon: ShieldCheck },
                  { key: 'prospect',     label: 'Prospect Data', icon: BarChart3 },
                ].map(tab => (
                  <button key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      detailTab === tab.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                    }`}
                    style={{ color: detailTab === tab.key ? '#3d61a4' : '#7b859e' }}>
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ═══ CHECKLIST TAB ═══ */}
              {detailTab === 'checklist' && (
                <div>
                  {checklist.length === 0 ? (
                    <div className="text-center py-8 mb-6">
                      <p className="text-sm" style={{ color: '#7b859e' }}>
                        Geen onboarding vereisten geconfigureerd. Ga naar Admin &rarr; Onboarding Vereisten om ze in te stellen.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {checklist.map(req => {
                        const key = `req_${req.id}`;
                        const checked = selectedLead.onboarding_checklist?.[key] || false;
                        const isSaving = savingChecklist === key;
                        const boStatus = selectedLead.onboarding_checklist?.[`req_${req.id}_bo_status`];
                        const boNote = selectedLead.onboarding_checklist?.[`req_${req.id}_bo_note`] || '';
                        const isBO = activeTab === 'backoffice';
                        const isReviewOpen = boReviewingReq === req.id;

                        // Border/bg based on backoffice review status
                        const itemBorder = isBO
                          ? boStatus === 'approved' ? 'bg-[#f0fdf4] border-[#bbf7d0]'
                            : boStatus === 'rejected' ? 'bg-red-50 border-red-200'
                            : 'bg-white border-[#e8eaf2]'
                          : boStatus === 'approved' ? 'bg-[#f0fdf4] border-[#bbf7d0]'
                          : boStatus === 'rejected' ? 'bg-red-50 border-red-200'
                          : checked ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-white border-[#e8eaf2]';

                        return (
                          <div key={req.id} className={`rounded-xl border transition-all ${itemBorder}`}>
                            {/* Header row */}
                            <div
                              onClick={() => {
                                if (!isBO) toggleChecklistItem(selectedLead.id, req.id, checked);
                              }}
                              className={`flex items-center gap-3 p-3 ${!isBO ? 'cursor-pointer hover:bg-[#f7f8fc]' : ''} rounded-t-xl`}>
                              {/* Status icon */}
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                                isBO
                                  ? boStatus === 'approved' ? 'bg-[#16a34a] text-white'
                                    : boStatus === 'rejected' ? 'bg-[#dc2626] text-white'
                                    : 'bg-[#eef2fa]'
                                  : checked ? 'bg-[#16a34a] text-white' : 'bg-[#eef2fa]'
                              }`}>
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> :
                                 isBO
                                   ? boStatus === 'approved' ? <ThumbsUp size={14} />
                                     : boStatus === 'rejected' ? <ThumbsDown size={14} />
                                     : <FileText size={14} style={{ color: '#3d61a4' }} />
                                   : checked ? <CheckCircle2 size={16} /> : <FileText size={14} style={{ color: '#3d61a4' }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium ${
                                    isBO
                                      ? boStatus === 'approved' ? 'text-green-700' : boStatus === 'rejected' ? 'text-red-700' : ''
                                      : checked ? 'line-through text-green-600' : ''
                                  }`} style={{ color: (!isBO && !checked) || (isBO && !boStatus) ? '#011745' : undefined }}>
                                    {req.name}
                                  </p>
                                  {req.is_required && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-red-50 text-red-500 font-semibold">VERPLICHT</span>
                                  )}
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                    req.product_type === 'taperpay' ? 'bg-[#eef2fa] text-[#3d61a4]' : 'bg-[#fef3c7] text-[#92400e]'
                                  }`}>
                                    {req.product_type === 'taperpay' ? 'Pay' : 'Trade'}
                                  </span>
                                  {/* BO status badge — visible to all users */}
                                  {boStatus === 'approved' && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-green-100 text-green-700">BO: OK</span>
                                  )}
                                  {boStatus === 'rejected' && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">BO: AFGEKEURD</span>
                                  )}
                                </div>
                                {req.description && (
                                  <p className="text-xs mt-0.5" style={{ color: '#a4abbe' }}>{req.description}</p>
                                )}
                                {/* Show BO feedback in sales view */}
                                {!isBO && boStatus === 'rejected' && boNote && (
                                  <p className="text-xs mt-1 px-2 py-1 rounded bg-red-50 text-red-600 flex items-start gap-1">
                                    <span className="font-semibold flex-shrink-0">Backoffice:</span> {boNote}
                                  </p>
                                )}
                                {!isBO && boStatus === 'rejected' && !boNote && (
                                  <p className="text-xs mt-1 px-2 py-1 rounded bg-red-50 text-red-600">
                                    Afgekeurd door backoffice
                                  </p>
                                )}
                              </div>

                              {/* Backoffice: direct approve/reject buttons per item */}
                              {isBO && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {/* Approve button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (boStatus === 'approved') {
                                        // Toggle off — reset to pending
                                        setBackofficeReview(selectedLead.id, req.id, null, '');
                                      } else {
                                        setBackofficeReview(selectedLead.id, req.id, 'approved', '');
                                        setBoReviewingReq(null);
                                      }
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={{
                                      backgroundColor: boStatus === 'approved' ? '#16a34a' : '#f0fdf4',
                                      color: boStatus === 'approved' ? 'white' : '#16a34a',
                                      border: `1px solid ${boStatus === 'approved' ? '#16a34a' : '#bbf7d0'}`,
                                    }}
                                    title="Goedkeuren">
                                    <ThumbsUp size={12} />
                                    {boStatus === 'approved' ? 'Goed' : 'OK'}
                                  </button>
                                  {/* Reject button — opens note panel */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isReviewOpen) {
                                        setBoReviewingReq(null);
                                      } else {
                                        setBoReviewingReq(req.id);
                                        setBoReviewNote(boNote);
                                      }
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={{
                                      backgroundColor: boStatus === 'rejected' ? '#dc2626' : '#fef2f2',
                                      color: boStatus === 'rejected' ? 'white' : '#dc2626',
                                      border: `1px solid ${boStatus === 'rejected' ? '#dc2626' : '#fecaca'}`,
                                    }}
                                    title="Afkeuren">
                                    <ThumbsDown size={12} />
                                    {boStatus === 'rejected' ? 'Afgekeurd' : 'Issue'}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Backoffice review panel */}
                            {isBO && isReviewOpen && (
                              <div className="mx-3 mb-3 p-3 rounded-lg border border-[#e8eaf2] bg-white space-y-2">
                                <textarea
                                  value={boReviewNote}
                                  onChange={e => setBoReviewNote(e.target.value)}
                                  placeholder="Notitie (verplicht bij afkeuring)..."
                                  className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-xs resize-none"
                                  style={{ color: '#566079' }}
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => {
                                    setBackofficeReview(selectedLead.id, req.id, 'approved', boReviewNote);
                                    setBoReviewingReq(null);
                                  }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                                    style={{ backgroundColor: '#16a34a' }}>
                                    <ThumbsUp size={12} /> Goedkeuren
                                  </button>
                                  <button onClick={() => {
                                    if (!boReviewNote.trim()) { alert('Vul een reden in bij afkeuring'); return; }
                                    setBackofficeReview(selectedLead.id, req.id, 'rejected', boReviewNote);
                                    setBoReviewingReq(null);
                                  }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                                    style={{ backgroundColor: '#dc2626' }}>
                                    <ThumbsDown size={12} /> Afkeuren
                                  </button>
                                  <button onClick={() => { setBoReviewingReq(null); setBoReviewNote(''); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#f3f4f8] transition-colors"
                                    style={{ color: '#7b859e' }}>
                                    Annuleren
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Documents */}
                            <div className="px-3 pb-3">
                              <FileDropZone
                                leadId={selectedLead.id}
                                requirementId={req.id}
                                documents={documents}
                                onUploadDone={refreshDocuments}
                                isBackoffice={isBO}
                                onViewDoc={(doc) => setViewingDoc(doc)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Notes section */}
                  <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#011745' }}>
                    <MessageSquare size={16} /> Notities
                  </h3>
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Voeg een notitie toe..."
                        value={noteText} onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addNote()}
                        className="flex-1 px-3 py-2 rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-sm"
                        style={{ color: '#566079' }} />
                      <button onClick={addNote} disabled={addingNote || !noteText.trim()}
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#3d61a4' }}>
                        {addingNote ? <Loader2 size={14} className="animate-spin" /> : 'Opslaan'}
                      </button>
                    </div>
                    {Array.isArray(notes) && notes.length > 0 && (
                      <div className="mt-3 space-y-2">
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
                </div>
              )}

              {/* ═══ PROSPECT DATA TAB ═══ */}
              {/* ═══ KYC INFO TAB ═══ */}
              {detailTab === 'kyc' && (
                <KYCInfoTab
                  lead={selectedLead}
                  prospectData={prospectData}
                  onUpdate={(updated) => {
                    setProspectData(prev => {
                      const pd = prev?.prospect_data || prev || {};
                      return { ...prev, prospect_data: { ...pd, ...updated } };
                    });
                  }}
                />
              )}

              {detailTab === 'prospect' && (
                <div className="space-y-4">
                  {/* Sales Toewijzing — backoffice sets the sales user */}
                  {isBackofficeUser && (
                    <div className="rounded-xl p-4 bg-[#f7f8fc] border border-[#e8eaf2]">
                      <h4 className="text-xs font-semibold uppercase text-[#7b859e] mb-3">Sales Toewijzing</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-[#566079] block mb-1">Sales Owner</label>
                          <select
                            value={selectedLead?.sales_owner_id || ''}
                            onChange={e => handleAssignSalesUser(selectedLead.id, e.target.value ? parseInt(e.target.value) : null, undefined)}
                            disabled={savingAssignment}
                            className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4] bg-white disabled:opacity-60">
                            <option value="">— Niet toegewezen —</option>
                            {salesUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#566079] block mb-1">
                            Dealer <span className="text-[10px] text-[#a4abbe]">(optioneel, toekomstig)</span>
                          </label>
                          <select
                            value={selectedLead?.dealer_id || ''}
                            onChange={e => handleAssignSalesUser(selectedLead.id, undefined, e.target.value ? parseInt(e.target.value) : null)}
                            disabled={savingAssignment}
                            className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4] bg-white disabled:opacity-60">
                            <option value="">— Geen dealer —</option>
                            {salesUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="text-xs font-medium text-[#566079] block mb-1">Accountmanager</label>
                        <select
                          value={selectedLead?.account_manager_id || ''}
                          onChange={e => handleAssignAccountManager(selectedLead.id, e.target.value ? parseInt(e.target.value) : null)}
                          disabled={savingAssignment}
                          className="w-full px-3 py-2 rounded-lg border border-[#e8eaf2] text-sm text-[#011745] focus:outline-none focus:border-[#3d61a4] bg-white disabled:opacity-60">
                          <option value="">— Geen accountmanager —</option>
                          {salesUsers.filter(u => u.role === 'accountmanager').map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                        </select>
                      </div>
                      {savingAssignment && <p className="text-xs text-[#3d61a4] mt-2">Opslaan...</p>}
                    </div>
                  )}
                  <KYCProfile lead={selectedLead} prospectData={prospectData} onBrokerChange={(broker) => {
                    setProspectData(prev => {
                      const pd = prev?.prospect_data || prev || {};
                      return { ...prev, prospect_data: { ...pd, selected_broker: broker } };
                    });
                  }} />
                </div>
              )}

              {/* ── Contacten Tab ── */}
              {detailTab === 'contacten' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[#566079] uppercase tracking-wider">Contactmethoden</h3>
                    <button onClick={() => setShowAddContact(v => !v)} className="flex items-center gap-1 text-sm font-medium text-[#3d61a4] hover:text-[#0a2d6b]">
                      <Plus size={15}/> Toevoegen
                    </button>
                  </div>

                  {/* Toevoegen formulier */}
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
                        <button onClick={handleAddContactMethod}
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

                  {detailContactMethods.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-[#7b859e]">Nog geen contacten toegevoegd.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailContactMethods.map(m => (
                        <div key={m.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e8eaf2]">
                          <span className="text-base">{m.type === 'email' ? '✉' : m.type === 'phone' ? '📞' : '💬'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#011745] truncate">{m.value}</p>
                            {m.label && <p className="text-xs text-[#7b859e]">{m.label}</p>}
                          </div>
                          {m.is_primary && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">★ primair</span>}
                          {!m.is_primary && (
                            <button onClick={() => handleSetPrimaryContact(m.id)} className="text-[10px] text-[#a4abbe] hover:text-amber-500 transition-colors">
                              Primair
                            </button>
                          )}
                          <button onClick={() => handleDeleteContactMethod(m.id)} className="p-1 text-[#cdd1e0] hover:text-red-400 transition-colors rounded">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      ))}
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

                  {/* Log formulier */}
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
                        <button onClick={handleLogConversation}
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
                    <div className="flex justify-center py-6"><div className="animate-spin w-5 h-5 border-2 border-[#3d61a4] border-t-transparent rounded-full"/></div>
                  ) : detailConversations.length === 0 ? (
                    <p className="text-sm text-[#a4abbe]">Nog geen gesprekken gelogd.</p>
                  ) : (
                    <div className="space-y-3">
                      {detailConversations.map(conv => {
                        const isExpanded = expandedConv === conv.id;
                        const typeIcon = conv.type === 'phone' ? '📞' : conv.type === 'whatsapp' ? '💬' : conv.type === 'meeting' ? '🤝' : '✉';
                        const durationMin = conv.duration_seconds ? Math.round(conv.duration_seconds / 60) : null;
                        return (
                          <div key={conv.id} className="bg-white rounded-xl border border-[#e8eaf2] overflow-hidden">
                            <div className="flex items-start gap-3 p-4">
                              <span className="text-lg cursor-pointer" onClick={() => setExpandedConv(isExpanded ? null : conv.id)}>{typeIcon}</span>
                              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedConv(isExpanded ? null : conv.id)}>
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
                                  {conv.contact_value && ` • ${conv.contact_value}`}
                                </p>
                                {(conv.ai_summary || conv.summary) && !isExpanded && (
                                  <p className="text-xs text-[#566079] mt-1 line-clamp-2">{conv.ai_summary || conv.summary}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDeleteConversation(conv.id)} className="p-1 text-[#cdd1e0] hover:text-red-400 transition-colors rounded">
                                  <Trash2 size={13}/>
                                </button>
                                <span className="text-[#a4abbe] text-sm cursor-pointer" onClick={() => setExpandedConv(isExpanded ? null : conv.id)}>{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-[#e8eaf2] p-4 bg-[#f7f8fc] space-y-3">
                                {conv.ai_summary && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-[#3d61a4] uppercase tracking-wider mb-1">🤖 AI Samenvatting</p>
                                    <p className="text-xs text-[#566079] whitespace-pre-wrap leading-relaxed">{conv.ai_summary}</p>
                                  </div>
                                )}
                                {conv.summary && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-[#566079] uppercase tracking-wider mb-1">Samenvatting</p>
                                    <p className="text-xs text-[#566079] whitespace-pre-wrap leading-relaxed">{conv.summary}</p>
                                  </div>
                                )}
                                {conv.transcript_text && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-[#566079] uppercase tracking-wider mb-1">Transcript</p>
                                    <pre className="text-xs text-[#566079] whitespace-pre-wrap bg-white rounded-lg p-3 border border-[#e8eaf2] max-h-48 overflow-y-auto font-mono leading-relaxed">
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

              {/* ═══ E-MAILS TAB ═══ */}
              {detailTab === 'emails' && (
                <EmailThreadsPanel leadId={selectedLead?.id} />
              )}

              {/* ═══ COMMUNICATIE TAB ═══ */}
              {detailTab === 'communicatie' && (
                <div className="space-y-6">
                  {/* Add communication */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#011745' }}>
                      <MessageSquare size={16} /> Communicatie Log
                    </h3>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Voeg een communicatie log toe..."
                        value={commText} onChange={e => setCommText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCommunication()}
                        className="flex-1 px-3 py-2 rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none text-sm"
                        style={{ color: '#566079' }} />
                      <button onClick={addCommunication} disabled={addingComm || !commText.trim()}
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#3d61a4' }}>
                        {addingComm ? <Loader2 size={14} className="animate-spin" /> : 'Opslaan'}
                      </button>
                    </div>
                  </div>

                  {/* Communication list */}
                  <div className="space-y-2">
                    {(Array.isArray(communications) ? communications : []).length > 0 ? (
                      communications.map((comm, i) => (
                        <div key={comm.id || i} className="p-3 rounded-lg border border-[#e8eaf2]" style={{ backgroundColor: '#f7f8fc' }}>
                          <p className="text-sm" style={{ color: '#566079' }}>{comm.content}</p>
                          <p className="text-[10px] mt-1.5" style={{ color: '#a4abbe' }}>
                            {comm.user_name && <span className="font-medium">{comm.user_name} — </span>}
                            {comm.created_at && new Date(comm.created_at).toLocaleString('nl-NL')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 rounded-lg" style={{ backgroundColor: '#f7f8fc' }}>
                        <MessageSquare size={24} className="mx-auto mb-2" style={{ color: '#cdd1e0' }} />
                        <p className="text-sm" style={{ color: '#7b859e' }}>Nog geen communicatie gelogd</p>
                      </div>
                    )}
                  </div>

                  {/* Also show notes here for reference */}
                  {Array.isArray(notes) && notes.length > 0 && (
                    <div className="border-t border-[#e8eaf2] pt-4">
                      <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#7b859e' }}>Notities</h4>
                      <div className="space-y-2">
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

              {/* Action buttons */}
              <div className="space-y-3 pt-4 mt-6 border-t border-[#e8eaf2]">
                {activeTab === 'sales' && (() => {
                  const cl = selectedLead.onboarding_checklist || {};
                  const rejectedItems = checklist.filter(r => cl[`req_${r.id}_bo_status`] === 'rejected');
                  const rejectedDocs = documents.filter(d => d.approval_status === 'rejected');
                  const hasFeedback = rejectedItems.length > 0 || rejectedDocs.length > 0;

                  return (
                    <>
                      {/* Backoffice feedback for sales */}
                      {hasFeedback && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                          <p className="text-xs font-semibold text-red-700 mb-2">Backoffice feedback:</p>
                          {rejectedItems.map(r => (
                            <div key={r.id} className="text-xs text-red-600 mb-1 flex items-start gap-1.5">
                              <ThumbsDown size={10} className="flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium">{r.name}</span>
                                {cl[`req_${r.id}_bo_note`] && (
                                  <span>: {cl[`req_${r.id}_bo_note`]}</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {rejectedDocs.map(d => (
                            <div key={d.id} className="text-xs text-red-600 mb-1 flex items-start gap-1.5">
                              <FileText size={10} className="flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium">{d.original_filename}</span>: {d.rejection_reason || 'Afgekeurd'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Terug naar prospect - alleen voor eigen leads */}
                      <button
                        onClick={async () => {
                          if (!window.confirm('Lead terugzetten naar Prospect fase?')) return;
                          try {
                            await api(`/api/v1/leads/${selectedLead.id}/back-to-prospect`, { method: 'POST' });
                            setSelectedLead(null);
                            fetchLeads();
                          } catch (err) { alert('Fout: ' + err.message); }
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all border-2"
                        style={{ borderColor: '#7c3aed', color: '#7c3aed', backgroundColor: '#f5f3ff' }}>
                        <ArrowLeft size={16} />
                        Terug naar Prospect
                      </button>
                      <button onClick={() => moveToBackoffice(selectedLead.id)}
                        disabled={progress.pct < 100}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#3d61a4' }}>
                        <ArrowRight size={18} />
                        {progress.pct < 100 ? `Nog ${progress.total - progress.done} stappen te gaan` : 'Naar Backoffice Onboarding'}
                      </button>
                    </>
                  );
                })()}
                {activeTab === 'backoffice' && (() => {
                  const cl = selectedLead.onboarding_checklist || {};
                  const boApproved = checklist.filter(r => cl[`req_${r.id}_bo_status`] === 'approved').length;
                  const boRejected = checklist.filter(r => cl[`req_${r.id}_bo_status`] === 'rejected').length;
                  const boPending = checklist.length - boApproved - boRejected;
                  const hasRejected = boRejected > 0;
                  // Allow move-to-client if no requirements OR all reviewed
                  const allReviewed = checklist.length === 0 || (boPending === 0);

                  return (
                    <>
                      {/* Summary of review status */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-3 text-xs">
                          <span className="px-2 py-1 rounded bg-green-50 text-green-700 font-medium">{boApproved} goedgekeurd</span>
                          <span className="px-2 py-1 rounded bg-red-50 text-red-700 font-medium">{boRejected} afgekeurd</span>
                          <span className="px-2 py-1 rounded bg-gray-50 text-gray-500 font-medium">{boPending} te beoordelen</span>
                        </div>
                        {boPending > 0 && (
                          <button
                            onClick={() => approveAllChecklist(selectedLead.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                            <ThumbsUp size={12} /> Keur alles goed
                          </button>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {/* Send back to sales — opens modal */}
                        <button
                          onClick={() => setShowSendBackModal(true)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all hover:shadow-lg border-2"
                          style={{ borderColor: '#f59e0b', color: '#b45309', backgroundColor: '#fffbeb' }}>
                          <ArrowLeft size={18} />
                          Terugsturen naar Sales
                        </button>

                        {/* Send to clients */}
                        <button onClick={() => moveToClient(selectedLead.id)}
                          disabled={!allReviewed || hasRejected}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium transition-all hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#011745' }}>
                          <CheckCircle2 size={18} />
                          {!allReviewed ? 'Beoordeel eerst alles' : hasRejected ? 'Afgekeurde items aanwezig' : 'Naar Clients'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Document modal — unified scan summary + document preview, always */}
      {viewingDoc && (
        <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} onScanComplete={refreshDocuments} />
      )}

      {/* ── Terugsturen Modal ── */}
      {showSendBackModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#011745]">Terugsturen naar Sales Onboarding</h2>
              <p className="text-sm text-[#7b859e] mt-1">
                Geef aan waarom dit dossier wordt teruggestuurd. Sales ontvangt dit als notitie.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#566079] uppercase tracking-wider mb-2 block">Reden</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'needs_refactor', label: '🔧 Aanvulling nodig', desc: 'Documenten of informatie ontbreekt' },
                  { value: 'needs_clarification', label: '❓ Toelichting gevraagd', desc: 'Iets is onduidelijk of tegenstrijdig' },
                  { value: 'rejected', label: '❌ Afgewezen', desc: 'Dossier voldoet niet, terugsturen' },
                ].map(opt => (
                  <label key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      sendBackStatus === opt.value ? 'border-[#3d61a4] bg-[#eef2fa]' : 'border-[#e8eaf2] hover:border-[#a4abbe]'
                    }`}>
                    <input type="radio" name="sendBackStatus" value={opt.value}
                      checked={sendBackStatus === opt.value}
                      onChange={e => setSendBackStatus(e.target.value)}
                      className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[#011745]">{opt.label}</p>
                      <p className="text-xs text-[#7b859e]">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#566079] uppercase tracking-wider mb-1.5 block">
                Toelichting <span className="text-red-500">*</span>
              </label>
              <textarea
                value={sendBackNote}
                onChange={e => setSendBackNote(e.target.value)}
                placeholder="Beschrijf wat er ontbreekt of wat gecorrigeerd moet worden..."
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-[#cdd1e0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!sendBackNote.trim()) return;
                  setSendingBack(true);
                  try {
                    const res = await fetch(`/api/v1/leads/${selectedLead.id}/send-back-to-sales`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ note: sendBackNote, revision_status: sendBackStatus }),
                    });
                    if (res.ok) {
                      setShowSendBackModal(false);
                      setSendBackNote('');
                      setSendBackStatus('needs_refactor');
                      // Remove from current list
                      setLeads(prev => prev.filter(l => l.id !== selectedLead.id));
                      setSelectedLead(null);
                    }
                  } catch (e) { console.error(e); }
                  setSendingBack(false);
                }}
                disabled={!sendBackNote.trim() || sendingBack}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {sendingBack ? 'Versturen...' : '↩ Terugsturen naar Sales'}
              </button>
              <button
                onClick={() => { setShowSendBackModal(false); setSendBackNote(''); }}
                className="px-4 py-2.5 bg-[#e8eaf2] text-[#566079] rounded-lg font-medium text-sm hover:bg-[#cdd1e0]"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
