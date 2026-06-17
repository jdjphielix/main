import React, { useState, useRef } from 'react';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Eye,
  CheckCircle2, AlertCircle, Loader2, FileText
} from 'lucide-react';
import { token } from './onboardingHelpers';
import ScanResultsModal from './ScanResultsModal';

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

export default DocumentViewerModal;
