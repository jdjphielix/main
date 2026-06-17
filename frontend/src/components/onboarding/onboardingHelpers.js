// Shared helpers for onboarding components

export const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ─── Format helpers ─── */
export function fmtCurrency(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}
export function fmtPct(val) { return val != null ? `${val}%` : '—'; }

/* ─── AI Scan Results Modal (for Sales) ─── */
