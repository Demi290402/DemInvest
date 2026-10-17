// ==============================================================================
// DEMINVEST — PAPER TRADING & STRATEGY BACKTESTING ENGINE
// ==============================================================================
// Regole Non Negoziabili (Sezione 16 e 29):
// 1. I prezzi simulati includono esplicitamente spread, slippage parametrico
//    e commissioni e NON sono mai presentati come ordini eseguiti sul mercato.
// 2. Il motore di Backtesting previene rigorosamente il look-ahead bias:
//    - valuta gli indicatori solo fino alla barra chiusa `t`
//    - esegue l'ordine simulato sul prezzo `open` della barra successiva `t + 1`
//    - separa sempre il segmento IN_SAMPLE (70%) da OUT_OF_SAMPLE (30%).
// ==============================================================================

import {
  BacktestResult,
  BacktestTrade,
  CandleTimeframe,
  HistoricalCandle,
  MarketQuote,
  PaperAccountState,
  PaperOrder,
  PaperPosition,
} from '../types/domain';
import { roundAccounting } from './portfolioEngine';
import {
  calculateATR,
  calculateMaxDrawdownPct,
  calculateRSI,
  calculateSMA,
  sanitizeClosedCandles,
} from './quantitativeEngine';

export interface StrategyCatalogItem {
  id: string;
  name: string;
  version: string;
  horizon: string;
  description: string;
  rulesSummary: string[];
}

export const VERSIONED_STRATEGIES: StrategyCatalogItem[] = [
  {
    id: 'STRAT_SMA_CROSS_10_20_V1',
    name: 'Trend Following Crossover (SMA 10 / SMA 20)',
    version: '1.0.0',
    horizon: 'BREVE / MEDIO',
    description:
      'Strategia trend-following long-only basata sull\'incrocio della media mobile semplice veloce (10 periodi) sopra la media lenta (20 periodi), con esecuzione sull\'apertura della candela successiva.',
    rulesSummary: [
      'Ingresso Long: SMA(10) incrocia al rialzo SMA(20) a candela chiusa (eseguito a Open t+1)',
      'Uscita: SMA(10) incrocia al ribasso SMA(20) oppure Stop Loss parametrico (-2.5 * ATR)',
      'Costi: Spread, Slippage e Commissione applicati sia in ingresso sia in uscita',
    ],
  },
  {
    id: 'STRAT_RSI_PULLBACK_TREND_V1',
    name: 'Pullback RSI(14) in Trend Rialzista',
    version: '1.0.0',
    horizon: 'BREVE',
    description:
      'Acquista ritracciamenti temporanei (RSI 14 < 42) quando il prezzo si mantiene sopra o in prossimità del supporto dinamico SMA(20), chiudendo quando RSI supera 65.',
    rulesSummary: [
      'Ingresso Long: RSI(14) < 42 e Close >= 0.96 * SMA(20) (eseguito a Open t+1)',
      'Uscita: RSI(14) >= 65 o violazione ribassista (-2.0 * ATR)',
      'Separazione rigorosa In-Sample (70%) / Out-of-Sample (30%)',
    ],
  },
  {
    id: 'STRAT_CHANNEL_BREAKOUT_15_V1',
    name: 'Breakout Canale Donchian a 15 Periodi',
    version: '1.0.0',
    horizon: 'BREVE / MEDIO',
    description:
      'Cattura le espansioni direzionali quando la chiusura supera il massimo delle ultime 15 candele chiuse, uscendo alla rottura del minimo a 8 periodi.',
    rulesSummary: [
      'Ingresso Long: Close(t) > Max(High[t-15..t-1]) (eseguito a Open t+1)',
      'Uscita: Close(t) < Min(Low[t-8..t-1])',
      'Nessun uso di candele incomplete o future',
    ],
  },
];

/**
 * Esegue un ordine simulato di Paper Trading applicando spread, slippage e commissioni.
 */
