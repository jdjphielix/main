// Shared helpers for ClientsPage sub-components

export const token = () => sessionStorage.getItem('auth_token');

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function formatCurrency(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

export function formatNumber(val) {
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

export const BROKERS = [
  { key: 'ibanfirst', label: 'IbanFirst', color: '#3d61a4' },
  { key: 'corpay',    label: 'Corpay',    color: '#0a2d6b' },
  { key: 'ebury',     label: 'Ebury',     color: '#011745' },
  { key: 'trade_finance', label: 'Trade Finance', color: '#166534' },
];
