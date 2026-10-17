import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  term?: string;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, term, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={`relative inline-flex items-center align-middle ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="touch-target inline-flex items-center justify-center rounded-full text-slate-400 transition hover:text-brand-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
        aria-label={`Informazioni esplicative: ${term || content}`}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isOpen && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-60 -translate-x-1/2 rounded-xl border border-slate-700 bg-navy-900 p-2.5 text-[11px] leading-relaxed font-normal text-slate-200 shadow-xl backdrop-blur-md dark:border-navy-700 dark:bg-navy-850"
        >
          {term && <span className="block font-bold text-white mb-0.5">{term}</span>}
          <span>{content}</span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy-900 dark:border-t-navy-850" />
        </span>
      )}
    </span>
  );
};
