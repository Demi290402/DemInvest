// ==============================================================================
// DEMINVEST — QUANTITATIVE ANALYSIS ENGINE (MOTORE NUMERICO DETERMINISTICO)
// ==============================================================================
// Regole Non Negoziabili (Sezione 9):
// 1. Calcolo 100% deterministico e indipendente dall'assistente AI.
// 2. Esclusione tassativa di candele parzialmente chiuse o future (isClosed === false).
// 3. Rifiuto di calcolo (null) se il numero di osservazioni chiuse è insufficiente.
// 4. Algoritmo di Supporti e Resistenze esplicitamente dichiarato e documentato:
//    PIVOT_FRACTAL_ATR_CLUSTER_V1 (Swing High/Low a 5 barre con clustering ATR(14)).
// ==============================================================================

import {
  CandleTimeframe,
  ConfirmedPivotPoint,
  DataQualityAuditReport,
  HistoricalCandle,
  MarketDataQualityClassification,
  MarketQuote,
  QuantitativeIndicatorsSnapshot,
  SupportResistanceLevel,
} from '../types/domain';

export const SUPPORT_RESISTANCE_ALGORITHM_DOC =
  'PIVOT_FRACTAL_ATR_CLUSTER_V1: Identificazione deterministica di Swing High e Swing Low tramite finestra frattale simmetrica a 5 candele chiuse [i-2..i+2] con separazione rigorosa tra pivotCandleTime (barra i) e confirmedAtCandleTime (chiusura barra i+2, zero look-ahead bias), seguita da clustering gerarchico con soglia di aggregazione pari a max(0.75 * ATR(14), 1.0% del prezzo).';

function roundTo(val: number, decimals = 6): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Audit deterministico di Qualità e Validazione Dati di Mercato (Fail-Safe Layer — Sezione 3 Prompt 3)
 */
