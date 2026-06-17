import React, { useState } from 'react';
import { Phone, Clock, GripVertical, CheckCircle } from 'lucide-react';

const priorityColors = {
  Critical: '#ff642e',
  High: '#ffcb00',
  Medium: '#9cd326',
  Low: '#66ccff',
};

export default function DailyCallList({ leads, onSelectLead }) {
  const [callList, setCallList] = useState(
    leads.sort((a, b) => {
      const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
  );
  const [draggedId, setDraggedId] = useState(null);

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (draggedId === targetId) return;

    const draggedIndex = callList.findIndex(l => l.id === draggedId);
    const targetIndex = callList.findIndex(l => l.id === targetId);

    const newList = [...callList];
    newList.splice(draggedIndex, 1);
    newList.splice(targetIndex, 0, callList[draggedIndex]);

    setCallList(newList);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleCompanyClick = (lead) => {
    if (onSelectLead) {
      onSelectLead(lead);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#e8eaf2]">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={20} className="text-[#3d61a4]" />
          <h2 className="text-lg font-bold text-[#011745]">Bellijst vandaag</h2>
        </div>
        <p className="text-xs text-[#a4abbe]">{callList.length} calls scheduled</p>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto">
        {callList.length === 0 ? (
          <div className="p-6 text-center text-[#a4abbe]">
            <p className="text-sm">No calls scheduled for today</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {callList.map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => handleDragStart(e, lead.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, lead.id)}
                onDragEnd={handleDragEnd}
                className={`p-4 rounded-lg border transition-all ${
                  draggedId === lead.id
                    ? 'bg-[#eef2fa] border-[#3d61a4] opacity-60 cursor-move'
                    : 'bg-white border-[#e8eaf2] hover:border-[#3d61a4] hover:shadow-sm cursor-move'
                }`}
              >
                {/* Drag Handle & Priority */}
                <div className="flex items-start gap-3 mb-2">
                  <GripVertical
                    size={16}
                    className="text-[#a4abbe] mt-0.5 flex-shrink-0"
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: priorityColors[lead.priority] }}
                  />
                  <div className="flex-1 min-w-0">
                    {/* Company Name - Clickable */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompanyClick(lead);
                      }}
                      className="text-left font-semibold text-[#011745] text-sm line-clamp-1 hover:text-[#3d61a4] transition-colors underline"
                    >
                      {lead.company}
                    </button>
                    {/* Contact */}
                    <p className="text-xs text-[#7b859e] line-clamp-1">
                      {lead.contactName}
                    </p>
                  </div>
                  {lead.called && (
                    <CheckCircle
                      size={16}
                      className="text-[#00c875] flex-shrink-0 mt-1"
                    />
                  )}
                </div>

                {/* Phone Number - Clickable */}
                <a
                  href={`tel:${lead.mobile}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-[#00c875] hover:text-[#037f4c] text-xs font-medium px-2 py-1.5 rounded transition-colors hover:bg-[#f0fdf4] w-fit"
                >
                  <Phone size={14} />
                  {lead.mobile}
                </a>

                {/* Quick Checkbox */}
                <div className="mt-3 pt-3 border-t border-[#e8eaf2]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lead.called}
                      onChange={() => {
                        // Toggle called status
                        console.log('Toggle called for:', lead.id);
                      }}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-xs text-[#7b859e]">
                      {lead.called ? 'Called' : 'Mark as called'}
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {callList.length > 0 && (
        <div className="px-6 py-4 border-t border-[#e8eaf2] bg-[#f7f8fc]">
          <div className="text-xs text-[#7b859e] space-y-1">
            <p>
              <span className="font-semibold text-[#011745]">
                {callList.filter(l => l.called).length}
              </span>
              {' '}called
            </p>
            <p>
              <span className="font-semibold text-[#011745]">
                {callList.filter(l => !l.called).length}
              </span>
              {' '}remaining
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
