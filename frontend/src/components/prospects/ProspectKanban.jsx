import React, { useMemo, useState } from 'react';
import { Check, X, Flame } from 'lucide-react';
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

const STATUSES = ['Discovery', 'In Negotiation', 'Proposal Sent', 'Onboarding'];

// Draggable Prospect Card Component
function DraggableProspectCard({ prospect, onSelectProspect, getPriorityBorder, onToggleHot }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prospect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasRevenue = (prospect.revenuePotential || 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelectProspect(prospect)}
      className={`${getPriorityBorder(prospect.priority)} bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing border border-[#e8eaf2] ${
        isDragging ? 'ring-2 ring-[#3d61a4]' : ''
      } ${prospect.isHot ? 'ring-1 ring-orange-200' : ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[#011745] text-sm line-clamp-2">
            {prospect.isHot && <span className="text-orange-500 mr-1 text-xs">🔥</span>}
            {prospect.company}
          </h4>
          <p className="text-xs text-[#7b859e] mt-1">{prospect.contactName}</p>
        </div>
        {onToggleHot && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHot(prospect.id);
            }}
            disabled={!prospect.isHot && !hasRevenue}
            title={prospect.isHot ? 'Hot prospect — klik om te verwijderen' : (hasRevenue ? 'Markeer als hot prospect' : 'Stel eerst FX of TF revenue in')}
            className={`flex-shrink-0 p-1 rounded transition-all ${
              prospect.isHot
                ? 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                : hasRevenue
                  ? 'text-[#cdd1e0] hover:text-orange-400 hover:bg-orange-50'
                  : 'text-[#e8eaf2] cursor-not-allowed'
            }`}
          >
            <Flame size={15} fill={prospect.isHot ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Service Badges */}
      <div className="flex gap-2 mb-3">
        {prospect.taperPayActive && (
          <div className="flex items-center gap-1 bg-[#eef2fa] px-2 py-1 rounded text-xs">
            <Check size={12} className="text-[#3d61a4]" />
            <span className="text-[#3d61a4] font-medium">FX</span>
          </div>
        )}
        {prospect.taperTradeActive && (
          <div className="flex items-center gap-1 bg-[#e8f5e9] px-2 py-1 rounded text-xs">
            <Check size={12} className="text-[#4caf50]" />
            <span className="text-[#4caf50] font-medium">TF</span>
          </div>
        )}
        {!prospect.taperPayActive && !prospect.taperTradeActive && (
          <div className="text-xs text-[#a4abbe]">No services activated</div>
        )}
      </div>

      {/* Volumes */}
      <div className="space-y-1 mb-3 border-t border-[#e8eaf2] pt-3">
        {prospect.fxVolume > 0 && (
          <p className="text-xs text-[#7b859e]">
            FX Vol:{' '}
            <span className="font-medium text-[#011745]">
              {(prospect.fxVolume / 1000000).toFixed(1)}M
            </span>
          </p>
        )}
        {prospect.tfVolume > 0 && (
          <p className="text-xs text-[#7b859e]">
            TF Vol:{' '}
            <span className="font-medium text-[#011745]">
              {(prospect.tfVolume / 1000000).toFixed(1)}M
            </span>
          </p>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e8eaf2]">
        <span className="text-xs font-medium text-[#566079]">Score</span>
        <div className="flex items-center gap-1">
          <div className="h-2 w-16 bg-[#e8eaf2] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3d61a4] transition-all"
              style={{ width: `${prospect.score}%` }}
            ></div>
          </div>
          <span className="text-xs font-semibold text-[#011745]">
            {prospect.score}
          </span>
        </div>
      </div>
    </div>
  );
}

// Droppable Column Component
function DroppableColumn({
  status,
  prospects,
  onSelectProspect,
  getStatusBgColor,
  getStatusTextColor,
  getPriorityBorder,
  activeId,
  onToggleHot,
}) {
  const { setNodeRef, isOver } = useSortable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
  });

  const prospectIds = prospects.map((prospect) => prospect.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 ${
        isOver ? 'bg-[#eef2fa] rounded-lg p-2' : ''
      } transition-colors`}
    >
      {/* Column Header */}
      <div className={`${getStatusBgColor(status)} rounded-lg p-4 mb-4 flex items-center justify-between`}>
        <h3 className={`font-semibold ${getStatusTextColor(status)}`}>
          {status}
        </h3>
        <span className="text-sm font-medium text-[#7b859e]">
          {prospects.length}
        </span>
      </div>

      {/* Cards Container */}
      <SortableContext
        items={prospectIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 pb-4 min-h-96">
          {prospects.length === 0 ? (
            <div className="text-center py-8 text-[#a4abbe]">
              <p className="text-sm">No prospects</p>
            </div>
          ) : (
            prospects.map((prospect) => (
              <DraggableProspectCard
                key={prospect.id}
                prospect={prospect}
                onSelectProspect={onSelectProspect}
                getPriorityBorder={getPriorityBorder}
                onToggleHot={onToggleHot}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function ProspectKanban({
  prospects,
  onSelectProspect,
  onStatusChange,
  onToggleHot,
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

  const columns = useMemo(() => {
    const cols = {};
    STATUSES.forEach((status) => {
      cols[status] = prospects.filter((p) => p.status === status);
    });
    return cols;
  }, [prospects]);

  const getStatusBgColor = (status) => {
    const colors = {
      Discovery: 'bg-[#eef2fa]',
      'In Negotiation': 'bg-[#fff4e6]',
      'Proposal Sent': 'bg-[#f3e5f5]',
      Onboarding: 'bg-[#e8f5e9]',
    };
    return colors[status] || 'bg-[#f7f8fc]';
  };

  const getStatusTextColor = (status) => {
    const colors = {
      Discovery: 'text-[#3d61a4]',
      'In Negotiation': 'text-[#ff9800]',
      'Proposal Sent': 'text-[#9c27b0]',
      Onboarding: 'text-[#4caf50]',
    };
    return colors[status] || 'text-[#566079]';
  };

  const getPriorityBorder = (priority) => {
    const colors = {
      Critical: 'border-l-4 border-red-500',
      High: 'border-l-4 border-orange-500',
      Medium: 'border-l-4 border-blue-500',
      Low: 'border-l-4 border-gray-400',
    };
    return colors[priority] || 'border-l-4 border-gray-300';
  };

  const getProspectById = (id) => {
    return prospects.find((prospect) => prospect.id === id);
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

    // Dragging a prospect to a column
    if (activeData?.type === 'Card' && overData?.type === 'Column') {
      const prospect = getProspectById(active.id);
      if (prospect && prospect.status !== overData.status && onStatusChange) {
        onStatusChange(prospect.id, overData.status);
      }
    }

    // Dragging a prospect over another prospect (same column reorder)
    if (activeData?.type === 'Card' && overData?.type === 'Card') {
      const activeProspect = getProspectById(active.id);
      const overProspect = getProspectById(over.id);

      // If moving to a different status, update it
      if (
        activeProspect &&
        overProspect &&
        activeProspect.status !== overProspect.status &&
        onStatusChange
      ) {
        onStatusChange(activeProspect.id, overProspect.status);
      }
    }
  };

  const activeProspect = activeId ? getProspectById(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="p-6 h-full overflow-x-auto bg-[#f7f8fc]">
        <div className="flex gap-6 min-w-full">
          {STATUSES.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              prospects={columns[status]}
              onSelectProspect={onSelectProspect}
              getStatusBgColor={getStatusBgColor}
              getStatusTextColor={getStatusTextColor}
              getPriorityBorder={getPriorityBorder}
              activeId={activeId}
              onToggleHot={onToggleHot}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeProspect ? (
          <div className="bg-white rounded-lg p-4 shadow-lg border border-[#3d61a4] w-80 opacity-95">
            <h4 className="font-semibold text-[#011745] text-sm line-clamp-2">
              {activeProspect.company}
            </h4>
            <p className="text-xs text-[#7b859e] mt-1">
              {activeProspect.contactName}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
