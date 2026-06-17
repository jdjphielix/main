import React, { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';

function DropZone({ onFiles, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = Array.from(e.dataTransfer.files); if (f.length) onFiles(f); }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
        dragging ? 'border-[#3d61a4] bg-[#eef2fa]' : 'border-[#cdd1e0] hover:border-[#3d61a4] hover:bg-[#f7f8fc]'
      }`}>
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); }} />
      {uploading ? (
        <div className="flex flex-col items-center gap-1.5">
          <Loader2 size={18} className="animate-spin" style={{ color: '#3d61a4' }} />
          <p className="text-xs" style={{ color: '#7b859e' }}>Uploaden...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <Upload size={18} style={{ color: dragging ? '#3d61a4' : '#a4abbe' }} />
          <p className="text-xs font-medium" style={{ color: dragging ? '#3d61a4' : '#7b859e' }}>
            Sleep of klik om documenten toe te voegen
          </p>
        </div>
      )}
    </div>
  );
}

export default DropZone;
