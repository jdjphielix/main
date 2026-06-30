import React, { useState } from 'react';
import { Phone, Clock } from 'lucide-react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/** Deterministic color per partner name */
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

const STATUS_ORDER = ['New', 'Contacted', 'Callback', 'Interested'];

// Draggable Lead Card Component
function DraggableLeadCard({ lead, onSelectLead, onToggleDailyList }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelectLead(lead)}
      className={`bg-white rounded-lg p-4 shadow-sm border border-[#e8eaf2] hover:shadow-md hover:border-[#3d61a4] transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-[#3d61a4]' : ''
      }`}
    >
      {/* Company Name */}
      <h4 className="font-semibold text-[#011745] text-sm mb-1 line-clamp-2">
        {lead.company}
      </h4>
      {lead.partnerName && (() => {
        const pc = partnerColor(lead.partnerName);
        return (
          <span
            className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: pc.bg, color: pc.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: pc.dot }} />
            {lead.partnerName}
          </span>
        );
      })()}

      {/* Contact Info */}
      <div className="text-xs text-[#7b859e] mb-3 space-y-1">
        <p>{lead.contactName}</p>
        <p>{lead.country}</p>
      </div>

      {/* Score & Priority Row */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#e8eaf2]">
        {/* Score Circle */}
        {lead.score == null ? (
          <div className="w-10 h-10 flex items-center justify-center" title="Geen score">
            <span className="text-sm font-bold text-[#a4abbe]">—</span>
          </div>
        ) : (
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#e8eaf2"
              strokeWidth="5"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={
                lead.score >= 80
                  ? '#00c875'
                  : lead.score >= 60
                  ? '#ffcb00'
                  : '#ff642e'
              }
              strokeWidth="5"
              strokeDasharray={`${(lead.score / 100) * 251} 251`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-[#011745]">{lead.score}</span>
          </div>
        </div>
        )}

        {/* Priority Dot & Label */}
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: priorityColors[lead.priority] }}
          />
          <span className="text-xs font-medium text-[#566079]">
            {lead.priority}
          </span>
        </div>
      </div>

      {/* Call Status & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-[#7b859e]">
          {lead.called ? (
            <>
              <Phone size={14} className="text-[#00c875]" />
              <span>Called</span>
            </>
          ) : (
            <>
              <Phone size={14} className="text-[#ff642e]" />
              <span>Not called</span>
            </>
          )}
        </div>

        {/* Daily List Toggle */}
        {lead.onDailyList && (
          <div className="flex items-center gap-1 text-xs text-[#ffcb00] font-medium">
            <Clock size={14} />
            Today
          </div>
        )}
      </div>

      {/* Quick Action Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDailyList(lead.id);
        }}
        className={`w-full mt-3 py-2 rounded-lg text-xs font-medium transition-colors ${
          lead.onDailyList
            ? 'bg-[#ffcb00] text-[#011745]'
            : 'bg-[#f7f8fc] text-[#566079] hover:bg-[#e8eaf2]'
        }`}
      >
        {lead.onDailyList ? 'Op bellijst' : 'Toevoegen aan bellijst'}
      </button>
    </div>
  );
}

// Droppable Column Component
function DroppableColumn({
  status,
  statusLeads,
  onSelectLead,
  onToggleDailyList,
  activeId,
}) {
  const { setNodeRef, isOver } = useSortable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
  });

  const leadIds = statusLeads.map((lead) => lead.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 ${
        isOver ? 'bg-[#eef2fa] rounded-lg p-2' : ''
      } transition-colors`}
    >
      {/* Column Header */}
      <div className="mb-4">
        <h3 className="font-semibold text-[#011745] text-sm uppercase tracking-wider flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: statusColors[status] }}
          />
          {status}
          <span className="text-[#a4abbe] font-normal ml-auto">
            {statusLeads.length}
          </span>
        </h3>
      </div>

      {/* Cards Container */}
      <SortableContext
        items={leadIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 pb-4 min-h-96">
          {statusLeads.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center border-2 border-dashed border-[#e8eaf2] text-[#a4abbe] text-sm">
              No leads
            </div>
          ) : (
            statusLeads.map((lead) => (
              <DraggableLeadCard
                key={lead.id}
                lead={lead}
                onSelectLead={onSelectLead}
                onToggleDailyList={onToggleDailyList}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function LeadKanban({
  leads,
  onSelectLead,
  onToggleDailyList,
  onStatusChange,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getLeadsByStatus = (status) => {
    return leads.filter((lead) => lead.status === status);
  };

  const getLeadById = (id) => {
    return leads.find((lead) => lead.id === id);
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Dragging a lead to a column
    if (activeData?.type === 'Card' && overData?.type === 'Column') {
      const lead = getLeadById(active.id);
      if (lead && lead.status !== overData.status && onStatusChange) {
        onStatusChange(lead.id, overData.status);
      }
    }

    // Dragging a lead over another lead (same column reorder)
    if (activeData?.type === 'Card' && overData?.type === 'Card') {
      const activeLead = getLeadById(active.id);
      const overLead = getLeadById(over.id);

      // If moving to a different status, update it
      if (
        activeLead &&
        overLead &&
        activeLead.status !== overLead.status &&
        onStatusChange
      ) {
        onStatusChange(activeLead.id, overLead.status);
      }
    }
  };

  const activeLead = activeId ? getLeadById(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-6 p-8 overflow-x-auto h-full bg-[#f7f8fc]">
        {STATUS_ORDER.map((status) => {
          const statusLeads = getLeadsByStatus(status);
          return (
            <DroppableColumn
              key={status}
              status={status}
              statusLeads={statusLeads}
              onSelectLead={onSelectLead}
              onToggleDailyList={onToggleDailyList}
              activeId={activeId}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="bg-white rounded-lg p-4 shadow-lg border border-[#3d61a4] w-80 opacity-95">
            <h4 className="font-semibold text-[#011745] text-sm mb-2">
              {activeLead.company}
            </h4>
            <div className="text-xs text-[#7b859e]">
              <p>{activeLead.contactName}</p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
