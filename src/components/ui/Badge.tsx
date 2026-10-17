import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  MinusCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  DataQualityAuditReport,
  DirectionalMarketRegime,
  RiskBandLevel,
  SellSignalDistinction,
  SignalClassificationV3,
  TimeHorizon,
  VolatilityMarketRegime,
} from '../../types/domain';

// -----------------------------------------------------------------------------
// SIGNAL CLASSIFICATION BADGE
// -----------------------------------------------------------------------------
interface SignalBadgeProps {
  classification: SignalClassificationV3 | string;
  sellDistinction?: SellSignalDistinction;
  size?: 'sm' | 'md';
  className?: string;
}

export const SignalBadge: React.FC<SignalBadgeProps> = ({
  classification,
  sellDistinction,
  size = 'md',
  className = '',
}) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const iconSize = isSm ? 'h-3 w-3' : 'h-3.5 w-3.5';

  switch (classification) {
    case 'BUY_SETUP':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400 dark:bg-emerald-500/15 ${sizeClasses} ${className}`}
        >
          <TrendingUp className={iconSize} aria-hidden="true" />
          <span>Setup Rialzista</span>
        </span>
      );

    case 'BULLISH_BREAKOUT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 font-bold text-cyan-400 dark:bg-cyan-500/15 ${sizeClasses} ${className}`}
        >
          <Compass className={iconSize} aria-hidden="true" />
          <span>Breakout Confermato</span>
        </span>
      );

    case 'EXIT_WARNING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 font-bold text-amber-300 dark:bg-amber-500/15 ${sizeClasses} ${className}`}
        >
          <AlertTriangle className={iconSize} aria-hidden="true" />
          <span>
            {sellDistinction === 'EXISTING_POSITION_EXIT'
              ? 'Uscita Posizione'
              : 'Alert Alleggerimento'}
          </span>
        </span>
      );

    case 'SELL_SETUP':
    case 'BEARISH_BREAKDOWN':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 font-bold text-rose-400 dark:bg-rose-500/15 ${sizeClasses} ${className}`}
        >
          <TrendingDown className={iconSize} aria-hidden="true" />
          <span>
            {sellDistinction === 'BEARISH_MARKET_SIGNAL'
              ? 'Segnale Ribassista'
              : sellDistinction === 'THEORETICAL_SHORT_SETUP'
                ? 'Setup Ribassista CFD'
                : 'Pressione Ribassista'}
          </span>
        </span>
      );

    case 'VOLATILITY_ALERT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 font-bold text-purple-300 dark:bg-purple-500/15 ${sizeClasses} ${className}`}
        >
          <AlertCircle className={iconSize} aria-hidden="true" />
          <span>Allerta Volatilità</span>
        </span>
      );

    case 'NO_TRADE':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300/40 bg-slate-200/50 font-medium text-slate-600 dark:border-slate-800 dark:bg-navy-850 dark:text-slate-400 ${sizeClasses} ${className}`}
        >
          <MinusCircle className={iconSize} aria-hidden="true" />
          <span>Nessun Setup Attivo</span>
        </span>
      );
  }
};

// -----------------------------------------------------------------------------
// RISK BAND BADGE
// -----------------------------------------------------------------------------
interface RiskBadgeProps {
  band: RiskBandLevel | string;
  score?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  band,
  score,
  size = 'md',
  className = '',
}) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const iconSize = isSm ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const scoreText = score !== undefined ? ` (${Math.round(score)}/100)` : '';

  switch (band) {
    case 'VERY_LOW':
    case 'LOW':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400 ${sizeClasses} ${className}`}
        >
          <ShieldCheck className={iconSize} aria-hidden="true" />
          <span>Rischio Contenuto{scoreText}</span>
        </span>
      );

    case 'MODERATE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 font-bold text-cyan-300 ${sizeClasses} ${className}`}
        >
          <Shield className={iconSize} aria-hidden="true" />
          <span>Rischio Moderato{scoreText}</span>
        </span>
      );

    case 'ELEVATED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 font-bold text-amber-300 ${sizeClasses} ${className}`}
        >
          <AlertTriangle className={iconSize} aria-hidden="true" />
          <span>Rischio Elevato{scoreText}</span>
        </span>
      );

    case 'HIGH':
    case 'EXTREME':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 font-bold text-rose-400 ${sizeClasses} ${className}`}
        >
          <ShieldAlert className={iconSize} aria-hidden="true" />
          <span>Rischio Alto{scoreText}</span>
        </span>
      );
  }
};

// -----------------------------------------------------------------------------
// DATA QUALITY FAIL-SAFE BADGE
// -----------------------------------------------------------------------------
interface DataQualityBadgeProps {
  quality: DataQualityAuditReport['classification'] | string;
  closedCandlesCount?: number;
  delaySeconds?: number;
  className?: string;
}

export const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({
  quality,
  closedCandlesCount,
  delaySeconds,
  className = '',
}) => {
  switch (quality) {
    case 'VALID':
      return (
        <span
          data-testid="market-data-quality-badge"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 ${className}`}
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          <span>Dati Verificati {closedCandlesCount ? `(${closedCandlesCount} barre)` : ''}</span>
        </span>
      );

    case 'DELAYED':
      return (
        <span
          data-testid="market-data-quality-badge"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 ${className}`}
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span>
            Differito {delaySeconds ? `${Math.round(delaySeconds / 60)} min` : '(15 min)'}
          </span>
        </span>
      );

    case 'STALE':
    case 'INCOMPLETE':
    case 'INVALID':
    default:
      return (
        <span
          data-testid="market-data-quality-badge"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-400 ${className}`}
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          <span>Qualità Dati: {quality} (Segnali bloccati)</span>
        </span>
      );
  }
};

