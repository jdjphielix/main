import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Pin, Phone, Check, X } from 'lucide-react';

/** Deterministic color per partner name — same name always same color */
function partnerColor(name) {
  if (!name) return { bg: '#e8eaf2', text: '#566079', dot: '#a4abbe' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return {
    bg:   `hsl(${hue}, 60%, 92%)`,
    text: `hsl(${hue}, 55%, 28%)`,
    dot:  `hsl(${hue}, 70%, 45%)`,
  };
}

const statusColors = {
  New: '#3d61a4',
  Contacted: '#579bfc',
  Callback: '#ff5ac4',
  Interested: '#00c875',
};

const priorityColors = {
  Critical: '#ff642e',
  High: '#ffcb00',
  Medium: '#9cd326',
  Low: '#66ccff',
};

export default function LeadTable({
  leads,
  onSelectLead,
  onToggleDailyList,
  onPinLead,
  pinnedIds = new Set(),
  onClearFilter,
  activeFilter,
  onStatusChange,
}) {
  const [sortBy, setSortBy] = useState('company');
  const [sortOrder, setSortOrder] = useState('asc');
  const [openStatusId, setOpenStatusId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const close = () => setOpenStatusId(null);
    if (openStatusId !== null) {
      document.addEventListener('click', close);
      // Close on scroll/resize so the fixed-position menu never floats detached
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
    }
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openStatusId]);

  // Open the status menu, positioning it (fixed) below/above the clicked button
  const openStatusMenu = (e, leadId) => {
    if (openStatusId === leadId) { setOpenStatusId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const MENU_HEIGHT = 330;
    const below = rect.bottom + 4;
    const flipUp = below + MENU_HEIGHT > window.innerHeight;
    setMenuPos({
      top: flipUp ? Math.max(8, rect.top - MENU_HEIGHT - 4) : below,
      left: Math.min(rect.left, window.innerWidth - 240),
    });
    setOpenStatusId(leadId);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortedLeads = () => {
    const sorted = [...leads];
    sorted.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'company':
          aValue = a.company.toLowerCase();
          bValue = b.company.toLowerCase();
          break;
        case 'contact':
          aValue = a.contactName.toLowerCase();
          bValue = b.contactName.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'priority':
          const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'score':
          // Treat "no score" (null) as lowest so unscored leads sort to the bottom.
          aValue = a.score == null ? -1 : a.score;
          bValue = b.score == null ? -1 : b.score;
          break;
        case 'date':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const SortHeader = ({ label, column }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-[#011745] transition-colors text-[#566079]"
    >
      {label}
      {sortBy === column && (
        sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
      )}
    </button>
  );

  const sortedLeads = getSortedLeads();

  return (
    <div>
      {/* Filter Clear Button */}
      {activeFilter && (
        <div className="px-6 py-3 bg-[#f7f8fc] border-b border-[#e8eaf2] flex items-center justify-between">
          <span className="text-sm text-[#566079]">Active filter: <span className="font-semibold">{activeFilter}</span></span>
          <button
            onClick={onClearFilter}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#cdd1e0] text-[#566079] hover:bg-[#f7f8fc] transition-colors text-sm font-medium"
          >
            <X size={16} />
            Clear filter
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f7f8fc] border-b border-[#e8eaf2]">
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#566079] uppercase tracking-wider">
                <SortHeader label="Bedrijf" column="company" />
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#566079] uppercase tracking-wider">
                <SortHeader label="Contactpersoon" column="contact" />
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#566079] uppercase tracking-wider">
                Mobiel
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#566079] uppercase tracking-wider">
                <SortHeader label="Status" column="status" />
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#566079] uppercase tracking-wider">
                <SortHeader label="Prioriteit" column="priority" />
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#566079] uppercase tracking-wider">
                <SortHeader label="Score" column="score" />
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#566079] uppercase tracking-wider">
                Gebeld
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#566079] uppercase tracking-wider">
                Bellijst
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#566079] uppercase tracking-wider">
                Pin
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map((lead, idx) => (
              <tr
                key={lead.id}
                className="border-b border-[#e8eaf2] hover:bg-[#f7f8fc] transition-colors cursor-pointer"
                onClick={() => onSelectLead(lead)}
              >
                {/* Bedrijf */}
                <td className="px-6 py-4">
                  <p className="font-medium text-[#011745] hover:text-[#3d61a4] transition-colors">
                    {lead.company}
                  </p>
                  <p className="text-xs text-[#a4abbe]">{lead.country}</p>
                  {lead.partnerName && (() => {
                    const pc = partnerColor(lead.partnerName);
                    return (
                      <span
                        className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: pc.bg, color: pc.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: pc.dot }} />
                        {lead.partnerName}
                      </span>
                    );
                  })()}
                </td>

                {/* Contactpersoon */}
                <td className="px-6 py-4">
                  <p className="font-medium text-[#011745]">{lead.contactName}</p>
                  <p className="text-xs text-[#a4abbe]">{lead.position}</p>
                </td>

                {/* Mobiel */}
                <td className="px-6 py-4">
                  <a
                    href={`tel:${lead.mobile}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#00c875] hover:text-[#037f4c] transition-colors text-sm font-medium flex items-center gap-2 w-fit"
                  >
                    <Phone size={16} className="flex-shrink-0" />
                    {lead.mobile}
                  </a>
                </td>

                {/* Status */}
                <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => openStatusMenu(e, lead.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: statusColors[lead.status] || '#3d61a4' }}
                    >
                      {lead.status}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>

                    {openStatusId === lead.id && createPortal((
                      <div
                        className="bg-white rounded-2xl overflow-hidden"
                        style={{
                          position: 'fixed',
                          top: menuPos.top,
                          left: menuPos.left,
                          zIndex: 1000,
                          minWidth: '220px',
                          border: '1px solid #e8eaf2',
                          boxShadow: '0 8px 32px rgba(1,23,69,0.14), 0 2px 8px rgba(1,23,69,0.08)',
                        }}
                        onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="px-4 py-3 border-b border-[#f7f8fc]" style={{ backgroundColor: '#f7f8fc' }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a4abbe' }}>Status wijzigen</p>
                          <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: '#011745' }}>{lead.company}</p>
                        </div>

                        {/* Status opties */}
                        <div className="py-2">
                          {[
                            { status: 'New',           color: '#3d61a4', desc: 'Nog niet benaderd' },
                            { status: 'Contacted',     color: '#579bfc', desc: 'Eerste contact gelegd' },
                            { status: 'Callback',      color: '#ff5ac4', desc: 'Terugbel afspraak' },
                            { status: 'Interested',    color: '#00c875', desc: 'Interesse getoond' },
                          ].map(({ status: s, color, desc }) => {
                            const isActive = lead.status === s;
                            return (
                              <button key={s}
                                onClick={() => { onStatusChange && onStatusChange(lead.id, s); setOpenStatusId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                                style={{ backgroundColor: isActive ? '#f7f8fc' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f7f8fc'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = isActive ? '#f7f8fc' : 'transparent'}>
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-none" style={{ color: '#011745' }}>{s}</p>
                                  <p className="text-[11px] mt-0.5" style={{ color: '#a4abbe' }}>{desc}</p>
                                </div>
                                {isActive && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d61a4" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Separator */}
                        <div className="mx-4 border-t border-[#f7f8fc]" />

                        {/* Geen interesse */}
                        <div className="py-2">
                          {lead.status === 'Not Interested' ? (
                            <button
                              onClick={() => { onStatusChange && onStatusChange(lead.id, 'Contacted'); setOpenStatusId(null); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#16a34a' }} />
                              <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: '#16a34a' }}>Heractiveren</p>
                                <p className="text-[11px]" style={{ color: '#a4abbe' }}>Terug naar Contacted</p>
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => { onStatusChange && onStatusChange(lead.id, 'Geen interesse'); setOpenStatusId(null); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff5f5'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#dc2626' }} />
                              <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: '#dc2626' }}>Geen interesse</p>
                                <p className="text-[11px]" style={{ color: '#a4abbe' }}>Verplaats naar Closed Leads</p>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    ), document.body)}
                  </div>
                </td>

                {/* Prioriteit - Color Dot */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: priorityColors[lead.priority] }}
                    />
                    <span className="text-sm text-[#566079]">{lead.priority}</span>
                  </div>
                </td>

                {/* Score */}
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    {lead.score == null ? (
                      <span className="text-sm text-[#a4abbe]" title="Geen score">—</span>
                    ) : (
                    <div className="relative w-12 h-12">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#e8eaf2"
                          strokeWidth="6"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke={
                            lead.score >= 80
                              ? '#00c875'
                              : lead.score >= 60
                              ? '#ffcb00'
                              : '#ff642e'
                          }
                          strokeWidth="6"
                          strokeDasharray={`${(lead.score / 100) * 283} 283`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#011745]">{lead.score}</span>
                      </div>
                    </div>
                    )}
                  </div>
                </td>

                {/* Gebeld */}
                <td className="px-6 py-4 text-center">
                  {lead.called ? (
                    <Check size={20} className="text-[#00c875] mx-auto" />
                  ) : (
                    <X size={20} className="text-[#ff642e] mx-auto" />
                  )}
                </td>

                {/* Bellijst Toggle */}
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDailyList(lead.id);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      lead.onDailyList
                        ? 'bg-[#00c875] text-white'
                        : 'bg-[#e8eaf2] text-[#566079] hover:bg-[#cdd1e0]'
                    }`}
                  >
                    {lead.onDailyList ? 'Op lijst' : 'Toevoegen'}
                  </button>
                </td>

                {/* Pin Button */}
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinLead(lead.id);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      pinnedIds.has(lead.id)
                        ? 'bg-[#3d61a4] text-white hover:bg-[#0a2d6b]'
                        : 'hover:bg-[#e8eaf2] text-[#7b859e] hover:text-[#3d61a4]'
                    }`}
                    title={pinnedIds.has(lead.id) ? 'Losmaken' : 'Vastpinnen'}
                  >
                    <Pin size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedLeads.length === 0 && (
          <div className="text-center py-12 text-[#7b859e]">
            <p>No leads found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
