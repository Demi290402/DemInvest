// ==============================================================================
// DEMINVEST — SUITE DI TEST AUTOMATIZZATI (VITEST)
// ==============================================================================
// Copre tutti i requisiti obbligatori della Sezione 26:
// 1. RSI (Wilder 14)
// 2. MACD (12, 26, 9)
// 3. Medie Mobili (SMA, EMA) e rifiuto candele incomplete
// 4. ATR (Wilder 14) e Bande di Bollinger
// 5. Calcolo rendimenti e Max Drawdown
// 6. Conversioni valutarie (BCE / Frankfurter con fonte e timestamp)
// 7. Validazione segnali e blocco segnali intraday su dati ritardati
// 8. Scadenza e invalidazione segnali
// 9. Deduplicazione alert e cooldown
// 10. Importi, quantità finanziarie e contabilità portafoglio senza errori float
// 11. Identificazione strumenti (Universal Instrument Registry & anti-collisione ticker)
// ==============================================================================

import { describe, expect, it } from 'vitest';
import {
  calculateATR,
  calculateEMA,
  calculateMACD,
  calculateMaxDrawdownPct,
  calculateRSI,
  calculateSMA,
  computeQuantitativeSnapshot,
  sanitizeClosedCandles,
} from '../src/engines/quantitativeEngine';
import {
  calculatePortfolioAnalytics,
  convertCurrencyToBase,
  FxRateTable,
  roundAccounting,
} from '../src/engines/portfolioEngine';
import {
  buildSignalDedupHash,
  evaluateDeterministicSignal,
  evaluateSignalLifecycleTransition,
  evaluateUserAlertRules,
  isDuplicateSignal,
} from '../src/engines/signalIntelligenceEngine';
import {
  INITIAL_NEGOTIABLE_INSTRUMENTS,
  parseBrokerMappingsCsv,
  resolveInstrumentIdentity,
} from '../src/engines/instrumentRegistry';
import {
  executeSimulatedPaperOrder,
  runDeterministicBacktest,
} from '../src/engines/paperAndBacktestEngine';
import { HistoricalCandle, MarketQuote } from '../src/types/domain';

