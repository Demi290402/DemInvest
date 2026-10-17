import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/50 p-8 text-center dark:border-navy-800 dark:bg-navy-900/40 sm:p-12 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-navy-850 dark:text-slate-400 dark:ring-navy-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-3.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {description}
      </p>

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-anthracite-950 transition hover:bg-brand-400 focus-ring"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
