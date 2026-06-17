import React, { useState, useRef } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2, Clock } from 'lucide-react';

const token = () => sessionStorage.getItem('auth_token');

export default function TextInstructiePage() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]); // [{instruction, result, ts}]
  const textRef = useRef(null);

  const handleSubmit = async () => {
    const text = instruction.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/text-instruction', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: text }),
      });
      const data = await res.json();
      setHistory(prev => [{ instruction: text, result: data, ts: new Date() }, ...prev]);
      setInstruction('');
    } catch (err) {
      setHistory(prev => [{ instruction: text, result: { warnings: [err.message], actions_taken: [] }, ts: new Date() }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#f7f8fc' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-8 py-6 bg-white border-b border-[#e8eaf2]">
        <h1 className="text-2xl font-bold" style={{ color: '#011745', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Tekst Instructie
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7b859e' }}>
          Geef het platform directe instructies via tekst. Gebruik{' '}
          <code style={{ background: '#eef2fa', padding: '1px 6px', borderRadius: '4px', color: '#3d61a4' }}>
            @klantnaam contactpersoon, instructie
          </code>{' '}
          om logs toe te voegen aan leads, prospects, onboarding cases en clients.
        </p>
      </div>

      {/* Main input area */}
      <div className="flex-shrink-0 px-8 py-6">
        <div className="bg-white rounded-2xl border border-[#e8eaf2] shadow-sm overflow-hidden">
          <textarea
            ref={textRef}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`@sea value patrick preuter, heeft interesse in window forward 500K op 1.17\n\nDruk Ctrl+Enter om te verzenden`}
            className="w-full resize-none focus:outline-none px-6 py-5 text-sm leading-relaxed"
            style={{ minHeight: '180px', color: '#011745', fontFamily: 'Inter, sans-serif' }}
          />
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f7f8fc]" style={{ backgroundColor: '#fafafa' }}>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: '#a4abbe' }}>{instruction.length} tekens</span>
              <span className="text-xs" style={{ color: '#a4abbe' }}>Ctrl+Enter om te sturen</span>
            </div>
            <div className="flex items-center gap-2">
              {instruction.length > 0 && (
                <button
                  onClick={() => setInstruction('')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#f7f8fc]"
                  style={{ color: '#a4abbe' }}>
                  Wis
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!instruction.trim() || loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40"
                style={{ backgroundColor: '#011745' }}>
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {loading ? 'Verwerken...' : 'Verzenden'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {history.length === 0 ? (
          <div className="text-center py-16" style={{ color: '#a4abbe' }}>
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm font-medium">Nog geen instructies verstuurd</p>
            <p className="text-xs mt-1">Je instructiegeschiedenis verschijnt hier</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#e8eaf2] overflow-hidden">
                {/* Instruction */}
                <div className="px-5 py-4 border-b border-[#f7f8fc]" style={{ backgroundColor: '#fafafa' }}>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium flex-1" style={{ color: '#011745', whiteSpace: 'pre-wrap' }}>{item.instruction}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock size={11} style={{ color: '#a4abbe' }} />
                      <span className="text-[11px]" style={{ color: '#a4abbe' }}>
                        {item.ts.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Result */}
                <div className="px-5 py-4 space-y-3">
                  {/* AI parsed result */}
                  {item.result.parsed && (
                    <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: '#566079' }}>
                      <span className="font-semibold" style={{ color: '#011745' }}>Herkend:</span>
                      <span style={{ color: '#011745' }}>{item.result.parsed.matched_company_name || '—'}</span>
                      {item.result.parsed.contact_name && (
                        <span style={{ color: '#566079' }}>· {item.result.parsed.contact_name}</span>
                      )}
                      {item.result.parsed.matched_pipeline_stage && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                          {item.result.parsed.matched_pipeline_stage}
                        </span>
                      )}
                      {item.result.parsed.confidence != null && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            backgroundColor: item.result.parsed.confidence >= 0.7 ? '#f0fdf4' : '#fffbeb',
                            color: item.result.parsed.confidence >= 0.7 ? '#16a34a' : '#92400e',
                          }}>
                          {Math.round((item.result.parsed.confidence || 0) * 100)}% zekerheid
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions taken */}
                  {(item.result.actions_taken || []).map((a, j) => (
                    <div key={j} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <CheckCircle size={15} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#15803d' }}>{a.company_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#166534' }}>{a.summary}</p>
                      </div>
                    </div>
                  ))}

                  {/* Warnings */}
                  {(item.result.warnings || []).map((w, j) => (
                    <div key={j} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                      <AlertCircle size={15} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                      <p className="text-sm" style={{ color: '#92400e' }}>{w}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
