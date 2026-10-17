// ==============================================================================
// DEMINVEST — ISOLATED DEMO REFERENCE DATASET (SOLO PER MODALITÀ DEMO ESPLICITA)
// ==============================================================================
// Regola 29: "I dati dimostrativi sono consentiti esclusivamente in una modalità
// DEMO esplicitamente identificata e separata dal funzionamento reale."
// Questo modulo viene invocato ESCLUSIVAMENTE quando l'utente attiva manualmente
// `dataExecutionMode === 'DEMO'`. Ogni oggetto prodotto ha `isDemoData: true`.
// ==============================================================================

import { HistoricalCandle, MarketQuote, NegotiableInstrument } from '../src/types/domain';

const DEMO_BASE_PRICES: Record<string, { price: number; changePct: number; vol: number }> = {
  INST_BTC_USD_SPOT: { price: 88450.0, changePct: 2.35, vol: 34500000000 },
  INST_ETH_USD_SPOT: { price: 2940.5, changePct: 1.82, vol: 16200000000 },
  INST_SOL_USD_SPOT: { price: 186.4, changePct: 4.15, vol: 4800000000 },
  INST_LINK_USD_SPOT: { price: 18.75, changePct: -0.95, vol: 520000000 },
  INST_AAPL_XNGS_EQ: { price: 234.8, changePct: 0.74, vol: 44120000 },
  INST_IBM_XNYS_EQ: { price: 232.14, changePct: -0.84, vol: 6955831 },
  INST_VWCE_XETR_ETF: { price: 134.6, changePct: 0.42, vol: 890000 },
  INST_EURUSD_FX: { price: 1.1239, changePct: 0.08, vol: 120000000 },
  INST_BTC_CFD_DERIV: { price: 88495.0, changePct: 2.34, vol: 95000000 },
  INST_BTP10Y_MTAA_BOND: { price: 101.85, changePct: 0.15, vol: 45000000 },
  INST_XAUUSD_SPOT: { price: 2745.2, changePct: 0.62, vol: 18500000 },
};

export function getExplicitDemoQuote(instrument: NegotiableInstrument): MarketQuote {
  const base = DEMO_BASE_PRICES[instrument.id] || {
    price: 100.0,
    changePct: 0.5,
    vol: 1000000,
  };
  const prevClose = +(base.price / (1 + base.changePct / 100)).toFixed(4);
  const changeAbs = +(base.price - prevClose).toFixed(4);
  const nowIso = new Date().toISOString();

  return {
    instrumentId: instrument.id,
    price: base.price,
    open: prevClose,
    high24h: +(base.price * 1.018).toFixed(4),
    low24h: +(base.price * 0.984).toFixed(4),
    previousClose: prevClose,
    changeAbs,
    changePct: base.changePct,
    volume24h: base.vol,
    currency: instrument.quoteCurrency,
    providerId: 'demo_sandbox_dataset',
    providerName: 'MODALITÀ DEMO DIDATTICA (Dati Simulati)',
    venueMic: instrument.venueMic,
    observedAt: nowIso,
    fetchedAt: nowIso,
    freshness: 'REALTIME',
    delaySeconds: 0,
    validity: 'VALID',
    isMarketOpen: true,
    isDemoData: true,
    statusMessage: 'MODALITÀ DEMO ATTIVA: Quotazione dimostrativa isolata dai dati reali.',
  };
}

export function getExplicitDemoCandles(
  instrument: NegotiableInstrument,
  count = 60
): HistoricalCandle[] {
  const base = DEMO_BASE_PRICES[instrument.id]?.price || 100;
  const candles: HistoricalCandle[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const stepSec = 86400;

  // Generatore deterministico basato sull'ID dello strumento (nessun Math.random() volatile)
  let seed = instrument.id
    .split('')
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0);

  let currentPrice = base * 0.88;
  for (let i = count; i >= 1; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const normalized = (seed / 4294967296) - 0.46; // leggero drift positivo per testare trend/pullback
    const pctMove = normalized * 0.032;
    const open = +currentPrice.toFixed(4);
    const close = +(open * (1 + pctMove)).toFixed(4);
    const high = +(Math.max(open, close) * (1 + Math.abs(pctMove) * 0.65 + 0.004)).toFixed(4);
    const low = +(Math.min(open, close) * (1 - Math.abs(pctMove) * 0.55 - 0.004)).toFixed(4);
    const volMultiplier = 0.75 + ((seed % 100) / 100) * 0.9;
    const volume = Math.round((DEMO_BASE_PRICES[instrument.id]?.vol || 1000000) * 0.02 * volMultiplier);

    const time = nowSec - i * stepSec;
    candles.push({
      time,
      isoTime: new Date(time * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume,
      isClosed: true,
      providerId: 'demo_sandbox_dataset',
      isDemoData: true,
    });
    currentPrice = close;
  }

  // Allinea l'ultima candela al prezzo demo di riferimento
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = base;
    if (base > last.high) last.high = base;
    if (base < last.low) last.low = base;
  }

  return candles;
}