export function auditMarketDataQuality(
  instrumentId: string,
  timeframe: CandleTimeframe,
  rawCandles: HistoricalCandle[],
  quote?: MarketQuote | null,
  options?: {
    isDerivative?: boolean;
    assetClass?: string;
    minRequiredCandles?: number;
    referenceNowMs?: number;
  }
): DataQualityAuditReport {
  const nowMs = options?.referenceNowMs ?? Date.now();
  const minRequired = options?.minRequiredCandles ?? 25;
  const anomalyFlags: string[] = [];
  const blockingReasons: string[] = [];

  if (!rawCandles || rawCandles.length === 0) {
    return {
      instrumentId,
      timeframe,
      evaluatedAt: new Date(nowMs).toISOString(),
      classification: 'UNAVAILABLE',
      pricePositiveCheck: false,
      ohlcCoherenceCheck: false,
      noDuplicateTimestampsCheck: true,
      chronologicalOrderCheck: true,
      noFutureTimestampsCheck: true,
      totalCandlesReceived: 0,
      validClosedCandlesCount: 0,
      formingCandlesExcluded: 0,
      invalidCandlesDropped: 0,
      volumeReliable: false,
      volumeUnavailableReason: 'Nessuna candela ricevuta dal provider.',
      anomalyFlags: ['EMPTY_CANDLE_SERIES'],
      isSpotVsDerivativeDistinguished: true,
      instrumentContractNature: options?.isDerivative ? 'DERIVATIVE_CFD_FUTURE' : 'SPOT',
      isMarketSessionOpen: quote?.isMarketOpen ?? true,
      delaySeconds: quote?.delaySeconds ?? 0,
      blockingSignalGeneration: true,
      blockingReasons: ['Serie storica OHLCV assente o provider non disponibile.'],
    };
  }

  let pricePositiveCheck = true;
  let ohlcCoherenceCheck = true;
  let noDuplicateTimestampsCheck = true;
  let chronologicalOrderCheck = true;
  let noFutureTimestampsCheck = true;
  let formingCandlesExcluded = 0;
  let invalidCandlesDropped = 0;

  const seenTimestamps = new Set<number>();
  const maxFutureToleranceSec = Math.floor(nowMs / 1000) + 300; // 5 min clock skew tolerance

  for (let i = 0; i < rawCandles.length; i++) {
    const c = rawCandles[i];
    if (c.isClosed === false) {
      formingCandlesExcluded++;
    }
    if (
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      c.open <= 0 ||
      c.high <= 0 ||
      c.low <= 0 ||
      c.close <= 0
    ) {
      pricePositiveCheck = false;
      invalidCandlesDropped++;
      continue;
    }

    const maxOC = Math.max(c.open, c.close);
    const minOC = Math.min(c.open, c.close);
    if (c.high < maxOC - 1e-8 || c.low > minOC + 1e-8 || c.high < c.low) {
      ohlcCoherenceCheck = false;
      invalidCandlesDropped++;
      continue;
    }

    if (seenTimestamps.has(c.time)) {
      noDuplicateTimestampsCheck = false;
    }
    seenTimestamps.add(c.time);

    if (i > 0 && c.time < rawCandles[i - 1].time) {
      chronologicalOrderCheck = false;
    }

    if (c.time > maxFutureToleranceSec) {
      noFutureTimestampsCheck = false;
    }
  }

  if (!pricePositiveCheck) anomalyFlags.push('NON_POSITIVE_OR_NAN_PRICE_DETECTED');
  if (!ohlcCoherenceCheck) anomalyFlags.push('INCOHERENT_OHLC_CANDLE_DETECTED');
  if (!noDuplicateTimestampsCheck) anomalyFlags.push('DUPLICATE_TIMESTAMPS_SANITIZED');
  if (!chronologicalOrderCheck) anomalyFlags.push('OUT_OF_ORDER_TIMESTAMPS_SORTED');
  if (!noFutureTimestampsCheck) {
    anomalyFlags.push('FUTURE_TIMESTAMP_DETECTED');
    blockingReasons.push('Rilevati timestamp futuri anomali nella serie storica.');
  }

  const sanitized = sanitizeClosedCandles(rawCandles).filter(
    (c) =>
      c.high >= Math.max(c.open, c.close) - 1e-8 &&
      c.low <= Math.min(c.open, c.close) + 1e-8 &&
      c.time <= maxFutureToleranceSec
  );

  // Controllo salti anomali (possibili split non rettificati o spike errati del feed)
  const jumpThreshold = options?.assetClass === 'CRYPTO' ? 0.65 : 0.38;
  for (let i = 1; i < sanitized.length; i++) {
    const prev = sanitized[i - 1].close;
    const curr = sanitized[i].close;
    if (prev > 0) {
      const pctJump = Math.abs(curr - prev) / prev;
      if (pctJump > jumpThreshold) {
        anomalyFlags.push('EXTREME_JUMP_OR_UNADJUSTED_SPLIT');
        break;
      }
    }
  }

  const positiveVolumeCandles = sanitized.filter((c) => Number.isFinite(c.volume) && c.volume > 0).length;
  const volumeReliable = sanitized.length > 0 && positiveVolumeCandles / sanitized.length >= 0.6;
  const volumeUnavailableReason = volumeReliable
    ? undefined
    : 'Il provider o la classe di attivo (es. Forex / Indice / CoinGecko OHLC) non fornisce volumi puntuali per candela; le conferme volumetriche sono disattivate automaticamente.';

  const delaySeconds = quote?.delaySeconds ?? 0;
  let classification: MarketDataQualityClassification = 'VALID';

  if (sanitized.length === 0 || !noFutureTimestampsCheck) {
    classification = 'INVALID';
    blockingReasons.push('Serie OHLCV invalida dopo i controlli di integrità.');
  } else if (sanitized.length < minRequired) {
    classification = 'INCOMPLETE';
    blockingReasons.push(
      `Storico chiuso insufficiente (${sanitized.length}/${minRequired} candele minime richieste).`
    );
  } else if (quote?.freshness === 'STALE' || quote?.validity === 'STALE') {
    classification = 'STALE';
    blockingReasons.push('Quotazione obsoleta (STALE): generazione segnali operativi bloccata.');
  } else if (quote?.freshness === 'DELAYED' || quote?.freshness === 'EOD' || delaySeconds > 900) {
    classification = 'DELAYED';
  }

  if (anomalyFlags.includes('EXTREME_JUMP_OR_UNADJUSTED_SPLIT')) {
    blockingReasons.push(
      'Rilevato salto di prezzo estremo (>38%/65% in singola barra): possibile split azionario non rettificato o dato sporco.'
    );
  }

  const blockingSignalGeneration =
    classification === 'INVALID' ||
    classification === 'INCOMPLETE' ||
    classification === 'STALE' ||
    anomalyFlags.includes('EXTREME_JUMP_OR_UNADJUSTED_SPLIT');

  return {
    instrumentId,
    timeframe,
    evaluatedAt: new Date(nowMs).toISOString(),
    classification,
    pricePositiveCheck,
    ohlcCoherenceCheck,
    noDuplicateTimestampsCheck,
    chronologicalOrderCheck,
    noFutureTimestampsCheck,
    totalCandlesReceived: rawCandles.length,
    validClosedCandlesCount: sanitized.length,
    formingCandlesExcluded,
    invalidCandlesDropped,
    volumeReliable,
    volumeUnavailableReason,
    anomalyFlags,
    isSpotVsDerivativeDistinguished: true,
    instrumentContractNature: options?.isDerivative ? 'DERIVATIVE_CFD_FUTURE' : 'SPOT',
    isMarketSessionOpen: quote?.isMarketOpen ?? true,
    delaySeconds,
    blockingSignalGeneration,
    blockingReasons,
  };
}

