import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, Check, X } from 'lucide-react';

const API = '/api/v1';
const token = () => sessionStorage.getItem('auth_token');

const fmtEur = (v) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v) || 0);

/**
 * Reusable "Producten / Volumes" section.
 *
 * Lets the user add MULTIPLE product lines (naam + volume + marge%) per lead for
 * a given product ('taperpay' | 'tapertrade'). Data lives in the product_lines
 * table keyed on lead_id, so it follows the lead through prospect → client.
 *
 * Additive: does not touch the existing FX/TF fields next to it.
 *
 * Props:
 *  - leadId   : lead id (required)
 *  - product  : 'taperpay' | 'tapertrade'
 *  - accent   : accent colour (defaults to Taper blue)
 */
export default function ProductLinesSection({ leadId, product, accent = '#3d61a4' }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Inline "new line" form (null = not adding)
  const [draft, setDraft] = useState(null); // { name, volume, margin_pct, note }
  // Inline edit of an existing line (id of line being edited)
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const fetchLines = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/leads/${leadId}/product-lines?product=${product}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = res.ok ? await res.json() : [];
      setLines(Array.isArray(data) ? data : []);
    } catch {
      setLines([]);
    }
    setLoading(false);
  }, [leadId, product]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  const startAdd = () => setDraft({ name: '', volume: '', margin_pct: '', note: '' });
  const cancelAdd = () => setDraft(null);

  const saveAdd = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/leads/${leadId}/product-lines`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          name: draft.name || '',
          volume: parseFloat(draft.volume) || 0,
          margin_pct: parseFloat(draft.margin_pct) || 0,
          note: draft.note || '',
        }),
      });
      if (res.ok) {
        setDraft(null);
        await fetchLines();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const startEdit = (line) => {
    setEditId(line.id);
    setEditDraft({
      name: line.name || '',
      volume: line.volume ?? '',
      margin_pct: line.margin_pct ?? '',
      note: line.note || '',
    });
  };
  const cancelEdit = () => { setEditId(null); setEditDraft(null); };

  const saveEdit = async (lineId) => {
    if (!editDraft) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/leads/${leadId}/product-lines/${lineId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDraft.name || '',
          volume: parseFloat(editDraft.volume) || 0,
          margin_pct: parseFloat(editDraft.margin_pct) || 0,
          note: editDraft.note || '',
        }),
      });
      if (res.ok) {
        cancelEdit();
        await fetchLines();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const deleteLine = async (lineId) => {
    if (!window.confirm('Productregel verwijderen?')) return;
    try {
      await fetch(`${API}/leads/${leadId}/product-lines/${lineId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      await fetchLines();
    } catch { /* ignore */ }
  };

  const totalVolume = lines.reduce((s, l) => s + (Number(l.volume) || 0), 0);
  const totalRevenue = lines.reduce((s, l) => s + (Number(l.revenue) || 0), 0);

  const inputCls =
    'w-full px-2.5 py-1.5 bg-white border border-[#cdd1e0] rounded-lg text-sm focus:outline-none focus:border-[#3d61a4]';

  return (
    <div className="border-t border-[#e8eaf2] pt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold" style={{ color: '#011745' }}>Producten / Volumes</h3>
        {!draft && (
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: accent }}
          >
            <Plus size={14} /> Product toevoegen
          </button>
        )}
      </div>

      <div className="rounded-lg border border-[#e8eaf2] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#f7f8fc' }}>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Product</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Volume (€)</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Marge %</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#7b859e' }}>Revenue (€)</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8eaf2]">
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center"><Loader2 size={18} className="animate-spin inline" style={{ color: accent }} /></td></tr>
            ) : lines.length === 0 && !draft ? (
              <tr><td colSpan={5} className="px-3 py-5 text-center text-sm" style={{ color: '#a4abbe' }}>Nog geen producten toegevoegd.</td></tr>
            ) : (
              lines.map((l) =>
                editId === l.id ? (
                  <tr key={l.id} style={{ backgroundColor: '#f7f8fc' }}>
                    <td className="px-3 py-2">
                      <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="Productnaam" className={inputCls} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={editDraft.volume} onChange={e => setEditDraft(d => ({ ...d, volume: e.target.value }))}
                        placeholder="0" className={`${inputCls} text-right`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" value={editDraft.margin_pct} onChange={e => setEditDraft(d => ({ ...d, margin_pct: e.target.value }))}
                        placeholder="0" className={`${inputCls} text-right`} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: '#011745' }}>
                      {fmtEur((parseFloat(editDraft.volume) || 0) * (parseFloat(editDraft.margin_pct) || 0) / 100)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveEdit(l.id)} disabled={saving} className="p-1 rounded hover:bg-[#eef2fa]" style={{ color: accent }} title="Opslaan">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={cancelEdit} className="p-1 rounded hover:bg-[#eef2fa]" style={{ color: '#7b859e' }} title="Annuleren"><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={l.id} className="hover:bg-[#f7f8fc] cursor-pointer" onClick={() => startEdit(l)}>
                    <td className="px-3 py-2 font-medium" style={{ color: '#011745' }}>
                      {l.name || '—'}
                      {l.note && <span className="block text-xs font-normal" style={{ color: '#a4abbe' }}>{l.note}</span>}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: '#566079' }}>{fmtEur(l.volume)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: '#566079' }}>{(Number(l.margin_pct) || 0).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: '#011745' }}>{fmtEur(l.revenue)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end">
                        <button onClick={(e) => { e.stopPropagation(); deleteLine(l.id); }}
                          className="p-1 rounded text-[#cdd1e0] hover:text-red-500" title="Verwijderen"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}

            {/* Inline new line */}
            {draft && (
              <tr style={{ backgroundColor: '#eef2fa' }}>
                <td className="px-3 py-2">
                  <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                    placeholder="Productnaam (bv. FX EUR/USD)" className={inputCls} autoFocus />
                </td>
                <td className="px-3 py-2">
                  <input type="number" value={draft.volume} onChange={e => setDraft(d => ({ ...d, volume: e.target.value }))}
                    placeholder="0" className={`${inputCls} text-right`} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" step="0.01" value={draft.margin_pct} onChange={e => setDraft(d => ({ ...d, margin_pct: e.target.value }))}
                    placeholder="0" className={`${inputCls} text-right`} />
                </td>
                <td className="px-3 py-2 text-right font-semibold" style={{ color: '#011745' }}>
                  {fmtEur((parseFloat(draft.volume) || 0) * (parseFloat(draft.margin_pct) || 0) / 100)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={saveAdd} disabled={saving} className="p-1 rounded hover:bg-white" style={{ color: accent }} title="Opslaan">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={cancelAdd} className="p-1 rounded hover:bg-white" style={{ color: '#7b859e' }} title="Annuleren"><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${accent}`, backgroundColor: '#f7f8fc' }}>
                <td className="px-3 py-2 text-xs font-bold uppercase" style={{ color: accent }}>Totaal</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: '#011745' }}>{fmtEur(totalVolume)}</td>
                <td />
                <td className="px-3 py-2 text-right font-bold" style={{ color: accent }}>{fmtEur(totalRevenue)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: '#a4abbe' }}>
        Marge in % (bv. 0,5 = 0,5%). Revenue = volume × marge%. Klik op een regel om te bewerken.
      </p>
    </div>
  );
}
