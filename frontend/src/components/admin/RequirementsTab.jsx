import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, AlertCircle, ClipboardCheck, Edit3, Save,
  ToggleLeft, ToggleRight
} from 'lucide-react';
import { api } from './adminHelpers';

function RequirementsTab() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productFilter, setProductFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', product_type: 'taperpay', is_required: true, sort_order: 1 });
  const [saving, setSaving] = useState(false);

  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/v1/admin/onboarding-requirements');
      setRequirements(data.requirements || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequirements(); }, [fetchRequirements]);

  const filtered = productFilter === 'all'
    ? requirements
    : requirements.filter(r => r.product_type === productFilter);

  const payCount = requirements.filter(r => r.product_type === 'taperpay' && r.is_active).length;
  const tradeCount = requirements.filter(r => r.product_type === 'tapertrade' && r.is_active).length;

  function startEdit(req) {
    setEditingId(req.id);
    setFormData({ name: req.name, description: req.description || '', product_type: req.product_type, is_required: req.is_required, sort_order: req.sort_order });
    setShowAdd(false);
  }

  function startAdd() {
    setEditingId(null);
    const maxOrder = filtered.length > 0 ? Math.max(...filtered.map(r => r.sort_order)) + 1 : 1;
    setFormData({ name: '', description: '', product_type: productFilter === 'all' ? 'taperpay' : productFilter, is_required: true, sort_order: maxOrder });
    setShowAdd(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api(`/api/v1/admin/onboarding-requirements/${editingId}`, { method: 'PUT', body: JSON.stringify(formData) });
      } else {
        await api('/api/v1/admin/onboarding-requirements', { method: 'POST', body: JSON.stringify(formData) });
      }
      setEditingId(null);
      setShowAdd(false);
      fetchRequirements();
    } catch (err) { alert('Fout: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(req) {
    try {
      if (req.is_active) {
        await api(`/api/v1/admin/onboarding-requirements/${req.id}`, { method: 'DELETE' });
      } else {
        await api(`/api/v1/admin/onboarding-requirements/${req.id}`, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
      }
      fetchRequirements();
    } catch (err) { alert('Fout: ' + err.message); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1">
          {[
            { key: 'all', label: `Alle (${requirements.filter(r => r.is_active).length})` },
            { key: 'taperpay', label: `TaperPay (${payCount})` },
            { key: 'tapertrade', label: `TaperTrade (${tradeCount})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setProductFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${productFilter === tab.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              style={{ color: productFilter === tab.key ? '#3d61a4' : '#7b859e' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:shadow-lg"
          style={{ backgroundColor: '#3d61a4' }}>
          <Plus size={18} /> Vereiste Toevoegen
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertCircle size={20} /><span className="text-sm">{error}</span>
        </div>
      )}

      {(showAdd || editingId) && (
        <div className="bg-white rounded-xl border-2 border-[#3d61a4]/30 p-5 mb-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3" style={{ color: '#011745' }}>
            {editingId ? 'Vereiste Bewerken' : 'Nieuwe Vereiste'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Naam *</label>
              <input type="text" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="KvK Uittreksel / Certificate of Incorporation"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                style={{ color: '#011745' }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Product</label>
                <select value={formData.product_type} onChange={e => setFormData({ ...formData, product_type: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }}>
                  <option value="taperpay">TaperPay</option>
                  <option value="tapertrade">TaperTrade</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Volgorde</label>
                <input type="number" value={formData.sort_order}
                  onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
                  style={{ color: '#011745' }} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.is_required}
                    onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                    className="rounded" />
                  <span className="text-xs font-medium" style={{ color: '#566079' }}>Verplicht</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1" style={{ color: '#566079' }}>Omschrijving</label>
            <input type="text" value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Officieel uittreksel van de Kamer van Koophandel of equivalent"
              className="w-full px-3 py-2.5 rounded-lg border border-[#e8eaf2] text-sm focus:outline-none focus:border-[#3d61a4]"
              style={{ color: '#011745' }} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setEditingId(null); }}
              className="px-4 py-2 rounded-lg text-sm" style={{ color: '#7b859e' }}>Annuleer</button>
            <button onClick={handleSave} disabled={saving || !formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: '#3d61a4' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingId ? 'Opslaan' : 'Toevoegen'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3d61a4' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck size={40} className="mx-auto mb-3" style={{ color: '#cdd1e0' }} />
          <p className="font-semibold" style={{ color: '#011745' }}>Geen vereisten gevonden</p>
          <p className="text-sm mt-1" style={{ color: '#7b859e' }}>Voeg een nieuwe onboarding vereiste toe</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <div key={req.id}
              className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-all ${
                !req.is_active ? 'opacity-50 border-[#e8eaf2]' : 'border-[#e8eaf2] hover:border-[#3d61a4]/30'
              }`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                {req.sort_order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold truncate" style={{ color: '#011745' }}>{req.name}</h4>
                  {req.is_required && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-semibold flex-shrink-0">VERPLICHT</span>
                  )}
                </div>
                {req.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#7b859e' }}>{req.description}</p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${
                req.product_type === 'taperpay' ? 'bg-[#eef2fa] text-[#3d61a4]' : 'bg-[#fef3c7] text-[#92400e]'
              }`}>
                {req.product_type === 'taperpay' ? 'TaperPay' : 'TaperTrade'}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(req)}
                  className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }} title="Bewerken">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => handleToggleActive(req)}
                  className="p-1.5 rounded-lg hover:bg-[#f3f4f8] transition-colors" title={req.is_active ? 'Deactiveren' : 'Activeren'}>
                  {req.is_active ? (
                    <ToggleRight size={18} className="text-green-500" />
                  ) : (
                    <ToggleLeft size={18} style={{ color: '#a4abbe' }} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TAB: P&L Management
   ═══════════════════════════════════════════════════════════════ */

export default RequirementsTab;
