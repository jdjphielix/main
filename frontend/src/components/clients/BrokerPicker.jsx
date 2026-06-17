import React from 'react';
import { BROKERS } from './clientsHelpers';


function BrokerPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BROKERS.map(b => (
        <button key={b.key} type="button"
          onClick={() => onChange(value === b.key ? null : b.key)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all"
          style={value === b.key
            ? { backgroundColor: b.color, borderColor: b.color, color: '#fff' }
            : { backgroundColor: '#f7f8fc', borderColor: '#e8eaf2', color: '#566079' }
          }>
          {b.label}
        </button>
      ))}
      {value && (
        <button type="button" onClick={() => onChange(null)}
          className="px-2 py-1.5 rounded-lg text-xs border-2 border-dashed border-[#e8eaf2] text-[#a4abbe] hover:border-red-300 hover:text-red-400 transition-all">
          ✕ Wis
        </button>
      )}
    </div>
  );
}

export default BrokerPicker;
