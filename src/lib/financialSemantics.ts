/**
 * ============================================================================
 * DEMINVEST — FINANCIAL SEMANTICS & LOCALIZATION LAYER (MASTER PROMPT 5)
 * ============================================================================
 * "Complexity in the engine. Clarity in the experience."
 * 
 * Centralizza tutte le traduzioni semantiche, etichette umane e formattatori
 * di numeri finanziari, eliminando sigle criptiche e codici interni (NO_TRADE,
 * SIDEWAYS, HIGH_CONCENTRATION_RISK, PIVOT_FRACTAL_ATR_CLUSTER_V1)
 * dall'esperienza per utenti non tecnici in modalità Semplice, preservando al
 * contempo la profondità algoritmica nei dettagli espandibili in modalità PRO.
 * ============================================================================
 */

import {
  DirectionalMarketRegime,
  FreshnessStatus,
  SignalClassificationV3,
  SignalStatus,
  VolatilityMarketRegime,
} from '../types/domain';

// ----------------------------------------------------------------------------
// 1. REGIMI DI MERCATO & VOLATILITÀ
// ----------------------------------------------------------------------------

export function translateMarketRegime(regime?: string | null): {
  label: string;
  shortLabel: string;
  description: string;
  colorClass: string;
} {
  switch (regime) {
    case 'BULLISH_TREND':
      return {
        label: 'Trend rialzista confermato',
        shortLabel: 'Rialzista',
        description: 'I prezzi mostrano massimi e minimi crescenti con medie mobili orientate positivamente.',
        colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      };
    case 'BEARISH_TREND':
      return {
        label: 'Trend ribassista',
        shortLabel: 'Ribassista',
        description: 'La struttura di prezzo è orientata al ribasso con pressione venditrice prevalente.',
        colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      };
    case 'SIDEWAYS':
      return {
        label: 'Mercato laterale / consolidamento',
        shortLabel: 'Laterale',
        description: 'I prezzi oscillano in una fascia definita senza una chiara direzione dominante.',
        colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      };
    case 'UNCERTAIN':
    default:
      return {
        label: 'Condizione incerta / in transizione',
        shortLabel: 'Incerto',
        description: 'I segnali degli indicatori non convergono: necessaria prudenza nell\'interpretazione.',
        colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
      };
  }
}

export function translateVolatilityRegime(vol?: string | null): {
  label: string;
  description: string;
  badgeClass: string;
} {
  switch (vol) {
    case 'LOW_VOLATILITY':
      return {
        label: 'Volatilità contenuta',
        description: 'Oscillazioni di prezzo ridotte rispetto alla media storica.',
        badgeClass: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800',
      };
    case 'HIGH_VOLATILITY':
      return {
        label: 'Volatilità elevata',
        description: 'Ampie oscillazioni di prezzo con rischio di escursioni repentine.',
        badgeClass: 'text-amber-600 bg-amber-500/15 dark:text-amber-300',
      };
    case 'EXTREME_VOLATILITY':
      return {
        label: 'Volatilità anomala / elevatissima',
        description: 'Condizioni di forte stress o annunci macroeconomici imminenti.',
        badgeClass: 'text-rose-600 bg-rose-500/15 dark:text-rose-300',
      };
    case 'NORMAL_VOLATILITY':
    default:
      return {
        label: 'Volatilità normale',
        description: 'Fluttuazioni in linea con il comportamento consueto dello strumento.',
        badgeClass: 'text-teal-600 bg-teal-500/15 dark:text-teal-300',
      };
  }
}

// ----------------------------------------------------------------------------
// 2. SEGNALI & STRATEGIE QUANTITATIVE
// ----------------------------------------------------------------------------

export function translateSignalClassification(classification?: string | null): {
  label: string;
  shortLabel: string;
  simpleExplanation: string;
  colorClass: string;
} {
  switch (classification) {
    case 'BULLISH_SETUP':
      return {
        label: 'Configurazione rialzista rilevata',
        shortLabel: 'Rialzista',
        simpleExplanation: 'La strategia ha riscontrato parametri favorevoli a uno scenario di salita del prezzo.',
        colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
      };
    case 'BEARISH_MARKET_SIGNAL':
      return {
        label: 'Configurazione ribassista rilevata',
        shortLabel: 'Ribassista',
        simpleExplanation: 'La strategia ha rilevato debolezza tecnica e rischio di ulteriori discese.',
        colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
      };
    case 'EXISTING_POSITION_EXIT':
      return {
        label: 'Segnale di uscita / alleggerimento',
        shortLabel: 'Uscita',
        simpleExplanation: 'La dinamica di prezzo suggerisce di considerare la chiusura o la riduzione di una posizione.',
        colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
      };
    case 'NO_TRADE':
    default:
      return {
        label: 'Nessuna configurazione confermata',
        shortLabel: 'Nessun segnale',
        simpleExplanation: 'I criteri statistici della strategia non sono al momento soddisfatti.',
        colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
      };
  }
}

