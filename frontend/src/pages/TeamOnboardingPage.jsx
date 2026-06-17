import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

const API_BASE = '/api/v1'

function apiFetch(path, opts = {}) {
  const token = sessionStorage.getItem('auth_token')
  return fetch(API_BASE + path, {
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  }).then(r => {
    if (!r.ok) throw new Error('API error ' + r.status)
    return r.json()
  })
}

const STAGE_LABELS = {
  onboarding_sales: { label: 'Sales Onboarding', color: '#3d61a4', bg: '#eef2fa' },
  onboarding_backoffice: { label: 'Backoffice Onboarding', color: '#1a7a4a', bg: '#e6f4ed' },
}

function StageBadge({ stage }) {
  const s = STAGE_LABELS[stage] || { label: stage, color: '#566079', bg: '#f3f4f8' }
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function formatEur(val) {
  if (val == null || val === '' || isNaN(Number(val))) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(val))
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TeamOnboardingPage() {
  const [cases, setCases] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState('all')
  const [modal, setModal] = useState({ open: false, leadId: null, currentValue: null })
  const [approveValue, setApproveValue] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const stageParam = activeStage !== 'all' ? '&stage=' + activeStage : ''
      const [casesData, summaryData] = await Promise.all([
        apiFetch('/team-onboarding/cases?page=1&page_size=50' + stageParam),
        apiFetch('/team-onboarding/summary'),
      ])
      setCases(casesData.cases || [])
      setSummary(summaryData)
    } catch (e) {
      setError('Kon gegevens niet laden: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [activeStage])

  useEffect(() => { loadData() }, [loadData])

  function openModal(c) {
    setApproveValue(c.total_revenue != null ? String(c.total_revenue) : '')
    setApproveNote('')
    setModal({ open: true, leadId: c.id, currentValue: c.total_revenue, fxRev: c.fx_estimated_revenue, tfRev: c.tf_estimated_revenue, company: c.company_name })
  }

  function closeModal() {
    setModal({ open: false, leadId: null })
  }

  async function handleApprove() {
    setSubmitting(true)
    try {
      await apiFetch('/team-onboarding/' + modal.leadId + '/approve-revenue', {
        method: 'POST',
        body: JSON.stringify({ approved_value: approveValue !== '' ? parseFloat(approveValue) : null, note: approveNote || null }),
      })
      closeModal()
      await loadData()
    } catch (e) {
      alert('Fout bij goedkeuren: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const STAGES = [
    { key: 'all', label: 'Alles' },
    { key: 'onboarding_sales', label: 'Sales Onboarding' },
    { key: 'onboarding_backoffice', label: 'Backoffice Onboarding' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#011745', margin: 0 }}>Team Onboarding</h1>
        <p style={{ color: '#566079', marginTop: 4, marginBottom: 0, fontSize: 14 }}>Read-only inzicht in de onboarding pipeline van jouw team</p>
      </div>

      <div style={{ background: '#eef2fa', border: '1px solid #c7d6f0', borderRadius: 10, padding: '10px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <AlertCircle size={16} color="#3d61a4" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#3d61a4', fontWeight: 500 }}>
          Dit is een read-only overzicht. Wijzigingen aan cases doe je via het <strong>Onboarding</strong> tabblad.
        </span>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Totaal cases', value: summary.total_cases, color: '#011745', warn: false },
            { label: 'Wacht op goedkeuring', value: summary.needs_approval, color: '#b45309', warn: summary.needs_approval > 0 },
            { label: 'Pipeline revenue', value: formatEur(summary.total_pipeline_revenue), color: '#011745', warn: false },
            { label: 'Goedgekeurde revenue', value: formatEur(summary.approved_revenue), color: '#1a7a4a', warn: false },
          ].map(t => (
            <div key={t.label} style={{ background: '#fff', border: '1px solid #e8eaf2', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(1,23,69,0.06)' }}>
              <div style={{ fontSize: 12, color: '#7b859e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: t.color }}>{t.value}</span>
                {t.warn && <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>!</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveStage(s.key)}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: activeStage === s.key ? '#011745' : '#f4f6fb',
              color: activeStage === s.key ? '#fff' : '#566079',
              transition: 'all 0.15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#a4abbe' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e8eaf2', borderTopColor: '#3d61a4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Laden...
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', color: '#b91c1c' }}>{error}</div>
      ) : cases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#a4abbe', fontSize: 15 }}>Geen cases gevonden.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cases.map(c => (
            <div key={c.id} style={{ background: '#fff', border: '1px solid #e8eaf2', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(1,23,69,0.05)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#011745', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.company_name}</div>
                <StageBadge stage={c.pipeline_stage} />
              </div>
              <div style={{ flex: '0 1 140px', fontSize: 13, color: '#566079' }}>
                <div style={{ fontSize: 11, color: '#a4abbe', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Sales</div>
                {c.sales_owner_name || '—'}
              </div>
              <div style={{ flex: '0 1 220px', fontSize: 13, color: '#566079' }}>
                <div style={{ fontSize: 11, color: '#a4abbe', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Revenue</div>
                <span>FX {formatEur(c.fx_estimated_revenue)}</span>
                <span style={{ margin: '0 5px', color: '#cdd1e0' }}>+</span>
                <span>TF {formatEur(c.tf_estimated_revenue)}</span>
                <span style={{ margin: '0 5px', color: '#cdd1e0' }}>=</span>
                <strong style={{ color: '#011745' }}>{formatEur(c.total_revenue)}</strong>
              </div>
              <div style={{ flex: '0 1 170px', fontSize: 13 }}>
                <div style={{ fontSize: 11, color: '#a4abbe', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Goedkeuring</div>
                {c.revenue_approved ? (
                  <span style={{ color: '#1a7a4a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={14} />{formatEur(c.revenue_approved_value)}
                  </span>
                ) : (
                  <span style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} />Goedkeuring vereist
                  </span>
                )}
              </div>
              {c.revision_status && (
                <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  ! {c.revision_status}
                </span>
              )}
              <div style={{ flex: '0 1 110px', fontSize: 12, color: '#7b859e' }}>
                <div style={{ fontSize: 11, color: '#a4abbe', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Gestart</div>
                {formatDate(c.onboarding_started_at || c.backoffice_started_at)}
              </div>
              {!c.revenue_approved && (
                <button
                  onClick={() => openModal(c)}
                  style={{ padding: '7px 16px', background: '#011745', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Goedkeuren
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(1,23,69,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 32, boxShadow: '0 20px 60px rgba(1,23,69,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#011745' }}>Revenue goedkeuren</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7b859e' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 20, background: '#f4f6fb', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#011745', marginBottom: 8 }}>{modal.company}</p>
              <div style={{ fontSize: 13, color: '#566079', display: 'flex', gap: 16 }}>
                <span>FX: <strong>{formatEur(modal.fxRev)}</strong></span>
                <span>TF: <strong>{formatEur(modal.tfRev)}</strong></span>
                <span>Totaal: <strong>{formatEur(modal.currentValue)}</strong></span>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#252f4a', marginBottom: 6 }}>Goedgekeurde waarde (€)</label>
              <input
                type="number"
                value={approveValue}
                onChange={e => setApproveValue(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cdd1e0', borderRadius: 8, fontSize: 14, color: '#011745', outline: 'none', boxSizing: 'border-box' }}
                placeholder="Bijv. 12500"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#252f4a', marginBottom: 6 }}>Notitie (optioneel)</label>
              <textarea
                value={approveNote}
                onChange={e => setApproveNote(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cdd1e0', borderRadius: 8, fontSize: 14, color: '#011745', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="Eventuele toelichting..."
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleApprove}
                disabled={submitting}
                style={{ flex: 1, padding: '11px', background: submitting ? '#cdd1e0' : '#011745', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Bezig...' : 'Bevestigen'}
              </button>
              <button
                onClick={closeModal}
                disabled={submitting}
                style={{ flex: 1, padding: '11px', background: '#f4f6fb', color: '#566079', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
    </div>
  )
}
