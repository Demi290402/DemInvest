import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FintechCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const FintechCard: React.FC<FintechCardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition duration-150 dark:border-navy-800/80 dark:bg-navy-900/90 ${
        hoverable ? 'cursor-pointer hover:border-brand-500/50 hover:shadow-md' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  changePct?: number;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  tooltipText?: string;
  onClick?: () => void;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  changePct,
  icon: Icon,
  badge,
  onClick,
  className = '',
}) => {
  const isPositive = (changePct ?? 0) > 0;
  const isNegative = (changePct ?? 0) < 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-navy-800/80 dark:bg-navy-900/90 dark:hover:border-navy-700 sm:p-5 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {badge}
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-navy-850 dark:text-brand-400">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="num-mono text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {value}
        </div>
        {changePct !== undefined && (
          <span
            className={`num-mono inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
              isPositive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : isNegative
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {isPositive ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};