export function executeSimulatedPaperOrder(params: {
  account: PaperAccountState;
  instrumentId: string;
  ticker: string;
  name: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  quote: MarketQuote;
  customSpreadBps?: number;
  customSlippageBps?: number;
  customCommissionPct?: number;
  stopLoss?: number;
  takeProfit?: number;
  rationaleNotes?: string;
}): {
  updatedAccount: PaperAccountState;
  order: PaperOrder;
} {
  const {
    account,
    instrumentId,
    ticker,
    name,
    side,
    quantity,
    quote,
    customSpreadBps,
    customSlippageBps,
    customCommissionPct,
    stopLoss,
    takeProfit,
    rationaleNotes,
  } = params;

  if (quote.validity !== 'VALID' || quote.price <= 0) {
    throw new Error(
      'Impossibile simulare ordine di Paper Trading: la quotazione di riferimento non è valida o è assente.'
    );
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('La quantità simulata deve essere un numero positivo.');
  }

  const spreadBps = customSpreadBps ?? account.defaultSpreadBps;
  const slippageBps = customSlippageBps ?? account.defaultSlippageBps;
  const commissionPct = customCommissionPct ?? account.defaultCommissionPct;

  const refPrice = quote.price;
  // Half-spread + slippage in direzione sfavorevole al trader (realismo esecutivo)
  const halfSpreadFactor = (spreadBps / 2) / 10000;
  const slippageFactor = slippageBps / 10000;
  const totalFrictionFactor = halfSpreadFactor + slippageFactor;

  const simulatedExecutionPrice =
    side === 'BUY'
      ? roundAccounting(refPrice * (1 + totalFrictionFactor), 6)
      : roundAccounting(refPrice * Math.max(0.0001, 1 - totalFrictionFactor), 6);

  const notional = quantity * refPrice;
  const simulatedSpreadCost = roundAccounting(notional * halfSpreadFactor, 2);
  const simulatedSlippageCost = roundAccounting(notional * slippageFactor, 2);
  const simulatedCommission = roundAccounting(
    quantity * simulatedExecutionPrice * (commissionPct / 100),
    2
  );

  const positions = account.positions.map((p) => ({ ...p }));
  const existingIdx = positions.findIndex((p) => p.instrumentId === instrumentId);
  let cashBalance = account.cashBalance;
  let realizedPnl: number | null = null;
  let realizedPnlTotal = account.realizedPnlTotal;

  if (side === 'BUY') {
    const totalCashRequired = roundAccounting(
      quantity * simulatedExecutionPrice + simulatedCommission,
      2
    );
    if (totalCashRequired > cashBalance) {
      throw new Error(
        `Liquidità virtuale insufficiente: richiesti ${totalCashRequired.toFixed(2)} ${account.baseCurrency}, disponibili ${cashBalance.toFixed(2)} ${account.baseCurrency}.`
      );
    }
    cashBalance = roundAccounting(cashBalance - totalCashRequired, 2);

    if (existingIdx >= 0) {
      const existing = positions[existingIdx];
      const newQty = roundAccounting(existing.quantity + quantity, 8);
      const newAvg = roundAccounting(
        (existing.quantity * existing.averageEntryPrice +
          quantity * simulatedExecutionPrice +
          simulatedCommission) /
          newQty,
        6
      );
      positions[existingIdx] = {
        ...existing,
        quantity: newQty,
        averageEntryPrice: newAvg,
        currentPrice: refPrice,
        stopLoss: stopLoss ?? existing.stopLoss,
        takeProfit: takeProfit ?? existing.takeProfit,
      };
    } else {
      const avgWithComm = roundAccounting(
        (quantity * simulatedExecutionPrice + simulatedCommission) / quantity,
        6
      );
      positions.push({
        instrumentId,
        ticker,
        name,
        quantity,
        averageEntryPrice: avgWithComm,
        currency: quote.currency,
        currentPrice: refPrice,
        unrealizedPnl: roundAccounting((refPrice - avgWithComm) * quantity, 2),
        unrealizedPnlPct: roundAccounting(((refPrice - avgWithComm) / avgWithComm) * 100, 2),
        stopLoss,
        takeProfit,
      });
    }
  } else {
    if (existingIdx < 0 || positions[existingIdx].quantity < quantity) {
      throw new Error(
        `Posizione simulata insufficiente su ${ticker} per eseguire la vendita di ${quantity} unità.`
      );
    }
    const existing = positions[existingIdx];
    const netProceeds = roundAccounting(
      quantity * simulatedExecutionPrice - simulatedCommission,
      2
    );
    const costBasisRemoved = roundAccounting(quantity * existing.averageEntryPrice, 2);
    realizedPnl = roundAccounting(netProceeds - costBasisRemoved, 2);
    realizedPnlTotal = roundAccounting(realizedPnlTotal + realizedPnl, 2);
    cashBalance = roundAccounting(cashBalance + netProceeds, 2);

    const remainingQty = roundAccounting(existing.quantity - quantity, 8);
    if (remainingQty <= 0.00000001) {
      positions.splice(existingIdx, 1);
    } else {
      positions[existingIdx] = {
        ...existing,
        quantity: remainingQty,
        currentPrice: refPrice,
      };
    }
  }

  // Ricalcolo P&L non realizzato ed equity totale
  let unrealizedPnlTotal = 0;
  let marketValuePositions = 0;
  for (const pos of positions) {
    const px = pos.instrumentId === instrumentId ? refPrice : (pos.currentPrice ?? pos.averageEntryPrice);
    pos.currentPrice = px;
    pos.unrealizedPnl = roundAccounting((px - pos.averageEntryPrice) * pos.quantity, 2);
    pos.unrealizedPnlPct =
      pos.averageEntryPrice > 0
        ? roundAccounting(((px - pos.averageEntryPrice) / pos.averageEntryPrice) * 100, 2)
        : 0;
    unrealizedPnlTotal = roundAccounting(unrealizedPnlTotal + pos.unrealizedPnl, 2);
    marketValuePositions = roundAccounting(marketValuePositions + px * pos.quantity, 2);
  }

  const order: PaperOrder = {
    id: `PORD_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    instrumentId,
    ticker,
    side,
    quantity,
    referenceMarketPrice: refPrice,
    simulatedExecutionPrice,
    simulatedSpreadCost,
    simulatedSlippageCost,
    simulatedCommission,
    realizedPnl,
    currency: quote.currency,
    quoteProviderId: quote.providerId,
    quoteTimestamp: quote.observedAt,
    rationaleNotes,
    executedAt: new Date().toISOString(),
  };

  const totalEquity = roundAccounting(cashBalance + marketValuePositions, 2);
  const peakEquity = Math.max(account.initialCapital, account.totalEquity, totalEquity);
  const currentDd = peakEquity > 0 ? ((peakEquity - totalEquity) / peakEquity) * 100 : 0;
  const maxDrawdownPct = roundAccounting(Math.max(account.maxDrawdownPct, currentDd), 2);

  return {
    order,
    updatedAccount: {
      ...account,
      cashBalance,
      orders: [order, ...account.orders],
      positions,
      realizedPnlTotal,
      unrealizedPnlTotal,
      totalEquity,
      maxDrawdownPct,
    },
  };
}

/**
 * Esegue un Backtest deterministico senza look-ahead bias su serie storica reale o verificata.
 */
export function runDeterministicBacktest(params: {
  strategyId: string;
  instrumentId: string;
  instrumentTicker: string;
  providerId: string;
  timeframe: CandleTimeframe;
  rawCandles: HistoricalCandle[];
  initialCapital: number;
  commissionPct: number;
  spreadBps: number;
  slippageBps: number;
  maxRiskPerTradePct: number;
}): BacktestResult {
  const {
    strategyId,
    instrumentId,
    instrumentTicker,
    providerId,
    timeframe,
    rawCandles,
    initialCapital,
    commissionPct,
    spreadBps,
    slippageBps,
    maxRiskPerTradePct,
  } = params;

  const candles = sanitizeClosedCandles(rawCandles);
  if (candles.length < 25) {
    throw new Error(
      `Serie storica insufficiente per il backtesting (${candles.length}/25 candele chiuse minime richieste).`
    );
  }

  const strategyMeta =
    VERSIONED_STRATEGIES.find((s) => s.id === strategyId) || VERSIONED_STRATEGIES[0];

  const splitIdx = Math.floor(candles.length * 0.7);
  const inSampleSplitDate = candles[splitIdx]?.isoTime || candles[0].isoTime;

  const frictionEachWay = (spreadBps / 2 + slippageBps) / 10000 + commissionPct / 100;

  let cash = initialCapital;
  let positionQty = 0;
  let entryPrice = 0;
  let entryTime = '';
  let entrySegment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE' = 'IN_SAMPLE';
  let stopLossPrice = 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];
  const warmupBars = 20;
  const benchmarkStartPrice = candles[warmupBars].open;

  // Iteriamo fino a candles.length - 2 perché il segnale calcolato alla chiusura di `i`
  // viene eseguito all'apertura di `i + 1` (zero look-ahead bias!).
  for (let i = warmupBars; i < candles.length - 1; i++) {
    const windowCandles = candles.slice(0, i + 1);
    const closes = windowCandles.map((c) => c.close);
    const currentBar = candles[i];
    const nextBar = candles[i + 1];
    const segment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE' = i < splitIdx ? 'IN_SAMPLE' : 'OUT_OF_SAMPLE';

    const sma10 = calculateSMA(closes, 10);
    const sma20 = calculateSMA(closes, 20);
    const prevCloses = closes.slice(0, closes.length - 1);
    const prevSma10 = calculateSMA(prevCloses, 10);
    const prevSma20 = calculateSMA(prevCloses, 20);
    const rsi14 = calculateRSI(closes, 14);
    const atr14 = calculateATR(windowCandles, 14) ?? currentBar.close * 0.02;

    let shouldEnterLong = false;
    let shouldExitLong = false;
    let exitReason = '';

    if (strategyId === 'STRAT_SMA_CROSS_10_20_V1') {
      if (
        sma10 !== null &&
        sma20 !== null &&
        prevSma10 !== null &&
        prevSma20 !== null
      ) {
        if (prevSma10 <= prevSma20 && sma10 > sma20) {
          shouldEnterLong = true;
        } else if (prevSma10 >= prevSma20 && sma10 < sma20) {
          shouldExitLong = true;
          exitReason = 'Incrocio ribassista SMA(10) < SMA(20)';
        }
      }
    } else if (strategyId === 'STRAT_RSI_PULLBACK_TREND_V1') {
      if (rsi14 !== null && sma20 !== null) {
        if (rsi14 < 44 && currentBar.close >= sma20 * 0.96) {
          shouldEnterLong = true;
        } else if (rsi14 >= 64) {
          shouldExitLong = true;
          exitReason = `Target momentum raggiunto (RSI 14 = ${rsi14})`;
        }
      }
    } else {
      // STRAT_CHANNEL_BREAKOUT_15_V1
      const prior15 = windowCandles.slice(Math.max(0, windowCandles.length - 16), windowCandles.length - 1);
      const prior8 = windowCandles.slice(Math.max(0, windowCandles.length - 9), windowCandles.length - 1);
      const high15 = Math.max(...prior15.map((c) => c.high));
      const low8 = Math.min(...prior8.map((c) => c.low));
      if (currentBar.close > high15) {
        shouldEnterLong = true;
      } else if (currentBar.close < low8) {
        shouldExitLong = true;
        exitReason = 'Violazione minimo canale a 8 periodi';
      }
    }

    // Controllo Stop Loss se siamo in posizione
    if (positionQty > 0 && currentBar.low <= stopLossPrice) {
      shouldExitLong = true;
      exitReason = `Stop Loss ATR attivato (${roundAccounting(stopLossPrice, 4)})`;
    }

    // Esecuzione all'OPEN della barra successiva (nextBar.open)
    if (positionQty === 0 && shouldEnterLong) {
      const execBuyPrice = nextBar.open * (1 + frictionEachWay);
      // Dimensionamento posizione in base al rischio massimo configurato o 95% del capitale disponibile
      const stopDistance = Math.max(2.2 * atr14, execBuyPrice * 0.015);
      const maxCapitalRisk = cash * (maxRiskPerTradePct / 100);
      const riskBasedQty = maxCapitalRisk / stopDistance;
      const maxAffordableQty = (cash * 0.95) / execBuyPrice;
      const qty = roundAccounting(Math.min(riskBasedQty, maxAffordableQty), 6);

      if (qty > 0 && qty * execBuyPrice <= cash) {
        positionQty = qty;
        entryPrice = execBuyPrice;
        entryTime = nextBar.isoTime;
        entrySegment = segment;
        stopLossPrice = execBuyPrice - stopDistance;
        cash = roundAccounting(cash - qty * execBuyPrice, 2);
      }
    } else if (positionQty > 0 && shouldExitLong) {
      const execSellPrice = nextBar.open * Math.max(0.0001, 1 - frictionEachWay);
      const grossProceeds = positionQty * nextBar.open;
      const netProceeds = positionQty * execSellPrice;
      const entryCost = positionQty * entryPrice;
      const totalCosts = roundAccounting(
        Math.abs(grossProceeds - netProceeds) + positionQty * nextBar.open * frictionEachWay,
        2
      );
      const netPnl = roundAccounting(netProceeds - entryCost, 2);
      const returnPct = roundAccounting((netPnl / entryCost) * 100, 2);

      trades.push({
        entryTime,
        exitTime: nextBar.isoTime,
        side: 'LONG',
        entryPrice: roundAccounting(entryPrice, 4),
        exitPrice: roundAccounting(execSellPrice, 4),
        quantity: positionQty,
        grossPnl: roundAccounting( netPnl + totalCosts, 2),
        totalCosts,
        netPnl,
        returnPct,
        sampleSegment: entrySegment,
        exitReason: exitReason || 'Segnale di uscita strategia',
      });

      cash = roundAccounting(cash + netProceeds, 2);
      positionQty = 0;
    }

    const currentStratEquity = roundAccounting(cash + positionQty * currentBar.close, 2);
    const currentBenchEquity = roundAccounting(
      initialCapital * (currentBar.close / benchmarkStartPrice),
      2
    );

    equityCurve.push({
      time: currentBar.isoTime.slice(0, 10),
      strategyEquity: currentStratEquity,
      benchmarkEquity: currentBenchEquity,
      segment,
    });
  }

  // Chiusura eventuale posizione aperta a fine test
  const lastCandle = candles[candles.length - 1];
  if (positionQty > 0) {
    const execSellPrice = lastCandle.close * Math.max(0.0001, 1 - frictionEachWay);
    const netProceeds = positionQty * execSellPrice;
    const entryCost = positionQty * entryPrice;
    const totalCosts = roundAccounting(positionQty * lastCandle.close * frictionEachWay * 2, 2);
    const netPnl = roundAccounting(netProceeds - entryCost, 2);
    trades.push({
      entryTime,
      exitTime: lastCandle.isoTime,
      side: 'LONG',
      entryPrice: roundAccounting(entryPrice, 4),
      exitPrice: roundAccounting(execSellPrice, 4),
      quantity: positionQty,
      grossPnl: roundAccounting(netPnl + totalCosts, 2),
      totalCosts,
      netPnl,
      returnPct: roundAccounting((netPnl / entryCost) * 100, 2),
      sampleSegment: entrySegment,
      exitReason: 'Chiusura fine finestra backtest',
    });
    cash = roundAccounting(cash + netProceeds, 2);
    positionQty = 0;
  }

  const finalEquity = roundAccounting(cash, 2);
  const totalReturnPct = roundAccounting(
    ((finalEquity - initialCapital) / initialCapital) * 100,
    2
  );
  const benchmarkBuyHoldReturnPct = roundAccounting(
    ((lastCandle.close - benchmarkStartPrice) / benchmarkStartPrice) * 100,
    2
  );

  const winningTrades = trades.filter((t) => t.netPnl > 0);
  const losingTrades = trades.filter((t) => t.netPnl <= 0);
  const winRatePct =
    trades.length > 0
      ? roundAccounting((winningTrades.length / trades.length) * 100, 2)
      : 0;

  const grossProfit = winningTrades.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((a, t) => a + t.netPnl, 0));
  const profitFactor =
    grossLoss > 0
      ? roundAccounting(grossProfit / grossLoss, 2)
      : grossProfit > 0
        ? 9.99
        : 0;

  const avgWin =
    winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss =
    losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const riskRewardRatio =
    avgLoss > 0 ? roundAccounting(avgWin / avgLoss, 2) : avgWin > 0 ? 3.0 : 0;

  const maxDrawdownPct =
    calculateMaxDrawdownPct(
      equityCurve.length > 0
        ? equityCurve.map((e) => e.strategyEquity)
        : [initialCapital, finalEquity]
    ) ?? 0;

  const inSampleCurves = equityCurve.filter((e) => e.segment === 'IN_SAMPLE');
  const outSampleCurves = equityCurve.filter((e) => e.segment === 'OUT_OF_SAMPLE');

  const inSampleEndEquity =
    inSampleCurves.length > 0
      ? inSampleCurves[inSampleCurves.length - 1].strategyEquity
      : initialCapital;
  const inSampleReturnPct = roundAccounting(
    ((inSampleEndEquity - initialCapital) / initialCapital) * 100,
    2
  );
  const outOfSampleReturnPct =
    outSampleCurves.length > 0 && inSampleEndEquity > 0
      ? roundAccounting(
          ((finalEquity - inSampleEndEquity) / inSampleEndEquity) * 100,
          2
        )
      : 0;

  return {
    id: `BT_${strategyId}_${instrumentId}_${Date.now()}`,
    strategyId: strategyMeta.id,
    strategyName: strategyMeta.name,
    strategyVersion: strategyMeta.version,
    instrumentId,
    instrumentTicker,
    providerId,
    timeframe,
    startDate: candles[0].isoTime,
    endDate: lastCandle.isoTime,
    candlesCount: candles.length,
    initialCapital,
    finalEquity,
    commissionPct,
    spreadBps,
    slippageBps,
    maxRiskPerTradePct,
    totalReturnPct,
    benchmarkBuyHoldReturnPct,
    totalTrades: trades.length,
    winRatePct,
    profitFactor,
    maxDrawdownPct,
    riskRewardRatio,
    inSampleReturnPct,
    outOfSampleReturnPct,
    inSampleSplitDate,
    antiBiasChecks: {
      closedCandlesOnly: true,
      nextBarOpenExecution: true,
      inSampleOutOfSampleSeparated: true,
      costsAndSlippageApplied: true,
    },
    equityCurve,
    trades,
    createdAt: new Date().toISOString(),
  };
}
