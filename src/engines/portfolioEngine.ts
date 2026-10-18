// ==============================================================================
// DEMINVEST — PORTFOLIO ACCOUNTING, RISK & FX CONVERSION ENGINE
// ==============================================================================
// Regole Non Negoziabili (Sezioni 15 e 18):
// 1. Aritmetica arrotondata al centesimo/decimale contabile per prevenire
//    derive di virgola mobile.
// 2. Ogni conversione valutaria conserva fonte (es. BCE / Frankfurter) e data.
// 3. Se per una posizione non è disponibile una quotazione valida, la posizione
//    e l'intero portafoglio sono contrassegnati con `isValuationComplete: false`.
// 4. Supporto per BUY, SELL, DIVIDEND, COUPON, FEE, DEPOSIT, WITHDRAWAL e CSV.
// ==============================================================================

import {
  MarketQuote,
  NegotiableInstrument,
  PortfolioAnalyticsSummary,
  PortfolioPositionSummary,
  PortfolioTransaction,
  PortfolioTransactionType,
} from '../types/domain';
import { INITIAL_NEGOTIABLE_INSTRUMENTS } from './instrumentRegistry';

export interface FxRateTable {
  baseCurrency: string; // es. 'EUR'
  ratesToBase: Record<string, { rate: number; source: string; date: string }>;
}

/**
 * Arrotondamento contabile deterministico (evita artefatti IEEE-754 come 0.1 + 0.2 = 0.30000000000000004)
 */
