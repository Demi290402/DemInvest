// ==============================================================================
// DEMINVEST — TIME HORIZON ENGINE & SIGNAL INTELLIGENCE ENGINE
// ==============================================================================
// Regole Non Negoziabili (Sezioni 10, 11 e 29):
// 1. Generazione 100% deterministica: un LLM non può decidere arbitrariamente
//    di emettere un segnale.
// 2. Nessun segnale intraday (BREVISSIMO) può essere emesso su dati ritardati
//    oltre la soglia (EOD o STALE).
// 3. I punteggi euristici (0-100) sono esplicitamente identificati come punteggi
//    multifattoriali e MAI come "probabilità di successo".
// 4. Distinzione rigorosa tra SELL_SETUP (uscita da posizione long / riduzione
//    esposizione) e apertura di uno short speculativo.
// 5. No-Trade Detector attivo: in assenza di condizioni rigorose, restituisce
//    NO_TRADE elencando esplicitamente tutte le condizioni non soddisfatte.
// ==============================================================================

import {
  AlertRule,
  BrokerInstrumentMapping,
  CandleTimeframe,
  GeneratedSignal,
  MarketQuote,
  NegotiableInstrument,
  QuantitativeIndicatorsSnapshot,
  SignalStatus,
  SignalType,
  TimeHorizon,
  TimeHorizonConfig,
} from '../types/domain';

export const DEFAULT_TIME_HORIZON_CONFIGS: Record<TimeHorizon, TimeHorizonConfig> = {
  BREVISSIMO: {
    horizon: 'BREVISSIMO',
    label: 'Brevissimo Termine (Intraday: Minuti – 24h)',
    durationDescription: 'Operatività o monitoraggio da pochi minuti fino a 24 ore.',
    recommendedTimeframes: ['15m', '1h'],
    maxAllowedDataDelaySeconds: 180, // Max 3 minuti di ritardo ammesso per segnali intraday
    requiresRealtimeOrNearRealtime: true,
    methodologyFocus: [
      'Controllo rigoroso freschezza dati (blocco automatico su dati EOD/ritardati)',
      'Volatilità intraday (ATR 14) e anomalie di volume relativo (RVOL)',
      'Impatto di spread bid/ask e liquidità del book sullo strumento',
    ],
    primaryRisks: [
      'Rumore statistico elevato e falsi breakout intraday',
      'Incidenza percentuale elevata di spread e slippage',
      'Rischio di esecuzione su quotazioni non real-time',
    ],
  },
  BREVE: {
    horizon: 'BREVE',
    label: 'Breve Termine (Swing: 1 – 30 Giorni)',
    durationDescription: 'Analisi multi-giornaliera orientata a swing, momentum e struttura del trend.',
    recommendedTimeframes: ['4h', '1d'],
    maxAllowedDataDelaySeconds: 3600,
    requiresRealtimeOrNearRealtime: false,
    methodologyFocus: [
      'Allineamento Trend (SMA 20 / EMA 20 / SMA 50) e forza direzionale (ADX 14)',
      'Momentum (RSI 14, MACD Histogram) e Pullback su supporti verificati',
      'Definizione rigorosa del livello di invalidazione basato su ATR(14)',
    ],
    primaryRisks: [
      'Gap di apertura tra sessioni giornaliere (overnight risk)',
      'Eventi societari (trimestrali) o rilasci macroeconomici improvvisi',
    ],
  },
  MEDIO: {
    horizon: 'MEDIO',
    label: 'Medio Termine (Posizionale: 1 – 12 Mesi)',
    durationDescription: 'Orizzonte ciclico basato su trend primario, regime di volatilità e contesto macro.',
    recommendedTimeframes: ['1d', '1w'],
    maxAllowedDataDelaySeconds: 86400,
    requiresRealtimeOrNearRealtime: false,
    methodologyFocus: [
      'Struttura primaria (SMA 50 / SMA 200) e ciclo di volatilità annualizzata',
      'Valutazione drawdown storico e tenuta dei supporti strutturali',
      'Contesto macroeconomico (tassi di interesse, inflazione, liquidità)',
    ],
    primaryRisks: [
      'Cambio di regime macroeconomico o monetario',
      'Rischio di cambio (FX) su strumenti denominati in valuta estera',
    ],
  },
  LUNGO: {
    horizon: 'LUNGO',
    label: 'Lungo Termine (Strategico / PAC: > 12 Mesi)',
    durationDescription: 'Allocazione strategica di capitale, piani di accumulo (PAC) e controllo concentrazione.',
    recommendedTimeframes: ['1w', '1d'],
    maxAllowedDataDelaySeconds: 86400,
    requiresRealtimeOrNearRealtime: false,
    methodologyFocus: [
      'Sostenibilità del sottostante, diversificazione e controllo concentrazione',
      'Zone di sconto statistico rispetto alle medie storiche per ingressi PAC',
      'Minimizzazione costi ricorrenti (TER ETF, commissioni, imposte)',
    ],
    primaryRisks: [
      'Rischio di concentrazione eccessiva su singolo emittente o settore',
      'Drawdown prolungati multi-annuali e perdita di potere d\'acquisto reale',
    ],
  },
};

