import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users, Gift } from 'lucide-react';

const token = () => sessionStorage.getItem('auth_token');

export default function ContactFamilyPopup({ leadId, contactName, onClose }) {
  const [members, setMembers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relation: '', birth_date: '' });

  useEffect(() => {
    fetch(`/api/v1/leads/${leadId}/family-members`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setMembers);
  }, [leadId]);

  const handleAdd = async () => {
    if (!newMember.name.trim()) return;
    const res = await fetch(`/api/v1/leads/${leadId}/family-members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newMember, contact_name: contactName }),
    });
    if (res.ok) {
      const m = await res.json();
      setMembers(prev => [...prev, m]);
      setNewMember({ name: '', relation: '', birth_date: '' });
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    await fetch(`/api/v1/leads/${leadId}/family-members/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-popup w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-[#e8eaf2] flex items-center justify-between" style={{ backgroundColor: '#011745' }}>
          <div className="flex items-center gap-3">
            <Users size={18} style={{ color: '#eef2fa' }} />
            <div>
              <h3 className="text-base font-bold text-white">Familieleden</h3>
              {contactName && <p className="text-xs" style={{ color: '#a4abbe' }}>van {contactName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-auto">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#011745]">{m.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {m.relation && <span className="text-xs text-[#566079]">{m.relation}</span>}
                  {m.birth_date && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#3d61a4' }}>
                      <Gift size={10} /> {new Date(m.birth_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => handleDelete(m.id)} className="p-1 text-[#cdd1e0] hover:text-red-400 rounded"><Trash2 size={14} /></button>
            </div>
          ))}

          {members.length === 0 && !adding && (
            <p className="text-sm text-center text-[#7b859e] py-4">Nog geen familieleden toegevoegd.</p>
          )}

          {adding && (
            <div className="p-4 bg-[#eef2fa] rounded-xl border border-[#5a7fc2]/20 space-y-3">
              <input placeholder="Naam *" value={newMember.name}
                onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-[#cdd1e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              <input placeholder="Relatie (bijv. kind, partner)" value={newMember.relation}
                onChange={e => setNewMember(p => ({ ...p, relation: e.target.value }))}
                className="w-full border border-[#cdd1e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              <div>
                <label className="text-xs text-[#566079] mb-1 block">Geboortedatum</label>
                <input type="date" value={newMember.birth_date}
                  onChange={e => setNewMember(p => ({ ...p, birth_date: e.target.value }))}
                  className="w-full border border-[#cdd1e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3d61a4]" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: '#3d61a4' }}>Toevoegen</button>
                <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg text-sm border border-[#e8eaf2] text-[#566079]">Annuleren</button>
              </div>
            </div>
          )}
        </div>

        {!adding && (
          <div className="px-5 pb-5">
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[#f7f8fc]"
              style={{ borderColor: '#cdd1e0', color: '#566079' }}>
              <Plus size={14} /> Familielid toevoegen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