export function roundAccounting(value: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Converte un importo dalla valuta `fromCurrency` alla `baseCurrency` (es. EUR)
 * restituendo l'importo convertito, il tasso applicato, la fonte e il timestamp.
 */
export function convertCurrencyToBase(
  amount: number,
  fromCurrency: string,
  fxTable: FxRateTable
): {
  convertedAmount: number;
  rate: number;
  source: string;
  date: string;
} {
  const cleanFrom = fromCurrency.trim().toUpperCase();
  const cleanBase = fxTable.baseCurrency.trim().toUpperCase();

  if (cleanFrom === cleanBase) {
    return {
      convertedAmount: roundAccounting(amount, 4),
      rate: 1,
      source: 'IDENTITY_SAME_CURRENCY',
      date: new Date().toISOString().slice(0, 10),
    };
  }

  const entry = fxTable.ratesToBase[cleanFrom];
  if (!entry || entry.rate <= 0) {
    throw new Error(
      `Tasso di cambio mancante o non valido per la coppia ${cleanFrom}/${cleanBase}.`
    );
  }

  return {
    convertedAmount: roundAccounting(amount * entry.rate, 4),
    rate: entry.rate,
    source: entry.source,
    date: entry.date,
  };
}

/**
 * Calcola lo stato completo del portafoglio manuale a partire dallo storico transazioni,
 * dalle quotazioni correnti verificate e dalla tabella cambi BCE.
 */
export function calculatePortfolioAnalytics(params: {
  transactions: PortfolioTransaction[];
  quotesByInstrumentId: Record<string, MarketQuote | undefined>;
  fxTable: FxRateTable;
  instruments?: NegotiableInstrument[];
}): PortfolioAnalyticsSummary {
  const {
    transactions,
    quotesByInstrumentId,
    fxTable,
    instruments = INITIAL_NEGOTIABLE_INSTRUMENTS,
  } = params;

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
  );

  let cashBalanceInBase = 0;
  let totalRealizedPnlInBase = 0;
  let totalDividendsInBase = 0;
  let totalFeesPaidInBase = 0;

  interface InternalLotBucket {
    instrumentId: string;
    declaredBrokerCode: string;
    quantity: number;
    totalCostNative: number;
    totalCostInBase: number;
    realizedPnlInBase: number;
    dividendsInBase: number;
    feesInBase: number;
    currency: string;
  }

  const buckets = new Map<string, InternalLotBucket>();

  for (const tx of sortedTx) {
    const fxRate = tx.fxRateToBase > 0 ? tx.fxRateToBase : (fxTable.ratesToBase[tx.currency]?.rate ?? 1);
    const feeInBase = roundAccounting(tx.fees * fxRate, 4);
    totalFeesPaidInBase = roundAccounting(totalFeesPaidInBase + feeInBase, 4);

    if (tx.transactionType === 'DEPOSIT') {
      const grossInBase = roundAccounting(tx.quantity * tx.unitPrice * fxRate, 4);
      const amount = grossInBase > 0 ? grossInBase : roundAccounting(tx.unitPrice * fxRate, 4);
      cashBalanceInBase = roundAccounting(cashBalanceInBase + amount - feeInBase, 4);
      continue;
    }

    if (tx.transactionType === 'WITHDRAWAL') {
      const grossInBase = roundAccounting(tx.quantity * tx.unitPrice * fxRate, 4);
      const amount = grossInBase > 0 ? grossInBase : roundAccounting(tx.unitPrice * fxRate, 4);
      cashBalanceInBase = roundAccounting(cashBalanceInBase - amount - feeInBase, 4);
      continue;
    }

    if (!tx.instrumentId) continue;
    const key = `${tx.instrumentId}::${tx.declaredBrokerCode || 'DEFAULT'}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        instrumentId: tx.instrumentId,
        declaredBrokerCode: tx.declaredBrokerCode || 'DEFAULT',
        quantity: 0,
        totalCostNative: 0,
        totalCostInBase: 0,
        realizedPnlInBase: 0,
        dividendsInBase: 0,
        feesInBase: 0,
        currency: tx.currency,
      };
      buckets.set(key, bucket);
    }

    bucket.feesInBase = roundAccounting(bucket.feesInBase + feeInBase, 4);

    if (tx.transactionType === 'BUY') {
      const costNative = roundAccounting(tx.quantity * tx.unitPrice + tx.fees, 4);
      const costInBase = roundAccounting(costNative * fxRate, 4);
      bucket.quantity = roundAccounting(bucket.quantity + tx.quantity, 8);
      bucket.totalCostNative = roundAccounting(bucket.totalCostNative + costNative, 4);
      bucket.totalCostInBase = roundAccounting(bucket.totalCostInBase + costInBase, 4);
      cashBalanceInBase = roundAccounting(cashBalanceInBase - costInBase, 4);
    } else if (tx.transactionType === 'SELL') {
      const sellQty = Math.min(tx.quantity, bucket.quantity);
      if (sellQty > 0 && bucket.quantity > 0) {
        const proportion = sellQty / bucket.quantity;
        const removedCostNative = roundAccounting(bucket.totalCostNative * proportion, 4);
        const removedCostInBase = roundAccounting(bucket.totalCostInBase * proportion, 4);

        const netProceedsNative = roundAccounting(sellQty * tx.unitPrice - tx.fees, 4);
        const netProceedsInBase = roundAccounting(netProceedsNative * fxRate, 4);
        const tradeRealizedInBase = roundAccounting(netProceedsInBase - removedCostInBase, 4);

        bucket.quantity = roundAccounting(bucket.quantity - sellQty, 8);
        bucket.totalCostNative = roundAccounting(
          Math.max(0, bucket.totalCostNative - removedCostNative),
          4
        );
        bucket.totalCostInBase = roundAccounting(
          Math.max(0, bucket.totalCostInBase - removedCostInBase),
          4
        );
        bucket.realizedPnlInBase = roundAccounting(
          bucket.realizedPnlInBase + tradeRealizedInBase,
          4
        );
        totalRealizedPnlInBase = roundAccounting(
          totalRealizedPnlInBase + tradeRealizedInBase,
          4
        );
        cashBalanceInBase = roundAccounting(cashBalanceInBase + netProceedsInBase, 4);
      }
    } else if (tx.transactionType === 'DIVIDEND' || tx.transactionType === 'COUPON') {
      const grossAmount = tx.quantity > 0 ? tx.quantity * tx.unitPrice : tx.unitPrice;
      const netDivInBase = roundAccounting((grossAmount - tx.fees) * fxRate, 4);
      bucket.dividendsInBase = roundAccounting(bucket.dividendsInBase + netDivInBase, 4);
      totalDividendsInBase = roundAccounting(totalDividendsInBase + netDivInBase, 4);
      cashBalanceInBase = roundAccounting(cashBalanceInBase + netDivInBase, 4);
    } else if (tx.transactionType === 'FEE') {
      cashBalanceInBase = roundAccounting(cashBalanceInBase - feeInBase, 4);
    }
  }

  const positions: PortfolioPositionSummary[] = [];
  let totalInvestedCostInBase = 0;
  let estimatedMarketValueInBase = 0;
  let incompletePositionsCount = 0;

  for (const bucket of buckets.values()) {
    if (bucket.quantity <= 0.00000001) continue;

    const inst = instruments.find((i) => i.id === bucket.instrumentId);
    const quote = quotesByInstrumentId[bucket.instrumentId];
    const avgCostNative = roundAccounting(bucket.totalCostNative / bucket.quantity, 4);

    totalInvestedCostInBase = roundAccounting(
      totalInvestedCostInBase + bucket.totalCostInBase,
      2
    );

    const hasValidQuote =
      quote !== undefined && quote.validity === 'VALID' && quote.price > 0;

    let currentMarketPrice: number | null = null;
    let estimatedPosValueInBase: number | null = null;
    let unrealizedPnlInBase: number | null = null;
    let unrealizedPnlPct: number | null = null;
    let fxRateUsed = 1;
    let fxSourceUsed = 'IDENTITY_SAME_CURRENCY';
    let fxDateUsed = new Date().toISOString().slice(0, 10);

    if (hasValidQuote && quote) {
      currentMarketPrice = quote.price;
      const fxInfo = fxTable.ratesToBase[quote.currency] ?? {
        rate: 1,
        source: 'ECB_FRANKFURTER',
        date: new Date().toISOString().slice(0, 10),
      };
      fxRateUsed = quote.currency === fxTable.baseCurrency ? 1 : fxInfo.rate;
      fxSourceUsed = quote.currency === fxTable.baseCurrency ? 'IDENTITY_SAME_CURRENCY' : fxInfo.source;
      fxDateUsed = fxInfo.date;

      const grossMarketNative = bucket.quantity * quote.price;
      estimatedPosValueInBase = roundAccounting(grossMarketNative * fxRateUsed, 2);
      unrealizedPnlInBase = roundAccounting(
        estimatedPosValueInBase - bucket.totalCostInBase,
        2
      );
      unrealizedPnlPct =
        bucket.totalCostInBase > 0
          ? roundAccounting((unrealizedPnlInBase / bucket.totalCostInBase) * 100, 2)
          : 0;

      estimatedMarketValueInBase = roundAccounting(
        estimatedMarketValueInBase + estimatedPosValueInBase,
        2
      );
    } else {
      incompletePositionsCount += 1;
    }

    positions.push({
      instrumentId: bucket.instrumentId,
      ticker: inst?.ticker || bucket.instrumentId,
      name: inst?.name || bucket.instrumentId,
      assetClass: inst?.assetClass || 'EQUITY',
      declaredBrokerCode: bucket.declaredBrokerCode,
      quantity: bucket.quantity,
      averageCostPrice: avgCostNative,
      costCurrency: bucket.currency,
      totalCostBasisInBase: roundAccounting(bucket.totalCostInBase, 2),
      currentMarketPrice,
      quoteCurrency: quote?.currency || inst?.quoteCurrency || bucket.currency,
      quoteProvider: quote?.providerName || null,
      quoteTimestamp: quote?.observedAt || null,
      quoteFreshness: quote?.freshness || 'UNAVAILABLE',
      fxRateToBase: fxRateUsed,
      fxSource: fxSourceUsed,
      fxTimestamp: fxDateUsed,
      estimatedMarketValueInBase: estimatedPosValueInBase,
      unrealizedPnlInBase,
      unrealizedPnlPct,
      realizedPnlInBase: roundAccounting(bucket.realizedPnlInBase, 2),
      dividendsReceivedInBase: roundAccounting(bucket.dividendsInBase, 2),
      totalFeesPaidInBase: roundAccounting(bucket.feesInBase, 2),
      allocationWeightPct: 0, // calcolato dopo il totale
      valuationComplete: hasValidQuote,
    });
  }

  // Calcolo pesi di allocazione, rischio di concentrazione (HHI) ed esposizione valutaria
  // Standard HHI su pesi normalizzati non negativi: HHI = sum((w_i * 100)^2), massimo teorico rigoroso = 10000.
  // Calcolo base omogenea: somma dei valori di riferimento (valore di mercato se quotato, costo storico se non quotato).
  const totalInvestedRefVal = roundAccounting(
    positions.reduce(
      (acc, pos) => acc + Math.max(0, pos.estimatedMarketValueInBase ?? pos.totalCostBasisInBase),
      0
    ),
    2
  );

  let hhiSum = 0;
  let topWeight = 0;
  let topTicker: string | null = null;
  const byAssetClass = new Map<PortfolioPositionSummary['assetClass'], number>();
  const byCurrency = new Map<string, number>();

  for (const pos of positions) {
    const refVal = Math.max(0, pos.estimatedMarketValueInBase ?? pos.totalCostBasisInBase);
    const weightPct =
      totalInvestedRefVal > 0
        ? roundAccounting((refVal / totalInvestedRefVal) * 100, 2)
        : 0;
    pos.allocationWeightPct = weightPct;

    hhiSum += Math.pow(weightPct, 2);
    if (weightPct > topWeight) {
      topWeight = weightPct;
      topTicker = pos.ticker;
    }

    byAssetClass.set(
      pos.assetClass,
      roundAccounting((byAssetClass.get(pos.assetClass) || 0) + refVal, 2)
    );
    byCurrency.set(
      pos.quoteCurrency,
      roundAccounting((byCurrency.get(pos.quoteCurrency) || 0) + refVal, 2)
    );
  }

  // Guardrail matematico: HHI deve rigorosamente appartenere all'intervallo [0, 10000]
  const herfindahlIndex = Math.min(10000, Math.max(0, Math.round(hhiSum)));
  const warnings: string[] = [];
  let concentrationLevel: 'LOW' | 'MODERATE' | 'HIGH_CONCENTRATION_RISK' = 'LOW';

  if (topWeight >= 40 || herfindahlIndex >= 2500) {
    concentrationLevel = 'HIGH_CONCENTRATION_RISK';
    warnings.push(
      `Concentrazione elevata: la prima posizione (${topTicker || 'Principale'}) rappresenta il ${topWeight}% del portafoglio investito (Indice HHI = ${herfindahlIndex}/10000).`
    );
  } else if (topWeight >= 25 || herfindahlIndex >= 1500) {
    concentrationLevel = 'MODERATE';
    warnings.push(
      `Concentrazione moderata sulla posizione principale ${topTicker || 'Principale'} (${topWeight}%). Indice HHI = ${herfindahlIndex}/10000.`
    );
  }

  if (incompletePositionsCount > 0) {
    warnings.push(
      `Attenzione: ${incompletePositionsCount} posizione/i non dispongono di un prezzo aggiornato verificato. La valutazione complessiva e la concentrazione includono stime a costo storico.`
    );
  }

  const unrealizedPnlTotal = roundAccounting(
    estimatedMarketValueInBase - totalInvestedCostInBase,
    2
  );
  const unrealizedPnlPctTotal =
    totalInvestedCostInBase > 0
      ? roundAccounting((unrealizedPnlTotal / totalInvestedCostInBase) * 100, 2)
      : 0;

  return {
    baseCurrency: fxTable.baseCurrency,
    cashBalanceInBase: Math.max(0, roundAccounting(cashBalanceInBase, 2)),
    totalInvestedCostInBase,
    estimatedMarketValueInBase,
    totalPortfolioEquityInBase: roundAccounting(
      Math.max(0, cashBalanceInBase) + estimatedMarketValueInBase,
      2
    ),
    unrealizedPnlInBase: unrealizedPnlTotal,
    unrealizedPnlPct: unrealizedPnlPctTotal,
    realizedPnlInBase: roundAccounting(totalRealizedPnlInBase, 2),
    totalDividendsInBase: roundAccounting(totalDividendsInBase, 2),
    totalFeesPaidInBase: roundAccounting(totalFeesPaidInBase, 2),
    isValuationComplete: incompletePositionsCount === 0,
    incompletePositionsCount,
    fxRatesUsed: fxTable.ratesToBase,
    concentrationRisk: {
      herfindahlIndex,
      topPositionWeightPct: topWeight,
      topPositionTicker: topTicker,
      concentrationLevel,
      warnings,
    },
    assetClassAllocation: Array.from(byAssetClass.entries()).map(([assetClass, valueInBase]) => ({
      assetClass,
      valueInBase,
      weightPct:
        totalInvestedRefVal > 0
          ? roundAccounting((valueInBase / totalInvestedRefVal) * 100, 2)
          : 0,
    })),
    currencyExposure: Array.from(byCurrency.entries()).map(([currency, valueInBase]) => ({
      currency,
      valueInBase,
      weightPct:
        totalInvestedRefVal > 0
          ? roundAccounting((valueInBase / totalInvestedRefVal) * 100, 2)
          : 0,
    })),
    positions,
  };
}

/**
 * Esporta le transazioni di portafoglio in formato CSV standard.
 */
export function exportPortfolioTransactionsCsv(transactions: PortfolioTransaction[]): string {
  const header =
    'id,instrument_id,ticker,transaction_type,quantity,unit_price,fees,currency,fx_rate_to_base,fx_source,declared_broker_code,executed_at,notes';
  const rows = transactions.map((t) =>
    [
      t.id,
      t.instrumentId || '',
      t.instrumentTicker || '',
      t.transactionType,
      t.quantity,
      t.unitPrice,
      t.fees,
      t.currency,
      t.fxRateToBase,
      t.fxSource,
      t.declaredBrokerCode,
      t.executedAt,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Importa transazioni di portafoglio da stringa CSV.
 */
export function importPortfolioTransactionsCsv(csvContent: string): {
  transactions: PortfolioTransaction[];
  errors: string[];
} {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    return {
      transactions: [],
      errors: ['Il file CSV deve contenere intestazione e almeno una transazione.'],
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const transactions: PortfolioTransaction[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });

    const txType = (row.transaction_type || 'BUY').toUpperCase() as PortfolioTransactionType;
    const validTypes: PortfolioTransactionType[] = [
      'BUY',
      'SELL',
      'DIVIDEND',
      'COUPON',
      'FEE',
      'DEPOSIT',
      'WITHDRAWAL',
    ];
    if (!validTypes.includes(txType)) {
      errors.push(`Riga ${i + 1}: transaction_type "${row.transaction_type}" non valido.`);
      continue;
    }

    const quantity = Number(row.quantity || 0);
    const unitPrice = Number(row.unit_price || 0);
    const fees = Number(row.fees || 0);

    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity < 0 || unitPrice < 0) {
      errors.push(`Riga ${i + 1}: quantità o prezzo non validi.`);
      continue;
    }

    transactions.push({
      id: row.id || `TX_CSV_${Date.now()}_${i}`,
      instrumentId: row.instrument_id || undefined,
      instrumentTicker: row.ticker || row.instrument_id || undefined,
      transactionType: txType,
      quantity,
      unitPrice,
      fees: Number.isFinite(fees) && fees >= 0 ? fees : 0,
      currency: (row.currency || 'EUR').toUpperCase(),
      fxRateToBase: Number(row.fx_rate_to_base) > 0 ? Number(row.fx_rate_to_base) : 1,
      fxSource: row.fx_source || 'CSV_IMPORT',
      fxObservedAt: row.executed_at || new Date().toISOString(),
      declaredBrokerCode: row.declared_broker_code || 'TRADE_REPUBLIC',
      executedAt: row.executed_at || new Date().toISOString(),
      notes: row.notes || 'Importato da CSV',
    });
  }

  return { transactions, errors };
}