/**
 * Filtra esclusivamente le candele chiuse e ordinate cronologicamente (senza duplicati).
 */
export function sanitizeClosedCandles(candles: HistoricalCandle[]): HistoricalCandle[] {
  const closed = candles.filter(
    (c) =>
      c.isClosed !== false &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      c.high >= c.low &&
      c.high >= Math.max(c.open, c.close) - 1e-8 &&
      c.low <= Math.min(c.open, c.close) + 1e-8 &&
      c.close > 0
  );
  const sorted = [...closed].sort((a, b) => a.time - b.time);
  const deduped: HistoricalCandle[] = [];
  for (const c of sorted) {
    if (deduped.length === 0 || deduped[deduped.length - 1].time !== c.time) {
      deduped.push(c);
    } else {
      deduped[deduped.length - 1] = c;
    }
  }
  return deduped;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return roundTo(sum / period, 6);
}

/**
 * Serie completa SMA per calcolo pendenza (slope)
 */
export function calculateSMASeries(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out.push(sum / period);
    }
  }
  return out;
}

/**
 * Serie completa EMA e ultimo valore EMA
 */
export function calculateEMASeries(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const k = 2 / (period + 1);
  const emaSeries: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEma = sum / period;
  emaSeries.push(prevEma);

  for (let i = period; i < values.length; i++) {
    const currentEma = values[i] * k + prevEma * (1 - k);
    emaSeries.push(currentEma);
    prevEma = currentEma;
  }
  return emaSeries;
}

export function calculateEMA(values: number[], period: number): number | null {
  const series = calculateEMASeries(values, period);
  if (series.length === 0) return null;
  return roundTo(series[series.length - 1], 6);
}

/**
 * Pendenza normalizzata (%) di una serie su N barre (default 5)
 */
export function calculateNormalizedSlopePct(series: number[], lookback = 5): number | null {
  if (series.length < lookback + 1) return null;
  const latest = series[series.length - 1];
  const past = series[series.length - 1 - lookback];
  if (past === 0) return null;
  return roundTo(((latest - past) / past) * 100, 3);
}

/**
 * Relative Strength Index (RSI) — Metodo di Wilder (period = 14)
 */
export function calculateRSI(closes: number[], period = 14): number | null {
  if (period <= 0 || closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return roundTo(rsi, 2);
}

/**
 * Moving Average Convergence Divergence (MACD 12, 26, 9)
 */
export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: number; signalLine: number; histogram: number } | null {
  if (closes.length < slowPeriod + signalPeriod) return null;

  const fastEma = calculateEMASeries(closes, fastPeriod);
  const slowEma = calculateEMASeries(closes, slowPeriod);
  const offset = slowPeriod - fastPeriod;
  const macdLineSeries: number[] = [];

  for (let i = 0; i < slowEma.length; i++) {
    macdLineSeries.push(fastEma[i + offset] - slowEma[i]);
  }

  const signalSeries = calculateEMASeries(macdLineSeries, signalPeriod);
  if (signalSeries.length === 0) return null;

  const latestMacd = macdLineSeries[macdLineSeries.length - 1];
  const latestSignal = signalSeries[signalSeries.length - 1];
  const histogram = latestMacd - latestSignal;

  return {
    macdLine: roundTo(latestMacd, 6),
    signalLine: roundTo(latestSignal, 6),
    histogram: roundTo(histogram, 6),
  };
}

/**
 * Rate of Change (ROC %) e Momentum Assoluto (period = 10)
 */
export function calculateROC(closes: number[], period = 10): number | null {
  if (period <= 0 || closes.length < period + 1) return null;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];
  if (past === 0) return null;
  return roundTo(((current - past) / past) * 100, 2);
}

export function calculateMomentum(closes: number[], period = 10): number | null {
  if (period <= 0 || closes.length < period + 1) return null;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];
  return roundTo(current - past, 6);
}

/**
 * Stochastic Oscillator (%K, %D)
 */
