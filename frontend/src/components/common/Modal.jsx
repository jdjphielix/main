import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showHeader = true,
  showFooter = false,
  footerActions = null,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div
        className={`relative bg-white rounded-3xl shadow-popup ${sizeClasses[size]} max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {showHeader && (
          <div className="sticky top-0 bg-white border-b border-[#e8eaf2] px-8 py-6 flex items-center justify-between rounded-t-3xl">
            <h2 className="text-xl font-bold text-[#011745]">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-[#011745]"
            >
              <X size={24} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-8 py-6">{children}</div>

        {/* Footer */}
        {showFooter && footerActions && (
          <div className="border-t border-[#e8eaf2] px-8 py-4 bg-[#f7f8fc] rounded-b-3xl flex gap-3 justify-end">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
}