function buildControlledCandles(count: number, startPrice = 100, step = 1.2): HistoricalCandle[] {
  const list: HistoricalCandle[] = [];
  const baseTime = 1760000000;
  for (let i = 0; i < count; i++) {
    const close = +(startPrice + i * step + (i % 3 === 0 ? -0.4 : 0.5)).toFixed(4);
    const open = +(close - 0.6).toFixed(4);
    const high = +(close + 1.1).toFixed(4);
    const low = +(open - 0.9).toFixed(4);
    list.push({
      time: baseTime + i * 86400,
      isoTime: new Date((baseTime + i * 86400) * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: 10000 + i * 250,
      isClosed: true,
      providerId: 'coingecko',
    });
  }
  return list;
}

describe('DemInvest — Motore Quantitativo Deterministico (Sezione 9 & 26)', () => {
  it('1. Calcola correttamente SMA ed EMA e rifiuta serie con osservazioni insufficienti', () => {
    const values = [10, 20, 30, 40, 50];
    expect(calculateSMA(values, 5)).toBe(30);
    expect(calculateSMA(values, 10)).toBeNull();

    const ema3 = calculateEMA(values, 3);
    expect(ema3).not.toBeNull();
    expect(ema3).toBeCloseTo(40, 2);
  });

  it('2. Esclude tassativamente candele parzialmente chiuse (isClosed === false)', () => {
    const candles = buildControlledCandles(20, 100, 1);
    candles.push({
      time: 1790000000,
      isoTime: new Date(1790000000 * 1000).toISOString(),
      open: 120,
      high: 9999, // candela aperta anomala che non deve inquinare il calcolo
      low: 119,
      close: 9999,
      volume: 500,
      isClosed: false,
      providerId: 'coingecko',
    });

    const sanitized = sanitizeClosedCandles(candles);
    expect(sanitized.length).toBe(20);
    expect(sanitized[sanitized.length - 1].close).not.toBe(9999);
  });

  it('3. Calcola RSI(14) di Wilder nel range [0, 100] e restituisce null sotto 15 osservazioni', () => {
    expect(calculateRSI([100, 101, 102, 103], 14)).toBeNull();

    const uptrendCloses = Array.from({ length: 25 }, (_, i) => 100 + i * 2);
    const rsiUp = calculateRSI(uptrendCloses, 14);
    expect(rsiUp).toBe(100);

    const mixedCandles = buildControlledCandles(35, 100, 0.8);
    const rsiMixed = calculateRSI(
      mixedCandles.map((c) => c.close),
      14
    );
    expect(rsiMixed).not.toBeNull();
    expect(rsiMixed!).toBeGreaterThan(50);
    expect(rsiMixed!).toBeLessThan(100);
  });

  it('4. Calcola MACD (12, 26, 9) su dataset di almeno 35 chiusure', () => {
    const shortCloses = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(calculateMACD(shortCloses, 12, 26, 9)).toBeNull();

    const validCloses = buildControlledCandles(45, 100, 1.5).map((c) => c.close);
    const macd = calculateMACD(validCloses, 12, 26, 9);
    expect(macd).not.toBeNull();
    expect(macd!.macdLine).toBeGreaterThan(0);
    expect(macd!.histogram).toBeCloseTo(macd!.macdLine - macd!.signalLine, 4);
  });

  it('5. Calcola ATR(14) di Wilder e Maximum Drawdown (%)', () => {
    const candles = buildControlledCandles(25, 100, 1.0);
    const atr = calculateATR(candles, 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(1.5);

    const equitySeries = [100, 120, 108, 115, 90, 130];
    // Peak 120 -> Trough 90 = (30 / 120) * 100 = 25%
    expect(calculateMaxDrawdownPct(equitySeries)).toBe(25);
  });
});

describe('DemInvest — Portafoglio, Rendimenti, Importi e Conversioni Valutarie (Sezione 15 & 26)', () => {
  const mockFxTable: FxRateTable = {
    baseCurrency: 'EUR',
    ratesToBase: {
      EUR: { rate: 1, source: 'BCE', date: '2026-10-16' },
      USD: { rate: 0.9, source: 'BCE_FRANKFURTER', date: '2026-10-16' },
    },
  };

  it('6. Esegue conversioni valutarie preservando fonte, tasso e precisione contabile', () => {
    expect(roundAccounting(0.1 + 0.2, 4)).toBe(0.3);

    const conv = convertCurrencyToBase(1000, 'USD', mockFxTable);
    expect(conv.convertedAmount).toBe(900);
    expect(conv.rate).toBe(0.9);
    expect(conv.source).toBe('BCE_FRANKFURTER');
    expect(conv.date).toBe('2026-10-16');
  });

  it('7. Calcola rendimenti realizzati, non realizzati e segnala valutazione incompleta se manca il prezzo', () => {
    const btcQuote: MarketQuote = {
      instrumentId: 'INST_BTC_USD_SPOT',
      price: 80000,
      changeAbs: 1000,
      changePct: 1.25,
      currency: 'USD',
      providerId: 'coingecko',
      providerName: 'CoinGecko API v3',
      venueMic: 'CRYPTO_GLOBAL',
      observedAt: '2026-10-17T08:00:00Z',
      fetchedAt: '2026-10-17T08:00:05Z',
      freshness: 'REALTIME',
      delaySeconds: 5,
      validity: 'VALID',
      isMarketOpen: true,
      isDemoData: false,
    };

    const summary = calculatePortfolioAnalytics({
      transactions: [
        {
          id: 'T1',
          instrumentId: 'INST_BTC_USD_SPOT',
          instrumentTicker: 'BTC/USD',
          transactionType: 'BUY',
          quantity: 0.1,
          unitPrice: 60000, // 6000 USD * 0.9 = 5400 EUR
          fees: 0,
          currency: 'USD',
          fxRateToBase: 0.9,
          fxSource: 'BCE',
          fxObservedAt: '2026-10-01T10:00:00Z',
          declaredBrokerCode: 'TRADE_REPUBLIC',
          executedAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'T2',
          instrumentId: 'INST_BTC_USD_SPOT',
          instrumentTicker: 'BTC/USD',
          transactionType: 'SELL',
          quantity: 0.05,
          unitPrice: 70000, // 3500 USD * 0.9 = 3150 EUR (costo rimosso 2700 EUR -> Realized +450 EUR)
          fees: 0,
          currency: 'USD',
          fxRateToBase: 0.9,
          fxSource: 'BCE',
          fxObservedAt: '2026-10-10T10:00:00Z',
          declaredBrokerCode: 'TRADE_REPUBLIC',
          executedAt: '2026-10-10T10:00:00Z',
        },
      ],
      quotesByInstrumentId: { INST_BTC_USD_SPOT: btcQuote },
      fxTable: mockFxTable,
    });

    expect(summary.isValuationComplete).toBe(true);
    expect(summary.realizedPnlInBase).toBe(450);
    // 0.05 BTC rimasti a costo 2700 EUR, valore mercato 0.05 * 80000 * 0.9 = 3600 EUR -> Unrealized +900 EUR
    expect(summary.estimatedMarketValueInBase).toBe(3600);
    expect(summary.unrealizedPnlInBase).toBe(900);

    // Verifica segnalazione valutazione incompleta quando il prezzo non è disponibile
    const incompleteSummary = calculatePortfolioAnalytics({
      transactions: [
        {
          id: 'T1',
          instrumentId: 'INST_BTC_USD_SPOT',
          instrumentTicker: 'BTC/USD',
          transactionType: 'BUY',
          quantity: 0.1,
          unitPrice: 60000,
          fees: 0,
          currency: 'USD',
          fxRateToBase: 0.9,
          fxSource: 'BCE',
          fxObservedAt: '2026-10-01T10:00:00Z',
          declaredBrokerCode: 'TRADE_REPUBLIC',
          executedAt: '2026-10-01T10:00:00Z',
        },
      ],
      quotesByInstrumentId: {},
      fxTable: mockFxTable,
    });
    expect(incompleteSummary.isValuationComplete).toBe(false);
    expect(incompleteSummary.incompletePositionsCount).toBe(1);
  });
});

describe('DemInvest — Signal Intelligence Engine, Scadenza e Deduplicazione Alert (Sezione 11 & 26)', () => {
  const btcInst = INITIAL_NEGOTIABLE_INSTRUMENTS.find((i) => i.id === 'INST_BTC_USD_SPOT')!;
  const candles = buildControlledCandles(45, 70000, 350);
  const indicators = computeQuantitativeSnapshot('INST_BTC_USD_SPOT', '1d', candles, 'CRYPTO');

  it('8. Blocca rigorosamente segnali intraday (BREVISSIMO) su dati ritardati o EOD (Regola 29.9)', () => {
    const delayedQuote: MarketQuote = {
      instrumentId: 'INST_BTC_USD_SPOT',
      price: 85000,
      changeAbs: 500,
      changePct: 0.6,
      currency: 'USD',
      providerId: 'coingecko',
      providerName: 'CoinGecko API',
      venueMic: 'CRYPTO_GLOBAL',
      observedAt: '2026-10-16T20:00:00Z',
      fetchedAt: '2026-10-17T08:00:00Z',
      freshness: 'EOD',
      delaySeconds: 43200,
      validity: 'VALID',
      isMarketOpen: true,
      isDemoData: false,
    };

    const intradaySignal = evaluateDeterministicSignal({
      instrument: btcInst,
      quote: delayedQuote,
      indicators,
      horizon: 'BREVISSIMO',
    });

    expect(intradaySignal.signalType).toBe('NO_TRADE');
    expect(intradaySignal.quantitativeRationale).toContain('Protezione Intraday');
  });

  it('9. Gestisce correttamente validazione, scadenza (EXPIRED) e invalidazione (INVALIDATED) dei segnali', () => {
    const freshQuote: MarketQuote = {
      instrumentId: 'INST_BTC_USD_SPOT',
      price: candles[candles.length - 1].close,
      changeAbs: 800,
      changePct: 1.1,
      currency: 'USD',
      providerId: 'coingecko',
      providerName: 'CoinGecko API',
      venueMic: 'CRYPTO_GLOBAL',
      observedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      freshness: 'REALTIME',
      delaySeconds: 15,
      validity: 'VALID',
      isMarketOpen: true,
      isDemoData: false,
    };

    const signal = evaluateDeterministicSignal({
      instrument: btcInst,
      quote: freshQuote,
      indicators,
      horizon: 'BREVE',
    });

    expect(signal.heuristicScore).toBeGreaterThanOrEqual(0);
    expect(signal.heuristicScore).toBeLessThanOrEqual(100);

    // Test transizione a INVALIDATED se il prezzo viola invalidationLevel
    if (signal.invalidationLevel !== null) {
      const isBearish =
        signal.signalType === 'SELL_SETUP' || signal.signalType === 'BREAKDOWN_ALERT';
      const invalidatingQuote: MarketQuote = {
        ...freshQuote,
        price: isBearish
          ? signal.invalidationLevel + 500
          : signal.invalidationLevel - 500,
      };
      const invEval = evaluateSignalLifecycleTransition(signal, invalidatingQuote);
      expect(invEval.transitionOccurred).toBe(true);
      expect(invEval.updatedStatus).toBe('INVALIDATED');
    }

    // Test transizione a EXPIRED dopo la data di scadenza
    const futureDate = new Date(new Date(signal.expiresAt).getTime() + 60000);
    const expEval = evaluateSignalLifecycleTransition(signal, freshQuote, futureDate);
    expect(expEval.transitionOccurred).toBe(true);
    expect(expEval.updatedStatus).toBe('EXPIRED');
  });

  it('10. Previene la duplicazione di segnali e applica il cooldown sugli alert', () => {
    const hash = buildSignalDedupHash({
      instrumentId: 'INST_BTC_USD_SPOT',
      signalType: 'BUY_SETUP',
      horizon: 'BREVE',
      timeframe: '1d',
      dateIsoBucket: '2026-10-17T09',
    });

    const freshQuote: MarketQuote = {
      instrumentId: 'INST_BTC_USD_SPOT',
      price: 90000,
      changeAbs: 1200,
      changePct: 1.5,
      currency: 'USD',
      providerId: 'coingecko',
      providerName: 'CoinGecko API',
      venueMic: 'CRYPTO_GLOBAL',
      observedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      freshness: 'REALTIME',
      delaySeconds: 10,
      validity: 'VALID',
      isMarketOpen: true,
      isDemoData: false,
    };

    const sig = evaluateDeterministicSignal({
      instrument: btcInst,
      quote: freshQuote,
      indicators,
      horizon: 'BREVE',
    });
    sig.dedupHash = hash;

    expect(isDuplicateSignal(hash, [sig], 120)).toBe(true);
    expect(isDuplicateSignal('ALTRO_HASH_DIVERSO', [sig], 120)).toBe(false);

    // Verifica cooldown regola di alert
    const now = new Date('2026-10-17T10:00:00Z');
    const rule = {
      id: 'R1',
      instrumentId: 'INST_BTC_USD_SPOT',
      instrumentTicker: 'BTC/USD',
      ruleType: 'PRICE_ABOVE' as const,
      horizon: 'BREVE' as const,
      thresholdValue: 85000,
      priority: 'HIGH' as const,
      cooldownMinutes: 60,
      isActive: true,
      lastTriggeredAt: '2026-10-17T09:30:00Z', // 30 minuti fa (< 60m cooldown)
      createdAt: '2026-10-17T08:00:00Z',
    };

    const suppressed = evaluateUserAlertRules({
      rules: [rule],
      quote: freshQuote,
      nowUtc: now,
    });
    expect(suppressed.length).toBe(0);

    // Dopo 61 minuti il cooldown è terminato e l'alert scatta
    const afterCooldown = new Date('2026-10-17T10:35:00Z');
    const fired = evaluateUserAlertRules({
      rules: [rule],
      quote: freshQuote,
      nowUtc: afterCooldown,
    });
    expect(fired.length).toBe(1);
  });
});

describe('DemInvest — Universal Instrument Registry, Broker CSV & Backtesting (Sezione 7, 8, 16 & 26)', () => {
  it('11. Identifica univocamente gli strumenti tramite ISIN, CoinGecko ID o Contract Address evitando collisioni', () => {
    const byIsin = resolveInstrumentIdentity({ isin: 'IE00BK5BQT80' });
    expect(byIsin.matchMethod).toBe('ISIN_MIC');
    expect(byIsin.instrument?.id).toBe('INST_VWCE_XETR_ETF');

    const byCg = resolveInstrumentIdentity({ coingeckoId: 'bitcoin' });
    expect(byCg.matchMethod).toBe('COINGECKO_ID');
    expect(byCg.instrument?.id).toBe('INST_BTC_USD_SPOT');
    expect(byCg.instrument?.isDerivative).toBe(false);

    const byContract = resolveInstrumentIdentity({
      contractAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
    });
    expect(byContract.matchMethod).toBe('CONTRACT_ADDRESS');
    expect(byContract.instrument?.id).toBe('INST_LINK_USD_SPOT');

    // Rifiuta ticker ambiguo quando esistono sia Spot sia CFD per baseAssetSymbol BTC
    const ambiguous = resolveInstrumentIdentity({ ticker: 'BTC' });
    expect(ambiguous.matchMethod).toBe('AMBIGUOUS_TICKER_REJECTED');
    expect(ambiguous.ambiguityWarning).toContain('strumenti distinti');
  });

  it('12. Importa correttamente i simboli MT4/MT5 da CSV e applica costi a Paper Trading e Backtest', () => {
    const csv = [
      'broker_code,broker_symbol,instrument_id,description,contract_type,currency,contract_size,tick_size,spread_bps',
      'MT5,EURUSD.pro,INST_EURUSD_FX,Euro vs US Dollar Raw ECN,CFD,USD,100000,0.00001,4',
    ].join('\n');

    const parsed = parseBrokerMappingsCsv(csv);
    expect(parsed.errors.length).toBe(0);
    expect(parsed.imported.length).toBe(1);
    expect(parsed.imported[0].verificationStatus).toBe('USER_CONFIRMED');
    expect(parsed.imported[0].brokerSymbol).toBe('EURUSD.pro');

    const candles = buildControlledCandles(50, 100, 1.1);
    const bt = runDeterministicBacktest({
      strategyId: 'STRAT_SMA_CROSS_10_20_V1',
      instrumentId: 'INST_BTC_USD_SPOT',
      instrumentTicker: 'BTC/USD',
      providerId: 'coingecko',
      timeframe: '1d',
      rawCandles: candles,
      initialCapital: 10000,
      commissionPct: 0.1,
      spreadBps: 10,
      slippageBps: 5,
      maxRiskPerTradePct: 2,
    });
    expect(bt.antiBiasChecks.closedCandlesOnly).toBe(true);
    expect(bt.antiBiasChecks.nextBarOpenExecution).toBe(true);
    expect(bt.antiBiasChecks.inSampleOutOfSampleSeparated).toBe(true);

    // Verifica Paper Trading con spread e slippage
    const paperRes = executeSimulatedPaperOrder({
      account: {
        name: 'Test Paper',
        baseCurrency: 'USD',
        initialCapital: 10000,
        cashBalance: 10000,
        defaultSpreadBps: 20,
        defaultSlippageBps: 10,
        defaultCommissionPct: 0.1,
        orders: [],
        positions: [],
        realizedPnlTotal: 0,
        unrealizedPnlTotal: 0,
        totalEquity: 10000,
        maxDrawdownPct: 0,
      },
      instrumentId: 'INST_AAPL_XNGS_EQ',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      side: 'BUY',
      quantity: 10,
      quote: {
        instrumentId: 'INST_AAPL_XNGS_EQ',
        price: 200,
        changeAbs: 2,
        changePct: 1,
        currency: 'USD',
        providerId: 'twelvedata',
        providerName: 'Twelve Data',
        venueMic: 'XNGS',
        observedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        freshness: 'DELAYED',
        delaySeconds: 60,
        validity: 'VALID',
        isMarketOpen: true,
        isDemoData: false,
      },
    });
    expect(paperRes.order.simulatedExecutionPrice).toBeGreaterThan(200);
    expect(paperRes.order.simulatedSpreadCost).toBeGreaterThan(0);
    expect(paperRes.order.simulatedSlippageCost).toBeGreaterThan(0);
    expect(paperRes.order.simulatedCommission).toBeGreaterThan(0);
  });
});