export function translateSignalStatus(status?: SignalStatus | string | null): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confermato', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'AWAITING_CONFIRMATION':
      return { label: 'In osservazione', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'DETECTED':
      return { label: 'Rilevato', badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    case 'INVALIDATED':
      return { label: 'Invalidato', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'EXPIRED':
      return { label: 'Scaduto nel tempo', badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
    default:
      return { label: 'Non confermato', badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  }
}

export function translateStrategyName(strategyId?: string | null): {
  name: string;
  concept: string;
} {
  switch (strategyId) {
    case 'PIVOT_FRACTAL_ATR_CLUSTER_V1':
      return {
        name: 'Pivot & Cluster di Prezzo',
        concept: 'Individua livelli chiave di supporto e resistenza basati su frattali e volatilità ATR.',
      };
    case 'EMA_CROSS_MOMENTUM_FILTER_V1':
      return {
        name: 'Incrocio Medie con Filtro Momentum',
        concept: 'Valuta inversioni di trend quando le medie mobili veloci superano quelle lente con RSI coerente.',
      };
    case 'BREAKOUT_MULTI_TIMEFRAME_V1':
      return {
        name: 'Rottura di Livello Multi-Timeframe',
        concept: 'Rileva uscite da canali laterali validate da intervalli temporali superiori.',
      };
    case 'MEAN_REVERSION_BAND_EXHAUSTION_V1':
      return {
        name: 'Rientro nella Media da Estremo',
        concept: 'Monitora condizioni di ipercomprato o ipervenduto estremo sulle Bande di Bollinger.',
      };
    case 'STRAT_VOLATILITY_RISK_ALERT_V1':
      return {
        name: 'Monitoraggio Rischio & Volatilità',
        concept: 'Avvisa tempestivamente in caso di esplosioni anomale della volatilità rispetto alla media.',
      };
    default:
      return {
        name: strategyId ? strategyId.replace(/_/g, ' ') : 'Strategia Quantitativa',
        concept: 'Analisi basata su indicatori matematici e serie storiche verificate.',
      };
  }
}

// ----------------------------------------------------------------------------
// 3. STATO QUALITÀ DEI DATI E FRESCHEZZA QUOTAZIONI
// ----------------------------------------------------------------------------

export function translateDataFreshness(freshness?: FreshnessStatus | string | null): {
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  isRealtime: boolean;
} {
  switch (freshness) {
    case 'REALTIME':
      return {
        label: 'Prezzo in tempo reale verificato',
        shortLabel: 'Realtime',
        description: 'Quotazione aggiornata con latenza minima dal provider ufficiale.',
        badgeClass: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30',
        isRealtime: true,
      };
    case 'DELAYED':
      return {
        label: 'Prezzo ritardato (circa 15 minuti)',
        shortLabel: 'Ritardato',
        description: 'La fonte fornisce dati con il consueto differimento per mercati azionari gratuiti.',
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        isRealtime: false,
      };
    case 'EOD':
      return {
        label: 'Chiusura di fine giornata (EOD)',
        shortLabel: 'Fine giornata',
        description: 'Prezzo ufficiale di chiusura dell\'ultima sessione completata.',
        badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        isRealtime: false,
      };
    case 'STALE':
      return {
        label: 'Dati obsoleti / in attesa di feed',
        shortLabel: 'Non recente',
        description: 'La quotazione non è stata aggiornata nelle ultime ore. Verificare lo stato del feed.',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        isRealtime: false,
      };
    case 'UNAVAILABLE':
    default:
      return {
        label: 'Quotazione non disponibile',
        shortLabel: 'Non disponibile',
        description: 'Il provider non ha restituito una quotazione valida per questo strumento.',
        badgeClass: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700',
        isRealtime: false,
      };
  }
}

// ----------------------------------------------------------------------------
// 4. CONCENTRAZIONE & RISCHIO PORTAFOGLIO
// ----------------------------------------------------------------------------

export function translateConcentrationRisk(level?: string | null): {
  label: string;
  description: string;
  badgeClass: string;
  className: string;
} {
  switch (level) {
    case 'HIGH_CONCENTRATION_RISK':
    case 'HIGH':
      return {
        label: 'Portafoglio molto concentrato',
        description: 'Poche posizioni rappresentano gran parte del capitale investito: la volatilità dei singoli asset ha un forte impatto.',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
        className: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
      };
    case 'MODERATE':
      return {
        label: 'Concentrazione moderata',
        description: 'La diversificazione è parziale; una o due posizioni hanno un peso significativo.',
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
        className: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
      };
    case 'LOW':
    default:
      return {
        label: 'Ben diversificato',
        description: 'Il capitale è distribuito equilibratamente tra più strumenti e valute.',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
        className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
      };
  }
}

export const translateConcentrationLevel = translateConcentrationRisk;

// ----------------------------------------------------------------------------
// 5. FORMATTATORI NUMERICI & FINANZIARI TABULARI
// ----------------------------------------------------------------------------

export function formatFinancialCurrency(
  value: number | null | undefined,
  currency = 'EUR',
  options?: { showPlus?: boolean; minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/D';
  }
  const minDec = options?.minimumFractionDigits ?? (Math.abs(value) < 1 && value !== 0 ? 4 : 2);
  const maxDec = options?.maximumFractionDigits ?? (Math.abs(value) < 1 && value !== 0 ? 6 : 2);
  const formatted = value.toLocaleString('it-IT', {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec,
  });
  const prefix = options?.showPlus && value > 0 ? '+' : '';
  return `${prefix}${formatted} ${currency}`;
}

export function formatFinancialPercent(
  value: number | null | undefined,
  options?: { showPlus?: boolean; decimals?: number }
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/D';
  }
  const decimals = options?.decimals ?? 2;
  const prefix = options?.showPlus && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}
