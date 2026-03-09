'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const REPORT_REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Hate speech",
  "Inappropriate content",
  "Other"
];

type ReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isSubmitting: boolean;
};

export default function ReportModal({ isOpen, onClose, onSubmit, isSubmitting }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;
    onSubmit(selectedReason);
    setSelectedReason(''); // Reset after submit
  };

  const handleClose = () => {
    setSelectedReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-neutral-800">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            Report Post
          </h3>
          <button onClick={handleClose} className="text-neutral-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5">
          <p className="text-neutral-400 mb-4 text-sm">
            Why are you reporting this post? Your report will be kept anonymous.
          </p>
          
          <div className="space-y-3 mb-6">
            {REPORT_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="peer appearance-none w-5 h-5 border-2 border-neutral-600 rounded-full checked:border-amber-500 transition-colors"
                  />
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-500 opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-neutral-300 group-hover:text-white transition-colors">
                  {reason}
                </span>
              </label>
            ))}
          </div>
          
          <button
            type="submit"
            disabled={!selectedReason || isSubmitting}
            className="w-full py-3 font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