export function calculateStochastic(
  candles: HistoricalCandle[],
  kPeriod = 14,
  dPeriod = 3
): { k: number; d: number } | null {
  if (candles.length < kPeriod + dPeriod - 1) return null;

  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...window.map((c) => c.high));
    const lowestLow = Math.min(...window.map((c) => c.low));
    const currentClose = candles[i].close;
    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((currentClose - lowestLow) / range) * 100;
    kValues.push(k);
  }

  const latestK = kValues[kValues.length - 1];
  const dSlice = kValues.slice(kValues.length - dPeriod);
  const latestD = dSlice.reduce((a, b) => a + b, 0) / dPeriod;

  return {
    k: roundTo(latestK, 2),
    d: roundTo(latestD, 2),
  };
}

/**
 * Average True Range (ATR — Metodo di Wilder, period = 14)
 */
export function calculateATR(candles: HistoricalCandle[], period = 14): number | null {
  if (period <= 0 || candles.length < period + 1) return null;

  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }

  let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }

  return roundTo(atr, 6);
}

/**
 * Average Directional Index + Directional Indicators (+DI / -DI) — Wilder, period = 14
 */
export function calculateADXDetailed(
  candles: HistoricalCandle[],
  period = 14
): { adx: number; plusDi: number; minusDi: number } | null {
  if (period <= 0 || candles.length < period * 2 + 1) return null;

  const trList: number[] = [];
  const plusDmList: number[] = [];
  const minusDmList: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;

    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );

    trList.push(tr);
    plusDmList.push(plusDm);
    minusDmList.push(minusDm);
  }

  let smoothedTr = trList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDm = plusDmList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDm = minusDmList.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];
  let latestPlusDi = 0;
  let latestMinusDi = 0;

  for (let i = period; i < trList.length; i++) {
    smoothedTr = smoothedTr - smoothedTr / period + trList[i];
    smoothedPlusDm = smoothedPlusDm - smoothedPlusDm / period + plusDmList[i];
    smoothedMinusDm = smoothedMinusDm - smoothedMinusDm / period + minusDmList[i];

    const plusDi = smoothedTr === 0 ? 0 : (smoothedPlusDm / smoothedTr) * 100;
    const minusDi = smoothedTr === 0 ? 0 : (smoothedMinusDm / smoothedTr) * 100;
    latestPlusDi = plusDi;
    latestMinusDi = minusDi;
    const diSum = plusDi + minusDi;
    const dx = diSum === 0 ? 0 : (Math.abs(plusDi - minusDi) / diSum) * 100;
    dxValues.push(dx);
  }

  if (dxValues.length < period) return null;
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return {
    adx: roundTo(adx, 2),
    plusDi: roundTo(latestPlusDi, 2),
    minusDi: roundTo(latestMinusDi, 2),
  };
}

export function calculateADX(candles: HistoricalCandle[], period = 14): number | null {
  const res = calculateADXDetailed(candles, period);
  return res ? res.adx : null;
}

/**
 * Bande di Bollinger (period = 20, multiplier = 2)
 */
export function calculateBollingerBands(
  closes: number[],
  period = 20,
  multiplier = 2
): {
  upper: number;
  middle: number;
  lower: number;
  bandwidthPct: number;
  percentB: number;
} | null {
  if (closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance =
    slice.reduce((acc, val) => acc + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  const latest = closes[closes.length - 1];
  const bandwidthPct = middle === 0 ? 0 : ((upper - lower) / middle) * 100;
  const bandRange = upper - lower;
  const percentB = bandRange === 0 ? 0.5 : (latest - lower) / bandRange;

  return {
    upper: roundTo(upper, 6),
    middle: roundTo(middle, 6),
    lower: roundTo(lower, 6),
    bandwidthPct: roundTo(bandwidthPct, 2),
    percentB: roundTo(percentB, 4),
  };
}

/**
 * Volatilità Storica Annualizzata (%) basata sui rendimenti logaritmici
 */
export function calculateHistoricalVolatilityAnnualized(
  closes: number[],
  period = 20,
  periodsPerYear = 252
): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(closes.length - (period + 1));
  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] <= 0 || slice[i] <= 0) return null;
    logReturns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const sampleVariance =
    logReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) /
    (logReturns.length - 1);
  const annualizedVol = Math.sqrt(sampleVariance * periodsPerYear) * 100;
  return roundTo(annualizedVol, 2);
}

/**
 * Maximum Drawdown (%) su una serie di prezzi o equity
 */
