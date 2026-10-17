// ==============================================================================
// DEMINVEST — ADVANCED MARKET INTELLIGENCE, REGIME, STRATEGY, RISK & SCANNER ENGINE (V3)
// ==============================================================================
// Regole Non Negoziabili (Master Prompt 3):
// 1. Separazione netta tra Regime Direzionale e Regime di Volatilità.
// 2. Coerenza Multi-Timeframe obbligatoria tra timeframe operativo e superiore.
// 3. 4 Strategie Quantitative Deterministiche V1 con regole verificabili.
// 4. Distinzione esplicita nei segnali ribassisti tra:
//    - EXISTING_POSITION_EXIT (uscita da posizione già detenuta in portafoglio)
//    - BEARISH_MARKET_SIGNAL (deterioramento del quadro tecnico generale)
//    - THEORETICAL_SHORT_SETUP (configurazione teorica ribassista)
// 5. Ranking composito trasparente (0..100) con penalità collinearità e
//    Data Completeness Score separato dalla qualità dell'opportunità.
// ==============================================================================

import {
  AnalyzedInstrumentIntelligenceItem,
  CandleTimeframe,
  DataExecutionMode,
  DataQualityAuditReport,
  DirectionalMarketRegime,
  HistoricalCandle,
  MarketQuote,
  MarketRegimeAnalysis,
  MarketScanFilterParams,
  MarketScanRunResult,
  MultiTimeframeConsensus,
  MultiTimeframeConsensusState,
  NegotiableInstrument,
  OpportunityRankingItem,
  PositionSimulationInput,
  PositionSimulationResult,
  QuantitativeIndicatorsSnapshot,
  QuantitativeStrategyDefinition,
  RiskBandLevel,
  RiskIntelligenceReport,
  SellSignalDistinction,
  SignalClassificationV3,
  SignalStatus,
  SignalType,
  StrategyEvaluationResult,
  StrategyIdV3,
  TimeHorizon,
  VolatilityMarketRegime,
} from '../types/domain';
import {
  auditMarketDataQuality,
  computeQuantitativeSnapshot,
} from './quantitativeEngine';

