import React, { useState, useRef } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2, Eye, Clock, X
} from 'lucide-react';
import { token } from './onboardingHelpers';
import DocumentViewerModal from './DocumentViewerModal';

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

export default FileDropZone;