export function calculateMaxDrawdownPct(values: number[]): number | null {
  if (values.length < 2) return null;
  let peak = values[0];
  let maxDd = 0;

  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((peak - v) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return roundTo(maxDd, 2);
}

export function calculateCurrentDrawdownFromPeakPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const peak = Math.max(...values);
  const latest = values[values.length - 1];
  if (peak <= 0) return null;
  return roundTo(((peak - latest) / peak) * 100, 2);
}

/**
 * On-Balance Volume (OBV)
 */
export function calculateOBV(candles: HistoricalCandle[]): number | null {
  if (candles.length < 2) return null;
  const hasVolume = candles.some((c) => c.volume > 0);
  if (!hasVolume) return null;

  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
  }
  return roundTo(obv, 2);
}

/**
 * Rilevazione Pivot High e Pivot Low confermati senza look-ahead bias:
 * Un pivot formatosi alla candela `i` è confermato SOLO alla chiusura della candela `i + rightBars`.
 */
export function detectConfirmedPivots(
  candles: HistoricalCandle[],
  leftBars = 2,
  rightBars = 2
): {
  confirmedPivotHighs: ConfirmedPivotPoint[];
  confirmedPivotLows: ConfirmedPivotPoint[];
  marketStructureSequence:
    | 'HIGHER_HIGHS_HIGHER_LOWS'
    | 'LOWER_HIGHS_LOWER_LOWS'
    | 'MIXED_RANGE'
    | 'INSUFFICIENT_DATA';
} {
  if (candles.length < leftBars + rightBars + 3) {
    return {
      confirmedPivotHighs: [],
      confirmedPivotLows: [],
      marketStructureSequence: 'INSUFFICIENT_DATA',
    };
  }

  const confirmedPivotHighs: ConfirmedPivotPoint[] = [];
  const confirmedPivotLows: ConfirmedPivotPoint[] = [];
  const latestClose = candles[candles.length - 1].close;

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const candidate = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let l = 1; l <= leftBars; l++) {
      if (candles[i - l].high > candidate.high) isHigh = false;
      if (candles[i - l].low < candidate.low) isLow = false;
    }
    for (let r = 1; r <= rightBars; r++) {
      if (candles[i + r].high >= candidate.high) isHigh = false;
      if (candles[i + r].low <= candidate.low) isLow = false;
    }

    const confirmationCandle = candles[i + rightBars];
    const subsequentCandles = candles.slice(i + rightBars + 1);

    if (isHigh) {
      const broken = latestClose > candidate.high;
      const falseBreakoutDetected =
        !broken &&
        subsequentCandles.some((sc) => sc.high > candidate.high && sc.close < candidate.high);
      confirmedPivotHighs.push({
        price: roundTo(candidate.high, 4),
        type: 'PIVOT_HIGH',
        leftBars,
        rightBars,
        pivotCandleTime: candidate.isoTime,
        confirmedAtCandleTime: confirmationCandle.isoTime,
        strengthScore: 65,
        broken,
        falseBreakoutDetected,
      });
    }

    if (isLow) {
      const broken = latestClose < candidate.low;
      const falseBreakoutDetected =
        !broken &&
        subsequentCandles.some((sc) => sc.low < candidate.low && sc.close > candidate.low);
      confirmedPivotLows.push({
        price: roundTo(candidate.low, 4),
        type: 'PIVOT_LOW',
        leftBars,
        rightBars,
        pivotCandleTime: candidate.isoTime,
        confirmedAtCandleTime: confirmationCandle.isoTime,
        strengthScore: 65,
        broken,
        falseBreakoutDetected,
      });
    }
  }

  let marketStructureSequence:
    | 'HIGHER_HIGHS_HIGHER_LOWS'
    | 'LOWER_HIGHS_LOWER_LOWS'
    | 'MIXED_RANGE'
    | 'INSUFFICIENT_DATA' = 'MIXED_RANGE';

  if (confirmedPivotHighs.length >= 2 && confirmedPivotLows.length >= 2) {
    const hLast = confirmedPivotHighs[confirmedPivotHighs.length - 1].price;
    const hPrev = confirmedPivotHighs[confirmedPivotHighs.length - 2].price;
    const lLast = confirmedPivotLows[confirmedPivotLows.length - 1].price;
    const lPrev = confirmedPivotLows[confirmedPivotLows.length - 2].price;

    if (hLast > hPrev && lLast > lPrev) {
      marketStructureSequence = 'HIGHER_HIGHS_HIGHER_LOWS';
    } else if (hLast < hPrev && lLast < lPrev) {
      marketStructureSequence = 'LOWER_HIGHS_LOWER_LOWS';
    }
  } else {
    marketStructureSequence = 'INSUFFICIENT_DATA';
  }

  return {
    confirmedPivotHighs: confirmedPivotHighs.slice(-6),
    confirmedPivotLows: confirmedPivotLows.slice(-6),
    marketStructureSequence,
  };
}

