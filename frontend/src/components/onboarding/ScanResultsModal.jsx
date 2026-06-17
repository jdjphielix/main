import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle2, AlertCircle, Loader2, FileText, Eye, Download, RefreshCw
} from 'lucide-react';
import { token } from './onboardingHelpers';

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

export default ScanResultsModal;
