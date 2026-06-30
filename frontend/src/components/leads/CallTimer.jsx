import React, { useState, useEffect } from 'react';
import { Play, Pause, StopCircle, CheckCircle } from 'lucide-react';

export default function CallTimer({ onLogCall, onCancel }) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [outcome, setOutcome] = useState('completed');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogCall = () => {
    onLogCall({
      duration: Math.floor(seconds / 60),
      outcome,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-popup p-8 w-full max-w-sm">
        {/* Timer Display */}
        <div className="text-center mb-8">
          <p className="text-[#a4abbe] text-sm mb-4">Call Duration</p>
          <div className="text-6xl font-bold text-[#3d61a4] font-mono mb-4">
            {formatTime(seconds)}
          </div>
          <p className="text-[#7b859e] text-sm">
            {Math.floor(seconds / 60)} minutes {seconds % 60} seconds
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              isRunning
                ? 'bg-[#ff642e] hover:bg-[#e6532a] text-white'
                : 'bg-[#00c875] hover:bg-[#037f4c] text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause size={18} />
                Pause
              </>
            ) : (
              <>
                <Play size={18} />
                Resume
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg font-medium bg-[#e8eaf2] hover:bg-[#cdd1e0] text-[#566079] transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Outcome Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#566079] mb-3 uppercase tracking-wider">
            Call Outcome
          </label>
          <div className="space-y-2">
            {[
              { value: 'completed', label: 'Completed' },
              { value: 'no_answer', label: 'No Answer' },
              { value: 'callback', label: 'Callback Requested' },
              { value: 'busy', label: 'Line Busy' },
              { value: 'voicemail', label: 'Voicemail' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="outcome"
                  value={opt.value}
                  checked={outcome === opt.value}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="rounded-full"
                />
                <span className="text-sm text-[#566079]">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#566079] mb-2 uppercase tracking-wider">
            Call Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about the call..."
            className="w-full px-4 py-3 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] focus:border-[#3d61a4] focus:outline-none focus:ring-2 focus:ring-[#eef2fa] text-[#566079] placeholder-[#a4abbe] resize-none h-20 transition-all"
          />
        </div>

        {/* Log Call Button */}
        <button
          onClick={handleLogCall}
          className="w-full py-3 bg-[#3d61a4] hover:bg-[#0a2d6b] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle size={18} />
          Log Call
        </button>
      </div>
    </div>
  );
}