/**
 * Supporti e Resistenze tramite algoritmo esplicito PIVOT_FRACTAL_ATR_CLUSTER_V1
 */
export function detectSupportsAndResistances(
  candles: HistoricalCandle[],
  atr14: number | null
): {
  supports: SupportResistanceLevel[];
  resistances: SupportResistanceLevel[];
} {
  if (candles.length < 10) {
    return { supports: [], resistances: [] };
  }

  const latestClose = candles[candles.length - 1].close;
  const tolerance = Math.max(atr14 ? atr14 * 0.75 : 0, latestClose * 0.01);

  interface RawPivot {
    price: number;
    kind: 'HIGH' | 'LOW';
    isoTime: string;
    confirmedAtIsoTime: string;
  }

  const rawPivots: RawPivot[] = [];
  // Finestra simmetrica a 5 barre [i-2, i-1, i, i+1, i+2] su candele chiuse
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    const conf = candles[i + 2];
    const isSwingHigh =
      c.high >= candles[i - 1].high &&
      c.high >= candles[i - 2].high &&
      c.high >= candles[i + 1].high &&
      c.high >= candles[i + 2].high;

    const isSwingLow =
      c.low <= candles[i - 1].low &&
      c.low <= candles[i - 2].low &&
      c.low <= candles[i + 1].low &&
      c.low <= candles[i + 2].low;

    if (isSwingHigh) {
      rawPivots.push({
        price: c.high,
        kind: 'HIGH',
        isoTime: c.isoTime,
        confirmedAtIsoTime: conf.isoTime,
      });
    }
    if (isSwingLow) {
      rawPivots.push({
        price: c.low,
        kind: 'LOW',
        isoTime: c.isoTime,
        confirmedAtIsoTime: conf.isoTime,
      });
    }
  }

  interface Cluster {
    prices: number[];
    meanPrice: number;
    firstTestedAt: string;
    lastTestedAt: string;
  }

  const clusters: Cluster[] = [];
  for (const pivot of rawPivots) {
    const match = clusters.find((cl) => Math.abs(cl.meanPrice - pivot.price) <= tolerance);
    if (match) {
      match.prices.push(pivot.price);
      match.meanPrice = match.prices.reduce((a, b) => a + b, 0) / match.prices.length;
      match.lastTestedAt = pivot.confirmedAtIsoTime;
    } else {
      clusters.push({
        prices: [pivot.price],
        meanPrice: pivot.price,
        firstTestedAt: pivot.isoTime,
        lastTestedAt: pivot.confirmedAtIsoTime,
      });
    }
  }

  const levels: SupportResistanceLevel[] = clusters.map((cl) => {
    const touches = cl.prices.length;
    const type = cl.meanPrice <= latestClose ? 'SUPPORT' : 'RESISTANCE';
    const strengthScore = Math.min(100, 35 + touches * 18);
    return {
      price: roundTo(cl.meanPrice, 4),
      type,
      touches,
      strengthScore,
      firstTestedAt: cl.firstTestedAt,
      lastTestedAt: cl.lastTestedAt,
      algorithm: 'PIVOT_FRACTAL_ATR_CLUSTER_V1',
    };
  });

  const supports = levels
    .filter((l) => l.type === 'SUPPORT')
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);

  const resistances = levels
    .filter((l) => l.type === 'RESISTANCE')
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  return { supports, resistances };
}

/**
 * Calcola lo snapshot completo degli indicatori quantitativi per uno strumento.
 */