function roundTo(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Configurazione Quantitativa dei 4 Orizzonti Temporali (Sezione 6 Prompt 3)
 */
export interface HorizonQuantitativeProfile {
  horizon: TimeHorizon;
  label: string;
  primaryTimeframe: CandleTimeframe;
  higherConfirmationTimeframe: CandleTimeframe;
  minRequiredClosedCandles: number;
  maxAllowedDataDelaySeconds: number;
  primaryIndicators: string[];
  noiseSensitivity: 'HIGH' | 'MODERATE' | 'LOW';
  invalidationCriteria: string;
}

export const HORIZON_PROFILES_V3: Record<TimeHorizon, HorizonQuantitativeProfile> = {
  BREVISSIMO: {
    horizon: 'BREVISSIMO',
    label: 'Brevissimo Termine (Intraday / 1–5 sedute)',
    primaryTimeframe: '15m',
    higherConfirmationTimeframe: '1h',
    minRequiredClosedCandles: 30,
    maxAllowedDataDelaySeconds: 180,
    primaryIndicators: ['EMA 9', 'EMA 20', 'RSI 14', 'VWAP/RVOL 20', 'ATR 14'],
    noiseSensitivity: 'HIGH',
    invalidationCriteria: 'Chiusura candela sotto EMA 20 o violazione di 1.2x ATR(14) dal livello di ingresso.',
  },
  BREVE: {
    horizon: 'BREVE',
    label: 'Breve Termine (Swing / 3 giorni – 4 settimane)',
    primaryTimeframe: '4h',
    higherConfirmationTimeframe: '1d',
    minRequiredClosedCandles: 35,
    maxAllowedDataDelaySeconds: 900,
    primaryIndicators: ['EMA 20', 'EMA 50', 'RSI 14', 'MACD 12/26/9', 'ADX 14', 'Pivot S/R'],
    noiseSensitivity: 'MODERATE',
    invalidationCriteria: 'Chiusura giornaliera sotto supporto statico confermato o sotto EMA 50 con ADX > 20.',
  },
  MEDIO: {
    horizon: 'MEDIO',
    label: 'Medio Termine (Position / 1–6 mesi)',
    primaryTimeframe: '1d',
    higherConfirmationTimeframe: '1w',
    minRequiredClosedCandles: 50,
    maxAllowedDataDelaySeconds: 86400,
    primaryIndicators: ['SMA 50', 'SMA 200', 'EMA 50', 'ADX 14', 'ROC 10', 'Drawdown %'],
    noiseSensitivity: 'LOW',
    invalidationCriteria: 'Inversione strutturale (Lower Low confermato su 1D) o rottura confermata di SMA 50/200.',
  },
  LUNGO: {
    horizon: 'LUNGO',
    label: 'Lungo Termine (Macro / > 6 mesi)',
    primaryTimeframe: '1w',
    higherConfirmationTimeframe: '1w',
    minRequiredClosedCandles: 40,
    maxAllowedDataDelaySeconds: 172800,
    primaryIndicators: ['SMA 50', 'SMA 200', 'Volatilità Annualizzata', 'Max Drawdown Storico'],
    noiseSensitivity: 'LOW',
    invalidationCriteria: 'Deterioramento regime primario sotto SMA 200 settimanale e drawdown > soglia di tolleranza.',
  },
};

/**
 * Catalogo Ufficiale delle 4 Strategie Quantitative Verificabili (Sezione 8 Prompt 3)
 */
export const QUANTITATIVE_STRATEGIES_V3: QuantitativeStrategyDefinition[] = [
  {
    id: 'STRAT_TREND_FOLLOWING_V1',
    name: 'Trend Following Multi-EMA & ADX',
    version: '1.0.0',
    supportedHorizons: ['BREVE', 'MEDIO', 'LUNGO'],
    requiredTimeframes: ['1h', '4h', '1d', '1w'],
    minClosedCandles: 35,
    requiredIndicators: ['EMA 20', 'EMA 50', 'SMA 200', 'RSI 14', 'ADX 14'],
    compatibleDirectionalRegimes: ['BULLISH_TREND', 'BEARISH_TREND'],
    compatibleVolatilityRegimes: ['NORMAL_VOLATILITY', 'LOW_VOLATILITY'],
    entryConditionsSummary: [
      'Prezzo di chiusura > EMA 20 > EMA 50 (allineamento rialzista delle medie)',
      'Pendenza EMA 20 positiva (> 0%) su ultime 5 barre chiuse',
      'ADX(14) >= 20 (forza direzionale presente e non laterale)',
      'RSI(14) compreso tra 48 e 72 (momentum sano, non in ipercomprato estremo)',
    ],
    exitOrAttentionConditionsSummary: [
      'Chiusura candela sotto EMA 20 con RSI(14) < 45',
      'Incrocio ribassista EMA 20 sotto EMA 50',
      'RSI(14) > 78 con divergenza di momentum',
    ],
    invalidationRulesSummary: [
      'Chiusura confermata sotto min(EMA 50, Prezzo - 1.8 * ATR(14))',
    ],
    knownRisksAndFalsePositives: [
      'Whipsaw (falsi segnali) se il mercato entra improvvisamente in fase laterale con ADX < 18',
      'Ritardo fisiologico delle medie mobili dopo spike parabolici',
    ],
  },
  {
    id: 'STRAT_CONFIRMED_BREAKOUT_V1',
    name: 'Breakout di Resistenza Confermato',
    version: '1.0.0',
    supportedHorizons: ['BREVISSIMO', 'BREVE', 'MEDIO'],
    requiredTimeframes: ['15m', '1h', '4h', '1d'],
    minClosedCandles: 30,
    requiredIndicators: ['Pivot/Resistance Cluster', 'ATR 14', 'RSI 14', 'RVOL 20 (opzionale)'],
    compatibleDirectionalRegimes: ['BULLISH_TREND', 'SIDEWAYS'],
    compatibleVolatilityRegimes: ['NORMAL_VOLATILITY', 'LOW_VOLATILITY', 'HIGH_VOLATILITY'],
    entryConditionsSummary: [
      'Livello di resistenza statico o Pivot High confermato da almeno 2 test storici',
      'Candela chiusa sopra il livello di resistenza (o entro 0.3% in espansione)',
      'Espansione del range rispetto ad ATR(14) e RSI(14) > 54',
      'Se il provider fornisce volumi: Relative Volume (RVOL 20) >= 1.10',
    ],
    exitOrAttentionConditionsSummary: [
      'Rientro del prezzo di chiusura sotto il livello di breakout (False Breakout Warning)',
      'Raggiungimento estensione 2.0x–3.0x ATR(14) con esaurimento RSI > 76',
    ],
    invalidationRulesSummary: [
      'Chiusura candela sotto il livello rotto meno 0.85 * ATR(14)',
    ],
    knownRisksAndFalsePositives: [
      'Bull trap / falso breakout in assenza di partecipazione volumetrica o contro il trend del timeframe superiore',
      'Gap di apertura eccessivo che peggiora il rapporto rendimento/rischio',
    ],
  },
  {
    id: 'STRAT_PULLBACK_IN_TREND_V1',
    name: 'Pullback Controllato in Trend Rialzista',
    version: '1.0.0',
    supportedHorizons: ['BREVE', 'MEDIO'],
    requiredTimeframes: ['1h', '4h', '1d'],
    minClosedCandles: 35,
    requiredIndicators: ['EMA 20', 'SMA 50', 'RSI 14', 'Support Cluster', 'ATR 14'],
    compatibleDirectionalRegimes: ['BULLISH_TREND'],
    compatibleVolatilityRegimes: ['NORMAL_VOLATILITY', 'LOW_VOLATILITY'],
    entryConditionsSummary: [
      'Trend primario rialzista (EMA 20 >= SMA 50 o Prezzo > SMA 50 con struttura Higher Lows)',
      'Ritracciamento ordinato in prossimità di EMA 20 o supporto statico (distanza entro ±1.8%)',
      'Tenuta del livello di supporto e RSI(14) scarico ma sopra 40 (tra 40 e 60)',
      'Segnale di ripresa (chiusura sopra apertura o MACD histogram in miglioramento)',
    ],
    exitOrAttentionConditionsSummary: [
      'Ritamponamento del precedente Swing High (Target 1)',
      'Perdita impulsiva di SMA 50',
    ],
    invalidationRulesSummary: [
      'Chiusura candela sotto il minimo dello swing di pullback o sotto SMA 50 - 1.0 * ATR(14)',
    ],
    knownRisksAndFalsePositives: [
      'Il ritracciamento può trasformarsi in inversione ribassista se accompagnato da volumi di vendita anomali',
    ],
  },
  {
    id: 'STRAT_VOLATILITY_RISK_ALERT_V1',
    name: 'Alert di Rischio, Breakdown e Volatilità Anomala',
    version: '1.0.0',
    supportedHorizons: ['BREVISSIMO', 'BREVE', 'MEDIO', 'LUNGO'],
    requiredTimeframes: ['15m', '1h', '4h', '1d', '1w'],
    minClosedCandles: 20,
    requiredIndicators: ['ATR 14', 'True Range', 'Bollinger Bands 20/2', 'Support Cluster', 'Drawdown %'],
    compatibleDirectionalRegimes: ['BEARISH_TREND', 'UNCERTAIN', 'SIDEWAYS', 'BULLISH_TREND'],
    compatibleVolatilityRegimes: ['HIGH_VOLATILITY', 'NORMAL_VOLATILITY'],
    entryConditionsSummary: [
      'Attivazione protettiva quando ATR% > 4.0% (o True Range > 1.75 * ATR14)',
      'Oppure rottura ribassista confermata di un supporto chiave / EMA 50 con RSI < 42',
      'Oppure Drawdown corrente dal massimo recente superiore al 12%',
    ],
    exitOrAttentionConditionsSummary: [
      'Rientro della volatilità sotto la media storica e recupero confermato del supporto violato',
    ],
    invalidationRulesSummary: [
      'Recupero sopra EMA 20 con contrazione di ATR%',
    ],
    knownRisksAndFalsePositives: [
      'Questo non è un invito allo scoperto indiscriminato, ma un alert difensivo di gestione del rischio su posizioni esistenti o watchlist',
    ],
  },
];

/**
 * 5. MARKET REGIME DETECTOR (Sezione 5 Prompt 3)
 * Separa rigorosamente il Regime Direzionale dal Regime di Volatilità.
 */
export function detectMarketRegime(
  indicators: QuantitativeIndicatorsSnapshot
): MarketRegimeAnalysis {
  const nowIso = new Date().toISOString();

  if (!indicators.sufficientData) {
    return {
      instrumentId: indicators.instrumentId,
      timeframe: indicators.timeframe,
      evaluatedAt: nowIso,
      directionalRegime: 'UNCERTAIN',
      volatilityRegime: 'NORMAL_VOLATILITY',
      regimeConfidenceScore: 0,
      adxStrengthLabel: 'WEAK_OR_ABSENT',
      maAlignment: 'MIXED',
      atrExpansionRatio: null,
      bollingerState: 'NORMAL',
      compatibleStrategies: ['STRAT_VOLATILITY_RISK_ALERT_V1'],
      incompatibleStrategies: [
        'STRAT_TREND_FOLLOWING_V1',
        'STRAT_CONFIRMED_BREAKOUT_V1',
        'STRAT_PULLBACK_IN_TREND_V1',
      ],
      explanation:
        'Dati storici chiusi insufficienti per classificare con affidabilità il regime direzionale e di volatilità.',
    };
  }

  const adx = indicators.adx14 ?? 18;
  const adxStrengthLabel: MarketRegimeAnalysis['adxStrengthLabel'] =
    adx >= 25 ? 'STRONG_TREND' : adx >= 19 ? 'MODERATE_TREND' : 'WEAK_OR_ABSENT';

  const close = indicators.latestClose;
  const ema20 = indicators.ema20 ?? indicators.sma20 ?? close;
  const ema50 = indicators.ema50 ?? indicators.sma50 ?? ema20;
  const sma200 = indicators.sma200;

  let maAlignment: MarketRegimeAnalysis['maAlignment'] = 'MIXED';
  if (close > ema20 && ema20 >= ema50 && (sma200 === null || close >= sma200 * 0.98)) {
    maAlignment = 'BULLISH_STACK';
  } else if (close < ema20 && ema20 <= ema50 && (sma200 === null || close <= sma200 * 1.02)) {
    maAlignment = 'BEARISH_STACK';
  }

  const slope20 = indicators.ema20SlopeNormalizedPct ?? indicators.sma20SlopeNormalizedPct ?? 0;

  // Classificazione Regime Direzionale
  let directionalRegime: DirectionalMarketRegime = 'UNCERTAIN';
  let confidence = 55;

  if (maAlignment === 'BULLISH_STACK' && (adx >= 19 || slope20 > 0.35)) {
    directionalRegime = 'BULLISH_TREND';
    confidence = Math.min(95, Math.round(62 + Math.min(25, adx - 15) + (slope20 > 1 ? 8 : 3)));
  } else if (maAlignment === 'BEARISH_STACK' && (adx >= 19 || slope20 < -0.35)) {
    directionalRegime = 'BEARISH_TREND';
    confidence = Math.min(95, Math.round(62 + Math.min(25, adx - 15) + (slope20 < -1 ? 8 : 3)));
  } else if (adx < 20 && Math.abs(slope20) <= 0.65) {
    directionalRegime = 'SIDEWAYS';
    confidence = 72;
  } else {
    directionalRegime = 'UNCERTAIN';
    confidence = 45;
  }

  // Classificazione Regime di Volatilità (indipendente dal trend!)
  const atrPct = indicators.atrPct ?? 1.5;
  const bbWidth = indicators.bollingerBands20?.bandwidthPct ?? 6.0;
  const trRatio =
    indicators.trueRangeLatest && indicators.atr14 && indicators.atr14 > 0
      ? roundTo(indicators.trueRangeLatest / indicators.atr14, 2)
      : null;

  let bollingerState: MarketRegimeAnalysis['bollingerState'] = 'NORMAL';
  if (bbWidth <= 4.2) bollingerState = 'SQUEEZE';
  else if (bbWidth >= 12.5) bollingerState = 'EXPANSION';

  let volatilityRegime: VolatilityMarketRegime = 'NORMAL_VOLATILITY';
  if (atrPct >= 3.8 || bbWidth >= 14.0 || (trRatio !== null && trRatio >= 1.65)) {
    volatilityRegime = 'HIGH_VOLATILITY';
  } else if (atrPct <= 1.1 && bbWidth <= 4.8) {
    volatilityRegime = 'LOW_VOLATILITY';
  }

  const compatibleStrategies: string[] = [];
  const incompatibleStrategies: string[] = [];

  for (const strat of QUANTITATIVE_STRATEGIES_V3) {
    const dirOk = strat.compatibleDirectionalRegimes.includes(directionalRegime);
    const volOk = strat.compatibleVolatilityRegimes.includes(volatilityRegime);
    if (dirOk && volOk) {
      compatibleStrategies.push(strat.id);
    } else {
      incompatibleStrategies.push(strat.id);
    }
  }

  const explanation = `Regime Direzionale: ${directionalRegime} (ADX=${adx.toFixed(1)}, allineamento medie=${maAlignment}, pendenza EMA20=${slope20.toFixed(2)}%) | Regime Volatilità: ${volatilityRegime} (ATR%=${atrPct.toFixed(2)}%, Bollinger Bandwidth=${bbWidth.toFixed(2)}%).`;

  return {
    instrumentId: indicators.instrumentId,
    timeframe: indicators.timeframe,
    evaluatedAt: nowIso,
    directionalRegime,
    volatilityRegime,
    regimeConfidenceScore: confidence,
    adxStrengthLabel,
    maAlignment,
    atrExpansionRatio: trRatio,
    bollingerState,
    compatibleStrategies,
    incompatibleStrategies,
    explanation,
  };
}

/**
 * 6. MULTI-TIMEFRAME INTELLIGENCE (Sezione 6 Prompt 3)
 * Valuta la coerenza tra il timeframe operativo e il timeframe superiore di conferma.
 */
export function evaluateMultiTimeframeConsensus(
  instrumentId: string,
  horizon: TimeHorizon,
  operationalIndicators: QuantitativeIndicatorsSnapshot,
  higherTimeframeIndicators?: QuantitativeIndicatorsSnapshot | null
): MultiTimeframeConsensus {
  const profile = HORIZON_PROFILES_V3[horizon];
  const opRegime = detectMarketRegime(operationalIndicators).directionalRegime;

  // Se il timeframe superiore coincide o non è fornito separatamente, usa la struttura di lungo periodo (SMA50/SMA200) dello snapshot corrente
  let higherTrend: MultiTimeframeConsensus['higherTrend'] = 'SIDEWAYS';
  let higherRegime: DirectionalMarketRegime = 'SIDEWAYS';

  if (higherTimeframeIndicators && higherTimeframeIndicators.sufficientData) {
    higherTrend = higherTimeframeIndicators.trendDirection;
    higherRegime = detectMarketRegime(higherTimeframeIndicators).directionalRegime;
  } else if (operationalIndicators.sufficientData) {
    const close = operationalIndicators.latestClose;
    const sma50 = operationalIndicators.sma50;
    const sma200 = operationalIndicators.sma200;
    if (sma50 !== null && close > sma50 && (sma200 === null || sma50 >= sma200 * 0.98)) {
      higherTrend = 'BULLISH';
      higherRegime = 'BULLISH_TREND';
    } else if (sma50 !== null && close < sma50 && (sma200 === null || sma50 <= sma200 * 1.02)) {
      higherTrend = 'BEARISH';
      higherRegime = 'BEARISH_TREND';
    } else {
      higherTrend = 'SIDEWAYS';
      higherRegime = 'SIDEWAYS';
    }
  } else {
    higherTrend = 'INSUFFICIENT_DATA';
    higherRegime = 'UNCERTAIN';
  }

  const opTrend = operationalIndicators.trendDirection;
  let consensusState: MultiTimeframeConsensusState = 'UNCERTAIN_SCENARIO';
  let convictionAdjustment = 0;
  let isHigherTimeframeAligned = false;

  if (opTrend === 'INSUFFICIENT_DATA' || higherTrend === 'INSUFFICIENT_DATA') {
    consensusState = 'UNCERTAIN_SCENARIO';
    convictionAdjustment = -20;
  } else if (opTrend === 'BULLISH' && higherTrend === 'BULLISH') {
    consensusState = 'CONCORDANT_BULLISH';
    convictionAdjustment = +15;
    isHigherTimeframeAligned = true;
  } else if (opTrend === 'BEARISH' && higherTrend === 'BEARISH') {
    consensusState = 'CONCORDANT_BEARISH';
    convictionAdjustment = +15;
    isHigherTimeframeAligned = true;
  } else if (
    (opTrend === 'BULLISH' && higherTrend === 'BEARISH') ||
    (opTrend === 'BEARISH' && higherTrend === 'BULLISH')
  ) {
    consensusState = 'CONFLICTING_TRENDS';
    convictionAdjustment = -18;
    isHigherTimeframeAligned = false;
  } else if (higherTrend === 'BULLISH' || higherTrend === 'BEARISH') {
    consensusState = 'CONFIRMED_BY_HIGHER_TF';
    convictionAdjustment = +6;
    isHigherTimeframeAligned = true;
  } else {
    consensusState = 'UNCONFIRMED_BY_HIGHER_TF';
    convictionAdjustment = -6;
    isHigherTimeframeAligned = false;
  }

  const summary = `Orizzonte ${horizon} (TF operativo ${operationalIndicators.timeframe} = ${opTrend}, TF superiore ${profile.higherConfirmationTimeframe} = ${higherTrend}) → Stato: ${consensusState} (impatto convinzione: ${convictionAdjustment >= 0 ? `+${convictionAdjustment}` : convictionAdjustment} pt).`;

  return {
    instrumentId,
    horizon,
    operationalTimeframe: operationalIndicators.timeframe,
    higherConfirmationTimeframe: profile.higherConfirmationTimeframe,
    operationalTrend: opTrend,
    higherTrend,
    operationalRegime: opRegime,
    higherRegime,
    consensusState,
    convictionAdjustment,
    isHigherTimeframeAligned,
    summary,
  };
}

/**
 * 8 & 9. STRATEGY & SIGNAL GENERATION ENGINE (4 Strategie Verificabili V1)
 */
export function evaluateAllStrategiesForInstrument(params: {
  instrument: NegotiableInstrument;
  quote: MarketQuote;
  dataQuality: DataQualityAuditReport;
  indicators: QuantitativeIndicatorsSnapshot;
  regime: MarketRegimeAnalysis;
  multiTimeframe: MultiTimeframeConsensus;
  horizon: TimeHorizon;
  holdsPositionInPortfolio?: boolean;
}): StrategyEvaluationResult[] {
  const {
    instrument,
    quote,
    dataQuality,
    indicators,
    regime,
    multiTimeframe,
    horizon,
    holdsPositionInPortfolio = false,
  } = params;

  const evaluatedAt = new Date().toISOString();
  const price = quote.price > 0 ? quote.price : indicators.latestClose;
  const atr = indicators.atr14 ?? price * 0.02;

  // Fail-Safe: se i dati sono invalidi, incompleti o obsoleti, tutte le strategie restituiscono NO_TRADE bloccato
  if (dataQuality.blockingSignalGeneration || !indicators.sufficientData) {
    return QUANTITATIVE_STRATEGIES_V3.map((strat) => ({
      strategyId: strat.id,
      strategyName: strat.name,
      strategyVersion: strat.version,
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      horizon,
      timeframe: indicators.timeframe,
      evaluatedAt,
      isTriggered: false,
      signalClassification: 'NO_TRADE',
      legacySignalType: 'NO_TRADE',
      signalStatus: 'CANCELLED',
      sellDistinction: 'NOT_APPLICABLE',
      referenceEntryZone: null,
      invalidationPrice: null,
      invalidationReason: 'Generazione segnali bloccata dal Fail-Safe Data Quality Layer.',
      targetLevels: [],
      conditionsMet: [],
      conditionsUnmet: dataQuality.blockingReasons.length
        ? dataQuality.blockingReasons
        : [indicators.insufficientReason || 'Storico insufficiente'],
      heuristicScore: 0,
      rationale: `Fail-Safe attivo (${dataQuality.classification}): ${dataQuality.blockingReasons.join(' ')}`,
      keyRisks: ['Qualità o freschezza dati insufficiente per produrre segnali operativi.'],
    }));
  }

  const results: StrategyEvaluationResult[] = [];
  const ema20 = indicators.ema20 ?? indicators.sma20 ?? price;
  const ema50 = indicators.ema50 ?? indicators.sma50 ?? ema20;
  const sma50 = indicators.sma50 ?? ema50;
  const rsi = indicators.rsi14 ?? 50;
  const adx = indicators.adx14 ?? 18;
  const slope20 = indicators.ema20SlopeNormalizedPct ?? indicators.sma20SlopeNormalizedPct ?? 0;
  const rvol = indicators.relativeVolume;
  const nearestSupport = indicators.supports[0]?.price ?? roundTo(price - 1.8 * atr, 4);
  const nearestResistance = indicators.resistances[0]?.price ?? roundTo(price + 2.2 * atr, 4);

  // ----------------------------------------------------------------------------
  // STRATEGIA 1: STRAT_TREND_FOLLOWING_V1
  // ----------------------------------------------------------------------------
  {
    const met: string[] = [];
    const unmet: string[] = [];

    if (price > ema20 && ema20 >= ema50) {
      met.push(`Allineamento rialzista verificato: Prezzo (${price}) > EMA20 (${roundTo(ema20, 3)}) >= EMA50 (${roundTo(ema50, 3)})`);
    } else {
      unmet.push(`Allineamento medie rialzista non attivo (Prezzo=${price}, EMA20=${roundTo(ema20, 3)}, EMA50=${roundTo(ema50, 3)})`);
    }

    if (slope20 > 0) {
      met.push(`Pendenza EMA20 positiva (+${slope20.toFixed(2)}% su 5 barre)`);
    } else {
      unmet.push(`Pendenza EMA20 non positiva (${slope20.toFixed(2)}%)`);
    }

    if (adx >= 20) {
      met.push(`Forza del trend ADX(14) = ${adx.toFixed(1)} (>= 20)`);
    } else {
      unmet.push(`ADX(14) debole (${adx.toFixed(1)} < 20)`);
    }

    if (rsi >= 48 && rsi <= 72) {
      met.push(`Momentum RSI(14) = ${rsi.toFixed(1)} nella fascia ottimale [48..72]`);
    } else {
      unmet.push(`RSI(14) = ${rsi.toFixed(1)} fuori dalla fascia ottimale [48..72]`);
    }

    const isBullishTriggered = met.length >= 3 && price > ema20 && ema20 >= ema50;
    const isBearishTrend =
      price < ema20 && (ema20 <= ema50 || slope20 < 0 || regime.directionalRegime === 'BEARISH_TREND');

    const isTriggered = isBullishTriggered || isBearishTrend;

    let signalClassification: SignalClassificationV3 = 'NO_TRADE';
    let legacySignalType: SignalType = 'NO_TRADE';
    let sellDistinction: SellSignalDistinction = 'NOT_APPLICABLE';

    if (isBullishTriggered) {
      signalClassification = 'BUY_SETUP';
      legacySignalType = 'BUY_SETUP';
      sellDistinction = 'NOT_APPLICABLE';
    } else if (isBearishTrend) {
      if (holdsPositionInPortfolio) {
        signalClassification = 'EXIT_WARNING';
        legacySignalType = 'SELL_SETUP';
        sellDistinction = 'EXISTING_POSITION_EXIT';
      } else {
        signalClassification = 'SELL_SETUP';
        legacySignalType = 'SELL_SETUP';
        sellDistinction = 'BEARISH_MARKET_SIGNAL';
      }
    }

    const invPrice = isBearishTrend
      ? roundTo(Math.max(ema50 * 1.005, price + 1.8 * atr), 4)
      : roundTo(Math.min(ema50 * 0.995, price - 1.8 * atr), 4);
    const t1 = isBearishTrend
      ? roundTo(Math.max(0.0001, price - 2.0 * atr), 4)
      : roundTo(price + 2.0 * atr, 4);
    const t2 = isBearishTrend
      ? roundTo(Math.max(0.0001, price - 3.2 * atr), 4)
      : roundTo(price + 3.2 * atr, 4);

    const baseScore = isTriggered
      ? Math.min(
          94,
          Math.max(
            55,
            62 +
              (isBullishTriggered ? met.length : 3) * 6 +
              multiTimeframe.convictionAdjustment
          )
        )
      : Math.max(20, 28 + met.length * 8);

    const status: SignalStatus = isTriggered
      ? multiTimeframe.isHigherTimeframeAligned
        ? 'CONFIRMED'
        : 'AWAITING_CONFIRMATION'
      : 'DETECTED';

    results.push({
      strategyId: 'STRAT_TREND_FOLLOWING_V1',
      strategyName: 'Trend Following Multi-EMA & ADX',
      strategyVersion: '1.0.0',
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      horizon,
      timeframe: indicators.timeframe,
      evaluatedAt,
      isTriggered,
      signalClassification,
      legacySignalType,
      signalStatus: status,
      sellDistinction,
      referenceEntryZone: isBullishTriggered
        ? {
            min: roundTo(Math.min(price, ema20 * 1.005), 4),
            max: roundTo(price * 1.008, 4),
            ideal: roundTo(price, 4),
          }
        : isBearishTrend && !holdsPositionInPortfolio
        ? {
            min: roundTo(price * 0.992, 4),
            max: roundTo(Math.max(price, ema20 * 0.995), 4),
            ideal: roundTo(price, 4),
          }
        : null,
      invalidationPrice: invPrice,
      invalidationReason: isBearishTrend
        ? `Recupero in chiusura sopra EMA50 (${roundTo(ema50, 3)}) o sopra ${invPrice} (+1.8x ATR14).`
        : `Chiusura candela sotto EMA50 (${roundTo(ema50, 3)}) o sotto ${invPrice} (-1.8x ATR14).`,
      targetLevels: isBearishTrend
        ? [
            { price: t1, label: 'Target Ribassista 1 (-2.0x ATR)', atrMultiple: 2.0 },
            { price: t2, label: 'Target Ribassista 2 (-3.2x ATR)', atrMultiple: 3.2 },
          ]
        : [
            { price: t1, label: 'Target 1 (+2.0x ATR)', atrMultiple: 2.0 },
            { price: t2, label: 'Target 2 (+3.2x ATR)', atrMultiple: 3.2 },
          ],
      conditionsMet: met,
      conditionsUnmet: unmet,
      heuristicScore: baseScore,
      rationale: isBullishTriggered
        ? `Trend rialzista strutturato su ${instrument.ticker}: medie EMA20/EMA50 ordinate, ADX=${adx.toFixed(1)} e RSI=${rsi.toFixed(1)}. ${multiTimeframe.summary}`
        : isBearishTrend
        ? `Trend ribassista / perdita supporto dinamico su ${instrument.ticker}: Prezzo (${price}) < EMA20 (${roundTo(ema20, 3)}), pendenza ${slope20.toFixed(2)}%. ${holdsPositionInPortfolio ? 'Generato avviso di chiusura/alleggerimento posizione esistente.' : 'Rilevato segnale quantitativo ribassista di mercato.'}`
        : `Configurazione Trend Following incompleta su ${instrument.ticker} (${met.length}/4 condizioni soddisfatte).`,
      keyRisks: [
        multiTimeframe.consensusState === 'CONFLICTING_TRENDS'
          ? 'Attenzione: il timeframe superiore mostra un orientamento divergente.'
          : 'Rischio di rientro in congestione se ADX scende sotto 18.',
        `Volatilità ATR%: ${(indicators.atrPct ?? 1.5).toFixed(2)}% per barra.`,
      ],
    });
  }

  // ----------------------------------------------------------------------------
  // STRATEGIA 2: STRAT_CONFIRMED_BREAKOUT_V1
  // ----------------------------------------------------------------------------
  {
    const met: string[] = [];
    const unmet: string[] = [];
    const resLevel = indicators.resistances[0];
    const brokenPivotHigh = indicators.confirmedPivotHighs?.find((p) => p.broken);

    const refBreakoutPrice = brokenPivotHigh?.price ?? resLevel?.price ?? nearestResistance;
    const distanceToResPct = ((price - refBreakoutPrice) / refBreakoutPrice) * 100;

    if (brokenPivotHigh || (resLevel && distanceToResPct >= -0.25 && distanceToResPct <= 2.5)) {
      met.push(
        `Chiusura in rottura/attacco della resistenza confermata a ${refBreakoutPrice} (scostamento ${distanceToResPct >= 0 ? '+' : ''}${distanceToResPct.toFixed(2)}%)`
      );
    } else {
      unmet.push(`Prezzo (${price}) distante dal livello di breakout (${refBreakoutPrice})`);
    }

    if (rsi >= 54 && rsi <= 78) {
      met.push(`Spinta di momentum RSI(14) = ${rsi.toFixed(1)} a supporto del breakout`);
    } else {
      unmet.push(`RSI(14) = ${rsi.toFixed(1)} non in zona di espansione [54..78]`);
    }

    if (indicators.volumeAvailableAndReliable) {
      if ((rvol ?? 0) >= 1.1) {
        met.push(`Conferma volumetrica attiva: RVOL(20) = ${rvol?.toFixed(2)}x (>= 1.10x)`);
      } else {
        unmet.push(`Volume relativo sotto soglia di breakout: RVOL(20) = ${(rvol ?? 0).toFixed(2)}x (< 1.10x)`);
      }
    } else {
      met.push('Filtro volume disattivato in sicurezza (provider privo di volumi puntuali): validazione basata su Range/ATR');
    }

    const isTriggered =
      (Boolean(brokenPivotHigh) || (Boolean(resLevel) && distanceToResPct >= -0.2 && distanceToResPct <= 2.2)) &&
      rsi >= 53 &&
      (!indicators.volumeAvailableAndReliable || (rvol ?? 1) >= 1.05);

    const invPrice = roundTo(refBreakoutPrice - 0.9 * atr, 4);
    const t1 = roundTo(price + 1.8 * atr, 4);
    const t2 = roundTo(price + 3.0 * atr, 4);

    const score = isTriggered
      ? Math.min(95, Math.max(58, 68 + met.length * 5 + multiTimeframe.convictionAdjustment))
      : Math.max(18, 24 + met.length * 9);

    results.push({
      strategyId: 'STRAT_CONFIRMED_BREAKOUT_V1',
      strategyName: 'Breakout di Resistenza Confermato',
      strategyVersion: '1.0.0',
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      horizon,
      timeframe: indicators.timeframe,
      evaluatedAt,
      isTriggered,
      signalClassification: isTriggered ? 'BULLISH_BREAKOUT' : 'NO_TRADE',
      legacySignalType: isTriggered ? 'BREAKOUT_ALERT' : 'NO_TRADE',
      signalStatus: isTriggered
        ? multiTimeframe.isHigherTimeframeAligned
          ? 'CONFIRMED'
          : 'AWAITING_CONFIRMATION'
        : 'DETECTED',
      sellDistinction: 'NOT_APPLICABLE',
      referenceEntryZone: isTriggered
        ? {
            min: roundTo(refBreakoutPrice * 0.998, 4),
            max: roundTo(refBreakoutPrice * 1.015, 4),
            ideal: roundTo(price, 4),
          }
        : null,
      invalidationPrice: invPrice,
      invalidationReason: `Rientro in chiusura sotto il livello di breakout (${refBreakoutPrice}) meno 0.9x ATR (${invPrice}).`,
      targetLevels: [
        { price: t1, label: 'Target 1 Espansione (+1.8x ATR)', atrMultiple: 1.8 },
        { price: t2, label: 'Target 2 Proiezione (+3.0x ATR)', atrMultiple: 3.0 },
      ],
      conditionsMet: met,
      conditionsUnmet: unmet,
      heuristicScore: score,
      rationale: isTriggered
        ? `Breakout quantitativo rilevato su ${instrument.ticker} oltre il livello chiave ${refBreakoutPrice} con RSI=${rsi.toFixed(1)}.`
        : `Nessun breakout confermato su ${instrument.ticker} al prezzo corrente (${price}).`,
      keyRisks: [
        'Rischio di falso breakout (bull trap) in caso di chiusura giornaliera nuovamente sotto il livello.',
        ...(indicators.volumeAvailableAndReliable
          ? []
          : ['Nota: il provider dati per questo strumento non espone volumi; breakout verificato solo su prezzo/ATR.']),
      ],
    });
  }

  // ----------------------------------------------------------------------------
  // STRATEGIA 3: STRAT_PULLBACK_IN_TREND_V1
  // ----------------------------------------------------------------------------
  {
    const met: string[] = [];
    const unmet: string[] = [];

    const primaryBullish = price > sma50 && ema20 >= sma50 * 0.995;
    if (primaryBullish) {
      met.push(`Trend di fondo costruttivo: Prezzo (${price}) > SMA50 (${roundTo(sma50, 3)})`);
    } else {
      unmet.push(`Trend di fondo non rialzista (Prezzo=${price} vs SMA50=${roundTo(sma50, 3)})`);
    }

    const distEma20Pct = Math.abs((price - ema20) / ema20) * 100;
    const distSupportPct = Math.abs((price - nearestSupport) / nearestSupport) * 100;
    const nearPullbackZone = distEma20Pct <= 1.8 || distSupportPct <= 1.8;

    if (nearPullbackZone) {
      met.push(
        `Prezzo in area di pullback tecnico (distanza da EMA20: ${distEma20Pct.toFixed(2)}%, da supporto ${nearestSupport}: ${distSupportPct.toFixed(2)}%)`
      );
    } else {
      unmet.push(`Prezzo non in prossimità di EMA20 o supporto (${distEma20Pct.toFixed(2)}% da EMA20)`);
    }

    if (rsi >= 40 && rsi <= 60) {
      met.push(`RSI(14) = ${rsi.toFixed(1)} scarico in zona neutra di ri-accumulo [40..60]`);
    } else {
      unmet.push(`RSI(14) = ${rsi.toFixed(1)} fuori dalla finestra di pullback [40..60]`);
    }

    const isTriggered = primaryBullish && nearPullbackZone && rsi >= 38 && rsi <= 62;
    const invPrice = roundTo(Math.min(nearestSupport * 0.99, sma50 - 1.0 * atr), 4);
    const t1 = roundTo(Math.max(nearestResistance, price + 1.6 * atr), 4);
    const t2 = roundTo(price + 2.8 * atr, 4);

    const score = isTriggered
      ? Math.min(92, Math.max(56, 65 + met.length * 6 + multiTimeframe.convictionAdjustment))
      : Math.max(20, 25 + met.length * 8);

    results.push({
      strategyId: 'STRAT_PULLBACK_IN_TREND_V1',
      strategyName: 'Pullback Controllato in Trend Rialzista',
      strategyVersion: '1.0.0',
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      horizon,
      timeframe: indicators.timeframe,
      evaluatedAt,
      isTriggered,
      signalClassification: isTriggered ? 'BUY_SETUP' : 'NO_TRADE',
      legacySignalType: isTriggered ? 'BUY_SETUP' : 'NO_TRADE',
      signalStatus: isTriggered ? 'CONFIRMED' : 'DETECTED',
      sellDistinction: 'NOT_APPLICABLE',
      referenceEntryZone: isTriggered
        ? {
            min: roundTo(Math.min(price, ema20) * 0.995, 4),
            max: roundTo(Math.max(price, ema20) * 1.006, 4),
            ideal: roundTo(ema20, 4),
          }
        : null,
      invalidationPrice: invPrice,
      invalidationReason: `Violazione in chiusura del supporto statico ${nearestSupport} o di SMA50 - 1x ATR (${invPrice}).`,
      targetLevels: [
        { price: t1, label: 'Target 1 Ritest Massimo / Resistenza', atrMultiple: 1.6 },
        { price: t2, label: 'Target 2 Estensione Trend (+2.8x ATR)', atrMultiple: 2.8 },
      ],
      conditionsMet: met,
      conditionsUnmet: unmet,
      heuristicScore: score,
      rationale: isTriggered
        ? `Pullback ordinato su ${instrument.ticker} all'interno di un trend sopra SMA50 (${roundTo(sma50, 3)}), con livello di invalidazione ravvicinato a ${invPrice}.`
        : `Condizioni di Pullback in Trend non complete su ${instrument.ticker}.`,
      keyRisks: [
        'Se i volumi in vendita accelerano sotto SMA50, il pullback si invalida in inversione ribassista.',
      ],
    });
  }

  // ----------------------------------------------------------------------------
  // STRATEGIA 4: STRAT_VOLATILITY_RISK_ALERT_V1 (Risk / Breakdown / Exit Warning)
  // ----------------------------------------------------------------------------
  {
    const met: string[] = [];
    const unmet: string[] = [];

    const atrPct = indicators.atrPct ?? 1.2;
    const ddCurrent = indicators.currentDrawdownFromPeakPct ?? 0;
    const bearishBreakdown = price < ema20 && ema20 < ema50 && rsi < 44;
    const highVolatilitySpike =
      regime.volatilityRegime === 'HIGH_VOLATILITY' || atrPct >= 3.8 || ddCurrent >= 10;

    if (highVolatilitySpike) {
      met.push(
        `Espansione di volatilità / drawdown rilevata: ATR%=${atrPct.toFixed(2)}%, Drawdown dal picco=${ddCurrent.toFixed(2)}%`
      );
    } else {
      unmet.push(`Volatilità contenuta (ATR%=${atrPct.toFixed(2)}%, Drawdown=${ddCurrent.toFixed(2)}%)`);
    }

    if (bearishBreakdown) {
      met.push(
        `Deterioramento direzionale ribassista: Prezzo (${price}) < EMA20 (${roundTo(ema20, 3)}) < EMA50 (${roundTo(ema50, 3)}) con RSI=${rsi.toFixed(1)}`
      );
    } else {
      unmet.push('Struttura direzionale non in breakdown ribassista acuto');
    }

    const isTriggered = highVolatilitySpike || bearishBreakdown;

    // Distinzione rigorosa tra uscita da posizione esistente, segnale ribassista e setup short teorico (Sezione 9 Prompt 3)
    let classification: SignalClassificationV3 = 'NO_TRADE';
    let legacyType: SignalType = 'NO_TRADE';
    let sellDistinction: SellSignalDistinction = 'NOT_APPLICABLE';

    if (isTriggered) {
      if (holdsPositionInPortfolio && bearishBreakdown) {
        classification = 'EXIT_WARNING';
        legacyType = 'SELL_SETUP';
        sellDistinction = 'EXISTING_POSITION_EXIT';
      } else if (bearishBreakdown) {
        classification = 'BEARISH_BREAKDOWN';
        legacyType = 'BREAKDOWN_ALERT';
        sellDistinction = instrument.isDerivative
          ? 'THEORETICAL_SHORT_SETUP'
          : 'BEARISH_MARKET_SIGNAL';
      } else {
        classification = 'VOLATILITY_ALERT';
        legacyType = 'RISK_ALERT';
        sellDistinction = holdsPositionInPortfolio
          ? 'EXISTING_POSITION_EXIT'
          : 'BEARISH_MARKET_SIGNAL';
      }
    }

    const invPrice = roundTo(Math.max(ema20 * 1.01, price + 1.5 * atr), 4);
    const downside1 = roundTo(Math.max(0.0001, price - 1.5 * atr), 4);
    const downside2 = roundTo(Math.max(0.0001, price - 2.5 * atr), 4);

    const score = isTriggered
      ? Math.min(92, Math.round(64 + (bearishBreakdown ? 14 : 0) + (highVolatilitySpike ? 10 : 0)))
      : 22;

    results.push({
      strategyId: 'STRAT_VOLATILITY_RISK_ALERT_V1',
      strategyName: 'Alert di Rischio, Breakdown e Volatilità Anomala',
      strategyVersion: '1.0.0',
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      horizon,
      timeframe: indicators.timeframe,
      evaluatedAt,
      isTriggered,
      signalClassification: classification,
      legacySignalType: legacyType,
      signalStatus: isTriggered ? 'CONFIRMED' : 'DETECTED',
      sellDistinction,
      referenceEntryZone: isTriggered
        ? { min: roundTo(price * 0.995, 4), max: roundTo(price * 1.005, 4), ideal: price }
        : null,
      invalidationPrice: invPrice,
      invalidationReason: `Rientro dell'alert sopra EMA20 / livello di recupero ${invPrice}.`,
      targetLevels: [
        { price: downside1, label: 'Supporto Inferiore (-1.5x ATR)', atrMultiple: -1.5 },
        { price: downside2, label: 'Estensione Ribassista (-2.5x ATR)', atrMultiple: -2.5 },
      ],
      conditionsMet: met,
      conditionsUnmet: unmet,
      heuristicScore: score,
      rationale: isTriggered
        ? `Alert di Rischio / Deterioramento (${sellDistinction}) su ${instrument.ticker}: ${met.join(' | ')}`
        : `Nessuna anomalia critica di volatilità o breakdown attiva su ${instrument.ticker}.`,
      keyRisks: [
        holdsPositionInPortfolio
          ? 'Strumento presente in portafoglio: valuta il rispetto dello stop di protezione o la riduzione dell\'esposizione.'
          : 'Fase ad alta instabilità: evita ingressi impulsivi senza conferma di tenuta dei supporti.',
      ],
    });
  }

  return results;
}

/**
 * 10. RISK INTELLIGENCE ENGINE & POSITION SIMULATOR (Sezione 10 Prompt 3)
 */
export function evaluateRiskIntelligence(params: {
  instrument: NegotiableInstrument;
  quote: MarketQuote;
  indicators: QuantitativeIndicatorsSnapshot;
  bestSetup?: StrategyEvaluationResult;
  baseCurrency?: string;
  currentPortfolioWeightPct?: number;
}): RiskIntelligenceReport {
  const {
    instrument,
    quote,
    indicators,
    bestSetup,
    baseCurrency = 'EUR',
    currentPortfolioWeightPct = 0,
  } = params;

  const price = quote.price > 0 ? quote.price : indicators.latestClose;
  const atrPct = indicators.atrPct ?? 1.8;
  const annVol = indicators.historicalVolatilityAnnualizedPct ?? atrPct * 15.8;
  const maxDd = indicators.maxDrawdownPct ?? 8.0;

  const invalidationPrice =
    bestSetup?.invalidationPrice ??
    indicators.supports[0]?.price ??
    roundTo(price * (1 - Math.max(0.02, (atrPct / 100) * 1.8)), 4);

  const distanceToInvalidationPct =
    price > 0 ? roundTo((Math.abs(price - invalidationPrice) / price) * 100, 2) : null;

  const liquidityRisk: RiskIntelligenceReport['liquidityRisk'] =
    instrument.liquidityTier === 'HIGH'
      ? 'LOW'
      : instrument.liquidityTier === 'MEDIUM'
        ? 'MEDIUM'
        : 'HIGH';

  const fxRiskExposed = instrument.quoteCurrency !== baseCurrency;
  const fxPairDescription = fxRiskExposed
    ? `Rischio di cambio attivo: strumento quotato in ${instrument.quoteCurrency} vs valuta base ${baseCurrency}.`
    : `Nessun rischio cambio diretto (quotato in ${baseCurrency}).`;

  const overnightAndGapRisk: RiskIntelligenceReport['overnightAndGapRisk'] =
    instrument.assetClass === 'CRYPTO'
      ? 'NONE_24X7'
      : instrument.isDerivative
        ? 'HIGH_OVERNIGHT_WEEKEND_GAP'
        : 'MODERATE_INTRADAY';

  // Calcolo deterministico Overall Risk Score (0..100, più alto = più rischioso)
  let riskScore = 20;
  riskScore += Math.min(35, atrPct * 6.5);
  riskScore += Math.min(20, maxDd * 0.7);
  if (liquidityRisk === 'MEDIUM') riskScore += 8;
  if (liquidityRisk === 'HIGH') riskScore += 18;
  if (fxRiskExposed) riskScore += 5;
  if (instrument.isDerivative) riskScore += 12;
  if (currentPortfolioWeightPct > 25) riskScore += 10;
  riskScore = Math.min(99, Math.max(8, Math.round(riskScore)));

  const riskBand: RiskBandLevel =
    riskScore >= 75
      ? 'EXTREME'
      : riskScore >= 52
        ? 'HIGH'
        : riskScore >= 32
          ? 'MODERATE'
          : 'LOW';

  const riskWarnings: string[] = [];
  if (atrPct >= 3.5) {
    riskWarnings.push(`Volatilità per barra elevata (ATR% = ${atrPct.toFixed(2)}%). Riduci la taglia della posizione.`);
  }
  if (fxRiskExposed) {
    riskWarnings.push(fxPairDescription);
  }
  if (instrument.isDerivative) {
    riskWarnings.push(
      'Strumento derivato (CFD/Future): soggetto a costi di finanziamento overnight e rischio di leva.'
    );
  }
  if (currentPortfolioWeightPct >= 25) {
    riskWarnings.push(
      `Concentrazione portafoglio elevata (${currentPortfolioWeightPct.toFixed(1)}% già allocato su questo strumento).`
    );
  }

  const atrAbs = indicators.atr14 ?? price * 0.02;
  const deterministicScenarios = [
    {
      label: 'Scenario Avverso (Invalidazione / -1.8x ATR)',
      targetPrice: roundTo(invalidationPrice, 4),
      movePct: roundTo(((invalidationPrice - price) / price) * 100, 2),
      estimatedPnlPct: roundTo(((invalidationPrice - price) / price) * 100 - 0.2, 2),
    },
    {
      label: 'Scenario Base Conservativo (+1.5x ATR)',
      targetPrice: roundTo(price + 1.5 * atrAbs, 4),
      movePct: roundTo(((1.5 * atrAbs) / price) * 100, 2),
      estimatedPnlPct: roundTo(((1.5 * atrAbs) / price) * 100 - 0.2, 2),
    },
    {
      label: 'Scenario Espansivo (+3.0x ATR)',
      targetPrice: roundTo(price + 3.0 * atrAbs, 4),
      movePct: roundTo(((3.0 * atrAbs) / price) * 100, 2),
      estimatedPnlPct: roundTo(((3.0 * atrAbs) / price) * 100 - 0.2, 2),
    },
  ];

  return {
    instrumentId: instrument.id,
    instrumentTicker: instrument.ticker,
    evaluatedAt: new Date().toISOString(),
    overallRiskScore: riskScore,
    riskBand,
    atrPct,
    annualizedVolatilityPct: roundTo(annVol, 2),
    recentMaxDrawdownPct: roundTo(maxDd, 2),
    distanceToInvalidationPct,
    liquidityRisk,
    fxRiskExposed,
    fxPairDescription,
    portfolioConcentrationImpactPct: roundTo(currentPortfolioWeightPct, 2),
    overnightAndGapRisk,
    deterministicScenarios,
    riskWarnings,
  };
}

/**
 * Simulatore Deterministico di Posizione e Rischio (Sezione 10 Prompt 3)
 */
export function simulatePositionRisk(input: PositionSimulationInput): PositionSimulationResult {
  const fxRate = input.fxRateToBase && input.fxRateToBase > 0 ? input.fxRateToBase : 1;
  const entry = Math.max(0.000001, input.entryPrice);
  const stop = Math.max(0.000001, input.invalidationStopPrice);
  const capitalInBase = Math.max(0, input.capitalAllocatedInBase);
  const totalEquity = Math.max(capitalInBase, input.totalPortfolioEquityInBase || 10000);
  const maxRiskPct = input.maxAcceptablePortfolioRiskPct > 0 ? input.maxAcceptablePortfolioRiskPct : 2.0;

  const entryInBase = entry * fxRate;
  const positionUnits = entryInBase > 0 ? roundTo(capitalInBase / entryInBase, 6) : 0;
  const grossExposureInBase = roundTo(positionUnits * entryInBase, 2);

  // Costi roundtrip (ingresso + uscita): commissioni % + spread bps + slippage bps
  const totalFrictionRateOneWay =
    (Math.max(0, input.commissionPct) / 100) +
    (Math.max(0, input.spreadBps) / 10000) +
    (Math.max(0, input.slippageBps) / 10000);
  const totalRoundtripCostsInBase = roundTo(grossExposureInBase * totalFrictionRateOneWay * 2, 2);

  const unitLossAbsInQuote = Math.abs(entry - stop);
  const grossLossAtStopInBase = positionUnits * unitLossAbsInQuote * fxRate;
  const maxLossAtInvalidationInBase = roundTo(grossLossAtStopInBase + totalRoundtripCostsInBase, 2);

  const maxLossPctOfPosition =
    grossExposureInBase > 0
      ? roundTo((maxLossAtInvalidationInBase / grossExposureInBase) * 100, 2)
      : 0;

  const portfolioCapitalAtRiskPct =
    totalEquity > 0 ? roundTo((maxLossAtInvalidationInBase / totalEquity) * 100, 2) : 0;

  const exceedsMaxRiskThreshold = portfolioCapitalAtRiskPct > maxRiskPct;

  // Calcolo dimensione massima raccomandata per rispettare il budget di rischio (es. 1% o 2% del portafoglio)
  const maxAllowedLossInBase = totalEquity * (maxRiskPct / 100);
  const perUnitRiskWithCostsInBase =
    (unitLossAbsInQuote + entry * totalFrictionRateOneWay * 2) * fxRate;
  const recommendedMaxPositionUnits =
    perUnitRiskWithCostsInBase > 0
      ? roundTo(maxAllowedLossInBase / perUnitRiskWithCostsInBase, 6)
      : 0;
  const recommendedMaxCapitalInBase = roundTo(recommendedMaxPositionUnits * entryInBase, 2);

  const targetsSimulation = (input.targetPrices || []).map((targetPrice) => {
    const unitGainInQuote = Math.abs(targetPrice - entry);
    const grossProfitInBase = roundTo(positionUnits * unitGainInQuote * fxRate, 2);
    const netProfitInBase = roundTo(grossProfitInBase - totalRoundtripCostsInBase, 2);
    const netReturnPct =
      grossExposureInBase > 0 ? roundTo((netProfitInBase / grossExposureInBase) * 100, 2) : 0;
    const riskRewardRatio =
      maxLossAtInvalidationInBase > 0
        ? roundTo(Math.max(0, netProfitInBase) / maxLossAtInvalidationInBase, 2)
        : 0;

    return {
      targetPrice: roundTo(targetPrice, 4),
      grossProfitInBase,
      netProfitInBase,
      netReturnPct,
      riskRewardRatio,
    };
  });

  const warnings: string[] = [];
  if (exceedsMaxRiskThreshold) {
    warnings.push(
      `Attenzione: la perdita potenziale allo stop (${maxLossAtInvalidationInBase} valuta base, pari al ${portfolioCapitalAtRiskPct}% del portafoglio) supera la soglia massima impostata (${maxRiskPct}%). Capitale massimo suggerito: ${recommendedMaxCapitalInBase}.`
    );
  }
  if (targetsSimulation.length > 0 && targetsSimulation[0].riskRewardRatio < 1.3) {
    warnings.push(
      `Rapporto Rendimento/Rischio netto sul primo target inferiore a 1.3 (${targetsSimulation[0].riskRewardRatio}:1) al netto di commissioni, spread e slippage.`
    );
  }
  if (stop >= entry) {
    warnings.push(
      'Nota: per una posizione Long, il livello di invalidazione (stop) dovrebbe trovarsi al di sotto del prezzo di ingresso.'
    );
  }

  return {
    instrumentId: input.instrumentId,
    entryPrice: entry,
    invalidationStopPrice: stop,
    positionUnits,
    grossExposureInBase,
    totalRoundtripCostsInBase,
    maxLossAtInvalidationInBase,
    maxLossPctOfPosition,
    portfolioCapitalAtRiskPct,
    maxAcceptablePortfolioRiskPct: maxRiskPct,
    exceedsMaxRiskThreshold,
    recommendedMaxPositionUnits,
    recommendedMaxCapitalInBase,
    targetsSimulation,
    warnings,
  };
}

/**
 * 11. OPPORTUNITY RANKING ENGINE (Sezione 11 Prompt 3)
 * Punteggio composito trasparente (0..100) con de-duplicazione degli indicatori collineari
 * e Data Completeness Score separato dalla qualità dell'opportunità.
 */
export function rankMarketOpportunities(
  items: AnalyzedInstrumentIntelligenceItem[],
  brokerSymbolMap?: Record<string, string>
): OpportunityRankingItem[] {
  const weights = {
    trendCoherence: 0.25,
    momentumConfirm: 0.2,
    structureProximity: 0.2,
    riskRewardQuality: 0.2,
    multiTimeframeConfirm: 0.15,
  };

  // Escludi dalla graduatoria gli strumenti con dati insufficienti o bloccati dal Fail-Safe
  const eligible = items.filter(
    (item) =>
      !item.dataQuality.blockingSignalGeneration &&
      item.indicators.sufficientData
  );

  const scored: Omit<OpportunityRankingItem, 'rank'>[] = eligible.map((item) => {
    const ind = item.indicators;
    const setup = item.bestStrategySetup;
    const regime = item.regime;
    const mtf = item.multiTimeframe;

    // 1. Trend Coherence (0..100)
    let trendCoherence = 50;
    if (regime.directionalRegime === 'BULLISH_TREND') {
      trendCoherence = 78 + Math.min(20, (ind.adx14 ?? 20) - 18);
    } else if (regime.directionalRegime === 'BEARISH_TREND') {
      trendCoherence = setup.signalClassification === 'BEARISH_BREAKDOWN' ? 75 : 35;
    } else if (regime.directionalRegime === 'SIDEWAYS') {
      trendCoherence = setup.strategyId === 'STRAT_CONFIRMED_BREAKOUT_V1' ? 68 : 48;
    }

    // 2. Momentum Confirm con penalità anti-collinearità (RSI + MACD + Stochastic sintetizzati senza triplo conteggio)
    const rsi = ind.rsi14 ?? 50;
    const macdHist = ind.macd?.histogram ?? 0;
    const stochK = ind.stochastic14?.k ?? 50;

    const rsiScore = rsi >= 50 && rsi <= 70 ? 85 : rsi > 70 ? 60 : 40;
    const macdScore = macdHist > 0 ? 82 : 42;
    const stochScore = stochK >= 50 && stochK <= 80 ? 80 : 45;

    // De-duplicazione collineare: invece di sommare i 3 oscillatori, prendiamo la media armonizzata e applichiamo penalità se tutti sono in ipercomprato estremo
    const allOverboughtCollinear = rsi > 74 && stochK > 82 && macdHist > 0;
    let momentumConfirm = Math.round(rsiScore * 0.45 + macdScore * 0.35 + stochScore * 0.2);
    if (allOverboughtCollinear) {
      momentumConfirm = Math.max(40, momentumConfirm - 18);
    }

    // 3. Structure Proximity (vicinanza a livello chiave e invalidazione chiara)
    let structureProximity = 55;
    if (setup.isTriggered && setup.invalidationPrice !== null) {
      const distInvPct = Math.abs(item.quote.price - setup.invalidationPrice) / item.quote.price;
      if (distInvPct > 0.004 && distInvPct <= 0.045) {
        structureProximity = 88;
      } else if (distInvPct <= 0.08) {
        structureProximity = 72;
      } else {
        structureProximity = 52;
      }
    }

    // 4. Risk/Reward & Volatility Quality
    let riskRewardQuality = Math.max(25, 100 - item.riskReport.overallRiskScore);
    if (setup.targetLevels.length > 0 && setup.invalidationPrice) {
      const reward = Math.abs(setup.targetLevels[0].price - item.quote.price);
      const risk = Math.max(0.0001, Math.abs(item.quote.price - setup.invalidationPrice));
      const rr = reward / risk;
      if (rr >= 2.0) riskRewardQuality = Math.min(95, riskRewardQuality + 18);
      else if (rr < 1.2) riskRewardQuality = Math.max(20, riskRewardQuality - 15);
    }

    // 5. Multi-Timeframe Confirm
    const multiTimeframeConfirm =
      mtf.consensusState === 'CONCORDANT_BULLISH' || mtf.consensusState === 'CONCORDANT_BEARISH'
        ? 92
        : mtf.consensusState === 'CONFIRMED_BY_HIGHER_TF'
          ? 76
          : mtf.consensusState === 'CONFLICTING_TRENDS'
            ? 28
            : 54;

    const rawComposite =
      trendCoherence * weights.trendCoherence +
      momentumConfirm * weights.momentumConfirm +
      structureProximity * weights.structureProximity +
      riskRewardQuality * weights.riskRewardQuality +
      multiTimeframeConfirm * weights.multiTimeframeConfirm;

    const compositeScore = Math.min(98, Math.max(10, Math.round(rawComposite)));

    // Data Completeness Score calcolato SEPARATAMENTE dalla qualità dell'opportunità!
    let completeness = 65;
    if (item.dataQuality.validClosedCandlesCount >= 100) completeness += 15;
    else if (item.dataQuality.validClosedCandlesCount >= 50) completeness += 10;
    if (item.dataQuality.volumeReliable) completeness += 10;
    if (item.dataQuality.classification === 'VALID') completeness += 10;
    const dataCompletenessScore = Math.min(100, completeness);

    const positiveDrivers: string[] = [...setup.conditionsMet.slice(0, 3)];
    if (mtf.isHigherTimeframeAligned) {
      positiveDrivers.push(`Conferma Multi-Timeframe attiva (${mtf.consensusState})`);
    }

    const negativeRiskFactors: string[] = [
      ...setup.conditionsUnmet.slice(0, 2),
      ...item.riskReport.riskWarnings.slice(0, 2),
    ];

    return {
      instrumentId: item.instrumentId,
      instrumentTicker: item.ticker,
      instrumentName: item.name,
      assetClass: item.assetClass,
      verifiedBrokerSymbol: brokerSymbolMap?.[item.instrumentId],
      horizon: setup.horizon,
      timeframe: setup.timeframe,
      signalClassification: setup.signalClassification,
      signalStatus: setup.signalStatus,
      sellDistinction: setup.sellDistinction,
      strategyId: setup.strategyId,
      strategyName: setup.strategyName,
      compositeScore,
      dataCompletenessScore,
      weights,
      componentScores: {
        trendCoherence: Math.round(trendCoherence),
        momentumConfirm: Math.round(momentumConfirm),
        structureProximity: Math.round(structureProximity),
        riskRewardQuality: Math.round(riskRewardQuality),
        multiTimeframeConfirm: Math.round(multiTimeframeConfirm),
      },
      collinearityPenaltyApplied: allOverboughtCollinear,
      collinearityNotes: allOverboughtCollinear
        ? 'Penalità collinearità applicata (-18 pt sul sub-score Momentum): RSI, Stocastico e MACD simultaneamente in estensione riducono l\'asimmetria favorevole.'
        : 'Indicatori di momentum (RSI, MACD, Stocastico) aggregati con tetto massimo del 20% per evitare doppi conteggi.',
      positiveDrivers,
      negativeRiskFactors,
      observedPrice: item.quote.price,
      currency: item.currency,
      referenceEntryZone: setup.referenceEntryZone,
      invalidationPrice: setup.invalidationPrice,
      targetLevels: setup.targetLevels,
      riskBand: item.riskReport.riskBand,
      directionalRegime: regime.directionalRegime,
      volatilityRegime: regime.volatilityRegime,
      multiTimeframeState: mtf.consensusState,
    };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  return scored.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

/**
 * 7. SMART MARKET SCANNER (Sezione 7 Prompt 3)
 * Analizza l'universo ordinato per priorità, applica i 18 filtri e restituisce output strutturato.
 */
export function runSmartMarketScanner(params: {
  instruments: NegotiableInstrument[];
  quotesMap: Record<string, MarketQuote>;
  candlesByInstrument: Record<string, HistoricalCandle[]>;
  higherTfCandlesByInstrument?: Record<string, HistoricalCandle[]>;
  watchlistIds: string[];
  activeAlertInstrumentIds: string[];
  portfolioInstrumentIds: string[];
  brokerSymbolMap?: Record<string, string>;
  instrumentBrokersMap?: Record<string, string[]>;
  filters?: MarketScanFilterParams;
  mode: DataExecutionMode;
  baseCurrency?: string;
}): MarketScanRunResult {
  const startMs = Date.now();
  const startedAt = new Date(startMs).toISOString();
  const filters: MarketScanFilterParams = params.filters || {};
  const horizon: TimeHorizon = filters.horizon || 'BREVE';
  const profile = HORIZON_PROFILES_V3[horizon];
  const timeframe: CandleTimeframe = filters.timeframe || profile.primaryTimeframe;

  const watchlistSet = new Set(params.watchlistIds);
  const alertSet = new Set(params.activeAlertInstrumentIds);
  const portfolioSet = new Set(params.portfolioInstrumentIds);

  // Ordinamento per priorità (Sezione 7.1 Prompt 3)
  const prioritizedInstruments = [...params.instruments].sort((a, b) => {
    const score = (id: string) =>
      portfolioSet.has(id) ? 4 : alertSet.has(id) ? 3 : watchlistSet.has(id) ? 2 : 1;
    return score(b.id) - score(a.id);
  });

  const excludedInstruments: MarketScanRunResult['excludedInstruments'] = [];
  const analyzedInstruments: AnalyzedInstrumentIntelligenceItem[] = [];

  for (const inst of prioritizedInstruments) {
    // Filtri preliminari su catalogo
    if (
      filters.onlyWatchlistOrPortfolio &&
      !watchlistSet.has(inst.id) &&
      !portfolioSet.has(inst.id) &&
      !alertSet.has(inst.id)
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: 'Escluso dal filtro Solo Watchlist / Portafoglio / Alert attivi.',
      });
      continue;
    }

    if (
      filters.assetClasses &&
      filters.assetClasses.length > 0 &&
      !filters.assetClasses.includes(inst.assetClass)
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `Asset class ${inst.assetClass} esclusa dal filtro utente.`,
      });
      continue;
    }

    if (
      filters.currencies &&
      filters.currencies.length > 0 &&
      !filters.currencies.includes(inst.quoteCurrency)
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `Valuta ${inst.quoteCurrency} esclusa dal filtro utente.`,
      });
      continue;
    }

    if (
      filters.venues &&
      filters.venues.length > 0 &&
      !filters.venues.includes(inst.venueMic)
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `Borsa/Venue ${inst.venueMic} esclusa dal filtro utente.`,
      });
      continue;
    }

    if (filters.brokers && filters.brokers.length > 0 && params.instrumentBrokersMap) {
      const supportedBrokers = params.instrumentBrokersMap[inst.id] || [];
      const hasBrokerMatch = filters.brokers.some((b) => supportedBrokers.includes(b));
      if (!hasBrokerMatch) {
        excludedInstruments.push({
          instrumentId: inst.id,
          ticker: inst.ticker,
          name: inst.name,
          reasonCode: 'FILTERED_OUT_BY_CRITERIA',
          detail: 'Strumento non mappato sui broker selezionati nel filtro.',
        });
        continue;
      }
    }

    const quote = params.quotesMap[inst.id];
    const rawCandles = params.candlesByInstrument[inst.id] || [];
    if (!quote || rawCandles.length === 0) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'PROVIDER_UNAVAILABLE',
        detail: 'Quotazione o serie storica OHLCV non disponibile dal provider.',
      });
      continue;
    }

    const dataQuality = auditMarketDataQuality(inst.id, timeframe, rawCandles, quote, {
      isDerivative: inst.isDerivative,
      assetClass: inst.assetClass,
      minRequiredCandles: 15,
    });

    if (filters.excludeStaleData !== false && dataQuality.blockingSignalGeneration) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode:
          dataQuality.classification === 'INCOMPLETE'
            ? 'INSUFFICIENT_HISTORICAL_CANDLES'
            : 'INVALID_OR_STALE_DATA',
        detail: dataQuality.blockingReasons.join(' ') || `Stato qualità dati: ${dataQuality.classification}`,
      });
      continue;
    }

    const annualizationMode = inst.assetClass === 'CRYPTO' ? 'CRYPTO' : 'OTHER';
    const indicators = computeQuantitativeSnapshot(inst.id, timeframe, rawCandles, annualizationMode);
    if (!indicators.sufficientData) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'INSUFFICIENT_HISTORICAL_CANDLES',
        detail: indicators.insufficientReason || 'Candele chiuse insufficienti.',
      });
      continue;
    }

    const regime = detectMarketRegime(indicators);
    const higherCandles = params.higherTfCandlesByInstrument?.[inst.id];
    const higherIndicators =
      higherCandles && higherCandles.length >= 15
        ? computeQuantitativeSnapshot(
            inst.id,
            profile.higherConfirmationTimeframe,
            higherCandles,
            annualizationMode
          )
        : null;

    const multiTimeframe = evaluateMultiTimeframeConsensus(
      inst.id,
      horizon,
      indicators,
      higherIndicators
    );

    // Filtri quantitativi avanzati
    if (
      filters.regimeFilter &&
      filters.regimeFilter !== 'ALL' &&
      regime.directionalRegime !== filters.regimeFilter
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `Regime direzionale ${regime.directionalRegime} diverso da ${filters.regimeFilter}.`,
      });
      continue;
    }

    if (
      filters.volatilityFilter &&
      filters.volatilityFilter !== 'ALL' &&
      regime.volatilityRegime !== filters.volatilityFilter
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `Regime volatilità ${regime.volatilityRegime} diverso da ${filters.volatilityFilter}.`,
      });
      continue;
    }

    if (
      filters.trendFilter &&
      filters.trendFilter !== 'ALL' &&
      indicators.trendDirection !== filters.trendFilter
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `Direzione trend ${indicators.trendDirection} diversa da ${filters.trendFilter}.`,
      });
      continue;
    }

    if (filters.rsiMin !== undefined && (indicators.rsi14 ?? 50) < filters.rsiMin) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `RSI(14) = ${indicators.rsi14} inferiore a soglia minima ${filters.rsiMin}.`,
      });
      continue;
    }

    if (filters.rsiMax !== undefined && (indicators.rsi14 ?? 50) > filters.rsiMax) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `RSI(14) = ${indicators.rsi14} superiore a soglia massima ${filters.rsiMax}.`,
      });
      continue;
    }

    if (
      filters.minRelativeVolume !== undefined &&
      indicators.volumeAvailableAndReliable &&
      (indicators.relativeVolume ?? 0) < filters.minRelativeVolume
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `RVOL = ${indicators.relativeVolume} inferiore a ${filters.minRelativeVolume}.`,
      });
      continue;
    }

    if (
      filters.breakoutOnly &&
      indicators.priceStructure !== 'BREAKOUT' &&
      !indicators.confirmedPivotHighs?.some((p) => p.broken)
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: 'Nessun breakout di resistenza attivo (filtro Breakout Only).',
      });
      continue;
    }

    if (filters.pullbackOnly && indicators.priceStructure !== 'PULLBACK_IN_UPTREND') {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: 'Strumento non in configurazione Pullback in Trend (filtro Pullback Only).',
      });
      continue;
    }

    const strategiesEvaluated = evaluateAllStrategiesForInstrument({
      instrument: inst,
      quote,
      dataQuality,
      indicators,
      regime,
      multiTimeframe,
      horizon,
      holdsPositionInPortfolio: portfolioSet.has(inst.id),
    });

    const sortedStrategies = [...strategiesEvaluated].sort(
      (a, b) => (b.isTriggered ? 100 : 0) + b.heuristicScore - ((a.isTriggered ? 100 : 0) + a.heuristicScore)
    );
    const bestStrategySetup = sortedStrategies[0];

    if (
      filters.minHeuristicScore !== undefined &&
      bestStrategySetup.heuristicScore < filters.minHeuristicScore
    ) {
      excludedInstruments.push({
        instrumentId: inst.id,
        ticker: inst.ticker,
        name: inst.name,
        reasonCode: 'FILTERED_OUT_BY_CRITERIA',
        detail: `Score euristico (${bestStrategySetup.heuristicScore}) inferiore al minimo richiesto (${filters.minHeuristicScore}).`,
      });
      continue;
    }

    const riskReport = evaluateRiskIntelligence({
      instrument: inst,
      quote,
      indicators,
      bestSetup: bestStrategySetup,
      baseCurrency: params.baseCurrency || 'EUR',
    });

    const priorityTier: AnalyzedInstrumentIntelligenceItem['priorityTier'] = portfolioSet.has(
      inst.id
    )
      ? 'PORTFOLIO'
      : alertSet.has(inst.id)
        ? 'ACTIVE_ALERTS'
        : watchlistSet.has(inst.id)
          ? 'WATCHLIST'
          : 'CATALOG';

    analyzedInstruments.push({
      instrumentId: inst.id,
      ticker: inst.ticker,
      name: inst.name,
      assetClass: inst.assetClass,
      venueMic: inst.venueMic,
      currency: inst.quoteCurrency,
      priorityTier,
      quote,
      dataQuality,
      indicators,
      regime,
      multiTimeframe,
      strategiesEvaluated,
      bestStrategySetup,
      riskReport,
    });
  }

  const detectedSetups = analyzedInstruments
    .flatMap((item) => item.strategiesEvaluated)
    .filter(
      (s) =>
        s.isTriggered &&
        s.strategyId !== 'STRAT_VOLATILITY_RISK_ALERT_V1'
    );

  const riskAlerts = analyzedInstruments
    .flatMap((item) => item.strategiesEvaluated)
    .filter(
      (s) =>
        s.isTriggered &&
        s.strategyId === 'STRAT_VOLATILITY_RISK_ALERT_V1'
    );

  const topRankedOpportunities = rankMarketOpportunities(
    analyzedInstruments,
    params.brokerSymbolMap
  );

  const endMs = Date.now();
  const universeTotal = prioritizedInstruments.length;
  const analyzedCount = analyzedInstruments.length;
  const excludedCount = excludedInstruments.length;
  const coveragePct =
    universeTotal > 0 ? roundTo((analyzedCount / universeTotal) * 100, 1) : 0;

  return {
    runId: `SCAN_${endMs}`,
    startedAt,
    completedAt: new Date(endMs).toISOString(),
    executionMs: Math.max(1, endMs - startMs),
    mode: params.mode,
    appliedFilters: filters,
    universeTotal,
    analyzedCount,
    excludedCount,
    coveragePct,
    excludedInstruments,
    analyzedInstruments,
    detectedSetups,
    riskAlerts,
    topRankedOpportunities,
  };
}