function roundPrice(value: number): number {
  if (value >= 100) return Math.round(value * 100) / 100;
  if (value >= 1) return Math.round(value * 10000) / 10000;
  return Math.round(value * 1000000) / 1000000;
}

export function buildSignalDedupHash(params: {
  instrumentId: string;
  signalType: SignalType;
  horizon: TimeHorizon;
  timeframe: CandleTimeframe;
  dateIsoBucket: string;
}): string {
  return `${params.instrumentId}::${params.signalType}::${params.horizon}::${params.timeframe}::${params.dateIsoBucket}`;
}

/**
 * Verifica se un segnale o alert è duplicato rispetto ai segnali attivi o in cooldown.
 */
export function isDuplicateSignal(
  candidateDedupHash: string,
  existingSignals: GeneratedSignal[],
  cooldownMinutes = 120,
  nowUtc: Date = new Date()
): boolean {
  for (const existing of existingSignals) {
    if (existing.dedupHash === candidateDedupHash) {
      if (
        existing.status === 'DETECTED' ||
        existing.status === 'AWAITING_CONFIRMATION' ||
        existing.status === 'CONFIRMED'
      ) {
        return true;
      }
      const elapsedMs = nowUtc.getTime() - new Date(existing.detectedAt).getTime();
      if (elapsedMs < cooldownMinutes * 60 * 1000) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calcola la data di scadenza deterministica di un segnale in base all'orizzonte.
 */
export function calculateSignalExpiration(horizon: TimeHorizon, detectedAt: Date = new Date()): string {
  const msMap: Record<TimeHorizon, number> = {
    BREVISSIMO: 8 * 3600 * 1000,       // 8 ore
    BREVE: 7 * 24 * 3600 * 1000,       // 7 giorni
    MEDIO: 30 * 24 * 3600 * 1000,      // 30 giorni
    LUNGO: 90 * 24 * 3600 * 1000,      // 90 giorni
  };
  return new Date(detectedAt.getTime() + msMap[horizon]).toISOString();
}

/**
 * Valuta un segnale esistente rispetto al prezzo corrente e all'orario attuale
 * per determinare eventuali transizioni di stato (EXPIRED, INVALIDATED, CONFIRMED).
 * Non modifica mai retroattivamente i valori storici osservati al momento della creazione.
 */
export function evaluateSignalLifecycleTransition(
  signal: GeneratedSignal,
  currentQuote: MarketQuote,
  nowUtc: Date = new Date()
): {
  updatedStatus: SignalStatus;
  transitionOccurred: boolean;
  reason: string;
} {
  if (
    signal.status === 'INVALIDATED' ||
    signal.status === 'EXPIRED' ||
    signal.status === 'CANCELLED'
  ) {
    return {
      updatedStatus: signal.status,
      transitionOccurred: false,
      reason: `Segnale già in stato terminale (${signal.status}).`,
    };
  }

  // 1. Verifica scadenza temporale
  if (nowUtc.getTime() >= new Date(signal.expiresAt).getTime()) {
    return {
      updatedStatus: 'EXPIRED',
      transitionOccurred: true,
      reason: `Scadenza temporale raggiunta (${signal.expiresAt}).`,
    };
  }

  // 2. Verifica invalidazione sul prezzo
  if (signal.invalidationLevel !== null && currentQuote.validity === 'VALID') {
    const isBullishSetup =
      signal.signalType === 'BUY_SETUP' || signal.signalType === 'BREAKOUT_ALERT';
    const isBearishSetup =
      signal.signalType === 'SELL_SETUP' || signal.signalType === 'BREAKDOWN_ALERT';

    if (isBullishSetup && currentQuote.price <= signal.invalidationLevel) {
      return {
        updatedStatus: 'INVALIDATED',
        transitionOccurred: true,
        reason: `Prezzo corrente (${currentQuote.price} ${currentQuote.currency}) ha violato al ribasso il livello di invalidazione (${signal.invalidationLevel}).`,
      };
    }

    if (isBearishSetup && currentQuote.price >= signal.invalidationLevel) {
      return {
        updatedStatus: 'INVALIDATED',
        transitionOccurred: true,
        reason: `Prezzo corrente (${currentQuote.price} ${currentQuote.currency}) ha superato il livello di invalidazione (${signal.invalidationLevel}).`,
      };
    }
  }

  // 3. Verifica conferma di segnale in AWAITING_CONFIRMATION
  if (
    signal.status === 'AWAITING_CONFIRMATION' &&
    signal.interestLevel !== null &&
    currentQuote.validity === 'VALID'
  ) {
    if (
      (signal.signalType === 'BUY_SETUP' || signal.signalType === 'BREAKOUT_ALERT') &&
      currentQuote.price >= signal.interestLevel * 1.002
    ) {
      return {
        updatedStatus: 'CONFIRMED',
        transitionOccurred: true,
        reason: `Prezzo confermato sopra il livello di interesse (${signal.interestLevel}).`,
      };
    }
  }

  return {
    updatedStatus: signal.status,
    transitionOccurred: false,
    reason: 'Condizioni del segnale ancora valide.',
  };
}

/**
 * Motore Deterministico di Valutazione Opportunità e No-Trade Detector.
 */
export function evaluateDeterministicSignal(params: {
  instrument: NegotiableInstrument;
  quote: MarketQuote;
  indicators: QuantitativeIndicatorsSnapshot;
  horizon: TimeHorizon;
  verifiedMapping?: BrokerInstrumentMapping | null;
  horizonConfigs?: Record<TimeHorizon, TimeHorizonConfig>;
  nowUtc?: Date;
}): GeneratedSignal {
  const {
    instrument,
    quote,
    indicators,
    horizon,
    verifiedMapping,
    horizonConfigs = DEFAULT_TIME_HORIZON_CONFIGS,
    nowUtc = new Date(),
  } = params;

  const horizonSpec = horizonConfigs[horizon];
  const dateBucket = nowUtc.toISOString().slice(0, 13); // bucket orario UTC
  const conditionsMet: string[] = [];
  const conditionsUnmet: string[] = [];
  const keyRisks: string[] = [];

  // --- CONTROLLO 1: Validità e Freschezza Quotazione (Guardia Non Negoziabile) ---
  if (quote.validity !== 'VALID' || quote.price <= 0) {
    conditionsUnmet.push(
      `Quotazione non valida o sospesa (stato: ${quote.validity}). Impossibile generare segnali.`
    );
    return createNoTradeSignal({
      instrument,
      quote,
      indicators,
      horizon,
      verifiedMapping,
      conditionsMet,
      conditionsUnmet,
      keyRisks: ['Dati di mercato incompleti o obsoleti: analisi operativa sospesa.'],
      rationale:
        'NO_TRADE (Blocco Qualità Dati): La quotazione non soddisfa i requisiti minimi di integrità.',
      nowUtc,
      dateBucket,
    });
  }

  // Blocco tassativo segnali intraday (BREVISSIMO) su dati ritardati o EOD (Regola 29.9)
  if (
    horizon === 'BREVISSIMO' &&
    (quote.freshness === 'EOD' ||
      quote.freshness === 'STALE' ||
      quote.delaySeconds > horizonSpec.maxAllowedDataDelaySeconds)
  ) {
    conditionsUnmet.push(
      `Orizzonte BREVISSIMO richiede dati con ritardo <= ${horizonSpec.maxAllowedDataDelaySeconds}s (attuale: ${quote.freshness}, ritardo ${quote.delaySeconds}s).`
    );
    return createNoTradeSignal({
      instrument,
      quote,
      indicators,
      horizon,
      verifiedMapping,
      conditionsMet,
      conditionsUnmet,
      keyRisks: [
        'Rischio di latenza informativa: vietato emettere segnali intraday su dati EOD o ritardati.',
      ],
      rationale: `NO_TRADE (Protezione Intraday): Dati con stato ${quote.freshness} (${quote.delaySeconds}s di ritardo). DemInvest blocca qualsiasi segnale intraday quando la freschezza non è adeguata.`,
      nowUtc,
      dateBucket,
    });
  }

  conditionsMet.push(
    `Qualità dati verificata da ${quote.providerName} (stato: ${quote.freshness}, ritardo: ${quote.delaySeconds}s).`
  );

  // --- CONTROLLO 2: Sufficienza Osservazioni Serie Storica ---
  if (!indicators.sufficientData || indicators.rsi14 === null || indicators.sma20 === null || indicators.atr14 === null) {
    conditionsUnmet.push(
      indicators.insufficientReason ||
        'Numero insufficiente di candele chiuse per calcolare RSI(14), SMA(20) e ATR(14).'
    );
    return createNoTradeSignal({
      instrument,
      quote,
      indicators,
      horizon,
      verifiedMapping,
      conditionsMet,
      conditionsUnmet,
      keyRisks: ['Storico candele insufficiente per la validazione statistica.'],
      rationale:
        'NO_TRADE (Osservazioni Insufficienti): Il motore quantitativo richiede almeno 20 candele chiuse per validare un setup.',
      nowUtc,
      dateBucket,
    });
  }

  conditionsMet.push(`Serie storica chiusa validata (${indicators.observationsCount} candele su ${indicators.timeframe}).`);

  // --- CALCOLO TRASPARENTE DEL PUNTEGGIO EURISTICO (0..100, NON PROBABILITÀ) ---
  let trendScore = 50;
  if (indicators.trendDirection === 'BULLISH') trendScore = 78;
  else if (indicators.trendDirection === 'BEARISH') trendScore = 30;
  if (indicators.adx14 !== null && indicators.adx14 >= 25) {
    trendScore = Math.min(100, trendScore + 12);
  }

  let momentumScore = 50;
  const rsi = indicators.rsi14;
  const macdHist = indicators.macd?.histogram ?? 0;
  if (rsi >= 45 && rsi <= 66 && macdHist > 0) {
    momentumScore = 82;
  } else if (rsi < 32 && indicators.trendDirection !== 'BEARISH') {
    momentumScore = 76; // Ipervenduto su struttura non ribassista
  } else if (rsi > 74) {
    momentumScore = 28; // Eccesso di ipercomprato
  }

  let volatilityRiskScore = 75;
  const atrPct = indicators.atrPct ?? 2;
  if (atrPct > 6.5) {
    volatilityRiskScore = 40;
    keyRisks.push(`Volatilità giornaliera elevata (ATR pari al ${atrPct}% del prezzo).`);
  } else if (atrPct < 0.3) {
    volatilityRiskScore = 55;
  } else {
    volatilityRiskScore = 84;
  }

  let volumeConfirmationScore = 65;
  const rvol = indicators.relativeVolume;
  if (rvol !== null) {
    if (rvol >= 1.25) {
      volumeConfirmationScore = 88;
      conditionsMet.push(`Volume relativo sopra la media a 20 periodi (RVOL = ${rvol}x).`);
    } else if (rvol < 0.65) {
      volumeConfirmationScore = 42;
      conditionsUnmet.push(`Volume relativo debole (RVOL = ${rvol}x < 0.80x richiesto per piena conferma).`);
      keyRisks.push('Partecipazione volumetrica inferiore alla media mobile a 20 periodi.');
    } else {
      volumeConfirmationScore = 70;
    }
  }

  const dataQualityScore =
    quote.freshness === 'REALTIME' ? 95 : quote.freshness === 'DELAYED' ? 82 : 65;

  const heuristicScore = Math.round(
    trendScore * 0.28 +
      momentumScore * 0.25 +
      volatilityRiskScore * 0.20 +
      volumeConfirmationScore * 0.15 +
      dataQualityScore * 0.12
  );

  // Avvisi specifici strumento/derivato
  if (instrument.isDerivative || verifiedMapping?.contractType === 'CFD') {
    keyRisks.push(
      'Strumento derivato/CFD: presenza di spread bid/ask OTC, leva finanziaria e costi overnight (swap).'
    );
  }
  if (instrument.quoteCurrency !== 'EUR') {
    keyRisks.push(`Rischio di cambio valutario (${instrument.quoteCurrency}/EUR).`);
  }

  const price = quote.price;
  const atr = indicators.atr14;

  // --- STRATEGIA 1: BREAKOUT STRUTTURALE CONFERMATO ---
  if (
    indicators.priceStructure === 'BREAKOUT' &&
    indicators.trendDirection === 'BULLISH' &&
    rsi <= 74
  ) {
    conditionsMet.push(
      `Breakout della resistenza statica con prezzo (${price}) sopra SMA20 (${indicators.sma20}) e RSI(14) = ${rsi}.`
    );
    const isConfirmed = (rvol ?? 1) >= 1.2;
    const status: SignalStatus = isConfirmed ? 'CONFIRMED' : 'AWAITING_CONFIRMATION';
    if (!isConfirmed) {
      conditionsUnmet.push('Attesa conferma chiusura candela con RVOL >= 1.20x.');
    }

    const invalidationLevel = roundPrice(price - 1.8 * atr);
    const target1 = roundPrice(price + 2.2 * atr);
    const target2 = roundPrice(price + 3.8 * atr);

    return {
      id: `SIG_${instrument.id}_${nowUtc.getTime()}`,
      assetId: instrument.underlyingAssetId,
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      instrumentName: instrument.name,
      verifiedBrokerCode:
        verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerCode : undefined,
      verifiedBrokerSymbol:
        verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerSymbol : undefined,
      signalType: 'BREAKOUT_ALERT',
      status,
      horizon,
      timeframe: indicators.timeframe,
      strategyId: 'STRAT_FRACTAL_BREAKOUT_V1',
      strategyName: 'Breakout Frattale con Filtro ATR & Momentum',
      strategyVersion: '1.0.0',
      observedPrice: price,
      currency: quote.currency,
      providerId: quote.providerId,
      quoteObservedAt: quote.observedAt,
      quoteFreshness: quote.freshness,
      heuristicScore,
      scoreBreakdown: {
        trendScore,
        momentumScore,
        volatilityRiskScore,
        volumeConfirmationScore,
        dataQualityScore,
      },
      indicatorsSnapshot: {
        rsi14: indicators.rsi14,
        sma20: indicators.sma20,
        sma50: indicators.sma50,
        ema20: indicators.ema20,
        macdHistogram: indicators.macd?.histogram ?? null,
        atr14: indicators.atr14,
        adx14: indicators.adx14,
        relativeVolume: indicators.relativeVolume,
      },
      conditionsMet,
      conditionsUnmet,
      interestLevel: roundPrice(price),
      invalidationLevel,
      scenarioTargets: [target1, target2],
      keyRisks: [
        ...keyRisks,
        'Rischio di falso breakout (bull trap) in caso di rientro sotto il livello di invalidazione.',
      ],
      quantitativeRationale: `Rilevato superamento del cluster di resistenza con trend primario rialzista (Prezzo ${price} > SMA20 ${indicators.sma20}), RSI(14) a ${rsi} (non in estremo ipercomprato) e ATR(14) = ${atr}. Livello di invalidazione fissato a ${invalidationLevel} (-1.8x ATR).`,
      detectedAt: nowUtc.toISOString(),
      expiresAt: calculateSignalExpiration(horizon, nowUtc),
      statusUpdatedAt: nowUtc.toISOString(),
      dedupHash: buildSignalDedupHash({
        instrumentId: instrument.id,
        signalType: 'BREAKOUT_ALERT',
        horizon,
        timeframe: indicators.timeframe,
        dateIsoBucket: dateBucket,
      }),
      isDemoData: quote.isDemoData,
    };
  }

  // --- STRATEGIA 2: BUY_SETUP (TREND PULLBACK / MOMENTUM ALIGNMENT) ---
  if (
    indicators.trendDirection === 'BULLISH' &&
    rsi >= 38 &&
    rsi <= 65 &&
    (indicators.macd === null || indicators.macd.histogram >= -0.05 * atr)
  ) {
    conditionsMet.push(`Trend rialzista attivo: Prezzo (${price}) > SMA20 (${indicators.sma20}).`);
    conditionsMet.push(`Momentum equilibrato: RSI(14) = ${rsi} nella fascia [38–65].`);
    if (indicators.macd && indicators.macd.histogram > 0) {
      conditionsMet.push(`Istogramma MACD positivo (${indicators.macd.histogram}).`);
    } else {
      conditionsUnmet.push('Istogramma MACD non ancora in espansione positiva netta.');
    }

    const isConfirmed =
      indicators.macd !== null &&
      indicators.macd.histogram > 0 &&
      (rvol === null || rvol >= 0.9);

    const status: SignalStatus = isConfirmed ? 'CONFIRMED' : 'AWAITING_CONFIRMATION';
    const nearestSup = indicators.supports[0]?.price;
    const invalidationLevel = roundPrice(
      nearestSup ? Math.min(nearestSup * 0.99, price - 1.6 * atr) : price - 2.0 * atr
    );
    const target1 = roundPrice(price + 2.0 * atr);
    const target2 = roundPrice(price + 3.5 * atr);

    return {
      id: `SIG_${instrument.id}_${nowUtc.getTime()}`,
      assetId: instrument.underlyingAssetId,
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      instrumentName: instrument.name,
      verifiedBrokerCode:
        verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerCode : undefined,
      verifiedBrokerSymbol:
        verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerSymbol : undefined,
      signalType: 'BUY_SETUP',
      status,
      horizon,
      timeframe: indicators.timeframe,
      strategyId: 'STRAT_TREND_MOMENTUM_PULLBACK_V1',
      strategyName: 'Allineamento Trend & Momentum Controllato',
      strategyVersion: '1.0.0',
      observedPrice: price,
      currency: quote.currency,
      providerId: quote.providerId,
      quoteObservedAt: quote.observedAt,
      quoteFreshness: quote.freshness,
      heuristicScore,
      scoreBreakdown: {
        trendScore,
        momentumScore,
        volatilityRiskScore,
        volumeConfirmationScore,
        dataQualityScore,
      },
      indicatorsSnapshot: {
        rsi14: indicators.rsi14,
        sma20: indicators.sma20,
        sma50: indicators.sma50,
        ema20: indicators.ema20,
        macdHistogram: indicators.macd?.histogram ?? null,
        atr14: indicators.atr14,
        adx14: indicators.adx14,
        relativeVolume: indicators.relativeVolume,
      },
      conditionsMet,
      conditionsUnmet,
      interestLevel: roundPrice(indicators.ema20 ?? price),
      invalidationLevel,
      scenarioTargets: [target1, target2],
      keyRisks: [
        ...keyRisks,
        `La violazione del supporto dinamico / livello di invalidazione (${invalidationLevel}) annulla lo scenario rialzista.`,
      ],
      quantitativeRationale: `Configurazione rialzista deterministica: prezzo (${price}) sopra SMA20 (${indicators.sma20}) con RSI(14) = ${rsi}. Rischio calibrato tramite ATR(14) = ${atr} con livello di invalidazione a ${invalidationLevel}. Punteggio euristico multifattoriale: ${heuristicScore}/100 (non rappresenta una probabilità di profitto).`,
      detectedAt: nowUtc.toISOString(),
      expiresAt: calculateSignalExpiration(horizon, nowUtc),
      statusUpdatedAt: nowUtc.toISOString(),
      dedupHash: buildSignalDedupHash({
        instrumentId: instrument.id,
        signalType: 'BUY_SETUP',
        horizon,
        timeframe: indicators.timeframe,
        dateIsoBucket: dateBucket,
      }),
      isDemoData: quote.isDemoData,
    };
  }

  // --- STRATEGIA 3: SELL_SETUP / RISK_ALERT (USCITA DA POSIZIONE ESISTENTE O DETERIORAMENTO) ---
  if (
    (indicators.trendDirection === 'BEARISH' && rsi < 46) ||
    rsi >= 75
  ) {
    const isOverboughtWarning = rsi >= 75;
    conditionsMet.push(
      isOverboughtWarning
        ? `Eccesso statistico di ipercomprato: RSI(14) = ${rsi} >= 75.`
        : `Deterioramento strutturale: Prezzo (${price}) sotto SMA20 (${indicators.sma20}) con RSI(14) = ${rsi}.`
    );
    conditionsUnmet.push('Condizioni per nuovo ingresso long NON soddisfatte.');

    const invalidationLevel = roundPrice(price + 1.8 * atr);
    const supportTarget = roundPrice(
      indicators.supports[0]?.price ?? price - 2.0 * atr
    );

    return {
      id: `SIG_${instrument.id}_${nowUtc.getTime()}`,
      assetId: instrument.underlyingAssetId,
      instrumentId: instrument.id,
      instrumentTicker: instrument.ticker,
      instrumentName: instrument.name,
      verifiedBrokerCode:
        verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerCode : undefined,
      verifiedBrokerSymbol:
        verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerSymbol : undefined,
      signalType: 'SELL_SETUP',
      status: 'CONFIRMED',
      horizon,
      timeframe: indicators.timeframe,
      strategyId: 'STRAT_RISK_EXIT_MONITOR_V1',
      strategyName: 'Presidio Rischio / Valutazione Uscita Posizione Long',
      strategyVersion: '1.0.0',
      observedPrice: price,
      currency: quote.currency,
      providerId: quote.providerId,
      quoteObservedAt: quote.observedAt,
      quoteFreshness: quote.freshness,
      heuristicScore,
      scoreBreakdown: {
        trendScore,
        momentumScore,
        volatilityRiskScore,
        volumeConfirmationScore,
        dataQualityScore,
      },
      indicatorsSnapshot: {
        rsi14: indicators.rsi14,
        sma20: indicators.sma20,
        sma50: indicators.sma50,
        ema20: indicators.ema20,
        macdHistogram: indicators.macd?.histogram ?? null,
        atr14: indicators.atr14,
        adx14: indicators.adx14,
        relativeVolume: indicators.relativeVolume,
      },
      conditionsMet,
      conditionsUnmet,
      interestLevel: roundPrice(price),
      invalidationLevel,
      scenarioTargets: [supportTarget],
      keyRisks: [
        ...keyRisks,
        'NOTA IMPORTANTE: SELL_SETUP indica una condizione di possibile presa di profitto o riduzione di una posizione long esistente, NON un invito ad aprire posizioni short.',
      ],
      quantitativeRationale: isOverboughtWarning
        ? `SELL_SETUP (Presidio Rischio): RSI(14) ha raggiunto ${rsi}, segnalando estensione statistica. Valutare protezione di eventuali posizioni in essere; non confondere con l'apertura di uno short.`
        : `SELL_SETUP (Debolezza Tecnica): Prezzo (${price}) inferiore a SMA20 (${indicators.sma20}) con momentum negativo (RSI ${rsi}). Livello di invalidazione dello scenario ribassista a ${invalidationLevel}.`,
      detectedAt: nowUtc.toISOString(),
      expiresAt: calculateSignalExpiration(horizon, nowUtc),
      statusUpdatedAt: nowUtc.toISOString(),
      dedupHash: buildSignalDedupHash({
        instrumentId: instrument.id,
        signalType: 'SELL_SETUP',
        horizon,
        timeframe: indicators.timeframe,
        dateIsoBucket: dateBucket,
      }),
      isDemoData: quote.isDemoData,
    };
  }

  // --- ALTRIMENTI: NO-TRADE DETECTOR (QUALITÀ PRIMA DELLA QUANTITÀ) ---
  if (indicators.trendDirection !== 'BULLISH') {
    conditionsUnmet.push(
      `Trend non direzionale o neutro (${indicators.trendDirection}): Prezzo ${price} vs SMA20 ${indicators.sma20}.`
    );
  }
  if (rsi < 38 || rsi > 65) {
    conditionsUnmet.push(`RSI(14) = ${rsi} fuori dalla finestra ottimale [38–65] per un setup equilibrato.`);
  }
  if (indicators.adx14 !== null && indicators.adx14 < 20) {
    conditionsUnmet.push(`Forza del trend debole: ADX(14) = ${indicators.adx14} (< 20).`);
  }

  return createNoTradeSignal({
    instrument,
    quote,
    indicators,
    horizon,
    verifiedMapping,
    conditionsMet,
    conditionsUnmet:
      conditionsUnmet.length > 0
        ? conditionsUnmet
        : ['Mancanza di convergenza simultanea tra trend, momentum e struttura di prezzo.'],
    keyRisks: [
      ...keyRisks,
      'Operare in fase laterale o priva di asimmetria favorevole aumenta il rischio di whipsaw e costi commissionali.',
    ],
    rationale: `NO_TRADE: Il No-Trade Detector ha escluso l'emissione di segnali operativi poiché non sono soddisfatte tutte le condizioni quantitative richieste (Prezzo ${price}, SMA20 ${indicators.sma20}, RSI ${rsi}). DemInvest privilegia l'astensione quando il vantaggio statistico non è chiaro.`,
    nowUtc,
    dateBucket,
    heuristicScore,
  });
}

function createNoTradeSignal(params: {
  instrument: NegotiableInstrument;
  quote: MarketQuote;
  indicators: QuantitativeIndicatorsSnapshot;
  horizon: TimeHorizon;
  verifiedMapping?: BrokerInstrumentMapping | null;
  conditionsMet: string[];
  conditionsUnmet: string[];
  keyRisks: string[];
  rationale: string;
  nowUtc: Date;
  dateBucket: string;
  heuristicScore?: number;
}): GeneratedSignal {
  const {
    instrument,
    quote,
    indicators,
    horizon,
    verifiedMapping,
    conditionsMet,
    conditionsUnmet,
    keyRisks,
    rationale,
    nowUtc,
    dateBucket,
    heuristicScore = 40,
  } = params;

  return {
    id: `NOTRADE_${instrument.id}_${nowUtc.getTime()}`,
    assetId: instrument.underlyingAssetId,
    instrumentId: instrument.id,
    instrumentTicker: instrument.ticker,
    instrumentName: instrument.name,
    verifiedBrokerCode:
      verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerCode : undefined,
    verifiedBrokerSymbol:
      verifiedMapping?.verificationStatus !== 'UNVERIFIED' ? verifiedMapping?.brokerSymbol : undefined,
    signalType: 'NO_TRADE',
    status: 'DETECTED',
    horizon,
    timeframe: indicators.timeframe,
    strategyId: 'STRAT_NO_TRADE_DETECTOR_V1',
    strategyName: 'Filtro Qualità & No-Trade Detector',
    strategyVersion: '1.0.0',
    observedPrice: quote.price,
    currency: quote.currency,
    providerId: quote.providerId,
    quoteObservedAt: quote.observedAt,
    quoteFreshness: quote.freshness,
    heuristicScore,
    scoreBreakdown: {
      trendScore: 40,
      momentumScore: 45,
      volatilityRiskScore: 50,
      volumeConfirmationScore: 45,
      dataQualityScore: quote.validity === 'VALID' ? 80 : 20,
    },
    indicatorsSnapshot: {
      rsi14: indicators.rsi14,
      sma20: indicators.sma20,
      sma50: indicators.sma50,
      ema20: indicators.ema20,
      macdHistogram: indicators.macd?.histogram ?? null,
      atr14: indicators.atr14,
      adx14: indicators.adx14,
      relativeVolume: indicators.relativeVolume,
    },
    conditionsMet,
    conditionsUnmet,
    interestLevel: indicators.supports[0]?.price ?? null,
    invalidationLevel: null,
    scenarioTargets: [],
    keyRisks,
    quantitativeRationale: rationale,
    detectedAt: nowUtc.toISOString(),
    expiresAt: calculateSignalExpiration(horizon, nowUtc),
    statusUpdatedAt: nowUtc.toISOString(),
    dedupHash: buildSignalDedupHash({
      instrumentId: instrument.id,
      signalType: 'NO_TRADE',
      horizon,
      timeframe: indicators.timeframe,
      dateIsoBucket: dateBucket,
    }),
    isDemoData: quote.isDemoData,
  };
}

/**
 * Valuta le regole di alert personalizzate dell'utente (Prezzo, Variazione %, RSI, Volatilità)
 * rispettando il cooldown per evitare notifiche duplicate.
 */
export function evaluateUserAlertRules(params: {
  rules: AlertRule[];
  quote: MarketQuote;
  indicators?: QuantitativeIndicatorsSnapshot;
  nowUtc?: Date;
}): {
  triggeredRule: AlertRule;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
}[] {
  const { rules, quote, indicators, nowUtc = new Date() } = params;
  if (quote.validity !== 'VALID' || quote.price <= 0) return [];

  const triggered: {
    triggeredRule: AlertRule;
    title: string;
    body: string;
    severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  }[] = [];

  for (const rule of rules) {
    if (!rule.isActive || rule.instrumentId !== quote.instrumentId) continue;
    if (rule.expiresAt && nowUtc.getTime() >= new Date(rule.expiresAt).getTime()) continue;

    // Verifica cooldown
    if (rule.lastTriggeredAt) {
      const elapsedMinutes =
        (nowUtc.getTime() - new Date(rule.lastTriggeredAt).getTime()) / (60 * 1000);
      if (elapsedMinutes < rule.cooldownMinutes) continue;
    }

    let matched = false;
    let detailText = '';

    switch (rule.ruleType) {
      case 'PRICE_ABOVE':
        if (quote.price >= rule.thresholdValue) {
          matched = true;
          detailText = `Prezzo osservato (${quote.price} ${quote.currency}) ha raggiunto o superato la soglia configurata (${rule.thresholdValue} ${quote.currency}).`;
        }
        break;
      case 'PRICE_BELOW':
        if (quote.price <= rule.thresholdValue) {
          matched = true;
          detailText = `Prezzo osservato (${quote.price} ${quote.currency}) è sceso a o sotto la soglia configurata (${rule.thresholdValue} ${quote.currency}).`;
        }
        break;
      case 'PCT_CHANGE_24H':
        if (Math.abs(quote.changePct) >= Math.abs(rule.thresholdValue)) {
          matched = true;
          detailText = `Variazione 24h (${quote.changePct.toFixed(2)}%) ha superato la soglia di attenzione (${rule.thresholdValue}%).`;
        }
        break;
      case 'RSI_OVERSOLD':
        if (indicators?.rsi14 !== null && indicators?.rsi14 !== undefined && indicators.rsi14 <= rule.thresholdValue) {
          matched = true;
          detailText = `Indicatore RSI(14) = ${indicators.rsi14} è sceso sotto la soglia di ipervenduto (${rule.thresholdValue}).`;
        }
        break;
      case 'RSI_OVERBOUGHT':
        if (indicators?.rsi14 !== null && indicators?.rsi14 !== undefined && indicators.rsi14 >= rule.thresholdValue) {
          matched = true;
          detailText = `Indicatore RSI(14) = ${indicators.rsi14} ha superato la soglia di ipercomprato (${rule.thresholdValue}).`;
        }
        break;
      case 'VOLATILITY_SPIKE':
        if (indicators?.atrPct !== null && indicators?.atrPct !== undefined && indicators.atrPct >= rule.thresholdValue) {
          matched = true;
          detailText = `Volatilità ATR% (${indicators.atrPct}%) ha superato la soglia di rischio (${rule.thresholdValue}%).`;
        }
        break;
      default:
        break;
    }

    if (matched) {
      const severityMap: Record<AlertRule['priority'], 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'> = {
        LOW: 'INFO',
        MEDIUM: 'WARNING',
        HIGH: 'HIGH',
        CRITICAL: 'CRITICAL',
      };
      triggered.push({
        triggeredRule: rule,
        title: `DemInvest Alert — ${rule.instrumentTicker} (${rule.ruleType})`,
        body: `${detailText} Fonte: ${quote.providerName} (${quote.observedAt.slice(0, 19).replace('T', ' ')} UTC). Verifica condizioni e rischi prima di qualsiasi decisione.`,
        severity: severityMap[rule.priority],
      });
    }
  }

  return triggered;
}