export function computeQuantitativeSnapshot(
  instrumentId: string,
  timeframe: CandleTimeframe,
  rawCandles: HistoricalCandle[],
  AssetClassForAnnualization: 'CRYPTO' | 'OTHER' = 'OTHER'
): QuantitativeIndicatorsSnapshot {
  const candles = sanitizeClosedCandles(rawCandles);
  const count = candles.length;

  if (count < 15) {
    return {
      instrumentId,
      timeframe,
      calculatedAt: new Date().toISOString(),
      observationsCount: count,
      sufficientData: false,
      insufficientReason: `Osservazioni chiuse insufficienti (${count}/15 minime richieste). Nessun indicatore viene stimato su serie incomplete.`,
      latestClose: count > 0 ? candles[count - 1].close : 0,
      sma20: null,
      sma50: null,
      sma100: null,
      sma200: null,
      ema9: null,
      ema12: null,
      ema20: null,
      ema26: null,
      ema50: null,
      ema200: null,
      adx14: null,
      plusDi14: null,
      minusDi14: null,
      distanceFromSma20Pct: null,
      distanceFromSma50Pct: null,
      distanceFromSma200Pct: null,
      sma20SlopeNormalizedPct: null,
      ema20SlopeNormalizedPct: null,
      ema50SlopeNormalizedPct: null,
      marketStructureSequence: 'INSUFFICIENT_DATA',
      trendDirection: 'INSUFFICIENT_DATA',
      rsi14: null,
      macd: null,
      roc10: null,
      momentum10: null,
      stochastic14: null,
      atr14: null,
      atrPct: null,
      trueRangeLatest: null,
      bollingerBands20: null,
      historicalVolatilityAnnualizedPct: null,
      maxDrawdownPct: null,
      currentDrawdownFromPeakPct: null,
      volumeSma20: null,
      relativeVolume: null,
      obv: null,
      volumeAvailableAndReliable: false,
      priceVolumeConfirmation: 'UNAVAILABLE_PROVIDER_VOLUME',
      volumeAnomaly: 'NONE',
      periodHigh: null,
      periodLow: null,
      supports: [],
      resistances: [],
      confirmedPivotHighs: [],
      confirmedPivotLows: [],
      priceStructure: 'NORMAL',
      supportResistanceAlgorithmDoc: SUPPORT_RESISTANCE_ALGORITHM_DOC,
    };
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const latestClose = closes[closes.length - 1];

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma100 = calculateSMA(closes, 100);
  const sma200 = calculateSMA(closes, 200);
  const ema9 = calculateEMA(closes, 9);
  const ema12 = calculateEMA(closes, 12);
  const ema20 = calculateEMA(closes, 20);
  const ema26 = calculateEMA(closes, 26);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);

  const sma20Series = calculateSMASeries(closes, 20);
  const ema20Series = calculateEMASeries(closes, 20);
  const ema50Series = calculateEMASeries(closes, 50);

  const sma20SlopeNormalizedPct = calculateNormalizedSlopePct(sma20Series, 5);
  const ema20SlopeNormalizedPct = calculateNormalizedSlopePct(ema20Series, 5);
  const ema50SlopeNormalizedPct = calculateNormalizedSlopePct(ema50Series, 5);

  const adxDetailed = calculateADXDetailed(candles, 14);
  const adx14 = adxDetailed ? adxDetailed.adx : null;
  const plusDi14 = adxDetailed ? adxDetailed.plusDi : null;
  const minusDi14 = adxDetailed ? adxDetailed.minusDi : null;

  const distanceFromSma20Pct =
    sma20 && sma20 > 0 ? roundTo(((latestClose - sma20) / sma20) * 100, 2) : null;
  const distanceFromSma50Pct =
    sma50 && sma50 > 0 ? roundTo(((latestClose - sma50) / sma50) * 100, 2) : null;
  const distanceFromSma200Pct =
    sma200 && sma200 > 0 ? roundTo(((latestClose - sma200) / sma200) * 100, 2) : null;

  let trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'INSUFFICIENT_DATA' = 'SIDEWAYS';
  if (sma20 !== null && ema20 !== null) {
    const refSlow = ema50 ?? sma50 ?? sma20;
    if (latestClose > sma20 && ema20 >= refSlow) {
      trendDirection = 'BULLISH';
    } else if (latestClose < sma20 && ema20 <= refSlow) {
      trendDirection = 'BEARISH';
    } else {
      trendDirection = 'SIDEWAYS';
    }
  }

  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes, 12, 26, 9);
  const roc10 = calculateROC(closes, 10);
  const momentum10 = calculateMomentum(closes, 10);
  const stochastic14 = calculateStochastic(candles, 14, 3);

  const atr14 = calculateATR(candles, 14);
  const atrPct = atr14 && latestClose > 0 ? roundTo((atr14 / latestClose) * 100, 2) : null;
  const latestCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const trueRangeLatest = roundTo(
    Math.max(
      latestCandle.high - latestCandle.low,
      Math.abs(latestCandle.high - prevCandle.close),
      Math.abs(latestCandle.low - prevCandle.close)
    ),
    6
  );
  const bollingerBands20 = calculateBollingerBands(closes, 20, 2);

  const periodsPerYear = AssetClassForAnnualization === 'CRYPTO' ? 365 : 252;
  const historicalVolatilityAnnualizedPct = calculateHistoricalVolatilityAnnualized(
    closes,
    20,
    periodsPerYear
  );
  const maxDrawdownPct = calculateMaxDrawdownPct(closes);
  const currentDrawdownFromPeakPct = calculateCurrentDrawdownFromPeakPct(closes);

  const positiveVolCount = volumes.filter((v) => Number.isFinite(v) && v > 0).length;
  const volumeAvailableAndReliable = positiveVolCount / volumes.length >= 0.6;
  const volumeSma20 = volumeAvailableAndReliable ? calculateSMA(volumes, 20) : null;
  const latestVolume = volumes[volumes.length - 1];
  const relativeVolume =
    volumeAvailableAndReliable && volumeSma20 && volumeSma20 > 0
      ? roundTo(latestVolume / volumeSma20, 2)
      : null;
  const obv = volumeAvailableAndReliable ? calculateOBV(candles) : null;

  let priceVolumeConfirmation: QuantitativeIndicatorsSnapshot['priceVolumeConfirmation'] =
    'UNAVAILABLE_PROVIDER_VOLUME';
  if (volumeAvailableAndReliable && relativeVolume !== null) {
    const barChange = latestCandle.close - prevCandle.close;
    if (barChange > 0 && relativeVolume >= 1.05) {
      priceVolumeConfirmation = 'CONFIRMED_BULLISH';
    } else if (barChange < 0 && relativeVolume >= 1.05) {
      priceVolumeConfirmation = 'CONFIRMED_BEARISH';
    } else {
      priceVolumeConfirmation = 'DIVERGENT_WEAK';
    }
  }

  let volumeAnomaly: 'NONE' | 'HIGH_VOLUME_SPIKE' | 'LOW_VOLUME_DRYUP' = 'NONE';
  if (relativeVolume !== null) {
    if (relativeVolume >= 1.8) volumeAnomaly = 'HIGH_VOLUME_SPIKE';
    else if (relativeVolume <= 0.45) volumeAnomaly = 'LOW_VOLUME_DRYUP';
  }

  const periodHigh = roundTo(Math.max(...candles.map((c) => c.high)), 6);
  const periodLow = roundTo(Math.min(...candles.map((c) => c.low)), 6);

  const { supports, resistances } = detectSupportsAndResistances(candles, atr14);
  const { confirmedPivotHighs, confirmedPivotLows, marketStructureSequence } =
    detectConfirmedPivots(candles, 2, 2);

  let priceStructure: QuantitativeIndicatorsSnapshot['priceStructure'] = 'NORMAL';
  const nearestResistance = resistances[0]?.price;
  const nearestSupport = supports[0]?.price;

  if (nearestResistance && latestClose >= nearestResistance * 0.998 && (relativeVolume ?? 1) >= 1.05) {
    priceStructure = 'BREAKOUT';
  } else if (nearestSupport && latestClose <= nearestSupport * 1.002 && trendDirection === 'BEARISH') {
    priceStructure = 'BREAKDOWN';
  } else if (
    trendDirection === 'BULLISH' &&
    sma20 !== null &&
    Math.abs(latestClose - sma20) / sma20 <= 0.015
  ) {
    priceStructure = 'PULLBACK_IN_UPTREND';
  } else if (bollingerBands20 && bollingerBands20.bandwidthPct < 4.5) {
    priceStructure = 'CONSOLIDATION_RANGE';
  }

  return {
    instrumentId,
    timeframe,
    calculatedAt: new Date().toISOString(),
    observationsCount: count,
    sufficientData: true,
    latestClose,
    sma20,
    sma50,
    sma100,
    sma200,
    ema9,
    ema12,
    ema20,
    ema26,
    ema50,
    ema200,
    adx14,
    plusDi14,
    minusDi14,
    distanceFromSma20Pct,
    distanceFromSma50Pct,
    distanceFromSma200Pct,
    sma20SlopeNormalizedPct,
    ema20SlopeNormalizedPct,
    ema50SlopeNormalizedPct,
    marketStructureSequence,
    trendDirection,
    rsi14,
    macd,
    roc10,
    momentum10,
    stochastic14,
    atr14,
    atrPct,
    trueRangeLatest,
    bollingerBands20,
    historicalVolatilityAnnualizedPct,
    maxDrawdownPct,
    currentDrawdownFromPeakPct,
    volumeSma20,
    relativeVolume,
    obv,
    volumeAvailableAndReliable,
    priceVolumeConfirmation,
    volumeAnomaly,
    periodHigh,
    periodLow,
    supports,
    resistances,
    confirmedPivotHighs,
    confirmedPivotLows,
    priceStructure,
    supportResistanceAlgorithmDoc: SUPPORT_RESISTANCE_ALGORITHM_DOC,
  };
}
