import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar, Clock, Building2, User, Loader2, AlertCircle, Pencil, Trash2, Save, ExternalLink } from 'lucide-react';

const MONTHS_NL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];
const WEEKDAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const getToken = () => sessionStorage.getItem('auth_token');

export default function CallbackAgendaPopup({ isOpen, onClose, onOpenLead }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(null); // Date object or null
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', time: '', callback_type: 'call', internal_note: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (cb) => {
    const d = cb.scheduled_at ? new Date(cb.scheduled_at) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    setEditForm({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      callback_type: cb.callback_type || 'call',
      internal_note: cb.internal_note || '',
    });
    setEditingId(cb.id);
  };

  const saveEdit = async (cbId) => {
    setSavingEdit(true);
    try {
      const scheduled_at = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
      const res = await fetch(`/api/v1/callbacks/${cbId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_at,
          callback_type: editForm.callback_type,
          internal_note: editForm.internal_note,
        }),
      });
      if (!res.ok) throw new Error('Opslaan mislukt');
      setEditingId(null);
      await fetchCallbacks();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteCallback = async (cbId) => {
    if (!window.confirm('Deze callback verwijderen?')) return;
    try {
      const res = await fetch(`/api/v1/callbacks/${cbId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Verwijderen mislukt');
      await fetchCallbacks();
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchCallbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/callbacks/?today_only=false', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Kon callbacks niet ophalen');
      const data = await res.json();
      setCallbacks(data.callbacks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCallbacks();
      setSelectedDay(null);
    }
  }, [isOpen, fetchCallbacks]);

  if (!isOpen) return null;

  // ─── Calendar math ────────────────────────────────
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  // Monday = 0 in our grid (getDay returns 0=Sun, so we convert)
  const startDow = (firstDayOfMonth.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Build calendar grid cells
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  // Index callbacks by date string "YYYY-MM-DD"
  const cbsByDate = {};
  callbacks.forEach(cb => {
    if (!cb.scheduled_at) return;
    const d = new Date(cb.scheduled_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!cbsByDate[key]) cbsByDate[key] = [];
    cbsByDate[key].push(cb);
  });

  const makeDateKey = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isToday = (day) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const isSelected = (day) =>
    selectedDay &&
    day === selectedDay.getDate() &&
    viewMonth === selectedDay.getMonth() &&
    viewYear === selectedDay.getFullYear();

  const handleDayClick = (day) => {
    if (!day) return;
    setSelectedDay(new Date(viewYear, viewMonth, day));
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Callbacks for the selected day
  const selectedKey = selectedDay
    ? makeDateKey(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate())
    : null;
  const selectedCallbacks = selectedKey ? (cbsByDate[selectedKey] || []) : [];

  function formatTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function formatSelectedDate(d) {
    if (!d) return '';
    return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e8eaf2] flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: '#011745' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Calendar size={20} style={{ color: '#eef2fa' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Callback Agenda</h2>
              <p className="text-xs" style={{ color: '#a4abbe' }}>
                Alle geplande terugbelafspraken
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: '#a4abbe' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body: calendar + detail side by side */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: Calendar */}
          <div className="flex flex-col w-80 flex-shrink-0 border-r border-[#e8eaf2] p-4">

            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors"
                style={{ color: '#3d61a4' }}>
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold" style={{ color: '#011745' }}>
                {MONTHS_NL[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-[#eef2fa] transition-colors"
                style={{ color: '#3d61a4' }}>
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS_NL.map(d => (
                <div key={d} className="text-center text-[10px] font-bold pb-1"
                  style={{ color: '#a4abbe' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            {loading ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2">
                <Loader2 size={24} className="animate-spin" style={{ color: '#3d61a4' }} />
                <p className="text-xs" style={{ color: '#7b859e' }}>Laden...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2">
                <AlertCircle size={22} style={{ color: '#df2f4a' }} />
                <p className="text-xs text-center" style={{ color: '#df2f4a' }}>{error}</p>
                <button onClick={fetchCallbacks}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: '#3d61a4', backgroundColor: '#eef2fa' }}>
                  Opnieuw
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((day, idx) => {
                  const key = day ? makeDateKey(viewYear, viewMonth, day) : null;
                  const hasCbs = key && cbsByDate[key] && cbsByDate[key].length > 0;
                  const todayDay = isToday(day);
                  const selDay = isSelected(day);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDayClick(day)}
                      className={`relative flex flex-col items-center justify-center h-9 rounded-lg text-xs font-medium transition-all
                        ${day ? 'cursor-pointer' : ''}
                        ${selDay ? 'text-white' : todayDay ? '' : day ? 'hover:bg-[#eef2fa]' : ''}
                      `}
                      style={{
                        backgroundColor: selDay ? '#3d61a4' : todayDay && !selDay ? '#eef2fa' : undefined,
                        color: selDay ? '#fff' : todayDay ? '#3d61a4' : day ? '#252f4a' : undefined,
                        fontWeight: todayDay || selDay ? 700 : undefined,
                      }}
                    >
                      {day || ''}
                      {hasCbs && (
                        <span
                          className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: selDay ? '#fff' : '#3d61a4' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-[#e8eaf2] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#3d61a4' }} />
              <span className="text-[11px]" style={{ color: '#7b859e' }}>Dag heeft callbacks</span>
            </div>

            {/* Month summary */}
            {!loading && !error && (
              <div className="mt-2 text-[11px]" style={{ color: '#a4abbe' }}>
                {(() => {
                  const monthCallbacks = Object.entries(cbsByDate).filter(([k]) => {
                    const [y, m] = k.split('-').map(Number);
                    return y === viewYear && m === viewMonth + 1;
                  }).reduce((acc, [, v]) => acc + v.length, 0);
                  return monthCallbacks > 0
                    ? `${monthCallbacks} callback${monthCallbacks !== 1 ? 's' : ''} deze maand`
                    : 'Geen callbacks deze maand';
                })()}
              </div>
            )}
          </div>

          {/* Right: Day detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedDay ? (
              <>
                {/* Day header */}
                <div className="px-5 py-3 border-b border-[#e8eaf2] flex-shrink-0"
                  style={{ backgroundColor: '#f7f8fc' }}>
                  <p className="text-sm font-bold capitalize" style={{ color: '#011745' }}>
                    {formatSelectedDate(selectedDay)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#7b859e' }}>
                    {selectedCallbacks.length === 0
                      ? 'Geen callbacks'
                      : `${selectedCallbacks.length} callback${selectedCallbacks.length !== 1 ? 's' : ''}`}
                  </p>
                </div>

                {/* Callback list */}
                <div className="flex-1 overflow-auto p-4">
                  {selectedCallbacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#eef2fa' }}>
                        <Calendar size={24} style={{ color: '#3d61a4' }} />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: '#011745' }}>
                        Geen callbacks gepland
                      </p>
                      <p className="text-xs text-center" style={{ color: '#7b859e' }}>
                        Kies een dag met een blauwe stip om callbacks te zien
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCallbacks
                        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                        .map(cb => {
                          const leadName = cb.lead?.company_name || `Lead #${cb.lead_id}`;
                          const contactName = cb.lead?.contact_name;
                          const isPast = new Date(cb.scheduled_at) < new Date();

                          const isEditing = editingId === cb.id;

                          if (isEditing) {
                            return (
                              <div key={cb.id} className="rounded-xl border p-4"
                                style={{ borderColor: '#3d61a4', backgroundColor: '#f7f8fc' }}>
                                <p className="text-xs font-bold mb-2" style={{ color: '#011745' }}>
                                  Callback bewerken — {leadName}
                                </p>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#7b859e' }}>Datum</label>
                                    <input type="date" value={editForm.date}
                                      onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                      className="w-full px-2 py-1.5 rounded-lg border text-xs"
                                      style={{ borderColor: '#cdd1e0', color: '#252f4a' }} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#7b859e' }}>Tijd</label>
                                    <input type="time" value={editForm.time}
                                      onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                                      className="w-full px-2 py-1.5 rounded-lg border text-xs"
                                      style={{ borderColor: '#cdd1e0', color: '#252f4a' }} />
                                  </div>
                                </div>
                                <div className="mb-2">
                                  <label className="text-[10px] font-semibold" style={{ color: '#7b859e' }}>Type</label>
                                  <select value={editForm.callback_type}
                                    onChange={e => setEditForm(f => ({ ...f, callback_type: e.target.value }))}
                                    className="w-full px-2 py-1.5 rounded-lg border text-xs"
                                    style={{ borderColor: '#cdd1e0', color: '#252f4a' }}>
                                    <option value="call">Telefoongesprek</option>
                                    <option value="meeting">Meeting</option>
                                  </select>
                                </div>
                                <div className="mb-3">
                                  <label className="text-[10px] font-semibold" style={{ color: '#7b859e' }}>Notitie</label>
                                  <textarea value={editForm.internal_note} rows={2}
                                    onChange={e => setEditForm(f => ({ ...f, internal_note: e.target.value }))}
                                    className="w-full px-2 py-1.5 rounded-lg border text-xs resize-none"
                                    style={{ borderColor: '#cdd1e0', color: '#252f4a' }} />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEdit(cb.id)} disabled={savingEdit}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-50"
                                    style={{ backgroundColor: '#3d61a4' }}>
                                    {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    Opslaan
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#7b859e' }}>
                                    Annuleer
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={cb.id}
                              className="rounded-xl border p-4 transition-all hover:shadow-md group"
                              style={{
                                borderColor: '#e8eaf2',
                                backgroundColor: '#fff',
                              }}
                            >
                              <div className="flex items-start gap-3">
                                {/* Time */}
                                <div className="flex-shrink-0 text-center min-w-[44px]">
                                  <div className="text-xs font-bold" style={{ color: isPast ? '#a4abbe' : '#3d61a4' }}>
                                    {formatTime(cb.scheduled_at)}
                                  </div>
                                  {cb.callback_type && (
                                    <div className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded-md"
                                      style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                                      {cb.callback_type === 'call' ? 'Bel' : 'Meeting'}
                                    </div>
                                  )}
                                </div>

                                {/* Info — click opens the lead/prospect */}
                                <div className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => onOpenLead && onOpenLead(cb.lead_id, cb.lead?.pipeline_stage)}>
                                  <div className="flex items-center gap-2">
                                    <Building2 size={13} style={{ color: '#3d61a4', flexShrink: 0 }} />
                                    <span className="text-sm font-semibold truncate group-hover:text-[#3d61a4] transition-colors"
                                      style={{ color: '#011745' }}>
                                      {leadName}
                                    </span>
                                    <ExternalLink size={11} style={{ color: '#a4abbe', flexShrink: 0 }} />
                                  </div>
                                  {contactName && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <User size={11} style={{ color: '#a4abbe', flexShrink: 0 }} />
                                      <span className="text-xs truncate" style={{ color: '#566079' }}>
                                        {contactName}
                                      </span>
                                    </div>
                                  )}
                                  {cb.internal_note && (
                                    <p className="text-xs mt-2 px-2 py-1.5 rounded-lg line-clamp-2"
                                      style={{ backgroundColor: '#f4f6fb', color: '#566079' }}>
                                      {cb.internal_note}
                                    </p>
                                  )}
                                  {cb.created_by_name && (
                                    <p className="text-[10px] mt-1.5" style={{ color: '#a4abbe' }}>
                                      Ingepland door {cb.created_by_name}
                                    </p>
                                  )}
                                </div>

                                {/* Actions: edit + delete */}
                                <div className="flex-shrink-0 flex flex-col gap-1">
                                  <button onClick={() => startEdit(cb)} title="Bewerken"
                                    className="p-1.5 rounded-lg hover:bg-[#eef2fa]" style={{ color: '#3d61a4' }}>
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteCallback(cb.id)} title="Verwijderen"
                                    className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: '#df2f4a' }}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: '#eef2fa' }}>
                  <Calendar size={28} style={{ color: '#3d61a4' }} />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold" style={{ color: '#011745' }}>
                    Selecteer een dag
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#7b859e' }}>
                    Klik op een dag in de kalender om de callbacks te bekijken
                  </p>
                </div>
                {!loading && !error && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                    style={{ backgroundColor: '#eef2fa' }}>
                    <Clock size={14} style={{ color: '#3d61a4' }} />
                    <span className="text-xs font-medium" style={{ color: '#3d61a4' }}>
                      {callbacks.length} totale callbacks geladen
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