// -----------------------------------------------------------------------------
// MARKET REGIME BADGE
// -----------------------------------------------------------------------------
interface RegimeBadgeProps {
  directional: DirectionalMarketRegime;
  volatility?: VolatilityMarketRegime;
  className?: string;
}

export const RegimeBadge: React.FC<RegimeBadgeProps> = ({
  directional,
  volatility,
  className = '',
}) => {
  const dirLabels: Record<DirectionalMarketRegime, { label: string; color: string }> = {
    BULLISH_TREND: { label: 'Trend Rialzista', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
    BEARISH_TREND: { label: 'Trend Ribassista', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
    SIDEWAYS: { label: 'Laterale / Congestione', color: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
    UNCERTAIN: { label: 'Incertezza / Transizione', color: 'text-slate-400 border-slate-700 bg-slate-800' },
  };

  const currentDir = dirLabels[directional] || dirLabels.UNCERTAIN;

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold ${className}`}>
      <span className={`rounded-lg border px-2.5 py-0.5 ${currentDir.color}`}>
        {currentDir.label}
      </span>
      {volatility && (
        <span className="rounded-lg border border-slate-700 bg-navy-850 px-2 py-0.5 text-[11px] text-slate-300">
          Volatilità {volatility === 'HIGH_VOLATILITY' ? 'Alta' : volatility === 'LOW_VOLATILITY' ? 'Bassa' : 'Normale'}
        </span>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// TIME HORIZON BADGE
// -----------------------------------------------------------------------------
export const HorizonBadge: React.FC<{ horizon: TimeHorizon; className?: string }> = ({
  horizon,
  className = '',
}) => {
  const map: Record<TimeHorizon, { label: string; desc: string }> = {
    BREVISSIMO: { label: 'Brevissimo', desc: 'Intraday (15m - 1h)' },
    BREVE: { label: 'Breve', desc: 'Swing (4h - 1d)' },
    MEDIO: { label: 'Medio', desc: 'Posizionale (1d - 1w)' },
    LUNGO: { label: 'Lungo', desc: 'Strategico (1w - 1M)' },
  };
  const item = map[horizon] || { label: horizon, desc: '' };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-navy-850 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-300 ${className}`}
      title={item.desc}
    >
      <Clock className="h-3 w-3 text-brand-400" aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
};
