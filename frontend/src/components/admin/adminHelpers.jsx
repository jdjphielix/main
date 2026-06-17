import React, { useState, useRef } from 'react';
import { Loader2, Upload } from 'lucide-react';

const BROKERS = [
  { key: 'ibanfirst', label: 'IbanFirst', color: '#3d61a4' },
  { key: 'corpay',    label: 'Corpay',    color: '#0a2d6b' },
  { key: 'ebury',     label: 'Ebury',     color: '#011745' },
  { key: 'trade_finance', label: 'Trade Finance', color: '#166534' },
];

function BrokerPicker({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BROKERS.map(b => (
        <button
          key={b.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === b.key ? null : b.key)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all disabled:opacity-50"
          style={value === b.key
            ? { backgroundColor: b.color, borderColor: b.color, color: '#fff' }
            : { backgroundColor: '#f7f8fc', borderColor: '#e8eaf2', color: '#566079' }
          }
        >
          {b.label}
        </button>
      ))}
      {value && (
        <button type="button" onClick={() => onChange(null)} disabled={disabled}
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

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
        dragging ? 'border-[#3d61a4] bg-[#eef2fa]' : 'border-[#cdd1e0] hover:border-[#3d61a4] hover:bg-[#f7f8fc]'
      }`}
    >
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); }} />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin" style={{ color: '#3d61a4' }} />
          <p className="text-xs" style={{ color: '#7b859e' }}>Uploaden...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload size={20} style={{ color: dragging ? '#3d61a4' : '#a4abbe' }} />
          <p className="text-xs font-medium" style={{ color: dragging ? '#3d61a4' : '#7b859e' }}>
            Sleep bestanden hiernaartoe of klik om te selecteren
          </p>
          <p className="text-[10px]" style={{ color: '#a4abbe' }}>PDF, Word, Excel, afbeeldingen (max 50MB)</p>
        </div>
      )}
    </div>
  );
}

const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatCurrency(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

const ROLE_LABELS = {
  admin_pay: 'Admin Pay',
  admin_trade: 'Admin Trade',
  teamleader: 'Teamleider',
  sales: 'Sales',
  backoffice: 'Backoffice',
  finance: 'Finance',
  extern: 'Extern',
  accountmanager: 'Accountmanager',
};

const ROLE_COLORS = {
  admin_pay: { bg: '#0a2d6b', text: '#fff' },
  admin_trade: { bg: '#0a2d6b', text: '#fff' },
  teamleader: { bg: '#3d61a4', text: '#fff' },
  sales: { bg: '#eef2fa', text: '#3d61a4' },
  backoffice: { bg: '#f0fdf4', text: '#16a34a' },
  finance: { bg: '#fef3c7', text: '#92400e' },
  extern: { bg: '#f3f4f8', text: '#566079' },
  accountmanager: { bg: '#e0f2fe', text: '#0369a1' },
};

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


/* ═══════════════════════════════════════════════════════════════
   TAB: Gebruikers
   ═══════════════════════════════════════════════════════════════ */

export { BROKERS, BrokerPicker, DropZone, token, api, formatCurrency,
         ROLE_LABELS, ROLE_COLORS, STATUS_COLORS, PRIORITY_COLORS };
